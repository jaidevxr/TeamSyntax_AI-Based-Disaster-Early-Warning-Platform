import React, { useState, useEffect, useCallback } from 'react';
import DashboardSidebar from '@/components/DashboardSidebar';
import WeatherWidget from '@/components/WeatherWidget';
import AnimatedBackground from '@/components/AnimatedBackground';
import DisasterList from '@/components/DisasterList';
import CopilotChat from '@/components/CopilotChat';
import DisasterGuidelines from '@/components/DisasterGuidelines';
import EarlyAlerts from '@/components/EarlyAlerts';
import NotificationHistory from '@/components/NotificationHistory';
import HeatmapOverview from '@/components/HeatmapOverview';
import EmergencyServicesMap from '@/components/EmergencyServicesMap';
import OfflineIndicator from '@/components/OfflineIndicator';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Menu } from 'lucide-react';
import { useOfflineSync } from '@/hooks/useOfflineSync';
import {
  getCachedDisasters,
  getCachedFacilities,
  getCachedWeather
} from '@/utils/offlineStorage';
import {
  DisasterEvent,
  EmergencyFacility,
  WeatherData,
  Location
} from '@/types';
import {
  fetchDisasterData,
  fetchEmergencyFacilities,
  fetchWeatherData,
  getCurrentLocation,
  predictDisastersWithAI,
} from '@/utils/api';

const Dashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState('overview');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true);
  const [userLocation, setUserLocation] = useState<Location | null>(null);
  const [mapCenter, setMapCenter] = useState<Location>({ lat: 20.5937, lng: 78.9629 }); // Center of India
  const [disasters, setDisasters] = useState<DisasterEvent[]>([]);
  const [predictions, setPredictions] = useState<DisasterEvent[]>([]);
  const [facilities, setFacilities] = useState<EmergencyFacility[]>([]);
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [loading, setLoading] = useState({
    disasters: false,
    predictions: false,
    facilities: false,
    weather: false,
  });

  const { cacheDataForOffline } = useOfflineSync();

  // Load initial data
  useEffect(() => {
    loadDisasterData();
  }, []);

  // Listen for tab change events from Dynamic Island
  useEffect(() => {
    const handleTabChange = (event: CustomEvent) => {
      setActiveTab(event.detail);
    };

    window.addEventListener('changeTab', handleTabChange as EventListener);
    return () => window.removeEventListener('changeTab', handleTabChange as EventListener);
  }, []);

  // Update data when user location changes
  useEffect(() => {
    if (userLocation) {
      setMapCenter(userLocation);
      loadWeatherData(userLocation);
      loadNearbyFacilities(userLocation);
      loadPredictions(userLocation);
    }
  }, [userLocation]);

  const loadDisasterData = async () => {
    setLoading(prev => ({ ...prev, disasters: true }));
    try {
      // Try to fetch from API
      const disasterData = await fetchDisasterData();
      setDisasters(disasterData);

      // Cache for offline use
      await cacheDataForOffline(disasterData);
    } catch (error) {
      console.error('Error loading disaster data:', error);

      // Fall back to cached data if offline
      if (!navigator.onLine) {
        const cached = await getCachedDisasters();
        if (cached.length > 0) {
          setDisasters(cached);
        }
      }
    }
    setLoading(prev => ({ ...prev, disasters: false }));
  };

  const loadWeatherData = async (location: Location) => {
    setLoading(prev => ({ ...prev, weather: true }));
    try {
      const weatherData = await fetchWeatherData(location);
      setWeather(weatherData);

      // Cache for offline use
      const locationKey = `${location.lat.toFixed(4)},${location.lng.toFixed(4)}`;
      await cacheDataForOffline(undefined, undefined, { location: locationKey, data: weatherData });
    } catch (error) {
      console.error('Error loading weather data:', error);

      // Fall back to cached data if offline
      if (!navigator.onLine) {
        const locationKey = `${location.lat.toFixed(4)},${location.lng.toFixed(4)}`;
        const cached = await getCachedWeather(locationKey);
        if (cached) {
          setWeather(cached);
        }
      }
    }
    setLoading(prev => ({ ...prev, weather: false }));
  };

  const loadNearbyFacilities = async (location: Location) => {
    setLoading(prev => ({ ...prev, facilities: true }));
    try {
      const facilityData = await fetchEmergencyFacilities(location);
      setFacilities(facilityData);

      // Cache for offline use
      await cacheDataForOffline(undefined, facilityData);
    } catch (error) {
      console.error('Error loading facilities:', error);

      // Fall back to cached data if offline
      if (!navigator.onLine) {
        const cached = await getCachedFacilities();
        if (cached.length > 0) {
          setFacilities(cached);
        }
      }
    }
    setLoading(prev => ({ ...prev, facilities: false }));
  };

  const loadPredictions = async (location: Location) => {
    setLoading(prev => ({ ...prev, predictions: true }));
    try {
      const predictionData = await predictDisastersWithAI(location);
      setPredictions(predictionData);
    } catch (error) {
      console.error('Error loading predictions:', error);
      setPredictions([]);
    }
    setLoading(prev => ({ ...prev, predictions: false }));
  };

  const handleLocationUpdate = useCallback((location: Location) => {
    setUserLocation(location);
  }, []);

  const handleLocationSearch = useCallback((location: Location) => {
    setMapCenter(location);
    loadWeatherData(location);
    loadNearbyFacilities(location);
  }, []);

  const handleDisasterClick = useCallback((disaster: DisasterEvent) => {
    setMapCenter(disaster.location);
    setActiveTab('overview');
  }, []);

  const handleFacilityClick = useCallback((facility: EmergencyFacility | any) => {
    // Handle both EmergencyService and EmergencyFacility types
    const location = facility.location
      ? facility.location
      : { lat: facility.lat, lng: facility.lng };

    setMapCenter(location);
    setActiveTab('overview');
  }, []);

  const renderTabContent = () => {
    switch (activeTab) {
      case 'overview':
        return (
          <div className="h-full">
            <HeatmapOverview
              disasters={disasters}
              userLocation={userLocation}
              nearbyDisasters={disasters.filter(d => {
                if (!userLocation) return false;
                const distance = Math.sqrt(
                  Math.pow(d.location.lat - userLocation.lat, 2) +
                  Math.pow(d.location.lng - userLocation.lng, 2)
                );
                return distance < 1; // Within ~100km radius
              })}
            />
          </div>
        );

      case 'early-alerts':
        return (
          <div className="h-full overflow-y-auto p-3 pt-16 md:pt-3 sm:p-6 md:pt-6">
            <EarlyAlerts userLocation={userLocation} />
          </div>
        );

      case 'weather':
        return (
          <div className="h-full overflow-y-auto p-3 pt-16 md:pt-3 sm:p-6 md:pt-6">
            <WeatherWidget
              weather={weather}
              loading={loading.weather}
              onLocationChange={handleLocationSearch}
              userLocation={userLocation}
            />
          </div>
        );

      case 'disasters':
        return (
          <div className="h-full overflow-y-auto p-3 pt-16 md:pt-3 sm:p-6 md:pt-6">
            <DisasterList
              disasters={[...disasters, ...predictions]}
              onDisasterClick={handleDisasterClick}
              loading={loading.disasters || loading.predictions}
              userLocation={userLocation}
            />
          </div>
        );

      case 'emergency-services':
        return (
          <div className="h-full">
            <EmergencyServicesMap onFacilityClick={handleFacilityClick} userLocation={userLocation} />
          </div>
        );

      case 'ai-insights':
        return (
          <div className="h-full">
            <CopilotChat userLocation={userLocation} />
          </div>
        );

      case 'guidelines':
        return (
          <div className="h-full overflow-y-auto p-3 pt-16 md:pt-3 sm:p-6 md:pt-6">
            <DisasterGuidelines />
          </div>
        );

      case 'alert-history':
        return (
          <div className="h-full overflow-y-auto p-3 pt-16 md:pt-3 sm:p-6 md:pt-6">
            <NotificationHistory />
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-background relative">
      <AnimatedBackground />

      <div className="flex h-screen w-full">
        {/* Sidebar */}
        <DashboardSidebar
          activeTab={activeTab}
          onTabChange={setActiveTab}
          isCollapsed={sidebarCollapsed}
          onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
          onFacilityClick={handleFacilityClick}
          onLocationUpdate={handleLocationUpdate}
        >
          <OfflineIndicator isCollapsed={sidebarCollapsed} />
        </DashboardSidebar>

        {/* Mobile: Overlay when sidebar is open */}
        {!sidebarCollapsed && (
          <div
            className="fixed inset-0 bg-background/60 z-[2999] md:hidden backdrop-blur-sm transition-opacity"
            onClick={() => setSidebarCollapsed(true)}
          />
        )}

        {/* Main Content */}
        <main className="flex-1 w-full h-full overflow-hidden">
          <div className="h-full w-full">
            {renderTabContent()}
          </div>
        </main>

        {/* Mobile Sidebar Toggle */}
        {sidebarCollapsed && (
          <button
            aria-label="Open sidebar"
            onClick={() => setSidebarCollapsed(false)}
            className="fixed left-3 top-3 z-[1002] md:hidden h-10 w-10 rounded-full flex items-center justify-center shadow-lg backdrop-blur-md bg-foreground/10 border border-border/30 hover:bg-foreground/20 active:scale-95 transition-all"
          >
            <Menu className="h-4.5 w-4.5 text-foreground" />
          </button>
        )}

      </div>
    </div>
  );
};

export default Dashboard;
