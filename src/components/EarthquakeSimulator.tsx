import React, { useState, useMemo } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Activity,
  AlertTriangle,
  Users,
  Home,
  Zap,
  MapPin,
  Play,
  RotateCcw,
  TrendingUp,
  ShieldAlert,
} from 'lucide-react';
import { Location } from '@/types';

interface EarthquakeSimulatorProps {
  userLocation: Location | null;
  language: 'en' | 'hi';
}

interface SimulationResult {
  magnitude: number;
  epicenter: { lat: number; lng: number };
  mmi: { zone: string; radius: number; intensity: string; color: string; description: string }[];
  estimatedAffected: number;
  pgaAtUser: number;
  distanceToUser: number;
  shaking: string;
}

// Joyner-Boore attenuation: PGA (g) from magnitude & distance
const calcPGA = (mag: number, distKm: number): number => {
  const r = Math.sqrt(distKm ** 2 + 10 ** 2); // hypocentral distance (assume 10km depth)
  const logPGA = 0.249 * mag - 0.00255 * r - Math.log10(r) - 0.49;
  return 10 ** logPGA; // PGA in g
};

// PGA to Modified Mercalli Intensity
const pgaToMMI = (pga: number): number => {
  if (pga <= 0) return 1;
  const logPGA = Math.log10(pga * 980); // convert g to cm/s²
  return Math.min(12, Math.max(1, 3.66 * logPGA - 1.66));
};

const mmiToShaking = (mmi: number): string => {
  if (mmi < 2) return 'Not Felt';
  if (mmi < 4) return 'Weak';
  if (mmi < 5) return 'Light';
  if (mmi < 6) return 'Moderate';
  if (mmi < 7) return 'Strong';
  if (mmi < 8) return 'Very Strong';
  if (mmi < 9) return 'Severe';
  if (mmi < 10) return 'Violent';
  return 'Extreme';
};

const haversine = (lat1: number, lng1: number, lat2: number, lng2: number): number => {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

const EarthquakeSimulator: React.FC<EarthquakeSimulatorProps> = ({ userLocation, language }) => {
  const [magnitude, setMagnitude] = useState(6.5);
  const [epicenterLat, setEpicenterLat] = useState(userLocation?.lat?.toString() || '28.6139');
  const [epicenterLng, setEpicenterLng] = useState(userLocation?.lng?.toString() || '77.2090');
  const [simulation, setSimulation] = useState<SimulationResult | null>(null);
  const [isRunning, setIsRunning] = useState(false);

  const t = language === 'hi' ? {
    title: 'भूकंप प्रभाव सिम्युलेटर',
    subtitle: 'PGA क्षीणन भौतिकी · MMI स्केल',
    magnitude: 'तीव्रता',
    epicenter: 'उपकेंद्र',
    run: 'सिम्युलेशन चलाएं',
    reset: 'रीसेट',
    useMyLocation: 'मेरा स्थान',
    results: 'प्रभाव विश्लेषण',
    zone: 'क्षेत्र',
    radius: 'दायरा',
    affected: 'प्रभावित (अनुमानित)',
    yourLocation: 'आपके स्थान पर',
    pga: 'PGA',
    shaking: 'कंपन',
    distance: 'उपकेंद्र से दूरी',
  } : {
    title: 'Earthquake Impact Simulator',
    subtitle: 'PGA Attenuation Physics · MMI Scale',
    magnitude: 'Magnitude',
    epicenter: 'Epicenter',
    run: 'Run Simulation',
    reset: 'Reset',
    useMyLocation: 'Use My Location',
    results: 'Impact Analysis',
    zone: 'Zone',
    radius: 'Radius',
    affected: 'Estimated Affected',
    yourLocation: 'At Your Location',
    pga: 'Peak Ground Acceleration',
    shaking: 'Shaking Intensity',
    distance: 'Distance from Epicenter',
  };

  const runSimulation = () => {
    setIsRunning(true);
    const lat = parseFloat(epicenterLat);
    const lng = parseFloat(epicenterLng);

    setTimeout(() => {
      // Calculate MMI zones at various radii
      const zones: SimulationResult['mmi'] = [];
      const zoneConfigs = [
        { intensity: 'Extreme (X+)', color: '#7f1d1d', minMMI: 10 },
        { intensity: 'Violent (IX)', color: '#dc2626', minMMI: 9 },
        { intensity: 'Severe (VIII)', color: '#ea580c', minMMI: 8 },
        { intensity: 'Very Strong (VII)', color: '#f97316', minMMI: 7 },
        { intensity: 'Strong (VI)', color: '#eab308', minMMI: 6 },
        { intensity: 'Moderate (V)', color: '#22c55e', minMMI: 5 },
        { intensity: 'Light (IV)', color: '#3b82f6', minMMI: 4 },
      ];

      for (const zc of zoneConfigs) {
        // Binary search for radius where MMI drops below threshold
        let lo = 0, hi = 500;
        for (let i = 0; i < 20; i++) {
          const mid = (lo + hi) / 2;
          const pga = calcPGA(magnitude, mid);
          const mmi = pgaToMMI(pga);
          if (mmi > zc.minMMI) lo = mid; else hi = mid;
        }
        if (lo > 1) {
          zones.push({
            zone: zc.intensity.split(' ')[0],
            radius: Math.round(lo),
            intensity: zc.intensity,
            color: zc.color,
            description: zc.minMMI >= 8 ? 'Structural collapse likely' :
              zc.minMMI >= 6 ? 'Damage to weak buildings' :
              zc.minMMI >= 5 ? 'Objects fall, cracks in walls' : 'Felt indoors, no damage',
          });
        }
      }

      // Population density (rough avg for India): ~400/km²
      const maxRadius = zones[0]?.radius || 0;
      const estimatedAffected = Math.round(Math.PI * maxRadius ** 2 * 400);

      // User distance and shaking
      let pgaAtUser = 0;
      let distanceToUser = 0;
      let shaking = 'Not Felt';
      if (userLocation) {
        distanceToUser = haversine(lat, lng, userLocation.lat, userLocation.lng);
        pgaAtUser = calcPGA(magnitude, distanceToUser);
        const mmiAtUser = pgaToMMI(pgaAtUser);
        shaking = mmiToShaking(mmiAtUser);
      }

      setSimulation({
        magnitude,
        epicenter: { lat, lng },
        mmi: zones,
        estimatedAffected,
        pgaAtUser,
        distanceToUser,
        shaking,
      });
      setIsRunning(false);
    }, 1200);
  };

  const magnitudeColor = magnitude < 5 ? 'text-green-600' : magnitude < 6.5 ? 'text-amber-600' : magnitude < 8 ? 'text-red-600' : 'text-red-900';

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-red-600 to-orange-700 flex items-center justify-center shadow-lg shadow-red-500/30 animate-pulse">
          <Activity className="h-5 w-5 text-white" />
        </div>
        <div>
          <h2 className="text-lg font-extrabold tracking-tight text-foreground">{t.title}</h2>
          <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-widest">{t.subtitle}</p>
        </div>
      </div>

      {/* Input Card */}
      <Card className="p-4 space-y-4 border-orange-200/50 dark:border-orange-500/10 bg-gradient-to-br from-orange-50/50 to-white dark:from-orange-950/20 dark:to-slate-900/90">
        {/* Magnitude Slider */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">{t.magnitude}</Label>
            <span className={`text-3xl font-black ${magnitudeColor} tabular-nums`}>{magnitude.toFixed(1)}</span>
          </div>
          <input
            type="range"
            min="3"
            max="9.5"
            step="0.1"
            value={magnitude}
            onChange={e => setMagnitude(parseFloat(e.target.value))}
            className="w-full h-2 rounded-full appearance-none bg-gradient-to-r from-green-400 via-amber-400 via-orange-500 to-red-700 cursor-pointer"
          />
          <div className="flex justify-between text-[8px] text-muted-foreground font-bold">
            <span>3.0 Minor</span><span>5.0 Moderate</span><span>7.0 Major</span><span>9.5 Great</span>
          </div>
        </div>

        {/* Epicenter */}
        <div className="space-y-2">
          <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">{t.epicenter}</Label>
          <div className="flex gap-2 items-center">
            <Input type="number" step="0.001" value={epicenterLat} onChange={e => setEpicenterLat(e.target.value)} placeholder="Latitude" className="text-sm font-mono" />
            <Input type="number" step="0.001" value={epicenterLng} onChange={e => setEpicenterLng(e.target.value)} placeholder="Longitude" className="text-sm font-mono" />
            {userLocation && (
              <Button variant="outline" size="sm" className="shrink-0 text-[10px] font-bold gap-1" onClick={() => { setEpicenterLat(userLocation.lat.toFixed(4)); setEpicenterLng(userLocation.lng.toFixed(4)); }}>
                <MapPin className="h-3 w-3" /> {t.useMyLocation}
              </Button>
            )}
          </div>
        </div>

        {/* Run Button */}
        <div className="flex gap-2">
          <Button onClick={runSimulation} disabled={isRunning} className="flex-1 gap-2 font-bold h-12 bg-gradient-to-r from-red-600 to-orange-600 hover:from-red-700 hover:to-orange-700 text-white shadow-lg shadow-red-500/30 text-sm">
            {isRunning ? <Activity className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
            {isRunning ? 'Simulating...' : t.run}
          </Button>
          {simulation && (
            <Button variant="outline" onClick={() => setSimulation(null)} className="gap-1 font-bold">
              <RotateCcw className="h-3.5 w-3.5" /> {t.reset}
            </Button>
          )}
        </div>
      </Card>

      {/* Results */}
      {simulation && (
        <div className="space-y-3 animate-in slide-in-from-bottom-4 duration-500">
          {/* Summary Cards */}
          <div className="grid grid-cols-2 gap-2">
            <Card className="p-3 bg-red-50/50 dark:bg-red-950/20 border-red-200/50 dark:border-red-500/10">
              <div className="flex items-center gap-2 mb-1">
                <Users className="h-3.5 w-3.5 text-red-600" />
                <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest">{t.affected}</span>
              </div>
              <p className="text-xl font-black text-red-700 dark:text-red-400">
                {simulation.estimatedAffected > 1000000
                  ? `${(simulation.estimatedAffected / 1000000).toFixed(1)}M`
                  : simulation.estimatedAffected > 1000
                  ? `${(simulation.estimatedAffected / 1000).toFixed(0)}K`
                  : simulation.estimatedAffected.toLocaleString()}
              </p>
              <p className="text-[9px] text-muted-foreground">people in impact zone</p>
            </Card>

            <Card className="p-3 bg-amber-50/50 dark:bg-amber-950/20 border-amber-200/50 dark:border-amber-500/10">
              <div className="flex items-center gap-2 mb-1">
                <ShieldAlert className="h-3.5 w-3.5 text-amber-600" />
                <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest">{t.yourLocation}</span>
              </div>
              <p className="text-xl font-black text-amber-700 dark:text-amber-400">{simulation.shaking}</p>
              <p className="text-[9px] text-muted-foreground">{simulation.distanceToUser.toFixed(1)} km away · PGA {(simulation.pgaAtUser).toFixed(4)}g</p>
            </Card>
          </div>

          {/* MMI Zone Breakdown */}
          <Card className="p-4 space-y-3">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-orange-600" />
              <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">MMI Impact Zones (Joyner-Boore Model)</span>
            </div>
            <div className="space-y-2">
              {simulation.mmi.map((zone, i) => (
                <div key={i} className="flex items-center gap-3 p-2 rounded-lg bg-muted/20 border border-border/30">
                  <div className="h-8 w-8 rounded-lg flex items-center justify-center shadow-sm flex-shrink-0" style={{ backgroundColor: zone.color }}>
                    <AlertTriangle className="h-4 w-4 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-xs font-black text-foreground">{zone.intensity}</p>
                      <Badge variant="outline" className="text-[8px] font-bold px-1.5 py-0">{zone.radius} km</Badge>
                    </div>
                    <p className="text-[10px] text-muted-foreground">{zone.description}</p>
                  </div>
                  {/* Visual radius bar */}
                  <div className="w-20 h-2 bg-muted rounded-full overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${Math.min(100, (zone.radius / (simulation.mmi[0]?.radius || 1)) * 100)}%`, backgroundColor: zone.color }} />
                  </div>
                </div>
              ))}
            </div>
            <p className="text-[8px] text-muted-foreground italic">Based on Joyner-Boore attenuation model · Assumed depth: 10km · Pop density: ~400/km²</p>
          </Card>
        </div>
      )}
    </div>
  );
};

export default EarthquakeSimulator;
