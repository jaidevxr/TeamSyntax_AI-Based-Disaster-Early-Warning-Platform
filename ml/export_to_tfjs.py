"""
Export trained Keras models to TensorFlow.js-compatible JSON format.

This script works around the tensorflowjs pip package numpy compatibility
issue by directly extracting model weights and architecture to JSON files
that can be loaded by tf.loadLayersModel() in the browser.
"""

import os
import json
import numpy as np

os.environ['TF_CPP_MIN_LOG_LEVEL'] = '2'
import tensorflow as tf


def export_model_to_tfjs(model_path, output_dir, model_name):
    """Export a Keras model to TF.js LayersModel format manually."""
    print(f"\nExporting {model_name}...")

    # Load the Keras model
    model = tf.keras.models.load_model(model_path)
    model.summary()

    os.makedirs(output_dir, exist_ok=True)

    # Extract weights
    weights_manifest = []
    weight_data = bytearray()

    for layer in model.layers:
        layer_weights = layer.get_weights()
        for i, w in enumerate(layer_weights):
            w = w.astype(np.float32)
            weight_name = f"{layer.name}/{['kernel', 'bias'][i]}"
            weights_manifest.append({
                "name": weight_name,
                "shape": list(w.shape),
                "dtype": "float32",
            })
            weight_data.extend(w.tobytes())

    # Save weights binary
    weights_bin_path = os.path.join(output_dir, "group1-shard1of1.bin")
    with open(weights_bin_path, "wb") as f:
        f.write(weight_data)

    # Build model.json (TF.js LayersModel format)
    model_config = json.loads(model.to_json())
    
    # Keras 3 uses 'batch_shape' but TF.js often expects 'batch_input_shape'
    # Inject batch_input_shape into the first layer for maximum compatibility
    if "config" in model_config and "layers" in model_config["config"]:
        first_layer = model_config["config"]["layers"][0]
        if "config" in first_layer:
            # Check for batch_shape (Keras 3) and map to batch_input_shape (TF.js)
            b_shape = first_layer["config"].get("batch_shape")
            if b_shape and "batch_input_shape" not in first_layer["config"]:
                first_layer["config"]["batch_input_shape"] = b_shape
                print(f"  [FIX] Injected batch_input_shape: {b_shape}")

    model_json = {
        "format": "layers-model",
        "generatedBy": "keras v" + tf.keras.__version__,
        "convertedBy": "custom_export_script v1.0",
        "modelTopology": model_config,
        "weightsManifest": [{
            "paths": ["group1-shard1of1.bin"],
            "weights": weights_manifest,
        }],
    }

    model_json_path = os.path.join(output_dir, "model.json")
    with open(model_json_path, "w") as f:
        json.dump(model_json, f, indent=2)

    total_params = sum(np.prod(w["shape"]) for w in weights_manifest)
    print(f"  [OK] Exported to {output_dir}/")
    print(f"     model.json ({os.path.getsize(model_json_path)} bytes)")
    print(f"     group1-shard1of1.bin ({os.path.getsize(weights_bin_path)} bytes)")
    print(f"     Total parameters: {total_params}")


def main():
    print("=" * 60)
    print("EXPORTING MODELS TO TENSORFLOW.JS FORMAT")
    print("=" * 60)

    # Export flood model
    if os.path.exists("models/flood_model_keras/flood_model.keras"):
        export_model_to_tfjs(
            "models/flood_model_keras/flood_model.keras",
            "models/flood_model_tfjs",
            "Flood Prediction Model"
        )
    else:
        print("[MISSING] Flood model not found. Run train_flood_model.py first.")

    # Export earthquake model
    if os.path.exists("models/earthquake_model_keras/earthquake_model.keras"):
        export_model_to_tfjs(
            "models/earthquake_model_keras/earthquake_model.keras",
            "models/earthquake_model_tfjs",
            "Earthquake Risk Model"
        )
    else:
        print("[MISSING] Earthquake model not found. Run train_earthquake_model.py first.")

    print("\n[OK] All exports complete!")


if __name__ == "__main__":
    main()
