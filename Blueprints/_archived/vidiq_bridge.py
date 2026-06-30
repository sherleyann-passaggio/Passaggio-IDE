# backend/vidiq_bridge.py
import csv
import json

def load_vidiq_outliers(csv_filepath):
    """
    Reads exported competitor outlier metrics from vidIQ,
    filtering for videos with the highest 'Outlier Score' (e.g., > 5.0x traffic).
    """
    outliers = []
    with open(csv_filepath, mode='r', encoding='utf-8') as file:
        reader = csv.DictReader(file)
        for row in reader:
            multiplier = float(row.get("ViewMultiplier", 1.0))
            if multiplier >= 3.0:  # Focus strictly on highly viral formats
                outliers.append({
                    "title": row.get("Title"),
                    "views": row.get("Views"),
                    "multiplier": multiplier,
                    "duration": row.get("Duration"),
                    # If you scraped the automated transcript
                    "transcript": row.get("Transcript", "")
                })
    return outliers