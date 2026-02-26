import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const OPENWEATHER_API_KEY = Deno.env.get('OPENWEATHER_API_KEY');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { lat, lng } = await req.json();

    if (!lat || !lng) {
      throw new Error('Latitude and longitude are required');
    }

    console.log(`Fetching weather for: ${lat}, ${lng}`);

    // Fetch current weather (Free tier - API 2.5)
    const currentWeatherUrl = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lng}&units=metric&appid=${OPENWEATHER_API_KEY}`;
    const currentWeatherResponse = await fetch(currentWeatherUrl);
    
    if (!currentWeatherResponse.ok) {
      const errorText = await currentWeatherResponse.text();
      console.error('OpenWeather API error:', errorText);
      throw new Error(`OpenWeather API error: ${currentWeatherResponse.statusText}`);
    }
    
    const currentWeatherData = await currentWeatherResponse.json();

    // Fetch 5-day forecast (Free tier - API 2.5)
    const forecastUrl = `https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lng}&units=metric&appid=${OPENWEATHER_API_KEY}`;
    const forecastResponse = await fetch(forecastUrl);
    const forecastData = await forecastResponse.json();

    // Fetch air quality
    const airQualityUrl = `https://api.openweathermap.org/data/2.5/air_pollution?lat=${lat}&lon=${lng}&appid=${OPENWEATHER_API_KEY}`;
    const airQualityResponse = await fetch(airQualityUrl);
    const airQualityData = await airQualityResponse.json();

    // Process current weather
    const weatherData = {
      temperature: Math.round(currentWeatherData.main.temp),
      feelsLike: Math.round(currentWeatherData.main.feels_like),
      humidity: currentWeatherData.main.humidity,
      pressure: currentWeatherData.main.pressure,
      windSpeed: Math.round(currentWeatherData.wind.speed * 3.6), // Convert m/s to km/h
      windDirection: currentWeatherData.wind.deg,
      visibility: Math.round(currentWeatherData.visibility / 1000), // Convert to km
      uvIndex: 0, // Will be updated from air quality or separate call
      clouds: currentWeatherData.clouds.all,
      sunrise: currentWeatherData.sys.sunrise,
      sunset: currentWeatherData.sys.sunset,
      condition: currentWeatherData.weather[0].main,
      description: currentWeatherData.weather[0].description,
      icon: currentWeatherData.weather[0].icon,
      isDay: currentWeatherData.weather[0].icon.includes('d') ? 1 : 0,
    };

    // Process air quality - Calculate US EPA AQI from PM2.5
    const airQuality = airQualityData.list?.[0];
    const pm25 = airQuality?.components?.pm2_5 || 0;
    const pm10 = airQuality?.components?.pm10 || 0;
    
    // Calculate US EPA AQI from PM2.5 (0-500 scale)
    const calculateAQI = (pm25: number): number => {
      const breakpoints = [
        { cLow: 0, cHigh: 12, iLow: 0, iHigh: 50 },
        { cLow: 12.1, cHigh: 35.4, iLow: 51, iHigh: 100 },
        { cLow: 35.5, cHigh: 55.4, iLow: 101, iHigh: 150 },
        { cLow: 55.5, cHigh: 150.4, iLow: 151, iHigh: 200 },
        { cLow: 150.5, cHigh: 250.4, iLow: 201, iHigh: 300 },
        { cLow: 250.5, cHigh: 350.4, iLow: 301, iHigh: 400 },
        { cLow: 350.5, cHigh: 500.4, iLow: 401, iHigh: 500 },
      ];
      
      for (const bp of breakpoints) {
        if (pm25 >= bp.cLow && pm25 <= bp.cHigh) {
          return Math.round(((bp.iHigh - bp.iLow) / (bp.cHigh - bp.cLow)) * (pm25 - bp.cLow) + bp.iLow);
        }
      }
      return pm25 > 500.4 ? 500 : 0;
    };
    
    const usAqi = calculateAQI(pm25);
    const getAqiQuality = (aqi: number): string => {
      if (aqi <= 50) return 'Good';
      if (aqi <= 100) return 'Moderate';
      if (aqi <= 150) return 'Unhealthy for Sensitive';
      if (aqi <= 200) return 'Unhealthy';
      if (aqi <= 300) return 'Very Unhealthy';
      return 'Hazardous';
    };
    
    const airQualityInfo = {
      aqi: usAqi,
      quality: getAqiQuality(usAqi),
      pm25: pm25,
      pm10: pm10,
      no2: airQuality?.components?.no2 || 0,
      o3: airQuality?.components?.o3 || 0,
    };

    // Process hourly forecast (next 24 hours from 5-day/3-hour forecast)
    const hourlyForecast = forecastData.list.slice(0, 8).map((hour: any) => ({
      time: hour.dt,
      temperature: Math.round(hour.main.temp),
      feelsLike: Math.round(hour.main.feels_like),
      precipitation: Math.round((hour.pop || 0) * 100), // Probability of precipitation
      rain: hour.rain?.['3h'] || 0,
      humidity: hour.main.humidity,
      windSpeed: Math.round(hour.wind.speed * 3.6),
      condition: hour.weather[0].main,
      description: hour.weather[0].description,
      icon: hour.weather[0].icon,
    }));

    // Process daily forecast (group 3-hour forecasts into daily)
    const dailyMap = new Map();
    forecastData.list.forEach((item: any) => {
      const date = new Date(item.dt * 1000).toDateString();
      if (!dailyMap.has(date)) {
        dailyMap.set(date, {
          temps: [],
          conditions: [],
          precipitation: [],
          humidity: [],
          windSpeed: [],
          item: item
        });
      }
      const day = dailyMap.get(date);
      day.temps.push(item.main.temp);
      day.conditions.push(item.weather[0]);
      day.precipitation.push(item.pop || 0);
      day.humidity.push(item.main.humidity);
      day.windSpeed.push(item.wind.speed);
    });

    const dailyForecast = Array.from(dailyMap.values()).slice(0, 5).map((day: any) => ({
      date: day.item.dt,
      temperature: {
        min: Math.round(Math.min(...day.temps)),
        max: Math.round(Math.max(...day.temps)),
      },
      precipitation: Math.round(Math.max(...day.precipitation) * 100),
      rain: day.item.rain?.['3h'] || 0,
      humidity: Math.round(day.humidity.reduce((a: number, b: number) => a + b, 0) / day.humidity.length),
      windSpeed: Math.round((day.windSpeed.reduce((a: number, b: number) => a + b, 0) / day.windSpeed.length) * 3.6),
      condition: day.conditions[0].main,
      description: day.conditions[0].description,
      icon: day.conditions[0].icon,
      sunrise: currentWeatherData.sys.sunrise,
      sunset: currentWeatherData.sys.sunset,
      uvIndex: 0,
    }));

    // Alerts are not available in free tier, return empty array
    const alerts: any[] = [];

    console.log(`Weather data fetched successfully`);

    return new Response(
      JSON.stringify({
        current: weatherData,
        airQuality: airQualityInfo,
        hourly: hourlyForecast,
        daily: dailyForecast,
        alerts,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error in weather function:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
