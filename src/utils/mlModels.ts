/**
 * ML Model Loader and Inference — TensorFlow.js
 *
 * Loads pre-trained neural network models exported from Python (Keras)
 * and runs real-time predictions in the browser.
 *
 * Models:
 *  - Flood Prediction NN: 10 features → flood probability (AUC-ROC ~0.99)
 *  - Earthquake Risk NN: 10 features → significant event probability (AUC-ROC ~0.85)
 *
 * Both models were trained on real Indian disaster data. See:
 *   ml/datasets/india_flood_data.csv
 *   ml/datasets/india_earthquake_data.csv
 *   ml/train_flood_model.py
 *   ml/train_earthquake_model.py
 */

import * as tf from '@tensorflow/tfjs';

// ─── Model Metadata Types ────────────────────────────────────────────────────

interface ModelMetadata {
    model_name: string;
    version: string;
    architecture: string;
    dataset: string;
    dataset_size: number;
    features: string[];
    scaler: {
        mean: number[];
        std: number[];
        feature_names: string[];
    };
    metrics: {
        accuracy: number;
        precision: number;
        recall: number;
        f1_score: number;
        auc_roc: number;
    };
    description: string;
}

export interface MLPrediction {
    probability: number;
    modelName: string;
    modelInfo: string;
    metrics: ModelMetadata['metrics'];
    features: Record<string, number>;
    // UI-friendly indicators
    isFlood?: boolean;
    isAnomaly?: boolean;
    anomalyLevel?: string;
    elevation?: number;
}

// ─── Model Cache ─────────────────────────────────────────────────────────────

let floodModel: tf.LayersModel | null = null;
let earthquakeModel: tf.LayersModel | null = null;
let floodMetadata: ModelMetadata | null = null;
let earthquakeMetadata: ModelMetadata | null = null;
let modelsLoadingPromise: Promise<void> | null = null;
let lastLoadError: string | null = null;

// ─── Load Models ─────────────────────────────────────────────────────────────

async function loadMetadata(path: string): Promise<ModelMetadata> {
    const res = await fetch(path);
    if (!res.ok) throw new Error(`Failed to load metadata from ${path}`);
    return res.json();
}

export async function loadMLModels(): Promise<void> {
    if (floodModel && earthquakeModel && floodMetadata && earthquakeMetadata) return;

    if (modelsLoadingPromise) {
        return modelsLoadingPromise;
    }

    modelsLoadingPromise = (async () => {
        try {
            const origin = typeof window !== 'undefined' ? window.location.origin : '';
            const floodPath = `${origin}/ml-models/flood_model/model.json`;
            const eqPath = `${origin}/ml-models/earthquake_model/model.json`;
            const floodMetaPath = `${origin}/ml-models/flood_model/metadata.json`;
            const eqMetaPath = `${origin}/ml-models/earthquake_model/metadata.json`;

            console.log('⏳ Loading ML Models (TF.js) from:', { origin });

            const [fModel, eModel, fMeta, eMeta] = await Promise.all([
                tf.loadLayersModel(floodPath).catch(e => {
                    lastLoadError = `Flood Model: ${e.message}`;
                    console.error('❌', lastLoadError);
                    return null;
                }),
                tf.loadLayersModel(eqPath).catch(e => {
                    lastLoadError = `EQ Model: ${e.message}`;
                    console.error('❌', lastLoadError);
                    return null;
                }),
                loadMetadata(floodMetaPath).catch(e => {
                    lastLoadError = `Flood Meta: ${e.message}`;
                    console.error('❌', lastLoadError);
                    return null;
                }),
                loadMetadata(eqMetaPath).catch(e => {
                    lastLoadError = `EQ Meta: ${e.message}`;
                    console.error('❌', lastLoadError);
                    return null;
                }),
            ]);

            floodModel = fModel;
            earthquakeModel = eModel;
            floodMetadata = fMeta;
            earthquakeMetadata = eMeta;

            if (floodModel && earthquakeModel && floodMetadata && earthquakeMetadata) {
                console.log('✅ All ML Models & Metadata loaded successfully');
            }
        } catch (error: any) {
            lastLoadError = error.message;
            console.error('❌ ML sequence error:', error);
        } finally {
            modelsLoadingPromise = null;
        }
    })();

    return modelsLoadingPromise;
}

export function getMLLoadError() {
    return lastLoadError;
}

// ─── Feature Normalization ───────────────────────────────────────────────────

function normalizeFeatures(
    features: number[],
    mean: number[],
    std: number[],
): number[] {
    return features.map((val, i) => (val - mean[i]) / (std[i] || 1));
}

// ─── Flood Prediction ────────────────────────────────────────────────────────

export interface FloodPredictionInput {
    rainfall_24h_mm: number;
    rainfall_48h_mm: number;
    rainfall_72h_mm: number;
    max_hourly_rate_mm: number;
    temperature_c: number;
    humidity_pct: number;
    pressure_hpa: number;
    wind_speed_kmh: number;
    is_monsoon: number; // 0 or 1
    is_coastal: number; // 0 or 1
}

export async function predictFlood(
    input: FloodPredictionInput,
    elevation?: number,
): Promise<MLPrediction | null> {
    if (!floodModel || !floodMetadata) {
        await loadMLModels();
    }

    if (!floodModel || !floodMetadata) {
        console.warn('Flood model not available');
        return null;
    }

    const featureOrder = floodMetadata.scaler.feature_names;
    const rawFeatures = featureOrder.map(name => {
        const key = name as keyof FloodPredictionInput;
        return input[key] ?? 0;
    });

    const normalized = normalizeFeatures(
        rawFeatures,
        floodMetadata.scaler.mean,
        floodMetadata.scaler.std,
    );

    // Run inference
    const inputTensor = tf.tensor2d([normalized]);
    const prediction = floodModel.predict(inputTensor) as tf.Tensor;
    const probability = (await prediction.data())[0];

    // Cleanup
    inputTensor.dispose();
    prediction.dispose();

    // Build feature map for display
    const features: Record<string, number> = {};
    featureOrder.forEach((name, i) => {
        features[name] = rawFeatures[i];
    });

    // --- HYBRID LOGIC: IMD Standard Overrides ---
    // If rainfall is extremely high, we override the model for safety
    let finalProb = probability;
    let isFlood = probability > 0.65;
    let fallbackInfo = "";

    // 10-feature input rainfall is index 0 (rainfall_24h_mm) based on training script
    const rainfall24h = rawFeatures[0];

    if (rainfall24h > 100) {
        // IMD "Heavy Rain" threshold
        finalProb = Math.max(finalProb, 0.7);
        isFlood = true;
        fallbackInfo = " [Hybrid: IMD Heavy Rain Threshold]";
    }
    if (rainfall24h > 200) {
        // IMD "Extremely Heavy Rain" threshold
        finalProb = Math.max(finalProb, 0.95);
        isFlood = true;
        fallbackInfo = " [Hybrid: Critical Rainfall Override]";
    }

    // --- ELEVATION MODULATION ---
    if (elevation !== undefined) {
        if (elevation < 10) {
            // Coastal or low-lying basin
            finalProb = Math.min(1.0, finalProb * 1.25);
            if (finalProb > 0.6) isFlood = true;
            fallbackInfo += " [Geo: Low-Elevation Risk]";
        } else if (elevation > 500) {
            // High elevation - lower flood risk from accumulation
            finalProb = finalProb * 0.8;
            if (finalProb < 0.6) isFlood = false;
        }
    }

    return {
        probability: finalProb,
        modelName: floodMetadata.model_name,
        modelInfo: `${floodMetadata.architecture}${fallbackInfo}`,
        metrics: floodMetadata.metrics,
        features,
        isFlood: isFlood,
        elevation,
    };
}

// ─── Earthquake Prediction ───────────────────────────────────────────────────

export interface EarthquakePredictionInput {
    seismic_zone: number;
    event_count_30d: number;
    avg_magnitude: number;
    max_magnitude: number;
    magnitude_std: number;
    b_value: number;
    avg_depth_km: number;
    log_energy_release: number;
    inter_event_cv: number;
    rate_change_ratio: number;
}

export async function predictEarthquakeRisk(
    input: EarthquakePredictionInput,
    elevation?: number,
): Promise<MLPrediction | null> {
    if (!earthquakeModel || !earthquakeMetadata) {
        await loadMLModels();
    }

    if (!earthquakeModel || !earthquakeMetadata) {
        console.warn('Earthquake model not available');
        return null;
    }

    const featureOrder = earthquakeMetadata.scaler.feature_names;
    const rawFeatures = featureOrder.map(name => {
        const key = name as keyof EarthquakePredictionInput;
        return input[key] ?? 0;
    });

    const normalized = normalizeFeatures(
        rawFeatures,
        earthquakeMetadata.scaler.mean,
        earthquakeMetadata.scaler.std,
    );

    // Run inference
    const inputTensor = tf.tensor2d([normalized]);
    const prediction = earthquakeModel.predict(inputTensor) as tf.Tensor;
    const probability = (await prediction.data())[0];

    // Cleanup
    inputTensor.dispose();
    prediction.dispose();

    // Build feature map for display
    const features: Record<string, number> = {};
    featureOrder.forEach((name, i) => {
        features[name] = rawFeatures[i];
    });

    // --- HYBRID LOGIC: Scientific Seismic Overrides ---
    let finalProb = probability;
    let isAnomaly = probability > 0.4;
    let anomalyLevel = probability > 0.7 ? 'Extreme' : (probability > 0.4 ? 'Elevated' : 'Normal');
    let fallbackInfo = "";

    // 10-feature input max_magnitude is index 3 (max_magnitude) based on training script
    const maxMag = rawFeatures[3];
    const avgDepth = rawFeatures[6]; // avg_depth_km

    // USGS Standard: Magnitude > 5.0 is "Significant"
    if (maxMag >= 5.0) {
        finalProb = Math.max(finalProb, 0.75);
        isAnomaly = true;
        anomalyLevel = "Extreme";
        fallbackInfo = " [Hybrid: Magnitude Threshold]";
    }

    // Near-surface tremors are dangerous
    if (maxMag >= 4.0 && avgDepth < 10) {
        finalProb = Math.max(finalProb, 0.6);
        isAnomaly = true;
        fallbackInfo = " [Hybrid: Shallow Tremor Warning]";
    }

    return {
        probability: finalProb,
        modelName: earthquakeMetadata.model_name,
        modelInfo: `${earthquakeMetadata.architecture}${fallbackInfo}`,
        metrics: earthquakeMetadata.metrics,
        features,
        isAnomaly: isAnomaly,
        anomalyLevel: anomalyLevel as any,
        elevation,
    };
}

// ─── Model Status ────────────────────────────────────────────────────────────

export function getMLModelStatus() {
    return {
        floodModelLoaded: !!floodModel,
        earthquakeModelLoaded: !!earthquakeModel,
        floodMetrics: floodMetadata?.metrics || null,
        earthquakeMetrics: earthquakeMetadata?.metrics || null,
    };
}
