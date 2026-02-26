import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Download, Trash2, MapPin, HardDrive } from 'lucide-react';
import { toast } from 'sonner';
import {
  downloadRegion,
  getDownloadedRegions,
  deleteRegion,
  getCacheSize,
  clearAllCache,
} from '@/utils/mapTileCache';

interface OfflineMapManagerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const PRESET_REGIONS = [
  {
    name: 'Delhi NCR',
    bounds: { north: 29.0, south: 28.4, east: 77.5, west: 76.8 },
    zoomLevels: [8, 9, 10, 11, 12],
  },
  {
    name: 'Mumbai',
    bounds: { north: 19.3, south: 18.9, east: 73.0, west: 72.7 },
    zoomLevels: [8, 9, 10, 11, 12],
  },
  {
    name: 'Bangalore',
    bounds: { north: 13.2, south: 12.8, east: 77.8, west: 77.4 },
    zoomLevels: [8, 9, 10, 11, 12],
  },
  {
    name: 'All India (Low Detail)',
    bounds: { north: 35.5, south: 6.5, east: 97.5, west: 68.0 },
    zoomLevels: [5, 6, 7],
  },
];

const OfflineMapManager: React.FC<OfflineMapManagerProps> = ({ open, onOpenChange }) => {
  const [downloadedRegions, setDownloadedRegions] = useState<any[]>([]);
  const [downloading, setDownloading] = useState<string | null>(null);
  const [downloadProgress, setDownloadProgress] = useState<{ current: number; total: number } | null>(null);
  const [cacheSize, setCacheSize] = useState<number>(0);

  useEffect(() => {
    if (open) {
      loadRegions();
      loadCacheSize();
    }
  }, [open]);

  const loadRegions = async () => {
    try {
      const regions = await getDownloadedRegions();
      setDownloadedRegions(regions);
    } catch (error) {
      console.error('Error loading regions:', error);
    }
  };

  const loadCacheSize = async () => {
    try {
      const size = await getCacheSize();
      setCacheSize(size);
    } catch (error) {
      console.error('Error loading cache size:', error);
    }
  };

  const handleDownload = async (region: typeof PRESET_REGIONS[0]) => {
    setDownloading(region.name);
    setDownloadProgress({ current: 0, total: 1 });

    try {
      await downloadRegion({
        name: region.name,
        bounds: region.bounds,
        zoomLevels: region.zoomLevels,
        onProgress: (current, total) => {
          setDownloadProgress({ current, total });
        },
      });

      toast.success('Download complete', {
        description: `${region.name} is now available offline`,
      });

      await loadRegions();
      await loadCacheSize();
    } catch (error) {
      console.error('Error downloading region:', error);
      toast.error('Download failed', {
        description: 'Please try again later',
      });
    } finally {
      setDownloading(null);
      setDownloadProgress(null);
    }
  };

  const handleDelete = async (regionName: string) => {
    try {
      await deleteRegion(regionName);
      toast.success('Region deleted', {
        description: 'Offline map data removed',
      });
      await loadRegions();
      await loadCacheSize();
    } catch (error) {
      console.error('Error deleting region:', error);
      toast.error('Delete failed');
    }
  };

  const handleClearAll = async () => {
    if (!confirm('Delete all offline maps? This cannot be undone.')) return;

    try {
      await clearAllCache();
      toast.success('All offline maps deleted');
      await loadRegions();
      await loadCacheSize();
    } catch (error) {
      console.error('Error clearing cache:', error);
      toast.error('Clear failed');
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  };

  const isRegionDownloaded = (regionName: string) => {
    return downloadedRegions.some(r => r.name === regionName && r.status === 'completed');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5 text-primary" />
            Offline Maps
          </DialogTitle>
          <DialogDescription>
            Download maps for offline access during emergencies
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Storage Info */}
          <Card className="p-4 bg-muted/50">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <HardDrive className="h-4 w-4 text-muted-foreground" />
                <span className="font-semibold text-sm">Storage Used</span>
              </div>
              <span className="text-sm font-medium">{formatBytes(cacheSize)}</span>
            </div>
            {downloadedRegions.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleClearAll}
                className="w-full mt-2"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Clear All Maps
              </Button>
            )}
          </Card>

          {/* Download Progress */}
          {downloading && downloadProgress && (
            <Card className="p-4 border-primary/20 bg-primary/5">
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-semibold">Downloading {downloading}...</span>
                  <span className="text-muted-foreground">
                    {downloadProgress.current} / {downloadProgress.total} tiles
                  </span>
                </div>
                <Progress 
                  value={(downloadProgress.current / downloadProgress.total) * 100} 
                  className="h-2"
                />
              </div>
            </Card>
          )}

          {/* Available Regions */}
          <div className="space-y-3">
            <h3 className="font-semibold text-sm">Available Regions</h3>
            {PRESET_REGIONS.map((region) => {
              const downloaded = isRegionDownloaded(region.name);
              const isDownloading = downloading === region.name;

              return (
                <Card key={region.name} className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-semibold">{region.name}</h4>
                        {downloaded && (
                          <Badge variant="secondary" className="text-xs">
                            Downloaded
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Zoom levels: {region.zoomLevels.join(', ')}
                      </p>
                    </div>

                    <div className="flex gap-2">
                      {downloaded ? (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDelete(region.name)}
                          disabled={isDownloading}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      ) : (
                        <Button
                          variant="default"
                          size="sm"
                          onClick={() => handleDownload(region)}
                          disabled={isDownloading || downloading !== null}
                        >
                          <Download className="h-4 w-4 mr-2" />
                          Download
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* Show region info */}
                  {downloaded && (
                    <div className="mt-3 pt-3 border-t text-xs text-muted-foreground">
                      {downloadedRegions.find(r => r.name === region.name)?.tileCount} tiles cached
                    </div>
                  )}
                </Card>
              );
            })}
          </div>

          {/* Info */}
          <Card className="p-4 bg-muted/30">
            <p className="text-xs text-muted-foreground">
              💡 <strong>Tip:</strong> Downloaded maps will be automatically used when you're offline.
              Larger regions with higher zoom levels require more storage space.
            </p>
          </Card>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default OfflineMapManager;
