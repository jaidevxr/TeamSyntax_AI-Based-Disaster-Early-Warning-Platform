import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { DisasterEvent, EmergencyFacility, Location } from '@/types';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

// Fix for default markers
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

interface SimpleMapProps {
  disasters: DisasterEvent[];
  facilities: EmergencyFacility[];
  userLocation: Location | null;
  center: Location;
  onDisasterClick: (disaster: DisasterEvent) => void;
  onFacilityClick: (facility: EmergencyFacility) => void;
}

const SimpleMap: React.FC<SimpleMapProps> = ({
  disasters,
  facilities,
  userLocation,
  center,
  onDisasterClick,
  onFacilityClick,
}) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const leafletMap = useRef<L.Map | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const [isDarkMode, setIsDarkMode] = useState(() => document.documentElement.classList.contains('dark'));

  useEffect(() => {
    if (!mapRef.current) return;

    // Initialize map
    leafletMap.current = L.map(mapRef.current).setView([center.lat, center.lng], 6);

    // Add tile layer with dark mode support
    const getTileUrl = () => {
      if (isDarkMode) {
        return 'https://cartodb-basemaps-{s}.global.ssl.fastly.net/dark_all/{z}/{x}/{y}.png';
      }
      return 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
    };

    const tileLayer = L.tileLayer(getTileUrl(), {
      attribution: isDarkMode ? '© CartoDB © OpenStreetMap' : '© OpenStreetMap contributors'
    }).addTo(leafletMap.current);
    tileLayerRef.current = tileLayer;

    return () => {
      if (leafletMap.current) {
        leafletMap.current.remove();
        leafletMap.current = null;
      }
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

  // Update map tiles when theme changes
  useEffect(() => {
    if (!leafletMap.current || !tileLayerRef.current) return;

    leafletMap.current.removeLayer(tileLayerRef.current);

    const getTileUrl = () => {
      if (isDarkMode) {
        return 'https://cartodb-basemaps-{s}.global.ssl.fastly.net/dark_all/{z}/{x}/{y}.png';
      }
      return 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
    };

    const newTileLayer = L.tileLayer(getTileUrl(), {
      attribution: isDarkMode ? '© CartoDB © OpenStreetMap' : '© OpenStreetMap contributors'
    }).addTo(leafletMap.current);

    tileLayerRef.current = newTileLayer;
  }, [isDarkMode]);

  // Update map center when prop changes
  useEffect(() => {
    if (leafletMap.current) {
      leafletMap.current.setView([center.lat, center.lng], leafletMap.current.getZoom());
    }
  }, [center]);

  // Update markers when data changes
  useEffect(() => {
    if (!leafletMap.current) return;

    // Clear existing markers
    leafletMap.current.eachLayer((layer) => {
      if (layer instanceof L.Marker) {
        leafletMap.current?.removeLayer(layer);
      }
    });

    // Add user location marker
    if (userLocation) {
      const userIcon = L.divIcon({
        html: '<div class="w-4 h-4 bg-blue-500 rounded-full animate-pulse shadow-lg"></div>',
        className: 'user-location-marker',
        iconSize: [16, 16],
        iconAnchor: [8, 8],
      });

      L.marker([userLocation.lat, userLocation.lng], { icon: userIcon })
        .bindPopup(`
          <div class="p-2">
            <h3 class="font-semibold text-sm">Your Location</h3>
            <p class="text-xs text-gray-600">${userLocation.lat.toFixed(4)}, ${userLocation.lng.toFixed(4)}</p>
          </div>
        `)
        .addTo(leafletMap.current);
    }

    // Add disaster markers
    disasters.forEach((disaster) => {
      const iconConfig = {
        earthquake: { emoji: '⚡', color: '#f59e0b' },
        flood: { emoji: '🌊', color: '#3b82f6' },
        cyclone: { emoji: '🌀', color: '#8b5cf6' },
        fire: { emoji: '🔥', color: '#ef4444' },
        landslide: { emoji: '⛰️', color: '#84cc16' },
      };

      const config = iconConfig[disaster.type];
      const severityColor = disaster.severity === 'high' ? '#dc2626' : 
                           disaster.severity === 'medium' ? '#f59e0b' : '#16a34a';

      const disasterIcon = L.divIcon({
        html: `
          <div class="relative">
            <div class="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold shadow-lg animate-pulse" 
                 style="background-color: ${severityColor}; border: 2px solid white;">
              ${config.emoji}
            </div>
          </div>
        `,
        className: 'disaster-marker',
        iconSize: [32, 32],
        iconAnchor: [16, 16],
      });

      L.marker([disaster.location.lat, disaster.location.lng], { icon: disasterIcon })
        .bindPopup(`
          <div class="w-64 p-3 space-y-3">
            <div class="flex items-start justify-between">
              <h3 class="font-semibold text-sm">${disaster.title}</h3>
              <span class="text-xs px-2 py-1 rounded-full ${
                disaster.severity === 'high' ? 'bg-red-100 text-red-800' :
                disaster.severity === 'medium' ? 'bg-yellow-100 text-yellow-800' : 'bg-green-100 text-green-800'
              }">${disaster.severity}</span>
            </div>
            <p class="text-sm text-gray-600">${disaster.description}</p>
            ${disaster.magnitude ? `<div class="text-xs"><span class="font-medium">Magnitude:</span> ${disaster.magnitude}</div>` : ''}
            <div class="text-xs text-gray-500">${new Date(disaster.time).toLocaleString('en-IN')}</div>
            ${disaster.url ? `<a href="${disaster.url}" target="_blank" class="text-blue-600 text-xs hover:underline">More Details →</a>` : ''}
          </div>
        `)
        .on('click', () => onDisasterClick(disaster))
        .addTo(leafletMap.current);
    });

    // Add facility markers
    facilities.forEach((facility) => {
      const iconConfig = {
        hospital: { emoji: '🏥', color: '#16a34a' },
        police: { emoji: '👮', color: '#3b82f6' },
        fire_station: { emoji: '🚒', color: '#dc2626' },
        shelter: { emoji: '🏠', color: '#8b5cf6' },
      };

      const config = iconConfig[facility.type];

      const facilityIcon = L.divIcon({
        html: `
          <div class="w-6 h-6 rounded-full flex items-center justify-center text-white text-xs shadow-md" 
               style="background-color: ${config.color}; border: 1px solid white;">
            ${config.emoji}
          </div>
        `,
        className: 'facility-marker',
        iconSize: [24, 24],
        iconAnchor: [12, 12],
      });

      L.marker([facility.location.lat, facility.location.lng], { icon: facilityIcon })
        .bindPopup(`
          <div class="w-56 p-3 space-y-2">
            <div class="flex items-start justify-between">
              <h3 class="font-semibold text-sm">${facility.name}</h3>
              <span class="text-xs px-2 py-1 rounded bg-gray-100 text-gray-600">${facility.type.replace('_', ' ')}</span>
            </div>
            ${facility.distance ? `<div class="text-xs flex items-center gap-1"><span>📍</span> ${facility.distance}km away</div>` : ''}
            ${facility.contact ? `<div class="text-xs"><span class="font-medium">Contact:</span> ${facility.contact}</div>` : ''}
            ${facility.capacity ? `<div class="text-xs"><span class="font-medium">Capacity:</span> ${facility.capacity}</div>` : ''}
          </div>
        `)
        .on('click', () => onFacilityClick(facility))
        .addTo(leafletMap.current);
    });
  }, [disasters, facilities, userLocation, onDisasterClick, onFacilityClick]);

  return (
    <div className="h-full w-full relative">
      <div ref={mapRef} className="h-full w-full rounded-2xl" />
      
      {/* Map legend */}
      <Card className="absolute bottom-4 right-4 glass border-border/20 z-[1000]">
        <div className="p-3 space-y-2">
          <h4 className="text-xs font-semibold">Legend</h4>
          <div className="space-y-1 text-xs">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-destructive rounded-full"></div>
              <span>High Severity</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-warning rounded-full"></div>
              <span>Medium Severity</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-success rounded-full"></div>
              <span>Low Severity / Facilities</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-ocean-blue rounded-full animate-pulse"></div>
              <span>Your Location</span>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
};

export default SimpleMap;