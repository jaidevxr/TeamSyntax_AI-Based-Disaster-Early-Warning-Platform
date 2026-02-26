import axios from 'axios';
import { DisasterEvent, WeatherData, EmergencyFacility, Location } from '@/types';
import { supabase } from '@/integrations/supabase/client';

const USGS_EARTHQUAKE_URL = 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/significant_day.geojson';
const NOMINATIM_API_URL = 'https://nominatim.openstreetmap.org/search';

// Overpass mirrors for high availability
const OVERPASS_MIRRORS = [
  'https://overpass-api.de/api/interpreter',
  'https://lz4.overpass-api.de/api/interpreter',
  'https://z.overpass-api.de/api/interpreter',
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
];

// Reverse geocode coordinates to city name
export const reverseGeocode = async (lat: number, lng: number): Promise<string> => {
  try {
    // BigDataCloud is CORS-friendly and free (no API key) — Nominatim blocks localhost with 403
    const res = await fetch(
      `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lng}&localityLanguage=en`
    );
    if (!res.ok) return `${lat.toFixed(2)}, ${lng.toFixed(2)}`;
    const data = await res.json();
    const city =
      data.city ||
      data.locality ||
      data.localityInfo?.administrative?.find((a: any) => a.adminLevel === 5)?.name ||
      data.principalSubdivision ||
      '';
    const state = data.principalSubdivision || '';
    if (city && state && city !== state) return `${city}, ${state}`;
    if (city) return city;
    if (state) return state;
    return `${lat.toFixed(2)}, ${lng.toFixed(2)}`;
  } catch {
    return `${lat.toFixed(2)}, ${lng.toFixed(2)}`;
  }
};

// Get user's current location
export const getCurrentLocation = (): Promise<Location> => {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation is not supported'));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;

        // Reverse geocode to get city name
        const name = await reverseGeocode(lat, lng);

        resolve({ lat, lng, name });
      },
      (error) => {
        console.error("❌ Geolocation error:", error.code, error.message);
        reject(error);
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  });
};

// Check if coordinates are within India's boundaries (more precise)
const isInIndia = (lat: number, lng: number): boolean => {
  // More precise boundaries to exclude Nepal, Pakistan, Bangladesh, Myanmar, etc.
  // India mainland: roughly 8°N to 35°N latitude, 68°E to 97°E longitude
  // Excluding border regions more strictly

  // Exclude Nepal (north of ~27.5°N and east of 80°E)
  if (lat > 27.5 && lng > 80 && lng < 88.2 && lat < 30.5) return false;

  // Exclude Pakistan (west of 74°E for northern regions)
  if (lng < 74 && lat > 30) return false;

  // Exclude Bangladesh (east of 89°E and north of 22°N)
  if (lng > 88.5 && lat > 22 && lat < 26.5 && lng < 92.5) return false;

  // Exclude Myanmar (east of 94°E)
  if (lng > 94) return false;

  // Exclude Sri Lanka (south of 10°N)
  if (lat < 8.5 && lng > 79 && lng < 82) return false;

  // Main India boundaries (more conservative)
  return lat >= 8 && lat <= 35.5 && lng >= 68.5 && lng <= 97.5;
};

// Get Indian state from coordinates (exported so other modules can use it)
export const getIndianState = (lat: number, lng: number, placeName: string = ''): string => {
  // Check place name first for accurate state detection
  const indianStates = [
    'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh', 'Goa',
    'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand', 'Karnataka', 'Kerala',
    'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram', 'Nagaland',
    'Odisha', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana', 'Tripura',
    'Uttar Pradesh', 'Uttarakhand', 'West Bengal', 'Delhi', 'Jammu and Kashmir',
    'Ladakh', 'Puducherry', 'Chandigarh', 'Andaman and Nicobar', 'Lakshadweep'
  ];

  // Try to match state from place name
  for (const state of indianStates) {
    if (placeName.toLowerCase().includes(state.toLowerCase())) {
      return state;
    }
  }

  // Rough state boundaries based on coordinates
  if (lat >= 32 && lat <= 36.5 && lng >= 74 && lng <= 80) return 'Jammu and Kashmir';
  if (lat >= 30.5 && lat <= 33 && lng >= 75 && lng <= 77) return 'Himachal Pradesh';
  if (lat >= 28.5 && lat <= 31.5 && lng >= 77 && lng <= 81) return 'Uttarakhand';
  if (lat >= 30 && lat <= 32.5 && lng >= 74 && lng <= 76.5) return 'Punjab';
  if (lat >= 28 && lat <= 31 && lng >= 74.5 && lng <= 77.5) return 'Haryana';
  if (lat >= 28.4 && lat <= 28.9 && lng >= 76.8 && lng <= 77.4) return 'Delhi';
  if (lat >= 24 && lat <= 30.5 && lng >= 68 && lng <= 78) return 'Rajasthan';
  if (lat >= 23.5 && lat <= 30.5 && lng >= 78 && lng <= 84.5) return 'Uttar Pradesh';
  if (lat >= 21.5 && lat <= 27 && lng >= 82 && lng <= 88.5) return 'Bihar';
  if (lat >= 24 && lat <= 27.5 && lng >= 85 && lng <= 88) return 'Jharkhand';
  if (lat >= 21.5 && lat <= 27.5 && lng >= 88 && lng <= 92.5) return 'West Bengal';
  if (lat >= 21 && lat <= 26.5 && lng >= 69 && lng <= 74.5) return 'Gujarat';
  if (lat >= 21.5 && lat <= 27 && lng >= 73.5 && lng <= 82) return 'Madhya Pradesh';
  if (lat >= 15.5 && lat <= 23 && lng >= 73 && lng <= 80.5) return 'Maharashtra';
  if (lat >= 17 && lat <= 22.5 && lng >= 80.5 && lng <= 84.5) return 'Chhattisgarh';
  if (lat >= 17.5 && lat <= 22.5 && lng >= 81.5 && lng <= 87.5) return 'Odisha';
  if (lat >= 13 && lat <= 19.5 && lng >= 76 && lng <= 81) return 'Telangana';
  if (lat >= 12.5 && lat <= 19.5 && lng >= 77 && lng <= 85) return 'Andhra Pradesh';
  if (lat >= 11.5 && lat <= 18.5 && lng >= 74 && lng <= 78.5) return 'Karnataka';
  if (lat >= 14.5 && lat <= 20 && lng >= 72.5 && lng <= 78.5) return 'Goa';
  if (lat >= 8 && lat <= 13 && lng >= 74.5 && lng <= 77.5) return 'Kerala';
  if (lat >= 8 && lat <= 13.5 && lng >= 76.5 && lng <= 80.5) return 'Tamil Nadu';
  if (lat >= 23.5 && lat <= 28.5 && lng >= 89.5 && lng <= 94) return 'Assam';
  if (lat >= 23 && lat <= 28 && lng >= 90.5 && lng <= 93.5) return 'Meghalaya';
  if (lat >= 22 && lat <= 24.5 && lng >= 91 && lng <= 93) return 'Tripura';
  if (lat >= 23 && lat <= 27.5 && lng >= 92 && lng <= 94.5) return 'Mizoram';
  if (lat >= 24.5 && lat <= 27.5 && lng >= 93 && lng <= 95.5) return 'Manipur';
  if (lat >= 25 && lat <= 27.5 && lng >= 93.5 && lng <= 95.5) return 'Nagaland';
  if (lat >= 27 && lat <= 29.5 && lng >= 88 && lng <= 89.5) return 'Sikkim';
  if (lat >= 26.5 && lat <= 29.5 && lng >= 91.5 && lng <= 97.5) return 'Arunachal Pradesh';
  if (lat >= 6 && lat <= 14 && lng >= 92 && lng <= 94) return 'Andaman and Nicobar';

  return 'India';
};

// Fetch comprehensive disaster data from multiple sources for India
export const fetchDisasterData = async (): Promise<DisasterEvent[]> => {
  const allDisasters: DisasterEvent[] = [];

  try {
    // 1. Fetch earthquakes from USGS (last 30 days, magnitude 2.5+)
    const earthquakeUrl = 'https://earthquake.usgs.gov/fdsnws/event/1/query';
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const today = new Date().toISOString().split('T')[0];

    const earthquakeParams = new URLSearchParams({
      format: 'geojson',
      starttime: thirtyDaysAgo,
      endtime: today,
      minmagnitude: '2.5',
      minlatitude: '8',
      maxlatitude: '35.5',
      minlongitude: '68.5',
      maxlongitude: '97.5',
      orderby: 'time-asc'
    });

    const earthquakeResponse = await axios.get(`${earthquakeUrl}?${earthquakeParams}`);
    const earthquakes = earthquakeResponse.data.features || [];

    earthquakes.forEach((feature: any) => {
      const coords = feature.geometry.coordinates;
      const props = feature.properties;
      const lat = coords[1];
      const lng = coords[0];

      // Strict India boundary check
      if (!isInIndia(lat, lng)) return;

      // Filter out events with Nepal, Pakistan, Bangladesh, Myanmar, China in the name
      const place = (props.place || '').toLowerCase();
      if (place.includes('nepal') || place.includes('pakistan') ||
        place.includes('bangladesh') || place.includes('myanmar') ||
        place.includes('china') || place.includes('bhutan') ||
        place.includes('tibet') || place.includes('sri lanka')) {
        return;
      }

      let severity: 'low' | 'medium' | 'high' = 'low';
      if (props.mag >= 6.0) severity = 'high';
      else if (props.mag >= 4.5) severity = 'medium';

      const stateName = getIndianState(lat, lng, props.place || '');

      allDisasters.push({
        id: feature.id,
        type: 'earthquake',
        severity,
        magnitude: props.mag,
        location: {
          lat,
          lng,
          name: stateName
        },
        time: new Date(props.time).toISOString(),
        title: `Magnitude ${props.mag} Earthquake - ${stateName}`,
        description: `Detected in ${stateName}, India - Depth: ${coords[2]?.toFixed(1) || 'N/A'} km`,
        url: props.url,
      });
    });

  } catch (error) {
    console.error('Error fetching earthquake data:', error);
  }

  try {
    // 2. Fetch from GDACS (using CORS proxy since GDACS blocks direct browser requests)
    const fromDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const toDate = new Date().toISOString().split('T')[0];
    const gdacsPath = `/gdacsapi/api/events/geteventlist/SEARCH?fromDate=${fromDate}&toDate=${toDate}&alertlevel=Orange;Red`;

    // Try direct first, then CORS proxy
    const gdacsUrls = [
      `https://www.gdacs.org${gdacsPath}`,
      `https://corsproxy.io/?${encodeURIComponent(`https://www.gdacs.org${gdacsPath}`)}`,
      `https://api.allorigins.win/get?url=${encodeURIComponent(`https://www.gdacs.org${gdacsPath}`)}`,
    ];

    let gdacsEvents: any[] = [];

    for (const gdacsUrl of gdacsUrls) {
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 8000);
        const res = await fetch(gdacsUrl, { signal: controller.signal });
        clearTimeout(timer);
        if (!res.ok) continue;

        let json: any;
        if (gdacsUrl.includes('allorigins')) {
          const wrapper = await res.json();
          json = JSON.parse(wrapper.contents);
        } else {
          json = await res.json();
        }
        gdacsEvents = json.features || [];
        break; // success — stop trying
      } catch {
        // try next URL
        continue;
      }
    }

    gdacsEvents.forEach((event: any) => {
      const coords = event.geometry?.coordinates;
      if (!coords) return;

      const lng = coords[0];
      const lat = coords[1];

      if (!isInIndia(lat, lng)) return;

      const props = event.properties;
      const country = (props.country || '').toLowerCase();
      if (country && country !== 'india') return;

      let disasterType: 'earthquake' | 'flood' | 'cyclone' | 'fire' | 'landslide' = 'earthquake';
      const eventType = (props.eventtype || '').toLowerCase();

      if (eventType.includes('fl')) disasterType = 'flood';
      else if (eventType.includes('tc') || eventType.includes('storm')) disasterType = 'cyclone';
      else if (eventType.includes('vo')) disasterType = 'fire';
      else if (eventType.includes('dr')) disasterType = 'landslide';

      let severity: 'low' | 'medium' | 'high' = 'medium';
      const alertLevel = (props.alertlevel || '').toLowerCase();
      if (alertLevel.includes('red')) severity = 'high';
      else if (alertLevel.includes('orange')) severity = 'medium';

      const stateName = getIndianState(lat, lng, props.name || '');

      allDisasters.push({
        id: `gdacs-${props.eventid || Math.random()}`,
        type: disasterType,
        severity,
        magnitude: props.severity?.value,
        location: { lat, lng, name: stateName },
        time: props.fromdate || new Date().toISOString(),
        title: `${props.name || disasterType} - ${stateName}`,
        description: props.htmldescription || props.description || `GDACS ${severity} alert in ${stateName}`,
        url: `https://www.gdacs.org/report.aspx?eventid=${props.eventid}&eventtype=${props.eventtype}`,
      });
    });

  } catch (error) {
    console.error('Error fetching GDACS data:', error);
  }


  // Remove duplicates based on coordinates and time (within 1 hour)
  const uniqueDisasters = allDisasters.filter((disaster, index, self) => {
    return index === self.findIndex((d) => {
      const timeDiff = Math.abs(new Date(d.time).getTime() - new Date(disaster.time).getTime());
      const coordMatch = Math.abs(d.location.lat - disaster.location.lat) < 0.1 &&
        Math.abs(d.location.lng - disaster.location.lng) < 0.1;
      return coordMatch && timeDiff < 3600000; // 1 hour
    });
  });

  // Sort by time (most recent first)
  uniqueDisasters.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());
  return uniqueDisasters;
};

// Note: Disaster predictions removed - only showing real data from USGS and GDACS APIs

// Legacy function for backward compatibility
export const fetchEarthquakeData = fetchDisasterData;

// Fetch weather data for multiple locations (for heatmap overlay)
export const fetchWeatherDataForMultipleLocations = async (
  locations: Location[]
): Promise<Map<string, { temp: number; rainfall: number }>> => {
  const weatherMap = new Map<string, { temp: number; rainfall: number }>();

  // Batch requests to avoid overwhelming the API
  const batchSize = 10;
  for (let i = 0; i < locations.length; i += batchSize) {
    const batch = locations.slice(i, i + batchSize);

    const promises = batch.map(async (location) => {
      try {
        const params = new URLSearchParams({
          latitude: location.lat.toString(),
          longitude: location.lng.toString(),
          current: 'temperature_2m,precipitation',
          timezone: 'auto',
        });

        const response = await fetch(
          `https://api.open-meteo.com/v1/forecast?${params}`
        );

        if (!response.ok) return null;

        const data = await response.json();
        const key = `${location.lat.toFixed(2)},${location.lng.toFixed(2)}`;

        return {
          key,
          data: {
            temp: data.current?.temperature_2m || 0,
            rainfall: data.current?.precipitation || 0,
          }
        };
      } catch (error) {
        console.error('Error fetching weather for location:', location, error);
        return null;
      }
    });

    const results = await Promise.all(promises);
    results.forEach(result => {
      if (result) {
        weatherMap.set(result.key, result.data);
      }
    });

    // Small delay between batches to be respectful to the API
    if (i + batchSize < locations.length) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  return weatherMap;
};

// Fetch weather data directly from Open-Meteo (no Supabase edge function)
export const fetchWeatherData = async (location: Location): Promise<WeatherData | null> => {
  return await getFallbackWeatherData(location);
};

// Map Open-Meteo WMO weather codes to readable text and icons
const mapWeatherCodeToText = (code?: number): string => {
  switch (code) {
    case 0: return 'clear sky';
    case 1:
    case 2: return 'partly cloudy';
    case 3: return 'overcast';
    case 45:
    case 48: return 'fog';
    case 51:
    case 53:
    case 55: return 'drizzle';
    case 61:
    case 63:
    case 65: return 'rain';
    case 66:
    case 67: return 'freezing rain';
    case 71:
    case 73:
    case 75: return 'snow';
    case 80:
    case 81:
    case 82: return 'rain showers';
    case 95: return 'thunderstorm';
    case 96:
    case 99: return 'thunderstorm with hail';
    default: return 'unknown';
  }
};

const mapWeatherCodeToIcon = (code?: number): string => {
  switch (code) {
    case 0: return '01d';
    case 1:
    case 2: return '02d';
    case 3: return '04d';
    case 45:
    case 48: return '50d';
    case 51:
    case 53:
    case 55: return '09d';
    case 61:
    case 63:
    case 65: return '10d';
    case 66:
    case 67: return '13d';
    case 71:
    case 73:
    case 75: return '13d';
    case 80:
    case 81:
    case 82: return '09d';
    case 95:
    case 96:
    case 99: return '11d';
    default: return '02d';
  }
};

// Fallback weather using Open-Meteo (free, no API key needed)
export const getFallbackWeatherData = async (location: Location): Promise<WeatherData | null> => {
  try {
    const params = new URLSearchParams({
      latitude: location.lat.toString(),
      longitude: location.lng.toString(),
      current: 'temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m,wind_direction_10m,surface_pressure,is_day',
      hourly: 'temperature_2m,relative_humidity_2m,precipitation_probability,precipitation,weather_code,wind_speed_10m',
      daily: 'temperature_2m_max,temperature_2m_min,precipitation_sum,weather_code,sunrise,sunset,uv_index_max',
      timezone: 'auto',
      forecast_days: '5',
    });

    const response = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`);
    if (!response.ok) throw new Error('Open-Meteo request failed');
    const data = await response.json();

    const current = data.current;
    const hourly = data.hourly;
    const daily = data.daily;

    const hourlyForecast = hourly?.time?.slice(0, 8).map((time: string, i: number) => ({
      time: Math.floor(new Date(time).getTime() / 1000),
      temperature: Math.round(hourly.temperature_2m[i]),
      precipitation: hourly.precipitation_probability?.[i] || 0,
      rain: hourly.precipitation?.[i] || 0,
      humidity: hourly.relative_humidity_2m?.[i] || 0,
      windSpeed: Math.round(hourly.wind_speed_10m?.[i] || 0),
      condition: mapWeatherCodeToText(hourly.weather_code?.[i]),
      description: mapWeatherCodeToText(hourly.weather_code?.[i]),
      icon: mapWeatherCodeToIcon(hourly.weather_code?.[i]),
    })) || [];

    const forecast = daily?.time?.map((date: string, i: number) => ({
      date,
      temperature: {
        min: Math.round(daily.temperature_2m_min[i]),
        max: Math.round(daily.temperature_2m_max[i]),
      },
      rainfall: daily.precipitation_sum?.[i] || 0,
      condition: mapWeatherCodeToText(daily.weather_code?.[i]),
      icon: mapWeatherCodeToIcon(daily.weather_code?.[i]),
    })) || [];

    return {
      location,
      temperature: Math.round(current.temperature_2m),
      humidity: current.relative_humidity_2m,
      windSpeed: Math.round(current.wind_speed_10m),
      rainfall: current.precipitation || 0,
      condition: mapWeatherCodeToText(current.weather_code),
      icon: mapWeatherCodeToIcon(current.weather_code),
      alerts: [],
      forecast,
      feelsLike: Math.round(current.apparent_temperature),
      pressure: Math.round(current.surface_pressure),
      windDirection: current.wind_direction_10m,
      visibility: undefined,
      uvIndex: daily?.uv_index_max?.[0] || undefined,
      sunrise: daily?.sunrise?.[0] ? Math.floor(new Date(daily.sunrise[0]).getTime() / 1000) : undefined,
      sunset: daily?.sunset?.[0] ? Math.floor(new Date(daily.sunset[0]).getTime() / 1000) : undefined,
      isDay: current.is_day,
      hourlyForecast,
    };
  } catch (error) {
    console.error('Open-Meteo fallback also failed:', error);
    return null;
  }
};

// Fetch emergency facilities using Overpass API
export const fetchEmergencyFacilities = async (location: Location, radius: number = 10000): Promise<EmergencyFacility[]> => {
  // Cache key based on location (rounded to ~1km grid) and radius
  const cacheKey = `facilities_${location.lat.toFixed(2)}_${location.lng.toFixed(2)}_${radius}`;
  const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes

  // Return cached data if still fresh
  try {
    const cached = localStorage.getItem(cacheKey);
    if (cached) {
      const { data, timestamp } = JSON.parse(cached);
      if (Date.now() - timestamp < CACHE_TTL_MS) {
        return data;
      }
    }
  } catch { /* ignore parse errors */ }

  const query = `
    [out:json][timeout:15];
    (
      nwr["amenity"="hospital"](around:${radius},${location.lat},${location.lng});
      nwr["amenity"="police"](around:${radius},${location.lat},${location.lng});
      nwr["amenity"="fire_station"](around:${radius},${location.lat},${location.lng});
      nwr["emergency"="assembly_point"](around:${radius},${location.lat},${location.lng});
      nwr["disaster:shelter"="yes"](around:${radius},${location.lat},${location.lng});
    );
    out center;
  `;

  try {
    // Race all mirrors in parallel to find the fastest responding one that succeeds
    const fetchMirror = async (url: string) => {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 15000); // 15 second timeout per mirror
      try {
        const res = await fetch(url, {
          method: 'POST',
          body: query,
          signal: controller.signal,
          headers: { 'Content-Type': 'text/plain' }
        });
        clearTimeout(timer);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return await res.json();
      } catch (e) {
        clearTimeout(timer);
        throw e;
      }
    };

    let data: any;
    try {
      data = await new Promise((resolve, reject) => {
        let rejections = 0;
        OVERPASS_MIRRORS.map(fetchMirror).forEach(p =>
          p.then(resolve).catch(() => {
            if (++rejections === OVERPASS_MIRRORS.length) reject(new Error('all failed'));
          })
        );
      });
    } catch {
      throw new Error('All Overpass mirrors failed.');
    }

    const elements = data.elements || [];

    const facilities: EmergencyFacility[] = elements.map((element: any) => {
      const lat = element.lat || element.center?.lat;
      const lon = element.lon || element.center?.lon;

      if (!lat || !lon) return null;

      const distance = calculateDistance(location, { lat: lat, lng: lon });

      let facilityType: 'shelter' | 'hospital' | 'police' | 'fire_station' = 'shelter';
      if (element.tags?.amenity === 'hospital') facilityType = 'hospital';
      else if (element.tags?.amenity === 'police') facilityType = 'police';
      else if (element.tags?.amenity === 'fire_station') facilityType = 'fire_station';

      return {
        id: element.id.toString(),
        name: element.tags?.name || `${facilityType.replace('_', ' ')} facility`,
        type: facilityType,
        location: { lat: lat, lng: lon },
        distance: Math.round(distance * 100) / 100,
        contact: element.tags?.phone,
        capacity: element.tags?.capacity ? parseInt(element.tags.capacity) : undefined,
        isOpen: element.tags?.opening_hours !== 'closed',
      };
    }).filter(Boolean).sort((a: any, b: any) => (a.distance || 0) - (b.distance || 0));

    // Cache successful response
    try {
      localStorage.setItem(cacheKey, JSON.stringify({ data: facilities, timestamp: Date.now() }));
    } catch { /* ignore storage errors */ }

    return facilities;
  } catch (error) {
    console.error('Error fetching emergency facilities:', error);
    // Return stale cache if available (better than nothing)
    try {
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        const { data } = JSON.parse(cached);
        return data;
      }
    } catch { /* ignore */ }
    return [];
  }
};

// Geocoding search
export const searchLocation = async (query: string): Promise<Location[]> => {
  try {
    const response = await axios.get(NOMINATIM_API_URL, {
      params: {
        q: query,
        format: 'json',
        limit: 5,
        countrycodes: 'in', // Restrict to India
        addressdetails: 1,
      },
    });

    return response.data.map((result: any) => ({
      lat: parseFloat(result.lat),
      lng: parseFloat(result.lon),
      name: result.display_name,
    }));
  } catch (error) {
    console.error('Error searching location:', error);
    return [];
  }
};

// Calculate distance between two points (Haversine formula)
export const calculateDistance = (point1: Location, point2: Location): number => {
  const R = 6371; // Earth's radius in km
  const dLat = toRad(point2.lat - point1.lat);
  const dLon = toRad(point2.lng - point1.lng);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(point1.lat)) * Math.cos(toRad(point2.lat)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

const toRad = (value: number): number => {
  return (value * Math.PI) / 180;
};

// Fallback disaster data removed - only showing real data from APIs

// Predict disasters locally using weather + geographic/seasonal risk analysis
export const predictDisastersWithAI = async (location: Location): Promise<DisasterEvent[]> => {
  try {

    // Fetch current weather to drive predictions
    const weather = await getFallbackWeatherData(location);
    const month = new Date().getMonth() + 1; // 1-12
    const { lat, lng } = location;
    const state = getIndianState(lat, lng, location.name || '');

    const predictions: DisasterEvent[] = [];

    // ── Flood risk ──────────────────────────────────────────────────────────
    const isMonsooonSeason = month >= 6 && month <= 9;
    const isHighRainfallRegion = [
      'Kerala', 'Assam', 'Meghalaya', 'West Bengal', 'Odisha',
      'Andhra Pradesh', 'Telangana', 'Maharashtra', 'Bihar', 'Uttar Pradesh'
    ].includes(state);
    const rainfall = weather?.rainfall ?? 0;
    const humidity = weather?.humidity ?? 50;

    let floodProb = 0;
    if (isMonsooonSeason) floodProb += 0.35;
    if (isHighRainfallRegion) floodProb += 0.2;
    if (rainfall > 5) floodProb += 0.15;
    if (humidity > 80) floodProb += 0.1;
    floodProb = Math.min(floodProb, 0.95);

    if (floodProb >= 0.3) {
      const severity: 'low' | 'medium' | 'high' = floodProb > 0.7 ? 'high' : floodProb > 0.5 ? 'medium' : 'low';
      predictions.push({
        id: `ai-pred-flood-${Date.now()}`,
        title: `Flood Risk – ${state}`,
        type: 'flood',
        severity,
        location: { lat, lng, name: state },
        time: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
        description: `Probability: ${(floodProb * 100).toFixed(0)}% | Based on ${isMonsooonSeason ? 'monsoon season' : 'current rainfall'} and regional risk.`,
        isPrediction: true,
        probability: floodProb,
        confidence: 0.72,
        timeframeDays: 3,
      } as any);
    }

    // ── Cyclone risk ─────────────────────────────────────────────────────────
    const isCoastal = [
      'Kerala', 'Tamil Nadu', 'Andhra Pradesh', 'Odisha', 'West Bengal',
      'Maharashtra', 'Gujarat', 'Goa', 'Karnataka'
    ].includes(state);
    const isCycloneSeason = (month >= 4 && month <= 6) || (month >= 10 && month <= 12);
    const windSpeed = weather?.windSpeed ?? 0;

    let cycloneProb = 0;
    if (isCoastal && isCycloneSeason) cycloneProb += 0.4;
    else if (isCoastal) cycloneProb += 0.15;
    if (windSpeed > 40) cycloneProb += 0.2;
    cycloneProb = Math.min(cycloneProb, 0.9);

    if (cycloneProb >= 0.25) {
      const severity: 'low' | 'medium' | 'high' = cycloneProb > 0.6 ? 'high' : cycloneProb > 0.4 ? 'medium' : 'low';
      predictions.push({
        id: `ai-pred-cyclone-${Date.now()}`,
        title: `Cyclone Risk – ${state} Coast`,
        type: 'cyclone',
        severity,
        location: { lat, lng, name: state },
        time: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(),
        description: `Probability: ${(cycloneProb * 100).toFixed(0)}% | Coastal region during cyclone-prone season. Wind: ${windSpeed} km/h.`,
        isPrediction: true,
        probability: cycloneProb,
        confidence: 0.65,
        timeframeDays: 5,
      } as any);
    }

    // ── Earthquake risk ──────────────────────────────────────────────────────
    const isSeismicZone = [
      'Jammu and Kashmir', 'Himachal Pradesh', 'Uttarakhand', 'Sikkim',
      'Arunachal Pradesh', 'Assam', 'Manipur', 'Nagaland', 'Gujarat'
    ].includes(state);
    const quakeProb = isSeismicZone ? 0.35 : 0.08;

    if (quakeProb >= 0.2) {
      predictions.push({
        id: `ai-pred-quake-${Date.now()}`,
        title: `Seismic Activity Risk – ${state}`,
        type: 'earthquake',
        severity: quakeProb > 0.3 ? 'medium' : 'low',
        location: { lat, lng, name: state },
        time: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        description: `Probability: ${(quakeProb * 100).toFixed(0)}% | Located in a high seismicity zone (Zone IV/V).`,
        isPrediction: true,
        probability: quakeProb,
        confidence: 0.55,
        timeframeDays: 7,
      } as any);
    }

    // ── Heatwave risk ────────────────────────────────────────────────────────
    const isHeatSeason = month >= 3 && month <= 6;
    const temperature = weather?.temperature ?? 25;
    const isHotRegion = ['Rajasthan', 'Gujarat', 'Madhya Pradesh', 'Uttar Pradesh', 'Delhi', 'Telangana', 'Andhra Pradesh'].includes(state);

    let heatProb = 0;
    if (isHeatSeason && isHotRegion) heatProb += 0.45;
    if (temperature > 40) heatProb += 0.3;
    else if (temperature > 35) heatProb += 0.15;
    heatProb = Math.min(heatProb, 0.9);

    if (heatProb >= 0.3) {
      const severity: 'low' | 'medium' | 'high' = heatProb > 0.65 ? 'high' : heatProb > 0.45 ? 'medium' : 'low';
      predictions.push({
        id: `ai-pred-heat-${Date.now()}`,
        title: `Heatwave Risk – ${state}`,
        type: 'fire',
        severity,
        location: { lat, lng, name: state },
        time: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(),
        description: `Probability: ${(heatProb * 100).toFixed(0)}% | Current temp ${temperature}°C. High heat risk during pre-monsoon season.`,
        isPrediction: true,
        probability: heatProb,
        confidence: 0.78,
        timeframeDays: 2,
      } as any);
    }
    return predictions;
  } catch (error) {
    console.error('❌ Error generating predictions:', error);
    return [];
  }
};

// ── IMD Cyclone / Disaster Bulletin RSS Feed ──────────────────────────────────
export interface IMDAlert {
  title: string;
  description: string;
  pubDate: string;
  link: string;
  keywords: string[];
}

/**
 * Fetches the IMD Forecast & Warnings RSS feed and returns entries matching
 * cyclone / flood / storm / depression keywords.
 * Falls back silently on CORS/network failure — the rest of the pipeline still runs.
 */
export const fetchIMDCycloneAlerts = async (): Promise<IMDAlert[]> => {
  const IMD_RSS_URLS = [
    'https://rss.imd.gov.in/rss/fwr.xml',
    'https://mausam.imd.gov.in/rss/fwr.xml',
  ];
  const DISASTER_KEYWORDS = [
    'cyclone', 'storm', 'depression', 'warning', 'flood',
    'heavy rain', 'thunderstorm', 'hailstorm', 'heat wave',
  ];

  for (const url of IMD_RSS_URLS) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
      if (!res.ok) continue;
      const text = await res.text();
      const parser = new DOMParser();
      const xml = parser.parseFromString(text, 'application/xml');
      const items = Array.from(xml.querySelectorAll('item'));

      const alerts: IMDAlert[] = [];
      for (const item of items) {
        const title = item.querySelector('title')?.textContent || '';
        const description = item.querySelector('description')?.textContent || '';
        const pubDate = item.querySelector('pubDate')?.textContent || new Date().toISOString();
        const link = item.querySelector('link')?.textContent || 'https://mausam.imd.gov.in';
        const combined = (title + ' ' + description).toLowerCase();
        const matched = DISASTER_KEYWORDS.filter(k => combined.includes(k));

        if (matched.length > 0) {
          alerts.push({ title, description, pubDate, link, keywords: matched });
        }
      }
      return alerts;
    } catch (err) {
      // CORS or network error — try next mirror
      console.warn('IMD RSS fetch failed (CORS or network):', err);
    }
  }
  return [];
};

// ── Air Quality Index via Open-Meteo AQI (free, no key) ───────────────────────
export interface AQIData {
  pm2_5: number;
  pm10: number;
  us_aqi: number;
  european_aqi: number;
}

/**
 * Fetches current air quality at user coordinates using the Open-Meteo
 * Air Quality API. Free, no API key required. Fails silently on error.
 */
export const fetchAirQualityData = async (lat: number, lng: number): Promise<AQIData | null> => {
  try {
    const params = new URLSearchParams({
      latitude: lat.toString(),
      longitude: lng.toString(),
      current: 'pm2_5,pm10,us_aqi,european_aqi',
      timezone: 'auto',
    });
    const res = await fetch(
      `https://air-quality-api.open-meteo.com/v1/air-quality?${params}`,
      { signal: AbortSignal.timeout(6000) }
    );
    if (!res.ok) return null;
    const data = await res.json();
    const c = data.current;
    if (!c) return null;
    return {
      pm2_5: c.pm2_5 ?? 0,
      pm10: c.pm10 ?? 0,
      us_aqi: c.us_aqi ?? 0,
      european_aqi: c.european_aqi ?? 0,
    };
  } catch (err) {
    console.warn('AQI fetch failed:', err);
    return null;
  }
};
