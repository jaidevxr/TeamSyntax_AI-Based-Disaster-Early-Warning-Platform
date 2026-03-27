import React, { useState, useRef, useEffect } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Satellite,
  Loader2,
  Flame,
  CloudLightning,
  Mountain,
  Waves,
  Wind,
  RefreshCw,
  Globe,
  Eye,
} from 'lucide-react';

interface EONETEvent {
  id: string;
  title: string;
  category: string;
  categoryIcon: string;
  coordinates: [number, number];
  date: string;
  source: string;
  link: string;
}

interface NASASatelliteProps {
  language: 'en' | 'hi';
}

const CATEGORY_CONFIG: Record<string, { icon: string; color: string; markerColor: string }> = {
  'Wildfires': { icon: '🔥', color: 'bg-red-500', markerColor: '#ef4444' },
  'Severe Storms': { icon: '⛈️', color: 'bg-violet-600', markerColor: '#7c3aed' },
  'Volcanoes': { icon: '🌋', color: 'bg-orange-700', markerColor: '#c2410c' },
  'Floods': { icon: '🌊', color: 'bg-blue-500', markerColor: '#3b82f6' },
  'Earthquakes': { icon: '🏔️', color: 'bg-amber-700', markerColor: '#b45309' },
  'Sea and Lake Ice': { icon: '🧊', color: 'bg-cyan-500', markerColor: '#06b6d4' },
  'Landslides': { icon: '⛰️', color: 'bg-yellow-700', markerColor: '#a16207' },
  'Snow': { icon: '❄️', color: 'bg-sky-400', markerColor: '#38bdf8' },
  'Dust and Haze': { icon: '🌫️', color: 'bg-stone-500', markerColor: '#78716c' },
  'Temperature Extremes': { icon: '🌡️', color: 'bg-rose-600', markerColor: '#e11d48' },
  'default': { icon: '🌍', color: 'bg-slate-500', markerColor: '#64748b' },
};

const NASASatellite: React.FC<NASASatelliteProps> = ({ language }) => {
  const [events, setEvents] = useState<EONETEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<string | null>(null);
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersRef = useRef<L.CircleMarker[]>([]);

  const t = language === 'hi' ? {
    title: 'NASA उपग्रह ओवरले',
    subtitle: 'NASA EONET · पृथ्वी वेधशाला',
    load: 'लाइव इवेंट लोड करें',
    loading: 'NASA से डेटा ला रहा है...',
    events: 'सक्रिय प्राकृतिक घटनाएं',
    all: 'सभी',
    source: 'स्रोत',
  } : {
    title: 'NASA Satellite Overlay',
    subtitle: 'NASA EONET · Earth Observatory',
    load: 'Load Live Events',
    loading: 'Fetching from NASA...',
    events: 'Active Natural Events',
    all: 'All',
    source: 'Source',
  };

  // Initialize map
  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;
    const map = L.map(mapRef.current, { zoomControl: false }).setView([20, 78], 3);

    const isDark = document.documentElement.classList.contains('dark');
    L.tileLayer(isDark
      ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
      : 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    { maxZoom: 18, attribution: '© NASA EONET · Esri' }).addTo(map);

    mapInstanceRef.current = map;
    return () => { map.remove(); mapInstanceRef.current = null; };
  }, []);

  const fetchEONET = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('https://eonet.gsfc.nasa.gov/api/v3/events?status=open&limit=50');
      if (!response.ok) throw new Error('NASA EONET API error');
      const data = await response.json();

      const parsed: EONETEvent[] = data.events
        .filter((ev: any) => ev.geometry?.length > 0 && ev.geometry[0]?.coordinates)
        .map((ev: any) => {
          const geo = ev.geometry[ev.geometry.length - 1]; // latest geometry
          const coords = geo.coordinates;
          return {
            id: ev.id,
            title: ev.title,
            category: ev.categories?.[0]?.title || 'Unknown',
            categoryIcon: CATEGORY_CONFIG[ev.categories?.[0]?.title]?.icon || '🌍',
            coordinates: [coords[1], coords[0]] as [number, number], // EONET returns [lng, lat]
            date: new Date(geo.date).toLocaleDateString(),
            source: ev.sources?.[0]?.id || 'NASA',
            link: ev.sources?.[0]?.url || '',
          };
        });

      setEvents(parsed);
      renderMarkers(parsed);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch NASA data');
    } finally {
      setLoading(false);
    }
  };

  const renderMarkers = (evts: EONETEvent[], filterCat: string | null = null) => {
    const map = mapInstanceRef.current;
    if (!map) return;

    // Clear old markers
    markersRef.current.forEach(m => m.remove());
    markersRef.current = [];

    const filtered = filterCat ? evts.filter(e => e.category === filterCat) : evts;

    filtered.forEach(ev => {
      const config = CATEGORY_CONFIG[ev.category] || CATEGORY_CONFIG['default'];
      const marker = L.circleMarker(ev.coordinates, {
        radius: 8,
        fillColor: config.markerColor,
        fillOpacity: 0.85,
        color: 'white',
        weight: 2,
      }).addTo(map).bindPopup(
        `<div style="min-width:150px">
          <b>${ev.categoryIcon} ${ev.title}</b><br>
          <small>📅 ${ev.date}</small><br>
          <small>📡 ${ev.source}</small>
          ${ev.link ? `<br><a href="${ev.link}" target="_blank" style="color:#3b82f6;font-size:11px">View Source →</a>` : ''}
        </div>`
      );
      markersRef.current.push(marker);
    });

    if (filtered.length > 0) {
      const group = L.featureGroup(markersRef.current);
      map.fitBounds(group.getBounds().pad(0.1));
    }
  };

  const handleFilter = (category: string | null) => {
    setFilter(category);
    renderMarkers(events, category);
  };

  // Get unique categories
  const categories = [...new Set(events.map(e => e.category))];

  const filteredEvents = filter ? events.filter(e => e.category === filter) : events;

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-sky-600 to-indigo-800 flex items-center justify-center shadow-lg shadow-sky-500/30">
          <Satellite className="h-5 w-5 text-white" />
        </div>
        <div>
          <h2 className="text-lg font-extrabold tracking-tight text-foreground">{t.title}</h2>
          <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-widest">{t.subtitle}</p>
        </div>
        <Button onClick={fetchEONET} disabled={loading} size="sm" className="ml-auto gap-1.5 font-bold bg-gradient-to-r from-sky-600 to-indigo-700 text-white">
          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Globe className="h-3.5 w-3.5" />}
          {loading ? t.loading : t.load}
        </Button>
      </div>

      {/* Map */}
      <div ref={mapRef} className="h-[350px] rounded-xl overflow-hidden border shadow-lg" />

      {/* Category Filters */}
      {categories.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          <button
            onClick={() => handleFilter(null)}
            className={`px-2 py-1 rounded-lg text-[10px] font-bold border transition-all ${
              !filter ? 'bg-sky-600 text-white border-sky-600' : 'bg-background/60 text-muted-foreground border-border/50'
            }`}
          >
            {t.all} ({events.length})
          </button>
          {categories.map(cat => {
            const config = CATEGORY_CONFIG[cat] || CATEGORY_CONFIG['default'];
            const count = events.filter(e => e.category === cat).length;
            return (
              <button
                key={cat}
                onClick={() => handleFilter(cat)}
                className={`px-2 py-1 rounded-lg text-[10px] font-bold border transition-all ${
                  filter === cat ? 'bg-sky-600 text-white border-sky-600' : 'bg-background/60 text-muted-foreground border-border/50'
                }`}
              >
                {config.icon} {cat} ({count})
              </button>
            );
          })}
        </div>
      )}

      {/* Events List */}
      {filteredEvents.length > 0 && (
        <div>
          <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest mb-2">
            {t.events} ({filteredEvents.length})
          </p>
          <div className="space-y-1.5 max-h-[250px] overflow-y-auto">
            {filteredEvents.map(ev => {
              const config = CATEGORY_CONFIG[ev.category] || CATEGORY_CONFIG['default'];
              return (
                <Card key={ev.id} className="p-2.5 flex items-center gap-3 hover:shadow-md transition-all cursor-pointer" onClick={() => {
                  mapInstanceRef.current?.setView(ev.coordinates, 6);
                }}>
                  <div className={`h-8 w-8 rounded-lg ${config.color} flex items-center justify-center text-sm flex-shrink-0 shadow-sm`}>
                    {config.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] font-bold text-foreground truncate">{ev.title}</p>
                    <div className="flex items-center gap-2 text-[9px] text-muted-foreground">
                      <span>📅 {ev.date}</span>
                      <span>· 📡 {ev.source}</span>
                    </div>
                  </div>
                  <Badge variant="outline" className="text-[8px] font-bold px-1.5 py-0 shrink-0">{ev.category}</Badge>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {error && (
        <Card className="p-3 bg-red-50/50 dark:bg-red-950/20 border-red-200/50 flex items-center gap-2">
          <p className="text-xs text-red-600 dark:text-red-400 font-medium">{error}</p>
          <Button size="sm" variant="ghost" onClick={fetchEONET} className="ml-auto"><RefreshCw className="h-3 w-3" /></Button>
        </Card>
      )}
    </div>
  );
};

export default NASASatellite;
