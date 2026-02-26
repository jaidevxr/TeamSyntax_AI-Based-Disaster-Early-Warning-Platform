import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Location } from '@/types';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import {
  AlertTriangle, ShieldAlert, Info, Bell, BellRing,
  Droplets, Mountain, Thermometer, Wind, CloudLightning,
  ChevronDown, ChevronUp, RefreshCw, Clock, Database,
  Zap, CheckCircle2, Loader2, XCircle, ArrowRight,
  BellOff, BellPlus, Snowflake, Leaf, TrendingUp, TrendingDown, Minus
} from 'lucide-react';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { toast } from 'sonner';
import {
  isPushSupported,
  getNotificationPermission,
  requestNotificationPermission,
  sendEmergencyNotification,
  shouldNotify,
} from '@/utils/pushNotifications';
import { addAlertToHistory } from '@/components/NotificationHistory';
import {
  fetchIMDCycloneAlerts,
  fetchAirQualityData,
  getIndianState,
} from '@/utils/api';

interface EarlyAlert {
  id: string;
  type: string;
  severity: 'advisory' | 'watch' | 'warning' | 'emergency';
  title: string;
  description: string;
  source: string;
  algorithm: string;
  dataPoints: Record<string, any>;
  location: { lat: number; lng: number; name?: string };
  issuedAt: string;
  expiresAt: string;
  confidence: number;
}

interface AlertMetadata {
  sources: string[];
  generatedAt: string;
  algorithmsUsed: string[];
  calculationSteps?: CalculationStep[];
}

interface CalculationStep {
  step: number;
  source: string;
  algorithm: string;
  status: 'success' | 'failed' | 'no_alert';
  duration_ms: number;
  rawData?: Record<string, any>;
  result?: string;
  thresholds?: Record<string, any>;
}

interface EarlyAlertsProps {
  userLocation: Location | null;
}

type CalcPhase =
  | 'idle'
  | 'fetching_weather'
  | 'fetching_precipitation'
  | 'fetching_seismic'
  | 'fetching_gdacs'
  | 'fetching_aqi'
  | 'fetching_imd'
  | 'analyzing'
  | 'done';

const PHASES: { key: CalcPhase; label: string; icon: React.ReactNode; source: string }[] = [
  { key: 'fetching_weather', label: 'Fetching weather data', icon: <Thermometer className="h-4 w-4" />, source: 'Open-Meteo API' },
  { key: 'fetching_precipitation', label: 'Fetching precipitation forecast', icon: <Droplets className="h-4 w-4" />, source: 'Open-Meteo API' },
  { key: 'fetching_seismic', label: 'Querying seismic activity', icon: <Mountain className="h-4 w-4" />, source: 'USGS FDSNWS' },
  { key: 'fetching_gdacs', label: 'Checking global alerts', icon: <AlertTriangle className="h-4 w-4" />, source: 'GDACS' },
  { key: 'fetching_aqi', label: 'Measuring air quality', icon: <Leaf className="h-4 w-4" />, source: 'Open-Meteo AQI' },
  { key: 'fetching_imd', label: 'Reading IMD bulletins', icon: <Bell className="h-4 w-4" />, source: 'IMD RSS' },
  { key: 'analyzing', label: 'Running detection algorithms', icon: <Zap className="h-4 w-4" />, source: 'IMD + Steadman + Bath\'s Law' },
];

const EarlyAlerts: React.FC<EarlyAlertsProps> = ({ userLocation }) => {
  const [alerts, setAlerts] = useState<EarlyAlert[]>([]);
  const [metadata, setMetadata] = useState<AlertMetadata | null>(null);
  const [loading, setLoading] = useState(false);
  const [expandedAlerts, setExpandedAlerts] = useState<Set<string>>(new Set());
  const [showSources, setShowSources] = useState(false);
  const [showCalcSteps, setShowCalcSteps] = useState(false);
  const [lastFetched, setLastFetched] = useState<Date | null>(null);
  const [currentPhase, setCurrentPhase] = useState<CalcPhase>('idle');
  const [completedPhases, setCompletedPhases] = useState<Set<CalcPhase>>(new Set());
  const [calcProgress, setCalcProgress] = useState(0);
  const [notifPermission, setNotifPermission] = useState<string>('default');
  const phaseTimerRef = useRef<NodeJS.Timeout | null>(null);
  // Track previous alert ids+severity to compute trend badges
  const previousAlertsRef = useRef<Map<string, EarlyAlert['severity']>>(new Map());

  // Check notification permission on mount
  useEffect(() => {
    setNotifPermission(getNotificationPermission());
  }, []);

  const handleEnableNotifications = async () => {
    const perm = await requestNotificationPermission();
    setNotifPermission(perm);
    if (perm === 'granted') {
      toast.success('Notifications enabled!', { description: 'You\'ll receive alerts for emergency warnings.' });
    } else if (perm === 'denied') {
      toast.error('Notifications blocked', { description: 'Enable them in your browser settings.' });
    }
  };

  // Send push notifications and save to history for emergency/warning alerts
  const notifyForAlerts = useCallback((newAlerts: EarlyAlert[]) => {
    const criticalAlerts = newAlerts.filter(
      a => (a.severity === 'emergency' || a.severity === 'warning') && shouldNotify(a.id)
    );

    for (const alert of criticalAlerts) {
      const cleanTitle = alert.title.replace(/[^\w\s—:.°,()/-]/g, '').trim();
      const body = alert.description.slice(0, 200);

      // Save to history
      addAlertToHistory({
        id: alert.id,
        title: cleanTitle,
        body,
        type: alert.type,
        severity: alert.severity,
        confidence: alert.confidence,
        locationName: userLocation?.name || undefined,
      });

      // Send push notification if permission granted
      if (getNotificationPermission() === 'granted') {
        sendEmergencyNotification({
          title: cleanTitle,
          body,
          type: alert.type,
          severity: alert.severity,
          confidence: alert.confidence,
        });
      }
    }
  }, [userLocation]);

  const simulatePhases = useCallback(() => {
    setCompletedPhases(new Set());
    setCalcProgress(0);

    const phaseKeys: CalcPhase[] = [
      'fetching_weather', 'fetching_precipitation', 'fetching_seismic',
      'fetching_gdacs', 'fetching_aqi', 'fetching_imd', 'analyzing',
    ];
    let idx = 0;

    const advancePhase = () => {
      if (idx < phaseKeys.length) {
        const currentKey = phaseKeys[idx];
        setCurrentPhase(currentKey);
        setCalcProgress(((idx + 1) / (phaseKeys.length + 1)) * 100);

        // Mark previous phase as completed
        if (idx > 0) {
          setCompletedPhases(prev => new Set([...prev, phaseKeys[idx - 1]]));
        }

        idx++;
        phaseTimerRef.current = setTimeout(advancePhase, 700 + Math.random() * 800);
      } else {
        // Mark the LAST phase (analyzing) as completed too — this was the bug
        setCompletedPhases(prev => new Set([...prev, phaseKeys[phaseKeys.length - 1]]));
        setCurrentPhase('done');
        setCalcProgress(100);
      }
    };

    advancePhase();
  }, []);


  // ── Severity order helper (for trend comparison) ────────────────────────
  const severityRank = (s: EarlyAlert['severity']) =>
    ({ advisory: 0, watch: 1, warning: 2, emergency: 3 }[s] ?? 0);

  // Build a stable "type key" for cross-run comparison (same disaster type ≈ same ID)
  const alertTypeKey = (a: EarlyAlert) => a.type;

  const fetchAlerts = useCallback(async () => {
    if (!userLocation) return;
    setLoading(true);
    simulatePhases();

    const { lat, lng } = userLocation;
    const generatedAlerts: EarlyAlert[] = [];
    const calcSteps: CalculationStep[] = [];
    const now = Date.now();
    const state = getIndianState(lat, lng, userLocation.name || '');

    try {
      // ── Step 1: Open-Meteo weather + precipitation ──────────────────────────
      let weather: any = null;
      const t1 = Date.now();
      try {
        const params = new URLSearchParams({
          latitude: lat.toString(), longitude: lng.toString(),
          current: 'temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m,surface_pressure,is_day',
          hourly: 'precipitation_probability,precipitation,wind_speed_10m',
          daily: 'precipitation_sum,temperature_2m_max,uv_index_max',
          timezone: 'auto', forecast_days: '3',
        });
        const res = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`);
        weather = await res.json();
      } catch { /* handled below */ }

      const temp = weather?.current?.temperature_2m ?? null;
      const humidity = weather?.current?.relative_humidity_2m ?? null;
      const feelsLike = weather?.current?.apparent_temperature ?? null;
      const windSpeed = weather?.current?.wind_speed_10m ?? null;
      const weatherCode = weather?.current?.weather_code ?? null;
      const rain1h = weather?.current?.precipitation ?? 0;
      const rain24h = weather?.daily?.precipitation_sum?.[0] ?? 0;
      const maxPrecipP = Math.max(...(weather?.hourly?.precipitation_probability?.slice(0, 24) ?? [0]));

      calcSteps.push({
        step: 1, source: 'Open-Meteo API',
        algorithm: 'IMD rainfall thresholds: heavy rain >64.5 mm/day, extreme >204.4 mm/day. Steadman apparent temperature for heat index. IMD cold wave: <10°C plains. Cyclone: wind >62 km/h.',
        status: weather ? (rain24h > 64.5 || (temp !== null && temp > 40) || (temp !== null && temp < 10) || (windSpeed !== null && windSpeed > 62) ? 'success' : 'no_alert') : 'failed',
        duration_ms: Date.now() - t1,
        rawData: { temp_c: temp, humidity_pct: humidity, feels_like: feelsLike, wind_kmh: windSpeed, rain_1h_mm: rain1h, rain_24h_mm: rain24h, precip_prob_max: maxPrecipP, weather_code: weatherCode },
        thresholds: { heavy_rain_mm: 64.5, extreme_rain_mm: 204.4, heat_temp_c: 40, cold_wave_c: 10, cyclone_wind_kmh: 62 },
        result: weather ? `Temp ${temp}°C, Rain 24h: ${rain24h}mm, Wind: ${windSpeed}km/h` : 'Fetch failed',
      });

      // Flood / Heavy Rain alert
      if (rain24h >= 64.5 || maxPrecipP >= 70) {
        const sev: EarlyAlert['severity'] = rain24h >= 204.4 ? 'emergency' : rain24h >= 115.5 ? 'warning' : 'watch';
        generatedAlerts.push({
          id: `flood-${now}`,
          type: 'flood',
          severity: sev,
          title: rain24h >= 115.5 ? 'Heavy to Very Heavy Rainfall Warning' : 'Heavy Rainfall Watch',
          description: `Accumulated rainfall of ${rain24h.toFixed(1)} mm in 24 h exceeds IMD heavy-rain threshold (64.5 mm). Precipitation probability up to ${maxPrecipP}%. Flash flooding possible in low-lying areas.`,
          source: 'Open-Meteo + IMD Thresholds',
          algorithm: 'IMD heavy rain classification: 64.5–115.5 mm = heavy, 115.5–204.4 mm = very heavy, >204.4 mm = extremely heavy.',
          dataPoints: { rain_24h_mm: rain24h, precip_probability_max: maxPrecipP, threshold_mm: 64.5 },
          location: { lat, lng, name: userLocation.name },
          issuedAt: new Date(now).toISOString(),
          expiresAt: new Date(now + 6 * 3600000).toISOString(),
          confidence: Math.min(0.95, 0.6 + rain24h / 300),
        });
      }

      // Heatwave alert (IMD: ≥40°C plains or feels-like ≥45°C)
      if (temp !== null && humidity !== null && (temp >= 40 || (feelsLike !== null && feelsLike >= 45))) {
        const sev: EarlyAlert['severity'] = temp >= 45 ? 'emergency' : temp >= 42 ? 'warning' : 'watch';
        generatedAlerts.push({
          id: `heat-${now}`,
          type: 'heatwave',
          severity: sev,
          title: temp >= 45 ? 'Severe Heatwave Warning' : 'Heatwave Watch',
          description: `Temperature ${temp}°C (feels like ${feelsLike?.toFixed(1)}°C) with ${humidity}% humidity. IMD heat-warning criterion met. Risk of heat exhaustion/stroke for vulnerable groups.`,
          source: 'Open-Meteo + Steadman Heat Index',
          algorithm: 'Steadman (1979) apparent temperature combined with IMD heatwave criteria: plains ≥40°C or departure from normal ≥4.5°C.',
          dataPoints: { temp_c: temp, feels_like_c: feelsLike, humidity_pct: humidity, wind_kmh: windSpeed },
          location: { lat, lng, name: userLocation.name },
          issuedAt: new Date(now).toISOString(),
          expiresAt: new Date(now + 12 * 3600000).toISOString(),
          confidence: Math.min(0.95, 0.65 + (temp - 40) / 20),
        });
      }

      // ── NEW: Cold Wave / Dense Fog alert ────────────────────────────────────
      const isFogCode = weatherCode === 45 || weatherCode === 48;
      if (temp !== null && (temp <= 10 || (feelsLike !== null && feelsLike <= 6) || isFogCode)) {
        const sev: EarlyAlert['severity'] = temp <= 4 ? 'emergency' : temp <= 7 ? 'warning' : 'watch';
        const isFog = isFogCode && temp > 10;
        generatedAlerts.push({
          id: `coldwave-${now}`,
          type: 'cold_wave',
          severity: sev,
          title: isFog ? 'Dense Fog Advisory' : temp <= 7 ? 'Cold Wave Warning' : 'Cold Wave Watch',
          description: isFog
            ? `Dense fog (WMO code ${weatherCode}) detected. Visibility severely reduced. Hazardous driving conditions.`
            : `Temperature ${temp}°C (feels like ${feelsLike?.toFixed(1)}°C). IMD cold wave criterion met (≤10°C plains). Risk of frost, hypothermia, and transport disruptions.`,
          source: 'Open-Meteo + IMD Cold Wave Criteria',
          algorithm: 'IMD cold wave: plains temp ≤10°C; severe cold wave ≤4°C. Dense fog: WMO weather codes 45/48.',
          dataPoints: { temp_c: temp, feels_like_c: feelsLike, weather_code: weatherCode, humidity_pct: humidity },
          location: { lat, lng, name: userLocation.name },
          issuedAt: new Date(now).toISOString(),
          expiresAt: new Date(now + 12 * 3600000).toISOString(),
          confidence: Math.min(0.92, 0.68 + (10 - (temp ?? 10)) / 20),
        });
      }

      // ── NEW: Cyclone / High Wind alert ──────────────────────────────────────
      if (windSpeed !== null && windSpeed >= 62) {
        const sev: EarlyAlert['severity'] = windSpeed >= 117 ? 'emergency' : windSpeed >= 88 ? 'warning' : 'watch';
        const label = windSpeed >= 117 ? 'Very Severe Cyclonic Storm' : windSpeed >= 88 ? 'Severe Cyclonic Storm' : 'Cyclonic Storm Watch';
        generatedAlerts.push({
          id: `cyclone-wind-${now}`,
          type: 'cyclone',
          severity: sev,
          title: label,
          description: `Wind speed of ${windSpeed.toFixed(0)} km/h detected. IMD cyclone intensity scale: Gale-force winds (≥62) indicate potential cyclonic conditions. Secure loose structures and avoid coastal areas.`,
          source: 'Open-Meteo + IMD Cyclone Intensity Scale',
          algorithm: 'IMD cyclone scale: 62–88 km/h = Cyclonic Storm, 88–117 = Severe, ≥117 = Very Severe. Sustained wind speed trigger.',
          dataPoints: { wind_speed_kmh: windSpeed, threshold_kmh: 62, state },
          location: { lat, lng, name: userLocation.name },
          issuedAt: new Date(now).toISOString(),
          expiresAt: new Date(now + 6 * 3600000).toISOString(),
          confidence: Math.min(0.90, 0.60 + (windSpeed - 62) / 100),
        });
      }

      // ── NEW: Landslide risk (hilly states + heavy rain) ─────────────────────
      const hilly_states = [
        'Uttarakhand', 'Himachal Pradesh', 'Jammu and Kashmir', 'Ladakh',
        'Sikkim', 'Arunachal Pradesh', 'Manipur', 'Meghalaya', 'Nagaland',
        'Mizoram', 'Kerala', 'Goa',
      ];
      const isHillyState = hilly_states.includes(state);
      if (isHillyState && rain24h >= 50) {
        let landslideRisk = 0;
        if (rain24h >= 50) landslideRisk += 0.5;
        if (rain24h >= 115) landslideRisk += 0.3;
        landslideRisk = Math.min(landslideRisk, 0.95);
        const sev: EarlyAlert['severity'] = landslideRisk >= 0.8 ? 'warning' : 'watch';
        generatedAlerts.push({
          id: `landslide-${now}`,
          type: 'landslide',
          severity: sev,
          title: sev === 'warning' ? 'Landslide Warning' : 'Landslide Watch',
          description: `State: ${state}. Rainfall ${rain24h.toFixed(1)} mm/24h in a hilly region triggers landslide risk score ${(landslideRisk * 100).toFixed(0)}%. Avoid hill slopes, river banks, and unstable terrain.`,
          source: 'Open-Meteo + IMD Landslide Risk Model',
          algorithm: 'Landslide risk = heavy rain (>50 mm) × hilly terrain flag. Risk elevated at >115 mm. Based on NDMA landslide susceptibility zones.',
          dataPoints: { rain_24h_mm: rain24h, landslide_risk_score: landslideRisk, state, is_hilly: isHillyState },
          location: { lat, lng, name: userLocation.name },
          issuedAt: new Date(now).toISOString(),
          expiresAt: new Date(now + 12 * 3600000).toISOString(),
          confidence: Math.min(0.85, 0.55 + rain24h / 300),
        });
      }

      // ── Step 2: USGS seismic (last 7 days, M≥3, within 300 km) ─────────────
      const t2 = Date.now();
      let quakeCount = 0;
      let maxMag = 0;
      try {
        const sevenDaysAgo = new Date(now - 7 * 86400000).toISOString();
        const seisUrl = `https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson&starttime=${sevenDaysAgo}&minmagnitude=3&maxradiuskm=300&latitude=${lat}&longitude=${lng}&orderby=magnitude`;
        const sRes = await fetch(seisUrl);
        const sData = await sRes.json();
        const features = sData.features ?? [];
        quakeCount = features.length;
        maxMag = features.reduce((m: number, f: any) => Math.max(m, f.properties?.mag ?? 0), 0);

        if (maxMag >= 5.0) {
          const sev: EarlyAlert['severity'] = maxMag >= 6.5 ? 'emergency' : maxMag >= 5.5 ? 'warning' : 'watch';
          generatedAlerts.push({
            id: `quake-${now}`,
            type: 'earthquake',
            severity: sev,
            title: `M${maxMag.toFixed(1)} Seismic Activity Nearby`,
            description: `${quakeCount} earthquake(s) (M≥3) detected within 300 km in the last 7 days. Largest: M${maxMag.toFixed(1)}. Bath's Law suggests aftershocks up to M${(maxMag - 1.2).toFixed(1)} are possible.`,
            source: 'USGS FDSNWS',
            algorithm: "Bath's Law: largest aftershock ≈ mainshock − 1.2 magnitude. Alert triggered for M≥5.0 within 300 km.",
            dataPoints: { max_magnitude: maxMag, event_count_7d: quakeCount, radius_km: 300 },
            location: { lat, lng, name: userLocation.name },
            issuedAt: new Date(now).toISOString(),
            expiresAt: new Date(now + 24 * 3600000).toISOString(),
            confidence: Math.min(0.9, 0.55 + (maxMag - 5) / 5),
          });
        }
      } catch { /* non-fatal */ }

      calcSteps.push({
        step: 2, source: 'USGS FDSNWS',
        algorithm: "Bath's Law: largest aftershock is mainshock − 1.2 magnitude. Alert if M≥5.0 within 300 km in 7 days.",
        status: maxMag >= 5.0 ? 'success' : 'no_alert',
        duration_ms: Date.now() - t2,
        rawData: { events_within_300km_7d: quakeCount, max_magnitude: maxMag },
        thresholds: { min_alert_magnitude: 5.0, radius_km: 300 },
        result: quakeCount > 0 ? `${quakeCount} event(s), max M${maxMag.toFixed(1)}` : 'No significant seismic activity',
      });

      // ── Landslide boost if recent quake in hilly area ───────────────────────
      if (isHillyState && quakeCount > 0 && rain24h >= 30) {
        const existing = generatedAlerts.find(a => a.id === `landslide-${now}`);
        if (existing) {
          existing.confidence = Math.min(0.95, existing.confidence + 0.10);
          existing.description += ` Recent seismic activity (${quakeCount} event(s)) further elevates landslide risk.`;
        } else if (rain24h >= 30) {
          generatedAlerts.push({
            id: `landslide-${now}`,
            type: 'landslide',
            severity: 'watch',
            title: 'Landslide Watch (Seismic + Rain)',
            description: `${state}: Recent seismic activity combined with ${rain24h.toFixed(1)} mm rainfall increases landslide probability in hilly terrain.`,
            source: 'USGS FDSNWS + Open-Meteo',
            algorithm: 'Seismic loosening + rainfall saturation = elevated landslide risk in hilly NDMA zones.',
            dataPoints: { quake_events: quakeCount, rain_24h_mm: rain24h, state },
            location: { lat, lng, name: userLocation.name },
            issuedAt: new Date(now).toISOString(),
            expiresAt: new Date(now + 24 * 3600000).toISOString(),
            confidence: 0.60,
          });
        }
      }

      // ── Step 3: GDACS (Orange/Red within ~400 km) ──────────────────────────
      const t3 = Date.now();
      let gdacsCount = 0;
      try {
        const gdacsRes = await fetch('https://www.gdacs.org/gdacsapi/api/events/geteventlist/SEARCH?fromDate=' +
          new Date(now - 30 * 86400000).toISOString().split('T')[0] +
          '&toDate=' + new Date(now).toISOString().split('T')[0] +
          '&alertlevel=Orange;Red');
        const gdacsData = await gdacsRes.json();
        const events = gdacsData.features ?? [];

        for (const evt of events) {
          const [eLng, eLat] = evt.geometry?.coordinates ?? [0, 0];
          const dLat = (eLat - lat) * Math.PI / 180;
          const dLon = (eLng - lng) * Math.PI / 180;
          const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat * Math.PI / 180) * Math.cos(eLat * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
          const dist = 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
          if (dist > 400) continue;
          gdacsCount++;

          const p = evt.properties ?? {};
          const sev: EarlyAlert['severity'] = (p.alertlevel ?? '').toLowerCase().includes('red') ? 'warning' : 'watch';
          const evtType = (p.eventtype ?? '').toLowerCase();
          const alertType = evtType.includes('fl') ? 'flood' : evtType.includes('tc') ? 'cyclone' : evtType.includes('eq') ? 'earthquake' : evtType.includes('vo') ? 'fire' : 'flood';

          // ── Multi-source confidence fusion ──────────────────────────────────
          // If same type already exists from weather/seismic, boost confidence instead of adding a duplicate
          const existingIdx = generatedAlerts.findIndex(a => a.type === alertType && !a.id.startsWith('gdacs-'));
          if (existingIdx !== -1) {
            const existing = generatedAlerts[existingIdx];
            existing.confidence = Math.min(0.98, existing.confidence + 0.10);
            existing.source = existing.source + ' + GDACS';
            existing.description += ` GDACS ${p.alertlevel} alert ~${Math.round(dist)} km away corroborates this warning.`;
            continue;
          }

          generatedAlerts.push({
            id: `gdacs-${p.eventid ?? Math.random()}-${now}`,
            type: alertType,
            severity: sev,
            title: `GDACS ${p.alertlevel} Alert: ${p.name ?? alertType}`,
            description: `Global Disaster Alert and Coordination System issued a ${p.alertlevel} alert for ${p.name ?? 'an event'} approximately ${Math.round(dist)} km from your location.`,
            source: 'GDACS',
            algorithm: 'GDACS automated scoring using event intensity, exposed population, and vulnerability indices.',
            dataPoints: { distance_km: Math.round(dist), alert_level: p.alertlevel, event_type: p.eventtype },
            location: { lat, lng, name: userLocation.name },
            issuedAt: p.fromdate ?? new Date(now).toISOString(),
            expiresAt: p.todate ?? new Date(now + 48 * 3600000).toISOString(),
            confidence: sev === 'warning' ? 0.80 : 0.65,
          });
        }
      } catch { /* non-fatal */ }

      calcSteps.push({
        step: 3, source: 'GDACS',
        algorithm: 'Orange/Red alerts within 400 km. Multi-source fusion: if same alert type already exists from weather/seismic, confidence is boosted by +10% instead of creating a duplicate.',
        status: gdacsCount > 0 ? 'success' : 'no_alert',
        duration_ms: Date.now() - t3,
        rawData: { alerts_within_400km: gdacsCount },
        thresholds: { radius_km: 400, min_level: 'Orange' },
        result: gdacsCount > 0 ? `${gdacsCount} GDACS alert(s) nearby` : 'No GDACS alerts nearby',
      });

      // ── Step 4: AQI (Open-Meteo Air Quality API) ───────────────────────────
      const t4 = Date.now();
      let aqiData: any = null;
      try {
        aqiData = await fetchAirQualityData(lat, lng);
        // NAAQS: PM2.5 24h standard = 60 µg/m³; US AQI >150 = Unhealthy
        if (aqiData && (aqiData.pm2_5 > 60 || aqiData.us_aqi > 150)) {
          const sev: EarlyAlert['severity'] = aqiData.us_aqi > 300 ? 'emergency' : aqiData.us_aqi > 200 ? 'warning' : 'watch';
          generatedAlerts.push({
            id: `aqi-${now}`,
            type: 'air_quality',
            severity: sev,
            title: aqiData.us_aqi > 200 ? 'Very Unhealthy Air Quality Warning' : 'Unhealthy Air Quality Alert',
            description: `PM2.5: ${aqiData.pm2_5.toFixed(1)} µg/m³, PM10: ${aqiData.pm10.toFixed(1)} µg/m³, US AQI: ${aqiData.us_aqi}. NAAQS 24h PM2.5 standard (60 µg/m³) exceeded. Vulnerable groups should avoid outdoor activity.`,
            source: 'Open-Meteo Air Quality API + NAAQS',
            algorithm: 'India NAAQS 24h PM2.5 standard: 60 µg/m³. US EPA AQI >150 = Unhealthy, >200 = Very Unhealthy, >300 = Hazardous.',
            dataPoints: { pm2_5: aqiData.pm2_5, pm10: aqiData.pm10, us_aqi: aqiData.us_aqi, european_aqi: aqiData.european_aqi },
            location: { lat, lng, name: userLocation.name },
            issuedAt: new Date(now).toISOString(),
            expiresAt: new Date(now + 6 * 3600000).toISOString(),
            confidence: Math.min(0.92, 0.70 + aqiData.us_aqi / 1000),
          });
        }
      } catch { /* non-fatal */ }

      calcSteps.push({
        step: 4, source: 'Open-Meteo AQI',
        algorithm: 'India NAAQS: PM2.5 >60 µg/m³ triggers alert. US AQI >150=Unhealthy, >200=Very Unhealthy, >300=Hazardous.',
        status: aqiData && (aqiData.pm2_5 > 60 || aqiData.us_aqi > 150) ? 'success' : 'no_alert',
        duration_ms: Date.now() - t4,
        rawData: aqiData ? { pm2_5: aqiData.pm2_5, pm10: aqiData.pm10, us_aqi: aqiData.us_aqi } : {},
        thresholds: { pm2_5_naaqs: 60, us_aqi_unhealthy: 150 },
        result: aqiData ? `PM2.5: ${aqiData.pm2_5.toFixed(1)} µg/m³, AQI: ${aqiData.us_aqi}` : 'AQI fetch failed',
      });

      // ── Step 5: IMD RSS Bulletin ────────────────────────────────────────────
      const t5 = Date.now();
      let imdCount = 0;
      try {
        const imdAlerts = await fetchIMDCycloneAlerts();
        imdCount = imdAlerts.length;
        for (const bulletin of imdAlerts.slice(0, 3)) { // cap at 3 bulletins
          const isCyclone = bulletin.keywords.some(k => ['cyclone', 'storm', 'depression'].includes(k));
          const isFlood = bulletin.keywords.includes('flood') || bulletin.keywords.includes('heavy rain');
          const alertType = isCyclone ? 'cyclone' : isFlood ? 'flood' : 'storm';
          // Check for fusion — boost existing if same type
          const existingIdx = generatedAlerts.findIndex(a => a.type === alertType && !a.id.startsWith('imd-'));
          if (existingIdx !== -1) {
            generatedAlerts[existingIdx].confidence = Math.min(0.98, generatedAlerts[existingIdx].confidence + 0.08);
            generatedAlerts[existingIdx].source += ' + IMD Bulletin';
            continue;
          }
          generatedAlerts.push({
            id: `imd-${now}-${imdCount}`,
            type: alertType,
            severity: 'warning',
            title: `IMD Bulletin: ${bulletin.title.slice(0, 80)}`,
            description: bulletin.description.replace(/<[^>]*>/g, '').slice(0, 300),
            source: 'India Meteorological Department (IMD)',
            algorithm: 'IMD official forecast and warning RSS feed — authoritative government source.',
            dataPoints: { keywords: bulletin.keywords.join(', '), pub_date: bulletin.pubDate },
            location: { lat, lng, name: userLocation.name },
            issuedAt: new Date(bulletin.pubDate).toISOString(),
            expiresAt: new Date(now + 24 * 3600000).toISOString(),
            confidence: 0.88,
          });
        }
      } catch { /* non-fatal */ }

      calcSteps.push({
        step: 5, source: 'IMD RSS Feed',
        algorithm: 'India Meteorological Department official Forecast & Warnings RSS. Parses cyclone, storm, depression, flood keywords.',
        status: imdCount > 0 ? 'success' : 'no_alert',
        duration_ms: Date.now() - t5,
        rawData: { bulletins_matched: imdCount },
        thresholds: { keywords: 'cyclone, storm, depression, flood, heavy rain' },
        result: imdCount > 0 ? `${imdCount} IMD bulletin(s) matched` : 'No active IMD bulletins',
      });

      // ── Finalize ──────────────────────────────────────────────────────────
      if (phaseTimerRef.current) clearTimeout(phaseTimerRef.current);
      setCompletedPhases(new Set(PHASES.map(p => p.key)));
      setCurrentPhase('done');
      setCalcProgress(100);

      setAlerts(generatedAlerts);
      // Store current alert types+severity for next run trend comparison
      previousAlertsRef.current = new Map(generatedAlerts.map(a => [alertTypeKey(a), a.severity]));
      setMetadata({
        sources: ['Open-Meteo API', 'Open-Meteo AQI', 'USGS FDSNWS', 'GDACS', 'IMD RSS'],
        generatedAt: new Date(now).toISOString(),
        algorithmsUsed: ["IMD Rainfall Thresholds", "Steadman Heat Index", "IMD Cold Wave Criteria", "IMD Cyclone Scale", "Bath's Law", "GDACS Scoring", "NDMA Landslide Risk", "NAAQS AQI"],
        calculationSteps: calcSteps,
      });
      setLastFetched(new Date());
      notifyForAlerts(generatedAlerts);
    } catch (err) {
      console.error('Failed to generate early alerts:', err);
      if (phaseTimerRef.current) clearTimeout(phaseTimerRef.current);
      setCurrentPhase('done');
      setCalcProgress(100);
    } finally {
      setLoading(false);
    }
  }, [userLocation, simulatePhases, notifyForAlerts]);

  useEffect(() => {
    fetchAlerts();
    const interval = setInterval(fetchAlerts, 10 * 60 * 1000);
    return () => {
      clearInterval(interval);
      if (phaseTimerRef.current) clearTimeout(phaseTimerRef.current);
    };
  }, [fetchAlerts]);

  const toggleExpand = (id: string) => {
    setExpandedAlerts(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'flood': return <Droplets className="h-5 w-5" />;
      case 'earthquake': return <Mountain className="h-5 w-5" />;
      case 'heatwave': return <Thermometer className="h-5 w-5" />;
      case 'cold_wave': return <Thermometer className="h-5 w-5" />;
      case 'cyclone': return <Wind className="h-5 w-5" />;
      case 'thunderstorm': return <CloudLightning className="h-5 w-5" />;
      default: return <AlertTriangle className="h-5 w-5" />;
    }
  };

  const getSeverityConfig = (severity: string) => {
    switch (severity) {
      case 'emergency':
        return {
          border: 'border-red-500/60',
          bg: 'bg-red-500/10',
          badge: 'bg-red-500 text-white',
          icon: <ShieldAlert className="h-5 w-5 text-red-500" />,
          glow: 'shadow-red-500/20 shadow-lg',
          label: 'EMERGENCY',
        };
      case 'warning':
        return {
          border: 'border-orange-500/60',
          bg: 'bg-orange-500/10',
          badge: 'bg-orange-500 text-white',
          icon: <AlertTriangle className="h-5 w-5 text-orange-500" />,
          glow: 'shadow-orange-500/15 shadow-md',
          label: 'WARNING',
        };
      case 'watch':
        return {
          border: 'border-yellow-500/60',
          bg: 'bg-yellow-500/10',
          badge: 'bg-yellow-500 text-black',
          icon: <Bell className="h-5 w-5 text-yellow-500" />,
          glow: '',
          label: 'WATCH',
        };
      default:
        return {
          border: 'border-blue-500/40',
          bg: 'bg-blue-500/5',
          badge: 'bg-blue-500 text-white',
          icon: <Info className="h-5 w-5 text-blue-500" />,
          glow: '',
          label: 'ADVISORY',
        };
    }
  };

  const getStepStatusConfig = (status: string) => {
    switch (status) {
      case 'success':
        return {
          icon: <AlertTriangle className="h-3.5 w-3.5 text-orange-500" />,
          label: 'Alert Triggered',
          badgeClass: 'bg-orange-500/15 text-orange-600 border-orange-500/30',
        };
      case 'failed':
        return {
          icon: <XCircle className="h-3.5 w-3.5 text-red-400" />,
          label: 'Fetch Failed',
          badgeClass: 'bg-red-500/15 text-red-500 border-red-500/30',
        };
      default:
        return {
          icon: <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />,
          label: 'All Clear',
          badgeClass: 'bg-green-500/15 text-green-600 border-green-500/30',
        };
    }
  };

  if (!userLocation) {
    return (
      <Card className="p-6 border-dashed border-muted-foreground/30">
        <div className="flex items-center gap-3 text-muted-foreground">
          <BellRing className="h-5 w-5" />
          <p className="text-sm">Enable location to receive early warnings for floods, earthquakes, and extreme weather.</p>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-3 sm:space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
          <Zap className="h-4 w-4 sm:h-5 sm:w-5 text-primary flex-shrink-0" />
          <h2 className="text-base sm:text-lg font-bold text-foreground truncate">Early Warnings</h2>
          {alerts.length > 0 && (
            <Badge variant="outline" className="ml-1 text-[10px] sm:text-xs flex-shrink-0">
              {alerts.length}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          {/* Notification toggle */}
          {isPushSupported() && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleEnableNotifications}
              className="h-8 gap-1.5 text-xs"
              title={notifPermission === 'granted' ? 'Notifications enabled' : 'Enable notifications'}
            >
              {notifPermission === 'granted' ? (
                <>
                  <Bell className="h-3.5 w-3.5 text-green-500" />
                  <span className="hidden sm:inline text-green-600">On</span>
                </>
              ) : notifPermission === 'denied' ? (
                <>
                  <BellOff className="h-3.5 w-3.5 text-red-400" />
                  <span className="hidden sm:inline text-red-400">Blocked</span>
                </>
              ) : (
                <>
                  <BellPlus className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="hidden sm:inline">Enable Alerts</span>
                </>
              )}
            </Button>
          )}
          {lastFetched && (
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {lastFetched.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={fetchAlerts}
            disabled={loading}
            className="h-8 w-8 p-0"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {/* Push notification prompt for new users */}
      {isPushSupported() && notifPermission === 'default' && !loading && (
        <Card className="p-3 border-primary/30 bg-primary/5">
          <div className="flex items-center gap-3">
            <BellRing className="h-5 w-5 text-primary flex-shrink-0" />
            <div className="flex-1">
              <p className="text-xs font-medium text-foreground">Enable Push Notifications</p>
              <p className="text-[11px] text-muted-foreground">Get alerted for emergencies even when the app is in the background.</p>
            </div>
            <Button size="sm" variant="default" onClick={handleEnableNotifications} className="text-xs h-7 px-3">
              Enable
            </Button>
          </div>
        </Card>
      )}

      {/* ═══ LIVE CALCULATION PROGRESS ═══ */}
      {loading && (
        <Card className="p-4 border-primary/30 bg-primary/5 space-y-3">
          <div className="flex items-center gap-2 mb-1">
            <Loader2 className="h-4 w-4 animate-spin text-primary" />
            <span className="text-sm font-semibold text-foreground">Calculating Early Warnings…</span>
            <span className="text-xs text-muted-foreground ml-auto">{Math.round(calcProgress)}%</span>
          </div>

          <Progress value={calcProgress} className="h-1.5" />

          <div className="space-y-2 mt-2">
            {PHASES.map((phase) => {
              const isCompleted = completedPhases.has(phase.key);
              const isActive = currentPhase === phase.key;

              return (
                <div
                  key={phase.key}
                  className={`flex items-center gap-2.5 py-1.5 px-2 rounded-md transition-all duration-300 ${isActive ? 'bg-primary/10 border border-primary/20' :
                    isCompleted ? 'opacity-70' : 'opacity-40'
                    }`}
                >
                  {isCompleted ? (
                    <CheckCircle2 className="h-4 w-4 text-green-500 flex-shrink-0" />
                  ) : isActive ? (
                    <Loader2 className="h-4 w-4 animate-spin text-primary flex-shrink-0" />
                  ) : (
                    <div className="h-4 w-4 rounded-full border border-muted-foreground/30 flex-shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <span className={`text-xs font-medium ${isActive ? 'text-foreground' : 'text-muted-foreground'}`}>
                      {phase.label}
                    </span>
                  </div>
                  <span className="text-[10px] text-muted-foreground font-mono flex-shrink-0">
                    {phase.source}
                  </span>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* No alerts */}
      {!loading && alerts.length === 0 && (
        <Card className="p-6 border-green-500/30 bg-green-500/5">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-full bg-green-500/20 flex items-center justify-center">
              <Bell className="h-4 w-4 text-green-500" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">All Clear</p>
              <p className="text-xs text-muted-foreground">No active warnings for your area. Data from USGS, OpenWeather, Open-Meteo, and GDACS.</p>
            </div>
          </div>
        </Card>
      )}

      {/* Alert Cards */}
      {alerts.map((alert) => {
        const config = getSeverityConfig(alert.severity);
        const isExpanded = expandedAlerts.has(alert.id);

        return (
          <Card
            key={alert.id}
            className={`overflow-hidden ${config.border} ${config.bg} ${config.glow} transition-all duration-200`}
          >
            <div
              className="p-4 cursor-pointer"
              onClick={() => toggleExpand(alert.id)}
            >
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 mt-0.5">
                  {getTypeIcon(alert.type)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className={`text-xs font-bold px-2 py-0.5 rounded ${config.badge}`}>
                      {config.label}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      Confidence: {(alert.confidence * 100).toFixed(0)}%
                    </span>
                  </div>
                  <h3 className="text-sm font-semibold text-foreground leading-tight">
                    {alert.title}
                  </h3>
                  <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                    {alert.description}
                  </p>
                </div>
                <div className="flex-shrink-0">
                  {isExpanded ? (
                    <ChevronUp className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  )}
                </div>
              </div>
            </div>

            {isExpanded && (
              <div className="px-4 pb-4 border-t border-border/30 pt-3 space-y-3">
                <p className="text-sm text-foreground">{alert.description}</p>

                {/* Algorithm details */}
                <div className="bg-background/50 rounded-lg p-3 space-y-2">
                  <div className="flex items-center gap-1.5">
                    <Database className="h-3.5 w-3.5 text-primary" />
                    <span className="text-xs font-semibold text-foreground">How This Was Calculated</span>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">{alert.algorithm}</p>
                </div>

                {/* Data points */}
                <div className="bg-background/50 rounded-lg p-3">
                  <span className="text-xs font-semibold text-foreground block mb-1.5">Raw Data Points</span>
                  <div className="grid grid-cols-2 gap-1.5">
                    {Object.entries(alert.dataPoints).map(([key, value]) => (
                      <div key={key} className="text-xs">
                        <span className="text-muted-foreground">{key}: </span>
                        <span className="font-mono text-foreground">
                          {typeof value === 'number' ? value.toFixed(2) : JSON.stringify(value)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Source & time */}
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>Source: {alert.source}</span>
                  <span>Expires: {new Date(alert.expiresAt).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}</span>
                </div>
              </div>
            )}
          </Card>
        );
      })}

      {/* ═══ CALCULATION BREAKDOWN (always visible after load) ═══ */}
      {!loading && metadata?.calculationSteps && metadata.calculationSteps.length > 0 && (
        <Collapsible open={showCalcSteps} onOpenChange={setShowCalcSteps} defaultOpen>
          <CollapsibleTrigger asChild>
            <Button variant="outline" size="sm" className="w-full text-xs gap-1.5 border-border/50">
              <Zap className="h-3.5 w-3.5 text-primary" />
              Calculation Breakdown — {metadata.calculationSteps.length} steps
              {showCalcSteps ? <ChevronUp className="h-3 w-3 ml-auto" /> : <ChevronDown className="h-3 w-3 ml-auto" />}
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="mt-2 space-y-2">
              {metadata.calculationSteps.map((step, i) => {
                const statusConfig = getStepStatusConfig(step.status);
                return (
                  <Card key={i} className="p-3 border-border/40 bg-background/80">
                    <div className="space-y-2">
                      {/* Step header */}
                      <div className="flex items-center gap-2">
                        {statusConfig.icon}
                        <span className="text-xs font-bold text-foreground">Step {step.step}: {step.source}</span>
                        <Badge variant="outline" className={`text-[10px] ml-auto px-1.5 py-0 h-5 ${statusConfig.badgeClass}`}>
                          {statusConfig.label}
                        </Badge>
                        <span className="text-[10px] font-mono text-muted-foreground">{step.duration_ms}ms</span>
                      </div>

                      {/* Algorithm used */}
                      <p className="text-[11px] text-muted-foreground leading-relaxed pl-6">{step.algorithm}</p>

                      {/* Result */}
                      {step.result && (
                        <div className="flex items-start gap-1.5 pl-6 py-1.5 px-2 rounded bg-muted/50">
                          <ArrowRight className="h-3 w-3 text-primary mt-0.5 flex-shrink-0" />
                          <span className="text-[11px] font-medium text-foreground leading-relaxed">{step.result}</span>
                        </div>
                      )}

                      {/* Raw data grid */}
                      {step.rawData && Object.keys(step.rawData).length > 0 && (
                        <div className="pl-6">
                          <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Raw Data</span>
                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-0.5 mt-1">
                            {Object.entries(step.rawData).map(([k, v]) => (
                              <div key={k} className="text-[11px] flex items-baseline gap-1">
                                <span className="text-muted-foreground">{k}:</span>
                                <span className="font-mono font-medium text-foreground">
                                  {typeof v === 'number' ? (v as number).toFixed(2) : String(v)}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Thresholds */}
                      {step.thresholds && Object.keys(step.thresholds).length > 0 && (
                        <div className="pl-6">
                          <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Thresholds Used</span>
                          <div className="flex flex-wrap gap-1.5 mt-1">
                            {Object.entries(step.thresholds).map(([k, v]) => (
                              <span key={k} className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-mono">
                                {k}: {String(v)}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </Card>
                );
              })}
            </div>
          </CollapsibleContent>
        </Collapsible>
      )}

      {/* Data Sources Footer */}
      {metadata && (
        <Collapsible open={showSources} onOpenChange={setShowSources}>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="sm" className="w-full text-xs text-muted-foreground hover:text-foreground gap-1">
              <Database className="h-3 w-3" />
              Data Sources & Algorithms
              {showSources ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <Card className="p-3 border-border/30 mt-1">
              <div className="space-y-2 text-xs text-muted-foreground">
                <div>
                  <span className="font-semibold text-foreground">Sources:</span>{' '}
                  {metadata.sources.join(' • ')}
                </div>
                <div>
                  <span className="font-semibold text-foreground">Algorithms:</span>{' '}
                  {metadata.algorithmsUsed.join(' • ')}
                </div>
                <div>
                  <span className="font-semibold text-foreground">Generated:</span>{' '}
                  {new Date(metadata.generatedAt).toLocaleString()}
                </div>
              </div>
            </Card>
          </CollapsibleContent>
        </Collapsible>
      )}
    </div>
  );
};

export default EarlyAlerts;
