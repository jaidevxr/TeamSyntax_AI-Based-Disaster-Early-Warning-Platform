import React, { useState, useEffect, useRef } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  MapPin,
  Camera,
  Send,
  AlertTriangle,
  Droplets,
  Mountain,
  Flame,
  Wind,
  Loader2,
  CheckCircle2,
  Clock,
  User,
  X,
  Megaphone,
  ThumbsUp,
} from 'lucide-react';
import { Location } from '@/types';

export interface SOSReport {
  id: string;
  type: 'flood' | 'earthquake' | 'fire' | 'landslide' | 'cyclone' | 'road_blocked' | 'building_collapse' | 'other';
  description: string;
  location: { lat: number; lng: number };
  locationName: string;
  imageUrl?: string;
  timestamp: number;
  upvotes: number;
  reporterName: string;
}

interface CommunityReportsProps {
  userLocation: Location | null;
  language: 'en' | 'hi';
}

const REPORT_TYPES = [
  { id: 'flood', label: '🌊 Flood', icon: Droplets, color: 'bg-blue-500' },
  { id: 'earthquake', label: '🏔️ Earthquake', icon: Mountain, color: 'bg-amber-700' },
  { id: 'fire', label: '🔥 Fire', icon: Flame, color: 'bg-red-500' },
  { id: 'landslide', label: '⛰️ Landslide', icon: Mountain, color: 'bg-yellow-700' },
  { id: 'cyclone', label: '🌀 Cyclone', icon: Wind, color: 'bg-cyan-600' },
  { id: 'road_blocked', label: '🚧 Road Blocked', icon: AlertTriangle, color: 'bg-orange-500' },
  { id: 'building_collapse', label: '🏚️ Collapse', icon: AlertTriangle, color: 'bg-stone-600' },
  { id: 'other', label: '⚠️ Other', icon: AlertTriangle, color: 'bg-slate-500' },
] as const;

const LS_KEY = 'predictaid_community_reports';

const loadReports = (): SOSReport[] => {
  try {
    const saved = localStorage.getItem(LS_KEY);
    return saved ? JSON.parse(saved) : [];
  } catch { return []; }
};

const saveReports = (reports: SOSReport[]) => {
  localStorage.setItem(LS_KEY, JSON.stringify(reports));
};

const CommunityReports: React.FC<CommunityReportsProps> = ({ userLocation, language }) => {
  const [reports, setReports] = useState<SOSReport[]>(loadReports);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState({
    type: 'flood' as SOSReport['type'],
    description: '',
    reporterName: '',
    imagePreview: '' as string,
  });

  const t = language === 'hi' ? {
    title: 'समुदाय SOS रिपोर्ट',
    subtitle: 'ज़मीनी रिपोर्ट सबमिट करें',
    submit: 'रिपोर्ट सबमिट करें',
    submitNew: 'नई रिपोर्ट',
    noReports: 'अभी तक कोई रिपोर्ट नहीं',
    addPhoto: 'फ़ोटो जोड़ें',
    name: 'आपका नाम',
    describe: 'क्या हो रहा है?',
    success: 'रिपोर्ट सबमिट हो गई!',
    ago: 'पहले',
    upvote: 'पुष्टि करें',
    activeReports: 'सक्रिय रिपोर्ट',
  } : {
    title: 'Community SOS Reports',
    subtitle: 'Submit ground-level reports',
    submit: 'Submit Report',
    submitNew: 'New Report',
    noReports: 'No reports yet. Be the first to report!',
    addPhoto: 'Add Photo',
    name: 'Your Name',
    describe: 'What is happening? Be specific about location and situation.',
    success: 'Report submitted! Visible to all users.',
    ago: 'ago',
    upvote: 'Confirm',
    activeReports: 'Active Reports',
  };

  const handleImagePick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => setForm(f => ({ ...f, imagePreview: ev.target?.result as string }));
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleSubmit = () => {
    if (!form.description.trim() || !userLocation) return;
    setSubmitting(true);

    setTimeout(() => {
      const newReport: SOSReport = {
        id: `sos-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        type: form.type,
        description: form.description.trim(),
        location: { lat: userLocation.lat, lng: userLocation.lng },
        locationName: userLocation.name || `${userLocation.lat.toFixed(4)}, ${userLocation.lng.toFixed(4)}`,
        imageUrl: form.imagePreview || undefined,
        timestamp: Date.now(),
        upvotes: 0,
        reporterName: form.reporterName.trim() || 'Anonymous',
      };

      const updated = [newReport, ...reports];
      setReports(updated);
      saveReports(updated);
      setForm({ type: 'flood', description: '', reporterName: '', imagePreview: '' });
      setSubmitting(false);
      setSubmitted(true);
      setShowForm(false);

      // Dispatch event so heatmap can pick up community reports
      window.dispatchEvent(new CustomEvent('communityReportAdded', { detail: newReport }));

      setTimeout(() => setSubmitted(false), 3000);
    }, 800);
  };

  const handleUpvote = (id: string) => {
    const updated = reports.map(r => r.id === id ? { ...r, upvotes: r.upvotes + 1 } : r);
    setReports(updated);
    saveReports(updated);
  };

  const handleDelete = (id: string) => {
    const updated = reports.filter(r => r.id !== id);
    setReports(updated);
    saveReports(updated);
  };

  const timeAgo = (ts: number) => {
    const mins = Math.floor((Date.now() - ts) / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ${t.ago}`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ${t.ago}`;
    return `${Math.floor(hrs / 24)}d ${t.ago}`;
  };

  const getTypeConfig = (type: string) => REPORT_TYPES.find(r => r.id === type) || REPORT_TYPES[7];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center shadow-lg shadow-orange-500/30">
            <Megaphone className="h-5 w-5 text-white" />
          </div>
          <div>
            <h2 className="text-lg font-extrabold tracking-tight text-foreground">{t.title}</h2>
            <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-widest">{t.subtitle}</p>
          </div>
        </div>
        <Button onClick={() => setShowForm(!showForm)} className="gap-1.5 font-bold text-xs" size="sm">
          <Send className="h-3.5 w-3.5" /> {t.submitNew}
        </Button>
      </div>

      {/* Success toast */}
      {submitted && (
        <div className="flex items-center gap-2 p-3 bg-green-50 dark:bg-green-500/10 border border-green-200 dark:border-green-500/20 rounded-xl animate-in slide-in-from-top-2">
          <CheckCircle2 className="h-4 w-4 text-green-600" />
          <p className="text-sm font-bold text-green-700 dark:text-green-400">{t.success}</p>
        </div>
      )}

      {/* Submission Form */}
      {showForm && (
        <Card className="p-4 space-y-4 border-primary/20 bg-gradient-to-br from-orange-50/50 to-white dark:from-orange-950/20 dark:to-slate-900/90 animate-in slide-in-from-top-4 duration-300">
          {/* Disaster Type Chips */}
          <div>
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-2">Report Type</p>
            <div className="flex flex-wrap gap-1.5">
              {REPORT_TYPES.map(rt => (
                <button
                  key={rt.id}
                  onClick={() => setForm(f => ({ ...f, type: rt.id as SOSReport['type'] }))}
                  className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition-all border ${
                    form.type === rt.id
                      ? 'bg-primary text-primary-foreground border-primary shadow-md scale-105'
                      : 'bg-background/60 text-muted-foreground border-border/50 hover:border-primary/30'
                  }`}
                >
                  {rt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <Textarea
              value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              placeholder={t.describe}
              className="h-20 text-sm"
            />
          </div>

          {/* Name + Photo Row */}
          <div className="flex gap-2">
            <div className="flex-1">
              <Input
                value={form.reporterName}
                onChange={e => setForm(f => ({ ...f, reporterName: e.target.value }))}
                placeholder={t.name}
                className="text-sm"
              />
            </div>
            <input type="file" ref={fileInputRef} accept="image/*" className="hidden" onChange={handleImagePick} />
            <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} className="gap-1 text-xs font-bold shrink-0">
              <Camera className="h-3.5 w-3.5" /> {t.addPhoto}
            </Button>
          </div>

          {/* Image Preview */}
          {form.imagePreview && (
            <div className="relative inline-block">
              <img src={form.imagePreview} alt="Preview" className="h-20 rounded-xl border shadow-sm" />
              <button onClick={() => setForm(f => ({ ...f, imagePreview: '' }))} className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center shadow-md">
                <X className="w-3 h-3" />
              </button>
            </div>
          )}

          {/* Location Notice */}
          {userLocation && (
            <div className="flex items-center gap-2 p-2 bg-green-50 dark:bg-green-500/10 rounded-lg border border-green-200/50 dark:border-green-500/10">
              <MapPin className="h-3.5 w-3.5 text-green-600" />
              <span className="text-[10px] font-bold text-green-700 dark:text-green-400">
                GPS: {userLocation.lat.toFixed(4)}, {userLocation.lng.toFixed(4)} {userLocation.name && `· ${userLocation.name}`}
              </span>
            </div>
          )}

          {/* Submit */}
          <Button onClick={handleSubmit} disabled={!form.description.trim() || submitting} className="w-full font-bold gap-2 h-11 bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700 text-white shadow-lg shadow-orange-500/30">
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            {t.submit}
          </Button>
        </Card>
      )}

      {/* Reports Feed */}
      <div>
        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-2">{t.activeReports} ({reports.length})</p>
        {reports.length === 0 ? (
          <Card className="p-8 text-center border-dashed">
            <Megaphone className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground font-medium">{t.noReports}</p>
          </Card>
        ) : (
          <div className="space-y-2">
            {reports.map(report => {
              const tc = getTypeConfig(report.type);
              return (
                <Card key={report.id} className="p-3 hover:shadow-md transition-all border-border/50">
                  <div className="flex gap-3">
                    {/* Type badge */}
                    <div className={`h-9 w-9 rounded-xl ${tc.color} flex items-center justify-center flex-shrink-0 shadow-sm`}>
                      <tc.icon className="h-4 w-4 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      {/* Header */}
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant="outline" className="text-[9px] font-black px-1.5 py-0">{tc.label}</Badge>
                        <span className="text-[9px] text-muted-foreground flex items-center gap-0.5">
                          <Clock className="h-2.5 w-2.5" /> {timeAgo(report.timestamp)}
                        </span>
                      </div>
                      {/* Description */}
                      <p className="text-xs leading-relaxed text-foreground/90 mb-1.5">{report.description}</p>
                      {/* Image */}
                      {report.imageUrl && (
                        <img src={report.imageUrl} alt="Report" className="rounded-lg max-h-32 object-cover border mb-1.5" />
                      )}
                      {/* Footer */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5 text-[9px] text-muted-foreground">
                          <User className="h-2.5 w-2.5" /> {report.reporterName}
                          <span className="mx-1">·</span>
                          <MapPin className="h-2.5 w-2.5" /> {report.locationName}
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleUpvote(report.id)}
                            className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-50 dark:bg-green-500/10 text-green-600 dark:text-green-400 text-[10px] font-bold hover:bg-green-100 dark:hover:bg-green-500/20 transition-colors"
                          >
                            <ThumbsUp className="h-2.5 w-2.5" /> {report.upvotes > 0 ? report.upvotes : t.upvote}
                          </button>
                          <button
                            onClick={() => handleDelete(report.id)}
                            className="p-1 rounded-full text-muted-foreground/40 hover:text-red-500 transition-colors"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default CommunityReports;
