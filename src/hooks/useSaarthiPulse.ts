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
    if (!userLocation) return;
    
    try {
      const res = await fetch('https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/significant_day.geojson');
      const data = await res.json();
      const allEvents = data.features || [];
      
      // Filter for events within 1000km of the user
      const nearbyEvents = allEvents.filter((event: any) => {
        const [lng, lat] = event.geometry.coordinates;
        const R = 6371; // Earth's radius in km
        const dLat = (lat - userLocation.lat) * Math.PI / 180;
        const dLon = (lng - userLocation.lng) * Math.PI / 180;
        const a = 
          Math.sin(dLat/2) * Math.sin(dLat/2) +
          Math.cos(userLocation.lat * Math.PI / 180) * Math.cos(lat * Math.PI / 180) * 
          Math.sin(dLon/2) * Math.sin(dLon/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        const distance = R * c;
        return distance < 1000;
      });
      
      let score = 0;
      if (nearbyEvents.length > 0) score += 40;
      
      if (score >= 40 && !pulse.isInterjectionNeeded) {
        const primaryEvent = nearbyEvents[0].properties.place;
        setPulse(prev => ({
          ...prev,
          riskScore: score,
          activeDisasters: nearbyEvents,
          isInterjectionNeeded: true,
          message: `I've detected significant seismic activity near ${primaryEvent}. Would you like an immediate AI brief?`
        }));
      } else {
        setPulse(prev => ({ ...prev, riskScore: score, activeDisasters: nearbyEvents }));
      }
    } catch (error) {
      console.error("Pulse Watch Error:", error);
    }
  }, [userLocation, pulse.isInterjectionNeeded]);

  useEffect(() => {
    const timer = setInterval(checkRiskLevels, 60000); // Poll every minute
    return () => clearInterval(timer);
  }, [checkRiskLevels]);

  const clearInterjection = () => {
    setPulse(prev => ({ ...prev, isInterjectionNeeded: false, message: null }));
  };

  return { pulse, clearInterjection };
};
