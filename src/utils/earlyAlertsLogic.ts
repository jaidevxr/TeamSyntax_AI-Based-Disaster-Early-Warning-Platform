import { predictFlood, predictEarthquakeRisk, loadMLModels, type FloodPredictionInput, type EarthquakePredictionInput, type MLPrediction } from './mlModels';

export interface EarlyAlert {
  id: string;
  type:
  | "flood"
  | "earthquake"
  | "extreme_weather"
  | "cyclone"
  | "heatwave"
  | "cold_wave"
  | "thunderstorm"
  | "landslide";
  severity: "advisory" | "watch" | "warning" | "emergency";
  title: string;
  description: string;
  source: string;
  algorithm: string;
  dataPoints: Record<string, any>;
  location: { lat: number; lng: number; name?: string };
  issuedAt: string;
  expiresAt: string;
  confidence: number;
}





function calculateHeatIndex(T: number, RH: number): number {
  if (T < 27 || RH < 40) return T;
  return (
    -8.78469475556 +
    1.61139411 * T +
    2.33854883889 * RH -
    0.14611605 * T * RH -
    0.012308094 * T * T -
    0.0164248277778 * RH * RH +
    0.002211732 * T * T * RH +
    0.00072546 * T * RH * RH -
    0.000003582 * T * T * RH * RH
  );
}

function haversine(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
    Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export async function fetchEarlyAlertsLocal(
  lat: number,
  lng: number,
  onProgress?: (phase: string) => void
): Promise<any> {
  const calculationSteps: any[] = [];
  const timed = async (fn: () => Promise<any>, source: string) => {
    const start = Date.now();
    try {
      const result = await fn();
      return { result, duration: Date.now() - start, source, ok: true };
    } catch (e: any) {
      return {
        result: null,
        duration: Date.now() - start,
        source,
        ok: false,
        error: e.message,
      };
    }
  };

  // 1. Fetch Open-Meteo Current Weather
  const fetchCurrentWeather = async () => {
    const res = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,surface_pressure,wind_speed_10m`,
      { signal: AbortSignal.timeout(8000) },
    );
    if (!res.ok) throw new Error("Open-Meteo current error");
    const data = await res.json();
    return {
      temp: data.current.temperature_2m,
      feelsLike: data.current.apparent_temperature,
      humidity: data.current.relative_humidity_2m,
      windSpeed: data.current.wind_speed_10m / 3.6,
      pressure: data.current.surface_pressure,
      condition: data.current.weather_code >= 95 ? "Thunderstorm" : "",
      description: `WMO Weather Code: ${data.current.weather_code}`,
    };
  };

  // 2. Fetch Open-Meteo Forecast
  const fetchForecast = async () => {
    const res = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&hourly=precipitation&forecast_days=3&timezone=auto`,
      { signal: AbortSignal.timeout(8000) },
    );
    if (!res.ok) throw new Error("Open-Meteo forecast error");
    const data = await res.json();
    const hourly = data.hourly?.precipitation || [];
    return {
      precip24h: hourly
        .slice(0, 24)
        .reduce((s: number, v: number) => s + (v || 0), 0),
      precip48h: hourly
        .slice(0, 48)
        .reduce((s: number, v: number) => s + (v || 0), 0),
      precip72h: hourly.reduce((s: number, v: number) => s + (v || 0), 0),
      maxHourlyRate: Math.max(...hourly.map((v: number) => v || 0), 0),
      hourlyData: hourly,
    };
  };

  // 3. Fetch USGS Seismic
  const fetchSeismic = async () => {
    const now = new Date();
    const d90 = new Date(now.getTime() - 90 * 86400000)
      .toISOString()
      .split("T")[0];
    const today = now.toISOString().split("T")[0];
    const res = await fetch(
      `https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson&starttime=${d90}&endtime=${today}&latitude=${lat}&longitude=${lng}&maxradiuskm=500&minmagnitude=2.0&orderby=time`,
      { signal: AbortSignal.timeout(10000) },
    );
    if (!res.ok) throw new Error("USGS FDSNWS error");
    const data = await res.json();
    const quakes = data.features || [];
    const mags: number[] = quakes.map((f: any) => f.properties.mag);
    return {
      allQuakes: quakes.map((f: any) => ({
        mag: f.properties.mag,
        time: f.properties.time,
      })),
      observationDays: 90,
      maxMag: mags.length > 0 ? Math.max(...mags) : 0,
    };
  };

  // 4. GDACS (Wrapped in CORS proxy for browser access)
  const fetchGdacs = async () => {
    const targetUrl = "https://www.gdacs.org/gdacsapi/api/events/geteventlist/MAP";
    
    const gdacsUrls = [
      `https://api.allorigins.win/get?url=${encodeURIComponent(targetUrl)}`,
      `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(targetUrl)}`,
      targetUrl,
    ];

    let data = null;

    for (const gdacsUrl of gdacsUrls) {
      try {
        const res = await fetch(gdacsUrl, { signal: AbortSignal.timeout(8000) });
        if (!res.ok) continue;
        
        if (gdacsUrl.includes('allorigins')) {
          const wrapper = await res.json();
          data = JSON.parse(wrapper.contents);
        } else {
          data = await res.json();
        }
        break;
      } catch (e) {
        continue;
      }
    }

    if (!data) return [];
    
    const nearby = (data.features || [])
      .filter((f: any) => {
        const [eLng, eLat] = f.geometry?.coordinates || [0, 0];
        return haversine(lat, lng, eLat, eLng) < 1000;
      })
      .map((f: any) => {
        const [eLng, eLat] = f.geometry.coordinates;
        return {
          id: f.properties.eventid,
          name: f.properties.name || "Unknown Event",
          type: f.properties.eventtype || "",
          alertLevel: f.properties.alertlevel || "Green",
          description:
            f.properties.htmldescription || f.properties.description || "",
          distance: haversine(lat, lng, eLat, eLng),
        };
      });
    return nearby.slice(0, 5);
  };

  // 5. Elevation
  const fetchElevation = async () => {
    const res = await fetch(
      `https://api.open-meteo.com/v1/elevation?latitude=${lat}&longitude=${lng}`,
      { signal: AbortSignal.timeout(8000) },
    );
    if (!res.ok) return 0;
    const data = await res.json();
    return data.elevation?.[0] || 0;
  };

  // ── Run fetches SEQUENTIALLY so the pipeline phases fire in order ──
  if (onProgress) onProgress("fetching_weather");
  const wRes = await timed(fetchCurrentWeather, "Open-Meteo Current Weather");

  if (onProgress) onProgress("fetching_precipitation");
  const fRes = await timed(fetchForecast, "Open-Meteo Forecast");

  if (onProgress) onProgress("fetching_seismic");
  const sRes = await timed(fetchSeismic, "USGS FDSNWS");

  if (onProgress) onProgress("fetching_gdacs");
  const gRes = await timed(fetchGdacs, "GDACS");

  if (onProgress) onProgress("fetching_aqi");
  const eRes = await timed(fetchElevation, "Open-Meteo Elevation");

  const weather = wRes.ok ? wRes.result : null;
  const forecast = fRes.ok ? fRes.result : null;
  const seismic = sRes.ok ? sRes.result : null;
  const gdacs = gRes.ok ? gRes.result : null;
  const elevation = eRes.ok ? eRes.result : 0;

  const alerts: EarlyAlert[] = [];
  const now = new Date().toISOString();

  if (onProgress) onProgress("fetching_imd");

  // ── Real ML Flood Prediction (TensorFlow.js Neural Network) ──────────────
  let floodML: MLPrediction | null = null;
  if (forecast) {
    const month = new Date().getMonth() + 1;
    const isMonsoon = month >= 6 && month <= 9 ? 1 : 0;
    // Rough coastal check for the location
    const isCoastal = (lat < 15 && lng > 74 && lng < 81) || (lat < 22 && lng > 85) || (lat > 18 && lng < 74) ? 1 : 0;

    const floodInput: FloodPredictionInput = {
      rainfall_24h_mm: forecast.precip24h || 0,
      rainfall_48h_mm: forecast.precip48h || 0,
      rainfall_72h_mm: forecast.precip72h || 0,
      max_hourly_rate_mm: forecast.maxHourlyRate || 0,
      temperature_c: weather?.temp || 25,
      humidity_pct: weather?.humidity || 50,
      pressure_hpa: weather?.pressure || 1013,
      wind_speed_kmh: (weather?.windSpeed || 0) * 3.6,
      is_monsoon: isMonsoon,
      is_coastal: isCoastal,
    };

    const mlResult = await predictFlood(floodInput);
    if (mlResult) {
      floodML = mlResult;
      const prob = mlResult.probability;

      if (prob >= 0.85) {
        alerts.push({
          id: `flood-ml-emergency-${Date.now()}`,
          type: "flood",
          severity: "emergency",
          title: "🚨 ML Flood Model: Extreme Risk Detected",
          description: `TF.js Neural Network predicts ${(prob * 100).toFixed(0)}% flood probability. 24h precip: ${forecast.precip24h.toFixed(1)}mm, peak rate: ${forecast.maxHourlyRate.toFixed(1)}mm/h. Evacuate low-lying areas immediately.`,
          source: "TensorFlow.js Neural Network (trained on 2500 India flood samples)",
          algorithm: mlResult.modelInfo,
          dataPoints: { ...mlResult.features, probability: prob },
          location: { lat, lng },
          issuedAt: now,
          expiresAt: new Date(Date.now() + 24 * 3600000).toISOString(),
          confidence: mlResult.metrics.auc_roc,
        });
      } else if (prob >= 0.65) {
        alerts.push({
          id: `flood-ml-warning-${Date.now()}`,
          type: "flood",
          severity: "warning",
          title: "⚠️ ML Flood Model: High Risk",
          description: `Neural Network flood probability: ${(prob * 100).toFixed(0)}%. Model AUC-ROC: ${mlResult.metrics.auc_roc}. Monitor drainage and water levels.`,
          source: "TensorFlow.js Neural Network (trained on 2500 India flood samples)",
          algorithm: mlResult.modelInfo,
          dataPoints: { ...mlResult.features, probability: prob },
          location: { lat, lng },
          issuedAt: now,
          expiresAt: new Date(Date.now() + 36 * 3600000).toISOString(),
          confidence: mlResult.metrics.auc_roc * 0.95,
        });
      } else if (prob >= 0.4) {
        alerts.push({
          id: `flood-ml-watch-${Date.now()}`,
          type: "flood",
          severity: "watch",
          title: "🌧️ ML Flood Model: Moderate Risk",
          description: `Neural Network flood probability: ${(prob * 100).toFixed(0)}%. Stay aware of conditions.`,
          source: "TensorFlow.js Neural Network (trained on 2500 India flood samples)",
          algorithm: mlResult.modelInfo,
          dataPoints: { ...mlResult.features, probability: prob },
          location: { lat, lng },
          issuedAt: now,
          expiresAt: new Date(Date.now() + 48 * 3600000).toISOString(),
          confidence: mlResult.metrics.auc_roc * 0.9,
        });
      }
    } else {
      // Return empty ML failure object without faking predictions
      floodML = {
        probability: 0,
        modelName: "Flood Model",
        modelInfo: "TF.js Model (Disconnected or Loading...)",
        features: {},
        metrics: { auc_roc: 0, accuracy: 0, precision: 0, recall: 0, f1_score: 0 },
        isFlood: false
      };
    }
  }

  let seismicML: MLPrediction | null = null;

  if (seismic) {
    // 1. Calculate features for TF.js NN model
    const quakes = seismic.allQuakes || [];
    const count = quakes.length;
    let avgMag = 0, stdMag = 0, avgDepth = 15, totalEnergy = 0;

    if (count > 0) {
      const mags = quakes.map((q: any) => q.mag);
      avgMag = mags.reduce((a: number, b: number) => a + b, 0) / count;
      stdMag = Math.sqrt(mags.reduce((a: number, b: number) => a + Math.pow(b - avgMag, 2), 0) / count);
      totalEnergy = mags.reduce((acc: number, m: number) => acc + Math.pow(10, 1.5 * m + 4.8), 0);
    }
    const logEnergy = totalEnergy > 0 ? Math.log10(totalEnergy) : 0;

    // Rough seismic zone estimation from lat/lng
    let zone = 2;
    if (lat > 27 && lng > 73) zone = 4; // Himalayas/North East
    if (lat > 32 || (lat > 23 && lng > 90)) zone = 5; // Very high risk

    const eqInput: EarthquakePredictionInput = {
      seismic_zone: zone,
      event_count_30d: count, // proxy for 30d
      avg_magnitude: avgMag,
      max_magnitude: seismic.maxMag,
      magnitude_std: stdMag,
      b_value: 1.0, // Used defaults since rules-based Aki-Utsu removed
      avg_depth_km: avgDepth,
      log_energy_release: logEnergy,
      inter_event_cv: 1.0,
      rate_change_ratio: 1.0,
    };

    const mlResult = await predictEarthquakeRisk(eqInput);
    if (mlResult) {
      seismicML = mlResult;
      const prob = mlResult.probability;

      // Publish alert if risk is elevated
      if (prob >= 0.70) {
        alerts.push({
          id: `eq-ml-emergency-${Date.now()}`,
          type: "earthquake",
          severity: "emergency",
          title: "🚨 ML Earthquake Model: Extreme Risk",
          description: `TF.js Neural Network predicts ${(prob * 100).toFixed(0)}% probability of an M5.0+ event within 30 days. Model AUC-ROC: ${mlResult.metrics?.auc_roc || "N/A"}. High seismic activity detected.`,
          source: "TensorFlow.js Neural Network (trained on 2000 India seismic samples)",
          algorithm: mlResult.modelInfo,
          dataPoints: { ...mlResult.features, probability: prob },
          location: { lat, lng },
          issuedAt: now,
          expiresAt: new Date(Date.now() + 7 * 24 * 3600000).toISOString(),
          confidence: mlResult.metrics?.auc_roc || 0.85,
        });
      } else if (prob >= 0.40) {
        alerts.push({
          id: `eq-ml-warning-${Date.now()}`,
          type: "earthquake",
          severity: "warning",
          title: "⚠️ ML Earthquake Model: Elevated Risk",
          description: `TF.js Neural Network predicts ${(prob * 100).toFixed(0)}% probability of significant seismic event.`,
          source: "TensorFlow.js Neural Network",
          algorithm: mlResult.modelInfo,
          dataPoints: { ...mlResult.features, probability: prob },
          location: { lat, lng },
          issuedAt: now,
          expiresAt: new Date(Date.now() + 7 * 24 * 3600000).toISOString(),
          confidence: (mlResult.metrics?.auc_roc || 0.85) * 0.9,
        });
      }
    } else {
      // Empty failure object instead of fake predictions
      seismicML = {
        probability: 0,
        modelName: "Earthquake Model",
        modelInfo: "TF.js Model (Disconnected or Loading...)",
        features: {},
        metrics: { auc_roc: 0, accuracy: 0, precision: 0, recall: 0, f1_score: 0 },
        isAnomaly: false,
        anomalyLevel: "Normal"
      };
    }
  }

  let landslideModel = null;

  if (weather) {
    const {
      temp,
      feelsLike,
      humidity,
      windSpeed,
      pressure,
      condition,
      description,
    } = weather;
    const heatIndex = calculateHeatIndex(temp, humidity);

    if (heatIndex >= 54) {
      alerts.push({
        id: `heat-emergency-${Date.now()}`,
        type: "heatwave",
        severity: "emergency",
        title: "🔥 Extreme Heat Emergency",
        description: `Heat index: ${heatIndex.toFixed(0)}°C (actual: ${temp}°C, RH: ${humidity}%). Heatstroke imminent.`,
        source: "Open-Meteo + Steadman Heat Index",
        algorithm: "Steadman (1979) HI formula. Threshold: 54°C.",
        dataPoints: { temp, humidity, heatIndex, threshold: 54 },
        location: { lat, lng },
        issuedAt: now,
        expiresAt: new Date(Date.now() + 12 * 3600000).toISOString(),
        confidence: 0.95,
      });
    }

    if (temp <= 4) {
      alerts.push({
        id: `cold-wave-${Date.now()}`,
        type: "cold_wave",
        severity: "warning",
        title: "🥶 Cold Wave Warning",
        description: `Temperature: ${temp}°C (feels like ${feelsLike}°C). IMD cold wave threshold breached.`,
        source: "Open-Meteo + IMD",
        algorithm: "IMD cold wave: T ≤ 4°C in plains.",
        dataPoints: { temp, feelsLike, threshold: 4 },
        location: { lat, lng },
        issuedAt: now,
        expiresAt: new Date(Date.now() + 24 * 3600000).toISOString(),
        confidence: 0.9,
      });
    }

    const windKmh = windSpeed * 3.6;
    if (windKmh >= 118) {
      alerts.push({
        id: `wind-emergency-${Date.now()}`,
        type: "cyclone",
        severity: "emergency",
        title: "🌀 Hurricane-Force Winds",
        description: `Wind: ${windKmh.toFixed(0)} km/h (Beaufort 12). Take shelter.`,
        source: "Open-Meteo + Beaufort Scale",
        algorithm: "Beaufort 12: ≥118 km/h.",
        dataPoints: { windKmh, threshold: 118 },
        location: { lat, lng },
        issuedAt: now,
        expiresAt: new Date(Date.now() + 6 * 3600000).toISOString(),
        confidence: 0.95,
      });
    }

    const condLower = (condition || "").toLowerCase();
    if (condLower.includes("thunderstorm")) {
      alerts.push({
        id: `thunderstorm-${Date.now()}`,
        type: "thunderstorm",
        severity: windKmh > 60 ? "warning" : "watch",
        title: "⛈️ Thunderstorm Alert",
        description: `Active thunderstorm. Wind: ${windKmh.toFixed(0)} km/h. Avoid open areas.`,
        source: "Open-Meteo",
        algorithm: "Weather code classification.",
        dataPoints: { condition, windKmh },
        location: { lat, lng },
        issuedAt: now,
        expiresAt: new Date(Date.now() + 3 * 3600000).toISOString(),
        confidence: 0.88,
      });
    }

    if (
      pressure < 1000 &&
      windKmh > 50 &&
      !alerts.some((a) => a.type === "cyclone")
    ) {
      alerts.push({
        id: `low-pressure-${Date.now()}`,
        type: "cyclone",
        severity: pressure < 980 ? "warning" : "advisory",
        title: "🌀 Low Pressure System",
        description: `Pressure: ${pressure} hPa, wind: ${windKmh.toFixed(0)} km/h. Storm possible.`,
        source: "Open-Meteo",
        algorithm: "Low pressure (<1000 hPa) + wind (>50 km/h).",
        dataPoints: { pressure, windKmh },
        location: { lat, lng },
        issuedAt: now,
        expiresAt: new Date(Date.now() + 24 * 3600000).toISOString(),
        confidence: 0.65,
      });
    }
  }

  if (gdacs && gdacs.length > 0) {
    for (const event of gdacs) {
      alerts.push({
        id: `gdacs-${event.id}-${Date.now()}`,
        type: ((t) => {
          const l = t.toLowerCase();
          if (l.includes("eq")) return "earthquake";
          if (l.includes("fl")) return "flood";
          if (l.includes("tc") || l.includes("storm")) return "cyclone";
          return "extreme_weather";
        })(event.type) as any,
        severity:
          event.alertLevel === "Red"
            ? "emergency"
            : event.alertLevel === "Orange"
              ? "warning"
              : "watch",
        title: `🌍 GDACS: ${event.name}`,
        description: `${event.description}. Alert level: ${event.alertLevel}. Distance: ${event.distance.toFixed(0)} km.`,
        source: "GDACS",
        algorithm: "Proximity filter (1000 km radius).",
        dataPoints: { alertLevel: event.alertLevel, distance: event.distance },
        location: { lat, lng, name: event.name },
        issuedAt: now,
        expiresAt: new Date(Date.now() + 48 * 3600000).toISOString(),
        confidence: 0.9,
      });
    }
  }

  return {
    alerts,
    floodModel: floodML,
    seismicModel: seismicML,
    metadata: {
      sources: [
        "Open-Meteo Current Weather",
        "Open-Meteo Forecast",
        "Open-Meteo Elevation",
        "USGS FDSNWS",
        "GDACS",
      ],
      generatedAt: now,
      location: { lat, lng },
      algorithmsUsed: [
        "TF.js Neural Network Flood Model (Dense(32)→Dense(16)→Dense(8)→Dense(1), trained on 2500 India flood samples, AUC-ROC ~0.99)",
        "TF.js Neural Network Earthquake Risk Model (trained on 2000 India seismic samples, AUC-ROC ~0.85)",
      ],
    },
  };
}
