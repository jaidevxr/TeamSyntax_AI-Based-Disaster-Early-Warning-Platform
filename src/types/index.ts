export interface Location {
  lat: number;
  lng: number;
  name?: string;
}

export interface DisasterEvent {
  id: string;
  type: 'earthquake' | 'flood' | 'cyclone' | 'fire' | 'landslide' | 'wildfire' | 'drought' | 'tsunami';
  severity: 'low' | 'medium' | 'high' | 'critical';
  magnitude?: number;
  location: Location;
  time?: string;
  timestamp?: string;
  title: string;
  description: string;
  url?: string;
  lat?: number;
  lng?: number;
  source?: string;
  affectedPopulation?: number;
  isPrediction?: boolean;
  probability?: number;
  confidence?: number;
  timeframeDays?: number;
}

export interface WeatherData {
  location: Location;
  temperature: number;
  humidity: number;
  windSpeed: number;
  rainfall: number;
  condition: string;
  icon: string;
  alerts: WeatherAlert[];
  forecast: WeatherForecast[];
  feelsLike?: number;
  pressure?: number;
  windDirection?: number;
  visibility?: number;
  uvIndex?: number;
  sunrise?: number;
  sunset?: number;
  isDay?: number;
  airQuality?: {
    aqi: number;
    quality: string;
    pm25: number;
    pm10: number;
  };
  hourlyForecast?: HourlyForecast[];
}

export interface HourlyForecast {
  time: number;
  temperature: number;
  feelsLike: number;
  precipitation: number;
  rain: number;
  humidity: number;
  windSpeed: number;
  condition: string;
  description: string;
  icon: string;
}

export interface WeatherAlert {
  id: string;
  title: string;
  description: string;
  severity: 'minor' | 'moderate' | 'severe' | 'extreme';
  start: string;
  end: string;
}

export interface WeatherForecast {
  date: string;
  temperature: { min: number; max: number };
  rainfall: number;
  condition: string;
  icon: string;
}

export interface EmergencyFacility {
  id: string;
  name: string;
  type: 'shelter' | 'hospital' | 'police' | 'fire_station';
  location: Location;
  distance?: number;
  contact?: string;
  capacity?: number;
  amenities?: string[];
  isOpen?: boolean;
}

export interface EmergencyService {
  id: string;
  name: string;
  type: string;
  lat: number;
  lng: number;
  distance: number;
  address?: string;
}

export interface ChatMessage {
  id: string;
  content: string;
  sender: 'user' | 'bot';
  timestamp: string;
}

export interface HeatmapPoint {
  lat: number;
  lng: number;
  intensity: number;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}