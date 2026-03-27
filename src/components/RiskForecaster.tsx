import React, { useState, useEffect, useCallback } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { supabase } from '@/integrations/supabase/client';
import {
  Brain,
  CloudRain,
  Wind,
  Thermometer,
  Droplets,
  Mountain,
  AlertTriangle,
  RefreshCw,
  Loader2,
  ChevronDown,
  ChevronUp,
  TrendingUp,
  ShieldAlert,
  Zap,
  Sparkles,
} from 'lucide-react';
import { Location } from '@/types';
import { getIndianState } from '@/utils/api';

interface ForecastDay {
  date: string;
  tempMax: number;
  tempMin: number;
  rain: number;
  windMax: number;
  weatherCode: number;
}

interface RiskPrediction {
  type: string;
  icon: React.ReactNode;
  probability: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
  timeframe: string;
  reasoning: string;
}

interface RiskForecasterProps {
  userLocation: Location | null;
  language: 'en' | 'hi';
}

const RiskForecaster: React.FC<RiskForecasterProps> = ({ userLocation, language }) => {
  const [forecast, setForecast] = useState<ForecastDay[]>([]);
  const [aiAnalysis, setAiAnalysis] = useState<string | null>(null);
  const [risks, setRisks] = useState<RiskPrediction[]>([]);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const t = language === 'hi' ? {
    title: 'AI जोखिम पूर्वानुमान',
    subtitle: '7-दिन का पूर्वानुमानात्मक विश्लेषण',
    analyze: 'AI विश्लेषण चलाएं',
    analyzing: 'विश्लेषण हो रहा है...',
    noLocation: 'स्थान सक्षम करें',
    poweredBy: 'Llama 3 द्वारा संचालित',
    forecastHeader: '7-दिन का मौसम पूर्वानुमान',
    riskHeader: 'AI जोखिम मूल्यांकन',
    viewDetails: 'विस्तृत विश्लेषण',
    hideDetails: 'विश्लेषण छिपाएं',
  } : {
    title: 'AI Risk Forecaster',
    subtitle: '7-Day Predictive Analysis',
    analyze: 'Run AI Analysis',
    analyzing: 'Analyzing...',
    noLocation: 'Enable location',
    poweredBy: 'Powered by Llama 3',
    forecastHeader: '7-Day Weather Outlook',
    riskHeader: 'AI Risk Assessment',
    viewDetails: 'View Detailed Analysis',
    hideDetails: 'Hide Analysis',
  };

  const fetchForecast = useCallback(async () => {
    if (!userLocation) return;
    setLoading(true);
    setError(null);

    try {
      // Step 1: Fetch 7-day forecast from Open-Meteo
      const params = new URLSearchParams({
        latitude: userLocation.lat.toString(),
        longitude: userLocation.lng.toString(),
        daily: 'temperature_2m_max,temperature_2m_min,precipitation_sum,wind_speed_10m_max,weather_code',
        timezone: 'auto',
        forecast_days: '7',
      });

      const res = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`);
      if (!res.ok) throw new Error('Weather API failed');
      const data = await res.json();

      const days: ForecastDay[] = data.daily.time.map((date: string, i: number) => ({
        date,
        tempMax: Math.round(data.daily.temperature_2m_max[i]),
        tempMin: Math.round(data.daily.temperature_2m_min[i]),
        rain: data.daily.precipitation_sum[i] || 0,
        windMax: Math.round(data.daily.wind_speed_10m_max[i]),
        weatherCode: data.daily.weather_code[i],
      }));

      setForecast(days);

      // Step 2: Calculate total rainfall across 7 days
      const totalRain = days.reduce((sum, d) => sum + d.rain, 0);
      const maxWind = Math.max(...days.map(d => d.windMax));
      const maxTemp = Math.max(...days.map(d => d.tempMax));
      const state = getIndianState(userLocation.lat, userLocation.lng, userLocation.name || '');

      // Step 3: Build prompt and call Llama 3
      const weatherSummary = days.map(d =>
        `${d.date}: Temp ${d.tempMin}–${d.tempMax}°C, Rain ${d.rain.toFixed(1)}mm, Wind ${d.windMax}km/h`
      ).join('\n');

      const systemPrompt = `You are a Meteorological Risk Analyst AI for India. Given the 7-day weather forecast, analyze potential disaster risks.

Rules:
- Be specific and quantitative. Mention exact mm of rain, wind speeds, temperatures.
- Predict flooding, landslides, cyclones, heatwaves, cold waves as applicable.
- Give each risk a probability percentage (0-100%).
- Start each risk on a new line with format: **[RISK_TYPE] [PROBABILITY]%** — explanation
- End with 2 bullet points of actionable preparation advice.
- Keep the entire response under 200 words. Be direct, no filler.`;

      const userPrompt = `Location: ${state}, India (${userLocation.lat.toFixed(2)}°N, ${userLocation.lng.toFixed(2)}°E)
7-Day Forecast:
${weatherSummary}

Total 7-day rainfall: ${totalRain.toFixed(1)}mm
Peak wind: ${maxWind}km/h
Peak temperature: ${maxTemp}°C

Analyze disaster risks for this region over the next 7 days.`;

      let aiText = '';
      try {
        const { data: aiData, error: aiError } = await supabase.functions.invoke('v1-copilot-chat', {
          body: {
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: userPrompt },
            ]
          }
        });
        if (aiError) throw aiError;
        aiText = aiData.message;
      } catch {
        // Fallback to direct API
        const response = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: 'llama-3.3-70b-versatile',
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: userPrompt },
            ]
          }),
        });
        if (!response.ok) throw new Error('AI analysis failed');
        const result = await response.json();
        aiText = result.choices[0].message.content;
      }

      setAiAnalysis(aiText);

      // Step 4: Parse risks from AI text
      const parsed: RiskPrediction[] = [];
      const riskPatterns = [
        { regex: /flood/i, type: 'Flood', icon: <Droplets className="h-5 w-5 text-blue-500" /> },
        { regex: /landslide/i, type: 'Landslide', icon: <Mountain className="h-5 w-5 text-amber-700" /> },
        { regex: /cyclone|storm/i, type: 'Cyclone', icon: <Wind className="h-5 w-5 text-cyan-500" /> },
        { regex: /heatwave|heat wave|heat/i, type: 'Heatwave', icon: <Thermometer className="h-5 w-5 text-red-500" /> },
        { regex: /cold wave|cold/i, type: 'Cold Wave', icon: <Thermometer className="h-5 w-5 text-blue-400" /> },
        { regex: /thunder/i, type: 'Thunderstorm', icon: <Zap className="h-5 w-5 text-yellow-500" /> },
      ];

      // Extract probability percentages from AI text
      const probRegex = /(\d{1,3})%/g;
      let match;
      const probabilities: number[] = [];
      while ((match = probRegex.exec(aiText)) !== null) {
        probabilities.push(parseInt(match[1]));
      }

      riskPatterns.forEach((pattern, idx) => {
        if (pattern.regex.test(aiText)) {
          const prob = probabilities[parsed.length] || (totalRain > 50 ? 65 : 30);
          parsed.push({
            type: pattern.type,
            icon: pattern.icon,
            probability: Math.min(prob, 99),
            severity: prob > 75 ? 'critical' : prob > 50 ? 'high' : prob > 30 ? 'medium' : 'low',
            timeframe: '7 days',
            reasoning: `Based on ${totalRain.toFixed(0)}mm total rainfall forecast and ${maxWind}km/h peak winds`,
          });
        }
      });

      setRisks(parsed);
    } catch (err: any) {
      setError(err.message || 'Analysis failed');
    } finally {
      setLoading(false);
    }
  }, [userLocation]);

  // Auto-run on mount
  useEffect(() => {
    if (userLocation) fetchForecast();
  }, [userLocation]);

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'bg-red-500 text-white';
      case 'high': return 'bg-amber-500 text-black';
      case 'medium': return 'bg-yellow-400 text-black';
      default: return 'bg-emerald-500 text-white';
    }
  };

  const getWeatherEmoji = (code: number) => {
    if (code === 0) return '☀️';
    if (code <= 3) return '⛅';
    if (code <= 48) return '🌫️';
    if (code <= 67) return '🌧️';
    if (code <= 77) return '🌨️';
    if (code <= 82) return '🌦️';
    if (code <= 99) return '⛈️';
    return '🌤️';
  };

  if (!userLocation) return null;

  return (
    <Card className="p-0 overflow-hidden border border-primary/20 dark:border-white/10 bg-gradient-to-br from-indigo-50/50 via-white to-blue-50/50 dark:from-slate-900/80 dark:via-slate-900/90 dark:to-indigo-950/40 shadow-xl">
      {/* Header */}
      <div className="p-5 pb-4 border-b border-primary/10 dark:border-white/5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/30">
              <Brain className="h-5 w-5 text-white" />
            </div>
            <div>
              <h3 className="text-sm font-extrabold tracking-tight text-foreground uppercase flex items-center gap-2">
                {t.title}
                <Sparkles className="h-3.5 w-3.5 text-indigo-500 animate-pulse" />
              </h3>
              <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-widest">{t.subtitle}</p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={fetchForecast}
            disabled={loading}
            className="h-8 gap-1.5 text-xs font-bold"
          >
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
            {loading ? t.analyzing : t.analyze}
          </Button>
        </div>
      </div>

      {/* 7-Day Forecast Strip */}
      {forecast.length > 0 && (
        <div className="px-5 py-3 border-b border-primary/5 dark:border-white/5 overflow-x-auto">
          <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest mb-2">{t.forecastHeader}</p>
          <div className="flex gap-2 min-w-max">
            {forecast.map((day, i) => (
              <div key={i} className="flex flex-col items-center px-3 py-2 rounded-xl bg-white/60 dark:bg-slate-800/40 border border-border/20 min-w-[72px] hover:scale-105 transition-transform">
                <span className="text-[9px] font-bold text-muted-foreground uppercase">
                  {new Date(day.date).toLocaleDateString('en', { weekday: 'short' })}
                </span>
                <span className="text-lg my-0.5">{getWeatherEmoji(day.weatherCode)}</span>
                <span className="text-xs font-black text-foreground">{day.tempMax}°</span>
                <span className="text-[10px] text-muted-foreground">{day.tempMin}°</span>
                {day.rain > 0 && (
                  <span className="text-[9px] text-blue-500 font-bold mt-0.5 flex items-center gap-0.5">
                    <CloudRain className="h-2.5 w-2.5" /> {day.rain.toFixed(0)}mm
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Risk Cards */}
      {risks.length > 0 && (
        <div className="px-5 py-4 space-y-2">
          <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest mb-2">{t.riskHeader}</p>
          {risks.map((risk, i) => (
            <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-white/70 dark:bg-slate-800/50 border border-border/30 hover:border-primary/30 transition-all">
              <div className="flex-shrink-0">{risk.icon}</div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-foreground">{risk.type}</span>
                  <Badge className={`${getSeverityColor(risk.severity)} text-[9px] font-black px-1.5 py-0`}>
                    {risk.severity.toUpperCase()}
                  </Badge>
                </div>
                <p className="text-[10px] text-muted-foreground mt-0.5 truncate">{risk.reasoning}</p>
              </div>
              <div className="flex flex-col items-end flex-shrink-0">
                <span className="text-xl font-black text-foreground tabular-nums">{risk.probability}%</span>
                <span className="text-[8px] text-muted-foreground font-bold uppercase">{risk.timeframe}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* AI Full Analysis (Expandable) */}
      {aiAnalysis && (
        <div className="px-5 pb-4">
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 transition-colors"
          >
            <TrendingUp className="h-3 w-3" />
            {expanded ? t.hideDetails : t.viewDetails}
            {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          </button>
          {expanded && (
            <div className="mt-3 p-4 rounded-xl bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-200/50 dark:border-indigo-500/10 animate-in slide-in-from-top-2 duration-300">
              <div className="text-xs leading-relaxed text-foreground/90 whitespace-pre-line">{aiAnalysis}</div>
              <p className="text-[8px] text-muted-foreground mt-3 font-bold uppercase tracking-widest">{t.poweredBy}</p>
            </div>
          )}
        </div>
      )}

      {/* Loading State */}
      {loading && !aiAnalysis && (
        <div className="px-5 py-8 flex flex-col items-center gap-3">
          <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/30 animate-pulse">
            <Brain className="h-6 w-6 text-white" />
          </div>
          <p className="text-xs font-bold text-muted-foreground">{t.analyzing}</p>
          <Progress value={45} className="w-48 h-1.5" />
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="px-5 py-4 flex items-center gap-2 text-red-500">
          <AlertTriangle className="h-4 w-4" />
          <p className="text-xs font-medium">{error}</p>
        </div>
      )}
    </Card>
  );
};

export default RiskForecaster;
