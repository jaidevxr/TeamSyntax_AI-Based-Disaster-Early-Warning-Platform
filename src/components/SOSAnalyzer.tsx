import React, { useState, useEffect, useRef } from 'react';
import { pipeline } from '@huggingface/transformers';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
    Loader2,
    Send,
    ShieldAlert,
    AlertCircle,
    Zap,
    CheckCircle2,
    Info
} from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import { sanitizeInput } from '@/utils/security';

const SOSAnalyzer: React.FC = () => {
    const [inputText, setInputText] = useState('');
    const [isModelLoading, setIsModelLoading] = useState(false);
    const [loadingProgress, setLoadingProgress] = useState(0);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [results, setResults] = useState<any>(null);
    const classifierRef = useRef<any>(null);

    const categories = [
        'Rescue Needed',
        'Medical Emergency',
        'Food & Water Shortage',
        'Flood Hazard',
        'Fire Hazard',
        'Safe / Not Urgent'
    ];

    // Initialize model on component mount or first use
    const loadModel = async () => {
        if (classifierRef.current) return classifierRef.current;

        setIsModelLoading(true);
        setLoadingProgress(10);

        try {
            // Use a lightweight zero-shot classification model from Hugging Face
            // This runs 100% in-browser via Transformers.js
            const classifier = await pipeline('zero-shot-classification', 'Xenova/mobilebert-uncased-mnli', {
                progress_callback: (p: any) => {
                    if (p.status === 'progress') {
                        setLoadingProgress(Math.round(p.progress));
                    }
                }
            });

            classifierRef.current = classifier;
            setIsModelLoading(false);
            return classifier;
        } catch (error) {
            console.error('Error loading Hugging Face model:', error);
            toast.error('Failed to load NLP model. Please check your connection.');
            setIsModelLoading(false);
            return null;
        }
    };

    const analyzeSOS = async () => {
        if (!inputText.trim()) {
            toast.error('Please enter an SOS message to analyze.');
            return;
        }

        const sanitized = sanitizeInput(inputText);
        setIsAnalyzing(true);

        try {
            const classifier = await loadModel();
            if (!classifier) {
                setIsAnalyzing(false);
                return;
            }

            // Perform real zero-shot classification locally
            const output = await classifier(sanitized, categories);

            setResults(output);
            toast.success('Analysis complete!');
        } catch (error) {
            console.error('Analysis error:', error);
            toast.error('Error during analysis.');
        } finally {
            setIsAnalyzing(false);
        }
    };

    const getUrgencyColor = (label: string, score: number) => {
        if (label === 'Safe / Not Urgent') return 'bg-success/20 text-success border-success/30';
        if (score > 0.6) return 'bg-destructive/20 text-destructive border-destructive/30';
        if (score > 0.3) return 'bg-warning/20 text-warning border-warning/30';
        return 'bg-primary/20 text-primary border-primary/30';
    };

    return (
        <div className="max-w-4xl mx-auto space-y-6">
            <div className="flex flex-col gap-2">
                <h1 className="text-3xl font-bold tracking-tight">ML Signal Analyzer</h1>
                <p className="text-muted-foreground">
                    Real-time Zero-Shot NLP classification using Hugging Face's <code className="bg-muted px-1 rounded text-primary">Transformers.js</code>.
                    Analyzes emergency messages locally in your browser.
                </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="md:col-span-2 space-y-4">
                    <Card className="p-6 glass border-primary/20 relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-3 opacity-10">
                            <ShieldAlert className="h-16 w-16" />
                        </div>

                        <div className="space-y-4 relative z-10">
                            <div className="flex items-center gap-2 mb-2">
                                <AlertCircle className="h-5 w-5 text-primary" />
                                <h3 className="font-semibold">Enter Emergency Message / SOS</h3>
                            </div>

                            <Textarea
                                placeholder="Example: 'Help! We are trapped on the second floor of our house in Kerala. The water level is rising fast and we have no food or medical supplies. Please send a boat rescue team!'"
                                className="min-h-[150px] bg-background/50 border-primary/20 focus:border-primary transition-all resize-none text-base"
                                value={inputText}
                                onChange={(e) => setInputText(e.target.value)}
                            />

                            <div className="flex items-center justify-between pt-2">
                                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                    <Info className="h-3 w-3" />
                                    <span>Model: mobilebert-uncased-mnli (25MB)</span>
                                </div>

                                <Button
                                    onClick={analyzeSOS}
                                    disabled={isAnalyzing || isModelLoading}
                                    className="bg-primary hover:bg-primary/90 text-white font-bold px-6 shadow-lg shadow-primary/20"
                                >
                                    {isAnalyzing || isModelLoading ? (
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    ) : (
                                        <Zap className="mr-2 h-4 w-4 fill-current" />
                                    )}
                                    {isModelLoading ? 'Downloading Model...' : isAnalyzing ? 'Analyzing Text...' : 'Analyze Now'}
                                </Button>
                            </div>

                            {isModelLoading && (
                                <div className="space-y-2 pt-2 animate-in fade-in slide-in-from-bottom-2">
                                    <div className="flex justify-between text-xs font-medium">
                                        <span>Downloading Neural Network to Browser...</span>
                                        <span>{loadingProgress}%</span>
                                    </div>
                                    <Progress value={loadingProgress} className="h-1.5" />
                                </div>
                            )}
                        </div>
                    </Card>

                    {results && (
                        <Card className="p-6 glass border-success/20 animate-in zoom-in-95 duration-300">
                            <div className="flex items-center gap-2 mb-6 border-b border-border/20 pb-4">
                                <CheckCircle2 className="h-5 w-5 text-success" />
                                <h3 className="font-semibold text-lg">Neural Multi-Label Analysis</h3>
                            </div>

                            <div className="space-y-5">
                                {results.labels.map((label: string, index: number) => {
                                    const score = results.scores[index];
                                    const percentage = Math.round(score * 100);

                                    return (
                                        <div key={label} className="space-y-2">
                                            <div className="flex justify-between items-center">
                                                <div className="flex items-center gap-2">
                                                    <Badge variant="outline" className={getUrgencyColor(label, score)}>
                                                        {label}
                                                    </Badge>
                                                    <span className="text-xs text-muted-foreground">
                                                        {score > 0.5 ? 'High Confidence' : 'Low Confidence'}
                                                    </span>
                                                </div>
                                                <span className="font-bold text-sm tracking-tighter">{percentage}%</span>
                                            </div>
                                            <Progress value={percentage} className={`h-2 ${score > 0.5 ? '[&>div]:bg-primary' : ''}`} />
                                        </div>
                                    );
                                })}
                            </div>
                        </Card>
                    )}
                </div>

                <div className="space-y-6">
                    <Card className="p-5 glass border-border/30 bg-primary/5">
                        <h4 className="font-bold text-sm mb-3 flex items-center gap-2">
                            <ShieldAlert className="h-4 w-4 text-primary" />
                            Why this is "Real ML"
                        </h4>
                        <ul className="text-xs space-y-3 text-muted-foreground leading-relaxed">
                            <li className="flex gap-2">
                                <div className="h-1.5 w-1.5 rounded-full bg-primary mt-1.5 shrink-0" />
                                <span>Uses <strong>Zero-Shot Classification</strong>, meaning the model understands context without pre-defined keywords.</span>
                            </li>
                            <li className="flex gap-2">
                                <div className="h-1.5 w-1.5 rounded-full bg-primary mt-1.5 shrink-0" />
                                <span>Employs a <strong>MobileBERT Neural Network</strong> with millions of parameters.</span>
                            </li>
                            <li className="flex gap-2">
                                <div className="h-1.5 w-1.5 rounded-full bg-primary mt-1.5 shrink-0" />
                                <span>Runs <strong>100% Client-Side</strong>. Your data never leaves your device — pure browser-based inference.</span>
                            </li>
                        </ul>
                    </Card>

                    <Card className="p-5 glass border-border/30 bg-accent/5">
                        <h4 className="font-bold text-sm mb-2">Example Scenarios</h4>
                        <div className="space-y-2">
                            <Button
                                variant="ghost"
                                size="sm"
                                className="w-full justify-start text-[11px] h-auto p-2 border border-border/20 hover:bg-background/50 text-left"
                                onClick={() => setInputText("Medical supplies needed immediately at sector 7. Many injured children.")}
                            >
                                "Medical supplies needed..."
                            </Button>
                            <Button
                                variant="ghost"
                                size="sm"
                                className="w-full justify-start text-[11px] h-auto p-2 border border-border/20 hover:bg-background/50 text-left"
                                onClick={() => setInputText("The rain has stopped, we are just waiting for the water to clear.")}
                            >
                                "The rain has stopped..."
                            </Button>
                        </div>
                    </Card>
                </div>
            </div>
        </div>
    );
};

export default SOSAnalyzer;
