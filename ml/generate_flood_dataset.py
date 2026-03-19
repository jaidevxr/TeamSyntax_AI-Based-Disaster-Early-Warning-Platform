"""
Generate a realistic India flood prediction dataset.

This creates training data based on real meteorological patterns:
- India Meteorological Department (IMD) rainfall thresholds
- Monsoon season patterns (June-September)
- Regional flood-prone zones (Assam, Kerala, Bihar, WB, Odisha, etc.)
- Open-Meteo weather parameter distributions

The dataset labels (flood_occurred) are generated based on established
flood-triggering thresholds from IMD guidelines:
- 24h rainfall > 115.6mm = "Very Heavy" (high flood risk)
- 72h cumulative > 200mm = significant saturation
- High humidity + low pressure = cyclonic conditions
"""

import numpy as np
import pandas as pd
import os

np.random.seed(42)

# Indian cities with their approximate coordinates, elevation, and flood risk
INDIAN_LOCATIONS = [
    # (city, lat, lng, elevation_m, region_flood_risk, is_coastal)
    ("Mumbai", 19.08, 72.88, 14, 0.8, True),
    ("Chennai", 13.08, 80.27, 6, 0.7, True),
    ("Kolkata", 22.57, 88.36, 11, 0.75, True),
    ("Guwahati", 26.14, 91.74, 55, 0.85, False),
    ("Patna", 25.61, 85.14, 53, 0.8, False),
    ("Kochi", 9.93, 76.27, 0, 0.75, True),
    ("Bhubaneswar", 20.30, 85.82, 45, 0.7, True),
    ("Hyderabad", 17.39, 78.49, 542, 0.5, False),
    ("Jaipur", 26.91, 75.79, 431, 0.2, False),
    ("Delhi", 28.61, 77.23, 216, 0.4, False),
    ("Lucknow", 26.85, 80.95, 123, 0.5, False),
    ("Ahmedabad", 23.02, 72.57, 53, 0.45, True),
    ("Bengaluru", 12.97, 77.59, 920, 0.3, False),
    ("Pune", 18.52, 73.86, 560, 0.35, False),
    ("Thiruvananthapuram", 8.52, 76.94, 10, 0.6, True),
    ("Visakhapatnam", 17.69, 83.22, 45, 0.65, True),
    ("Srinagar", 34.08, 74.80, 1585, 0.55, False),
    ("Dehradun", 30.32, 78.03, 640, 0.6, False),
    ("Imphal", 24.82, 93.95, 786, 0.5, False),
    ("Shillong", 25.57, 91.88, 1496, 0.55, False),
    ("Raipur", 21.25, 81.63, 298, 0.4, False),
    ("Ranchi", 23.34, 85.31, 651, 0.35, False),
    ("Varanasi", 25.32, 83.01, 81, 0.55, False),
    ("Dibrugarh", 27.47, 94.91, 108, 0.8, False),
    ("Silchar", 24.83, 92.78, 35, 0.75, False),
]

NUM_SAMPLES = 2500

def generate_dataset():
    records = []

    for i in range(NUM_SAMPLES):
        # Pick a random location
        loc = INDIAN_LOCATIONS[np.random.randint(len(INDIAN_LOCATIONS))]
        city, lat, lng, elevation, region_risk, is_coastal = loc

        # Random month (1-12)
        month = np.random.randint(1, 13)
        is_monsoon = 1 if month in [6, 7, 8, 9] else 0

        # Generate weather features based on season and region
        if is_monsoon:
            base_rainfall_24h = np.random.exponential(scale=35 * (1 + region_risk))
            humidity = np.clip(np.random.normal(82, 8), 40, 100)
            pressure = np.clip(np.random.normal(1003, 8), 975, 1020)
        else:
            base_rainfall_24h = np.random.exponential(scale=8 * (1 + region_risk * 0.3))
            humidity = np.clip(np.random.normal(60, 15), 20, 95)
            pressure = np.clip(np.random.normal(1013, 5), 995, 1025)

        rainfall_24h = round(max(0, base_rainfall_24h), 1)
        rainfall_48h = round(rainfall_24h + max(0, np.random.exponential(scale=rainfall_24h * 0.6)), 1)
        rainfall_72h = round(rainfall_48h + max(0, np.random.exponential(scale=rainfall_24h * 0.4)), 1)

        max_hourly_rate = round(max(0, np.random.exponential(scale=rainfall_24h / 8)), 1)

        temperature = round(np.clip(
            np.random.normal(30 if is_monsoon else 25, 5) - elevation / 200,
            5, 48
        ), 1)

        wind_speed = round(max(0, np.random.exponential(scale=12 if is_coastal else 8)), 1)
        humidity = round(humidity, 1)
        pressure = round(pressure, 1)

        # ---- FLOOD LABEL ----
        # Based on IMD thresholds and physical meteorology
        flood_score = 0.0

        # IMD "Very Heavy Rainfall" threshold: 115.6mm/24h
        if rainfall_24h > 115.6:
            flood_score += 0.45
        elif rainfall_24h > 64.5:  # "Heavy Rainfall"
            flood_score += 0.25
        elif rainfall_24h > 35.5:  # "Fairly Heavy"
            flood_score += 0.1

        # Cumulative rainfall (soil saturation proxy)
        if rainfall_72h > 200:
            flood_score += 0.25
        elif rainfall_72h > 100:
            flood_score += 0.1

        # High intensity burst
        if max_hourly_rate > 30:
            flood_score += 0.15

        # Cyclonic low pressure
        if pressure < 1000:
            flood_score += 0.1
        if pressure < 990:
            flood_score += 0.15

        # High humidity = saturated atmosphere
        if humidity > 85:
            flood_score += 0.05

        # Monsoon season boost
        if is_monsoon:
            flood_score += 0.05

        # Regional risk
        flood_score += region_risk * 0.05

        # Low elevation = more flood prone
        if elevation < 50:
            flood_score += 0.1
        elif elevation < 200:
            flood_score += 0.05

        # Add noise (real-world uncertainty)
        flood_score += np.random.normal(0, 0.08)

        # Binary label with probabilistic threshold
        flood_occurred = 1 if flood_score > 0.42 else 0

        records.append({
            "city": city,
            "latitude": lat,
            "longitude": lng,
            "elevation_m": elevation,
            "month": month,
            "is_monsoon": is_monsoon,
            "is_coastal": int(is_coastal),
            "rainfall_24h_mm": rainfall_24h,
            "rainfall_48h_mm": rainfall_48h,
            "rainfall_72h_mm": rainfall_72h,
            "max_hourly_rate_mm": max_hourly_rate,
            "temperature_c": temperature,
            "humidity_pct": humidity,
            "pressure_hpa": pressure,
            "wind_speed_kmh": wind_speed,
            "flood_occurred": flood_occurred,
        })

    df = pd.DataFrame(records)

    # Print dataset statistics
    print(f"Generated {len(df)} samples")
    print(f"Flood events: {df['flood_occurred'].sum()} ({df['flood_occurred'].mean()*100:.1f}%)")
    print(f"Non-flood events: {(df['flood_occurred'] == 0).sum()}")
    print(f"\nFeature ranges:")
    for col in ['rainfall_24h_mm', 'rainfall_72h_mm', 'humidity_pct', 'pressure_hpa', 'temperature_c']:
        print(f"  {col}: {df[col].min():.1f} - {df[col].max():.1f} (mean: {df[col].mean():.1f})")

    os.makedirs("datasets", exist_ok=True)
    df.to_csv("datasets/india_flood_data.csv", index=False)
    print(f"\nSaved to datasets/india_flood_data.csv")

    return df


if __name__ == "__main__":
    generate_dataset()
