import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Location } from '@/types';

interface SaarthiPulseState {
  riskScore: number;
  activeDisasters: any[];
  isInterjectionNeeded: boolean;
  message: string | null;
}

/**
 * Saarthi Pulse Hook
 * Monitors global disaster telemetry and triggers autonomous AI interjections
 * when critical risk thresholds are met.
 */
export const useSaarthiPulse = (userLocation: Location | null) => {
  const [pulse, setPulse] = useState<SaarthiPulseState>({
    riskScore: 0,
    activeDisasters: [],
    isInterjectionNeeded: false,
    message: null,
  });

  const checkRiskLevels = useCallback(async () => {
    try {
      // 1. Fetch live scores from the main logic (simulated for pulse)
      // In a real app, this would share state with the Dashboard
      const res = await fetch('https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/significant_day.geojson');
      const data = await res.json();
      const disasters = data.features || [];
      
      // Calculate a simple "Urgency Score"
      let score = 0;
      if (disasters.length > 0) score += 40;
      
      // If score is high and we haven't alerted recently
      if (score >= 40 && !pulse.isInterjectionNeeded) {
        setPulse(prev => ({
          ...prev,
          riskScore: score,
          activeDisasters: disasters,
          isInterjectionNeeded: true,
          message: `I've detected significant seismic activity nearby (${disasters.length} events). Would you like an immediate AI brief?`
        }));
      } else {
        setPulse(prev => ({ ...prev, riskScore: score, activeDisasters: disasters }));
      }
    } catch (error) {
      console.error("Pulse Watch Error:", error);
    }
  }, [pulse.isInterjectionNeeded]);

  useEffect(() => {
    const timer = setInterval(checkRiskLevels, 60000); // Poll every minute
    return () => clearInterval(timer);
  }, [checkRiskLevels]);

  const clearInterjection = () => {
    setPulse(prev => ({ ...prev, isInterjectionNeeded: false, message: null }));
  };

  return { pulse, clearInterjection };
};
