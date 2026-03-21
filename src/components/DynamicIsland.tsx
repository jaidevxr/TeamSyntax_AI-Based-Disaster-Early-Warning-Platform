import React, { useState, useEffect } from 'react';
import { Sun, Moon, MapPin, Cloud, CloudRain, CloudSnow, Wind } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Location } from '@/types';
import { useNavigate } from 'react-router-dom';

interface DynamicIslandProps {
  userLocation: Location | null;
}

interface WeatherData {
  temperature: number;
  weatherCode: number;
  description: string;
  isDay: number;
}

const DynamicIsland: React.FC<DynamicIslandProps> = ({ userLocation }) => {
  const navigate = useNavigate();
  const [isDark, setIsDark] = useState(() => {
    // Sync with index.html blocking script
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('theme');
      if (saved) return saved === 'dark';
      // Default to false (bright/light) as requested by user
      return false;
    }
    return false;
  });
  const [cityName, setCityName] = useState<string>('Detecting...');
  const [isExpanded, setIsExpanded] = useState(false);
  const [weather, setWeather] = useState<WeatherData | null>(null);

  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [isDark]);

  useEffect(() => {
    if (userLocation) {
      // Reverse geocoding via BigDataCloud (CORS-friendly, no API key needed)
      fetch(
        `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${userLocation.lat}&longitude=${userLocation.lng}&localityLanguage=en`
      )
        .then(res => res.json())
        .then(data => {
          const city =
            data.city ||
            data.locality ||
            data.localityInfo?.administrative?.find((a: any) => a.adminLevel === 5)?.name ||
            data.principalSubdivision ||
            'Unknown Location';
          setCityName(city);
        })
        .catch((err) => {
          console.error('Failed to get city name:', err);
          setCityName('Location detected');
        });

      // Fetch weather directly from Open-Meteo (free, CORS-friendly, no API key)
      // — the Supabase edge function is unreachable from this network.
      fetch(
        `https://api.open-meteo.com/v1/forecast?latitude=${userLocation.lat}&longitude=${userLocation.lng}` +
        `&current=temperature_2m,weather_code,is_day&timezone=auto`
      )
        .then(res => res.json())
        .then(data => {
          const current = data.current;
          if (current) {
            setWeather({
              temperature: Math.round(current.temperature_2m),
              weatherCode: current.weather_code ?? 0,
              description: getDescriptionFromCode(current.weather_code ?? 0),
              isDay: current.is_day ?? 1,
            });
          }
        })
        .catch((err) => {
          console.error('Failed to fetch weather:', err);
        });
    }
  }, [userLocation]);

  const getWeatherCodeFromCondition = (condition: string): number => {
    const conditionLower = condition.toLowerCase();
    if (conditionLower.includes('clear')) return 0;
    if (conditionLower.includes('cloud')) return 2;
    if (conditionLower.includes('mist') || conditionLower.includes('fog') || conditionLower.includes('haze')) return 45;
    if (conditionLower.includes('rain') || conditionLower.includes('drizzle')) return 61;
    if (conditionLower.includes('snow')) return 71;
    if (conditionLower.includes('thunder')) return 95;
    return 0;
  };

  // Map WMO weather code (from Open-Meteo) to a short human-readable description
  const getDescriptionFromCode = (code: number): string => {
    if (code === 0) return 'Clear sky';
    if (code <= 2) return 'Partly cloudy';
    if (code === 3) return 'Overcast';
    if (code <= 48) return 'Fog';
    if (code <= 55) return 'Drizzle';
    if (code <= 65) return 'Rain';
    if (code <= 67) return 'Freezing rain';
    if (code <= 75) return 'Snow';
    if (code <= 82) return 'Rain showers';
    if (code <= 99) return 'Thunderstorm';
    return 'Unknown';
  };

  const getWeatherIcon = (code: number, isDay: number) => {
    // Clear sky - show sun for day, moon for night
    if (code === 0) {
      return isDay === 1
        ? <Sun className="h-4 w-4 text-amber-400" />
        : <Moon className="h-4 w-4 text-blue-300" />;
    }
    // Partly cloudy - show cloud
    if (code <= 3) {
      return <Cloud className="h-4 w-4 text-foreground" />;
    }
    // Fog/Mist
    if (code <= 48) return <Cloud className="h-4 w-4 text-muted-foreground" />;
    // Rainy
    if (code <= 67) return <CloudRain className="h-4 w-4 text-blue-400" />;
    // Snowy
    if (code <= 77) return <CloudSnow className="h-4 w-4 text-blue-200" />;
    // Windy/stormy
    return <Wind className="h-4 w-4 text-foreground" />;
  };

  const toggleTheme = () => setIsDark(!isDark);

  const handleWeatherClick = () => {
    navigate('/?tab=weather');
    // Trigger tab change event
    window.dispatchEvent(new CustomEvent('changeTab', { detail: 'weather' }));
  };

  return (
    <div
      className="fixed top-4 left-1/2 -translate-x-1/2 z-[1001] hidden md:block"
      onMouseEnter={() => setIsExpanded(true)}
      onMouseLeave={() => setIsExpanded(false)}
    >
      <div
        className={`
          glass-strong border border-border/30 rounded-full 
          transition-all duration-300 ease-in-out
          will-change-[padding]
          shadow-lg backdrop-blur-xl
          ${isExpanded ? 'px-6 py-3' : 'px-4 py-2.5'}
        `}
      >
        <div className="flex items-center gap-3">
          {/* Theme Toggle */}
          <Button
            variant="ghost"
            size="sm"
            onClick={toggleTheme}
            className="h-8 w-8 p-0 rounded-full hover:bg-accent/20 transition-colors duration-200"
            title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {isDark ? (
              <Sun className="h-4 w-4 text-amber-400" />
            ) : (
              <Moon className="h-4 w-4 text-slate-700" />
            )}
          </Button>

          {/* Divider */}
          <div
            className={`
              h-6 w-px bg-border/30 
              transition-opacity duration-300 ease-in-out
              ${isExpanded ? 'opacity-100' : 'opacity-0'}
            `}
          />

          {/* Location Info - Clickable to go to weather */}
          <div
            onClick={handleWeatherClick}
            className={`
              flex items-center gap-3 text-sm overflow-hidden whitespace-nowrap
              transition-all duration-300 ease-in-out
              will-change-[max-width,opacity]
              cursor-pointer hover:opacity-80
              ${isExpanded ? 'max-w-[600px] opacity-100' : 'max-w-0 opacity-0'}
            `}
          >
            <MapPin className="h-4 w-4 text-primary flex-shrink-0" />
            <div className="flex flex-col min-w-0">
              <span className="font-medium text-foreground truncate">
                {cityName}
              </span>
              {userLocation && cityName !== 'Detecting...' && (
                <span className="text-xs text-muted-foreground truncate">
                  {userLocation.lat.toFixed(4)}°, {userLocation.lng.toFixed(4)}°
                </span>
              )}
            </div>

            {/* Weather Info */}
            {weather && cityName !== 'Detecting...' && (
              <>
                <div className="h-6 w-px bg-border/30" />
                <div className="flex items-center gap-1.5">
                  {getWeatherIcon(weather.weatherCode, weather.isDay)}
                  <div className="flex flex-col">
                    <span className="font-semibold text-foreground">{weather.temperature}°C</span>
                    <span className="text-xs text-muted-foreground">{weather.description}</span>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Compact Location Indicator - Clickable */}
          <div
            onClick={handleWeatherClick}
            className={`
              flex items-center gap-1.5 whitespace-nowrap
              transition-all duration-300 ease-in-out
              will-change-[max-width,opacity]
              cursor-pointer hover:opacity-80
              ${isExpanded ? 'max-w-0 opacity-0' : 'max-w-[200px] opacity-100'}
            `}
          >
            <MapPin className="h-4 w-4 text-primary flex-shrink-0" />
            <span className="text-sm font-medium text-foreground truncate">
              {cityName}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DynamicIsland;
