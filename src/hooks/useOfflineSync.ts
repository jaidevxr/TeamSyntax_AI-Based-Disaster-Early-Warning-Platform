import { useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import {
  getPendingAlerts,
  removePendingAlert,
  cacheDisasters,
  cacheFacilities,
  cacheWeather,
} from '@/utils/offlineStorage';
import { toast } from 'sonner';
import { DisasterEvent, EmergencyFacility, WeatherData } from '@/types';

export const useOfflineSync = () => {
  // Sync pending emergency alerts when online
  const syncPendingAlerts = useCallback(async () => {
    if (!navigator.onLine) return;

    try {
      const pending = await getPendingAlerts();
      
      if (pending.length === 0) return;

      for (const alert of pending) {
        try {
          const { error } = await supabase.functions.invoke('v1-send-emergency-alert', {
            body: alert.payload,
          });

          if (!error) {
            await removePendingAlert(alert.id);
          }
        } catch (error) {
          console.error(`Failed to send alert ${alert.id}:`, error);
        }
      }

      const remaining = await getPendingAlerts();
      const sent = pending.length - remaining.length;

      if (sent > 0) {
        toast.success(`${sent} pending alert${sent > 1 ? 's' : ''} sent`, {
          description: 'Emergency alerts have been delivered',
        });
      }
    } catch (error) {
      console.error('Error syncing pending alerts:', error);
    }
  }, []);

  // Cache data for offline use
  const cacheDataForOffline = useCallback(async (
    disasters?: DisasterEvent[],
    facilities?: EmergencyFacility[],
    weather?: { location: string; data: WeatherData }
  ) => {
    try {
      if (disasters && disasters.length > 0) {
        await cacheDisasters(disasters);
      }
      
      if (facilities && facilities.length > 0) {
        await cacheFacilities(facilities);
      }
      
      if (weather) {
        await cacheWeather(weather.location, weather.data);
      }
    } catch (error) {
      console.error('Error caching data:', error);
    }
  }, []);

  // Listen for online/offline events
  useEffect(() => {
    const handleOnline = () => {
      syncPendingAlerts();
    };

    window.addEventListener('online', handleOnline);

    // Initial sync if online
    if (navigator.onLine) {
      syncPendingAlerts();
    }

    return () => {
      window.removeEventListener('online', handleOnline);
    };
  }, [syncPendingAlerts]);

  return {
    syncPendingAlerts,
    cacheDataForOffline,
    isOnline: navigator.onLine,
  };
};
