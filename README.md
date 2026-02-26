# 🚨 AI Disaster Management System

A full-stack, real-time disaster management Progressive Web App (PWA) for India, built with **React + TypeScript + Vite**. The system aggregates live data from multiple public APIs, runs detection algorithms entirely in the browser, and provides an AI-powered assistant with offline fallback capabilities.

---

## Table of Contents

1. [Tech Stack](#tech-stack)
2. [Project Structure](#project-structure)
3. [APIs Used](#apis-used)
4. [Algorithms Used](#algorithms-used)
5. [All Functions — Detailed Explanation](#all-functions--detailed-explanation)
   - [utils/api.ts](#utilsapits)
   - [utils/offlineKnowledge.ts](#utilsofflineknowledgets)
   - [utils/offlineStorage.ts](#utilsofflinestoragets)
   - [utils/offlineTranslation.ts](#utilsofflinetranslationts)
   - [utils/pushNotifications.ts](#utilspushnotificationsts)
   - [utils/mapTileCache.ts](#utilsmaptilecachets)
   - [components/EarlyAlerts.tsx](#componentsearlylertststx)
   - [components/CopilotChat.tsx](#componentscopilotchattsx)
   - [components/EmergencyServicesMap.tsx](#componentsemergencyservicesmaptsx)
   - [components/WeatherWidget.tsx](#componentsweatherwidgettsx)
   - [components/HeatmapOverview.tsx](#componentsheatmapoverviewtsx)
   - [components/DisasterList.tsx](#componentsdisasterlisttsx)
   - [components/DisasterGuidelines.tsx](#componentsdisasterguidelinestsx)
   - [components/EmergencySOS.tsx](#componentsemergencysoststx)
   - [components/DynamicIsland.tsx](#componentsdynamicislandtsx)
   - [components/OfflineIndicator.tsx](#componentsofflineindicatortsx)
   - [components/NotificationHistory.tsx](#componentsnotificationhistorytsx)
   - [pages/Dashboard.tsx](#pagesdashboardtsx)
   - [pages/Emergency.tsx](#pagesemergencytsx)
6. [Data Flow Diagram](#data-flow-diagram)
7. [Offline Mode Architecture](#offline-mode-architecture)
8. [PWA & Service Worker](#pwa--service-worker)
9. [Environment Variables](#environment-variables)
10. [Possible Judge Questions & Answers](#possible-judge-questions--answers)

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend Framework | React 18 + TypeScript |
| Build Tool | Vite |
| Styling | Tailwind CSS + shadcn/ui |
| Maps | Leaflet.js (`react-leaflet`) |
| AI Assistant | Groq API (`llama-3.3-70b-versatile`) |
| Routing | React Router v6 |
| Backend / Auth | Supabase (PostgreSQL + Auth) |
| State | React `useState`, `useEffect`, `useCallback` |
| PWA | Vite PWA Plugin + Service Worker |
| Offline Translation | Transformers.js (WASM, runs in browser) |
| Notifications | Web Push API (Service Worker) |
| Offline Storage | IndexedDB + `localStorage` |

---

## Project Structure

```
src/
├── components/
│   ├── CopilotChat.tsx         — AI assistant "Saarthi"
│   ├── EarlyAlerts.tsx         — Real-time early warning system
│   ├── EmergencyServicesMap.tsx— Leaflet map with nearby services + routing
│   ├── WeatherWidget.tsx        — Detailed weather dashboard
│   ├── HeatmapOverview.tsx      — India disaster heatmap + risk layers
│   ├── DisasterList.tsx         — Real + predicted disaster feed
│   ├── DisasterGuidelines.tsx   — Static safety guidelines
│   ├── EmergencySOS.tsx         — One-tap SOS with GPS location share
│   ├── DynamicIsland.tsx        — iOS-style floating status indicator
│   ├── NotificationHistory.tsx  — Persisted alert history (localStorage)
│   ├── OfflineIndicator.tsx     — Network status + offline cache manager
│   └── DashboardSidebar.tsx     — Navigation + location detection
├── pages/
│   ├── Dashboard.tsx            — Main layout, data orchestration
│   └── Emergency.tsx            — Emergency routing page
├── utils/
│   ├── api.ts                   — All external API calls + disaster logic
│   ├── offlineKnowledge.ts      — Hardcoded medical/disaster knowledge base
│   ├── offlineStorage.ts        — IndexedDB cache helpers
│   ├── offlineTranslation.ts    — In-browser ML translation
│   ├── pushNotifications.ts     — Web Push notification helpers
│   ├── mapTileCache.ts          — Map tile caching for offline maps
│   └── offlineTileLayer.ts      — Custom Leaflet tile layer with cache
└── types/
    └── index.ts                 — TypeScript interfaces
```

---

## APIs Used

### 1. Open-Meteo API (Free, no API key)
- **URL:** `https://api.open-meteo.com/v1/forecast`
- **Used for:** Primary weather data (temperature, humidity, rainfall, wind, UV, etc.)
- **How it works:** GET request with lat/lng and a list of desired variables. Returns JSON with `current`, `hourly`, and `daily` fields.
- **Parameters used:**
  - `current`: `temperature_2m, relative_humidity_2m, apparent_temperature, precipitation, weather_code, wind_speed_10m, surface_pressure, is_day`
  - `hourly`: `precipitation_probability, precipitation, wind_speed_10m`
  - `daily`: `precipitation_sum, temperature_2m_max, uv_index_max, sunrise, sunset`
- **Used in:** `getFallbackWeatherData()`, `EarlyAlerts.tsx`

### 2. USGS FDSNWS Earthquake API (Free, no API key)
- **URL:** `https://earthquake.usgs.gov/fdsnws/event/1/query`
- **Used for:** Real-time earthquake data for India + early warnings
- **How it works:** REST GET with bounding box (lat/lng min/max) and filters (minmagnitude, time range). Returns GeoJSON.
- **Parameters used in `fetchDisasterData()`:**
  - `minmagnitude=2.5`, India bounding box, last 30 days
- **Parameters used in `EarlyAlerts.tsx`:**
  - `minmagnitude=3`, `maxradiuskm=300` around user, last 7 days

### 3. GDACS API (Global Disaster Alert and Coordination System)
- **URL:** `https://www.gdacs.org/gdacsapi/api/events/geteventlist/SEARCH`
- **Used for:** Orange/Red international disaster alerts
- **How it works:** GET with `fromDate`, `toDate`, `alertlevel=Orange;Red`. Returns GeoJSON feature collection. Each feature has `eventtype`, `alertlevel`, `country`, coordinates.
- **Used in:** `fetchDisasterData()` (India-filtered), `EarlyAlerts.tsx` (radius-filtered)

### 4. BigDataCloud Reverse Geocoding (Free, no API key)
- **URL:** `https://api.bigdatacloud.net/data/reverse-geocode-client`
- **Used for:** Converting GPS coordinates → human-readable city name
- **How it works:** GET with `latitude`, `longitude`. Returns structured address object. Chosen over Nominatim because it is CORS-friendly (Nominatim blocks `localhost` with 403).

### 5. Nominatim (OpenStreetMap) Search API
- **URL:** `https://nominatim.openstreetmap.org/search` and `/reverse`
- **Used for:** Forward geocoding (search box → coordinates) and reverse geocoding in CopilotChat
- **Parameters:** `q`, `format=json`, `limit`, `countrycodes=in`, `addressdetails=1`

### 6. Overpass API (OpenStreetMap data)
- **URL:** `https://overpass-api.de/api/interpreter`
- **Used for:** Querying nearby hospitals, police stations, fire stations, shelters
- **How it works:** POST with an Overpass QL query string. It searches OSM database within a radius for tagged amenities.
- **Query tags used:** `amenity=hospital`, `amenity=police`, `amenity=fire_station`, `emergency=assembly_point`, `disaster:shelter=yes`

### 7. OSRM (Open Source Routing Machine)
- **URL:** `https://router.project-osrm.org/route/v1/driving/{from};{to}`
- **Used for:** Turn-by-turn routing between user and emergency facility
- **How it works:** GET with waypoints. Returns route geometry as encoded polyline → decoded and drawn on Leaflet map as a colored `L.Polyline`.

### 8. Groq API (LLM inference)
- **URL:** `https://api.groq.com/openai/v1/chat/completions`
- **Model:** `llama-3.3-70b-versatile`
- **Used for:** AI chat assistant "Saarthi" — disaster guidance, medical advice, facility search
- **How it works:** POST with OpenAI-compatible message format. System prompt restricts responses to disaster/medical topics. Returns `choices[0].message.content`.
- **API key:** `VITE_GROQ_API_KEY` in `.env`

### 9. Transformers.js (In-browser ML model)
- **Package:** `@xenova/transformers`
- **Model:** Helsinki-NLP multilingual translation models
- **Used for:** Offline translation of AI responses into 10 Indian languages
- **How it works:** Model runs entirely in the browser via WebAssembly. No server needed. Downloaded once and cached in the browser's cache storage.

### 10. Web Notification API + Service Worker
- **Standard:** Browser Web Push API
- **Used for:** Push notifications for emergency/warning alerts, even when app is in background
- **How it works:** `navigator.serviceWorker.ready` → `registration.showNotification()` with vibration patterns and action buttons

---

## Algorithms Used

### 1. IMD (India Meteorological Department) Rainfall Classification
**Location:** `EarlyAlerts.tsx` — flood alert generation

The Indian Meteorological Department classifies rainfall into:
| Category | Threshold |
|---|---|
| Light rain | < 7.5 mm/day |
| Moderate rain | 7.5 – 35.5 mm/day |
| **Heavy rain** | **35.5 – 64.5 mm/day** |
| **Very heavy rain** | **64.5 – 115.5 mm/day** |
| **Extremely heavy rain** | **> 115.5 mm/day** |

**Implementation:**
```
if (rain24h >= 64.5 OR maxPrecipProbability >= 70%) → trigger FLOOD alert
severity = "emergency" if rain24h >= 204.4 mm
severity = "warning"   if rain24h >= 115.5 mm
severity = "watch"     if rain24h >= 64.5 mm
confidence = min(0.95, 0.6 + rain24h/300)
```

### 2. Steadman Apparent Temperature (Heat Index)
**Location:** `EarlyAlerts.tsx` — heatwave alert generation

Steadman (1979) defined "apparent temperature" as the felt temperature combining actual temperature and humidity. IMD issues heatwave warnings when:
- Plains: temperature ≥ 40°C OR departure from normal ≥ 4.5°C
- Hills: temperature ≥ 30°C

**Implementation:**
```
if (temperature >= 40°C OR feelsLike >= 45°C) → trigger HEATWAVE alert
severity = "emergency" if temperature >= 45°C
severity = "warning"   if temperature >= 42°C
severity = "watch"     if temperature >= 40°C
confidence = min(0.95, 0.65 + (temp - 40)/20)
```

### 3. Bath's Law (Seismic Aftershock Prediction)
**Location:** `EarlyAlerts.tsx` — earthquake alert generation

Bath's Law (1965) states that the largest aftershock of an earthquake is typically 1.2 magnitude units smaller than the mainshock, regardless of mainshock magnitude.

**Implementation:**
```
Query USGS for M≥3 earthquakes within 300 km in last 7 days
maxMag = largest earthquake found
if (maxMag >= 5.0) → trigger EARTHQUAKE alert
Predicted aftershock magnitude = maxMag - 1.2
severity = "emergency" if maxMag >= 6.5
severity = "warning"   if maxMag >= 5.5
severity = "watch"     if maxMag >= 5.0
confidence = min(0.9, 0.55 + (maxMag - 5)/5)
```

### 4. GDACS Alert Scoring
**Location:** `EarlyAlerts.tsx`, `fetchDisasterData()` — disaster filtering

GDACS uses a composite vulnerability + intensity scoring algorithm:
- Event intensity (wind speed for cyclones, magnitude for earthquakes, water level for floods)
- Exposed population within impact radius
- Country vulnerability index

The app uses Orange (medium) and Red (high) alerts filtered by geographic proximity to user.
```
distance = Haversine(userLocation, eventLocation)
if (distance <= 400 km AND alertlevel ∈ {Orange, Red}) → add alert
```

### 5. Haversine Formula (Distance Calculation)
**Location:** `utils/api.ts` — `calculateDistance()`, `EarlyAlerts.tsx`

Calculates the great-circle distance between two points on Earth's surface:
```
dLat = (lat2 - lat1) * π/180
dLon = (lng2 - lng1) * π/180
a = sin²(dLat/2) + cos(lat1)*cos(lat2)*
