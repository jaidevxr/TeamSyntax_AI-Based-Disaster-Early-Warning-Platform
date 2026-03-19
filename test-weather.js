
async function testWeather() {
  const lat = 28.6139;
  const lng = 77.2090;
  
  console.log(`Testing weather for Delhi (${lat}, ${lng})...`);
  
  const params = new URLSearchParams({
    latitude: lat.toString(),
    longitude: lng.toString(),
    current: 'temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m,wind_direction_10m,surface_pressure,is_day',
    // elevation: 'true', // Suspected culprit
    hourly: 'temperature_2m,relative_humidity_2m,precipitation_probability,precipitation,weather_code,wind_speed_10m',
    daily: 'temperature_2m_max,temperature_2m_min,precipitation_sum,weather_code,sunrise,sunset,uv_index_max',
    timezone: 'auto',
    forecast_days: '5',
  });

  try {
    const response = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`);
    console.log('Main Weather API Status:', response.status);
    const data = await response.json();
    if (data.error) {
       console.log('API Error:', data.reason);
    } else {
       console.log('Main Weather Data Keys:', Object.keys(data));
       console.log('Current Data:', data.current);
    }

    const aqParams = new URLSearchParams({
      latitude: lat.toString(),
      longitude: lng.toString(),
      current: 'european_aqi,us_aqi,pm10,pm2_5,nitrogen_dioxide,sulphur_dioxide,ozone',
    });
    const aqResponse = await fetch(`https://air-quality-api.open-meteo.com/v1/air-quality?${aqParams}`);
    console.log('Air Quality API Status:', aqResponse.status);
    const aqData = await aqResponse.json();
    console.log('AQ Data Current:', aqData.current);
  } catch (e) {
    console.error('Fetch failed:', e);
  }
}

testWeather();
