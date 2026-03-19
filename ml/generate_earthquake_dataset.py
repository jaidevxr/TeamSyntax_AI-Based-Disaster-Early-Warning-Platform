"""
Generate a realistic India earthquake risk dataset.

Based on real seismological data patterns from:
- USGS Earthquake Catalog (earthquake.usgs.gov)
- India seismic zonation (BIS IS:1893-2016, Zones II-V)
- Gutenberg-Richter frequency-magnitude relationship

Features represent 30-day observation windows at various locations.
Label indicates whether a significant (M5.0+) event occurred within
the next 30 days in a 500km radius.
"""

import numpy as np
import pandas as pd
import os

np.random.seed(123)

# Indian seismic zones with typical parameters
# (region, lat, lng, seismic_zone 2-5, base_rate events/month)
SEISMIC_REGIONS = [
    ("Kashmir", 34.1, 74.8, 5, 3.5),
    ("Himachal Pradesh", 31.1, 77.2, 5, 2.8),
    ("Uttarakhand", 30.3, 79.5, 5, 3.0),
    ("Sikkim", 27.3, 88.6, 4, 2.2),
    ("Arunachal Pradesh", 28.2, 94.7, 5, 2.5),
    ("Assam", 26.1, 91.7, 5, 3.2),
    ("Manipur", 24.8, 93.9, 5, 1.8),
    ("Nagaland", 26.2, 94.6, 5, 1.5),
    ("Gujarat-Kutch", 23.2, 69.7, 5, 1.8),
    ("Gujarat-Saurashtra", 22.3, 71.8, 3, 0.8),
    ("Delhi-NCR", 28.6, 77.2, 4, 1.2),
    ("Maharashtra-Koyna", 17.4, 73.8, 4, 1.5),
    ("Tamil Nadu", 11.1, 78.7, 2, 0.3),
    ("Kerala", 10.5, 76.3, 3, 0.5),
    ("Karnataka", 15.3, 75.7, 2, 0.3),
    ("Rajasthan", 26.9, 75.8, 2, 0.4),
    ("Madhya Pradesh", 23.5, 77.4, 2, 0.3),
    ("Bihar", 25.6, 85.1, 4, 1.8),
    ("West Bengal", 22.6, 88.4, 3, 1.0),
    ("Odisha", 20.3, 85.8, 2, 0.4),
    ("Andaman Islands", 12.0, 92.7, 5, 3.8),
    ("Mizoram", 23.7, 92.7, 5, 1.6),
    ("Meghalaya", 25.6, 91.9, 5, 2.0),
    ("Tripura", 23.9, 91.5, 5, 1.4),
    ("Ladakh", 34.2, 77.6, 5, 2.8),
]

NUM_SAMPLES = 2000

def compute_b_value(magnitudes):
    """Aki (1965) maximum likelihood b-value estimate."""
    mags = [m for m in magnitudes if m >= 2.0]
    if len(mags) < 5:
        return 1.0
    m_mean = np.mean(mags)
    m_min = 2.0
    b = np.log10(np.e) / (m_mean - m_min + 0.05)
    return np.clip(b, 0.4, 2.5)


def generate_dataset():
    records = []

    for i in range(NUM_SAMPLES):
        region = SEISMIC_REGIONS[np.random.randint(len(SEISMIC_REGIONS))]
        name, lat, lng, zone, base_rate = region

        # Add small random offset to coordinates
        lat += np.random.uniform(-1.0, 1.0)
        lng += np.random.uniform(-1.0, 1.0)

        # Simulate 30-day observation window
        # Number of events follows Poisson with zone-based rate
        event_count = np.random.poisson(lam=base_rate)

        # Generate magnitudes using Gutenberg-Richter
        b_true = np.random.normal(1.0, 0.15)
        b_true = np.clip(b_true, 0.5, 1.8)

        if event_count > 0:
            # Inverse CDF of GR distribution: M = Mmin - log10(U) / b
            mags = 2.0 - np.log10(np.random.uniform(0, 1, event_count)) / b_true
            mags = np.clip(mags, 2.0, 8.0)
            magnitudes = sorted(mags.tolist())
        else:
            magnitudes = []

        avg_mag = np.mean(magnitudes) if magnitudes else 0
        max_mag = np.max(magnitudes) if magnitudes else 0
        mag_std = np.std(magnitudes) if len(magnitudes) > 1 else 0

        # b-value from observed data
        b_value = compute_b_value(magnitudes) if magnitudes else 1.0

        # Depth statistics (km) — deeper in subduction zones
        if zone >= 4:
            avg_depth = np.random.exponential(scale=30) + 10
        else:
            avg_depth = np.random.exponential(scale=15) + 5
        avg_depth = round(min(avg_depth, 300), 1)

        # Energy release (proxy: sum of 10^(1.5*M))
        energy_release = sum(10**(1.5 * m) for m in magnitudes) if magnitudes else 0
        log_energy = round(np.log10(energy_release + 1), 3)

        # Inter-event time regularity (coefficient of variation)
        if event_count >= 3:
            intervals = np.random.exponential(scale=30/event_count, size=event_count-1)
            inter_event_cv = round(np.std(intervals) / (np.mean(intervals) + 0.01), 3)
        else:
            inter_event_cv = 0

        # Rate change (recent 7 days vs baseline)
        recent_rate = np.random.poisson(lam=base_rate * 7/30)
        baseline_rate = max(1, event_count - recent_rate)
        rate_change = round(recent_rate / (baseline_rate/23 * 7 + 0.01), 3)
        rate_change = min(rate_change, 10)

        # ---- SIGNIFICANT EVENT LABEL ----
        # Does a M5.0+ earthquake occur in next 30 days?
        sig_score = 0.0

        # Higher seismic zone = higher base probability
        sig_score += (zone - 2) * 0.05  # Zone 5 → +0.15

        # Elevated seismicity rate
        if event_count > base_rate * 1.5:
            sig_score += 0.1
        if event_count > base_rate * 2:
            sig_score += 0.15

        # Low b-value = stress accumulation
        if b_value < 0.7:
            sig_score += 0.15
        elif b_value < 0.9:
            sig_score += 0.08

        # Recent acceleration
        if rate_change > 2.0:
            sig_score += 0.1

        # High max magnitude already observed
        if max_mag > 4.5:
            sig_score += 0.1
        if max_mag > 5.0:
            sig_score += 0.15

        # Clustering (low CV = more regular = potentially foreshocks)
        if inter_event_cv < 0.5 and event_count >= 3:
            sig_score += 0.08

        # Energy acceleration
        if log_energy > 5:
            sig_score += 0.05

        sig_score += np.random.normal(0, 0.06)
        significant_event = 1 if sig_score > 0.28 else 0

        records.append({
            "region": name,
            "latitude": round(lat, 2),
            "longitude": round(lng, 2),
            "seismic_zone": zone,
            "event_count_30d": event_count,
            "avg_magnitude": round(avg_mag, 2),
            "max_magnitude": round(max_mag, 2),
            "magnitude_std": round(mag_std, 3),
            "b_value": round(b_value, 3),
            "avg_depth_km": avg_depth,
            "log_energy_release": log_energy,
            "inter_event_cv": inter_event_cv,
            "recent_rate_7d": recent_rate,
            "rate_change_ratio": rate_change,
            "significant_event_next30d": significant_event,
        })

    df = pd.DataFrame(records)

    print(f"Generated {len(df)} samples")
    print(f"Significant events (M5.0+ within 30d): {df['significant_event_next30d'].sum()} ({df['significant_event_next30d'].mean()*100:.1f}%)")
    print(f"\nBy seismic zone:")
    for zone in sorted(df['seismic_zone'].unique()):
        subset = df[df['seismic_zone'] == zone]
        print(f"  Zone {zone}: {len(subset)} samples, {subset['significant_event_next30d'].mean()*100:.1f}% positive")
    print(f"\nFeature ranges:")
    for col in ['event_count_30d', 'avg_magnitude', 'max_magnitude', 'b_value', 'avg_depth_km']:
        print(f"  {col}: {df[col].min():.2f} - {df[col].max():.2f} (mean: {df[col].mean():.2f})")

    os.makedirs("datasets", exist_ok=True)
    df.to_csv("datasets/india_earthquake_data.csv", index=False)
    print(f"\nSaved to datasets/india_earthquake_data.csv")

    return df


if __name__ == "__main__":
    generate_dataset()
