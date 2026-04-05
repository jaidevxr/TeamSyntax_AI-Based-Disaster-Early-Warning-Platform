<p align="center">
  <img src="https://img.shields.io/badge/React_18-61DAFB?style=for-the-badge&logo=react&logoColor=black" alt="React" />
  <img src="https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/TensorFlow.js-FF6F00?style=for-the-badge&logo=tensorflow&logoColor=white" alt="TensorFlow" />
  <img src="https://img.shields.io/badge/Vite-646CFF?style=for-the-badge&logo=vite&logoColor=white" alt="Vite" />
  <img src="https://img.shields.io/badge/Supabase-3FCF8E?style=for-the-badge&logo=supabase&logoColor=white" alt="Supabase" />
  <img src="https://img.shields.io/badge/Tailwind_CSS-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white" alt="Tailwind" />
  <img src="https://img.shields.io/badge/PWA-5A0FC8?style=for-the-badge&logo=pwa&logoColor=white" alt="PWA" />
</p>

<h1 align="center">🛡️ PredictAid</h1>
<h3 align="center">AI-Powered Disaster Early Warning & Response Platform</h3>

<p align="center">
  <em>A real-time, AI-driven command center for predicting, detecting, and managing natural disasters — built to save lives.</em>
</p>

<p align="center">
  <a href="https://predictaid.vercel.app/"><img src="https://img.shields.io/badge/🌐_Live_Demo-predictaid.vercel.app-000000?style=for-the-badge&logo=vercel&logoColor=white" alt="Live Demo" /></a>
</p>

<p align="center">
  <a href="#-features">Features</a> •
  <a href="#-architecture">Architecture</a> •
  <a href="#-neural-prediction-engine">AI/ML Engine</a> •
  <a href="#-tech-stack">Tech Stack</a> •
  <a href="#-getting-started">Getting Started</a> •
  <a href="#-contributors">Contributors</a>
</p>

---

## 🌟 Overview

**PredictAid** is a state-of-the-art disaster intelligence platform that aggregates real-time environmental data — weather, seismic activity, air quality — and translates it into actionable intelligence through a multi-factorial risk engine. It features client-side neural network inference, highly localized GIS visualizations with authentic political boundaries, a context-aware AI Copilot for crisis response, and a resilient offline-first architecture.

> **Why PredictAid?** Existing systems are fragmented, reactive, and fail in low-network conditions. PredictAid unifies multiple disaster data sources into one intelligent dashboard that works even when the network doesn't.

---

## ✨ Features

<table>
<tr>
<td width="50%">

### 🗺️ Live Heatmap & GIS
- Real-time disaster visualization on Leaflet maps
- Google Maps tiles with `gl=IN` for accurate Indian boundaries
- Programmatic dark-mode via CSS filter matrix
- Offline tile caching via IndexedDB

</td>
<td width="50%">

### 🧠 Neural Prediction Engine
- **Flood prediction** — TF.js dense NN (96.4% accuracy)
- **Earthquake risk** — Seismic NN (83.5% accuracy)
- **SOS analysis** — MobileBERT zero-shot NLP
- All inference runs client-side for privacy

</td>
</tr>
<tr>
<td width="50%">

### ⚡ Early Warning System
- Multi-source alert aggregation (Open-Meteo, USGS, WAQI)
- Real-time composite risk scoring
- Push notifications for critical alerts
- PDF report export with one click

</td>
<td width="50%">

### 🤖 AI Copilot
- Context-aware disaster assistant powered by Groq LLM
- Automatic injection of local disaster context
- Hyper-localized evacuation guidance
- Secure serverless inference via Supabase Edge Functions

</td>
</tr>
<tr>
<td width="50%">

### 🏥 Emergency Services Map
- Dynamic 25 km radius facility scan (hospitals, police, fire)
- Overpass QL queries optimized for speed
- One-tap navigation to nearest facility
- Real-time distance calculation

</td>
<td width="50%">

### 📱 Offline-First PWA
- Full Progressive Web App — installable on any device
- IndexedDB caching for maps, alerts, and weather data
- Offline SOS with device sensors
- Seamless online/offline transitions

</td>
</tr>
</table>

---

## 🏗️ Architecture

The platform uses a modular **Client → Edge → Database** architecture. The frontend aggregates data concurrently from multiple environmental feeds and runs ML inference client-side to minimize latency, falling back to edge infrastructure only for LLM integrations.

```
┌──────────────────────────────────────────────────────────────────────────┐
│                        🖥️  PRESENTATION LAYER                          │
│                                                                          │
│   ┌─────────────────┐  ┌──────────────────┐  ┌─────────────────────┐   │
│   │  React Dashboard │  │ Leaflet GIS Maps │  │  AI Copilot Chat    │   │
│   │  (Vite + TS)     │  │ (Google gl=IN)   │  │  (Context-Aware)    │   │
│   └────────┬─────────┘  └────────┬─────────┘  └──────────┬──────────┘   │
└────────────┼─────────────────────┼────────────────────────┼──────────────┘
             │                     │                        │
┌────────────┼─────────────────────┼────────────────────────┼──────────────┐
│            ▼                     ▼                        ▼              │
│   ┌──────────────────────────────────────┐  ┌───────────────────────┐   │
│   │  Client-Side Parallel Fetcher        │  │ Supabase Edge Funcs   │   │
│   │  (Bulk REST Aggregation)             │  │ (Deno + JWT Auth)     │   │
│   └────────┬─────────────────────────────┘  └───────────┬───────────┘   │
│            │        🌐 CONNECTIVITY LAYER               │               │
└────────────┼────────────────────────────────────────────┼───────────────┘
             │                                            │
┌────────────┼────────────────────────────────────────────┼───────────────┐
│            ▼                                            ▼               │
│   ┌──────────────────┐  ┌─────────────────┐  ┌──────────────────────┐  │
│   │ Multi-Factor Risk │  │ Early Warning   │  │ Groq LLM (via Edge) │  │
│   │ Matrix Engine     │  │ Pattern Engine  │  │ Prompt Engineering   │  │
│   └──────────────────┘  └─────────────────┘  └──────────────────────┘  │
│                    ⚙️  CORE ENGINES                                     │
└─────────────────────────────────────────────────────────────────────────┘
             │                                            │
┌────────────┼────────────────────────────────────────────┼───────────────┐
│            ▼                                            ▼               │
│   ┌──────────────────────────┐         ┌────────────────────────────┐  │
│   │  PostgreSQL (Supabase)   │         │  IndexedDB (Offline Cache) │  │
│   │  Vector Extensions       │         │  Tile + Alert Persistence  │  │
│   └──────────────────────────┘         └────────────────────────────┘  │
│                        💾 DATA LAYER                                    │
└─────────────────────────────────────────────────────────────────────────┘
             │
┌────────────┼────────────────────────────────────────────────────────────┐
│            ▼                                                            │
│   ┌────────────┐  ┌─────────┐  ┌──────────────┐  ┌───────────────┐    │
│   │ Open-Meteo  │  │  USGS   │  │  WAQI / AQI  │  │ Overpass API  │    │
│   │ Weather API │  │ Seismic │  │  Air Quality  │  │ OSM Facilities│    │
│   └────────────┘  └─────────┘  └──────────────┘  └───────────────┘    │
│                     🌍 LIVE SENSOR FEEDS                                │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 🧠 Neural Prediction Engine

The system uses **client-side neural inference** to provide accurate, privacy-preserving disaster predictions directly in the browser.

### Models

| Model | Framework | Training Data | Accuracy | Purpose |
|-------|-----------|---------------|----------|---------|
| **Flood Prediction NN** | TensorFlow.js | 2,500 Indian weather samples | 96.4% (0.99 AUC-ROC) | Processes rainfall, humidity, soil data for flood probability |
| **Earthquake Risk NN** | TensorFlow.js | 2,000 USGS seismic observations | 83.5% | Calculates 30-day risk windows from depth, b-values, clustering |
| **SOS Message Analyzer** | Transformers.js | MobileBERT (Hugging Face) | Zero-Shot | Context-aware urgency & hazard classification of SOS messages |

### Inference Pipeline

```
Live Sensor Data → Feature Normalization → Neural Execution (WebGL/WASM) → Visual Deployment
       │                    │                        │                            │
  Open-Meteo,          Same scalars             model.predict()             Heatmaps &
  USGS feeds           from Python               via TF.js                alert markers
                       training phase
```

---

## 💻 Tech Stack

<table>
<tr>
<td valign="top" width="33%">

### Machine Learning
- **TensorFlow.js** — Browser-based neural networks
- **Transformers.js** — Local NLP inference (Hugging Face)
- **Python / Keras** — Model training & dataset generation

</td>
<td valign="top" width="33%">

### Frontend
- **React 18 + Vite** — PWA-ready SPA
- **TypeScript** — Type-safe ML integration
- **Tailwind CSS** — Premium glassmorphism UI
- **Leaflet** — Interactive GIS mapping
- **Recharts** — Data visualization

</td>
<td valign="top" width="34%">

### Backend & Data
- **Supabase** — PostgreSQL + Edge Functions
- **IndexedDB** — Offline tile & data caching
- **Open-Meteo / USGS / WAQI** — Live sensor feeds
- **Overpass API** — Emergency facility discovery

</td>
</tr>
</table>

---

## 🚀 Getting Started

### Prerequisites

- **Node.js** ≥ 18
- **npm** or **yarn**
- A [Supabase](https://supabase.com) project (for the AI Copilot edge functions)

### Installation

```bash
# Clone the repository
git clone https://github.com/jaidevxr/TeamSyntax_AI-Based-Disaster-Early-Warning-Platform.git
cd TeamSyntax_AI-Based-Disaster-Early-Warning-Platform

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Add your VITE_HF_TOKEN, Supabase keys, etc.

# Start the development server
npm run dev
```

The app will be available at `http://localhost:5173`.

### Environment Variables

| Variable | Description |
|----------|-------------|
| `VITE_SUPABASE_URL` | Your Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Supabase anonymous API key |
| `VITE_HF_TOKEN` | Hugging Face API token (for NLP models) |

---

## 🔧 Key Implementation Details

<details>
<summary><b>🗺️ Map Accuracy & Dark Mode Engineering</b></summary>

The platform strips OSM fallback tiles and initializes Leaflet strictly with `mt1.google.com...gl=IN` for definitive legal Indian boundaries. Dark mode is achieved without a secondary tile server using a custom CSS matrix:

```css
.dark-map-tiles {
  filter: invert(100%) hue-rotate(180deg) brightness(85%) contrast(120%) saturate(80%);
}
```
</details>

<details>
<summary><b>⚡ High-Performance Batch Data Ingestion</b></summary>

Instead of 45+ individual API calls, the client compiles all coordinates into bulk URL parameter strings for Open-Meteo. `Promise.allSettled()` handles WAQI throttling with synthetic delays — guaranteeing 100% data freshness without rate limiting.
</details>

<details>
<summary><b>🤖 Serverless AI Copilot</b></summary>

The AI logic runs via Supabase Edge Functions (Deno runtime), keeping API keys server-side. The frontend packages `active_disasters`, `user_location`, and `current_map_mode` into the payload so the LLM provides hyper-contextualized evacuation telemetry.
</details>

<details>
<summary><b>🏥 Overpass API Optimization</b></summary>

```javascript
// Lightweight node-only query targeting emergency amenities within 25 km radius
`[out:json][timeout:25];(node["amenity"="hospital"](around:25000,${lat},${lng});...);out body;`
```

This replaces dense `nwr` geometry fetching, cutting OSM payload size by ~90%.
</details>

<details>
<summary><b>📶 Resilient Offline Tile Strategy</b></summary>

Map tiles are intercepted, converted to Blobs, and cached in IndexedDB. If network fails (e.g., during a cyclone), the map renders from local cache. CORS issues with commercial tile servers are gracefully handled via native `img.src` rendering.
</details>

---

## 👥 Contributors

<table>
<tr>
<td align="center">
  <a href="https://github.com/jaidevxr">
    <img src="https://avatars.githubusercontent.com/u/151908969?v=4" width="100px;" alt="Jaidev Yadav" style="border-radius: 50%;" /><br />
    <sub><b>Jaidev Yadav</b></sub>
  </a>
  <br />
  <sub>Lead Developer</sub>
</td>
<td align="center">
  <a href="https://github.com/KhushiSharma006">
    <img src="https://avatars.githubusercontent.com/u/180095859?v=4" width="100px;" alt="Khushi Sharma" style="border-radius: 50%;" /><br />
    <sub><b>Khushi Sharma</b></sub>
  </a>
  <br />
  <sub>Frontend Development</sub>
</td>
<td align="center">
  <a href="https://github.com/iammadhvi2207">
    <img src="https://avatars.githubusercontent.com/u/159525760?v=4" width="100px;" alt="Madhvi Mishra" style="border-radius: 50%;" /><br />
    <sub><b>Madhvi Mishra</b></sub>
  </a>
  <br />
  <sub>UI/UX & Research</sub>
</td>
</tr>
</table>

---

## 📄 License

This project is open-source and available under the [MIT License](LICENSE).

---

<p align="center">
  <sub>Built with ❤️ for disaster resilience</sub>
</p>
