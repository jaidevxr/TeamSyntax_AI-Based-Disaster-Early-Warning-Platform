import L from 'leaflet';
import { getCachedTile, cacheTile } from './mapTileCache';

export class OfflineTileLayer extends L.TileLayer {
  private regionName: string;

  constructor(urlTemplate: string, options: L.TileLayerOptions & { regionName?: string } = {}) {
    super(urlTemplate, options);
    this.regionName = options.regionName || 'default';
  }

  createTile(coords: L.Coords, done: L.DoneCallback): HTMLElement {
    const tile = document.createElement('img');
    
    L.DomEvent.on(tile, 'load', L.bind(() => done(undefined, tile), this));
    L.DomEvent.on(tile, 'error', L.bind(() => done(new Error('Tile failed to load'), tile), this));

    const url = (this as any).getTileUrl(coords);
    this.loadTile(tile, url, coords);
    
    return tile;
  }

  private async loadTile(tile: HTMLImageElement, url: string, coords: L.Coords): Promise<void> {
    try {
      // Try to get from cache first
      const cachedBlob = await getCachedTile(url);
      
      if (cachedBlob) {
        // Use cached tile
        tile.src = URL.createObjectURL(cachedBlob);
        return;
      }

      // If online, fetch from network
      if (navigator.onLine) {
        const response = await fetch(url);
        if (response.ok) {
          const blob = await response.blob();
          
          // Cache the tile for future use (in background, don't block rendering)
          cacheTile(url, blob, this.regionName).catch(err => 
            console.error('Failed to cache tile:', err)
          );
          
          tile.src = URL.createObjectURL(blob);
        } else {
          throw new Error('Network request failed');
        }
      } else {
        // Offline and not cached - use placeholder
        tile.src = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAQAAAAEACAQAAAD2e2DtAAAABGdBTUEAALGPC/xhBQAAACBjSFJNAAB6JgAAgIQAAPoAAACA6AAAdTAAAOpgAAA6mAAAF3CculE8AAAAAmJLR0QAAKqNIzIAAAAJcEhZcwAADsQAAA7EAZUrDhsAAA';
      }
    } catch (error) {
      console.error('Error loading tile:', error);
      // Use placeholder on error
      tile.src = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAQAAAAEACAQAAAD2e2DtAAAABGdBTUEAALGPC/xhBQAAACBjSFJNAAB6JgAAgIQAAPoAAACA6AAAdTAAAOpgAAA6mAAAF3CculE8AAAAAmJLR0QAAKqNIzIAAAAJcEhZcwAADsQAAA7EAZUrDhsAAA';
    }
  }
}

export function createOfflineTileLayer(
  urlTemplate: string,
  options: L.TileLayerOptions & { regionName?: string } = {}
): OfflineTileLayer {
  return new OfflineTileLayer(urlTemplate, options);
}
