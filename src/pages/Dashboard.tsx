import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import DashboardSidebar from '@/components/DashboardSidebar';
import WeatherWidget from '@/components/WeatherWidget';
import AnimatedBackground from '@/components/AnimatedBackground';
import DisasterList from '@/components/DisasterList';
import CopilotChat from '@/components/CopilotChat';
import DisasterGuidelines from '@/components/DisasterGuidelines';
import EarlyAlerts from '@/components/EarlyAlerts';
import NotificationHistory from '@/components/NotificationHistory';
import HeatmapOverview from '@/components/HeatmapOverview';
import VolunteerHub from '@/components/VolunteerHub';
import EmergencyServicesMap from '@/components/EmergencyServicesMap';
import OfflineIndicator from '@/components/OfflineIndicator';
import DisasterImageAnalyzer from '@/components/DisasterImageAnalyzer';
import MobileBottomNav from '@/components/MobileBottomNav';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger
} from '@/components/ui/collapsible';
import { Menu, Globe, TrendingUp, ChevronDown, ChevronUp, Database, Radio } from 'lucide-react';
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
  fetchWeatherData,
  getCurrentLocation,
  predictDisastersWithAI,
  calculateDistance,
  fetchEmergencyFacilities
} from '@/utils/api';
import { loadMLModels } from '@/utils/mlModels';

const translations = {
  en: {
    communityIntel: "Community-Verified Intelligence",
    correlating: "Correlating ML Predictions with Human SOS Reality",
    activeSos: "Active SOS Reports",
    signals: "Signals",
    humanConfidence: "Human Confidence",
    realTimeCorr: "Real-Time Correlation:",
    validationText: (count: number) => `Scientific NN predictions are currently being validated by ${count} active community SOS signals. This high correlation increases the Practical Risk Level beyond standard model confidence.`,
    high: "High",
    moderate: "Moderate",
    low: "Low",
    viewDetails: "View Source Protocols",
    hideDetails: "Hide Protocols",
    sourceInfo: {
      supabase: "Supabase Real-time: Live SOS signal stream from community reports.",
      transformers: "Transformers.js: Local zero-shot NLP classification of community telemetry.",
      storage: "IndexDB: Local persistence of community-verified events.",
      correlation: "Neural Correlation Engine: Real-time weighting of local ML predictions against signal density."
    }
  },
  hi: {
    communityIntel: "समुदाय-सत्यापित खुफिया",
    correlating: "मानव SOS वास्तविकता के साथ ML भविष्यवाणियों का सहसंबंध",
    activeSos: "सक्रिय SOS रिपोर्ट",
    signals: "संकेत",
    humanConfidence: "मानव आत्मविश्वास",
    realTimeCorr: "वास्तविक समय सहसंबंध:",
    validationText: (count: number) => `वैज्ञानिक NN भविष्यवाणियां वर्तमान में ${count} सक्रिय सामुदायिक SOS संकेतों द्वारा मान्य की जा रही हैं। यह उच्च सहसंबंध मानक मॉडल आत्मविश्वास से परे व्यावहारिक जोखिम स्तर को बढ़ाता है।`,
    high: "उच्च",
    moderate: "मध्यम",
    low: "कम",
    viewDetails: "स्रोत प्रोटोकॉल देखें",
    hideDetails: "प्रोटोकॉल छिपाएं",
    sourceInfo: {
      supabase: "Supabase रीयल-टाइम: सामुदायिक रिपोर्टों से लाइव SOS सिग्नल स्ट्रीम।",
      transformers: "Transformers.js: सामुदायिक टेलीमेट्री का स्थानीय शून्य-शॉट NLP वर्गीकरण।",
      storage: "IndexDB: समुदाय-सत्यापित घटनाओं की स्थानीय दृढ़ता।",
      correlation: "तंत्रिका सहसंबंध इंजन: सिग्नल घनत्व के खिलाफ स्थानीय ML भविष्यवाणियों का रीयल-टाइम भार।"
    }
  }
};

const Dashboard: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState(searchParams.get('tab') || 'overview');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true);
  const [showIntelDetails, setShowIntelDetails] = useState(false);
  const [userLocation, setUserLocation] = useState<Location | null>(null);
  const [mapCenter, setMapCenter] = useState<Location>({ lat: 20.5937, lng: 78.9629 }); // Center of India
  const [disasters, setDisasters] = useState<DisasterEvent[]>([]);
  const [predictions, setPredictions] = useState<DisasterEvent[]>([]);
  const [facilities, setFacilities] = useState<EmergencyFacility[]>([]);
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [language, setLanguage] = useState<'en' | 'hi'>('en');
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
    loadMLModels();
  }, []);

  // Listen for tab change events from Dynamic Island
  useEffect(() => {
    const handleTabChange = (event: CustomEvent) => {
      setActiveTab(event.detail);
    };

    window.addEventListener('changeTab', handleTabChange as EventListener);
    return () => window.removeEventListener('changeTab', handleTabChange as EventListener);
  }, []);

  // 🛰️ Saarthi Ultimate: Centralized Event Bus for Agent Actions
  useEffect(() => {
    const handleLayerChange = (event: CustomEvent) => {
      const type = event.detail;
      console.log(`📡 Saarthi Agent: Switching Map Layer to ${type}`);
      // If we had a layer state in Dashboard, we'd update it here.
      // For now, we'll dispatch it to the HeatmapOverview/Map component.
      window.dispatchEvent(new CustomEvent('syncMapLayer', { detail: type }));
    };

    window.addEventListener('changeMapLayer', handleLayerChange as EventListener);
    return () => window.removeEventListener('changeMapLayer', handleLayerChange as EventListener);
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

  const handleTabChange = useCallback((tab: string) => {
    setActiveTab(tab);
    setSearchParams({ tab });
  }, [setSearchParams]);

  const handleDisasterClick = useCallback((disaster: DisasterEvent) => {
    // Navigate to overview and center on disaster
    handleTabChange('overview');

    // Brief timeout to ensure tab switch completes before centering
    setTimeout(() => {
      console.log("📡 Dispatching centerMap event for specialized telemetry:", disaster.location);
      const event = new CustomEvent('centerMap', { detail: disaster.location });
      window.dispatchEvent(event);
    }, 300);
  }, [handleTabChange]);

  const handleFacilityClick = useCallback((facility: EmergencyFacility | any) => {
    // Handle both EmergencyService and EmergencyFacility types
    const location = facility.location
      ? facility.location
      : { lat: facility.lat, lng: facility.lng };

    setMapCenter(location);
    handleTabChange('overview');
  }, [handleTabChange]);

  const renderTabContent = () => {
    switch (activeTab) {
      case 'overview':
        return (
          <div className="h-full pb-14 md:pb-0">
            <HeatmapOverview
              disasters={disasters}
              userLocation={userLocation}
              nearbyDisasters={disasters.filter(d => {
                if (!userLocation) return false;
                const distance = calculateDistance(userLocation, d.location);
                return distance < 1000;
              })}
            />
          </div>
        );

      case 'early-alerts':
        return (
          <div className="h-full overflow-y-auto p-3 pt-4 pb-20 md:pb-3 sm:p-6 md:pt-6">
            <EarlyAlerts userLocation={userLocation} language={language} />
          </div>
        );

      case 'weather':
        return (
          <div className="h-full overflow-y-auto p-3 pt-4 pb-20 md:pb-3 sm:p-6 md:pt-6">
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
          <div className="h-full overflow-y-auto p-3 pt-4 pb-20 md:pb-3 sm:p-6 md:pt-6">
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
          <div className="h-full pb-14 md:pb-0">
            <EmergencyServicesMap onFacilityClick={handleFacilityClick} userLocation={userLocation} disasters={disasters} />
          </div>
        );

      case 'resource-coordination':
        return (
          <div className="h-full overflow-y-auto p-3 pt-4 pb-20 md:pb-3 sm:p-6 md:pt-6">
            <VolunteerHub />
          </div>
        );

      case 'ai-insights':
        return (
          <div className="h-full pb-14 md:pb-0">
            <CopilotChat userLocation={userLocation} facilities={facilities} />
          </div>
        );

      case 'image-analyzer':
        return (
          <div className="h-full pb-14 md:pb-0">
            <DisasterImageAnalyzer />
          </div>
        );

      case 'guidelines':
        return (
          <div className="h-full overflow-y-auto p-3 pt-4 pb-20 md:pb-3 sm:p-6 md:pt-6">
            <DisasterGuidelines />
          </div>
        );

      case 'alert-history':
        return (
          <div className="h-full overflow-y-auto p-3 pt-4 pb-20 md:pb-3 sm:p-6 md:pt-6">
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
          onTabChange={handleTabChange}
          isCollapsed={sidebarCollapsed}
          onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
          onFacilityClick={handleFacilityClick}
          onLocationUpdate={handleLocationUpdate}
          language={language}
        >
          <OfflineIndicator isCollapsed={sidebarCollapsed} />
        </DashboardSidebar>

        {/* Mobile: Overlay when sidebar is open */}
        {!sidebarCollapsed && (
          <div
            className="fixed inset-0 bg-background/60 z-[5500] md:hidden backdrop-blur-sm transition-opacity"
            onClick={() => setSidebarCollapsed(true)}
          />
        )}

        {/* Main Content */}
        <main className="flex-1 w-full h-full overflow-hidden relative">

          <div className="h-full w-full">
            {renderTabContent()}
          </div>
        </main>

        {/* Mobile Bottom Navigation */}
        <MobileBottomNav
          activeTab={activeTab}
          onTabChange={handleTabChange}
          onOpenMenu={() => setSidebarCollapsed(false)}
          language={language}
        />

      </div>
    </div>
  );
};

export default Dashboard;
