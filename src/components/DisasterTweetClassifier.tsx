import React, { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import {
  Brain,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Sparkles,
  Zap,
  SearchCheck,
  XCircle,
  RefreshCw,
  Copy,
} from 'lucide-react';

interface ClassificationResult {
  label: string;
  score: number;
}

interface DisasterTweetClassifierProps {
  language: 'en' | 'hi';
}

const EXAMPLE_TEXTS = [
  "Massive earthquake hits central Nepal, buildings collapsed in Kathmandu",
  "Heavy flooding reported in Assam, 50000 people displaced from homes",
  "Just had a nice dinner with friends at the new restaurant downtown",
  "Cyclone Biparjoy intensifies into severe storm, Gujarat coast on high alert",
  "Forest fire spreading across Uttarakhand hills, army deployed for rescue",
  "Traffic jam on Delhi-Noida expressway, vehicles stuck for 2 hours",
  "Landslide blocks NH-5 near Shimla, rescue teams rushing to site",
];

const DisasterTweetClassifier: React.FC<DisasterTweetClassifierProps> = ({ language }) => {
  const [inputText, setInputText] = useState('');
  const [results, setResults] = useState<ClassificationResult[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<{ text: string; isDisaster: boolean; confidence: number }[]>([]);

  const t = language === 'hi' ? {
    title: 'AI आपदा पाठ वर्गीकरण',
    subtitle: 'BERT NLP मॉडल · HuggingFace',
    placeholder: 'कोई समाचार शीर्षक, ट्वीट, या सोशल मीडिया पोस्ट पेस्ट करें...',
    classify: 'AI विश्लेषण चलाएं',
    classifying: 'मॉडल अनुमान...',
    disaster: 'आपदा',
    notDisaster: 'गैर-आपदा',
    confidence: 'विश्वास',
    tryExamples: 'उदाहरण आज़माएं',
    history: 'विश्लेषण इतिहास',
    modelInfo: 'BERT ट्रांसफार्मर मॉडल · 25K+ आपदा ट्वीट्स पर प्रशिक्षित',
  } : {
    title: 'AI Disaster Text Classifier',
    subtitle: 'BERT NLP Model · HuggingFace',
    placeholder: 'Paste any news headline, tweet, or social media post...',
    classify: 'Run AI Analysis',
    classifying: 'Model inference...',
    disaster: 'DISASTER',
    notDisaster: 'NOT DISASTER',
    confidence: 'Confidence',
    tryExamples: 'Try Examples',
    history: 'Analysis History',
    modelInfo: 'BERT Transformer Model · Trained on 25K+ disaster tweets',
  };

  const classify = async (text: string) => {
    if (!text.trim()) return;
    setLoading(true);
    setError(null);
    setResults(null);

    try {
      const hfToken = import.meta.env.VITE_HF_TOKEN;
      const response = await fetch(
        'https://api-inference.huggingface.co/models/jnehring/bert-disaster-tweets',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(hfToken ? { Authorization: `Bearer ${hfToken}` } : {}),
          },
          body: JSON.stringify({ inputs: text }),
        }
      );

      if (!response.ok) {
        // Model might be loading, retry after a delay
        if (response.status === 503) {
          setError('Model is loading... Please try again in 10 seconds.');
          setLoading(false);
          return;
        }
        throw new Error(`API Error: ${response.status}`);
      }

      const data = await response.json();

      // HF returns [[{label, score}, ...]] for text classification
      const classifications: ClassificationResult[] = Array.isArray(data[0]) ? data[0] : data;
      setResults(classifications);

      // Determine if disaster
      const disasterResult = classifications.find(
        (r) => r.label === 'LABEL_1' || r.label.toLowerCase().includes('disaster')
      );
      const isDisaster = disasterResult ? disasterResult.score > 0.5 : false;
      const confidence = disasterResult?.score || (1 - (classifications[0]?.score || 0));

      setHistory((prev) => [
        { text: text.slice(0, 100), isDisaster, confidence },
        ...prev.slice(0, 9),
      ]);
    } catch (err: any) {
      setError(err.message || 'Classification failed');
    } finally {
      setLoading(false);
    }
  };

  const getDisasterScore = () => {
    if (!results) return null;
    // LABEL_1 = disaster, LABEL_0 = not disaster
    const disaster = results.find((r) => r.label === 'LABEL_1');
    const notDisaster = results.find((r) => r.label === 'LABEL_0');
    return {
      isDisaster: disaster ? disaster.score > 0.5 : false,
      disasterProb: disaster?.score || 0,
      safeProb: notDisaster?.score || 0,
    };
  };

  const result = getDisasterScore();

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-violet-600 to-indigo-700 flex items-center justify-center shadow-lg shadow-violet-500/30">
          <Brain className="h-5 w-5 text-white" />
        </div>
        <div>
          <h2 className="text-lg font-extrabold tracking-tight text-foreground flex items-center gap-2">
            {t.title}
            <Sparkles className="h-4 w-4 text-violet-500 animate-pulse" />
          </h2>
          <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-widest">
            {t.subtitle}
          </p>
        </div>
      </div>

      {/* Input Card */}
      <Card className="p-4 space-y-3 border-violet-200/50 dark:border-violet-500/10 bg-gradient-to-br from-violet-50/50 to-white dark:from-violet-950/20 dark:to-slate-900/90">
        <Textarea
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder={t.placeholder}
          className="h-24 text-sm resize-none"
        />

        <div className="flex items-center gap-2">
          <Button
            onClick={() => classify(inputText)}
            disabled={loading || !inputText.trim()}
            className="flex-1 gap-2 font-bold bg-gradient-to-r from-violet-600 to-indigo-700 hover:from-violet-700 hover:to-indigo-800 text-white shadow-lg shadow-violet-500/30 h-11"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <SearchCheck className="h-4 w-4" />
            )}
            {loading ? t.classifying : t.classify}
          </Button>
          {inputText && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setInputText('');
                setResults(null);
              }}
              className="h-11 px-3"
            >
              <RefreshCw className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>

        {/* Example chips */}
        <div>
          <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest mb-1.5">
            {t.tryExamples}
          </p>
          <div className="flex flex-wrap gap-1.5">
            {EXAMPLE_TEXTS.map((ex, i) => (
              <button
                key={i}
                onClick={() => {
                  setInputText(ex);
                  classify(ex);
                }}
                className="px-2.5 py-1 rounded-lg bg-violet-50 dark:bg-violet-500/10 text-[10px] font-medium text-violet-700 dark:text-violet-300 border border-violet-200/50 dark:border-violet-500/20 hover:bg-violet-100 dark:hover:bg-violet-500/20 transition-all truncate max-w-[200px]"
              >
                {ex.slice(0, 50)}...
              </button>
            ))}
          </div>
        </div>
      </Card>

      {/* Result Card */}
      {result && (
        <Card
          className={`p-5 border-2 transition-all duration-500 animate-in slide-in-from-bottom-4 ${
            result.isDisaster
              ? 'border-red-500/30 bg-red-50/50 dark:bg-red-950/20'
              : 'border-green-500/30 bg-green-50/50 dark:bg-green-950/20'
          }`}
        >
          <div className="flex items-center gap-4">
            {/* Verdict Icon */}
            <div
              className={`h-16 w-16 rounded-2xl flex items-center justify-center shadow-xl flex-shrink-0 ${
                result.isDisaster
                  ? 'bg-gradient-to-br from-red-500 to-orange-600 shadow-red-500/30'
                  : 'bg-gradient-to-br from-green-500 to-emerald-600 shadow-green-500/30'
              }`}
            >
              {result.isDisaster ? (
                <AlertTriangle className="h-8 w-8 text-white" />
              ) : (
                <CheckCircle2 className="h-8 w-8 text-white" />
              )}
            </div>

            <div className="flex-1">
              {/* Verdict */}
              <div className="flex items-center gap-2 mb-1">
                <Badge
                  className={`text-sm font-black px-3 py-1 ${
                    result.isDisaster
                      ? 'bg-red-500 text-white'
                      : 'bg-green-500 text-white'
                  }`}
                >
                  {result.isDisaster ? `🚨 ${t.disaster}` : `✅ ${t.notDisaster}`}
                </Badge>
              </div>

              {/* Confidence Bar */}
              <div className="space-y-1">
                <div className="flex justify-between text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                  <span>{t.confidence}</span>
                  <span>{(result.disasterProb * 100).toFixed(1)}%</span>
                </div>
                <div className="h-2.5 bg-muted rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-1000 ${
                      result.isDisaster
                        ? 'bg-gradient-to-r from-red-500 to-orange-500'
                        : 'bg-gradient-to-r from-green-500 to-emerald-500'
                    }`}
                    style={{ width: `${result.disasterProb * 100}%` }}
                  />
                </div>
                <div className="flex justify-between text-[9px] text-muted-foreground">
                  <span>Safe ({(result.safeProb * 100).toFixed(1)}%)</span>
                  <span>Disaster ({(result.disasterProb * 100).toFixed(1)}%)</span>
                </div>
              </div>
            </div>
          </div>

          {/* Model info */}
          <div className="mt-3 pt-3 border-t border-border/30 flex items-center gap-2">
            <Zap className="h-3 w-3 text-violet-500" />
            <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest">
              {t.modelInfo}
            </span>
          </div>
        </Card>
      )}

      {/* Error */}
      {error && (
        <Card className="p-3 border-red-200 dark:border-red-500/20 bg-red-50/50 dark:bg-red-950/20 flex items-center gap-2">
          <XCircle className="h-4 w-4 text-red-500 flex-shrink-0" />
          <p className="text-xs font-medium text-red-600 dark:text-red-400">{error}</p>
        </Card>
      )}

      {/* History */}
      {history.length > 0 && (
        <div>
          <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest mb-2">
            {t.history} ({history.length})
          </p>
          <div className="space-y-1">
            {history.map((item, i) => (
              <div
                key={i}
                className="flex items-center justify-between p-2 rounded-lg bg-muted/30 border border-border/30"
              >
                <p className="text-[11px] text-foreground/80 truncate flex-1 mr-2 font-medium">
                  {item.text}
                </p>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <Badge
                    variant="outline"
                    className={`text-[8px] font-black px-1.5 py-0 ${
                      item.isDisaster
                        ? 'border-red-300 text-red-600 dark:text-red-400'
                        : 'border-green-300 text-green-600 dark:text-green-400'
                    }`}
                  >
                    {item.isDisaster ? '🚨' : '✅'} {(item.confidence * 100).toFixed(0)}%
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default DisasterTweetClassifier;
