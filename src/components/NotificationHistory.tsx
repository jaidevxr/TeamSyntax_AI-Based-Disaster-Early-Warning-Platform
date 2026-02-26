import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  Bell, BellOff, Trash2, Clock, AlertTriangle, 
  Droplets, Mountain, Thermometer, Wind, CloudLightning,
  ShieldAlert, Info, ChevronDown, ChevronUp
} from 'lucide-react';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';

export interface AlertHistoryEntry {
  id: string;
  title: string;
  body: string;
  type: string;
  severity: string;
  confidence: number;
  timestamp: string;
  locationName?: string;
}

const HISTORY_KEY = 'saarthi_alert_history';

// Persist alert to history
export const addAlertToHistory = (alert: Omit<AlertHistoryEntry, 'timestamp'> & { locationName?: string }) => {
  try {
    const existing = getAlertHistory();
    const entry: AlertHistoryEntry = {
      ...alert,
      timestamp: new Date().toISOString(),
    };
    const updated = [entry, ...existing].slice(0, 200); // keep last 200
    localStorage.setItem(HISTORY_KEY, JSON.stringify(updated));
  } catch {
    // localStorage full or unavailable
  }
};

export const getAlertHistory = (): AlertHistoryEntry[] => {
  try {
    return JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
  } catch {
    return [];
  }
};

export const clearAlertHistory = () => {
  localStorage.removeItem(HISTORY_KEY);
};

const NotificationHistory: React.FC = () => {
  const [history, setHistory] = useState<AlertHistoryEntry[]>([]);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    setHistory(getAlertHistory());
  }, []);

  const handleClear = () => {
    clearAlertHistory();
    setHistory([]);
  };

  const toggleExpand = (id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'flood': return <Droplets className="h-4 w-4" />;
      case 'earthquake': return <Mountain className="h-4 w-4" />;
      case 'heatwave': return <Thermometer className="h-4 w-4" />;
      case 'cold_wave': return <Thermometer className="h-4 w-4" />;
      case 'cyclone': return <Wind className="h-4 w-4" />;
      case 'thunderstorm': return <CloudLightning className="h-4 w-4" />;
      default: return <AlertTriangle className="h-4 w-4" />;
    }
  };

  const getSeverityBadge = (severity: string) => {
    switch (severity) {
      case 'emergency':
        return <Badge className="bg-red-500 text-white text-[10px] px-1.5 py-0">EMERGENCY</Badge>;
      case 'warning':
        return <Badge className="bg-orange-500 text-white text-[10px] px-1.5 py-0">WARNING</Badge>;
      case 'watch':
        return <Badge className="bg-yellow-500 text-black text-[10px] px-1.5 py-0">WATCH</Badge>;
      default:
        return <Badge className="bg-blue-500 text-white text-[10px] px-1.5 py-0">ADVISORY</Badge>;
    }
  };

  const formatTimestamp = (ts: string) => {
    const date = new Date(ts);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    const diffHr = Math.floor(diffMin / 60);
    const diffDay = Math.floor(diffHr / 24);

    if (diffMin < 1) return 'Just now';
    if (diffMin < 60) return `${diffMin}m ago`;
    if (diffHr < 24) return `${diffHr}h ago`;
    if (diffDay < 7) return `${diffDay}d ago`;
    return date.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
  };

  // Group by date
  const groupedByDate = history.reduce<Record<string, AlertHistoryEntry[]>>((acc, entry) => {
    const dateKey = new Date(entry.timestamp).toLocaleDateString([], { 
      weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' 
    });
    if (!acc[dateKey]) acc[dateKey] = [];
    acc[dateKey].push(entry);
    return acc;
  }, {});

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Bell className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-bold text-foreground">Notification History</h2>
          {history.length > 0 && (
            <Badge variant="outline" className="ml-1 text-xs">
              {history.length} alerts
            </Badge>
          )}
        </div>
        {history.length > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleClear}
            className="text-xs text-muted-foreground hover:text-destructive gap-1"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Clear All
          </Button>
        )}
      </div>

      {/* Empty state */}
      {history.length === 0 && (
        <Card className="p-8 border-dashed border-muted-foreground/30">
          <div className="flex flex-col items-center gap-3 text-center text-muted-foreground">
            <div className="h-12 w-12 rounded-full bg-muted/50 flex items-center justify-center">
              <BellOff className="h-6 w-6" />
            </div>
            <div>
              <p className="text-sm font-medium">No notifications yet</p>
              <p className="text-xs mt-1">Past emergency and warning alerts will appear here with full details.</p>
            </div>
          </div>
        </Card>
      )}

      {/* Grouped alerts */}
      {Object.entries(groupedByDate).map(([dateLabel, entries]) => (
        <div key={dateLabel} className="space-y-2">
          <div className="flex items-center gap-2">
            <div className="h-px flex-1 bg-border/50" />
            <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider px-2">{dateLabel}</span>
            <div className="h-px flex-1 bg-border/50" />
          </div>

          {entries.map((entry) => {
            const isExpanded = expandedIds.has(entry.id + entry.timestamp);
            return (
              <Card 
                key={entry.id + entry.timestamp} 
                className="overflow-hidden border-border/40 hover:border-border/60 transition-colors cursor-pointer"
                onClick={() => toggleExpand(entry.id + entry.timestamp)}
              >
                <div className="p-3">
                  <div className="flex items-start gap-2.5">
                    <div className="flex-shrink-0 mt-0.5 text-muted-foreground">
                      {getTypeIcon(entry.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                        {getSeverityBadge(entry.severity)}
                        <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {formatTimestamp(entry.timestamp)}
                        </span>
                      </div>
                      <h3 className="text-xs font-semibold text-foreground leading-tight line-clamp-1">
                        {entry.title}
                      </h3>
                      {entry.locationName && (
                        <span className="text-[10px] text-muted-foreground">{entry.locationName}</span>
                      )}
                    </div>
                    <div className="flex-shrink-0">
                      {isExpanded ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />}
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="mt-2 pt-2 border-t border-border/30 space-y-1.5">
                      <p className="text-xs text-muted-foreground leading-relaxed">{entry.body}</p>
                      <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                        <span>Type: <span className="font-medium text-foreground capitalize">{entry.type.replace('_', ' ')}</span></span>
                        <span>Confidence: <span className="font-medium text-foreground">{(entry.confidence * 100).toFixed(0)}%</span></span>
                        <span>Time: <span className="font-medium text-foreground">{new Date(entry.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span></span>
                      </div>
                    </div>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      ))}
    </div>
  );
};

export default NotificationHistory;
