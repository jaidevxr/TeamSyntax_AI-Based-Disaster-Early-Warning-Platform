import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// ═══════════════════════════════════════════════════════════════
// MATHEMATICAL SEISMOLOGY MODELS
// ═══════════════════════════════════════════════════════════════

/**
 * Modified Omori's Law: Aftershock rate decay
 * λ(t) = K / (t + c)^p
 * where t = time since mainshock (days), K = productivity, c = time offset, p ≈ 1.0-1.2
 * Reference: Utsu et al. (1995)
 */
function omoriAftershockRate(t_days: number, K: number, c: number = 0.05, p: number = 1.07): number {
  return K / Math.pow(t_days + c, p);
}

/**
 * Reasenberg-Jones aftershock probability model
 * P(≥1 aftershock of M≥Mmin in [t1, t2]) = 1 - exp(-∫λ(t)dt)
 * Integral of Omori: K * [(t2+c)^(1-p) - (t1+c)^(1-p)] / (1-p)  for p≠1
 */
function aftershockProbability(
  mainshockMag: number,
  daysSinceMainshock: number,
  forecastDays: number,
  minAftershockMag: number
): { probability: number; expectedCount: number; model: string } {
  // Bath's Law: largest aftershock ≈ mainshockMag - 1.2
  const bathDelta = 1.2;
  const expectedLargestAftershock = mainshockMag - bathDelta;

  if (minAftershockMag > expectedLargestAftershock + 0.5) {
    return { probability: 0, expectedCount: 0, model: "Bath's Law: min magnitude exceeds expected largest aftershock" };
  }

  // Gutenberg-Richter b-value (typically ~1.0)
  const b = 1.0;
  // Aftershock productivity: a-value from Reasenberg-Jones
  // K = 10^(a + b*(Mm - Mmin)), a ≈ -1.67 (global average)
  const a_val = -1.67;
  const K = Math.pow(10, a_val + b * (mainshockMag - minAftershockMag));

  const c = 0.05; // days
  const p = 1.07; // Omori exponent

  const t1 = daysSinceMainshock;
  const t2 = daysSinceMainshock + forecastDays;

  // Integrate Omori law from t1 to t2
  let expectedCount: number;
  if (Math.abs(p - 1.0) < 0.001) {
    expectedCount = K * (Math.log(t2 + c) - Math.log(t1 + c));
  } else {
    expectedCount = K * (Math.pow(t2 + c, 1 - p) - Math.pow(t1 + c, 1 - p)) / (1 - p);
  }

  // Poisson probability of ≥1 event
  const probability = 1 - Math.exp(-expectedCount);

  return {
    probability: Math.min(probability, 0.99),
    expectedCount,
    model: `Omori-Utsu (K=${K.toFixed(4)}, c=${c}, p=${p}) + Reasenberg-Jones`
  };
}

/**
 * Gutenberg-Richter Frequency-Magnitude Distribution
 * log10(N) = a - b*M
 * Estimates annual rate of earthquakes ≥ M in a region
 */
function gutenbergRichterRate(a_value: number, b_value: number, magnitude: number): number {
  return Math.pow(10, a_value - b_value * magnitude);
}

/**
 * Estimate Gutenberg-Richter a and b values from observed earthquake catalog
 * b-value via maximum likelihood: b = log10(e) / (Mavg - Mmin + ΔM/2)
 * where ΔM = magnitude binning (0.1)
 */
function estimateGRParameters(magnitudes: number[], mMin: number = 2.5): { a: number; b: number; completeness: number } {
  if (magnitudes.length < 3) {
    return { a: 3.0, b: 1.0, completeness: mMin }; // global defaults
  }

  const filteredMags = magnitudes.filter(m => m >= mMin);
  if (filteredMags.length < 3) {
    return { a: 3.0, b: 1.0, completeness: mMin };
  }

  const mAvg = filteredMags.reduce((s, m) => s + m, 0) / filteredMags.length;
  const deltaM = 0.1;

  // Aki-Utsu maximum likelihood b-value
  const b = Math.LOG10E / (mAvg - mMin + deltaM / 2);
  
  // Clamp b-value to physically reasonable range
  const b_clamped = Math.max(0.5, Math.min(2.0, b));

  // a-value from observed count over observation period (30 days → annualize)
  const annualFactor = 365.25 / 30;
  const a = Math.log10(filteredMags.length * annualFactor) + b_clamped * mMin;

  return { a, b: b_clamped, completeness: mMin };
}

/**
 * Hazard function: Probability of exceeding magnitude M in next T days
 * Using Poisson model with Gutenberg-Richter rates
 * P(≥1 event of M≥Mtarget in T days) = 1 - exp(-λ * T/365.25)
 */
function hazardFunction(
  a_value: number, b_value: number, targetMagnitude: number, forecastDays: number
): { probability: number; returnPeriodYears: number } {
  const annualRate = gutenbergRichterRate(a_value, b_value, targetMagnitude);
  const dailyRate = annualRate / 365.25;
  const probability = 1 - Math.exp(-dailyRate * forecastDays);
  const returnPeriodYears = annualRate > 0 ? 1 / annualRate : Infinity;

  return {
    probability: Math.min(probability, 0.99),
    returnPeriodYears
  };
}

/**
 * ETAS-inspired time-series seismicity rate model
 * Total rate = μ (background) + Σ aftershock contributions
 * μ estimated from long-term catalog, aftershocks from Omori for each event
 */
function etasSeismicityRate(
  earthquakes: Array<{ mag: number; time: number; lat: number; lng: number }>,
  currentTime: number,
  forecastDays: number,
  centerLat: number,
  centerLng: number
): { dailyRate: number; backgroundRate: number; triggeredRate: number; clusterScore: number } {
  // Background rate from catalog (events per day)
  const observationDays = 30;
  const backgroundRate = earthquakes.length / observationDays;

  // Triggered rate: sum of Omori aftershock contributions from each event
  let triggeredRate = 0;
  const alpha = 0.8; // magnitude scaling exponent

  for (const eq of earthquakes) {
    const daysSince = (currentTime - eq.time) / (1000 * 60 * 60 * 24);
    if (daysSince < 0.01) continue; // skip if too recent to calculate

    const K = Math.pow(10, alpha * (eq.mag - 2.5)); // productivity scaled by magnitude
    triggeredRate += omoriAftershockRate(daysSince, K);
  }

  // Spatial clustering score: inverse distance weighting
  let clusterScore = 0;
  for (const eq of earthquakes) {
    const dist = haversineDistance(centerLat, centerLng, eq.lat, eq.lng);
    if (dist < 1) continue;
    clusterScore += Math.pow(10, 0.5 * eq.mag) / (dist * dist);
  }
  // Normalize to 0-1 scale
  clusterScore = Math.min(1, clusterScore / 1000);

  const totalDailyRate = backgroundRate + triggeredRate;

  return {
    dailyRate: totalDailyRate,
    backgroundRate,
    triggeredRate,
    clusterScore
  };
}

/**
 * Haversine distance in km
 */
function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ═══════════════════════════════════════════════════════════════
// DATA FETCHING
// ═══════════════════════════════════════════════════════════════

async function fetchWeatherData(lat: number, lon: number) {
  // Use Open-Meteo (no API key required) as primary source
  try {
    const response = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,surface_pressure,wind_speed_10m,weather_code&daily=temperature_2m_max,temperature_2m_min,precipitation_sum&timezone=auto&forecast_days=7`,
      { signal: AbortSignal.timeout(8000) }
    );
    if (!response.ok) throw new Error(`Open-Meteo error: ${response.status}`);
    const data = await response.json();
    return {
      temp: data.current?.temperature_2m,
      pressure: data.current?.surface_pressure,
      humidity: data.current?.relative_humidity_2m,
      wind_speed: data.current?.wind_speed_10m,
      weather_code: data.current?.weather_code,
      daily_precip: data.daily?.precipitation_sum || [],
      daily_temp_max: data.daily?.temperature_2m_max || [],
      daily_temp_min: data.daily?.temperature_2m_min || [],
    };
  } catch (error) {
    console.error('Weather fetch error:', error);
    return null;
  }
}

async function fetchSeismicData(lat: number, lon: number) {
  try {
    // Fetch 90 days of data for better statistical modeling
    const endDate = new Date().toISOString().split('T')[0];
    const startDate = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    const response = await fetch(
      `https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson&starttime=${startDate}&endtime=${endDate}&latitude=${lat}&longitude=${lon}&maxradiuskm=500&minmagnitude=2.0&orderby=time`,
      { signal: AbortSignal.timeout(10000) }
    );

    if (!response.ok) throw new Error(`USGS API error: ${response.status}`);
    const data = await response.json();

    const earthquakes = data.features.map((f: any) => ({
      mag: f.properties.mag,
      time: f.properties.time,
      place: f.properties.place,
      lat: f.geometry.coordinates[1],
      lng: f.geometry.coordinates[0],
      depth: f.geometry.coordinates[2],
    }));

    return earthquakes;
  } catch (error) {
    console.error('Seismic data fetch error:', error);
    return [];
  }
}

async function fetchRecentDisasters(lat: number, lon: number) {
  try {
    const response = await fetch('https://www.gdacs.org/gdacsapi/api/events/geteventlist/MAP', {
      signal: AbortSignal.timeout(8000)
    });
    if (!response.ok) throw new Error(`GDACS error: ${response.status}`);
    const data = await response.json();

    const nearby = data.features?.filter((f: any) => {
      const [eLon, eLat] = f.geometry.coordinates;
      const distance = haversineDistance(lat, lon, eLat, eLon);
      return distance < 1000;
    }) || [];

    return nearby.map((f: any) => ({
      type: f.properties.eventtype,
      severity: f.properties.severitydata?.severity,
      name: f.properties.name,
      date: f.properties.fromdate,
    }));
  } catch (error) {
    console.error('GDACS fetch error:', error);
    return [];
  }
}

// ═══════════════════════════════════════════════════════════════
// MAIN ANALYSIS ENGINE
// ═══════════════════════════════════════════════════════════════

function performSeismicAnalysis(
  earthquakes: Array<{ mag: number; time: number; lat: number; lng: number; depth: number; place: string }>,
  lat: number,
  lon: number
) {
  const now = Date.now();
  const magnitudes = earthquakes.map(e => e.mag);

  // 1. Gutenberg-Richter parameter estimation
  const grParams = estimateGRParameters(magnitudes, 2.5);

  // 2. Hazard function for various magnitude thresholds
  const hazard5 = hazardFunction(grParams.a, grParams.b, 5.0, 30);
  const hazard6 = hazardFunction(grParams.a, grParams.b, 6.0, 30);
  const hazard7 = hazardFunction(grParams.a, grParams.b, 7.0, 30);

  // 3. Aftershock analysis (if significant mainshock detected)
  const maxMag = magnitudes.length > 0 ? Math.max(...magnitudes) : 0;
  const mainshock = earthquakes.find(e => e.mag === maxMag);
  let aftershockAnalysis = null;

  if (mainshock && maxMag >= 4.0) {
    const daysSince = (now - mainshock.time) / (1000 * 60 * 60 * 24);
    
    // Probability of M≥3 aftershock in next 7 days
    const as3 = aftershockProbability(maxMag, daysSince, 7, 3.0);
    // Probability of M≥4 aftershock in next 7 days
    const as4 = aftershockProbability(maxMag, daysSince, 7, 4.0);
    // Probability of M≥(mainshock-1) aftershock in next 30 days
    const asLarge = aftershockProbability(maxMag, daysSince, 30, maxMag - 1.2);

    aftershockAnalysis = {
      mainshockMagnitude: maxMag,
      mainshockLocation: mainshock.place,
      daysSinceMainshock: daysSince,
      bathsLawLargestExpected: maxMag - 1.2,
      forecasts: {
        m3_7day: { ...as3, label: `M≥3.0 in 7 days` },
        m4_7day: { ...as4, label: `M≥4.0 in 7 days` },
        large_30day: { ...asLarge, label: `M≥${(maxMag - 1.2).toFixed(1)} in 30 days` },
      },
      currentOmoriRate: omoriAftershockRate(daysSince, Math.pow(10, -1.67 + 1.0 * (maxMag - 2.5))),
    };
  }

  // 4. ETAS time-series rate
  const etasRate = etasSeismicityRate(earthquakes, now, 30, lat, lon);

  // 5. Temporal clustering detection
  const last7days = earthquakes.filter(e => (now - e.time) < 7 * 24 * 60 * 60 * 1000);
  const prev7days = earthquakes.filter(e => {
    const age = now - e.time;
    return age >= 7 * 24 * 60 * 60 * 1000 && age < 14 * 24 * 60 * 60 * 1000;
  });
  const accelerationRatio = prev7days.length > 0 ? last7days.length / prev7days.length : last7days.length > 0 ? 2.0 : 0;

  return {
    catalogSize: earthquakes.length,
    observationPeriodDays: 90,
    gutenbergRichter: {
      a_value: grParams.a,
      b_value: grParams.b,
      completeness_magnitude: grParams.completeness,
      interpretation: grParams.b < 0.8 ? 'Low b-value suggests stress accumulation (higher large-event probability)' :
        grParams.b > 1.3 ? 'High b-value suggests swarm activity or volcanic influence' :
          'Normal b-value (~1.0) consistent with tectonic seismicity'
    },
    hazardFunction: {
      m5_30day: { magnitude: 5.0, days: 30, ...hazard5 },
      m6_30day: { magnitude: 6.0, days: 30, ...hazard6 },
      m7_30day: { magnitude: 7.0, days: 30, ...hazard7 },
    },
    aftershockAnalysis,
    etasModel: {
      dailyRate: etasRate.dailyRate,
      backgroundRate: etasRate.backgroundRate,
      triggeredRate: etasRate.triggeredRate,
      spatialClusterScore: etasRate.clusterScore,
      elevated: etasRate.dailyRate > etasRate.backgroundRate * 2,
    },
    temporalClustering: {
      last7days: last7days.length,
      prev7days: prev7days.length,
      accelerationRatio,
      isAccelerating: accelerationRatio > 1.5,
    },
    maxMagnitude: maxMag,
    avgDepthKm: earthquakes.length > 0 ? earthquakes.reduce((s, e) => s + (e.depth || 0), 0) / earthquakes.length : 0,
  };
}

async function generatePredictions(
  seismicAnalysis: any,
  weather: any,
  disasters: any[],
  lat: number,
  lon: number
) {
  const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
  if (!LOVABLE_API_KEY) {
    throw new Error('LOVABLE_API_KEY is not configured');
  }

  const systemPrompt = `You are an expert seismologist and disaster prediction AI. You have been given the results of rigorous mathematical analysis including:

1. **Gutenberg-Richter Frequency-Magnitude Distribution**: Estimated a/b values from regional earthquake catalog using Aki-Utsu maximum likelihood method.
2. **Modified Omori-Utsu Aftershock Decay Law**: Aftershock rate λ(t) = K/(t+c)^p with Reasenberg-Jones probability forecasting.
3. **Poisson Hazard Function**: P(≥1 event M≥M_target in T days) = 1 - exp(-λT) using G-R rates.
4. **ETAS (Epidemic Type Aftershock Sequence) Model**: Background + triggered seismicity rate with spatial clustering.
5. **Bath's Law**: Expected largest aftershock magnitude = mainshock - 1.2.
6. **Temporal Clustering Analysis**: Acceleration ratio between recent and prior seismicity windows.

Use these quantitative results to generate evidence-based predictions. DO NOT invent probabilities—use the computed values directly. Explain the mathematical basis in your reasoning. If the data shows low risk, say so clearly.`;

  const userPrompt = `Location: (${lat}, ${lon})

═══ SEISMIC MATHEMATICAL ANALYSIS ═══
${JSON.stringify(seismicAnalysis, null, 2)}

═══ WEATHER CONDITIONS ═══
${JSON.stringify(weather, null, 2)}

═══ ACTIVE REGIONAL DISASTERS (GDACS) ═══
${JSON.stringify(disasters, null, 2)}

Based on the mathematical models above, generate predictions. Use the computed hazard probabilities directly. Include the specific equations and parameter values in your reasoning.`;

  const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${LOVABLE_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'google/gemini-2.5-flash',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      tools: [{
        type: 'function',
        function: {
          name: 'predict_disasters',
          description: 'Return mathematically-grounded disaster predictions',
          parameters: {
            type: 'object',
            properties: {
              predictions: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    type: {
                      type: 'string',
                      enum: ['earthquake', 'flood', 'cyclone', 'wildfire', 'drought', 'tsunami', 'landslide'],
                    },
                    probability: { type: 'number', description: 'Use computed hazard probability (0-1)' },
                    severity: { type: 'string', enum: ['low', 'medium', 'high', 'critical'] },
                    timeframe_days: { type: 'number' },
                    confidence: { type: 'number', description: 'Model confidence (0-1)' },
                    reasoning: { type: 'string', description: 'Mathematical basis with equations and parameter values' },
                    affected_area: { type: 'string' },
                    mathematical_model: { type: 'string', description: 'Primary model used (e.g., Omori-Utsu, Gutenberg-Richter, ETAS, Poisson Hazard)' }
                  },
                  required: ['type', 'probability', 'severity', 'timeframe_days', 'confidence', 'reasoning', 'affected_area', 'mathematical_model'],
                  additionalProperties: false
                }
              },
              seismic_summary: {
                type: 'object',
                properties: {
                  risk_level: { type: 'string', enum: ['low', 'moderate', 'elevated', 'high', 'critical'] },
                  b_value_interpretation: { type: 'string' },
                  aftershock_status: { type: 'string' },
                  etas_assessment: { type: 'string' }
                },
                required: ['risk_level', 'b_value_interpretation', 'aftershock_status', 'etas_assessment'],
                additionalProperties: false
              }
            },
            required: ['predictions', 'seismic_summary'],
            additionalProperties: false
          }
        }
      }],
      tool_choice: { type: 'function', function: { name: 'predict_disasters' } }
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('AI API error:', response.status, errorText);
    throw new Error(`AI API error: ${response.status}`);
  }

  const result = await response.json();

  if (!result.choices?.[0]?.message?.tool_calls?.[0]) {
    throw new Error('No predictions returned from AI');
  }

  const toolCall = result.choices[0].message.tool_calls[0];
  return JSON.parse(toolCall.function.arguments);
}

// ═══════════════════════════════════════════════════════════════
// EDGE FUNCTION HANDLER
// ═══════════════════════════════════════════════════════════════

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { latitude, longitude } = await req.json();

    if (!latitude || !longitude) {
      return new Response(
        JSON.stringify({ error: 'Latitude and longitude are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`🔬 Running seismic analysis for (${latitude}, ${longitude})`);

    // Fetch all data sources in parallel
    const [weather, earthquakes, disasters] = await Promise.all([
      fetchWeatherData(latitude, longitude),
      fetchSeismicData(latitude, longitude),
      fetchRecentDisasters(latitude, longitude)
    ]);

    console.log(`📊 Catalog: ${earthquakes.length} earthquakes in 90 days, ${disasters.length} GDACS events`);

    // Perform mathematical seismic analysis
    const seismicAnalysis = performSeismicAnalysis(earthquakes, latitude, longitude);
    console.log(`📐 G-R params: a=${seismicAnalysis.gutenbergRichter.a_value.toFixed(2)}, b=${seismicAnalysis.gutenbergRichter.b_value.toFixed(2)}`);
    
    if (seismicAnalysis.aftershockAnalysis) {
      console.log(`⚠️ Aftershock sequence detected: M${seismicAnalysis.aftershockAnalysis.mainshockMagnitude} mainshock`);
    }

    // Generate AI predictions grounded in mathematical analysis
    const aiResult = await generatePredictions(seismicAnalysis, weather, disasters, latitude, longitude);

    return new Response(
      JSON.stringify({
        predictions: aiResult.predictions,
        seismic_summary: aiResult.seismic_summary,
        mathematical_analysis: {
          gutenberg_richter: seismicAnalysis.gutenbergRichter,
          hazard_function: seismicAnalysis.hazardFunction,
          aftershock_analysis: seismicAnalysis.aftershockAnalysis,
          etas_model: seismicAnalysis.etasModel,
          temporal_clustering: seismicAnalysis.temporalClustering,
          catalog_stats: {
            total_events: seismicAnalysis.catalogSize,
            observation_days: seismicAnalysis.observationPeriodDays,
            max_magnitude: seismicAnalysis.maxMagnitude,
            avg_depth_km: seismicAnalysis.avgDepthKm,
          }
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in predict-disasters:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
