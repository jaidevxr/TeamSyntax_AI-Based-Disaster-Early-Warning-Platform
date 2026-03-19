import React, { useState, useRef } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
    Users,
    Truck,
    Droplets,
    Heart,
    Utensils,
    Plus,
    MapPin,
    Phone,
    ShieldCheck,
    Search,
    CheckCircle2,
    Zap,
    Loader2,
    AlertCircle,
    Info,
    ShieldAlert
} from 'lucide-react';
import { pipeline } from '@huggingface/transformers';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import { sanitizeInput } from '@/utils/security';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';

interface Resource {
    id: string;
    type: 'vehicle' | 'food' | 'water' | 'medical' | 'other';
    name: string;
    location: string;
    contact: string;
    status: 'available' | 'in-use' | 'needed';
    description: string;
}

const VolunteerHub: React.FC = () => {
    const [resources, setResources] = useState<Resource[]>([
        {
            id: '1',
            type: 'vehicle',
            name: '4x4 Off-road Jeep',
            location: 'Kochi, Kerala',
            contact: '+91 98765 43210',
            status: 'available',
            description: 'Available for flood rescue and supply transport.'
        },
        {
            id: '2',
            type: 'medical',
            name: 'Dr. Rahul Sharma (General Physician)',
            location: 'Muvattupuzha',
            contact: '+91 91234 56789',
            status: 'available',
            description: 'Volunteer doctor with basic medical kit.'
        },
        {
            id: '3',
            type: 'water',
            name: '1000L Drinking Water Tanker',
            location: 'Aluva Sector 4',
            contact: '+91 88888 77777',
            status: 'available',
            description: 'Fresh drinking water for community use.'
        }
    ]);

    const [showAddForm, setShowAddForm] = useState(false);
    const [showVolunteerDialog, setShowVolunteerDialog] = useState(false);
    const [registrationData, setRegistrationData] = useState({
        name: '',
        phone: '',
        skills: ''
    });
    const [isVolunteer, setIsVolunteer] = useState(() => {
        return localStorage.getItem('is_volunteer') === 'true';
    });

    const [newResource, setNewResource] = useState<Partial<Resource>>({
        type: 'food',
        status: 'available'
    });

    const getIcon = (type: string) => {
        switch (type) {
            case 'vehicle': return <Truck className="h-5 w-5" />;
            case 'food': return <Utensils className="h-5 w-5" />;
            case 'water': return <Droplets className="h-5 w-5" />;
            case 'medical': return <Heart className="h-5 w-5" />;
            default: return <Plus className="h-5 w-5" />;
        }
    };

    const getTypeColor = (type: string) => {
        switch (type) {
            case 'vehicle': return 'bg-blue-500/10 text-blue-600 border-blue-500/20';
            case 'medical': return 'bg-red-500/10 text-red-600 border-red-500/20';
            case 'food': return 'bg-orange-500/10 text-orange-600 border-orange-500/20';
            case 'water': return 'bg-cyan-500/10 text-cyan-600 border-cyan-500/20';
            default: return 'bg-slate-500/10 text-slate-600 border-slate-500/20';
        }
    };

    const [activeSection, setActiveSection] = useState<'resources' | 'analysis'>('resources');
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

    const loadModel = async () => {
        if (classifierRef.current) return classifierRef.current;
        setIsModelLoading(true);
        setLoadingProgress(10);
        try {
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
            console.error('Error loading NLP model:', error);
            toast.error('Failed to load NLP model.');
            setIsModelLoading(false);
            return null;
        }
    };

    const analyzeSOS = async () => {
        if (!inputText.trim()) {
            toast.error('Please enter a message to analyze.');
            return;
        }
        setIsAnalyzing(true);
        try {
            const classifier = await loadModel();
            if (!classifier) {
                setIsAnalyzing(false);
                return;
            }
            const sanitized = sanitizeInput(inputText);
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

    const handleAddResource = () => {
        if (!newResource.name || !newResource.contact) {
            toast.error('Please fill in required fields');
            return;
        }
        const resource: Resource = {
            id: Date.now().toString(),
            type: newResource.type as any,
            name: sanitizeInput(newResource.name || ''),
            location: sanitizeInput(newResource.location || 'Unknown'),
            contact: sanitizeInput(newResource.contact || ''),
            status: 'available',
            description: sanitizeInput(newResource.description || '')
        };
        setResources([resource, ...resources]);
        setShowAddForm(false);
        toast.success('Resource listed successfully');
    };

    const handleJoinAsVolunteer = () => {
        if (!registrationData.name || !registrationData.phone) {
            toast.error('Please fill in your name and phone number');
            return;
        }
        setIsVolunteer(true);
        localStorage.setItem('is_volunteer', 'true');
        setShowVolunteerDialog(false);
        const sName = sanitizeInput(registrationData.name);
        toast.success(`Welcome aboard, ${sName}!`, {
            description: "You are now registered as an active volunteer."
        });
    };

    return (
        <div className="max-w-5xl mx-auto space-y-6 pb-20">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border/10 pb-6">
                <div>
                    <h1 className="text-3xl font-black italic tracking-tighter text-foreground">
                        COMMUNITY <span className="text-primary">RESOURCE HUB</span>
                    </h1>
                    <p className="text-muted-foreground text-sm uppercase font-bold tracking-widest flex items-center gap-2">
                        <Users className="h-4 w-4" /> Coordination & Relief Management
                    </p>
                </div>

                <Button
                    onClick={() => setShowAddForm(!showAddForm)}
                    className="bg-primary hover:bg-primary/90 text-white font-black"
                >
                    <Plus className="mr-2 h-4 w-4" /> LIST A RESOURCE
                </Button>
            </div>

            <div className="flex items-center gap-2 mb-6 p-1 bg-muted/30 rounded-lg w-fit">
                <Button
                    variant={activeSection === 'resources' ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => setActiveSection('resources')}
                    className="text-xs font-bold"
                >
                    <Truck className="h-3.5 w-3.5 mr-1" /> RESOURCES
                </Button>
                <Button
                    variant={activeSection === 'analysis' ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => setActiveSection('analysis')}
                    className="text-xs font-bold"
                >
                    <Zap className="h-3.5 w-3.5 mr-1" /> RESCUE DISPATCH ML
                </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="md:col-span-2 space-y-6">
                    {activeSection === 'analysis' ? (
                        <div className="space-y-6">
                            <Card className="p-6 glass border-primary/20 relative overflow-hidden">
                                <div className="absolute top-0 right-0 p-3 opacity-10">
                                    <ShieldAlert className="h-16 w-16" />
                                </div>
                                <div className="space-y-4 relative z-10">
                                    <h3 className="font-bold flex items-center gap-2">
                                        <AlertCircle className="h-5 w-5 text-primary" /> Community Report Signal Analysis
                                    </h3>
                                    <Textarea
                                        placeholder="Paste community emergency messages here for ML signal classification..."
                                        className="min-h-[150px] bg-background/50 border-primary/20"
                                        value={inputText}
                                        onChange={(e) => setInputText(e.target.value)}
                                    />
                                    <div className="flex items-center justify-between">
                                        <span className="text-[10px] text-muted-foreground uppercase font-bold tabular-nums">
                                            Model: mobilebert-uncased-mnli (Local)
                                        </span>
                                        <Button
                                            onClick={analyzeSOS}
                                            disabled={isAnalyzing || isModelLoading}
                                            className="bg-primary font-bold shadow-lg shadow-primary/20"
                                        >
                                            {isAnalyzing || isModelLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Zap className="mr-2 h-4 w-4 fill-current" />}
                                            {isModelLoading ? 'LOADING MODEL...' : isAnalyzing ? 'ANALYZING...' : 'ANALYZE SIGNAL'}
                                        </Button>
                                    </div>
                                    {isModelLoading && (
                                        <div className="space-y-2 pt-2">
                                            <div className="flex justify-between text-[10px] font-bold">
                                                <span>INITIALIZING NEURAL NETWORK...</span>
                                                <span>{loadingProgress}%</span>
                                            </div>
                                            <Progress value={loadingProgress} className="h-1" />
                                        </div>
                                    )}
                                </div>
                            </Card>

                            {results && (
                                <Card className="p-6 glass border-success/20 animate-in zoom-in-95 duration-300">
                                    <h3 className="font-bold mb-6 text-sm uppercase flex items-center gap-2 underline underline-offset-4 decoration-primary">
                                        <CheckCircle2 className="h-5 w-5 text-success" /> ML SIGNAL DECODING RESULTS
                                    </h3>
                                    <div className="space-y-5">
                                        {results.labels.map((label: string, index: number) => {
                                            const score = results.scores[index];
                                            const percentage = Math.round(score * 100);
                                            return (
                                                <div key={label} className="space-y-2">
                                                    <div className="flex justify-between items-center text-[10px] font-black uppercase">
                                                        <Badge variant="outline" className={getUrgencyColor(label, score)}>
                                                            {label}
                                                        </Badge>
                                                        <span>{percentage}%</span>
                                                    </div>
                                                    <Progress value={percentage} className={`h-1 ${score > 0.5 ? '[&>div]:bg-primary' : ''}`} />
                                                </div>
                                            );
                                        })}
                                    </div>
                                </Card>
                            )}
                        </div>
                    ) : (
                        <div className="space-y-6">
                            {showAddForm && (
                                <Card className="p-6 border-primary/20 bg-primary/5 animate-in slide-in-from-top-4">
                                    <h3 className="font-bold mb-4">New Resource Listing</h3>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-bold uppercase text-muted-foreground">Type</label>
                                            <select
                                                className="w-full bg-background border border-border rounded-md p-2 text-sm"
                                                onChange={(e) => setNewResource({ ...newResource, type: e.target.value as any })}
                                                value={newResource.type}
                                            >
                                                <option value="vehicle">Vehicle / Transport</option>
                                                <option value="food">Food Supplies</option>
                                                <option value="water">Drinking Water</option>
                                                <option value="medical">Medical Assistance</option>
                                                <option value="other">Other Relief Materials</option>
                                            </select>
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-bold uppercase text-muted-foreground">Name / Title</label>
                                            <Input
                                                placeholder="e.g. 4x4 Truck, Doctor, etc."
                                                value={newResource.name}
                                                onChange={(e) => setNewResource({ ...newResource, name: e.target.value })}
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-bold uppercase text-muted-foreground">Contact No.</label>
                                            <Input
                                                placeholder="+91..."
                                                value={newResource.contact}
                                                onChange={(e) => setNewResource({ ...newResource, contact: e.target.value })}
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-bold uppercase text-muted-foreground">Location</label>
                                            <Input
                                                placeholder="Area / Village Name"
                                                value={newResource.location}
                                                onChange={(e) => setNewResource({ ...newResource, location: e.target.value })}
                                            />
                                        </div>
                                        <div className="sm:col-span-2 space-y-2">
                                            <label className="text-[10px] font-bold uppercase text-muted-foreground">Description</label>
                                            <Input
                                                placeholder="Brief details about the resource..."
                                                value={newResource.description}
                                                onChange={(e) => setNewResource({ ...newResource, description: e.target.value })}
                                            />
                                        </div>
                                    </div>
                                    <div className="flex justify-end gap-2 mt-6">
                                        <Button variant="ghost" onClick={() => setShowAddForm(false)}>Cancel</Button>
                                        <Button onClick={handleAddResource}>Post Listing</Button>
                                    </div>
                                </Card>
                            )}

                            <div className="space-y-4">
                                <h3 className="font-bold flex items-center gap-2">
                                    <Search className="h-4 w-4" /> Live Resource Listings
                                </h3>

                                <div className="grid grid-cols-1 gap-3">
                                    {resources.map((item) => (
                                        <Card key={item.id} className="p-4 bg-white/50 dark:bg-black/20 border-border/10 hover:border-primary/30 transition-all">
                                            <div className="flex items-start justify-between">
                                                <div className="flex gap-4">
                                                    <div className={`p-3 rounded-xl border ${getTypeColor(item.type)}`}>
                                                        {getIcon(item.type)}
                                                    </div>
                                                    <div>
                                                        <div className="flex items-center gap-2 mb-1">
                                                            <h4 className="font-bold">{item.name}</h4>
                                                            <Badge variant="outline" className="text-[10px] h-4 uppercase">{item.type}</Badge>
                                                        </div>
                                                        <div className="flex flex-col gap-1">
                                                            <p className="text-xs text-muted-foreground flex items-center gap-1">
                                                                <MapPin className="h-3 w-3" /> {item.location}
                                                            </p>
                                                            <p className="text-xs text-primary font-bold flex items-center gap-1">
                                                                <Phone className="h-3 w-3" /> {item.contact}
                                                            </p>
                                                        </div>
                                                        <p className="text-sm mt-3 text-foreground/80 leading-snug">{item.description}</p>
                                                    </div>
                                                </div>
                                                <Button variant="secondary" size="sm" className="text-[10px] font-bold">CONTACT</Button>
                                            </div>
                                        </Card>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                <div className="space-y-6">
                    <Card className="p-5 bg-primary/5 border-primary/10 overflow-hidden relative">
                        <div className="absolute -top-6 -right-6 opacity-5 rotate-12">
                            <Users className="h-32 w-32" />
                        </div>
                        <h4 className="font-bold text-sm mb-4 flex items-center gap-2">
                            <ShieldCheck className="h-4 w-4 text-primary" /> Volunteer Stats
                        </h4>
                        <div className="space-y-4 relative z-10">
                            <div className="flex justify-between items-end">
                                <p className="text-xs text-muted-foreground uppercase">Active Volunteers</p>
                                <p className="text-2xl font-black">1.2k</p>
                            </div>
                            <div className="flex justify-between items-end">
                                <p className="text-xs text-muted-foreground uppercase">Rescue Boats</p>
                                <p className="text-2xl font-black">42</p>
                            </div>
                            <div className="flex justify-between items-end">
                                <p className="text-xs text-muted-foreground uppercase">Medical Teams</p>
                                <p className="text-2xl font-black">15</p>
                            </div>
                            {isVolunteer ? (
                                <div className="p-4 bg-success/20 border border-success/30 rounded-xl flex items-center gap-3 animate-in zoom-in-95">
                                    <CheckCircle2 className="h-6 w-6 text-success" />
                                    <div>
                                        <p className="text-sm font-bold text-success uppercase">Acknowlegded</p>
                                        <p className="text-[10px] text-muted-foreground font-bold">YOU ARE A REGISTERED VOLUNTEER</p>
                                    </div>
                                </div>
                            ) : (
                                <Button
                                    onClick={() => setShowVolunteerDialog(true)}
                                    className="w-full mt-4 bg-primary text-white font-bold h-12"
                                >
                                    JOIN AS VOLUNTEER
                                </Button>
                            )}
                        </div>
                    </Card>

                    {/* Volunteer Registration Dialog */}
                    <Dialog open={showVolunteerDialog} onOpenChange={setShowVolunteerDialog}>
                        <DialogContent className="max-w-md bg-background border-primary/20">
                            <DialogHeader>
                                <DialogTitle className="text-xl font-black italic tracking-tighter">
                                    VOLUNTEER <span className="text-primary">REGISTRATION</span>
                                </DialogTitle>
                                <DialogDescription className="font-bold text-[10px] uppercase tracking-widest">
                                    Join the community rescue force
                                </DialogDescription>
                            </DialogHeader>

                            <div className="space-y-4 py-4">
                                <div className="space-y-2">
                                    <Label className="text-[10px] font-bold uppercase">Full Name</Label>
                                    <Input
                                        placeholder="Enter your name"
                                        className="h-12 font-bold"
                                        value={registrationData.name}
                                        onChange={(e) => setRegistrationData({ ...registrationData, name: e.target.value })}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-[10px] font-bold uppercase">Phone Number</Label>
                                    <Input
                                        placeholder="+91..."
                                        className="h-12 font-bold"
                                        value={registrationData.phone}
                                        onChange={(e) => setRegistrationData({ ...registrationData, phone: e.target.value })}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-[10px] font-bold uppercase">Skills / Expertise</Label>
                                    <Input
                                        placeholder="e.g. Swimmer, Medical, Driving"
                                        className="h-12 font-bold"
                                        value={registrationData.skills}
                                        onChange={(e) => setRegistrationData({ ...registrationData, skills: e.target.value })}
                                    />
                                </div>
                            </div>

                            <DialogFooter>
                                <Button
                                    className="w-full h-12 bg-primary text-white font-black uppercase tracking-widest"
                                    onClick={handleJoinAsVolunteer}
                                >
                                    SUBMIT & ACTIVATE
                                </Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>

                    <Card className="p-5 glass border-border/10 bg-accent/5">
                        <h4 className="font-bold text-sm mb-3">Relief Guidelines</h4>
                        <ul className="space-y-3">
                            <li className="text-xs flex gap-2">
                                <div className="h-1 w-1 rounded-full bg-primary mt-1.5 shrink-0" />
                                <span className="text-muted-foreground">Always verify identity before providing location details.</span>
                            </li>
                            <li className="text-xs flex gap-2">
                                <div className="h-1 w-1 rounded-full bg-primary mt-1.5 shrink-0" />
                                <span className="text-muted-foreground">Prioritize rescue for children, elderly, and those with medical conditions.</span>
                            </li>
                            <li className="text-xs flex gap-2">
                                <div className="h-1 w-1 rounded-full bg-primary mt-1.5 shrink-0" />
                                <span className="text-muted-foreground">Report any fake listings to the admin team immediately.</span>
                            </li>
                        </ul>
                    </Card>
                </div>
            </div>
        </div>
    );
};

export default VolunteerHub;
