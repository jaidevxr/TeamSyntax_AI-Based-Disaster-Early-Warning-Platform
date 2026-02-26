import React, { useState, useEffect, useCallback, useRef } from "react";
import { Location } from "@/types";
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

const PHASES: {
  key: CalcPhase;
  label: string;
  icon: React.ReactNode;
  source: string;
}[] = [
    {
      key: "fetching_weather",
      label: "Fetching weather data",
      icon: <Thermometer className="h-4 w-4" />,
      source: "Open-Meteo API",
    },
    {
      key: "fetching_precipitation",
      label: "Fetching precipitation forecast",
      icon: <Droplets className="h-4 w-4" />,
      source: "Open-Meteo API",
    },
    {
      key: "fetching_seismic",
      label: "Querying seismic activity",
      icon: <Mountain className="h-4 w-4" />,
      source: "USGS FDSNWS",
    },
    {
      key: "fetching_gdacs",
      label: "Checking global alerts",
      icon: <AlertTriangle className="h-4 w-4" />,
      source: "GDACS",
    },
    {
      key: "fetching_aqi",
      label: "Measuring air quality",
      icon: <Leaf className="h-4 w-4" />,
      source: "Open-Meteo AQI",
    },
    {
      key: "fetching_imd",
      label: "Reading IMD bulletins",
      icon: <Bell className="h-4 w-4" />,
      source: "IMD RSS",
    },
    {
      key: "analyzing",
      label: "Running detection algorithms",
      icon: <Zap className="h-4 w-4" />,
      source: "IMD + Steadman + Bath's Law",
    },
  ];

const EarlyAlerts: React.FC<EarlyAlertsProps> = ({ userLocation }) => {
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
      const GROQ_API_KEY = import.meta.env.VITE_GROQ_API_KEY;
      if (!GROQ_API_KEY) {
        setAiBrief("AI features require a valid Groq API key.");
        return;
      }

      const promptContext = `
        Current Time: ${new Date().toLocaleString()}
        Location: ${userLocation?.lat}, ${userLocation?.lng} (${userLocation?.name || "Unknown"})
        Composite Risk: ${data.compositeRisk?.score}/100 (${data.compositeRisk?.level})
        Active Alerts: ${data.alerts?.map((a: any) => `[${a.severity.toUpperCase()}] ${a.title}`).join(", ") || "None"}
        ML Flood Model P(flood): ${((data.floodModel?.probability || 0) * 100).toFixed(1)}%
        ML Seismic Z-Score: ${data.seismicModel?.zScore?.toFixed(2) || "N/A"}
        ML Landslide Model P(fail): ${((data.landslideModel?.probability || 0) * 100).toFixed(1)}%
      `;

      const res = await fetch(
        "https://api.groq.com/openai/v1/chat/completions",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${GROQ_API_KEY}`,
          },
          body: JSON.stringify({
            model: "llama-3.3-70b-versatile",
            messages: [
              {
                role: "system",
                content:
                  "You are the Chief Resilience AI for India. You synthesize live machine learning environmental models into a concise, 2-paragraph executive brief for the user. Explicitly mention the AI models (like ANN Landslide, Seismic Z-Score, or Logistic Regression Flood models) to show sophistication. End with 2 highly actionable bullet points. Keep it brief, professional, and urgent if needed. Do not use filler intro text.",
              },
              {
                role: "user",
                content: `Please provide an executive brief based on this live telemetry:\n${promptContext}`,
              },
            ],
            max_tokens: 350,
          }),
        },
      );

      if (!res.ok) throw new Error("Groq fetch failed");
      const json = await res.json();
      setAiBrief(json.choices[0].message.content);
    } catch (e) {
      console.error("Failed to generate AI brief:", e);
      setAiBrief(
        "Failed to generate AI executive brief. Please check API keys.",
      );
    } finally {
      setGeneratingBrief(false);
    }
  };

  const handleDownloadReport = () => {
    if (!lastFetched) return;

    let report = `====================================================\n`;
    report += `   AI DISASTER MANAGEMENT - EARLY ALERTS REPORT\n`;
    report += `====================================================\n\n`;

    report += `GENERATED AT: ${new Date().toLocaleString()}\n`;
    report += `LOCATION: ${userLocation?.lat.toFixed(4)}, ${userLocation?.lng.toFixed(4)} (${userLocation?.name || "Unknown"})\n\n`;

    if (aiBrief) {
      report += `--- AI CHIEF RESILIENCE BRIEFING ---\n`;
      report += `${aiBrief.replace(/\\n/g, "\n")}\n\n`;
    }

    if (compositeRisk) {
      report += `--- COMPOSITE RISK INDEX ---\n`;
      report += `Score: ${compositeRisk.score}/100 (${compositeRisk.level.toUpperCase()})\n`;
      Object.entries(compositeRisk.components || {}).forEach(
        ([k, v]: [string, any]) => {
          report += ` - ${k}: ${typeof v === "number" ? v.toFixed(2) : (v as any).raw || v}\n`;
        },
      );
      report += `Formula: ${compositeRisk.formula}\n\n`;
    }

    report += `--- ACTIVE ALERTS (${alerts.length}) ---\n`;
    if (alerts.length === 0) {
      report += `No active alerts currently.\n\n`;
    } else {
      alerts.forEach((a, i) => {
        report += `[${i + 1}] ${a.title}\n`;
        report += `Severity: ${a.severity.toUpperCase()} | Confidence: ${(a.confidence * 100).toFixed(0)}%\n`;
        report += `Description: ${a.description}\n`;
        report += `Algorithm: ${a.algorithm}\n`;
        report += `Raw Data: ${JSON.stringify(a.dataPoints)}\n`;
        report += `Expires: ${new Date(a.expiresAt).toLocaleString()}\n\n`;
      });
    }

    report += `--- MACHINE LEARNING MODELS ---\n`;
    if (floodModel) {
      report += `Logistic Regression Flood Model:\n`;
      report += ` - Probability: ${(floodModel.probability * 100).toFixed(1)}%\n`;
      report += ` - Logit: ${floodModel.logit?.toFixed(3)}\n`;
      report += ` - Features: ${JSON.stringify(floodModel.features || floodModel.featureContributions)}\n\n`;
    }
    if (seismicModel) {
      report += `Seismic Anomaly Detection:\n`;
      report += ` - Z-Score: ${seismicModel.zScore?.toFixed(2)}\n`;
      report += ` - b-value: ${seismicModel.bValue?.toFixed(2)}\n`;
      report += ` - Inter-event CV: ${seismicModel.interEventCV?.toFixed(2)}\n`;
      report += ` - Anomaly Level: ${seismicModel.anomalyLevel || "Normal"}\n\n`;
    }
    if (landslideModel) {
      report += `Landslide ANN Simulation:\n`;
      report += ` - Probability: ${(landslideModel.probability * 100).toFixed(1)}%\n`;
      report += ` - Risk Level: ${landslideModel.riskLevel?.toUpperCase()}\n`;
      report += ` - Elevation: ${landslideModel.elevation}m\n\n`;
    }

    if (metadata && metadata.calculationSteps) {
      report += `--- CALCULATION TRACE ---\n`;
      metadata.calculationSteps.forEach((step: any) => {
        report += `Step ${step.step}: ${step.source}\n`;
        report += ` - Result: ${step.result}\n`;
        report += ` - Duration: ${step.duration_ms}ms\n`;
      });
    }

    report += `\n====================================================\n`;
    report += `END OF REPORT\n`;

    const blob = new Blob([report], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Disaster-Early-Alerts-Report-${new Date().toISOString().slice(0, 10)}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
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
          border: "border-red-500/60",
          bg: "bg-red-500/10",
          badge: "bg-red-500 text-white",
          icon: <ShieldAlert className="h-5 w-5 text-red-500" />,
          glow: "shadow-red-500/20 shadow-lg",
          label: "EMERGENCY",
        };
      case "warning":
        return {
          border: "border-orange-500/60",
          bg: "bg-orange-500/10",
          badge: "bg-orange-500 text-white",
          icon: <AlertTriangle className="h-5 w-5 text-orange-500" />,
          glow: "shadow-orange-500/15 shadow-md",
          label: "WARNING",
        };
      case "watch":
        return {
          border: "border-yellow-500/60",
          bg: "bg-yellow-500/10",
          badge: "bg-yellow-500 text-black",
          icon: <Bell className="h-5 w-5 text-yellow-500" />,
          glow: "",
          label: "WATCH",
        };
      default:
        return {
          border: "border-blue-500/40",
          bg: "bg-blue-500/5",
          badge: "bg-blue-500 text-white",
          icon: <Info className="h-5 w-5 text-blue-500" />,
          glow: "",
          label: "ADVISORY",
        };
    }
  };

  const getStepStatusConfig = (status: string) => {
    switch (status) {
      case "success":
        return {
          icon: <AlertTriangle className="h-3.5 w-3.5 text-orange-500" />,
          label: "Alert Triggered",
          badgeClass: "bg-orange-500/15 text-orange-600 border-orange-500/30",
        };
      case "failed":
        return {
          icon: <XCircle className="h-3.5 w-3.5 text-red-400" />,
          label: "Fetch Failed",
          badgeClass: "bg-red-500/15 text-red-500 border-red-500/30",
        };
      default:
        return {
          icon: <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />,
          label: "All Clear",
          badgeClass: "bg-green-500/15 text-green-600 border-green-500/30",
        };
    }
  };

  if (!userLocation) {
    return (
      <Card className="p-6 border-dashed border-muted-foreground/30">
        <div className="flex items-center gap-3 text-muted-foreground">
          <BellRing className="h-5 w-5" />
          <p className="text-sm">
            Enable location to receive early warnings for floods, earthquakes,
            and extreme weather.
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
            Early Warnings
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
            className="h-8 gap-1.5 text-xs text-blue-500 hover:text-blue-600 hover:bg-blue-500/10"
            title="Download Full Report"
          >
            <Download className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Report</span>
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

      {/* Push notification prompt for new users */}
      {isPushSupported() && notifPermission === "default" && !loading && (
        <Card className="p-3 border-primary/30 bg-primary/5">
          <div className="flex items-center gap-3">
            <BellRing className="h-5 w-5 text-primary flex-shrink-0" />
            <div className="flex-1">
              <p className="text-xs font-medium text-foreground">
                Enable Push Notifications
              </p>
              <p className="text-[11px] text-muted-foreground">
                Get alerted for emergencies even when the app is in the
                background.
              </p>
            </div>
            <Button
              size="sm"
              variant="default"
              onClick={handleEnableNotifications}
              className="text-xs h-7 px-3"
            >
              Enable
            </Button>
          </div>
        </Card>
      )}

      {/* ═══ LIVE CALCULATION PROGRESS ═══ */}
      {loading && (
        <Card className="p-4 border-primary/30 bg-primary/5 space-y-3">
          <div className="flex items-center gap-2 mb-1">
            <Loader2 className="h-4 w-4 animate-spin text-primary" />
            <span className="text-sm font-semibold text-foreground">
              Calculating Early Warnings…
            </span>
            <span className="text-xs text-muted-foreground ml-auto">
              {Math.round(calcProgress)}%
            </span>
          </div>

          <Progress value={calcProgress} className="h-1.5" />

          <div className="space-y-2 mt-2">
            {PHASES.map((phase) => {
              const isCompleted = completedPhases.has(phase.key);
              const isActive = currentPhase === phase.key;

              return (
                <div
                  key={phase.key}
                  className={`flex items-center gap-2.5 py-1.5 px-2 rounded-md transition-all duration-300 ${isActive
                      ? "bg-primary/10 border border-primary/20"
                      : isCompleted
                        ? "opacity-70"
                        : "opacity-40"
                    }`}
                >
                  {isCompleted ? (
                    <CheckCircle2 className="h-4 w-4 text-green-500 flex-shrink-0" />
                  ) : isActive ? (
                    <Loader2 className="h-4 w-4 animate-spin text-primary flex-shrink-0" />
                  ) : (
                    <div className="h-4 w-4 rounded-full border border-muted-foreground/30 flex-shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <span
                      className={`text-xs font-medium ${isActive ? "text-foreground" : "text-muted-foreground"}`}
                    >
                      {phase.label}
                    </span>
                  </div>
                  <span className="text-[10px] text-muted-foreground font-mono flex-shrink-0">
                    {phase.source}
                  </span>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* ═══ GENERATIVE AI BRIEFING ═══ */}
      {(generatingBrief || aiBrief) && !loading && (
        <Card className="relative p-4 border-indigo-500/40 bg-indigo-500/5 shadow-indigo-500/10 shadow-lg overflow-hidden group">
          <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-indigo-500 to-purple-500"></div>
          <div className="flex items-center gap-2 mb-3">
            <Sparkles
              className={`h-5 w-5 text-indigo-500 ${generatingBrief ? "animate-pulse" : ""}`}
            />
            <h3 className="font-bold text-sm tracking-tight bg-gradient-to-r from-indigo-500 to-purple-500 bg-clip-text text-transparent">
              AI Chief Resilience Briefing
            </h3>
            {generatingBrief && (
              <Badge
                variant="outline"
                className="ml-auto text-[10px] bg-indigo-500/10 text-indigo-500 border-indigo-500/30 animate-pulse"
              >
                Synthesizing Telemetry...
              </Badge>
            )}
          </div>

          <div className="text-sm">
            {generatingBrief && !aiBrief ? (
              <div className="space-y-2">
                <div className="h-3 w-full bg-indigo-500/10 rounded animate-pulse"></div>
                <div className="h-3 w-5/6 bg-indigo-500/10 rounded animate-pulse"></div>
                <div className="h-3 w-4/6 bg-indigo-500/10 rounded animate-pulse"></div>
              </div>
            ) : (
              <div className="ai-brief-content animate-fade-in">
                {aiBrief && renderMarkdown(aiBrief)}
              </div>
            )}
          </div>
        </Card>
      )}

      {/* No alerts */}
      {!loading && alerts.length === 0 && (
        <Card className="p-6 border-green-500/30 bg-green-500/5">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-full bg-green-500/20 flex items-center justify-center">
              <Bell className="h-4 w-4 text-green-500" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">All Clear</p>
              <p className="text-xs text-muted-foreground">
                No active warnings for your area. Data from USGS, OpenWeather,
                Open-Meteo, and GDACS.
              </p>
            </div>
          </div>
        </Card>
      )}

      {/* Alert Cards */}
      {alerts.map((alert) => {
        const config = getSeverityConfig(alert.severity);
        const isExpanded = expandedAlerts.has(alert.id);

        return (
          <Card
            key={alert.id}
            className={`overflow-hidden ${config.border} ${config.bg} ${config.glow} transition-all duration-200`}
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
                <div className="bg-background/50 rounded-lg p-3 space-y-2">
                  <div className="flex items-center gap-1.5">
                    <Database className="h-3.5 w-3.5 text-primary" />
                    <span className="text-xs font-semibold text-foreground">
                      How This Was Calculated
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {alert.algorithm}
                  </p>
                </div>

                {/* Data points */}
                <div className="bg-background/50 rounded-lg p-3">
                  <span className="text-xs font-semibold text-foreground block mb-1.5">
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
      })}

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
              className="w-full text-xs gap-1.5 border-purple-500/50 text-purple-600 bg-purple-500/5 hover:bg-purple-500/10 hover:text-purple-700"
            >
              <Database className="h-3.5 w-3.5" />
              Active ML Models & Algorithms
              {showMLModels ? (
                <ChevronUp className="h-3 w-3 ml-auto" />
              ) : (
                <ChevronDown className="h-3 w-3 ml-auto" />
              )}
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="mt-2 space-y-2">
              {compositeRisk && (
                <Card className="p-3 border-purple-500/30 bg-purple-500/5">
                  <div className="flex items-center gap-2 mb-2">
                    <TrendingUp className="h-4 w-4 text-purple-500" />
                    <span className="text-xs font-bold text-foreground">
                      Composite Risk Index
                    </span>
                    <Badge
                      variant="outline"
                      className="ml-auto text-[10px] bg-purple-500/20 text-purple-700 border-purple-500/30"
                    >
                      Score: {compositeRisk.score}/100
                    </Badge>
                  </div>
                  <p className="text-[11px] text-muted-foreground mb-2">
                    Weighted sum of normalized hazards (Flood, Seismic, Cyclone,
                    Heat).
                  </p>
                  <div className="grid grid-cols-2 gap-1.5">
                    {Object.entries(compositeRisk.components || {}).map(
                      ([key, value]) => (
                        <div
                          key={key}
                          className="text-[10px] flex justify-between bg-background/50 rounded px-1.5 py-1"
                        >
                          <span className="text-muted-foreground capitalize">
                            {key.replace("Risk", "")}
                          </span>
                          <span className="font-mono">
                            {typeof value === "number"
                              ? (value as number).toFixed(1)
                              : (value as string)}
                          </span>
                        </div>
                      ),
                    )}
                  </div>
                </Card>
              )}

              {floodModel && (
                <Card className="p-3 border-blue-500/30 bg-blue-500/5">
                  <div className="flex items-center gap-2 mb-2">
                    <Droplets className="h-4 w-4 text-blue-500" />
                    <span className="text-xs font-bold text-foreground">
                      Flood Logistic Regression Model
                    </span>
                    <Badge
                      variant="outline"
                      className={`ml-auto text-[10px] ${floodModel.isFlood ? "bg-red-500/20 text-red-700 border-red-500/30" : "bg-green-500/20 text-green-700 border-green-500/30"}`}
                    >
                      {floodModel.isFlood ? "High Risk" : "Low Risk"}
                    </Badge>
                  </div>
                  <p className="text-[11px] text-muted-foreground mb-1">
                    IMD-calibrated 7-feature model:{" "}
                    <span className="font-mono">
                      z = {floodModel.logit?.toFixed(2) || "N/A"}
                    </span>
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    Probability:{" "}
                    <span className="font-mono">
                      {((floodModel.probability || 0) * 100).toFixed(1)}%
                    </span>{" "}
                    | Top Factors:{" "}
                    <span className="font-mono">
                      {floodModel.topContributors}
                    </span>
                  </p>
                </Card>
              )}

              {seismicModel && (
                <Card className="p-3 border-orange-500/30 bg-orange-500/5">
                  <div className="flex items-center gap-2 mb-2">
                    <Mountain className="h-4 w-4 text-orange-500" />
                    <span className="text-xs font-bold text-foreground">
                      Seismic Anomaly Z-Score
                    </span>
                    <Badge
                      variant="outline"
                      className={`ml-auto text-[10px] ${seismicModel.isAnomaly ? "bg-red-500/20 text-red-700 border-red-500/30" : "bg-green-500/20 text-green-700 border-green-500/30"}`}
                    >
                      {seismicModel.anomalyLevel || "Normal"}
                    </Badge>
                  </div>
                  <p className="text-[11px] text-muted-foreground mb-1">
                    Energy-weighted variant + Aki-Utsu b-value
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    Z-Score:{" "}
                    <span className="font-mono">
                      {seismicModel.zScore?.toFixed(2)}
                    </span>{" "}
                    | b-value:{" "}
                    <span className="font-mono">
                      {seismicModel.bValue?.toFixed(2)}
                    </span>{" "}
                    | Inter-event CV:{" "}
                    <span className="font-mono">
                      {seismicModel.interEventCV?.toFixed(2)}
                    </span>
                  </p>
                </Card>
              )}

              {landslideModel && (
                <Card className="p-3 border-emerald-500/30 bg-emerald-500/5">
                  <div className="flex items-center gap-2 mb-2">
                    <Mountain className="h-4 w-4 text-emerald-500" />
                    <span className="text-xs font-bold text-foreground">
                      ANN Landslide Network Model
                    </span>
                    <Badge
                      variant="outline"
                      className={`ml-auto text-[10px] ${landslideModel.riskLevel === "high" || landslideModel.riskLevel === "very_high" ? "bg-red-500/20 text-red-700 border-red-500/30" : "bg-green-500/20 text-green-700 border-green-500/30"}`}
                    >
                      {landslideModel.riskLevel?.toUpperCase()}
                    </Badge>
                  </div>
                  <p className="text-[11px] text-muted-foreground mb-1">
                    3-layer evaluation of Saturation + Open-Meteo Topography
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    P(failure):{" "}
                    <span className="font-mono">
                      {((landslideModel.probability || 0) * 100).toFixed(1)}%
                    </span>{" "}
                    | Altitude:{" "}
                    <span className="font-mono">
                      {landslideModel.elevation}m
                    </span>
                  </p>
                </Card>
              )}
            </div>
          </CollapsibleContent>
        </Collapsible>
      )}

      {/* ═══ CALCULATION BREAKDOWN (always visible after load) ═══ */}
      {!loading &&
        metadata?.calculationSteps &&
        metadata.calculationSteps.length > 0 && (
          <Collapsible
            open={showCalcSteps}
            onOpenChange={setShowCalcSteps}
            defaultOpen
          >
            <CollapsibleTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="w-full text-xs gap-1.5 border-border/50"
              >
                <Zap className="h-3.5 w-3.5 text-primary" />
                Calculation Breakdown — {metadata.calculationSteps.length} steps
                {showCalcSteps ? (
                  <ChevronUp className="h-3 w-3 ml-auto" />
                ) : (
                  <ChevronDown className="h-3 w-3 ml-auto" />
                )}
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="mt-2 space-y-2">
                {metadata.calculationSteps.map((step, i) => {
                  const statusConfig = getStepStatusConfig(step.status);
                  return (
                    <Card
                      key={i}
                      className="p-3 border-border/40 bg-background/80"
                    >
                      <div className="space-y-2">
                        {/* Step header */}
                        <div className="flex items-center gap-2">
                          {statusConfig.icon}
                          <span className="text-xs font-bold text-foreground">
                            Step {step.step}: {step.source}
                          </span>
                          <Badge
                            variant="outline"
                            className={`text-[10px] ml-auto px-1.5 py-0 h-5 ${statusConfig.badgeClass}`}
                          >
                            {statusConfig.label}
                          </Badge>
                          <span className="text-[10px] font-mono text-muted-foreground">
                            {step.duration_ms}ms
                          </span>
                        </div>

                        {/* Algorithm used */}
                        <p className="text-[11px] text-muted-foreground leading-relaxed pl-6">
                          {step.algorithm}
                        </p>

                        {/* Result */}
                        {step.result && (
                          <div className="flex items-start gap-1.5 pl-6 py-1.5 px-2 rounded bg-muted/50">
                            <ArrowRight className="h-3 w-3 text-primary mt-0.5 flex-shrink-0" />
                            <span className="text-[11px] font-medium text-foreground leading-relaxed">
                              {step.result}
                            </span>
                          </div>
                        )}

                        {/* Raw data grid */}
                        {step.rawData &&
                          Object.keys(step.rawData).length > 0 && (
                            <div className="pl-6">
                              <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                                Raw Data
                              </span>
                              <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-0.5 mt-1">
                                {Object.entries(step.rawData).map(([k, v]) => (
                                  <div
                                    key={k}
                                    className="text-[11px] flex items-baseline gap-1"
                                  >
                                    <span className="text-muted-foreground">
                                      {k}:
                                    </span>
                                    <span className="font-mono font-medium text-foreground">
                                      {typeof v === "number"
                                        ? (v as number).toFixed(2)
                                        : typeof v === "object" && v !== null
                                          ? JSON.stringify(v)
                                          : String(v)}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                        {/* Thresholds */}
                        {step.thresholds &&
                          Object.keys(step.thresholds).length > 0 && (
                            <div className="pl-6">
                              <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                                Thresholds Used
                              </span>
                              <div className="flex flex-wrap gap-1.5 mt-1">
                                {Object.entries(step.thresholds).map(
                                  ([k, v]) => (
                                    <span
                                      key={k}
                                      className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-mono"
                                    >
                                      {k}: {String(v)}
                                    </span>
                                  ),
                                )}
                              </div>
                            </div>
                          )}
                      </div>
                    </Card>
                  );
                })}
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
              className="w-full text-xs text-muted-foreground hover:text-foreground gap-1"
            >
              <Database className="h-3 w-3" />
              Data Sources & Algorithms
              {showSources ? (
                <ChevronUp className="h-3 w-3" />
              ) : (
                <ChevronDown className="h-3 w-3" />
              )}
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <Card className="p-3 border-border/30 mt-1">
              <div className="space-y-2 text-xs text-muted-foreground">
                <div>
                  <span className="font-semibold text-foreground">
                    Sources:
                  </span>{" "}
                  {metadata.sources.join(" • ")}
                </div>
                <div>
                  <span className="font-semibold text-foreground">
                    Algorithms:
                  </span>{" "}
                  {metadata.algorithmsUsed.join(" • ")}
                </div>
                <div>
                  <span className="font-semibold text-foreground">
                    Generated:
                  </span>{" "}
                  {new Date(metadata.generatedAt).toLocaleString()}
                </div>
              </div>
            </Card>
          </CollapsibleContent>
        </Collapsible>
      )}
    </div>
  );
};

export default EarlyAlerts;
