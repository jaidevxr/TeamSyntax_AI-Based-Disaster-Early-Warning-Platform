import React, { useState, useEffect, useRef } from 'react';
import {
  Cloud, Droplets, Wind, Thermometer, AlertCircle, Eye, MapPin,
  Sunrise, Sunset, Gauge, CloudRain, CloudSnow, CloudDrizzle,
  CloudFog, Zap, Snowflake, Sun, Moon, Umbrella, Navigation, Clock
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import { WeatherData, WeatherAlert, Location } from '@/types';
import { searchLocation } from '@/utils/api';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, AreaChart } from 'recharts';

interface WeatherWidgetProps {
  weather: WeatherData | null;
  loading?: boolean;
  onLocationChange?: (location: Location) => void;
  userLocation?: Location | null;
}

const WeatherWidget: React.FC<WeatherWidgetProps> = ({ weather, loading, onLocationChange, userLocation }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<Location[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const searchContainerRef = useRef<HTMLDivElement>(null);

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
    if (onLocationChange) {
      onLocationChange(location);
    }
    setSearchQuery('');
    setSearchResults([]);
    setShowDropdown(false);
  };

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <Card key={i} className="bg-[#E5F5F9] border-2 border-[#A7D8F0] p-6 animate-pulse">
            <div className="h-8 bg-muted rounded mb-4"></div>
            <div className="space-y-2">
              <div className="h-4 bg-muted rounded w-3/4"></div>
              <div className="h-4 bg-muted rounded w-1/2"></div>
            </div>
          </Card>
        ))}
      </div>
    );
  }

  if (!weather) {
    return (
      <Card className="bg-[#E5F5F9] border-2 border-[#A7D8F0] p-8 text-center">
        <Cloud className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
        <h3 className="font-semibold text-lg mb-2">Weather Data Unavailable</h3>
        <p className="text-muted-foreground">
          Unable to fetch weather information. Please check your location settings.
        </p>
      </Card>
    );
  }

  const getAlertSeverityColor = (severity: string) => {
    switch (severity) {
      case 'extreme':
        return 'severity-high';
      case 'severe':
        return 'severity-medium';
      default:
        return 'severity-low';
    }
  };

  const getWindDirection = (deg?: number) => {
    if (!deg) return 'N/A';
    const directions = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
    return directions[Math.round(deg / 22.5) % 16];
  };

  const formatTime = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleTimeString('en-IN', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  };

  const getAirQualityColor = (aqi?: number) => {
    if (aqi === undefined || aqi === null) return 'bg-[#E5F5F9] border-[#A7D8F0]';
    if (aqi <= 50) return 'bg-[#E5F5F9] border-[#A7D8F0]';
    if (aqi <= 100) return 'bg-[#D9E4F5] border-[#A7D8F0]';
    if (aqi <= 150) return 'bg-[#D9E4F5]/80 border-[#708090]';
    if (aqi <= 200) return 'bg-[#708090]/20 border-[#708090]';
    return 'bg-[#1E415D]/20 border-[#1E415D]';
  };

  const getUVColor = (uv?: number) => {
    if (!uv) return 'bg-[#E5F5F9] border-[#A7D8F0]';
    if (uv < 3) return 'bg-[#E5F5F9] border-[#A7D8F0]';
    if (uv < 6) return 'bg-[#D9E4F5] border-[#A7D8F0]';
    if (uv < 8) return 'bg-[#D9E4F5]/80 border-[#708090]';
    if (uv < 11) return 'bg-[#708090]/20 border-[#708090]';
    return 'bg-[#1E415D]/20 border-[#1E415D]';
  };

  const getUVLabel = (uv?: number) => {
    if (!uv) return 'N/A';
    if (uv < 3) return 'Low';
    if (uv < 6) return 'Moderate';
    if (uv < 8) return 'High';
    if (uv < 11) return 'Very High';
    return 'Extreme';
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* City Search */}
      <Card className="bg-[#E5F5F9] border-2 border-[#A7D8F0] p-3 sm:p-4">
        <div className="space-y-3">
          <div ref={searchContainerRef} className="relative">
            <MapPin className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <Input
              type="text"
              placeholder="Search city to view weather..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 bg-[#E5F5F9] border-2 border-[#A7D8F0] focus:border-[#1E415D] text-[#1E415D]"
            />
            {isSearching && (
              <div className="absolute right-3 top-1/2 transform -translate-y-1/2 pointer-events-none">
                <div className="animate-spin h-4 w-4 border-2 border-primary border-t-transparent rounded-full" />
              </div>
            )}

            {/* Dropdown Results */}
            {showDropdown && searchResults.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-card border border-border rounded-lg shadow-lg z-50 max-h-60 overflow-y-auto">
                {searchResults.map((result, index) => (
                  <div
                    key={index}
                    onClick={() => handleSelectLocation(result)}
                    className="flex items-center gap-3 p-3 hover:bg-accent cursor-pointer transition-colors border-b border-border last:border-0"
                  >
                    <MapPin className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{result.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {result.lat.toFixed(4)}, {result.lng.toFixed(4)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {searchQuery.trim() && !isSearching && searchResults.length === 0 && showDropdown && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-card border border-border rounded-lg shadow-lg z-50 p-3">
                <p className="text-sm text-muted-foreground text-center">No cities found</p>
              </div>
            )}
          </div>

          {userLocation && weather && (
            <p className="text-xs text-muted-foreground text-center">
              Showing weather for: {weather.location.name || `${weather.location.lat.toFixed(4)}, ${weather.location.lng.toFixed(4)}`}
            </p>
          )}
        </div>
      </Card>

      {/* Current Weather - Enhanced */}
      <Card className="bg-[#E5F5F9] border-2 border-[#A7D8F0] p-4 sm:p-6">
        <div className="flex items-start justify-between mb-4 sm:mb-6">
          <div className="min-w-0">
            <h2 className="text-lg sm:text-2xl font-bold text-[#1E415D] flex items-center gap-2">
              <Cloud className="h-5 w-5 sm:h-6 sm:w-6 flex-shrink-0" />
              <span className="truncate">Current Weather</span>
            </h2>
            <p className="text-muted-foreground flex items-center gap-1 mt-1 text-xs sm:text-sm">
              <MapPin className="h-3 w-3 flex-shrink-0" />
              <span className="truncate">{weather.location.name || `${weather.location.lat.toFixed(4)}, ${weather.location.lng.toFixed(4)}`}</span>
            </p>
          </div>
          <div className="text-right flex-shrink-0 ml-3">
            <div className="text-3xl sm:text-5xl font-bold text-primary">{weather.temperature}°C</div>
            <p className="text-xs sm:text-sm text-muted-foreground capitalize mt-1">{weather.condition}</p>
            {weather.feelsLike && (
              <p className="text-[10px] sm:text-xs text-muted-foreground mt-1">
                Feels like {weather.feelsLike}°C
              </p>
            )}
          </div>
        </div>

        {/* Detailed Weather Metrics Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 sm:gap-4 mb-4 sm:mb-6">
          <div className="flex items-center gap-3 p-4 rounded-xl bg-[#D9E4F5]/50 dark:bg-[#1E415D]/20 border border-[#A7D8F0]/50 dark:border-white/5 transition-all hover:bg-[#D9E4F5] dark:hover:bg-[#1E415D]/40">
            <div className="h-10 w-10 rounded-lg bg-blue-500/10 flex items-center justify-center border border-blue-500/10">
              <Droplets className="h-5 w-5 text-blue-400" />
            </div>
            <div>
              <p className="text-[10px] font-black text-[#708090] uppercase tracking-wider">Humidity</p>
              <p className="font-mono text-lg font-bold text-[#1E415D] dark:text-emerald-100">{weather.humidity}%</p>
            </div>
          </div>

          <div className="flex items-center gap-3 p-4 rounded-xl bg-[#D9E4F5]/50 dark:bg-[#1E415D]/20 border border-[#A7D8F0]/50 dark:border-white/5 transition-all hover:bg-[#D9E4F5] dark:hover:bg-[#1E415D]/40">
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center border border-primary/10">
              <Wind className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-[10px] font-black text-[#708090] uppercase tracking-wider">Wind Velocity</p>
              <p className="font-mono text-lg font-bold text-[#1E415D] dark:text-emerald-100">{weather.windSpeed} km/h</p>
            </div>
          </div>

          <div className="flex items-center gap-3 p-4 rounded-xl bg-[#D9E4F5]/50 dark:bg-[#1E415D]/20 border border-[#A7D8F0]/50 dark:border-white/5 transition-all hover:bg-[#D9E4F5] dark:hover:bg-[#1E415D]/40">
            <div className="h-10 w-10 rounded-lg bg-emerald-500/10 flex items-center justify-center border border-emerald-500/10">
              <CloudRain className="h-5 w-5 text-emerald-400" />
            </div>
            <div>
              <p className="text-[10px] font-black text-[#708090] uppercase tracking-wider">Precipitation</p>
              <p className="font-mono text-lg font-bold text-[#1E415D] dark:text-emerald-100">{weather.rainfall} mm</p>
            </div>
          </div>

          {weather.visibility !== undefined && (
            <div className="flex items-center gap-3 p-4 rounded-xl bg-[#D9E4F5]/50 dark:bg-[#1E415D]/20 border border-[#A7D8F0]/50 dark:border-white/5 transition-all hover:bg-[#D9E4F5] dark:hover:bg-[#1E415D]/40">
              <div className="h-10 w-10 rounded-lg bg-amber-500/10 flex items-center justify-center border border-amber-500/10">
                <Eye className="h-5 w-5 text-amber-400" />
              </div>
              <div>
                <p className="text-[10px] font-black text-[#708090] uppercase tracking-wider">Visibility</p>
                <p className="font-mono text-lg font-bold text-[#1E415D] dark:text-emerald-100">{weather.visibility} km</p>
              </div>
            </div>
          )}

          {weather.pressure && (
            <div className="flex items-center gap-3 p-3 rounded-lg bg-[#D9E4F5]/50 dark:bg-card/50 border border-[#A7D8F0]/80 dark:border-border/30">
              <div className="p-2 rounded-lg bg-accent/10">
                <Gauge className="h-5 w-5 text-accent" />
              </div>
              <div>
                <p className="text-xs text-[#708090]">Pressure</p>
                <p className="font-semibold text-lg text-[#1E415D] dark:text-[#1E415D]">{weather.pressure} hPa</p>
              </div>
            </div>
          )}

          {weather.sunrise && (
            <div className="flex items-center gap-3 p-3 rounded-lg bg-[#D9E4F5]/50 dark:bg-card/50 border border-[#A7D8F0]/80 dark:border-border/30">
              <div className="p-2 rounded-lg bg-amber-500/10">
                <Sunrise className="h-5 w-5 text-amber-500" />
              </div>
              <div>
                <p className="text-xs text-[#708090]">Sunrise</p>
                <p className="font-semibold text-lg text-[#1E415D] dark:text-[#1E415D]">{formatTime(weather.sunrise)}</p>
              </div>
            </div>
          )}

          {weather.sunset && (
            <div className="flex items-center gap-3 p-3 rounded-lg bg-[#D9E4F5]/50 dark:bg-card/50 border border-[#A7D8F0]/80 dark:border-border/30">
              <div className="p-2 rounded-lg bg-orange-500/10">
                <Sunset className="h-5 w-5 text-orange-500" />
              </div>
              <div>
                <p className="text-xs text-[#708090]">Sunset</p>
                <p className="font-semibold text-lg text-[#1E415D] dark:text-[#1E415D]">{formatTime(weather.sunset)}</p>
              </div>
            </div>
          )}

          <div className="flex items-center gap-3 p-3 rounded-lg bg-[#D9E4F5]/50 dark:bg-card/50 border border-[#A7D8F0]/80 dark:border-border/30">
            <div className="p-2 rounded-lg bg-purple-500/10">
              <Navigation className="h-5 w-5 text-purple-500" />
            </div>
            <div>
              <p className="text-xs text-[#708090]">Wind Dir.</p>
              <p className="font-semibold text-lg text-[#1E415D] dark:text-[#1E415D]">{getWindDirection(weather.windDirection)}</p>
            </div>
          </div>
        </div>

        {/* UV Index & Air Quality */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4 mb-4 sm:mb-6">
          {weather.uvIndex !== undefined && (
            <div className={`p-4 rounded-xl border ${getUVColor(weather.uvIndex)}`}>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Sun className="h-5 w-5 text-amber-500" />
                  <span className="font-semibold">UV Index</span>
                </div>
                <Badge variant="outline" className={getUVColor(weather.uvIndex)}>
                  {getUVLabel(weather.uvIndex)}
                </Badge>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-2xl font-bold">{weather.uvIndex.toFixed(1)}</span>
                </div>
                <Progress value={Math.min(weather.uvIndex * 10, 100)} className="h-2" />
                <p className="text-xs text-muted-foreground">
                  {weather.uvIndex < 3 ? 'Minimal protection needed' :
                    weather.uvIndex < 6 ? 'Use sun protection if outdoors' :
                      weather.uvIndex < 8 ? 'Protection essential. Reduce sun exposure' :
                        'Avoid sun exposure. Take all precautions'}
                </p>
              </div>
            </div>
          )}

          {weather.airQuality && (
            <div className={`p-4 rounded-xl border ${getAirQualityColor(weather.airQuality.aqi)}`}>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Wind className="h-5 w-5" />
                  <span className="font-semibold">Air Quality</span>
                </div>
                <Badge variant="outline" className={getAirQualityColor(weather.airQuality.aqi)}>
                  {weather.airQuality.quality || 'Unknown'}
                </Badge>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-3xl font-bold">{weather.airQuality.aqi}</span>
                  <span className="text-sm text-muted-foreground">US EPA AQI</span>
                </div>
                <Progress value={Math.min((weather.airQuality.aqi / 500) * 100, 100)} className="h-2" />
                <p className="text-xs text-muted-foreground">
                  {weather.airQuality.aqi <= 50 ? 'Air quality is excellent. Perfect for outdoor activities' :
                    weather.airQuality.aqi <= 100 ? 'Air quality is acceptable for most people' :
                      weather.airQuality.aqi <= 150 ? 'Sensitive groups should limit outdoor exposure' :
                        weather.airQuality.aqi <= 200 ? 'Unhealthy. Limit prolonged outdoor exertion' :
                          weather.airQuality.aqi <= 300 ? 'Very unhealthy. Avoid outdoor activities' :
                            'Hazardous. Stay indoors'}
                </p>
                <div className="grid grid-cols-2 gap-2 mt-2 text-xs">
                  <div>PM2.5: {weather.airQuality.pm25.toFixed(1)} µg/m³</div>
                  <div>PM10: {weather.airQuality.pm10.toFixed(1)} µg/m³</div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Comfort Index */}
        <div className="mt-4 p-4 rounded-xl bg-gradient-to-r from-[#D9E4F5] to-[#E5F5F9] border border-[#A7D8F0]">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Thermometer className="h-5 w-5 text-primary" />
              <span className="font-semibold">Comfort Level</span>
            </div>
            <span className="text-sm font-medium text-primary">
              {weather.temperature > 35 ? 'Very Hot' :
                weather.temperature > 30 ? 'Hot' :
                  weather.temperature > 25 ? 'Comfortable' :
                    weather.temperature > 15 ? 'Cool' : 'Cold'}
            </span>
          </div>
          <Progress
            value={Math.max(0, Math.min(100, (35 - Math.abs(weather.temperature - 25)) * 2))}
            className="h-2"
          />
          <p className="text-xs text-muted-foreground mt-2">
            {weather.temperature > 30 ? 'Stay hydrated and avoid prolonged sun exposure' :
              weather.temperature > 25 ? 'Perfect weather for outdoor activities' :
                weather.temperature > 15 ? 'Light jacket recommended' :
                  'Wear warm clothing'}
          </p>
        </div>
      </Card>

      {/* Hourly Forecast - Next 24 Hours */}
      {weather.hourlyForecast && weather.hourlyForecast.length > 0 && (
        <Card className="bg-[#E5F5F9] border-2 border-[#A7D8F0] p-4 sm:p-6">
          <div className="flex items-center gap-2 mb-4 sm:mb-6">
            <Clock className="h-5 w-5 text-primary" />
            <h3 className="font-semibold text-base sm:text-xl">Hourly Forecast</h3>
          </div>

          {/* Temperature Chart */}
          <div className="mb-4 sm:mb-6 h-48 sm:h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={weather.hourlyForecast.map(hour => ({
                time: formatTime(hour.time),
                temperature: hour.temperature,
                precipitation: hour.precipitation,
              }))}>
                <defs>
                  <linearGradient id="tempGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.8} />
                    <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0.1} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                <XAxis
                  dataKey="time"
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={12}
                  interval="preserveStartEnd"
                />
                <YAxis
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={12}
                  label={{ value: 'Temperature (°C)', angle: -90, position: 'insideLeft' }}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                  }}
                  labelStyle={{ color: 'hsl(var(--foreground))' }}
                />
                <Area
                  type="monotone"
                  dataKey="temperature"
                  stroke="hsl(var(--primary))"
                  fill="url(#tempGradient)"
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Hourly Details Grid */}
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-4 lg:grid-cols-6 gap-2 sm:gap-3 max-h-72 sm:max-h-96 overflow-y-auto">
            {weather.hourlyForecast.map((hour, index) => (
              <div
                key={index}
                className="text-center p-3 rounded-lg bg-[#D9E4F5]/50 dark:bg-card/50 border border-[#A7D8F0]/80 dark:border-border/30 hover:border-primary/30 transition-all"
              >
                <p className="text-xs font-semibold text-[#708090] dark:text-muted-foreground mb-2">
                  {formatTime(hour.time)}
                </p>
                <div className="flex justify-center mb-2">
                  {hour.icon ? (
                    <img
                      src={`https://openweathermap.org/img/wn/${hour.icon}@2x.png`}
                      alt={hour.condition}
                      className="w-12 h-12"
                    />
                  ) : (
                    <span className="text-2xl">☀️</span>
                  )}
                </div>
                <p className="font-bold text-lg mb-1 text-[#1E415D] dark:text-[#1E415D]">{hour.temperature}°</p>
                <p className="text-xs text-[#708090] dark:text-muted-foreground mb-1">{hour.condition}</p>
                {hour.precipitation > 0 && (
                  <div className="flex items-center justify-center gap-1 mt-2 p-1 rounded bg-teal-500/10">
                    <Droplets className="h-3 w-3 text-teal-600" />
                    <p className="text-xs font-medium text-teal-600">{hour.precipitation}%</p>
                  </div>
                )}
                {hour.rain > 0 && (
                  <p className="text-xs text-teal-600 mt-1">{hour.rain.toFixed(1)}mm</p>
                )}
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Weather Alerts - Enhanced */}
      {weather.alerts.length > 0 && (
        <Card className="p-6 border-2" style={{ backgroundColor: '#E5F5F9', borderColor: '#A7D8F0' }}>
          <div className="flex items-center gap-2 mb-6">
            <div className="p-2 rounded-lg animate-pulse" style={{ backgroundColor: '#D9E4F5' }}>
              <AlertCircle className="h-6 w-6" style={{ color: '#1E415D' }} />
            </div>
            <div>
              <h3 className="font-semibold text-xl" style={{ color: '#1E415D' }}>Active Weather Alerts</h3>
              <p className="text-xs" style={{ color: '#708090' }}>
                {weather.alerts.length} active warning{weather.alerts.length > 1 ? 's' : ''}
              </p>
            </div>
          </div>
          <div className="space-y-4">
            {weather.alerts.map((alert) => (
              <div
                key={alert.id}
                className="p-5 rounded-xl border-2 transition-all hover:shadow-lg"
                style={{ backgroundColor: '#ffffff80', borderColor: '#A7D8F0' }}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Zap className="h-5 w-5" style={{ color: '#1E415D' }} />
                    <h4 className="font-semibold text-lg" style={{ color: '#1E415D' }}>{alert.title}</h4>
                  </div>
                  <Badge variant="outline" className="font-bold border-2" style={{ color: '#1E415D', borderColor: '#708090', backgroundColor: '#D9E4F5' }}>
                    {alert.severity.toUpperCase()}
                  </Badge>
                </div>
                <p className="text-sm mb-4 leading-relaxed" style={{ color: '#1E415D' }}>{alert.description}</p>
                <div className="grid grid-cols-2 gap-3 p-3 rounded-lg" style={{ backgroundColor: '#D9E4F580' }}>
                  <div>
                    <p className="text-xs mb-1" style={{ color: '#708090' }}>Starts</p>
                    <p className="text-sm font-medium" style={{ color: '#1E415D' }}>{new Date(alert.start).toLocaleString('en-IN')}</p>
                  </div>
                  <div>
                    <p className="text-xs mb-1" style={{ color: '#708090' }}>Ends</p>
                    <p className="text-sm font-medium" style={{ color: '#1E415D' }}>{new Date(alert.end).toLocaleString('en-IN')}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* 5-Day Forecast - Enhanced */}
      <Card className="bg-[#E5F5F9] border-2 border-[#A7D8F0] p-4 sm:p-6">
        <div className="flex items-center gap-2 mb-4 sm:mb-6">
          <Cloud className="h-5 w-5 text-primary" />
          <h3 className="font-semibold text-base sm:text-xl">5-Day Forecast</h3>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2 sm:gap-4">
          {weather.forecast.slice(0, 5).map((day, index) => (
            <div
              key={index}
              className="text-center p-4 rounded-xl bg-gradient-to-br from-[#E5F5F9] to-[#D9E4F5] border border-[#A7D8F0] hover:border-[#1E415D] transition-all hover:shadow-lg"
            >
              <p className="text-sm font-semibold text-[#1E415D] mb-2">
                {new Date(day.date).toLocaleDateString('en-IN', { weekday: 'short', month: 'short', day: 'numeric' })}
              </p>
              <div className="text-4xl mb-3">
                {day.icon || '☀️'}
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-center gap-2">
                  <Thermometer className="h-4 w-4 text-destructive" />
                  <p className="font-bold text-lg">{day.temperature.max}°</p>
                </div>
                <div className="flex items-center justify-center gap-2">
                  <Snowflake className="h-4 w-4 text-teal-500" />
                  <p className="text-sm text-muted-foreground">{day.temperature.min}°</p>
                </div>
                {day.rainfall > 0 && (
                  <div className="flex items-center justify-center gap-1 mt-2 p-1 rounded bg-teal-500/10">
                    <Umbrella className="h-3 w-3 text-teal-600" />
                    <p className="text-xs font-medium text-teal-600">{day.rainfall}mm</p>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
};

export default WeatherWidget;
