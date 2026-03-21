import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { EmergencyService, Location } from '@/types';
import { escapeHtml } from '@/utils/sanitize';

import { createOfflineTileLayer } from '@/utils/offlineTileLayer';
import { searchLocation, fetchEmergencyFacilities } from '@/utils/api';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, Hospital, Shield, Flame, Navigation, X, MapPin } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface EmergencyServicesMapProps {
  onFacilityClick?: (facility: EmergencyService) => void;
  userLocation?: Location | null;
}

const EmergencyServicesMap: React.FC<EmergencyServicesMapProps> = ({ onFacilityClick, userLocation: dashboardLocation }) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersRef = useRef<L.Marker[]>([]);
  const routingControlRef = useRef<L.Polyline | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const [services, setServices] = useState<EmergencyService[]>([]);
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedTypes, setSelectedTypes] = useState<string[]>(["hospital", "police", "fire_station"]);
  const [selectedService, setSelectedService] = useState<EmergencyService | null>(null);
  const [showingRoute, setShowingRoute] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<Location[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const searchContainerRef = useRef<HTMLDivElement>(null);
  const [isDarkMode, setIsDarkMode] = useState(() => document.documentElement.classList.contains('dark'));
  const { toast } = useToast();

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Auto-resize leaflet map on window resize for mobile
  useEffect(() => {
    const handleResize = () => {
      if (mapInstanceRef.current) {
        setTimeout(() => mapInstanceRef.current?.invalidateSize(), 50);
      }
    };
    window.addEventListener('resize', handleResize);
    handleResize();
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Debounced search for city suggestions
  useEffect(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    if (!searchQuery.trim()) {
      setSearchResults([]);
      setShowDropdown(false);
      return;
    }

    debounceTimerRef.current = setTimeout(async () => {
      setIsSearching(true);
      try {
        const results = await searchLocation(searchQuery);
        setSearchResults(results.slice(0, 5));
        setShowDropdown(results.length > 0);
      } catch (error) {
        console.error('Search error:', error);
        setSearchResults([]);
        setShowDropdown(false);
      }
      setIsSearching(false);
    }, 300);

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [searchQuery]);

  const handleSelectLocation = (location: Location) => {
    setUserLocation([location.lat, location.lng]);
    fetchNearbyServices(location.lat, location.lng);
    setSearchQuery('');
    setSearchResults([]);
    setShowDropdown(false);
  };

  const getUserLocation = () => {
    setLoading(true);

    if (!navigator.geolocation) {
      console.error("Geolocation is not supported by this browser");
      toast({
        title: "Location Not Supported",
        description: "Your browser doesn't support geolocation. Using default location.",
        variant: "destructive",
      });
      const defaultLoc: [number, number] = [28.6139, 77.2090];
      setUserLocation(defaultLoc);
      fetchNearbyServices(defaultLoc[0], defaultLoc[1]);
      return;
    }

    // Request with high accuracy and proper timeout
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        const location: [number, number] = [latitude, longitude];
        setUserLocation(location);

        toast({
          title: "Location Detected",
          description: `Lat: ${latitude.toFixed(6)}, Lng: ${longitude.toFixed(6)}, Accuracy: ${position.coords.accuracy.toFixed(0)}m`,
          duration: 10000,
        });

        fetchNearbyServices(latitude, longitude);
      },
      (error) => {
        console.error("❌ Geolocation error:", error.code, error.message);

        let errorMessage = "Unable to get your location. ";
        let actionMessage = "";

        switch (error.code) {
          case 1: // PERMISSION_DENIED
            errorMessage = "Location permission denied. ";
            actionMessage = "Please click the location icon in your browser's address bar and allow location access, then try again.";
            break;
          case 2: // POSITION_UNAVAILABLE
            errorMessage = "Location information unavailable. ";
            actionMessage = "Please check your device's location settings.";
            break;
          case 3: // TIMEOUT
            errorMessage = "Location request timed out. ";
            actionMessage = "Please try again.";
            break;
          default:
            errorMessage = "Unknown error occurred.";
        }

        toast({
          title: "Location Error",
          description: errorMessage + actionMessage + " Using Delhi as default.",
          variant: "destructive",
          duration: 8000,
        });

        // Default to Delhi
        const defaultLoc: [number, number] = [28.6139, 77.2090];
        setUserLocation(defaultLoc);
        fetchNearbyServices(defaultLoc[0], defaultLoc[1]);
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 0
      }
    );
  };

  // Decode a Google-encoded polyline string into an array of [lat, lng] pairs.
  const decodePolyline = (encoded: string): [number, number][] => {
    const coords: [number, number][] = [];
    let index = 0, lat = 0, lng = 0;
    while (index < encoded.length) {
      let b: number, shift = 0, result = 0;
      do { b = encoded.charCodeAt(index++) - 63; result |= (b & 0x1f) << shift; shift += 5; } while (b >= 0x20);
      lat += (result & 1) ? ~(result >> 1) : result >> 1;
      shift = 0; result = 0;
      do { b = encoded.charCodeAt(index++) - 63; result |= (b & 0x1f) << shift; shift += 5; } while (b >= 0x20);
      lng += (result & 1) ? ~(result >> 1) : result >> 1;
      coords.push([lat / 1e5, lng / 1e5]);
    }
    return coords;
  };

  const showRoute = async (service: EmergencyService) => {
    if (!mapInstanceRef.current || !userLocation) {
      toast({
        title: "Cannot Show Route",
        description: "User location not available",
        variant: "destructive",
      });
      return;
    }

    // Remove any existing route polyline
    if (routingControlRef.current) {
      routingControlRef.current.remove();
      routingControlRef.current = null;
    }

    // Forcefully close any open Leaflet popups so they don't slide under the search bar during the automatic camera pan
    mapInstanceRef.current.closePopup();

    setSelectedService(service);
    setShowingRoute(true);

    try {
      // Use OSRM's public API directly (no LRM wrapper = no demo-server warning)
      const url =
        `https://router.project-osrm.org/route/v1/driving/` +
        `${userLocation[1]},${userLocation[0]};${service.lng},${service.lat}` +
        `?overview=full&geometries=polyline`;

      const res = await fetch(url);
      if (!res.ok) throw new Error(`OSRM HTTP ${res.status}`);
      const data = await res.json();

      if (data.routes?.[0]?.geometry) {
        const latlngs = decodePolyline(data.routes[0].geometry);
        const polyline = L.polyline(latlngs, {
          color: '#3b82f6',
          weight: 5,
          opacity: 0.85,
        }).addTo(mapInstanceRef.current!);

        routingControlRef.current = polyline;
        mapInstanceRef.current!.fitBounds(polyline.getBounds(), { padding: [40, 40] });

        const durationMin = Math.round((data.routes[0].duration ?? 0) / 60);
        const distKm = (data.routes[0].distance / 1000).toFixed(1);
        toast({
          title: "Route Ready",
          description: `${distKm} km · ~${durationMin} min to ${service.name}`,
        });
      } else {
        throw new Error('No route found');
      }
    } catch (err: any) {
      console.error('Route error:', err);
      toast({
        title: "Routing Failed",
        description: err.message || "Could not calculate route",
        variant: "destructive",
      });
      setSelectedService(null);
      setShowingRoute(false);
    }
  };

  const clearRoute = () => {
    if (routingControlRef.current) {
      routingControlRef.current.remove();
      routingControlRef.current = null;
    }
    setSelectedService(null);
    setShowingRoute(false);
  };

  // Listen for external routing requests (e.g., from Saarthi AI)
  useEffect(() => {
    const handleRouteToFacility = (event: any) => {
      const facility = event.detail;
      // Re-map it to ensure it matches the EmergencyService schema used by showRoute
      const service: EmergencyService = {
        id: facility.id,
        name: facility.name,
        type: facility.type,
        lat: facility.lat || facility.location?.lat,
        lng: facility.lng || facility.location?.lng,
        distance: facility.distance || 0,
        contact: facility.contact
      };

      if (userLocation && mapInstanceRef.current) {
        showRoute(service);
      }
    };

    window.addEventListener('routeToFacility', handleRouteToFacility);
    return () => window.removeEventListener('routeToFacility', handleRouteToFacility);
  }, [userLocation]); // Re-bind when user location is available


  const fetchNearbyServices = async (lat: number, lng: number) => {
    setLoading(true);

    try {
      // Use the centralized robust fetch from api.ts with increased radius (25km) to include more data
      const allFacilities = await fetchEmergencyFacilities({ lat, lng, name: '' }, 25000); // 25km radius

      // Map API types 'hospital', 'police', 'fire_station' to our EmergencyService type
      // And filter based on selectedTypes
      const services: EmergencyService[] = allFacilities
        .filter(f => selectedTypes.includes(f.type))
        .map(f => ({
          id: f.id,
          name: f.name,
          type: f.type,
          lat: f.location.lat,
          lng: f.location.lng,
          distance: f.distance || 0,
          contact: f.contact,
          address: undefined, // address isn't returned by fetchEmergencyFacilities yet
        }));

      setServices(services);
      toast({
        title: "Services Loaded",
        description: services.length
          ? `Found ${services.length} nearby emergency services`
          : "No emergency services found in this area",
      });
    } catch (error: any) {
      console.error("Error fetching services:", error);
      toast({
        title: "Error loading services",
        description: error.message || "Failed to load emergency services",
        variant: "destructive",
      });
      setServices([]);
    } finally {
      setLoading(false);
    }
  };

  const getServiceIcon = (type: string) => {
    switch (type) {
      case "hospital":
        return <Hospital className="w-4 h-4" />;
      case "police":
        return <Shield className="w-4 h-4" />;
      case "fire_station":
        return <Flame className="w-4 h-4" />;
      default:
        return <Hospital className="w-4 h-4" />;
    }
  };

  // Initialize map
  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;

    const map = L.map(mapRef.current, { zoomControl: false }).setView([20.5937, 78.9629], 5);
    mapInstanceRef.current = map;

    const getTileUrl = () => {
      // Always use Google Maps (gl=IN) to natively force correct Indian boundaries
      return 'https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}&gl=IN';
    };

    const tileLayer = createOfflineTileLayer(getTileUrl(), {
      attribution: '© Google Maps',
      maxZoom: 18,
      regionName: 'emergency',
      className: isDarkMode ? 'dark-map-tiles' : '' // Apply new refined filter
    });
    (tileLayer as any).addTo(map);
    tileLayerRef.current = tileLayer as L.TileLayer;

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
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
    if (!mapInstanceRef.current || !tileLayerRef.current) return;

    mapInstanceRef.current.removeLayer(tileLayerRef.current);

    const getTileUrl = () => {
      return 'https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}&gl=IN';
    };

    const newTileLayer = createOfflineTileLayer(getTileUrl(), {
      attribution: '© Google Maps',
      maxZoom: 18,
      regionName: 'emergency',
      className: isDarkMode ? 'dark-map-tiles' : ''
    });
    (newTileLayer as any).addTo(mapInstanceRef.current);

    tileLayerRef.current = newTileLayer as L.TileLayer;
  }, [isDarkMode]);

  useEffect(() => {
    if (dashboardLocation) {
      setUserLocation([dashboardLocation.lat, dashboardLocation.lng]);
      fetchNearbyServices(dashboardLocation.lat, dashboardLocation.lng);
    } else {
      getUserLocation();
    }
  }, [dashboardLocation]);

  // Refetch when filters change
  useEffect(() => {
    if (userLocation) {
      fetchNearbyServices(userLocation[0], userLocation[1]);
    }
  }, [selectedTypes]);

  // Update markers when services or location changes
  useEffect(() => {
    if (!mapInstanceRef.current) {
      return;
    }

    // Clear existing markers
    markersRef.current.forEach(marker => {
      mapInstanceRef.current?.removeLayer(marker);
    });
    markersRef.current = [];

    // Center map on user location if available
    if (userLocation) {
      mapInstanceRef.current.setView(userLocation, 13);

      // Add user location marker with distinct pulsing icon
      const userIcon = L.divIcon({
        className: 'custom-user-marker',
        html: `
          <div class="relative flex items-center justify-center w-8 h-8">
            <div class="absolute w-full h-full bg-blue-500 rounded-full animate-ping opacity-75"></div>
            <div class="relative w-4 h-4 bg-blue-600 border-2 border-white rounded-full shadow-lg"></div>
          </div>
        `,
        iconSize: [32, 32],
        iconAnchor: [16, 16],
      });

      const userMarker = L.marker(userLocation, { icon: userIcon })
        .bindPopup('<strong>Your Location</strong>')
        .addTo(mapInstanceRef.current);
      markersRef.current.push(userMarker);
    }

    // Add service markers
    services.forEach((service, index) => {

      const typeLabel = service.type === 'fire_station' ? 'Fire Station' : service.type.charAt(0).toUpperCase() + service.type.slice(1);
      const popupHtml = `
        <div style="min-width: 160px; font-family: system-ui, sans-serif;">
          <strong style="font-size: 12px; line-height: 1.3; display: block; margin-bottom: 4px;">${escapeHtml(service.name)}</strong>
          <span style="font-size: 10px; color: #666; line-height: 1.4;">
            ${escapeHtml(typeLabel)} · ${service.distance.toFixed(2)} km
            ${service.address ? `<br/>${escapeHtml(service.address)}` : ''}
          </span>
          <button
            data-route-id="${service.id}"
            style="display: flex; align-items: center; justify-content: center; gap: 4px; width: 100%; margin-top: 8px; padding: 6px 10px; background: #16a34a; color: white; border: none; border-radius: 8px; font-size: 11px; font-weight: 600; cursor: pointer; box-shadow: 0 1px 3px rgba(0,0,0,0.15);"
          >⬆ Get Directions</button>
        </div>
      `;

      const marker = L.marker([service.lat, service.lng])
        .bindPopup(popupHtml, { closeButton: true, maxWidth: 200 })
        .addTo(mapInstanceRef.current!);

      // Wire the "Get Directions" button inside popup to showRoute
      marker.on('popupopen', () => {
        const btn = document.querySelector(`button[data-route-id="${service.id}"]`) as HTMLElement;
        if (btn) {
          btn.onclick = (e) => {
            e.stopPropagation();
            marker.closePopup(); // Close popup so it doesn't overlap
            setSelectedService(service);
            showRoute(service);
          };
        }
      });

      markersRef.current.push(marker);
    });
  }, [services, userLocation]);

  return (
    <div className="h-full w-full relative flex flex-col md:flex-row bg-background overflow-hidden">
      
      {/* Disable Leaflet popup fade animations globally so they close instantly and don't ghost under UI elements during camera pans */}
      <style dangerouslySetInnerHTML={{ __html: `.leaflet-fade-anim .leaflet-popup { transition: none !important; }` }} />
      
      {/* === DESKTOP SIDEBAR === */}
      <div className="hidden md:flex w-96 bg-card border-r p-4 flex-col h-full overflow-y-auto z-10 relative">
        <div className="mb-4 space-y-4">
          <div ref={searchContainerRef} className="relative">
            <MapPin className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <Input
              type="text"
              placeholder="Search city for services..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
            {isSearching && (
              <div className="absolute right-3 top-1/2 transform -translate-y-1/2 pointer-events-none">
                <div className="animate-spin h-4 w-4 border-2 border-primary border-t-transparent rounded-full" />
              </div>
            )}
            {/* Desktop Dropdown */}
            {showDropdown && searchResults.length > 0 && (
              <div className="absolute top-14 left-0 right-0 bg-card border border-border rounded-lg shadow-lg z-50 max-h-60 overflow-y-auto">
                {searchResults.map((result, index) => (
                  <div key={index} onClick={() => handleSelectLocation(result)} className="flex items-center gap-3 p-3 hover:bg-accent cursor-pointer transition-colors border-b border-border last:border-0">
                    <MapPin className="h-4 w-4 text-muted-foreground shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{result.name}</p>
                      <p className="text-xs text-muted-foreground">{result.lat.toFixed(4)}, {result.lng.toFixed(4)}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          <Button onClick={getUserLocation} disabled={loading} className="w-full" variant="outline">
            {loading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Finding...</> : <><Navigation className="w-4 h-4 mr-2" /> Use My Current Location</>}
          </Button>
        </div>

        <div className="mb-4 space-y-2">
          <p className="font-semibold text-sm">Filter by Type:</p>
          {[
            { id: "hospital", label: "Hospitals", icon: <Hospital className="w-4 h-4" /> },
            { id: "police", label: "Police", icon: <Shield className="w-4 h-4" /> },
            { id: "fire_station", label: "Fire Stations", icon: <Flame className="w-4 h-4" /> },
          ].map(({ id, label, icon }) => (
            <label key={id} className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={selectedTypes.includes(id)} onChange={(e) => e.target.checked ? setSelectedTypes([...selectedTypes, id]) : setSelectedTypes(selectedTypes.filter((t) => t !== id))} className="rounded" />
              {icon} <span className="text-sm">{label}</span>
            </label>
          ))}
        </div>

        <div className="space-y-2 flex-1 overflow-y-auto pb-4">
          <p className="font-semibold text-xs mb-1.5 sticky top-0 bg-card z-10 py-1">Nearby Services ({services.length})</p>
          {loading && <div className="text-center py-4"><Loader2 className="w-5 h-5 animate-spin mx-auto mb-2" /><p className="text-[10px] text-muted-foreground">Loading services...</p></div>}
          {!loading && services.length === 0 && <div className="text-center py-4"><p className="text-[10px] text-muted-foreground">No services found</p></div>}
          {!loading && services.map((service) => (
            <Card key={service.id} className={`p-2.5 hover:bg-accent cursor-pointer transition-all ${selectedService?.id === service.id ? 'ring-2 ring-primary' : ''}`} onClick={() => mapInstanceRef.current?.setView([service.lat, service.lng], 15)}>
              <div className="flex items-start gap-2.5">
                <div className="mt-0.5">{getServiceIcon(service.type)}</div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-xs leading-tight mb-0.5">{service.name}</p>
                  <p className="text-[10px] text-muted-foreground">{service.distance.toFixed(2)} km away</p>
                  {service.address && <p className="text-[10px] text-muted-foreground mt-0.5 line-clamp-1">{service.address}</p>}
                  <Button size="sm" variant="outline" className="mt-1.5 w-full h-7 text-[11px]" onClick={(e) => { e.stopPropagation(); showRoute(service); }}><Navigation className="w-3 h-3 mr-1" />Get Directions</Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>

      {/* === MOBILE FLOATING OVERLAYS === */}
      <div className="md:hidden absolute inset-0 z-[1001] pointer-events-none flex flex-col justify-between">
        
        {/* Top Search Bar + Filter Chips Overlay */}
        <div className="pointer-events-auto p-3 flex flex-col gap-2">
          <div className="relative">
            <MapPin className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <Input
              type="text"
              placeholder="Search city..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 h-11 rounded-xl shadow-lg border-white/20 glass-strong backdrop-blur-xl bg-background/80 text-sm"
            />
            {isSearching && (
              <div className="absolute right-3 top-1/2 transform -translate-y-1/2 pointer-events-none"><div className="animate-spin h-4 w-4 border-2 border-primary border-t-transparent rounded-full" /></div>
            )}
            {/* Mobile Dropdown */}
            {showDropdown && searchResults.length > 0 && (
              <div className="absolute top-[52px] left-0 right-0 bg-card border border-border rounded-xl shadow-2xl z-50 max-h-52 overflow-y-auto">
                {searchResults.map((result, index) => (
                  <div key={index} onClick={() => handleSelectLocation(result)} className="flex items-center gap-3 p-3 hover:bg-accent cursor-pointer active:bg-accent border-b border-border/50 last:border-0">
                    <MapPin className="h-4 w-4 text-muted-foreground shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{result.name}</p>
                      <p className="text-[10px] text-muted-foreground">{result.lat.toFixed(4)}, {result.lng.toFixed(4)}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Mobile Action Row: Location + Filter Chips */}
          <div className="flex items-center gap-2">
            <Button onClick={getUserLocation} disabled={loading} className="h-9 rounded-lg shadow-md glass-strong border-white/20 backdrop-blur-xl bg-background/80 text-xs font-semibold px-3 shrink-0" variant="outline">
              {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Navigation className="w-3.5 h-3.5" />}
            </Button>
            <div className="flex gap-1.5 overflow-x-auto hide-scrollbar">
              {[
                { id: "hospital", label: "Hospital", icon: <Hospital className="w-3 h-3" /> },
                { id: "police", label: "Police", icon: <Shield className="w-3 h-3" /> },
                { id: "fire_station", label: "Fire", icon: <Flame className="w-3 h-3" /> },
              ].map(({ id, label, icon }) => (
                <button
                  key={id}
                  onClick={() => selectedTypes.includes(id) ? setSelectedTypes(selectedTypes.filter(t => t !== id)) : setSelectedTypes([...selectedTypes, id])}
                  className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-bold whitespace-nowrap transition-all shadow-sm border ${
                    selectedTypes.includes(id)
                      ? 'bg-primary text-primary-foreground border-primary shadow-md'
                      : 'glass-strong bg-background/80 text-muted-foreground border-white/20'
                  }`}
                >
                  {icon}
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Mobile Loading State */}
        {loading && (
          <div className="pointer-events-auto flex items-center justify-center py-2">
            <div className="glass-strong bg-background/90 backdrop-blur-xl rounded-full px-4 py-2 shadow-lg border border-white/20 flex items-center gap-2">
              <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" />
              <span className="text-xs font-semibold">Finding services...</span>
            </div>
          </div>
        )}

        {/* Bottom: Selected Service Detail (appears when user taps a marker) */}
        <div className="pointer-events-auto w-full pb-[72px] px-3">
          {!loading && services.length > 0 && !selectedService && (
            <div className="glass-strong bg-background/90 backdrop-blur-xl rounded-xl shadow-lg border border-white/20 px-3 py-2.5 flex items-center justify-between">
              <span className="text-[11px] font-semibold text-foreground">{services.length} services found</span>
              <span className="text-[9px] text-muted-foreground">Tap a marker for directions</span>
            </div>
          )}
          {selectedService && !showingRoute && (
            <Card className="glass-strong backdrop-blur-xl bg-background/90 shadow-2xl border border-white/20 rounded-xl p-2.5 animate-in slide-in-from-bottom-4 duration-300">
              <div className="flex items-start gap-2">
                <div className="mt-0.5 bg-primary/10 p-1.5 rounded-full shrink-0">{getServiceIcon(selectedService.type)}</div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-[11px] leading-tight">{selectedService.name}</p>
                  <p className="text-[9px] text-primary font-medium mt-0.5">{selectedService.distance.toFixed(2)} km away</p>
                  <div className="flex gap-1.5 mt-1.5">
                    <Button size="sm" variant="default" className="flex-1 h-7 rounded-md shadow-sm font-semibold text-[10px]" onClick={(e) => { e.stopPropagation(); showRoute(selectedService); }}>
                      <Navigation className="w-2.5 h-2.5 mr-1" /> Directions
                    </Button>
                    <Button size="sm" variant="outline" className="h-7 px-2 rounded-md text-[10px]" onClick={() => { setSelectedService(null); clearRoute(); }}>
                      <X className="w-2.5 h-2.5" />
                    </Button>
                  </div>
                </div>
              </div>
            </Card>
          )}
        </div>
      </div>

      {/* Navigation Info Panel (Floating Action) - MOVED OUTSIDE MAP FOR Z-INDEX */}
      {showingRoute && selectedService && (
        <div className="absolute top-[130px] left-3 right-3 md:top-4 md:left-auto md:right-4 md:w-72 bg-primary text-primary-foreground border border-primary-foreground/20 rounded-xl shadow-2xl p-2.5 md:p-4 z-[1002] backdrop-blur-xl animate-in slide-in-from-top-4">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0 flex-1">
              <h3 className="font-bold text-[10px] md:text-sm tracking-wide uppercase opacity-80">Navigating to</h3>
              <p className="text-xs md:text-sm font-semibold truncate">{selectedService.name}</p>
            </div>
            <Button variant="ghost" size="sm" onClick={clearRoute} className="h-7 w-7 md:h-8 md:w-8 p-0 rounded-full bg-primary-foreground/10 hover:bg-primary-foreground/20 text-primary-foreground shrink-0">
              <X className="h-4 w-4" />
            </Button>
          </div>
          <p className="text-[9px] md:text-xs text-primary-foreground/70 font-medium mt-0.5">Follow the route on the map</p>
        </div>
      )}

      {/* === FULL SCREEN MAP === */}
      <div className="flex-1 h-full w-full absolute md:relative inset-0 z-0">
        <div ref={mapRef} className="h-full w-full" />
      </div>
    </div>
  );
};

export default EmergencyServicesMap;