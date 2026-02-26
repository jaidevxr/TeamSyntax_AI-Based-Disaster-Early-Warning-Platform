import React, { useState } from 'react';
import { AlertTriangle, MapPin, Clock, ExternalLink, ChevronDown, ChevronUp } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DisasterEvent } from '@/types';

interface DisasterListProps {
  disasters: DisasterEvent[];
  onDisasterClick: (disaster: DisasterEvent) => void;
  loading?: boolean;
  userLocation?: { lat: number; lng: number } | null;
}

const DisasterList: React.FC<DisasterListProps> = ({ disasters, onDisasterClick, loading, userLocation }) => {
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());

  const calculateDistance = (lat1: number, lng1: number, lat2: number, lng2: number): number => {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

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
      const distance = calculateDistance(userLocation.lat, userLocation.lng, d.location.lat, d.location.lng);
      return distance <= 500;
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
      case 'earthquake': return '⚡';
      case 'flood': return '🌊';
      case 'cyclone': return '🌀';
      case 'fire': case 'wildfire': return '🔥';
      case 'landslide': return '⛰️';
      case 'drought': return '🌵';
      case 'tsunami': return '🌊';
      default: return '⚠️';
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'border-red-500/50 bg-red-500/5';
      case 'high': return 'severity-high';
      case 'medium': return 'severity-medium';
      default: return 'severity-low';
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
        <Card className="glass p-6 text-center">
          <AlertTriangle className="h-10 w-10 text-success mx-auto mb-3" />
          <h3 className="font-semibold text-base mb-1">No Disasters in This Area</h3>
          <p className="text-sm text-muted-foreground">No verified disasters reported in this region.</p>
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
                  ? calculateDistance(userLocation.lat, userLocation.lng, disaster.location.lat, disaster.location.lng)
                  : null;

                return (
                  <Card
                    key={disaster.id}
                    className={`glass-strong p-3 sm:p-5 transition-all duration-300 hover:shadow-elevated cursor-pointer border-2 ${getSeverityColor(disaster.severity)} backdrop-blur-lg`}
                  >
                    <div className="space-y-3 sm:space-y-4">
                      {/* Header */}
                      <div className="flex items-start gap-2 sm:gap-3">
                        <div className={`p-2 sm:p-3 rounded-xl text-xl sm:text-2xl flex-shrink-0 ${getSeverityColor(disaster.severity)}`}>
                          {getDisasterIcon(disaster.type, disaster.isPrediction)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <h4 className="font-semibold text-sm sm:text-base leading-tight line-clamp-2">{disaster.title}</h4>
                            <Badge variant="outline" className={`${getSeverityColor(disaster.severity)} text-[10px] sm:text-xs flex-shrink-0 capitalize`}>
                              {disaster.severity}
                            </Badge>
                          </div>
                          <p className="text-xs sm:text-sm text-muted-foreground line-clamp-2 mt-1">
                            {disaster.description}
                          </p>

                          {/* Meta info */}
                          <div className="flex items-center gap-2 sm:gap-3 mt-2 text-[10px] sm:text-xs text-muted-foreground flex-wrap">
                            <div className="flex items-center gap-1">
                              <Clock className="h-3 w-3 flex-shrink-0" />
                              <span className="truncate">{disaster.time ? new Date(disaster.time).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : 'Unknown'}</span>
                            </div>
                            {disaster.location.name && (
                              <div className="flex items-center gap-1">
                                <MapPin className="h-3 w-3 flex-shrink-0" />
                                <span className="truncate">{disaster.location.name}</span>
                              </div>
                            )}
                            {distance !== null && (
                              <Badge variant="outline" className="text-[10px] sm:text-xs px-1.5">
                                {distance.toFixed(0)} km
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Report link - always visible */}
                      <div className="flex items-center gap-2 flex-wrap">
                        <Button
                          size="sm"
                          variant="default"
                          asChild
                          className="text-xs h-8 gap-1.5"
                        >
                          <a href={disaster.url} target="_blank" rel="noopener noreferrer">
                            <ExternalLink className="h-3 w-3" />
                            {getSourceName(disaster.url!)} Report
                          </a>
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => onDisasterClick(disaster)}
                          className="text-xs h-8 gap-1.5"
                        >
                          <MapPin className="h-3 w-3" />
                          Map
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
            <h2 className="text-lg sm:text-2xl font-bold text-foreground">📍 Nearby (500 km)</h2>
            <Badge variant="outline" className="text-xs sm:text-sm flex-shrink-0">
              {nearbyDisasters.length} Event{nearbyDisasters.length !== 1 ? 's' : ''}
            </Badge>
          </div>
          {renderDisasterGroup(nearbyDisasters)}
        </div>
      )}

      {/* All India Verified */}
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-lg sm:text-2xl font-bold text-foreground">🇮🇳 All India</h2>
          <Badge variant="outline" className="text-xs sm:text-sm flex-shrink-0">
            {verifiedDisasters.length} Verified
          </Badge>
        </div>
        {renderDisasterGroup(verifiedDisasters)}
      </div>

      {/* AI Risk Predictions */}
      {predictions.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-lg sm:text-2xl font-bold text-foreground">🤖 AI Risk Predictions</h2>
            <Badge variant="outline" className="text-xs sm:text-sm flex-shrink-0 bg-purple-500/10 border-purple-500/30">
              {predictions.length} Forecast{predictions.length !== 1 ? 's' : ''}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground">AI-generated risk assessments based on weather, season, and geographic data. Not verified events.</p>
          <div className="space-y-2 sm:space-y-3">
            {predictions.map((disaster) => {
              const distance = userLocation
                ? calculateDistance(userLocation.lat, userLocation.lng, disaster.location.lat, disaster.location.lng)
                : null;
              return (
                <Card
                  key={disaster.id}
                  className="glass-strong p-3 sm:p-5 border-2 border-purple-500/20 bg-purple-500/5 backdrop-blur-lg"
                >
                  <div className="flex items-start gap-3">
                    <div className="p-2 rounded-xl text-xl flex-shrink-0">{getDisasterIcon(disaster.type, true)}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <h4 className="font-semibold text-sm leading-tight">{disaster.title}</h4>
                        <Badge variant="outline" className="text-[10px] capitalize flex-shrink-0 bg-purple-500/10 border-purple-500/30">
                          {disaster.severity}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">{disaster.description}</p>
                      <div className="flex flex-wrap gap-1 mt-2">
                        {disaster.probability !== undefined && (
                          <Badge variant="outline" className="text-[10px] bg-purple-500/10 border-purple-400/30">
                            {(disaster.probability * 100).toFixed(0)}% probability
                          </Badge>
                        )}
                        {(disaster as any).timeframeDays !== undefined && (
                          <Badge variant="outline" className="text-[10px] bg-blue-500/10 border-blue-400/30">
                            {(disaster as any).timeframeDays}d window
                          </Badge>
                        )}
                        {distance !== null && (
                          <Badge variant="outline" className="text-[10px]">
                            {distance.toFixed(0)} km
                          </Badge>
                        )}
                        <Badge variant="outline" className="text-[10px] bg-muted">
                          🤖 AI Prediction
                        </Badge>
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
