import React, { useMemo } from 'react';
import { AlertTriangle, Waves, Mountain, Wind, Map, Bot, Clock, TrendingUp, Shield, Activity, Navigation, Radio, Zap, ChevronRight, Bell } from 'lucide-react';
import type { DisasterEvent, Location } from '@/types';

interface DashboardOverviewCardProps {
  disasters: DisasterEvent[];
  userLocation: Location | null;
  onTabChange: (tab: string) => void;
}

const DashboardOverviewCard: React.FC<DashboardOverviewCardProps> = ({ disasters, userLocation, onTabChange }) => {
  const now = new Date();
  const timeStr = now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
  const dateStr = now.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });

  const critical = disasters.filter(d => d.severity === 'high').length;
  const warnings = disasters.filter(d => d.severity === 'medium').length;
  const total = disasters.length;

  const disasterCards = [
    {
      title: 'Flood Alert',
      desc: 'Monitor water levels across river basins and low-lying zones.',
      status: critical > 0 ? 'Active' : 'Monitoring',
      statusColor: critical > 0 ? 'bg-red-100 text-red-600' : 'bg-emerald-100 text-emerald-600',
      cardBg: 'bg-[#e8f5e9]',
      icon: Waves,
      iconBg: 'bg-[#a5d6a7]',
      tab: 'early-alerts',
    },
    {
      title: 'Earthquake Risk',
      desc: 'Seismic activity detection and structural vulnerability analysis.',
      status: 'Tracking',
      statusColor: 'bg-amber-100 text-amber-600',
      cardBg: 'bg-[#fff3e0]',
      icon: Activity,
      iconBg: 'bg-[#ffcc80]',
      tab: 'early-alerts',
    },
    {
      title: 'Landslide Watch',
      desc: 'Slope stability monitoring in hilly and mountainous terrain.',
      status: 'Watch',
      statusColor: 'bg-purple-100 text-purple-600',
      cardBg: 'bg-[#f3e5f5]',
      icon: Mountain,
      iconBg: 'bg-[#ce93d8]',
      tab: 'early-alerts',
    },
    {
      title: 'Cyclone Tracker',
      desc: 'Tropical storm paths and coastal impact zone prediction.',
      status: 'Clear',
      statusColor: 'bg-sky-100 text-sky-600',
      cardBg: 'bg-[#e3f2fd]',
      icon: Wind,
      iconBg: 'bg-[#90caf9]',
      tab: 'early-alerts',
    },
  ];

  const events = [
    {
      day: 'Today',
      date: dateStr,
      title: 'Emergency Response Drill',
      desc: 'District-level simulation for flood evacuation coordination.',
      color: 'bg-[#f3e5f5]',
      dotColor: 'bg-purple-400',
    },
    {
      day: 'Tomorrow',
      date: '',
      title: 'SOS Signal Review',
      desc: 'Weekly analysis of community-reported SOS signals and pattern detection.',
      color: 'bg-[#fff9c4]',
      dotColor: 'bg-yellow-400',
    },
    {
      day: 'Fri, 28',
      date: '',
      title: 'ML Model Update',
      desc: 'Deploy updated flood and earthquake prediction models with latest training data.',
      color: 'bg-[#e8f5e9]',
      dotColor: 'bg-emerald-400',
    },
  ];

  return (
    <div className="h-full overflow-y-auto bg-[#f4f7f6]">
      {/* ── Top Bar ──────────────────────────────────────────────── */}
      <div className="sticky top-0 z-10 bg-[#0f1a19] text-white px-6 py-3 flex items-center justify-between shadow-lg">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-emerald-500 flex items-center justify-center">
              <Shield className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-sm tracking-tight">Predict Aid</span>
          </div>
          <div className="hidden md:flex items-center gap-1 ml-4 bg-white/10 rounded-full px-4 py-1.5">
            <span className="text-xs text-white/60">Command Center</span>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <button onClick={() => onTabChange('overview')} className="text-white/60 hover:text-white transition-colors"><Map className="w-4 h-4" /></button>
          <button onClick={() => onTabChange('early-alerts')} className="text-white/60 hover:text-white transition-colors"><Bell className="w-4 h-4" /></button>
          <button onClick={() => onTabChange('ai-insights')} className="text-white/60 hover:text-white transition-colors"><Bot className="w-4 h-4" /></button>
          <button onClick={() => onTabChange('emergency-services')} className="text-white/60 hover:text-white transition-colors"><Navigation className="w-4 h-4" /></button>
          <div className="flex items-center gap-2 ml-2 bg-white/10 rounded-full pl-1 pr-3 py-1">
            <div className="w-6 h-6 rounded-full bg-emerald-500 flex items-center justify-center">
              <span className="text-[10px] font-black text-white">SC</span>
            </div>
            <div className="hidden md:block">
              <p className="text-xs font-semibold leading-none">Saarthi AI</p>
              <p className="text-[9px] text-white/50 leading-none mt-0.5">Active</p>
            </div>
          </div>
        </div>
      </div>

      <div className="p-5 md:p-6 grid grid-cols-1 xl:grid-cols-3 gap-5">
        {/* ── Left + Center Content ────────────────────────────────── */}
        <div className="xl:col-span-2 space-y-5">

          {/* Title + Stats */}
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl md:text-3xl font-black text-slate-800 leading-tight">
                Disaster Command
              </h1>
              <p className="text-sm text-slate-400 font-medium mt-1">
                Real-time monitoring · ML-powered predictions
              </p>
            </div>
            <div className="flex items-center gap-3">
              <div className="bg-white rounded-2xl px-5 py-3 text-center shadow-sm border border-slate-100">
                <p className="text-xl font-black text-slate-800">{total || 26}</p>
                <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">Total</p>
              </div>
              <div className="bg-red-50 rounded-2xl px-5 py-3 text-center shadow-sm border border-red-100">
                <p className="text-xl font-black text-red-500">{critical || 2}</p>
                <p className="text-[10px] text-red-400 font-semibold uppercase tracking-wider">Critical</p>
              </div>
              <div className="bg-amber-50 rounded-2xl px-5 py-3 text-center shadow-sm border border-amber-100">
                <p className="text-xl font-black text-amber-500">{warnings || 8}</p>
                <p className="text-[10px] text-amber-400 font-semibold uppercase tracking-wider">Warnings</p>
              </div>
            </div>
          </div>

          {/* Featured Hero Card */}
          <div
            onClick={() => onTabChange('overview')}
            className="cursor-pointer relative overflow-hidden rounded-3xl p-6 flex items-end min-h-[180px] group"
            style={{ background: 'linear-gradient(135deg, #6d28d9 0%, #7c3aed 40%, #a78bfa 100%)' }}
          >
            {/* Decorative circles */}
            <div className="absolute top-4 right-4 w-32 h-32 rounded-full bg-white/10 blur-xl" />
            <div className="absolute top-8 right-20 w-16 h-16 rounded-full bg-white/10" />
            <div className="absolute -bottom-4 right-10 w-24 h-24 rounded-full bg-purple-400/30" />

            {/* Live map icon area */}
            <div className="absolute top-5 right-5 bg-white/20 backdrop-blur-sm rounded-2xl p-3 group-hover:scale-105 transition-transform">
              <Map className="w-6 h-6 text-white" />
            </div>

            <div className="relative z-10">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-xs text-white/70 font-semibold uppercase tracking-widest">Live Intelligence</span>
              </div>
              <h2 className="text-xl font-black text-white leading-tight">
                India Disaster Heatmap
              </h2>
              <p className="text-sm text-purple-200 mt-1 max-w-xs">
                AI-powered risk zones · Real-time satellite data
              </p>
              <div className="mt-4 flex items-center gap-2 bg-white/20 backdrop-blur-sm rounded-full px-4 py-2 w-fit">
                <Activity className="w-3.5 h-3.5 text-white" />
                <span className="text-xs font-bold text-white">View Live Map</span>
                <ChevronRight className="w-3.5 h-3.5 text-white" />
              </div>
            </div>
          </div>

          {/* Disaster Type Cards */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-base font-bold text-slate-800">Active Monitoring</h2>
              <button
                onClick={() => onTabChange('early-alerts')}
                className="text-xs font-semibold text-violet-500 hover:text-violet-700 flex items-center gap-1 transition-colors"
              >
                View all <ChevronRight className="w-3 h-3" />
              </button>
            </div>
            <div className="space-y-3">
              {disasterCards.map((card, i) => {
                const Icon = card.icon;
                return (
                  <div
                    key={i}
                    onClick={() => onTabChange(card.tab)}
                    className={`cursor-pointer ${card.cardBg} rounded-2xl p-4 flex items-center gap-4 hover:shadow-md transition-all duration-200 group active:scale-[0.99]`}
                  >
                    <div className={`w-10 h-10 rounded-xl ${card.iconBg} flex items-center justify-center flex-shrink-0`}>
                      <Icon className="w-5 h-5 text-slate-700" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold text-sm text-slate-800">{card.title}</h3>
                      <p className="text-xs text-slate-500 mt-0.5 truncate">{card.desc}</p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full ${card.statusColor}`}>
                        {card.status}
                      </span>
                      <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-slate-500 transition-colors" />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* ── Right Panel ──────────────────────────────────────────── */}
        <div className="space-y-5">
          {/* AI Saarthi Quick Access */}
          <div
            onClick={() => onTabChange('ai-insights')}
            className="cursor-pointer bg-[#0f1a19] rounded-3xl p-5 text-white group hover:shadow-xl transition-all duration-300"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-emerald-500 flex items-center justify-center">
                  <Bot className="w-4 h-4 text-white" />
                </div>
                <span className="font-bold text-sm">Saarthi AI</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-[10px] text-white/50 font-medium">Online</span>
              </div>
            </div>
            <p className="text-xl font-black leading-snug text-white/90">
              Ask about<br />
              <span className="text-emerald-400">disaster risks</span>
              <br />near you
            </p>
            <div className="mt-4 flex items-center gap-2 bg-white/10 rounded-full px-4 py-2 w-fit group-hover:bg-emerald-500/20 transition-colors">
              <span className="text-xs font-bold">Open Chat</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </div>
          </div>

          {/* Events / Alerts */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-base font-bold text-slate-800">Upcoming Alerts</h2>
              <button
                onClick={() => onTabChange('alert-history')}
                className="text-xs font-semibold text-violet-500 hover:text-violet-700 flex items-center gap-1 transition-colors"
              >
                All <ChevronRight className="w-3 h-3" />
              </button>
            </div>
            <div className="space-y-3">
              {events.map((ev, i) => (
                <div key={i} className={`${ev.color} rounded-2xl p-4`}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${ev.dotColor}`} />
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{ev.day}</span>
                    </div>
                    {ev.date && <span className="text-[10px] text-slate-400 font-medium">{ev.date}</span>}
                  </div>
                  <p className="text-sm font-bold text-slate-800">{ev.title}</p>
                  <p className="text-xs text-slate-500 mt-1 leading-relaxed">{ev.desc}</p>
                </div>
              ))}
            </div>
          </div>

          {/* System Status */}
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
            <div className="flex items-center gap-2 mb-3">
              <Radio className="w-4 h-4 text-emerald-500" />
              <span className="text-sm font-bold text-slate-800">System Status</span>
            </div>
            {[
              { label: 'ML Prediction Engine', status: 'Active', color: 'text-emerald-500' },
              { label: 'SOS Signal Network', status: 'Live', color: 'text-emerald-500' },
              { label: 'Satellite Feed', status: 'Connected', color: 'text-emerald-500' },
              { label: 'Community Reports', status: 'Syncing', color: 'text-amber-500' },
            ].map((item, i) => (
              <div key={i} className="flex items-center justify-between py-1.5 border-b border-slate-50 last:border-0">
                <span className="text-xs text-slate-500 font-medium">{item.label}</span>
                <span className={`text-[10px] font-bold ${item.color}`}>{item.status}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardOverviewCard;
