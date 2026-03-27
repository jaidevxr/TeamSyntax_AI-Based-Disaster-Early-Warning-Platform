import React, { useState, useRef, useCallback } from 'react';
import { Camera, Upload, X, AlertTriangle, CheckCircle, Loader2, ImageIcon, RotateCcw, Zap, Shield, ChevronDown, ChevronUp } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { HfInference } from '@huggingface/inference';

interface AnalysisResult {
  label: string;
  score: number;
}

interface DamageReport {
  overallSeverity: 'none' | 'minor' | 'moderate' | 'severe' | 'catastrophic';
  confidence: number;
  categories: AnalysisResult[];
  summary: string;
  recommendations: string[];
}


const SEVERITY_CONFIG = {
  none:         { color: 'from-emerald-500 to-green-600',  bg: 'bg-emerald-500/10', border: 'border-emerald-500/30', text: 'text-emerald-600', label: 'No Damage', emoji: '✅' },
  minor:        { color: 'from-sky-500 to-blue-600',       bg: 'bg-sky-500/10',     border: 'border-sky-500/30',     text: 'text-sky-600',     label: 'Minor',     emoji: '🔵' },
  moderate:     { color: 'from-amber-500 to-orange-600',   bg: 'bg-amber-500/10',   border: 'border-amber-500/30',   text: 'text-amber-600',   label: 'Moderate',  emoji: '🟠' },
  severe:       { color: 'from-red-500 to-rose-600',       bg: 'bg-red-500/10',     border: 'border-red-500/30',     text: 'text-red-600',     label: 'Severe',    emoji: '🔴' },
  catastrophic: { color: 'from-purple-600 to-red-700',     bg: 'bg-purple-500/10',  border: 'border-purple-500/30',  text: 'text-purple-600',  label: 'Catastrophic', emoji: '⚠️' },
};

const DisasterImageAnalyzer: React.FC = () => {
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [report, setReport] = useState<DamageReport | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleFile = useCallback((file: File) => {
    if (!file.type.startsWith('image/')) {
      toast({ title: 'Invalid file', description: 'Please upload an image file (JPG, PNG, WebP).', variant: 'destructive' });
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast({ title: 'File too large', description: 'Maximum file size is 10MB.', variant: 'destructive' });
      return;
    }
    setImageFile(file);
    setReport(null);
    const reader = new FileReader();
    reader.onload = (e) => setImagePreview(e.target?.result as string);
    reader.readAsDataURL(file);
  }, [toast]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const analyzeImage = async () => {
    if (!imageFile) return;
    setAnalyzing(true);
    setReport(null);

    try {
      // Read image as base64 for Llama 4 Scout vision
      const imageBytes = await imageFile.arrayBuffer();
      const base64 = btoa(
        new Uint8Array(imageBytes).reduce((data, byte) => data + String.fromCharCode(byte), '')
      );

      // Run HF ViT classification in parallel (supplementary data)
      const hfToken = import.meta.env.VITE_HF_TOKEN;
      const hf = hfToken ? new HfInference(hfToken) : null;
      const vitPromise = hf
        ? hf.imageClassification({ model: 'google/vit-base-patch16-224', data: imageFile }).catch(() => [])
        : Promise.resolve([]);

      // Primary: Llama 4 Scout Vision on Groq (can actually SEE the image)
      const groqKey = import.meta.env.VITE_GROQ_API_KEY;
      if (!groqKey) throw new Error('Groq API key not configured');

      const visionResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${groqKey}`,
        },
        body: JSON.stringify({
          model: 'meta-llama/llama-4-scout-17b-16e-instruct',
          messages: [
            {
              role: 'user',
              content: [
                {
                  type: 'image_url',
                  image_url: { url: `data:${imageFile.type};base64,${base64}` },
                },
                {
                  type: 'text',
                  text: `You are a disaster damage assessment AI. Analyze this image carefully and respond with ONLY a valid JSON object (no markdown, no explanation):
{
  "severity": "none" or "minor" or "moderate" or "severe" or "catastrophic",
  "confidence": 0.0 to 1.0,
  "disaster_type": "earthquake" or "flood" or "fire" or "cyclone" or "landslide" or "storm" or "none" or "other",
  "description": "2-3 sentence detailed description of what you see and the damage level",
  "details": [
    {"label": "specific damage category", "score": 0.0 to 1.0}
  ],
  "recommendations": ["specific action 1", "specific action 2", "specific action 3"]
}

Assessment rules:
- Collapsed/crumbled buildings = catastrophic earthquake damage (confidence 0.9+)
- Flooded streets/water damage = severe flood damage
- Burned/charred structures = severe fire damage  
- If buildings are visibly destroyed, severity MUST be "severe" or "catastrophic"
- confidence should reflect how clearly you can see damage (high for obvious destruction)
- details should list 3-5 specific damage observations with scores
- recommendations should be actionable safety advice`
                },
              ],
            },
          ],
          max_tokens: 500,
          temperature: 0.1,
        }),
      });

      if (!visionResponse.ok) {
        const errBody = await visionResponse.text().catch(() => '');
        console.error('Vision API error:', visionResponse.status, errBody);
        throw new Error(`Vision API error: ${visionResponse.status}`);
      }

      const visionData = await visionResponse.json();
      const content = visionData.choices?.[0]?.message?.content;
      if (!content) throw new Error('No response from vision AI');

      let parsed;
      try {
        const jsonStr = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        parsed = JSON.parse(jsonStr);
      } catch {
        console.error('Failed to parse vision response:', content);
        throw new Error('AI returned invalid format. Try again.');
      }

      // Get supplementary ViT results
      const vitResults = await vitPromise;

      processResults(parsed, vitResults as AnalysisResult[]);

    } catch (err: any) {
      console.error('Analysis failed:', err);
      toast({ title: 'Analysis failed', description: err.message || 'Could not analyze the image. Please try again.', variant: 'destructive' });
    } finally {
      setAnalyzing(false);
    }
  };

  const processResults = (data: any, vitResults: AnalysisResult[]) => {
    const severity = (['none', 'minor', 'moderate', 'severe', 'catastrophic'].includes(data.severity))
      ? data.severity as DamageReport['overallSeverity']
      : 'none';
    const confidence = Math.min(Math.max(data.confidence || 0.5, 0), 1);
    const details = Array.isArray(data.details) ? data.details : [];
    const description = data.description || '';
    const disasterType = data.disaster_type || '';

    // Combine vision AI categories + supplementary ViT labels
    const vitLabels = vitResults.slice(0, 3).map(d => ({ label: `[ViT] ${d.label}`, score: d.score }));
    const allCategories = [...details, ...vitLabels];

    const confidencePct = Math.round(confidence * 100);
    const summary = severity === 'none'
      ? `The image appears to show a normal scene with no visible disaster damage (${confidencePct}% confidence).`
      : `AI vision detected **${severity} ${disasterType} damage** — ${description} (${confidencePct}% confidence).`;

    const recommendations = Array.isArray(data.recommendations) && data.recommendations.length > 0
      ? data.recommendations
      : getRecommendations(severity, disasterType);

    setReport({
      overallSeverity: severity,
      confidence,
      categories: allCategories.slice(0, 6),
      summary,
      recommendations,
    });
  };

  const getRecommendations = (severity: DamageReport['overallSeverity'], label: string): string[] => {
    const base: string[] = [];
    if (severity === 'none') {
      return ['No immediate action required.', 'Continue monitoring local alerts via the Early Warnings tab.'];
    }
    base.push('Document the damage with multiple photos from different angles.');
    if (severity === 'severe' || severity === 'catastrophic') {
      base.push('🚨 EVACUATE the area immediately if you are nearby.');
      base.push('Call emergency services: 112 (National) or 1078 (Disaster Mgmt).');
      base.push('Do NOT enter damaged structures — risk of collapse.');
    }
    if (severity === 'moderate') {
      base.push('Avoid the affected area until authorities confirm safety.');
      base.push('Report damage to local disaster management authority.');
    }
    if (label.includes('flood')) {
      base.push('Move to higher ground. Avoid walking through floodwater.');
      base.push('Turn off electricity at the main switch if water is rising.');
    }
    if (label.includes('earthquake') || label.includes('collapsed')) {
      base.push('Check for gas leaks. DO NOT use open flames.');
      base.push('Be prepared for aftershocks.');
    }
    if (label.includes('fire')) {
      base.push('Call fire brigade: 101. Stay upwind from smoke.');
      base.push('Do not attempt to re-enter burned structures.');
    }
    if (severity === 'minor') {
      base.push('Assess structural integrity before re-entering.');
      base.push('Report damage to your local municipal office.');
    }
    return base;
  };

  const reset = () => {
    setImageFile(null);
    setImagePreview(null);
    setReport(null);
    setShowDetails(false);
  };

  const sev = report ? SEVERITY_CONFIG[report.overallSeverity] : null;

  return (
    <div className="h-full overflow-y-auto p-3 pt-4 pb-20 md:pb-3 sm:p-6 md:pt-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <div className="h-10 w-10 rounded-xl bg-[#2d5a27]/10 dark:bg-[#c8d8b8]/10 flex items-center justify-center border border-[#2d5a27]/20 dark:border-[#c8d8b8]/20">
            <Camera className="h-5 w-5 text-[#2d5a27] dark:text-[#c8d8b8]" />
          </div>
          <div>
            <h2 className="text-lg font-bold tracking-tight text-[#2d5a27] dark:text-[#c8d8b8]">Disaster Image Analyzer</h2>
            <p className="text-xs text-[#5a6b4f] dark:text-[#aab3a3]">AI-powered damage assessment via Llama Vision + HF</p>
          </div>
        </div>
        <div className="flex items-center gap-2 mt-2">
          <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-[#2d5a27]/8 dark:bg-[#c8d8b8]/10 text-[#2d5a27] dark:text-[#c8d8b8] text-[10px] font-semibold rounded-full border border-[#2d5a27]/15 dark:border-[#c8d8b8]/20">
            🦙 Llama 4 Scout Vision
          </span>
          <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-[#8b7355]/8 dark:bg-[#d4c5b0]/10 text-[#8b7355] dark:text-[#d4c5b0] text-[10px] font-semibold rounded-full border border-[#8b7355]/15 dark:border-[#d4c5b0]/20">
            🤗 HF ViT Classification
          </span>
        </div>
      </div>

      {/* Upload Area */}
      {!imagePreview ? (
        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          className={`relative border-2 border-dashed rounded-2xl p-8 sm:p-12 text-center transition-all duration-300 cursor-pointer group ${
            dragOver
              ? 'border-[#2d5a27] dark:border-[#c8d8b8] bg-[#2d5a27]/5 dark:bg-[#c8d8b8]/10 scale-[1.01]'
              : 'border-[#c4b99a]/60 dark:border-[#5a6b4f]/40 hover:border-[#2d5a27]/40 dark:hover:border-[#c8d8b8]/40 hover:bg-[#f5f0e8]/50 dark:hover:bg-[#c8d8b8]/5'
          }`}
          onClick={() => fileInputRef.current?.click()}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
          />
          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
          />

          <div className="flex flex-col items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-[#2d5a27]/8 dark:bg-[#c8d8b8]/10 flex items-center justify-center border border-[#2d5a27]/15 dark:border-[#c8d8b8]/20 group-hover:scale-105 transition-transform duration-300">
              <ImageIcon className="w-7 h-7 text-[#2d5a27]/70 dark:text-[#c8d8b8]/70" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground mb-1">Upload disaster image</p>
              <p className="text-xs text-muted-foreground">Drag & drop or tap to select • JPG, PNG, WebP • Max 10MB</p>
            </div>
          </div>

          <div className="flex items-center justify-center gap-3 mt-6">
            <button
              onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}
              className="flex items-center gap-2 px-4 py-2.5 bg-white/70 dark:bg-white/10 border border-[#c4b99a]/40 dark:border-[#5a6b4f]/40 rounded-xl text-xs font-semibold text-foreground hover:bg-white dark:hover:bg-white/20 transition-all active:scale-95"
            >
              <Upload className="w-4 h-4" /> Gallery
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); cameraInputRef.current?.click(); }}
              className="flex items-center gap-2 px-4 py-2.5 bg-[#2d5a27] dark:bg-[#4a7e44] rounded-xl text-xs font-semibold text-white hover:bg-[#3a6b33] dark:hover:bg-[#5a8b54] transition-all active:scale-95"
            >
              <Camera className="w-4 h-4" /> Camera
            </button>
          </div>
        </div>
      ) : (
        /* Image Preview + Analysis */
        <div className="space-y-4">
          {/* Preview */}
          <div className="relative rounded-2xl overflow-hidden border border-[#c4b99a]/30 shadow-sm">
            <img
              src={imagePreview}
              alt="Upload preview"
              className="w-full max-h-[300px] sm:max-h-[400px] object-cover"
            />
            <button
              onClick={reset}
              className="absolute top-3 right-3 w-8 h-8 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center text-white hover:bg-black/60 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
            {analyzing && (
              <div className="absolute inset-0 bg-black/30 backdrop-blur-sm flex flex-col items-center justify-center gap-3">
                <Loader2 className="w-8 h-8 text-white animate-spin" />
                <p className="text-white text-sm font-semibold">Analyzing image...</p>
                <p className="text-white/60 text-xs">Classifying damage severity</p>
              </div>
            )}
          </div>

          {/* Analyze Button */}
          {!report && !analyzing && (
            <button
              onClick={analyzeImage}
              className="w-full py-3.5 bg-[#2d5a27] dark:bg-[#4a7e44] rounded-xl text-white font-semibold text-sm hover:bg-[#3a6b33] dark:hover:bg-[#5a8b54] transition-all active:scale-[0.98] flex items-center justify-center gap-2"
            >
              <Zap className="w-4 h-4" /> Analyze Damage
            </button>
          )}

          {/* Results */}
          {report && sev && (
            <div className="space-y-3">
              {/* Severity Badge */}
              <div className={`p-4 rounded-2xl border ${sev.border} ${sev.bg}`}>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{sev.emoji}</span>
                    <div>
                      <h3 className={`text-base font-bold ${sev.text}`}>{sev.label} Damage</h3>
                      <p className="text-xs text-muted-foreground">Confidence: {Math.round(report.confidence * 100)}%</p>
                    </div>
                  </div>
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center bg-gradient-to-br ${sev.color} text-white font-bold text-sm`}>
                    {Math.round(report.confidence * 100)}%
                  </div>
                </div>
                <div className="w-full bg-black/5 dark:bg-white/5 rounded-full h-1.5 overflow-hidden">
                  <div
                    className={`h-full bg-gradient-to-r ${sev.color} rounded-full transition-all duration-1000`}
                    style={{ width: `${report.confidence * 100}%` }}
                  />
                </div>
              </div>

              {/* Summary */}
              <div className="p-4 rounded-2xl bg-[#f5f0e8]/50 dark:bg-card/50 border border-[#c4b99a]/20 dark:border-white/10">
                <h4 className="text-xs font-semibold text-[#5a6b4f] dark:text-[#aab3a3] uppercase tracking-wider mb-2">AI Assessment</h4>
                <p className="text-sm text-foreground leading-relaxed">
                  {report.summary.split('**').map((part, i) =>
                    i % 2 === 1 ? <strong key={i} className={sev.text}>{part}</strong> : part
                  )}
                </p>
              </div>

              {/* Recommendations */}
              <div className="p-4 rounded-2xl bg-[#f5f0e8]/50 dark:bg-card/50 border border-[#c4b99a]/20 dark:border-white/10">
                <h4 className="text-xs font-semibold text-[#5a6b4f] dark:text-[#aab3a3] uppercase tracking-wider mb-3 flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5" /> Recommended Actions
                </h4>
                <ul className="space-y-2">
                  {report.recommendations.map((rec, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-foreground">
                      <CheckCircle className={`w-4 h-4 mt-0.5 shrink-0 ${sev.text}`} />
                      <span>{rec}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Detailed Scores */}
              <div className="rounded-2xl bg-[#f5f0e8]/50 dark:bg-card/50 border border-[#c4b99a]/20 dark:border-white/10 overflow-hidden">
                <button
                  onClick={() => setShowDetails(!showDetails)}
                  className="w-full p-4 flex items-center justify-between text-xs font-semibold text-[#5a6b4f] dark:text-[#aab3a3] uppercase tracking-wider hover:bg-[#2d5a27]/5 dark:hover:bg-white/5 transition-colors"
                >
                  <span>Classification Details ({report.categories.length})</span>
                  {showDetails ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>
                {showDetails && (
                  <div className="px-4 pb-4 space-y-2.5">
                    {report.categories.map((cat, i) => (
                      <div key={i}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs text-foreground truncate pr-2">{cat.label}</span>
                          <span className="text-xs font-semibold text-muted-foreground shrink-0">{Math.round(cat.score * 100)}%</span>
                        </div>
                        <div className="w-full bg-[#2d5a27]/8 dark:bg-white/5 rounded-full h-1.5">
                          <div
                            className={`h-full rounded-full transition-all duration-700 ${i === 0 ? `bg-gradient-to-r ${sev.color}` : 'bg-[#8b7355]/30'}`}
                            style={{ width: `${cat.score * 100}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Reset */}
              <button
                onClick={reset}
                className="w-full py-3 border border-[#c4b99a]/40 rounded-xl text-sm font-semibold text-muted-foreground hover:text-foreground hover:bg-[#f5f0e8]/50 transition-all flex items-center justify-center gap-2"
              >
                <RotateCcw className="w-4 h-4" /> Analyze Another Image
              </button>
            </div>
          )}
        </div>
      )}

      {/* Info Footer */}
      <div className="mt-6 p-3 rounded-xl bg-[#f5f0e8]/40 dark:bg-[#d4c5b0]/5 border border-[#c4b99a]/15 dark:border-[#d4c5b0]/15">
        <div className="flex items-start gap-2">
          <Shield className="w-4 h-4 text-[#8b7355] dark:text-[#d4c5b0] mt-0.5 shrink-0" />
          <p className="text-[10px] text-[#8b7355] dark:text-[#d4c5b0] leading-relaxed">
            <strong>Powered by Llama 4 Scout Vision</strong> + Hugging Face ViT. AI vision model analyzes your image directly to assess disaster damage. Images are processed via API and not stored. For emergencies, call <strong>112</strong>.
          </p>
        </div>
      </div>
    </div>
  );
};

export default DisasterImageAnalyzer;
