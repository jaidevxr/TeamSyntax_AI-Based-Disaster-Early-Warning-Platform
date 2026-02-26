import { openDB, DBSchema, IDBPDatabase } from 'idb';
import { DisasterEvent, WeatherData, EmergencyFacility } from '@/types';

interface OfflineDB extends DBSchema {
  disasters: {
    key: string;
    value: {
      id: string;
      data: DisasterEvent;
      timestamp: number;
    };
  };
  weather: {
    key: string;
    value: {
      id: string;
      data: WeatherData;
      location: string;
      timestamp: number;
    };
  };
  facilities: {
    key: string;
    value: {
      id: string;
      data: EmergencyFacility;
      timestamp: number;
    };
  };
  mapTiles: {
    key: string;
    value: {
      url: string;
      blob: Blob;
      timestamp: number;
    };
  };
  guidelines: {
    key: string;
    value: {
      type: string;
      content: string;
      timestamp: number;
    };
  };
  pendingAlerts: {
    key: number;
    value: {
      id: number;
      payload: any;
      timestamp: number;
    };
    indexes: { 'by-timestamp': number };
  };
}

const DB_NAME = 'saarthi-offline';
const DB_VERSION = 1;
const CACHE_DURATION = 7 * 24 * 60 * 60 * 1000; // 7 days

let db: IDBPDatabase<OfflineDB> | null = null;

export const initOfflineDB = async () => {
  if (db) return db;

  db = await openDB<OfflineDB>(DB_NAME, DB_VERSION, {
    upgrade(db) {
      // Disasters store
      if (!db.objectStoreNames.contains('disasters')) {
        db.createObjectStore('disasters', { keyPath: 'id' });
      }

      // Weather store
      if (!db.objectStoreNames.contains('weather')) {
        db.createObjectStore('weather', { keyPath: 'id' });
      }

      // Facilities store
      if (!db.objectStoreNames.contains('facilities')) {
        db.createObjectStore('facilities', { keyPath: 'id' });
      }

      // Map tiles store
      if (!db.objectStoreNames.contains('mapTiles')) {
        db.createObjectStore('mapTiles', { keyPath: 'url' });
      }

      // Guidelines store
      if (!db.objectStoreNames.contains('guidelines')) {
        db.createObjectStore('guidelines', { keyPath: 'type' });
      }

      // Pending alerts store
      if (!db.objectStoreNames.contains('pendingAlerts')) {
        const store = db.createObjectStore('pendingAlerts', {
          keyPath: 'id',
          autoIncrement: true,
        });
        store.createIndex('by-timestamp', 'timestamp');
      }
    },
  });

  return db;
};

// Disasters
export const cacheDisasters = async (disasters: DisasterEvent[]) => {
  const database = await initOfflineDB();
  const tx = database.transaction('disasters', 'readwrite');
  const timestamp = Date.now();

  await Promise.all(
    disasters.map((disaster) =>
      tx.store.put({
        id: disaster.id,
        data: disaster,
        timestamp,
      })
    )
  );

  await tx.done;
};

export const getCachedDisasters = async (): Promise<DisasterEvent[]> => {
  const database = await initOfflineDB();
  const cached = await database.getAll('disasters');
  const now = Date.now();

  return cached
    .filter((item) => now - item.timestamp < CACHE_DURATION)
    .map((item) => item.data);
};

// Weather
export const cacheWeather = async (
  location: string,
  weather: WeatherData
) => {
  const database = await initOfflineDB();
  await database.put('weather', {
    id: location,
    data: weather,
    location,
    timestamp: Date.now(),
  });
};

export const getCachedWeather = async (
  location: string
): Promise<WeatherData | null> => {
  const database = await initOfflineDB();
  const cached = await database.get('weather', location);

  if (!cached || Date.now() - cached.timestamp > CACHE_DURATION) {
    return null;
  }

  return cached.data;
};

// Facilities
export const cacheFacilities = async (facilities: EmergencyFacility[]) => {
  const database = await initOfflineDB();
  const tx = database.transaction('facilities', 'readwrite');
  const timestamp = Date.now();

  await Promise.all(
    facilities.map((facility) =>
      tx.store.put({
        id: facility.id,
        data: facility,
        timestamp,
      })
    )
  );

  await tx.done;
};

export const getCachedFacilities = async (): Promise<EmergencyFacility[]> => {
  const database = await initOfflineDB();
  const cached = await database.getAll('facilities');
  const now = Date.now();

  return cached
    .filter((item) => now - item.timestamp < CACHE_DURATION)
    .map((item) => item.data);
};

// Map Tiles
export const cacheMapTile = async (url: string, blob: Blob) => {
  const database = await initOfflineDB();
  await database.put('mapTiles', {
    url,
    blob,
    timestamp: Date.now(),
  });
};

export const getCachedMapTile = async (url: string): Promise<Blob | null> => {
  const database = await initOfflineDB();
  const cached = await database.get('mapTiles', url);

  if (!cached || Date.now() - cached.timestamp > CACHE_DURATION) {
    return null;
  }

  return cached.blob;
};

// Guidelines
export const cacheGuidelines = async (type: string, content: string) => {
  const database = await initOfflineDB();
  await database.put('guidelines', {
    type,
    content,
    timestamp: Date.now(),
  });
};

export const getCachedGuidelines = async (type: string): Promise<string | null> => {
  const database = await initOfflineDB();
  const cached = await database.get('guidelines', type);

  if (!cached) return null;

  return cached.content;
};

// Pending Alerts (for when offline)
export const queueEmergencyAlert = async (payload: any) => {
  const database = await initOfflineDB();
  const id = await database.add('pendingAlerts', {
    id: Date.now(),
    payload,
    timestamp: Date.now(),
  });
  return id;
};

export const getPendingAlerts = async () => {
  const database = await initOfflineDB();
  return await database.getAll('pendingAlerts');
};

export const removePendingAlert = async (id: number) => {
  const database = await initOfflineDB();
  await database.delete('pendingAlerts', id);
};

// Clear old cache
export const clearOldCache = async () => {
  const database = await initOfflineDB();
  const now = Date.now();
  
  const stores: (keyof OfflineDB)[] = ['disasters', 'weather', 'facilities', 'mapTiles'];
  
  for (const storeName of stores) {
    const all = await database.getAll(storeName as any);
    const tx = database.transaction(storeName as any, 'readwrite');
    
    for (const item of all) {
      if ('timestamp' in item && now - (item as any).timestamp > CACHE_DURATION) {
        await tx.store.delete((item as any).id || (item as any).url);
      }
    }
    
    await tx.done;
  }
};

// Get storage usage
export const getStorageUsage = async () => {
  if ('storage' in navigator && 'estimate' in navigator.storage) {
    const estimate = await navigator.storage.estimate();
    return {
      usage: estimate.usage || 0,
      quota: estimate.quota || 0,
      percentage: estimate.quota
        ? ((estimate.usage || 0) / estimate.quota) * 100
        : 0,
    };
  }
  return null;
};
