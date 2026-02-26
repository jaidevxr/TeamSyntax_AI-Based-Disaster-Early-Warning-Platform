import { openDB, DBSchema, IDBPDatabase } from 'idb';

interface MapTileDB extends DBSchema {
  tiles: {
    key: string;
    value: {
      url: string;
      blob: Blob;
      timestamp: number;
      region: string;
    };
    indexes: {
      region: string;
      timestamp: number;
    };
  };
  regions: {
    key: string;
    value: {
      name: string;
      bounds: {
        north: number;
        south: number;
        east: number;
        west: number;
      };
      zoomLevels: number[];
      tileCount: number;
      downloadedCount: number;
      timestamp: number;
      status: 'downloading' | 'completed' | 'failed';
    };
    indexes: {
      timestamp: number;
    };
  };
}

const DB_NAME = 'saarthi-map-cache';
const DB_VERSION = 1;
const TILE_STORE = 'tiles';
const REGION_STORE = 'regions';

let dbInstance: IDBPDatabase<MapTileDB> | null = null;

export async function getMapDB(): Promise<IDBPDatabase<MapTileDB>> {
  if (dbInstance) return dbInstance;

  dbInstance = await openDB<MapTileDB>(DB_NAME, DB_VERSION, {
    upgrade(db) {
      // Create tiles store
      if (!db.objectStoreNames.contains(TILE_STORE)) {
        const tileStore = db.createObjectStore(TILE_STORE, { keyPath: 'url' });
        tileStore.createIndex('region', 'region');
        tileStore.createIndex('timestamp', 'timestamp');
      }

      // Create regions store
      if (!db.objectStoreNames.contains(REGION_STORE)) {
        const regionStore = db.createObjectStore(REGION_STORE, { keyPath: 'name' });
        regionStore.createIndex('timestamp', 'timestamp');
      }
    },
  });

  return dbInstance;
}

export async function cacheTile(url: string, blob: Blob, region: string): Promise<void> {
  const db = await getMapDB();
  await db.put(TILE_STORE, {
    url,
    blob,
    timestamp: Date.now(),
    region,
  });
}

export async function getCachedTile(url: string): Promise<Blob | null> {
  try {
    const db = await getMapDB();
    const tile = await db.get(TILE_STORE, url);
    return tile?.blob || null;
  } catch (error) {
    console.error('Error getting cached tile:', error);
    return null;
  }
}

export async function getTileUrl(originalUrl: string): Promise<string> {
  // If online, return original URL
  if (navigator.onLine) {
    return originalUrl;
  }

  // If offline, try to get from cache
  const cachedTile = await getCachedTile(originalUrl);
  if (cachedTile) {
    return URL.createObjectURL(cachedTile);
  }

  // Return placeholder if not cached
  return 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';
}

interface DownloadRegionOptions {
  name: string;
  bounds: {
    north: number;
    south: number;
    east: number;
    west: number;
  };
  zoomLevels: number[];
  onProgress?: (downloaded: number, total: number) => void;
}

export async function downloadRegion(options: DownloadRegionOptions): Promise<void> {
  const { name, bounds, zoomLevels, onProgress } = options;
  const db = await getMapDB();

  // Calculate total tiles
  let totalTiles = 0;
  for (const zoom of zoomLevels) {
    const tiles = getTilesForBounds(bounds, zoom);
    totalTiles += tiles.length;
  }

  // Create/update region record
  await db.put(REGION_STORE, {
    name,
    bounds,
    zoomLevels,
    tileCount: totalTiles,
    downloadedCount: 0,
    timestamp: Date.now(),
    status: 'downloading',
  });

  let downloadedCount = 0;
  const tileUrlTemplate = 'https://cartodb-basemaps-{s}.global.ssl.fastly.net/light_all/{z}/{x}/{y}.png';

  try {
    for (const zoom of zoomLevels) {
      const tiles = getTilesForBounds(bounds, zoom);

      // Download tiles in batches to avoid overwhelming the server
      const batchSize = 5;
      for (let i = 0; i < tiles.length; i += batchSize) {
        const batch = tiles.slice(i, i + batchSize);
        
        await Promise.all(
          batch.map(async ({ x, y, z }) => {
            const subdomain = ['a', 'b', 'c', 'd'][Math.floor(Math.random() * 4)];
            const url = tileUrlTemplate
              .replace('{s}', subdomain)
              .replace('{z}', z.toString())
              .replace('{x}', x.toString())
              .replace('{y}', y.toString());

            try {
              const response = await fetch(url);
              if (response.ok) {
                const blob = await response.blob();
                await cacheTile(url, blob, name);
                downloadedCount++;
                
                // Update progress
                await db.put(REGION_STORE, {
                  name,
                  bounds,
                  zoomLevels,
                  tileCount: totalTiles,
                  downloadedCount,
                  timestamp: Date.now(),
                  status: 'downloading',
                });
                
                onProgress?.(downloadedCount, totalTiles);
              }
            } catch (error) {
              console.error(`Failed to download tile ${url}:`, error);
            }
          })
        );

        // Small delay between batches
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    // Mark as completed
    await db.put(REGION_STORE, {
      name,
      bounds,
      zoomLevels,
      tileCount: totalTiles,
      downloadedCount,
      timestamp: Date.now(),
      status: 'completed',
    });
  } catch (error) {
    console.error('Error downloading region:', error);
    await db.put(REGION_STORE, {
      name,
      bounds,
      zoomLevels,
      tileCount: totalTiles,
      downloadedCount,
      timestamp: Date.now(),
      status: 'failed',
    });
    throw error;
  }
}

function getTilesForBounds(
  bounds: { north: number; south: number; east: number; west: number },
  zoom: number
): Array<{ x: number; y: number; z: number }> {
  const tiles: Array<{ x: number; y: number; z: number }> = [];

  const minTile = latLonToTile(bounds.north, bounds.west, zoom);
  const maxTile = latLonToTile(bounds.south, bounds.east, zoom);

  for (let x = minTile.x; x <= maxTile.x; x++) {
    for (let y = minTile.y; y <= maxTile.y; y++) {
      tiles.push({ x, y, z: zoom });
    }
  }

  return tiles;
}

function latLonToTile(lat: number, lon: number, zoom: number): { x: number; y: number } {
  const n = Math.pow(2, zoom);
  const x = Math.floor(((lon + 180) / 360) * n);
  const y = Math.floor(
    ((1 - Math.log(Math.tan((lat * Math.PI) / 180) + 1 / Math.cos((lat * Math.PI) / 180)) / Math.PI) / 2) * n
  );
  return { x, y };
}

export async function getDownloadedRegions(): Promise<
  Array<{
    name: string;
    bounds: {
      north: number;
      south: number;
      east: number;
      west: number;
    };
    zoomLevels: number[];
    tileCount: number;
    downloadedCount: number;
    timestamp: number;
    status: 'downloading' | 'completed' | 'failed';
  }>
> {
  const db = await getMapDB();
  return await db.getAll(REGION_STORE);
}

export async function deleteRegion(regionName: string): Promise<void> {
  const db = await getMapDB();
  
  // Delete all tiles for this region
  const tiles = await db.getAllFromIndex(TILE_STORE, 'region', regionName);
  for (const tile of tiles) {
    await db.delete(TILE_STORE, tile.url);
  }
  
  // Delete region record
  await db.delete(REGION_STORE, regionName);
}

export async function getCacheSize(): Promise<number> {
  const db = await getMapDB();
  const tiles = await db.getAll(TILE_STORE);
  
  let totalSize = 0;
  for (const tile of tiles) {
    totalSize += tile.blob.size;
  }
  
  return totalSize;
}

export async function clearAllCache(): Promise<void> {
  const db = await getMapDB();
  await db.clear(TILE_STORE);
  await db.clear(REGION_STORE);
}
