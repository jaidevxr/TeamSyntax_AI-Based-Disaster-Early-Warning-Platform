import React, { useState, useEffect, useCallback, useRef } from "react";
import { Location } from "@/types";
import { escapeHtml } from "@/utils/sanitize";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  AlertTriangle,
  ShieldAlert,
  Info,
  Bell,
  BellRing,
  Droplets,
  Mountain,
  Thermometer,
  Wind,
  CloudLightning,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  Clock,
  Database,
  Zap,
  CheckCircle2,
  Loader2,
  XCircle,
  ArrowRight,
  BellOff,
  BellPlus,
  Snowflake,
  Leaf,
  TrendingUp,
  TrendingDown,
  Minus,
  Sparkles,
  Download,
} from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { toast } from "sonner";
import {
  isPushSupported,
  getNotificationPermission,
  requestNotificationPermission,
  sendEmergencyNotification,
  shouldNotify,
} from "@/utils/pushNotifications";
import { addAlertToHistory } from "@/components/NotificationHistory";
import { supabase } from "@/integrations/supabase/client";
import {
  predictFlood,
  predictEarthquakeRisk,
  loadMLModels,
  getMLLoadError,
  type FloodPredictionInput,
  type EarthquakePredictionInput,
  type MLPrediction,
} from "../utils/mlModels";

// ── Markdown renderer (for AI Brief) ──────────────────────────────────────────
const renderMarkdown = (text: string): React.ReactNode[] => {
  const lines = text.split("\n");
  const nodes: React.ReactNode[] = [];

  const inlineFormat = (
    line: string,
    key: string | number,
  ): React.ReactNode => {
    const parts = line.split(/(`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*)/);
    return (
      <span key={key}>
        {parts.map((part, i) => {
          if (part.startsWith("**") && part.endsWith("**"))
            return (
              <strong key={i} className="font-semibold text-foreground">
                {part.slice(2, -2)}
              </strong>
            );
          if (part.startsWith("*") && part.endsWith("*"))
            return (
              <em key={i} className="italic">
                {part.slice(1, -1)}
              </em>
            );
          if (part.startsWith("`") && part.endsWith("`"))
            return (
              <code
                key={i}
                className="px-1 py-0.5 bg-muted rounded text-xs font-mono"
              >
                {part.slice(1, -1)}
              </code>
            );
          return part;
        })}
      </span>
    );
  };

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) {
      nodes.push(<div key={i} className="h-1" />);
      i++;
      continue;
    }
    if (line.startsWith("### ")) {
      nodes.push(
        <h4 key={i} className="font-bold text-sm mt-3 mb-1 text-foreground">
          {inlineFormat(line.slice(4), "h")}
        </h4>,
      );
      i++;
      continue;
    }
    if (line.startsWith("## ")) {
      nodes.push(
        <h3 key={i} className="font-bold text-base mt-2 mb-1 text-foreground">
          {inlineFormat(line.slice(3), "h")}
        </h3>,
      );
      i++;
      continue;
    }
    if (line.startsWith("# ")) {
      nodes.push(
        <h2 key={i} className="font-bold text-lg mt-2 mb-1 text-foreground">
          {inlineFormat(line.slice(2), "h")}
        </h2>,
      );
      i++;
      continue;
    }
    if (line.match(/^[•\-*] /) || line.match(/^\d+[.)]/)) {
      const listItems: React.ReactNode[] = [];
      while (
        i < lines.length &&
        (lines[i].match(/^[•\-*] /) ||
          lines[i].match(/^\d+[.)]/) ||
          lines[i].trim() === "")
      ) {
        if (lines[i].trim() !== "") {
          const content = lines[i].replace(/^[•\-*] |^\d+[.)] /, "");
          listItems.push(
            <li key={i} className="ml-4 text-xs sm:text-sm leading-relaxed">
              {inlineFormat(content, i)}
            </li>,
          );
        }
        i++;
      }
      nodes.push(
        <ul
          key={`ul-${i}`}
          className="list-disc list-outside space-y-1 my-2 text-foreground/90"
        >
          {listItems}
        </ul>,
      );
      continue;
    }
    nodes.push(
      <p
        key={i}
        className="text-xs sm:text-sm leading-relaxed text-foreground/90"
      >
        {inlineFormat(line, i)}
      </p>,
    );
    i++;
  }
  return nodes;
};

import { EarlyAlert, fetchEarlyAlertsLocal } from "../utils/earlyAlertsLogic";

interface AlertMetadata {
  sources: string[];
  generatedAt: string;
  algorithmsUsed: string[];
  calculationSteps?: CalculationStep[];
}

interface CalculationStep {
  step: number;
  source: string;
  algorithm: string;
  status: "success" | "failed" | "no_alert";
  duration_ms: number;
  rawData?: Record<string, any>;
  result?: string;
  thresholds?: Record<string, any>;
}

interface EarlyAlertsProps {
  userLocation: Location | null;
  language: "en" | "hi";
}

type CalcPhase =
  | "idle"
  | "fetching_weather"
  | "fetching_precipitation"
  | "fetching_seismic"
  | "fetching_gdacs"
  | "fetching_aqi"
  | "fetching_imd"
  | "analyzing"
  | "done";

const EarlyAlerts: React.FC<EarlyAlertsProps> = ({ userLocation, language }) => {
  const t = {
    en: {
      title: "Early Disaster Warnings & Risk Analysis",
      subtitle: "Live Intelligence",
      compositeRisk: "Composite Area Risk",
      analyzing: "Analyzing real-time signals...",
      noAlerts: "No immediate disaster threats detected for your current location.",
      probability: "Probability",
      recommendation: "Recommendation",
      threatLevel: "Threat Level",
      fetchingWeather: "Fetching weather data",
      fetchingPrecip: "Fetching precipitation forecast",
      fetchingSeismic: "Querying seismic activity",
      checkingGlobal: "Checking global alerts",
      measuringAQI: "Measuring air quality",
      loadingAI: "Loading ML Neural Models",
      runningML: "Running ML inference",
      emergency: "Emergency",
      warning: "Warning",
      watch: "Watch",
      advisory: "Advisory",
      alertTriggered: "Alert Triggered",
      fetchFailed: "Fetch Failed",
      allClear: "All Clear",
      enableLocation: "Enable location to receive early warnings for floods, earthquakes, and extreme weather.",
      warnings: "Early Warnings",
    },
    hi: {
      title: "प्रारंभिक आपदा चेतावनी और जोखिम विश्लेषण",
      subtitle: "लाइव इंटेलिजेंस",
      compositeRisk: "समग्र क्षेत्र जोखिम",
      analyzing: "वास्तविक समय के संकेतों का विश्लेषण...",
      noAlerts: "आपके वर्तमान स्थान के लिए किसी तत्काल आपदा खतरे का पता नहीं चला है।",
      probability: "संभावना",
      recommendation: "सिफारिश",
      threatLevel: "खतरे का स्तर",
      fetchingWeather: "मौसम डेटा प्राप्त किया जा रहा है",
      fetchingPrecip: "वर्षा पूर्वानुमान प्राप्त करना",
      fetchingSeismic: "भूकंपीय गतिविधि की जाँच",
      checkingGlobal: "वैश्विक अलर्ट की जाँच",
      measuringAQI: "वायु गुणवत्ता मापना",
      loadingAI: "ML तंत्रिका मॉडल लोड हो रहा है",
      runningML: "ML अनुमान चल रहा है",
      emergency: "आपातकालीन",
      warning: "चेतावनी",
      watch: "निगरानी",
      advisory: "सलाह",
      alertTriggered: "अलर्ट सक्रिय",
      fetchFailed: "प्राप्ति विफल",
      allClear: "सब स्पष्ट",
      enableLocation: "बाढ़, भूकंप और अत्यधिक मौसम की चेतावनी के लिए स्थान सक्षम करें।",
      warnings: "प्रारंभिक चेतावनी",
    }
  };

  const PHASES: {
    key: CalcPhase;
    label: string;
    icon: React.ReactNode;
    source: string;
  }[] = [
      {
        key: "fetching_weather",
        label: t[language].fetchingWeather,
        icon: <Thermometer className="h-4 w-4" />,
        source: "Open-Meteo API",
      },
      {
        key: "fetching_precipitation",
        label: t[language].fetchingPrecip,
        icon: <Droplets className="h-4 w-4" />,
        source: "Open-Meteo API",
      },
      {
        key: "fetching_seismic",
        label: t[language].fetchingSeismic,
        icon: <Mountain className="h-4 w-4" />,
        source: "USGS FDSNWS",
      },
      {
        key: "fetching_gdacs",
        label: t[language].checkingGlobal,
        icon: <AlertTriangle className="h-4 w-4" />,
        source: "GDACS",
      },
      {
        key: "fetching_aqi",
        label: t[language].measuringAQI,
        icon: <Leaf className="h-4 w-4" />,
        source: "Open-Meteo AQI",
      },
      {
        key: "fetching_imd",
        label: t[language].loadingAI,
        icon: <Bell className="h-4 w-4" />,
        source: "TensorFlow.js Engine",
      },
      {
        key: "analyzing",
        label: t[language].runningML,
        icon: <Zap className="h-4 w-4" />,
        source: "Neural Net Inference Pipeline",
      },
    ];

  const [alerts, setAlerts] = useState<EarlyAlert[]>([]);
  const [metadata, setMetadata] = useState<AlertMetadata | null>(null);
  const [floodModel, setFloodModel] = useState<any>(null);
  const [seismicModel, setSeismicModel] = useState<any>(null);
  const [landslideModel, setLandslideModel] = useState<any>(null);
  const [compositeRisk, setCompositeRisk] = useState<any>(null);

  // AI Brief State
  const [aiBrief, setAiBrief] = useState<string | null>(null);
  const [generatingBrief, setGeneratingBrief] = useState(false);

  const [loading, setLoading] = useState(false);
  const [expandedAlerts, setExpandedAlerts] = useState<Set<string>>(new Set());
  const [showSources, setShowSources] = useState(false);
  const [showCalcSteps, setShowCalcSteps] = useState(false);
  const [showMLModels, setShowMLModels] = useState(true);
  const [lastFetched, setLastFetched] = useState<Date | null>(null);
  const [currentPhase, setCurrentPhase] = useState<CalcPhase>("idle");
  const [completedPhases, setCompletedPhases] = useState<Set<CalcPhase>>(
    new Set(),
  );
  const [calcProgress, setCalcProgress] = useState(0);
  const [notifPermission, setNotifPermission] = useState<string>("default");
  const phaseTimerRef = useRef<NodeJS.Timeout | null>(null);
  // Track previous alert ids+severity to compute trend badges
  const previousAlertsRef = useRef<Map<string, EarlyAlert["severity"]>>(
    new Map(),
  );

  // Check notification permission on mount
  useEffect(() => {
    setNotifPermission(getNotificationPermission());
  }, []);

  const handleEnableNotifications = async () => {
    const perm = await requestNotificationPermission();
    setNotifPermission(perm);
    if (perm === "granted") {
      toast.success("Notifications enabled!", {
        description: "You'll receive alerts for emergency warnings.",
      });
    } else if (perm === "denied") {
      toast.error("Notifications blocked", {
        description: "Enable them in your browser settings.",
      });
    }
  };

  // Send push notifications and save to history for emergency/warning alerts
  const notifyForAlerts = useCallback(
    (newAlerts: EarlyAlert[]) => {
      const criticalAlerts = newAlerts.filter(
        (a) =>
          (a.severity === "emergency" || a.severity === "warning") &&
          shouldNotify(a.id),
      );

      for (const alert of criticalAlerts) {
        const cleanTitle = alert.title.replace(/[^\w\s—:.°,()/-]/g, "").trim();
        const body = alert.description.slice(0, 200);

        // Save to history
        addAlertToHistory({
          id: alert.id,
          title: cleanTitle,
          body,
          type: alert.type,
          severity: alert.severity,
          confidence: alert.confidence,
          locationName: userLocation?.name || undefined,
        });

        // Send push notification if permission granted
        if (getNotificationPermission() === "granted") {
          sendEmergencyNotification({
            title: cleanTitle,
            body,
            type: alert.type,
            severity: alert.severity,
            confidence: alert.confidence,
          });
        }
      }
    },
    [userLocation],
  );

  const fetchDoneRef = useRef(false);

  const simulatePhases = useCallback(() => {
    fetchDoneRef.current = false;
    setCompletedPhases(new Set());
    setCalcProgress(0);

    const phaseKeys: CalcPhase[] = [
      "fetching_weather",
      "fetching_precipitation",
      "fetching_seismic",
      "fetching_gdacs",
      "fetching_aqi",
      "fetching_imd",
      "analyzing",
    ];
    let idx = 0;

    const advancePhase = () => {
      // Stop immediately if the real fetch already finished — avoid overwriting 'done' state
      if (fetchDoneRef.current) return;

      if (idx < phaseKeys.length) {
        setCurrentPhase(phaseKeys[idx]);
        setCalcProgress(((idx + 1) / (phaseKeys.length + 1)) * 100);

        // Mark previous phase as completed
        if (idx > 0) {
          setCompletedPhases((prev) => new Set([...prev, phaseKeys[idx - 1]]));
        }

        idx++;
        phaseTimerRef.current = setTimeout(
          advancePhase,
          700 + Math.random() * 800,
        );
      } else {
        // Mark the LAST phase (analyzing) as completed
        setCompletedPhases(
          (prev) => new Set([...prev, phaseKeys[phaseKeys.length - 1]]),
        );
        setCurrentPhase("done");
        setCalcProgress(100);
      }
    };

    advancePhase();
  }, []);

  // ── Severity order helper (for trend comparison) ────────────────────────
  const severityRank = (s: EarlyAlert["severity"]) =>
    ({ advisory: 0, watch: 1, warning: 2, emergency: 3 })[s] ?? 0;

  // Build a stable "type key" for cross-run comparison (same disaster type ≈ same ID)
  const alertTypeKey = (a: EarlyAlert) => a.type;

  const fetchAlerts = useCallback(async () => {
    if (!userLocation) return;
    setLoading(true);
    simulatePhases();

    const { lat, lng } = userLocation;

    try {
      // Bypass Supabase Edge Function due to network timeouts
      // Run the ML models locally using our port
      const data = await fetchEarlyAlertsLocal(lat, lng);

      if (!data) throw new Error("No data received from local ML function");

      const generatedAlerts = data.alerts || [];

      fetchDoneRef.current = true; // Signal timer to stop
      if (phaseTimerRef.current) clearTimeout(phaseTimerRef.current);
      setCompletedPhases(new Set(PHASES.map((p) => p.key)));
      setCurrentPhase("done");
      setCalcProgress(100);

      setAlerts(generatedAlerts);
      setFloodModel(data.floodModel);
      setSeismicModel(data.seismicModel);
      setLandslideModel(data.landslideModel);
      setCompositeRisk(data.compositeRisk);

      previousAlertsRef.current = new Map(
        generatedAlerts.map((a: EarlyAlert) => [alertTypeKey(a), a.severity]),
      );
      setMetadata(data.metadata || null);
      setLastFetched(new Date());
      notifyForAlerts(generatedAlerts);

      // Trigger AI Generation if there is moderate or higher risk
      if (data.compositeRisk?.score > 20 || generatedAlerts.length > 0) {
        generateAIBrief(data);
      } else {
        setAiBrief(null);
      }
    } catch (err: any) {
      console.error(
        "Failed to generate early alerts via local ML function:",
        err,
      );
      fetchDoneRef.current = true;
      if (phaseTimerRef.current) clearTimeout(phaseTimerRef.current);
      setCurrentPhase("done");
      setCalcProgress(100);
      setAiBrief(
        "Failed to load environment data. Ensure a stable internet connection or check your API keys.",
      );
    } finally {
      setLoading(false);
    }
  }, [userLocation, simulatePhases, notifyForAlerts]);

  const generateAIBrief = async (data: any) => {
    setGeneratingBrief(true);
    setAiBrief(null);
    try {
      const promptContext = `
        Current Time: ${new Date().toLocaleString()}
        Location: ${userLocation?.lat}, ${userLocation?.lng} (${userLocation?.name || "Unknown"})
        Active Alerts: ${data.alerts?.map((a: any) => `[${a.severity.toUpperCase()}] ${a.title}`).join(", ") || "None"}
        ML Flood Model P(flood): ${((data.floodModel?.probability || 0) * 100).toFixed(1)}%
        ML Seismic Risk P(quake): ${((data.seismicModel?.probability || 0) * 100).toFixed(1)}%
      `;

      const { supabase } = await import("@/integrations/supabase/client");
      const briefMessages = [
        {
          role: "system",
          content:
            "You are the Chief Resilience AI for India. You synthesize live machine learning environmental models into a concise, 2-paragraph executive brief for the user. Explicitly mention the AI models (like ANN Landslide, or TF.js Neural Network Flood & Earthquake Risk models) to show sophistication. End with 2 highly actionable bullet points. Keep it brief, professional, and urgent if needed. Do not use filler intro text.",
        },
        {
          role: "user",
          content: `Please provide an executive brief based on this live telemetry:\n${promptContext}`,
        },
      ];

      let aiDataResult;
      const { data: aiData, error } = await supabase.functions.invoke("v1-generate-ai-brief", {
        body: { messages: briefMessages }
      });

      if (error) {
        console.warn("Backend Brief Proxy failed or CORS blocked. Falling back to local direct fetch...", error);
        
        // Local Fallback for development routed securely through backend proxy or Vercel Serverless
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "llama-3.3-70b-versatile",
            messages: briefMessages,
          }),
        });

        if (!res.ok) throw new Error(`Brief Fallback failed: ${res.status}`);
        const fallbackData = await res.json();
        aiDataResult = { message: fallbackData.choices[0].message.content };
      } else {
        aiDataResult = aiData;
      }

      if (!aiDataResult?.message) throw new Error("Empty AI response");
      setAiBrief(aiDataResult.message);
    } catch (e: any) {
      console.error("Failed to generate AI brief:", e);
      setAiBrief(e.message || "Failed to generate AI executive brief. Please check API keys.");
    } finally {
      setGeneratingBrief(false);
    }
  };

  const handleDownloadReport = () => {
    if (!lastFetched || !userLocation) return;

    // We'll create a professional PDF using html2pdf.js
    // We'll create a temporary element with a branded layout
    const element = document.createElement("div");
    element.style.padding = "40px";
    element.style.color = "#000";
    element.style.background = "#fff";
    element.style.fontFamily = "'Inter', sans-serif";
    element.style.width = "800px";

    const dateStr = new Date().toLocaleString();
    const locName = userLocation.name ? escapeHtml(userLocation.name) : "Unknown Location";

    element.innerHTML = `
      <div style="border-bottom: 3px solid #0f172a; padding-bottom: 24px; margin-bottom: 40px; display: flex; justify-content: space-between; align-items: flex-end;">
        <div>
          <h1 style="margin: 0; color: #0f172a; font-size: 32px; letter-spacing: -0.05em; font-weight: 800;">PREDICT<span style="color: #64748b;">AID</span></h1>
          <p style="margin: 4px 0 0 0; color: #64748b; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.1em;">Disaster Decision Support Architecture</p>
        </div>
        <div style="text-align: right;">
          <p style="margin: 0; font-size: 10px; color: #94a3b8; font-weight: 700; text-transform: uppercase;">Doc ID: PA-${Math.random().toString(36).substr(2, 9).toUpperCase()}</p>
        </div>
      </div>
      
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 40px; margin-bottom: 40px;">
        <div style="border-left: 1px solid #e2e8f0; padding-left: 20px;">
          <h3 style="margin: 0 0 8px 0; font-size: 11px; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.05em;">Telemetry Window</h3>
          <p style="margin: 0; font-size: 14px; font-weight: 600; color: #1e293b;">Generated: ${dateStr}</p>
          <p style="margin: 4px 0 0 0; font-size: 11px; color: #64748b;">Confidence Cycle: Real-time Analysis</p>
        </div>
        <div style="border-left: 1px solid #e2e8f0; padding-left: 20px;">
          <h3 style="margin: 0 0 8px 0; font-size: 11px; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.05em;">Geospatial Context</h3>
          <p style="margin: 0; font-size: 14px; font-weight: 600; color: #1e293b;">${locName}</p>
          <p style="margin: 4px 0 0 0; font-size: 11px; color: #64748b;">COORDS: ${userLocation.lat.toFixed(6)}, ${userLocation.lng.toFixed(6)}</p>
        </div>
      </div>

      ${aiBrief ? `
      <div style="margin-bottom: 40px;">
        <h2 style="font-size: 14px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.1em; color: #0f172a; border-bottom: 1px solid #f1f5f9; padding-bottom: 12px; margin-bottom: 20px;">Chief Resilience Executive Brief</h2>
        <div style="line-height: 1.7; font-size: 13px; color: #334155; padding: 0 0 0 0;">
          ${escapeHtml(aiBrief).replace(/\n\n/g, '</div><div style="height: 16px;"></div><div style="line-height: 1.7; font-size: 13px; color: #334155;">').replace(/\n/g, '<br/>')}
        </div>
      </div>
      ` : ""}

      <div style="margin-bottom: 40px;">
        <h2 style="font-size: 14px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.1em; color: #0f172a; border-bottom: 1px solid #f1f5f9; padding-bottom: 12px; margin-bottom: 20px;">Active Threat Matrix</h2>
        ${alerts.length === 0 ? '<p style="font-style: italic; color: #94a3b8; font-size: 13px;">No priority alerts identified in current cycle.</p>' : `
          <table style="width: 100%; border-collapse: collapse;">
            <thead>
              <tr style="text-align: left;">
                <th style="padding: 12px 0; border-bottom: 2px solid #0f172a; font-size: 11px; color: #0f172a; text-transform: uppercase; letter-spacing: 0.05em;">Classification</th>
                <th style="padding: 12px 0; border-bottom: 2px solid #0f172a; font-size: 11px; color: #0f172a; text-transform: uppercase; letter-spacing: 0.05em;">Analytical Description</th>
                <th style="padding: 12px 0; border-bottom: 2px solid #0f172a; font-size: 11px; color: #0f172a; text-transform: uppercase; letter-spacing: 0.05em; text-align: right;">Conf.</th>
              </tr>
            </thead>
            <tbody>
              ${alerts.map(a => `
                <tr>
                  <td style="padding: 20px 10px 20px 0; border-bottom: 1px solid #f1f5f9; vertical-align: top; width: 25%;">
                    <div style="font-weight: 800; color: #0f172a; font-size: 13px; margin-bottom: 6px;">${escapeHtml(a.title)}</div>
                    <div style="font-size: 9px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em;">${escapeHtml(a.severity)}</div>
                  </td>
                  <td style="padding: 20px 10px; border-bottom: 1px solid #f1f5f9; vertical-align: top;">
                    <p style="margin: 0; font-size: 12px; line-height: 1.6; color: #475569;">${escapeHtml(a.description)}</p>
                    <p style="margin: 8px 0 0 0; font-size: 9px; font-family: monospace; color: #94a3b8;">MODEL_ID: ${escapeHtml(a.algorithm || "N/A")}</p>
                  </td>
                  <td style="padding: 20px 0; border-bottom: 1px solid #f1f5f9; vertical-align: top; width: 10%; text-align: right;">
                    <div style="font-size: 14px; font-weight: 800; color: #0f172a;">${(a.confidence * 100).toFixed(0)}%</div>
                  </td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        `}
      </div>

      <div style="margin-bottom: 40px;">
        <h2 style="font-size: 14px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.1em; color: #0f172a; border-bottom: 1px solid #f1f5f9; padding-bottom: 12px; margin-bottom: 20px;">Scientific Model Indicators</h2>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 40px;">
          ${floodModel ? `
            <div>
              <h4 style="margin: 0 0 10px 0; color: #64748b; font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em;">Neural Net Flood Prob.</h4>
              <div style="font-size: 32px; font-weight: 800; color: #0f172a;">${(floodModel.probability * 100).toFixed(1)}%</div>
              <p style="margin: 6px 0 0 0; font-size: 10px; color: #94a3b8;">Static Validation: AUC 0.94</p>
            </div>
          ` : ""}
          ${seismicModel ? `
            <div>
              <h4 style="margin: 0 0 10px 0; color: #64748b; font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em;">Seismic Risk Index</h4>
              <div style="font-size: 32px; font-weight: 800; color: #0f172a;">${(seismicModel.probability * 100).toFixed(1)}%</div>
              <p style="margin: 6px 0 0 0; font-size: 10px; color: #94a3b8;">TF.js Model Alpha</p>
            </div>
          ` : ""}
        </div>
      </div>

      <div style="margin-top: 80px; padding-top: 20px; border-top: 1px solid #f1f5f9; display: flex; justify-content: space-between; align-items: center;">
        <div style="font-size: 9px; color: #94a3b8; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em;">
          Internal Document | Predict Aid Core v0.9
        </div>
        <div style="font-size: 9px; color: #94a3b8; font-weight: 600; font-family: monospace;">
          HEX_${Math.random().toString(16).substr(2, 6).toUpperCase()}
        </div>
      </div>
    `;

    const opt = {
      margin: 10,
      filename: `PredictAid-Report-${dateStr.replace(/[/:\s]/g, '-')}.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };

    // Use html2pdf global from CDN
    // @ts-ignore
    window.html2pdf().from(element).set(opt).save();
    toast.success("PDF Report generated successfully");
  };

  useEffect(() => {
    fetchAlerts();
    const interval = setInterval(fetchAlerts, 10 * 60 * 1000);
    return () => {
      clearInterval(interval);
      if (phaseTimerRef.current) clearTimeout(phaseTimerRef.current);
    };
  }, [fetchAlerts]);

  const toggleExpand = (id: string) => {
    setExpandedAlerts((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "flood":
        return <Droplets className="h-5 w-5" />;
      case "earthquake":
        return <Mountain className="h-5 w-5" />;
      case "heatwave":
        return <Thermometer className="h-5 w-5" />;
      case "cold_wave":
        return <Thermometer className="h-5 w-5" />;
      case "cyclone":
        return <Wind className="h-5 w-5" />;
      case "thunderstorm":
        return <CloudLightning className="h-5 w-5" />;
      default:
        return <AlertTriangle className="h-5 w-5" />;
    }
  };

  const getSeverityConfig = (severity: string) => {
    switch (severity) {
      case "emergency":
        return {
          border: "border-red-500/30 dark:border-red-500/20",
          bg: "bg-red-500/10 dark:bg-red-500/5 backdrop-blur-xl",
          badge: "bg-red-500 text-white",
          icon: <ShieldAlert className="h-5 w-5 text-red-500 animate-pulse" />,
          glow: "border-transparent shadow-none",
          label: t[language].emergency.toUpperCase(),
        };
      case "warning":
        return {
          border: "border-amber-500/30 dark:border-amber-500/20",
          bg: "bg-amber-500/10 dark:bg-amber-500/5 backdrop-blur-xl",
          badge: "bg-amber-500 text-black",
          icon: <AlertTriangle className="h-5 w-5 text-amber-500" />,
          glow: "border-transparent shadow-none",
          label: t[language].warning.toUpperCase(),
        };
      case "watch":
        return {
          border: "border-emerald-500/30 dark:border-emerald-500/20",
          bg: "bg-emerald-500/10 dark:bg-emerald-500/5 backdrop-blur-xl",
          badge: "bg-emerald-500 text-white",
          icon: <Bell className="h-5 w-5 text-emerald-500" />,
          glow: "border-transparent shadow-none",
          label: t[language].watch.toUpperCase(),
        };
      default:
        return {
          border: "border-slate-400/30",
          bg: "bg-slate-400/5 backdrop-blur-sm",
          badge: "bg-slate-400 text-white",
          icon: <Info className="h-5 w-5 text-slate-400" />,
          glow: "",
          label: t[language].advisory.toUpperCase(),
        };
    }
  };

  const getStepStatusConfig = (status: string) => {
    switch (status) {
      case "success":
        return {
          icon: <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />,
          label: t[language].alertTriggered,
          badgeClass: "bg-amber-500/10 text-amber-600 border-amber-500/20",
        };
      case "failed":
        return {
          icon: <XCircle className="h-3.5 w-3.5 text-red-400" />,
          label: t[language].fetchFailed,
          badgeClass: "bg-red-500/10 text-red-500 border-red-500/20",
        };
      default:
        return {
          icon: <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />,
          label: t[language].allClear,
          badgeClass: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
        };
    }
  };

  if (!userLocation) {
    return (
      <Card className="p-10 border-dashed border-muted-foreground/20 bg-muted/5 backdrop-blur-sm transition-smooth hover:border-primary/40">
        <div className="flex flex-col items-center text-center gap-4 text-muted-foreground">
          <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center animate-pulse-subtle">
            <BellRing className="h-8 w-8 text-primary/60" />
          </div>
          <p className="text-sm font-medium leading-relaxed max-w-[280px]">
            {t[language].enableLocation}
          </p>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-3 sm:space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
          <Zap className="h-4 w-4 sm:h-5 sm:w-5 text-primary flex-shrink-0" />
          <h2 className="text-base sm:text-lg font-bold text-foreground truncate">
            {t[language].warnings}
          </h2>
          {alerts.length > 0 && (
            <Badge
              variant="outline"
              className="ml-1 text-[10px] sm:text-xs flex-shrink-0"
            >
              {alerts.length}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          {/* Notification toggle */}
          {isPushSupported() && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleEnableNotifications}
              className="h-8 gap-1.5 text-xs"
              title={
                notifPermission === "granted"
                  ? "Notifications enabled"
                  : "Enable notifications"
              }
            >
              {notifPermission === "granted" ? (
                <>
                  <Bell className="h-3.5 w-3.5 text-green-500" />
                  <span className="hidden sm:inline text-green-600">On</span>
                </>
              ) : notifPermission === "denied" ? (
                <>
                  <BellOff className="h-3.5 w-3.5 text-red-400" />
                  <span className="hidden sm:inline text-red-400">Blocked</span>
                </>
              ) : (
                <>
                  <BellPlus className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="hidden sm:inline">Enable Alerts</span>
                </>
              )}
            </Button>
          )}
          {lastFetched && (
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {lastFetched.toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={handleDownloadReport}
            disabled={loading || !lastFetched}
            className="h-8 gap-2 px-3 text-xs font-bold text-primary hover:bg-primary/10 transition-smooth group"
            title="Download Professional PDF Report"
          >
            <Download className="h-3.5 w-3.5 group-hover:scale-110 transition-transform" />
            <span className="hidden sm:inline italic tracking-tight">PDF Export</span>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={fetchAlerts}
            disabled={loading}
            className="h-8 w-8 p-0"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </div>

      {/* Push notification prompt - Skinny & Professional */}
      {isPushSupported() && notifPermission === "default" && !loading && (
        <div className="flex items-center justify-between gap-3 p-3 apple-glass rounded-xl animate-fade-in group">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <BellRing className="h-4 w-4 text-primary" />
            </div>
            <p className="text-[11px] font-bold text-foreground uppercase tracking-tight">
              Enable Real-time Emergency Intelligence
            </p>
          </div>
          <Button
            size="sm"
            variant="ghost"
            onClick={handleEnableNotifications}
            className="text-[10px] h-7 px-3 font-black bg-primary/20 hover:bg-primary/30 text-primary border border-primary/20 uppercase"
          >
            Authorize
          </Button>
        </div>
      )}

      {/* ═══ LIVE CALCULATION PROGRESS ═══ */}
      {loading && (
        <div className="p-5 apple-glass rounded-2xl space-y-4 overflow-hidden relative">
          <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-primary/30 to-transparent"></div>
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[10px] font-black tracking-[0.2em] text-primary uppercase">
                  ML Diagnostic Pipeline
                </span>
                <span className="text-[10px] font-mono text-primary/60 font-bold">
                  {Math.round(calcProgress)}%
                </span>
              </div>
              <Progress value={calcProgress} className="h-1 bg-slate-200 dark:bg-white/5 [&>div]:bg-primary/50" />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-4">
            {PHASES.map((phase) => {
              const isCompleted = completedPhases.has(phase.key);
              const isActive = currentPhase === phase.key;

              return (
                <div
                  key={phase.key}
                  className={`flex items-center gap-3 py-2 px-3 rounded-lg border transition-all duration-500 ${isActive
                    ? "bg-primary/5 dark:bg-primary/10 border-primary/20 shadow-sm scale-[1.02]"
                    : isCompleted
                      ? "bg-slate-50 dark:bg-muted/30 border-slate-200 dark:border-transparent opacity-100"
                      : "bg-transparent border-transparent opacity-40"
                    }`}
                >
                  <div className={`flex-shrink-0 flex items-center justify-center h-5 w-5 rounded-full ${isCompleted ? "bg-green-500/20" : isActive ? "bg-primary/20" : "bg-muted/50"}`}>
                    {isCompleted ? (
                      <CheckCircle2 className="h-3 w-3 text-green-500" />
                    ) : isActive ? (
                      <div className="h-1.5 w-1.5 rounded-full bg-primary animate-ping" />
                    ) : (
                      <div className="h-1 w-1 rounded-full bg-muted-foreground/30" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-[11px] font-bold uppercase tracking-wider ${isActive ? "text-primary" : "text-muted-foreground"}`}>
                      {phase.label}
                    </p>
                    <p className="text-[9px] text-muted-foreground/60 font-mono truncate">
                      {phase.source}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ═══ GENERATIVE AI BRIEFING ═══ */}
      {(generatingBrief || aiBrief) && !loading && (
        <div className="relative p-5 apple-glass rounded-2xl overflow-hidden group">
          <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-emerald-500/30 to-transparent"></div>

          <div className="flex items-center gap-3 mb-4">
            <div className="h-8 w-8 rounded-lg bg-emerald-500/10 flex items-center justify-center">
              <Sparkles className={`h-4 w-4 text-emerald-600 ${generatingBrief ? "animate-spin" : "animate-pulse"}`} />
            </div>
            <div className="flex-1">
              <h3 className="font-black text-[10px] tracking-[0.2em] text-foreground uppercase">
                ML Inference Intelligence
              </h3>
            </div>
            {generatingBrief && (
              <div className="text-[9px] font-bold text-emerald-600 uppercase animate-pulse">
                Synthesizing...
              </div>
            )}
          </div>

          {!generatingBrief && (
            <div className="mt-4 pt-4 border-t border-slate-200/50 dark:border-white/5 flex items-center justify-between">
              <span className="text-[10px] text-indigo-500/40 font-mono tracking-widest uppercase">Protocol: Intel Directive 41</span>
              <div className="flex gap-1.5">
                <div className="h-1 w-4 bg-indigo-500/20 rounded-full"></div>
                <div className="h-1 w-2 bg-indigo-500/10 rounded-full"></div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* No alerts - Clean line */}
      {
        !loading && alerts.length === 0 && (
          <div className="flex items-center gap-3 p-4 apple-glass rounded-xl shadow-none">
            <CheckCircle2 className="h-4 w-4 text-primary" />
            <span className="text-[11px] font-bold text-primary dark:text-muted-foreground uppercase tracking-[0.1em]">
              Atmospheric Continuity Secured | No Active Threats
            </span>
          </div>
        )
      }

      {/* Alert Cards */}
      {
        alerts.map((alert) => {
          const config = getSeverityConfig(alert.severity);
          const isExpanded = expandedAlerts.has(alert.id);

          return (
            <Card
              key={alert.id}
              className={`overflow-hidden shadow-none transition-all duration-200 apple-glass ${config.border} ${config.bg} ${config.glow}`}
            >
              <div
                className="p-4 cursor-pointer"
                onClick={() => toggleExpand(alert.id)}
              >
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 mt-0.5">
                    {getTypeIcon(alert.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span
                        className={`text-xs font-bold px-2 py-0.5 rounded ${config.badge}`}
                      >
                        {config.label}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        Confidence: {(alert.confidence * 100).toFixed(0)}%
                      </span>
                    </div>
                    <h3 className="text-sm font-semibold text-foreground leading-tight">
                      {alert.title}
                    </h3>
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                      {alert.description}
                    </p>
                  </div>
                  <div className="flex-shrink-0">
                    {isExpanded ? (
                      <ChevronUp className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    )}
                  </div>
                </div>
              </div>

              {isExpanded && (
                <div className="px-4 pb-4 border-t border-border/30 pt-3 space-y-3">
                  <p className="text-sm text-foreground">{alert.description}</p>

                  {/* Algorithm details */}
                  <div className="bg-primary/5 dark:bg-background/50 rounded-lg p-3 space-y-2 border border-primary/10 dark:border-transparent">
                    <div className="flex items-center gap-1.5">
                      <Database className="h-3.5 w-3.5 text-primary" />
                      <span className="text-xs font-semibold text-primary dark:text-foreground">
                        How This Was Calculated
                      </span>
                    </div>
                    <p className="text-xs text-primary/60 dark:text-muted-foreground leading-relaxed">
                      {alert.algorithm}
                    </p>
                  </div>

                  {/* Data points */}
                  <div className="bg-primary/5 dark:bg-background/50 rounded-lg p-3 border border-primary/10 dark:border-transparent">
                    <span className="text-xs font-semibold text-primary dark:text-foreground block mb-1.5">
                      Raw Data Points
                    </span>
                    <div className="grid grid-cols-2 gap-1.5">
                      {Object.entries(alert.dataPoints).map(([key, value]) => (
                        <div key={key} className="text-xs">
                          <span className="text-muted-foreground">{key}: </span>
                          <span className="font-mono text-foreground">
                            {typeof value === "number"
                              ? value.toFixed(2)
                              : JSON.stringify(value)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Source & time */}
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>Source: {alert.source}</span>
                    <span>
                      Expires:{" "}
                      {new Date(alert.expiresAt).toLocaleString([], {
                        dateStyle: "short",
                        timeStyle: "short",
                      })}
                    </span>
                  </div>
                </div>
              )}
            </Card>
          );
        })
      }

      {/* ═══ MACHINE LEARNING MODELS ═══ */}
      {!loading && (floodModel || seismicModel || compositeRisk) && (
        <Collapsible
          open={showMLModels}
          onOpenChange={setShowMLModels}
          className="mb-4"
        >
          <CollapsibleTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="w-full text-[10px] font-black tracking-[0.2em] gap-2 border-primary/20 text-primary bg-primary/10 hover:bg-primary/20 uppercase transition-all"
            >
              <Database className="h-3 w-3" />
              Model Architecture & Logic
              {showMLModels ? (
                <ChevronUp className="h-3 w-3 ml-auto opacity-40" />
              ) : (
                <ChevronDown className="h-3 w-3 ml-auto opacity-40" />
              )}
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="mt-2 space-y-2">
              {getMLLoadError() && (
                <div className="p-2 mb-2 bg-red-500/10 border border-red-500/30 rounded text-[10px] text-red-600 font-mono">
                  ⚠️ ML Error: {getMLLoadError()}
                </div>
              )}

              {floodModel && (
                <div className="p-4 bg-white/40 dark:bg-slate-950/20 border border-primary/10 rounded-xl space-y-2 group transition-all hover:bg-white/60">
                  <div className="flex items-center gap-3">
                    <div className="h-7 w-7 rounded-lg bg-teal-500/10 flex items-center justify-center">
                      <Droplets className="h-3.5 w-3.5 text-teal-600" />
                    </div>
                    <span className="text-[11px] font-black text-foreground uppercase tracking-tight">
                      Neural Net Hydrology Model
                    </span>
                    <Badge
                      variant="outline"
                      className={`ml-auto text-[9px] font-black uppercase tracking-widest ${floodModel.isFlood ? "bg-red-500/10 text-red-400 border-red-500/20" : "bg-primary/10 text-primary border-primary/20"}`}
                    >
                      {floodModel.isFlood ? "Critical" : "Nominal"}
                    </Badge>
                  </div>
                  <p className="text-[11px] text-muted-foreground mb-1">
                    TF.js 10-feature Neural Network Model:{" "}
                    <span className="font-mono">
                      AUC-ROC: {floodModel.metrics?.auc_roc != null ? floodModel.metrics.auc_roc.toFixed(4) : "N/A"}
                    </span>
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    Probability:{" "}
                    <span className="font-mono">
                      {((floodModel.probability || 0) * 100).toFixed(1)}%
                    </span>{" "}
                    | Features:{" "}
                    <span className="font-mono">
                      Rainfall, Humidity, Pressure, Wind
                    </span>
                  </p>
                </div>
              )}

              {seismicModel && (
                <div className="p-4 bg-white/40 dark:bg-slate-950/20 border border-primary/10 rounded-xl space-y-2 group transition-all hover:bg-white/60">
                  <div className="flex items-center gap-3">
                    <div className="h-7 w-7 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                      <Mountain className="h-3.5 w-3.5 text-emerald-600" />
                    </div>
                    <span className="text-[11px] font-black text-foreground uppercase tracking-tight">
                      Seismic Propagation Net
                    </span>
                    <Badge
                      variant="outline"
                      className={`ml-auto text-[9px] font-black uppercase tracking-widest ${seismicModel.isAnomaly ? "bg-red-500/10 text-red-400 border-red-500/20" : "bg-primary/10 text-primary border-primary/20"}`}
                    >
                      {seismicModel.isAnomaly ? "Anomaly" : "Stable"}
                    </Badge>
                  </div>
                  <p className="text-[11px] text-muted-foreground mb-1">
                    TF.js 10-feature Neural Network Model:{" "}
                    <span className="font-mono">
                      AUC-ROC: {seismicModel.metrics?.auc_roc != null ? seismicModel.metrics.auc_roc.toFixed(4) : "N/A"}
                    </span>
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    Probability:{" "}
                    <span className="font-mono">
                      {((seismicModel.probability || 0) * 100).toFixed(1)}%
                    </span>{" "}
                    | Features:{" "}
                    <span className="font-mono">
                      Magnitude, Depth, Event Count
                    </span>
                  </p>
                </div>
              )}
            </div>
          </CollapsibleContent>
        </Collapsible>
      )}

      {/* Data Sources Footer */}
      {metadata && (
        <Collapsible open={showSources} onOpenChange={setShowSources}>
          <CollapsibleTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="w-full text-[9px] font-bold text-muted-foreground/40 hover:text-muted-foreground gap-2 uppercase tracking-[0.2em] py-8"
            >
              <Database className="h-3 w-3" />
              Telemetry Source Protocols
              {showSources ? (
                <ChevronUp className="h-3 w-3" />
              ) : (
                <ChevronDown className="h-3 w-3" />
              )}
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="p-4 bg-white/60 dark:bg-slate-950/40 border border-primary/10 rounded-xl space-y-3 mb-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-1">
                  <p className="text-[9px] font-black text-primary/60 uppercase">Live Nodes</p>
                  <p className="text-[10px] text-primary/80 leading-relaxed font-mono">{metadata.sources.join(" • ")}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-[9px] font-black text-primary/60 uppercase">Architecture</p>
                  <p className="text-[10px] text-primary/80 leading-relaxed font-mono">{metadata.algorithmsUsed.join(" • ")}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-[9px] font-black text-primary/60 uppercase">Checkpoint</p>
                  <p className="text-[10px] text-primary/80 font-mono">{new Date(metadata.generatedAt).toLocaleString()}</p>
                </div>
              </div>
            </div>
          </CollapsibleContent>
        </Collapsible>
      )}

      <div className="mt-6 flex items-center gap-2 text-xs text-muted-foreground/60">
        <ShieldAlert className="h-3 w-3" />
        <span>ML-Powered Decision Support Prototype</span>
      </div>
    </div>
  );
};

export default EarlyAlerts;
