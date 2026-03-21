import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { DisasterEvent, Location } from '@/types';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Slider } from '@/components/ui/slider';
import { fetchWeatherDataForMultipleLocations } from '@/utils/api';
import { Cloud, Droplets, AlertTriangle, Settings, Layers, X, ChevronUp, ChevronDown } from 'lucide-react';
import DynamicIsland from '@/components/DynamicIsland';
import EmergencySOS from '@/components/EmergencySOS';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { createOfflineTileLayer } from '@/utils/offlineTileLayer';
import { predictFlood } from '@/utils/mlModels';

interface HeatmapOverviewProps {
  disasters: DisasterEvent[];
  userLocation: Location | null;
  nearbyDisasters: DisasterEvent[];
}

// Fix Leaflet default icon
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

type RiskLevel = 'low' | 'medium' | 'high';
type OverlayMode = 'disaster' | 'temperature' | 'pollution';
type MapLayer = 'default' | 'satellite' | 'terrain' | 'streets';

const HeatmapOverview: React.FC<HeatmapOverviewProps> = ({ disasters, userLocation, nearbyDisasters }) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersRef = useRef<L.CircleMarker[]>([]);
  const stateLayerRef = useRef<any>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const [activeFilters, setActiveFilters] = useState<Set<RiskLevel>>(
    new Set(['low', 'medium', 'high'])
  );
  const [overlayMode, setOverlayMode] = useState<OverlayMode>('disaster');
  const [mapLayer, setMapLayer] = useState<MapLayer>('default');
  const [heatmapRadius, setHeatmapRadius] = useState(60);
  const [heatmapBlur, setHeatmapBlur] = useState(35);
  const [weatherData, setWeatherData] = useState<Map<string, { temp: number; aqi: number; floodRisk: number; floodFactors: string[] }>>(new Map());
  const [loading, setLoading] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState({ current: 0, total: 0 });
  const [selectedState, setSelectedState] = useState<string | null>(null);
  const [allStatesData, setAllStatesData] = useState<any>(null);
  const [stateAverages, setStateAverages] = useState<Map<string, { avgTemp: number; avgAqi: number; avgRisk: number; count: number }>>(new Map());
  const [isDarkMode, setIsDarkMode] = useState(() => document.documentElement.classList.contains('dark'));
  const [showMapStyleSheet, setShowMapStyleSheet] = useState(false);
  const [showHeatmapSheet, setShowHeatmapSheet] = useState(false);
  const [isLegendMobileOpen, setIsLegendMobileOpen] = useState(false);

  // Auto-resize leaflet map on window resize for mobile
  useEffect(() => {
    const handleResize = () => {
      if (mapInstanceRef.current) {
        setTimeout(() => mapInstanceRef.current?.invalidateSize(), 50);
      }
    };
    window.addEventListener('resize', handleResize);
    // Initial trigger
    handleResize();
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Initialize map
  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;

    const map = L.map(mapRef.current, { zoomControl: false }).setView([22.5, 82.0], 5);
    mapInstanceRef.current = map;

    const getTileUrl = () => {
      // Using Google Maps (gl=IN) to strictly enforce correct Indian political borders in both modes
      return 'https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}&gl=IN';
    };

    const tileLayer = createOfflineTileLayer(getTileUrl(), {
      attribution: '© Google Maps',
      maxZoom: 18,
      regionName: 'browsing',
      className: isDarkMode ? 'dark-map-tiles' : '' // Use refined CSS filter to make Google Maps look like dark mode
    });
    (tileLayer as any).addTo(map);
    tileLayerRef.current = tileLayer;

    // Load state boundaries
    fetch('https://raw.githubusercontent.com/Subhash9325/GeoJson-Data-of-Indian-States/master/Indian_States')
      .then(response => response.json())
      .then(geojsonData => {
        setAllStatesData(geojsonData);
      })
      .catch(error => console.error('Error loading state boundaries:', error));

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // 📡 Global Telemetry Map Navigation: Centering Listener
  useEffect(() => {
    const handleCenterMap = (e: any) => {
      const location = e.detail;
      if (mapInstanceRef.current && location) {
        console.log("📍 Centering map on specialized telemetry:", location);
        mapInstanceRef.current.setView([location.lat, location.lng], 10, {
          animate: true,
          duration: 1.5
        });
      }
    };

    window.addEventListener('centerMap', handleCenterMap);
    return () => window.removeEventListener('centerMap', handleCenterMap);
  }, []);

  // 🛰️ Saarthi Agent: Map Layer & Mode Synchronization
  useEffect(() => {
    const handleSyncLayer = (e: any) => {
      const layer = e.detail as MapLayer;
      if (['default', 'satellite', 'terrain', 'streets'].includes(layer)) {
        console.log(`🗺️ Syncing Map Layer: ${layer}`);
        setMapLayer(layer);
      }
    };

    const handleSyncMode = (e: any) => {
      const mode = e.detail as OverlayMode;
      if (['disaster', 'temperature', 'pollution'].includes(mode)) {
        console.log(`🗺️ Syncing Map Mode: ${mode}`);
        setOverlayMode(mode);
      }
    };

    window.addEventListener('syncMapLayer', handleSyncLayer as EventListener);
    window.addEventListener('syncMapMode', handleSyncMode as EventListener);
    return () => {
      window.removeEventListener('syncMapLayer', handleSyncLayer as EventListener);
      window.removeEventListener('syncMapMode', handleSyncMode as EventListener);
    };
  }, []);

  // Listen for theme changes
  useEffect(() => {
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.attributeName === 'class') {
          const isDark = document.documentElement.classList.contains('dark');
          setIsDarkMode(isDark);
        }
      });
    });

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class'],
    });

    return () => observer.disconnect();
  }, []);

  // Update map layer
  useEffect(() => {
    if (!mapInstanceRef.current || !tileLayerRef.current) return;

    mapInstanceRef.current.removeLayer(tileLayerRef.current);

    let tileUrl = '';
    let attribution = '© Google Maps';

    if (mapLayer === 'satellite') {
      tileUrl = 'https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}&gl=IN';
    } else if (mapLayer === 'terrain') {
      tileUrl = 'https://mt1.google.com/vt/lyrs=p&x={x}&y={y}&z={z}&gl=IN';
    } else if (mapLayer === 'streets') {
      tileUrl = 'https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}&gl=IN';
    } else {
      tileUrl = 'https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}&gl=IN';
    }

    const newTileLayer = createOfflineTileLayer(tileUrl, {
      attribution,
      maxZoom: 18,
      regionName: mapLayer === 'default' ? 'browsing' : mapLayer,
      // Apply dark tint to standard roadmap layers, but never to satellite/terrain
      className: (isDarkMode && mapLayer !== 'satellite' && mapLayer !== 'terrain') ? 'dark-map-tiles' : ''
    });
    (newTileLayer as any).addTo(mapInstanceRef.current);

    tileLayerRef.current = newTileLayer;
  }, [mapLayer, isDarkMode]);

  // Update state boundaries layer
  useEffect(() => {
    if (!mapInstanceRef.current || !allStatesData) return;

    // Remove old state layer
    if (stateLayerRef.current) {
      mapInstanceRef.current.removeLayer(stateLayerRef.current);
    }

    const dataToShow = selectedState
      ? {
        ...allStatesData,
        features: allStatesData.features.filter((f: any) =>
          (f.properties?.NAME_1 || f.properties?.name) === selectedState
        )
      }
      : allStatesData;

    const stateLayer = L.geoJSON(dataToShow, {
      style: {
        color: '#3388ff',
        weight: 1,
        opacity: 0.25,
        fillOpacity: 0.02,
        fillColor: '#3388ff'
      },
      onEachFeature: (feature, layer) => {
        const stateName = feature.properties?.NAME_1 || feature.properties?.name || 'State';

        layer.on({
          mouseover: (e) => {
            if (!selectedState) {
              e.target.setStyle({
                weight: 1.5,
                opacity: 0.4,
                fillOpacity: 0.05
              });
            }
          },
          mouseout: (e) => {
            if (!selectedState) {
              e.target.setStyle({
                weight: 1,
                opacity: 0.25,
                fillOpacity: 0.02
              });
            }
          },
          click: (e) => {
            if (selectedState === stateName) {
              // Double click to reset
              setSelectedState(null);
              mapInstanceRef.current?.setView([22.5, 82.0], 5);
            } else {
              setSelectedState(stateName);
              const bounds = layer.getBounds();
              mapInstanceRef.current?.fitBounds(bounds, { padding: [50, 50] });
            }
          }
        });

        // Create dynamic tooltip based on overlay mode and available data
        const getTooltipContent = () => {
          const avgData = stateAverages.get(stateName);
          let content = `<div style="font-size: 11px; padding: 2px;">
            <strong>${stateName}</strong>`;

          if (avgData && avgData.count > 0) {
            content += `<br/><span style="opacity: 0.8;">Based on ${avgData.count} cities</span>`;

            if (overlayMode === 'disaster') {
              const riskLevel = avgData.avgRisk >= 0.65 ? 'HIGH' : avgData.avgRisk >= 0.45 ? 'MEDIUM' : 'LOW';
              const riskColor = avgData.avgRisk >= 0.65 ? '#ff0000' : avgData.avgRisk >= 0.45 ? '#ffaa00' : '#00ff00';
              content += `<br/>Avg Risk: <strong style="color: ${riskColor};">${riskLevel}</strong> (${(avgData.avgRisk * 100).toFixed(0)}%)`;
            } else if (overlayMode === 'temperature') {
              content += `<br/>Avg Temp: <strong>${avgData.avgTemp.toFixed(1)}°C</strong>`;
            } else if (overlayMode === 'pollution') {
              content += `<br/>Avg AQI: <strong>${avgData.avgAqi.toFixed(0)}</strong>`;
            }
          }

          content += selectedState === stateName ? '<br/><span style="opacity: 0.7; font-size: 10px;">Click again for all India</span>' : '';
          content += '</div>';
          return content;
        };

        layer.bindTooltip(getTooltipContent(), {
          permanent: false,
          direction: 'center',
          className: 'state-tooltip'
        });

        // Update tooltip on hover to show current overlay data
        layer.on('mouseover', () => {
          // Use Leaflet Layer API to update bound tooltip content safely
          if ((layer as any).setTooltipContent) {
            (layer as any).setTooltipContent(getTooltipContent());
          } else if ((layer as any).getTooltip) {
            const tt = (layer as any).getTooltip();
            tt && tt.setContent && tt.setContent(getTooltipContent());
          }
        });
      }
    }).addTo(mapInstanceRef.current);

    stateLayerRef.current = stateLayer;
  }, [allStatesData, selectedState, overlayMode, stateAverages]);

  // Calculate state averages from real weather data
  useEffect(() => {
    if (weatherData.size === 0) return;

    const stateMap = new Map<string, { tempSum: number; aqiSum: number; riskSum: number; count: number }>();

    weatherData.forEach((data, key) => {
      const [lat, lng] = key.split(',').map(Number);

      // Determine state based on coordinates
      let state = 'Unknown';
      if (lat > 28 && lat < 32 && lng > 76 && lng < 78) state = 'Delhi';
      else if (lat > 18 && lat < 22 && lng > 72 && lng < 78) state = 'Maharashtra';
      else if (lat > 22 && lat < 27 && lng > 87 && lng < 89) state = 'West Bengal';
      else if (lat > 12 && lat < 14 && lng > 79 && lng < 81) state = 'Tamil Nadu';
      else if (lat > 12 && lat < 14 && lng > 76 && lng < 79) state = 'Karnataka';
      else if (lat > 16 && lat < 19 && lng > 77 && lng < 79) state = 'Telangana';
      else if (lat > 22 && lat < 25 && lng > 71 && lng < 74) state = 'Gujarat';
      else if (lat > 17 && lat < 20 && lng > 73 && lng < 75) state = 'Maharashtra';
      else if (lat > 26 && lat < 28 && lng > 75 && lng < 76) state = 'Rajasthan';
      else if (lat > 26 && lat < 27 && lng > 80 && lng < 82) state = 'Uttar Pradesh';
      else if (lat > 22 && lat < 24 && lng > 75 && lng < 78) state = 'Madhya Pradesh';
      else if (lat > 30 && lat < 31 && lng > 76 && lng < 77) state = 'Chandigarh';
      else if (lat > 25 && lat < 27 && lng > 91 && lng < 92) state = 'Assam';
      else if (lat > 20 && lat < 21 && lng > 85 && lng < 86) state = 'Odisha';
      else if (lat > 25 && lat < 26 && lng > 85 && lng < 86) state = 'Bihar';
      else if (lat > 8 && lat < 10 && lng > 76 && lng < 77) state = 'Kerala';
      else if (lat > 10 && lat < 12 && lng > 76 && lng < 78) state = 'Tamil Nadu';
      else if (lat > 15 && lat < 16 && lng > 74 && lng < 75) state = 'Goa';
      else if (lat > 23 && lat < 24 && lng > 85 && lng < 86) state = 'Jharkhand';

      // Real-data risk — directly from ML model
      let risk = data.floodRisk || 0;

      const existing = stateMap.get(state) || { tempSum: 0, aqiSum: 0, riskSum: 0, count: 0 };
      stateMap.set(state, {
        tempSum: existing.tempSum + data.temp,
        aqiSum: existing.aqiSum + data.aqi,
        riskSum: existing.riskSum + risk,
        count: existing.count + 1
      });
    });

    // Calculate averages
    const averages = new Map<string, { avgTemp: number; avgAqi: number; avgRisk: number; count: number }>();
    stateMap.forEach((data, state) => {
      averages.set(state, {
        avgTemp: data.tempSum / data.count,
        avgAqi: data.aqiSum / data.count,
        avgRisk: data.riskSum / data.count,
        count: data.count
      });
    });

    setStateAverages(averages);
  }, [weatherData]);


  const toggleFilter = (level: RiskLevel) => {
    setActiveFilters(prev => {
      const newFilters = new Set(prev);
      if (newFilters.has(level)) {
        newFilters.delete(level);
      } else {
        newFilters.add(level);
      }
      return newFilters;
    });
  };

  const getIntensityRange = (intensity: number): RiskLevel => {
    if (intensity >= 0.65) return 'high';
    if (intensity >= 0.45) return 'medium';
    return 'low';
  };

  // Cities covering all Indian states and regions
  const getIndianCities = (): Location[] => {
    return [
      // North - Delhi, UP, Punjab, Haryana, HP, J&K, Uttarakhand
      { lat: 28.7041, lng: 77.1025 }, // Delhi
      { lat: 26.8467, lng: 80.9462 }, // Lucknow
      { lat: 25.3176, lng: 82.9739 }, // Varanasi
      { lat: 27.1767, lng: 78.0081 }, // Agra
      { lat: 28.9845, lng: 77.7064 }, // Meerut
      { lat: 30.7333, lng: 76.7794 }, // Chandigarh
      { lat: 31.6340, lng: 74.8723 }, // Amritsar
      { lat: 30.9010, lng: 75.8573 }, // Ludhiana
      { lat: 31.1048, lng: 77.1734 }, // Shimla
      { lat: 32.7266, lng: 74.8570 }, // Jammu
      { lat: 34.0837, lng: 74.7973 }, // Srinagar
      { lat: 30.0668, lng: 79.0193 }, // Dehradun
      { lat: 29.3803, lng: 79.4636 }, // Haldwani

      // Rajasthan
      { lat: 26.9124, lng: 75.7873 }, // Jaipur
      { lat: 26.4499, lng: 74.6399 }, // Ajmer
      { lat: 26.2389, lng: 73.0243 }, // Jodhpur
      { lat: 24.5854, lng: 73.7125 }, // Udaipur
      { lat: 27.0238, lng: 74.2179 }, // Bikaner
      { lat: 25.1810, lng: 75.8648 }, // Kota

      // West - Maharashtra, Gujarat, Goa
      { lat: 19.0760, lng: 72.8777 }, // Mumbai
      { lat: 18.5204, lng: 73.8567 }, // Pune
      { lat: 21.1458, lng: 79.0882 }, // Nagpur
      { lat: 19.9975, lng: 73.7898 }, // Nashik
      { lat: 16.7050, lng: 74.2433 }, // Kolhapur
      { lat: 23.0225, lng: 72.5714 }, // Ahmedabad
      { lat: 21.1702, lng: 72.8311 }, // Surat
      { lat: 22.3072, lng: 73.1812 }, // Vadodara
      { lat: 23.0300, lng: 72.5800 }, // Gandhinagar
      { lat: 22.2587, lng: 70.7739 }, // Rajkot
      { lat: 21.1959, lng: 72.8302 }, // Bhavnagar
      { lat: 15.2993, lng: 74.1240 }, // Goa

      // Central - MP, Chhattisgarh
      { lat: 23.2599, lng: 77.4126 }, // Bhopal
      { lat: 22.7196, lng: 75.8577 }, // Indore
      { lat: 26.2183, lng: 78.1828 }, // Gwalior
      { lat: 23.1765, lng: 79.9339 }, // Jabalpur
      { lat: 21.1959, lng: 81.2831 }, // Raipur
      { lat: 22.0797, lng: 82.1391 }, // Bilaspur

      // East - Bengal, Bihar, Jharkhand, Odisha
      { lat: 22.5726, lng: 88.3639 }, // Kolkata
      { lat: 22.8046, lng: 86.2029 }, // Jamshedpur
      { lat: 23.3441, lng: 85.3096 }, // Ranchi
      { lat: 25.5941, lng: 85.1376 }, // Patna
      { lat: 25.3960, lng: 86.4700 }, // Bhagalpur
      { lat: 26.4499, lng: 87.2677 }, // Muzaffarpur
      { lat: 20.2961, lng: 85.8245 }, // Bhubaneswar
      { lat: 21.5041, lng: 83.9856 }, // Rourkela
      { lat: 19.8135, lng: 85.8312 }, // Puri

      // Northeast - Assam, Meghalaya, Tripura, Manipur, Nagaland
      { lat: 26.1445, lng: 91.7362 }, // Guwahati
      { lat: 27.4728, lng: 94.9120 }, // Dibrugarh
      { lat: 26.1833, lng: 91.7667 }, // Dispur
      { lat: 25.5788, lng: 91.8933 }, // Shillong
      { lat: 23.8315, lng: 91.2868 }, // Agartala
      { lat: 24.6158, lng: 93.9368 }, // Imphal
      { lat: 25.6747, lng: 94.1086 }, // Kohima

      // South - Karnataka, TN, Kerala, AP, Telangana
      { lat: 12.9716, lng: 77.5946 }, // Bangalore
      { lat: 12.2958, lng: 76.6394 }, // Mysore
      { lat: 15.3173, lng: 75.7139 }, // Hubli
      { lat: 14.4426, lng: 79.9865 }, // Nellore
      { lat: 13.0827, lng: 80.2707 }, // Chennai
      { lat: 11.0168, lng: 76.9558 }, // Coimbatore
      { lat: 10.7905, lng: 78.7047 }, // Trichy
      { lat: 9.9252, lng: 78.1198 }, // Madurai
      { lat: 17.3850, lng: 78.4867 }, // Hyderabad
      { lat: 17.6868, lng: 83.2185 }, // Visakhapatnam
      { lat: 16.5062, lng: 80.6480 }, // Vijayawada
      { lat: 8.5241, lng: 76.9366 }, // Trivandrum
      { lat: 9.9312, lng: 76.2673 }, // Kochi
      { lat: 11.2588, lng: 75.7804 }, // Kozhikode
      { lat: 10.8505, lng: 76.2711 }, // Palakkad
    ];
  };

  // Fetch weather and pollution data in parallel batches — no overlap
  useEffect(() => {
    const abortController = new AbortController();
    const signal = abortController.signal;

    const loadData = async () => {
      setLoading(true);
      setWeatherData(new Map()); // Clear old data immediately on mode switch

      const cities = getIndianCities();
      const totalCities = cities.length;
      setLoadingProgress({ current: 0, total: totalCities });

      const dataMap = new Map<string, { temp: number; aqi: number; floodRisk: number; floodFactors: string[] }>();
      const BATCH_SIZE = 8;
      let loadedCount = 0;

      try {
        // Fetch all temperatures in a single bulk API request to prevent 429 Too Many Requests
        const lats = cities.map(c => c.lat).join(',');
        const lngs = cities.map(c => c.lng).join(',');

        let meteoData: any[] = [];
        try {
          const wRes = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lats}&longitude=${lngs}&current=temperature_2m,relative_humidity_2m,surface_pressure,wind_speed_10m&hourly=precipitation&forecast_days=3&timezone=auto`, { signal });
          if (wRes.ok) {
            const d = await wRes.json();
            meteoData = Array.isArray(d) ? d : [d];
          }
        } catch (e) {
          console.error("Failed to fetch bulk weather array", e);
        }

        for (let i = 0; i < cities.length; i += BATCH_SIZE) {
          if (signal.aborted) break;

          const batch = cities.slice(i, i + BATCH_SIZE);

          await Promise.allSettled(
            batch.map(async (city, idx) => {
              const cityIndex = i + idx;
              const { lat, lng } = city;
              try {
                let temp: number | null = null;
                let floodRisk = 0;
                let floodFactors: string[] = [];

                if (meteoData[cityIndex]?.current?.temperature_2m != null) {
                  const current = meteoData[cityIndex].current;
                  const hourly = meteoData[cityIndex].hourly?.precipitation || [];
                  temp = current.temperature_2m;

                  // Calculate ML features
                  const precip24h = hourly.slice(0, 24).reduce((a: number, b: number) => a + (b || 0), 0);
                  const precip48h = hourly.slice(0, 48).reduce((a: number, b: number) => a + (b || 0), 0);
                  const precip72h = hourly.reduce((a: number, b: number) => a + (b || 0), 0);
                  const maxHourly = Math.max(...hourly.map((v: number) => v || 0), 0);
                  const is_monsoon = [5, 6, 7, 8, 9].includes(new Date().getMonth()) ? 1 : 0;
                  const is_coastal = (lng < 74 || lng > 83 || (lat < 16 && lng > 74)) ? 1 : 0;

                  // Run ML model inference
                  const prediction = await predictFlood({
                    rainfall_24h_mm: precip24h,
                    rainfall_48h_mm: precip48h,
                    rainfall_72h_mm: precip72h,
                    max_hourly_rate_mm: maxHourly,
                    temperature_c: temp as number,
                    humidity_pct: current.relative_humidity_2m || 50,
                    pressure_hpa: current.surface_pressure || 1010,
                    wind_speed_kmh: current.wind_speed_10m || 10,
                    is_monsoon,
                    is_coastal
                  });

                  if (prediction) {
                    floodRisk = prediction.probability;
                    floodFactors = [
                      `Prec 72h: ${precip72h.toFixed(1)}mm`,
                      `Max Hrly: ${maxHourly.toFixed(1)}mm/h`,
                      `Soil Moist: ${current.relative_humidity_2m || 50}%`,
                      `Wind: ${current.wind_speed_10m || 10}km/h`
                    ];
                  }
                }

                // Fetch AQI individually since WAQI doesn't support bulk lat/lng natively
                let aqi: number | null = null;
                const aqiRes = await fetch(
                  `https://api.waqi.info/feed/geo:${lat};${lng}/?token=${import.meta.env.VITE_WAQI_TOKEN}`,
                  { signal }
                );

                if (aqiRes.ok) {
                  const d = await aqiRes.json();
                  if (d.status === 'ok' && d.data?.aqi) aqi = d.data.aqi;
                }

                if (temp !== null) {
                  // Fallback to a nominal AQI if the WAQI API rate-limits the request
                  dataMap.set(`${lat},${lng}`, { temp, aqi: aqi || 75, floodRisk, floodFactors });
                }
              } catch {
                // Ignore per-city failures
              }
            })
          );

          // Give WAQI a brief breather between batches to prevent secondary 429s there
          await new Promise(resolve => setTimeout(resolve, 300));

          loadedCount = Math.min(i + BATCH_SIZE, totalCities);
          setLoadingProgress({ current: loadedCount, total: totalCities });
        }
      } catch {
        // Ignore abort errors
      }

      if (!signal.aborted) {
        setWeatherData(new Map(dataMap)); // Single update — no overlap
        setLoading(false);
        setLoadingProgress({ current: 0, total: 0 });
      }
    };

    loadData();

    return () => {
      abortController.abort(); // Cancel if overlay mode changes
    };
  }, [overlayMode]);


  // Get color based on value with better opacity for heatmap effect
  const getColor = (value: number, mode: OverlayMode, opacity: number = 0.6): string => {
    if (mode === 'temperature') {
      // Temperature: 10-45°C - Purple to Red gradient (matches legend)
      if (value < 15) return `rgba(168, 85, 247, ${opacity})`; // Cool purple (accent)
      if (value < 22) return `rgba(168, 85, 247, ${opacity})`; // Light purple (accent)
      if (value < 28) return `rgba(251, 146, 60, ${opacity})`; // Light orange (warning)
      if (value < 35) return `rgba(249, 115, 22, ${opacity})`; // Orange (warning darker)
      if (value < 40) return `rgba(239, 68, 68, ${opacity})`; // Red (destructive)
      return `rgba(220, 38, 38, ${opacity})`; // Hot dark red (destructive darker)
    } else if (mode === 'pollution') {
      // AQI: 0-300+ - Green to Yellow to Red to Purple gradient (matches legend)
      if (value < 50) return `rgba(34, 197, 94, ${opacity})`; // Good - green (success)
      if (value < 100) return `rgba(234, 179, 8, ${opacity})`; // Moderate - yellow (warning lighter)
      if (value < 150) return `rgba(251, 146, 60, ${opacity})`; // Unhealthy for sensitive - orange (warning)
      if (value < 200) return `rgba(239, 68, 68, ${opacity})`; // Unhealthy - red (destructive)
      if (value < 300) return `rgba(190, 18, 60, ${opacity})`; // Very unhealthy - dark red
      return `rgba(147, 51, 234, ${opacity})`; // Hazardous - purple (accent)
    } else {
      // Disaster risk - Green to Orange to Red gradient (matches legend exactly)
      if (value < 0.45) return `rgba(34, 197, 94, ${opacity})`; // Green (low/success)
      if (value < 0.65) return `rgba(251, 146, 60, ${opacity})`; // Orange (medium/warning)
      return `rgba(239, 68, 68, ${opacity})`; // Red (high/destructive)
    }
  };

  // Update markers
  useEffect(() => {
    if (!mapInstanceRef.current) return;

    // Remove old markers
    markersRef.current.forEach(marker => {
      mapInstanceRef.current?.removeLayer(marker);
    });
    markersRef.current = [];

    if (overlayMode === 'disaster') {
      // Show disaster risk — 100% driven by real API data (temp + AQI), no static geo-zones
      weatherData.forEach((data, key) => {
        const [lat, lng] = key.split(',').map(Number);

        // ── Real-data risk model ──────────────────────────────────────────────
        // Driven 100% by live TF.js Neural Network Inference
        let dynamicRisk = data.floodRisk || 0;
        const riskFactors: string[] = data.floodFactors || ["Awaiting ML Inference..."];

        const level = getIntensityRange(dynamicRisk);
        if (!activeFilters.has(level)) return;

        // Large glow circle
        const glowCircle = L.circleMarker([lat, lng], {
          radius: heatmapRadius,
          fillColor: getColor(dynamicRisk, 'disaster', 0.25),
          color: 'transparent',
          weight: 0,
          fillOpacity: 1,
          className: 'heatmap-glow'
        });

        // Hover circle with real-data tooltip
        const hoverCircle = L.circleMarker([lat, lng], {
          radius: 30,
          fillColor: 'transparent',
          color: 'transparent',
          weight: 0,
          fillOpacity: 0,
        }).bindTooltip(`
            <strong>ML Flood Risk Score</strong><br/>
            Level: <strong style="color: ${getColor(dynamicRisk, 'disaster', 1)}">${level.toUpperCase()}</strong>
            &nbsp;(${(dynamicRisk * 100).toFixed(0)}%)<br/>
            <div style="margin-top: 4px; padding-top: 4px; border-top: 1px solid rgba(255,255,255,0.2);">
              <span style="opacity: 0.8; font-size: 10px;">Live data factors:</span>
              <ul style="margin: 2px 0 0 0; padding-left: 14px; opacity: 0.9;">
                ${riskFactors.map(f => `<li>${f}</li>`).join('')}
              </ul>
            </div>
          </div>
        `, {
          permanent: false,
          direction: 'top',
          className: 'custom-tooltip'
        });

        glowCircle.addTo(mapInstanceRef.current!);
        hoverCircle.addTo(mapInstanceRef.current!);
        markersRef.current.push(glowCircle, hoverCircle);
      });
    } else if (weatherData.size > 0) {
      // Show weather/pollution data with heatmap glow effect
      weatherData.forEach((data, key) => {
        const [lat, lng] = key.split(',').map(Number);
        const value = overlayMode === 'temperature' ? data.temp : data.aqi;

        // Large glow circle for heatmap effect
        const glowCircle = L.circleMarker([lat, lng], {
          radius: heatmapRadius,
          fillColor: getColor(value, overlayMode, 0.25),
          color: 'transparent',
          weight: 0,
          fillOpacity: 1,
          className: 'heatmap-glow'
        });

        // Invisible interactive layer for hover tooltip
        const hoverCircle = L.circleMarker([lat, lng], {
          radius: 30,
          fillColor: 'transparent',
          color: 'transparent',
          weight: 0,
          fillOpacity: 0,
        }).bindTooltip(`
          <div style="font-size: 11px; padding: 4px;">
            <strong>${overlayMode === 'temperature' ? 'Temperature' : 'Air Quality'}</strong><br/>
            ${overlayMode === 'temperature' ? `<strong>${data.temp.toFixed(1)}°C</strong>` : `AQI: <strong>${data.aqi.toFixed(0)}</strong>`}
          </div>
        `, {
          permanent: false,
          direction: 'top',
          className: 'custom-tooltip'
        });

        glowCircle.addTo(mapInstanceRef.current!);
        hoverCircle.addTo(mapInstanceRef.current!);
        markersRef.current.push(glowCircle, hoverCircle);
      });
    }
  }, [overlayMode, weatherData, activeFilters, heatmapRadius]);

  return (
    <div className="h-full w-full relative">
      <style>{`
        .heatmap-glow {
          filter: blur(${heatmapBlur}px);
          opacity: 0.7;
        }
        .custom-tooltip {
          background: rgba(0, 0, 0, 0.8) !important;
          border: 1px solid rgba(255, 255, 255, 0.2) !important;
          border-radius: 8px !important;
          padding: 4px 8px !important;
          color: white !important;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3) !important;
        }
        .custom-tooltip::before {
          border-top-color: rgba(0, 0, 0, 0.8) !important;
        }
        .state-tooltip {
          background: rgba(51, 136, 255, 0.85) !important;
          border: 1px solid rgba(255, 255, 255, 0.2) !important;
          border-radius: 6px !important;
          padding: 3px 8px !important;
          color: white !important;
          font-weight: 500 !important;
          font-size: 11px !important;
          box-shadow: 0 2px 6px rgba(0, 0, 0, 0.15) !important;
        }
      `}</style>
      <DynamicIsland userLocation={userLocation} />
      <div ref={mapRef} className="h-full w-full" />

      {/* === BOTTOM CENTERED CONTROLS (Mode Toggles + Mobile Legend) === */}
      <div className="absolute bottom-4 md:bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-2 z-[1001] pointer-events-auto transition-all">
        
        {/* Layer Toggles */}
        <div className="glass-strong rounded-xl shadow-elevated border border-white/30 backdrop-blur-xl pointer-events-auto transition-all">
          <Tabs value={overlayMode} onValueChange={(value) => setOverlayMode(value as OverlayMode)}>
            <TabsList className="bg-card/40 backdrop-blur-xl rounded-lg border border-border/20 p-1 pointer-events-auto h-auto shadow-sm">
              <TabsTrigger
                value="disaster"
                className="gap-2 rounded-md transition-all duration-300 bg-transparent data-[state=active]:bg-primary data-[state=active]:text-primary-foreground hover:bg-muted/50 py-2 px-3 sm:px-4"
              >
                <AlertTriangle className="h-4 w-4" />
                <span className="hidden sm:inline text-xs font-semibold">Flood Risk ML</span>
              </TabsTrigger>
              <TabsTrigger
                value="temperature"
                className="gap-2 rounded-md transition-all duration-300 bg-transparent data-[state=active]:bg-primary data-[state=active]:text-primary-foreground hover:bg-muted/50 py-2 px-3 sm:px-4"
              >
                <Cloud className="h-4 w-4" />
                <span className="hidden sm:inline text-xs font-semibold">Temp</span>
              </TabsTrigger>
              <TabsTrigger
                value="pollution"
                className="gap-2 rounded-md transition-all duration-300 bg-transparent data-[state=active]:bg-primary data-[state=active]:text-primary-foreground hover:bg-muted/50 py-2 px-3 sm:px-4"
              >
                <Droplets className="h-4 w-4" />
                <span className="hidden sm:inline text-xs font-semibold">AQI</span>
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

      </div>

        {selectedState && (
          <button
            onClick={() => {
              setSelectedState(null);
              mapInstanceRef.current?.setView([22.5, 82.0], 5);
            }}
            className="hidden md:block glass-strong rounded-xl shadow-elevated border border-white/30 px-4 py-2 text-xs font-semibold hover:bg-muted/20 hover:border-border/50 transition-all duration-300 backdrop-blur-xl absolute bottom-full mb-2 left-1/2 -translate-x-1/2 whitespace-nowrap"
          >
            Show All India
          </button>
        )}

      {/* Desktop Map Layer Controls */}
      <div className="hidden md:block absolute top-4 left-4 glass-strong rounded-xl border border-white/30 p-3 z-[1000] backdrop-blur-xl shadow-elevated">
        <h3 className="text-xs font-semibold mb-2 text-foreground">Map Style</h3>
        <div className="flex flex-col gap-2">
          <button
            onClick={() => setMapLayer('default')}
            className={`px-3 py-2 text-xs rounded-lg transition-all duration-300 font-medium ${mapLayer === 'default'
              ? 'bg-primary text-primary-foreground'
              : 'bg-card/90 hover:bg-card border border-border'
              }`}
          >
            Default
          </button>
          <button
            onClick={() => setMapLayer('streets')}
            className={`px-3 py-2 text-xs rounded-lg transition-all duration-300 font-medium ${mapLayer === 'streets'
              ? 'bg-primary text-primary-foreground'
              : 'bg-card/90 hover:bg-card border border-border'
              }`}
          >
            Streets
          </button>
          <button
            onClick={() => setMapLayer('satellite')}
            className={`px-3 py-2 text-xs rounded-lg transition-all duration-300 font-medium ${mapLayer === 'satellite'
              ? 'bg-primary text-primary-foreground'
              : 'bg-card/90 hover:bg-card border border-border'
              }`}
          >
            Satellite
          </button>
          <button
            onClick={() => setMapLayer('terrain')}
            className={`px-3 py-2 text-xs rounded-lg transition-all duration-300 font-medium ${mapLayer === 'terrain'
              ? 'bg-primary text-primary-foreground'
              : 'bg-card/90 hover:bg-card border border-border'
              }`}
          >
            Terrain
          </button>
        </div>
      </div>

      {/* Desktop Heatmap Controls */}
      <div className="hidden md:block absolute top-4 right-4 glass-strong rounded-xl border border-white/30 p-4 z-[1000] min-w-[200px] backdrop-blur-xl shadow-elevated">
        <h3 className="text-xs font-semibold mb-3 text-foreground flex items-center gap-2">
          <Settings className="w-4 h-4 text-primary" />
          Heatmap Settings
        </h3>
        <div className="space-y-4">
          <div>
            <label className="text-xs text-foreground flex justify-between mb-3">
              <span className="font-medium">Radius</span>
              <span className="text-primary font-semibold">{heatmapRadius}px</span>
            </label>
            <Slider
              variant="contrast"
              min={30}
              max={120}
              step={1}
              value={[heatmapRadius]}
              onValueChange={(value) => setHeatmapRadius(value[0])}
              aria-label="Heatmap radius"
              className="cursor-pointer"
            />
          </div>
          <div>
            <label className="text-xs text-foreground flex justify-between mb-3">
              <span className="font-medium">Blur</span>
              <span className="text-primary font-semibold">{heatmapBlur}px</span>
            </label>
            <Slider
              variant="contrast"
              min={10}
              max={80}
              step={1}
              value={[heatmapBlur]}
              onValueChange={(value) => setHeatmapBlur(value[0])}
              aria-label="Heatmap blur intensity"
              className="cursor-pointer"
            />
          </div>
        </div>
      </div>

      {loading && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 glass-strong p-4 rounded-xl border border-white/30 z-[1000] min-w-[240px] backdrop-blur-xl shadow-xl">
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2 justify-center">
              <div className="animate-spin h-4 w-4 border-2 border-primary border-t-transparent rounded-full"></div>
              <span className="text-sm font-semibold">Loading data...</span>
            </div>
            {loadingProgress.total > 0 && (
              <>
                <div className="text-xs text-center text-muted-foreground">
                  Loaded {loadingProgress.current}/{loadingProgress.total} cities
                </div>
                <div className="w-full bg-muted/50 rounded-full h-2.5 overflow-hidden border border-border/30">
                  <div
                    className="bg-gradient-to-r from-primary to-primary/80 h-full transition-all duration-300 rounded-full"
                    style={{ width: `${(loadingProgress.current / loadingProgress.total) * 100}%` }}
                  ></div>
                </div>
              </>
            )}
          </div>
        </div>
      )}


      {/* === DESKTOP RISK LEGEND === */}
      {overlayMode === 'disaster' && (
        <div className="hidden md:block absolute bottom-6 left-6 glass-strong p-4 rounded-xl shadow-elevated border border-border/30 z-[1000] max-w-[250px] backdrop-blur-xl">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-foreground">Risk Level</h3>
            <Badge variant="outline" className="text-xs px-2">{activeFilters.size}/3</Badge>
          </div>

          <div className="space-y-1.5 mb-3">
            <div onClick={() => toggleFilter('high')} className={`flex items-start gap-3 p-2 rounded-lg cursor-pointer transition-all duration-300 border ${activeFilters.has('high') ? 'border-destructive/40 bg-destructive/10' : 'opacity-50 hover:opacity-80 hover:bg-muted/30 border-transparent'}`}>
              <div className="w-4 h-4 rounded-full border-2 mt-0.5 shrink-0" style={{ background: 'hsl(var(--destructive))', borderColor: 'hsl(var(--destructive))' }}></div>
              <div><span className="text-sm font-semibold text-foreground block">High ≥ 65%</span><span className="text-[10px] text-muted-foreground leading-tight">Coastal / cyclone zone, AQI &gt; 200, temp &gt; 40°C</span></div>
            </div>
            <div onClick={() => toggleFilter('medium')} className={`flex items-start gap-3 p-2 rounded-lg cursor-pointer transition-all duration-300 border ${activeFilters.has('medium') ? 'border-warning/40 bg-warning/10' : 'opacity-50 hover:opacity-80 hover:bg-muted/30 border-transparent'}`}>
              <div className="w-4 h-4 rounded-full border-2 mt-0.5 shrink-0" style={{ background: 'hsl(var(--warning))', borderColor: 'hsl(var(--warning))' }}></div>
              <div><span className="text-sm font-semibold text-foreground block">Medium 45–64%</span><span className="text-[10px] text-muted-foreground leading-tight">Flood / seismic zone, AQI 150–200, temp 35–40°C</span></div>
            </div>
            <div onClick={() => toggleFilter('low')} className={`flex items-start gap-3 p-2 rounded-lg cursor-pointer transition-all duration-300 border ${activeFilters.has('low') ? 'border-success/40 bg-success/10' : 'opacity-50 hover:opacity-80 hover:bg-muted/30 border-transparent'}`}>
              <div className="w-4 h-4 rounded-full border-2 mt-0.5 shrink-0" style={{ background: 'hsl(var(--success))', borderColor: 'hsl(var(--success))' }}></div>
              <div><span className="text-sm font-semibold text-foreground block">Low &lt; 45%</span><span className="text-[10px] text-muted-foreground leading-tight">Inland / stable region, AQI &lt; 150, normal temp</span></div>
            </div>
          </div>

          <div className="border-t border-border/30 pt-2">
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">Risk is calculated from</p>
            <div className="space-y-1">
              <div className="flex items-center gap-1.5"><span className="text-[10px]">🤖</span><span className="text-[10px] text-muted-foreground">TensorFlow.js Neural Network</span></div>
              <div className="flex items-center gap-1.5"><span className="text-[10px]">🌦️</span><span className="text-[10px] text-muted-foreground">10 Live Open-Meteo Features</span></div>
              <div className="flex items-center gap-1.5"><span className="text-[10px]">📊</span><span className="text-[10px] text-muted-foreground">Rainfall, Humidity, Pressure, Wind</span></div>
            </div>
          </div>
        </div>
      )}

      {/* === MOBILE RISK LEGEND (TEXT BUTTON in BOTTOM LEFT CORNER) === */}
      {overlayMode === 'disaster' && (
        <div className="md:hidden absolute bottom-4 md:bottom-6 left-4 z-[1000]">
          {!isLegendMobileOpen ? (
            <Button
              className="rounded-full shadow-2xl h-10 px-4 glass-strong bg-background/90 border border-white/30 backdrop-blur-xl flex items-center justify-center gap-2 animate-in fade-in zoom-in duration-300"
              onClick={() => setIsLegendMobileOpen(true)}
            >
              <AlertTriangle className="h-4 w-4 text-destructive" />
              <span className="text-xs font-bold text-foreground">Risk Level</span>
            </Button>
          ) : (
            <div className="glass-strong p-3 rounded-xl shadow-2xl border border-white/30 w-[240px] max-w-[calc(100vw-32px)] backdrop-blur-xl bg-background/90 z-[1000] animate-in fade-in slide-in-from-bottom-4 duration-300">
              <div className="flex items-center justify-between mb-3 border-b border-white/10 pb-2">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-destructive" />
                  <h3 className="text-sm font-bold text-foreground">Risk Level</h3>
                  <Badge variant="outline" className="text-[10px] px-1 h-5">{activeFilters.size}/3</Badge>
                </div>
                <Button variant="ghost" size="sm" onClick={() => setIsLegendMobileOpen(false)} className="h-6 w-6 p-0 rounded-full bg-black/10 hover:bg-black/20 dark:bg-white/10 dark:hover:bg-white/20">
                  <X className="h-4 w-4" />
                </Button>
              </div>

              <div className="space-y-2 mb-3">
                <div onClick={() => toggleFilter('high')} className={`flex items-start gap-2 p-1.5 rounded-lg cursor-pointer transition-all border ${activeFilters.has('high') ? 'shadow-sm border-destructive/40 bg-destructive/10' : 'opacity-50 border-transparent'}`}>
                  <div className="w-3 h-3 rounded-full border-2 mt-0.5 shrink-0" style={{ background: 'hsl(var(--destructive))', borderColor: 'hsl(var(--destructive))' }}></div>
                  <div><span className="text-xs font-semibold block">High ≥ 65%</span><span className="text-[9px] text-muted-foreground leading-tight block mt-0.5">Coastal/cyclone, AQI &gt; 200, temp &gt; 40°C</span></div>
                </div>
                <div onClick={() => toggleFilter('medium')} className={`flex items-start gap-2 p-1.5 rounded-lg cursor-pointer transition-all border ${activeFilters.has('medium') ? 'shadow-sm border-warning/40 bg-warning/10' : 'opacity-50 border-transparent'}`}>
                  <div className="w-3 h-3 rounded-full border-2 mt-0.5 shrink-0" style={{ background: 'hsl(var(--warning))', borderColor: 'hsl(var(--warning))' }}></div>
                  <div><span className="text-xs font-semibold block">Medium 45–64%</span><span className="text-[9px] text-muted-foreground leading-tight block mt-0.5">Flood/seismic, AQI 150–200, temp 35–40°C</span></div>
                </div>
                <div onClick={() => toggleFilter('low')} className={`flex items-start gap-2 p-1.5 rounded-lg cursor-pointer transition-all border ${activeFilters.has('low') ? 'shadow-sm border-success/40 bg-success/10' : 'opacity-50 border-transparent'}`}>
                  <div className="w-3 h-3 rounded-full border-2 mt-0.5 shrink-0" style={{ background: 'hsl(var(--success))', borderColor: 'hsl(var(--success))' }}></div>
                  <div><span className="text-xs font-semibold block">Low &lt; 45%</span><span className="text-[9px] text-muted-foreground leading-tight block mt-0.5">Inland/stable, AQI &lt; 150, normal temp</span></div>
                </div>
              </div>

              <div className="border-t border-white/10 pt-2 space-y-1">
                <p className="text-[10px] text-muted-foreground">🤖 TensorFlow.js Analysis</p>
                <p className="text-[10px] text-muted-foreground">🌦️ Live Feature Feeds</p>
              </div>
            </div>
          )}
        </div>
      )}


      {/* Weather/Pollution Legend - Mobile adjusted */}
      {overlayMode !== 'disaster' && (
        <div className="absolute bottom-20 md:bottom-20 left-4 glass-strong p-2 md:p-3 rounded-xl shadow-elevated border border-white/30 z-[1000] max-w-[160px] md:max-w-[200px] backdrop-blur-xl">
          <h3 className="text-[10px] md:text-xs font-semibold mb-1.5 md:mb-2">
            {overlayMode === 'temperature' ? 'Temperature' : 'Air Quality'}
          </h3>
          <div className="space-y-1">
            {overlayMode === 'temperature' ? (
              <>
                <div className="flex items-center gap-1.5 md:gap-2 p-0.5 md:p-1">
                  <div className="w-2.5 h-2.5 md:w-3 md:h-3 rounded-full opacity-70 border-2 shadow-sm" style={{ background: 'rgb(168, 85, 247)', borderColor: 'rgb(168, 85, 247)' }}></div>
                  <span className="text-[10px] md:text-xs">Cold</span>
                </div>
                <div className="flex items-center gap-1.5 md:gap-2 p-0.5 md:p-1">
                  <div className="w-2.5 h-2.5 md:w-3 md:h-3 rounded-full opacity-70 border-2 shadow-sm" style={{ background: 'rgb(251, 146, 60)', borderColor: 'rgb(251, 146, 60)' }}></div>
                  <span className="text-[10px] md:text-xs">Mild</span>
                </div>
                <div className="flex items-center gap-1.5 md:gap-2 p-0.5 md:p-1">
                  <div className="w-2.5 h-2.5 md:w-3 md:h-3 rounded-full opacity-70 border-2 shadow-sm" style={{ background: 'rgb(249, 115, 22)', borderColor: 'rgb(249, 115, 22)' }}></div>
                  <span className="text-[10px] md:text-xs">Warm</span>
                </div>
                <div className="flex items-center gap-1.5 md:gap-2 p-0.5 md:p-1">
                  <div className="w-2.5 h-2.5 md:w-3 md:h-3 rounded-full opacity-70 border-2 shadow-sm" style={{ background: 'rgb(239, 68, 68)', borderColor: 'rgb(239, 68, 68)' }}></div>
                  <span className="text-[10px] md:text-xs">Hot</span>
                </div>
              </>
            ) : (
              <>
                <div className="flex items-center gap-1.5 md:gap-2 p-0.5 md:p-1">
                  <div className="w-2.5 h-2.5 md:w-3 md:h-3 rounded-full opacity-70 border-2 shadow-sm" style={{ background: 'rgb(34, 197, 94)', borderColor: 'rgb(34, 197, 94)' }}></div>
                  <span className="text-[10px] md:text-xs">Good</span>
                </div>
                <div className="flex items-center gap-1.5 md:gap-2 p-0.5 md:p-1">
                  <div className="w-2.5 h-2.5 md:w-3 md:h-3 rounded-full opacity-70 border-2 shadow-sm" style={{ background: 'rgb(234, 179, 8)', borderColor: 'rgb(234, 179, 8)' }}></div>
                  <span className="text-[10px] md:text-xs">Moderate</span>
                </div>
                <div className="flex items-center gap-1.5 md:gap-2 p-0.5 md:p-1">
                  <div className="w-2.5 h-2.5 md:w-3 md:h-3 rounded-full opacity-70 border-2 shadow-sm" style={{ background: 'rgb(251, 146, 60)', borderColor: 'rgb(251, 146, 60)' }}></div>
                  <span className="text-[10px] md:text-xs">Unhealthy</span>
                </div>
                <div className="flex items-center gap-1.5 md:gap-2 p-0.5 md:p-1">
                  <div className="w-2.5 h-2.5 md:w-3 md:h-3 rounded-full opacity-70 border-2 shadow-sm" style={{ background: 'rgb(239, 68, 68)', borderColor: 'rgb(239, 68, 68)' }}></div>
                  <span className="text-[10px] md:text-xs">Hazardous</span>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Emergency SOS - Mobile adjusted */}
      <div className="absolute bottom-4 right-3 md:bottom-6 md:right-6 z-[2000] pointer-events-none">
        <div className="glass-strong rounded-2xl p-1.5 md:p-3 border border-border/30 shadow-lg backdrop-blur-xl pointer-events-auto">
          <EmergencySOS
            userLocation={userLocation}
            nearbyDisasters={nearbyDisasters}
            compact
          />
        </div>
      </div>
    </div>
  );
};

export default HeatmapOverview;
