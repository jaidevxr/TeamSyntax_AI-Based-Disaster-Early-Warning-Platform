import React, { useState, useRef, useEffect } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  MapPin,
  Building2,
  Loader2,
  Navigation,
  School,
  Tent,
  Church,
  LandPlot,
  Hotel,
  RefreshCw,
} from 'lucide-react';
import { Location } from '@/types';

interface Shelter {
  id: number;
  name: string;
  type: string;
  lat: number;
  lng: number;
  distance: number;
}

interface ShelterFinderProps {
  userLocation: Location | null;
  language: 'en' | 'hi';
}

const SHELTER_TYPES = [
  { key: 'school', label: '🏫 Schools', query: '"amenity"="school"', icon: School },
  { key: 'hospital', label: '🏥 Hospitals', query: '"amenity"="hospital"', icon: Building2 },
  { key: 'place_of_worship', label: '🛕 Temples/Mosques', query: '"amenity"="place_of_worship"', icon: Church },
  { key: 'community', label: '🏛️ Community Halls', query: '"amenity"="community_centre"', icon: LandPlot },
  { key: 'stadium', label: '🏟️ Stadiums', query: '"leisure"="stadium"', icon: Tent },
  { key: 'hotel', label: '🏨 Hotels', query: '"tourism"="hotel"', icon: Hotel },
];

const haversine = (lat1: number, lng1: number, lat2: number, lng2: number): number => {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

const ShelterFinder: React.FC<ShelterFinderProps> = ({ userLocation, language }) => {
  const [shelters, setShelters] = useState<Shelter[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedType, setSelectedType] = useState('school');
  const [searched, setSearched] = useState(false);
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersRef = useRef<L.Marker[]>([]);

  const t = language === 'hi' ? {
    title: 'आश्रय खोजक',
    subtitle: 'OpenStreetMap Overpass API · रियल जियो-डेटा',
    search: 'नजदीकी आश्रय खोजें',
    searching: 'खोज रहा है...',
    noResults: 'इस प्रकार के लिए कोई परिणाम नहीं',
    found: 'स्थान मिले',
    navigate: 'नेविगेट करें',
    km: 'किमी',
    noLocation: 'GPS स्थान आवश्यक है',
  } : {
    title: 'Smart Shelter Finder',
    subtitle: 'OpenStreetMap Overpass API · Real Geo-Data',
    search: 'Find Nearby Shelters',
    searching: 'Scanning area...',
    noResults: 'No results for this type nearby',
    found: 'locations found',
    navigate: 'Navigate',
    km: 'km',
    noLocation: 'GPS location required',
  };

  // Initialize map
  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;
    const center: [number, number] = userLocation ? [userLocation.lat, userLocation.lng] : [28.6, 77.2];
    const map = L.map(mapRef.current, { zoomControl: false }).setView(center, 13);

    const isDark = document.documentElement.classList.contains('dark');
    L.tileLayer(isDark
      ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
      : 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    { maxZoom: 18, attribution: '© OSM' }).addTo(map);

    if (userLocation) {
      L.circleMarker([userLocation.lat, userLocation.lng], {
        radius: 8, fillColor: '#3b82f6', fillOpacity: 0.9, color: 'white', weight: 2,
      }).addTo(map).bindPopup('📍 You are here');
    }

    mapInstanceRef.current = map;
    return () => { map.remove(); mapInstanceRef.current = null; };
  }, []);

  const searchShelters = async () => {
    if (!userLocation) return;
    setLoading(true);
    setError(null);
    setShelters([]);
    setSearched(true);

    // Clear old markers
    markersRef.current.forEach(m => m.remove());
    markersRef.current = [];

    const typeConfig = SHELTER_TYPES.find(s => s.key === selectedType)!;
    const radius = 5000; // 5km
    const query = `[out:json][timeout:10];
      (node[${typeConfig.query}](around:${radius},${userLocation.lat},${userLocation.lng});
       way[${typeConfig.query}](around:${radius},${userLocation.lat},${userLocation.lng}););
      out center 30;`;

    try {
      const response = await fetch('https://overpass-api.de/api/interpreter', {
        method: 'POST',
        body: `data=${encodeURIComponent(query)}`,
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      });

      if (!response.ok) throw new Error('Overpass API error');
      const data = await response.json();

      const results: Shelter[] = data.elements
        .filter((el: any) => {
          const lat = el.lat || el.center?.lat;
          const lng = el.lon || el.center?.lon;
          return lat && lng;
        })
        .map((el: any) => {
          const lat = el.lat || el.center?.lat;
          const lng = el.lon || el.center?.lon;
          return {
            id: el.id,
            name: el.tags?.name || `${typeConfig.label.split(' ')[1]} (Unnamed)`,
            type: selectedType,
            lat,
            lng,
            distance: haversine(userLocation.lat, userLocation.lng, lat, lng),
          };
        })
        .sort((a: Shelter, b: Shelter) => a.distance - b.distance)
        .slice(0, 20);

      setShelters(results);

      // Add markers to map
      const map = mapInstanceRef.current;
      if (map) {
        results.forEach(s => {
          const marker = L.marker([s.lat, s.lng], {
            icon: L.divIcon({
              className: 'shelter-marker',
              html: `<div style="background: #16a34a; color: white; border-radius: 50%; width: 28px; height: 28px; display: flex; align-items: center; justify-content: center; font-size: 14px; border: 2px solid white; box-shadow: 0 2px 6px rgba(0,0,0,0.3);">🏠</div>`,
              iconSize: [28, 28],
              iconAnchor: [14, 14],
            }),
          }).addTo(map).bindPopup(`<b>${s.name}</b><br>${s.distance.toFixed(2)} km away`);
          markersRef.current.push(marker);
        });

        if (results.length > 0) {
          const group = L.featureGroup(markersRef.current);
          map.fitBounds(group.getBounds().pad(0.2));
        }
      }
    } catch (err: any) {
      setError(err.message || 'Search failed');
    } finally {
      setLoading(false);
    }
  };

  const navigateToShelter = (shelter: Shelter) => {
    window.open(`https://www.google.com/maps/dir/?api=1&origin=${userLocation?.lat},${userLocation?.lng}&destination=${shelter.lat},${shelter.lng}&travelmode=walking`, '_blank');
  };

  const typeConfig = SHELTER_TYPES.find(s => s.key === selectedType)!;

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-emerald-600 to-teal-700 flex items-center justify-center shadow-lg shadow-emerald-500/30">
          <Tent className="h-5 w-5 text-white" />
        </div>
        <div>
          <h2 className="text-lg font-extrabold tracking-tight text-foreground">{t.title}</h2>
          <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-widest">{t.subtitle}</p>
        </div>
      </div>

      {/* Type Chips */}
      <div className="flex flex-wrap gap-1.5">
        {SHELTER_TYPES.map(st => (
          <button
            key={st.key}
            onClick={() => setSelectedType(st.key)}
            className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition-all border ${
              selectedType === st.key
                ? 'bg-emerald-600 text-white border-emerald-600 shadow-md scale-105'
                : 'bg-background/60 text-muted-foreground border-border/50 hover:border-emerald-400/50'
            }`}
          >
            {st.label}
          </button>
        ))}
      </div>

      {/* Search Button */}
      <Button onClick={searchShelters} disabled={loading || !userLocation} className="w-full gap-2 font-bold h-11 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white shadow-lg shadow-emerald-500/30">
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <MapPin className="h-4 w-4" />}
        {loading ? t.searching : t.search}
      </Button>

      {/* Map */}
      <div ref={mapRef} className="h-[250px] rounded-xl overflow-hidden border shadow-sm" />

      {/* Results */}
      {searched && !loading && (
        <div>
          {shelters.length > 0 ? (
            <>
              <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest mb-2">
                {shelters.length} {t.found}
              </p>
              <div className="space-y-1.5 max-h-[300px] overflow-y-auto">
                {shelters.map(s => (
                  <Card key={s.id} className="p-2.5 flex items-center gap-3 hover:shadow-md transition-all">
                    <div className="h-9 w-9 rounded-xl bg-emerald-100 dark:bg-emerald-500/10 flex items-center justify-center flex-shrink-0">
                      <typeConfig.icon className="h-4 w-4 text-emerald-700 dark:text-emerald-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-foreground truncate">{s.name}</p>
                      <p className="text-[10px] text-muted-foreground">{s.distance.toFixed(2)} {t.km} away</p>
                    </div>
                    <Button size="sm" variant="outline" className="gap-1 text-[10px] font-bold shrink-0 h-7" onClick={() => navigateToShelter(s)}>
                      <Navigation className="h-3 w-3" /> {t.navigate}
                    </Button>
                  </Card>
                ))}
              </div>
            </>
          ) : (
            <Card className="p-6 text-center border-dashed">
              <p className="text-sm text-muted-foreground font-medium">{t.noResults}</p>
            </Card>
          )}
        </div>
      )}

      {error && (
        <Card className="p-3 bg-red-50/50 dark:bg-red-950/20 border-red-200/50 flex items-center gap-2">
          <p className="text-xs text-red-600 dark:text-red-400 font-medium">{error}</p>
          <Button size="sm" variant="ghost" onClick={searchShelters} className="ml-auto"><RefreshCw className="h-3 w-3" /></Button>
        </Card>
      )}
    </div>
  );
};

export default ShelterFinder;
