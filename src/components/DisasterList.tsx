import React, { useState } from 'react';
import {
  AlertTriangle, MapPin, Clock, ExternalLink, ChevronDown, ChevronUp,
  Radio, Waves, Wind, Flame, Mountain, Sun, AlertCircle, Database, Zap, Globe
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DisasterEvent, Location } from '@/types';
import { calculateDistance } from '@/utils/api';

interface DisasterListProps {
  disasters: DisasterEvent[];
  onDisasterClick: (disaster: DisasterEvent) => void;
  loading?: boolean;
  userLocation?: { lat: number; lng: number } | null;
}

const DisasterList: React.FC<DisasterListProps> = ({ disasters, onDisasterClick, loading, userLocation }) => {
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());


  // Show only verified disasters (with trusted source URLs)
  const verifiedDisasters = disasters.filter(d => {
    if (d.isPrediction) return false; // predictions shown separately
    if (!d.url) return false;
    try {
      const url = new URL(d.url);
      const trustedDomains = [
        'earthquake.usgs.gov',
        'gdacs.org',
        'www.gdacs.org',
        'reliefweb.int',
        'imd.gov.in',
        'ndma.gov.in',
      ];
      return trustedDomains.some(domain => url.hostname.includes(domain));
    } catch {
      return false;
    }
  });

  // AI risk predictions shown in their own section
  const predictions = disasters.filter(d => d.isPrediction === true);

  const nearbyDisasters = userLocation
    ? verifiedDisasters.filter(d => {
      const distance = calculateDistance(userLocation, d.location);
      return distance <= 1000; // Expanded Regional Radius
    })
    : [];

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <Card key={i} className="glass p-3 sm:p-4 animate-pulse">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-muted rounded-full flex-shrink-0"></div>
              <div className="flex-1 space-y-2 min-w-0">
                <div className="h-4 bg-muted rounded w-3/4"></div>
                <div className="h-3 bg-muted rounded w-1/2"></div>
              </div>
            </div>
          </Card>
        ))}
      </div>
    );
  }

  if (verifiedDisasters.length === 0) {
    return (
      <Card className="glass p-6 sm:p-8 text-center">
        <AlertTriangle className="h-10 w-10 sm:h-12 sm:w-12 text-success mx-auto mb-3 sm:mb-4" />
        <h3 className="font-semibold text-base sm:text-lg mb-2">No Active Disasters</h3>
        <p className="text-sm text-muted-foreground">
          No verified disasters with official reports found. Only disasters with real report links from USGS or GDACS are shown.
        </p>
      </Card>
    );
  }

  const toggleExpanded = (id: string) => {
    const newExpanded = new Set(expandedItems);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedItems(newExpanded);
  };

  const getDisasterIcon = (type: string, isPrediction: boolean = false) => {
    if (isPrediction) return '🤖';
    switch (type) {
      case 'earthquake': return 'Radio';
      case 'flood': return 'Waves';
      case 'cyclone': return 'Wind';
      case 'fire': case 'wildfire': return 'Flame';
      case 'landslide': return 'Mountain';
      case 'drought': return 'Sun';
      case 'tsunami': return 'Waves';
      default: return 'AlertCircle';
    }
  };

  const getSeverityStyle = (severity: string) => {
    switch (severity) {
      case 'critical': return 'border-destructive/20 bg-destructive/5 text-destructive';
      case 'high': return 'border-warning/20 bg-warning/5 text-warning';
      default: return 'border-primary/20 bg-primary/5 text-primary';
    }
  };

  const getSourceName = (url: string) => {
    try {
      const hostname = new URL(url).hostname;
      if (hostname.includes('usgs.gov')) return 'USGS';
      if (hostname.includes('gdacs.org')) return 'GDACS';
      if (hostname.includes('reliefweb.int')) return 'ReliefWeb';
      if (hostname.includes('imd.gov.in')) return 'IMD';
      if (hostname.includes('ndma.gov.in')) return 'NDMA';
      return 'Official';
    } catch { return 'Report'; }
  };

  const renderDisasterGroup = (disastersList: DisasterEvent[]) => {
    const grouped = disastersList.reduce((acc, disaster) => {
      if (!acc[disaster.type]) acc[disaster.type] = [];
      acc[disaster.type].push(disaster);
      return acc;
    }, {} as Record<string, DisasterEvent[]>);

    if (disastersList.length === 0) {
      return (
        <Card className="bg-white/40 dark:bg-slate-900/40 border-slate-200/50 dark:border-white/5 p-8 text-center rounded-2xl">
          <AlertTriangle className="h-8 w-8 text-primary mx-auto mb-3 opacity-20" />
          <h3 className="font-black text-[10px] tracking-[0.2em] mb-1 uppercase text-primary/60">No Regional Activity</h3>
          <p className="text-[10px] text-primary/40 uppercase font-bold">Scanning telemetry for official verification...</p>
        </Card>
      );
    }

    return (
      <div className="space-y-4">
        {Object.entries(grouped).map(([type, typeDisasters]) => (
          <div key={type} className="space-y-2">
            <h3 className="font-semibold text-base sm:text-lg capitalize flex items-center gap-2">
              <span className="text-xl sm:text-2xl">{getDisasterIcon(type)}</span>
              {type.replace('_', ' ')}s ({typeDisasters.length})
            </h3>

            <div className="space-y-2 sm:space-y-3">
              {typeDisasters.map((disaster) => {
                const isExpanded = expandedItems.has(disaster.id);
                const distance = userLocation
                  ? calculateDistance(userLocation, disaster.location)
                  : null;

                const iconString = getDisasterIcon(disaster.type, disaster.isPrediction);
                const severityStyle = getSeverityStyle(disaster.severity);

                return (
                  <Card
                    key={disaster.id}
                    className={`premium-card p-4 hover:bg-slate-100/40 dark:hover:bg-slate-900/60 cursor-pointer rounded-2xl group border-slate-200/50 dark:border-white/5`}
                    onClick={() => onDisasterClick(disaster)}
                  >
                    <div className="space-y-4">
                      {/* Header */}
                      <div className="flex items-start gap-4">
                        <div className="h-10 w-10 rounded-xl bg-primary/10 dark:bg-slate-800/50 flex items-center justify-center border border-primary/20 dark:border-white/5 shadow-inner flex-shrink-0 group-hover:scale-110 transition-transform">
                          <AlertTriangle className="h-5 w-5 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <h4 className="font-black text-[10px] tracking-[0.2em] uppercase text-foreground leading-tight">{disaster.title}</h4>
                            <Badge variant="outline" className={`${severityStyle} text-[9px] font-black uppercase tracking-widest border-white/10 px-2 py-0.5 rounded-full`}>
                              {disaster.severity}
                            </Badge>
                          </div>
                          <p className="text-[11px] text-slate-500 leading-relaxed line-clamp-2 mt-1 font-medium">
                            {disaster.description}
                          </p>

                          {/* Meta info */}
                          <div className="flex items-center gap-4 mt-3 text-[10px] text-slate-500 dark:text-slate-600 font-bold uppercase tracking-wider">
                            <div className="flex items-center gap-1.5 bg-slate-100/50 dark:bg-slate-900/40 px-2 py-1 rounded-lg border border-slate-200/50 dark:border-white/5">
                              <Clock className="h-3 w-3 opacity-40" />
                              <span>{disaster.time ? new Date(disaster.time).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : 'Unknown'}</span>
                            </div>
                            {disaster.location.name && (
                              <div className="flex items-center gap-1.5 bg-slate-100/50 dark:bg-slate-900/40 px-2 py-1 rounded-lg border border-slate-200/50 dark:border-white/5">
                                <MapPin className="h-3 w-3 opacity-40" />
                                <span className="truncate max-w-[120px]">{disaster.location.name}</span>
                              </div>
                            )}
                            {distance !== null && (
                              <div className="flex items-center gap-1.5 bg-slate-100/50 dark:bg-slate-900/40 px-2 py-1 rounded-lg border border-slate-200/50 dark:border-white/5">
                                <Radio className="h-3 w-3 opacity-40" />
                                <span>{distance.toFixed(0)} KM</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Report link - always visible */}
                      <div className="flex items-center gap-2 pt-2">
                        <Button
                          size="sm"
                          variant="outline"
                          asChild
                          className="bg-slate-100/50 dark:bg-slate-900/40 border-slate-200/50 dark:border-white/10 text-slate-500 dark:text-slate-400 hover:text-foreground hover:bg-slate-200 dark:hover:bg-slate-800 transition-all text-[9px] font-black uppercase tracking-widest h-8 px-4"
                        >
                          <a href={disaster.url} target="_blank" rel="noopener noreferrer">
                            <ExternalLink className="h-3 w-3 mr-1.5 opacity-40" />
                            {getSourceName(disaster.url!)} DOCS
                          </a>
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => onDisasterClick(disaster)}
                          className="text-slate-500 hover:text-foreground text-[9px] font-black uppercase tracking-widest h-8 px-4"
                        >
                          <MapPin className="h-3 w-3 mr-1.5 opacity-40" />
                          TELEMETRY MAP
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => toggleExpanded(disaster.id)}
                          className="h-8 w-8 p-0 ml-auto"
                        >
                          {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        </Button>
                      </div>

                      {/* Expanded details */}
                      {isExpanded && (
                        <div className="border-t border-border/20 pt-3 space-y-3">
                          {disaster.magnitude && (
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-xs sm:text-sm">Magnitude:</span>
                              <Badge variant="secondary">{disaster.magnitude}</Badge>
                            </div>
                          )}

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs sm:text-sm">
                            <div>
                              <span className="font-medium">Coordinates:</span>
                              <p className="text-muted-foreground font-mono text-[11px]">
                                {disaster.location.lat.toFixed(4)}, {disaster.location.lng.toFixed(4)}
                              </p>
                            </div>
                            <div>
                              <span className="font-medium">Event ID:</span>
                              <p className="text-muted-foreground font-mono text-[11px] break-all">{disaster.id}</p>
                            </div>
                          </div>

                          {disaster.isPrediction && (
                            <div className="flex items-center gap-2 flex-wrap text-xs">
                              {disaster.timeframeDays !== undefined && (
                                <Badge variant="outline" className="bg-purple-500/10 border-purple-500/30 text-[10px]">
                                  Expected in {disaster.timeframeDays}d
                                </Badge>
                              )}
                              {disaster.probability !== undefined && (
                                <Badge variant="outline" className="bg-purple-500/10 border-purple-500/30 text-[10px]">
                                  {(disaster.probability * 100).toFixed(0)}% prob
                                </Badge>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </Card>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="space-y-6 sm:space-y-8">
      {/* Nearby Disasters */}
      {userLocation && (
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-[10px] font-black tracking-[0.3em] text-primary/60 uppercase flex items-center gap-2">
              <MapPin className="h-4 w-4" /> REGIONAL TELEMETRY (1000 KM)
            </h2>
            <Badge variant="outline" className="bg-primary/10 text-[9px] font-black uppercase tracking-widest border-primary/20 py-1 px-3">
              {nearbyDisasters.length} LOCALIZED
            </Badge>
          </div>
          {renderDisasterGroup(nearbyDisasters)}
        </div>
      )}

      {/* All India Verified */}
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-[10px] font-black tracking-[0.3em] text-slate-500 uppercase flex items-center gap-2">
            <Globe className="h-4 w-4" /> NATIONAL VERIFIED FEED
          </h2>
          <Badge variant="outline" className="bg-slate-100/50 dark:bg-slate-900/40 text-[9px] font-black uppercase tracking-widest border-slate-200/50 dark:border-white/5 py-1 px-3">
            {verifiedDisasters.length} TOTAL
          </Badge>
        </div>
        {renderDisasterGroup(verifiedDisasters)}
      </div>

      {/* ML Risk Predictions */}
      {predictions.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-[10px] font-black tracking-[0.3em] text-slate-500 uppercase flex items-center gap-2">
              <Database className="h-4 w-4" /> NEURAL RISK PREDICTIONS
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {predictions.map((disaster) => {
              const distance = userLocation
                ? calculateDistance(userLocation, disaster.location)
                : null;
              return (
                <Card
                  key={disaster.id}
                  className="bg-slate-950/40 border border-white/5 p-4 rounded-2xl hover:bg-slate-900/60 transition-all group"
                >
                  <div className="flex items-start gap-4">
                    <div className="h-10 w-10 rounded-xl bg-primary/10 dark:bg-slate-800/50 flex items-center justify-center border border-primary/20 dark:border-white/5 shadow-inner flex-shrink-0 group-hover:scale-110 transition-transform">
                      <Zap className="h-5 w-5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <h4 className="font-black text-[10px] tracking-[0.2em] uppercase text-foreground leading-tight">{disaster.title}</h4>
                        <Badge variant="outline" className="text-[9px] font-black uppercase tracking-widest border-white/10 bg-slate-900/60 text-slate-400 px-2 py-0.5 rounded-full">
                          {disaster.severity}
                        </Badge>
                      </div>
                      <p className="text-[11px] text-slate-500 leading-relaxed font-medium mb-3">{disaster.description}</p>
                      <div className="flex flex-wrap gap-2">
                        {disaster.probability !== undefined && (
                          <div className="text-[9px] font-black uppercase tracking-widest bg-slate-900/40 border border-white/5 px-2 py-1 rounded text-slate-400">
                            {(disaster.probability * 100).toFixed(0)}% PROB
                          </div>
                        )}
                        <div className="text-[9px] font-black uppercase tracking-widest bg-slate-400/10 border border-slate-400/20 px-2 py-1 rounded text-slate-300">
                          🧠 ML INFERENCE
                        </div>
                      </div>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default DisasterList;
