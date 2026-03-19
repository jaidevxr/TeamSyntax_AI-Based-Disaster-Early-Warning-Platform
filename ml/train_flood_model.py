"""
Train a flood prediction neural network on India flood dataset.

Model: 3-layer feedforward neural network (Keras/TensorFlow)
Input: 10 weather and geographic features
Output: Probability of flood occurrence (binary classification)

After training, the model is exported to TensorFlow.js format
for browser-based inference.
"""

import os
import json
import numpy as np
import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import (
    accuracy_score, precision_score, recall_score,
    f1_score, roc_auc_score, confusion_matrix, classification_report
)

os.environ['TF_CPP_MIN_LOG_LEVEL'] = '2'

import tensorflow as tf
from tensorflow import keras
from tensorflow.keras import layers


def main():
    print("=" * 60)
    print("FLOOD PREDICTION MODEL — TRAINING")
    print("=" * 60)

    # 1. Load dataset
    df = pd.read_csv("ml/datasets/india_flood_data.csv")
    print(f"\nDataset: {len(df)} samples")
    print(f"  Flood events: {df['flood_occurred'].sum()} ({df['flood_occurred'].mean()*100:.1f}%)")
    print(f"  Non-flood: {(df['flood_occurred']==0).sum()}")

    # 2. Select features
    FEATURE_COLS = [
        'rainfall_24h_mm', 'rainfall_48h_mm', 'rainfall_72h_mm',
        'max_hourly_rate_mm', 'temperature_c', 'humidity_pct',
        'pressure_hpa', 'wind_speed_kmh', 'is_monsoon', 'is_coastal'
    ]
    TARGET_COL = 'flood_occurred'

    X = df[FEATURE_COLS].values
    y = df[TARGET_COL].values

    # 3. Train/test split
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42, stratify=y
    )

    # 4. Normalize features (save scaler params for frontend use)
    scaler = StandardScaler()
    X_train_scaled = scaler.fit_transform(X_train)
    X_test_scaled = scaler.transform(X_test)

    scaler_params = {
        "mean": scaler.mean_.tolist(),
        "std": scaler.scale_.tolist(),
        "feature_names": FEATURE_COLS,
    }

    print(f"\nTraining set: {len(X_train)} samples")
    print(f"Test set: {len(X_test)} samples")

    # 5. Build neural network
    model = keras.Sequential([
        layers.Dense(32, activation='relu', input_shape=(len(FEATURE_COLS),), name='hidden1'),
        layers.Dropout(0.3),
        layers.Dense(16, activation='relu', name='hidden2'),
        layers.Dropout(0.2),
        layers.Dense(8, activation='relu', name='hidden3'),
        layers.Dense(1, activation='sigmoid', name='output'),
    ])

    model.compile(
        optimizer=keras.optimizers.Adam(learning_rate=0.001),
        loss='binary_crossentropy',
        metrics=['accuracy', keras.metrics.AUC(name='auc')],
    )

    model.summary()

    # 6. Train
    print("\nTraining...")
    history = model.fit(
        X_train_scaled, y_train,
        epochs=100,
        batch_size=32,
        validation_split=0.15,
        verbose=1,
        callbacks=[
            keras.callbacks.EarlyStopping(
                monitor='val_auc', patience=15, mode='max', restore_best_weights=True
            ),
            keras.callbacks.ReduceLROnPlateau(
                monitor='val_loss', factor=0.5, patience=5, min_lr=1e-6
            ),
        ]
    )

    # 7. Evaluate
    print("\n" + "=" * 60)
    print("EVALUATION RESULTS")
    print("=" * 60)

    y_pred_prob = model.predict(X_test_scaled, verbose=0).flatten()
    y_pred = (y_pred_prob >= 0.5).astype(int)

    accuracy = accuracy_score(y_test, y_pred)
    precision = precision_score(y_test, y_pred, zero_division=0)
    recall = recall_score(y_test, y_pred, zero_division=0)
    f1 = f1_score(y_test, y_pred, zero_division=0)
    auc_roc = roc_auc_score(y_test, y_pred_prob)

    print(f"\n  Accuracy:  {accuracy:.4f}  ({accuracy*100:.1f}%)")
    print(f"  Precision: {precision:.4f}")
    print(f"  Recall:    {recall:.4f}")
    print(f"  F1 Score:  {f1:.4f}")
    print(f"  AUC-ROC:   {auc_roc:.4f}")

    print(f"\nConfusion Matrix:")
    cm = confusion_matrix(y_test, y_pred)
    print(f"  TN={cm[0][0]}  FP={cm[0][1]}")
    print(f"  FN={cm[1][0]}  TP={cm[1][1]}")

    print(f"\nClassification Report:")
    print(classification_report(y_test, y_pred, target_names=['No Flood', 'Flood']))

    # 8. Save model in Keras format
    os.makedirs("models/flood_model_keras", exist_ok=True)
    model.save("models/flood_model_keras/flood_model.keras")
    print(f"\nKeras model saved to models/flood_model_keras/")

    # 9. Save scaler and metadata (TF.js export done via export_to_tfjs.py)
    metadata = {
        "model_name": "India Flood Prediction Neural Network",
        "version": "1.0",
        "architecture": "Dense(32,ReLU) → Dropout(0.3) → Dense(16,ReLU) → Dropout(0.2) → Dense(8,ReLU) → Dense(1,Sigmoid)",
        "dataset": "india_flood_data.csv",
        "dataset_size": len(df),
        "train_size": len(X_train),
        "test_size": len(X_test),
        "features": FEATURE_COLS,
        "target": TARGET_COL,
        "scaler": scaler_params,
        "metrics": {
            "accuracy": round(accuracy, 4),
            "precision": round(precision, 4),
            "recall": round(recall, 4),
            "f1_score": round(f1, 4),
            "auc_roc": round(auc_roc, 4),
        },
        "training": {
            "epochs_run": len(history.history['loss']),
            "optimizer": "Adam (lr=0.001)",
            "loss": "binary_crossentropy",
            "early_stopping": "val_auc, patience=15",
        },
        "description": "Neural network trained on 2500 Indian weather samples to predict flood occurrence. Features include rainfall (24h/48h/72h), humidity, pressure, temperature, wind speed, monsoon season flag, and coastal flag.",
    }

    with open("models/flood_model_keras/metadata.json", "w") as f:
        json.dump(metadata, f, indent=2)
    print(f"Metadata saved to models/flood_model_keras/metadata.json")

    print("\n[OK] Flood model training complete!")
    print(f"   Model AUC-ROC: {auc_roc:.4f}")
    print(f"   Total parameters: {model.count_params()}")


if __name__ == "__main__":
    main()
