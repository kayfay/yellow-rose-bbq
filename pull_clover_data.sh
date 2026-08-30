#!/bin/bash
# Yellow Rose BBQ - Pull Data from Clover API
# This script runs the full data ingestion pipeline to update the web analytics.

set -e

echo "=== Pulling Latest Data from Clover API ==="

# 1. Activate the python virtual environment
source clover_api/.venv/bin/activate

# 2. Ingest raw orders and payments
echo "-> Ingesting POS transactions..."
python3 clover_api/ingest.py

# 3. Ingest pos items and generate menu
echo "-> Updating POS menu catalog..."
python3 clover_api/ingest_itemized.py

# 4. Generate external machine learning features (weather/holidays)
echo "-> Fetching external weather and holiday features..."
python3 clover_api/analytics/ml_features.py

# 5. Run analytics scripts
echo "-> Running analytics engine..."
python3 generate_historical_payload.py
python3 clover_api/analytics/weather_impact.py
python3 clover_api/analytics/event_impact.py
python3 clover_api/analytics/dashboard.py
python3 clover_api/analytics/advanced_analytics.py

# 6. Build the final payloads for the frontend
echo "-> Building javascript payloads..."
python3 clover_api/analytics/build_payloads.py

echo "=== Success! Data successfully pulled and payloads built! ==="
echo "You can now commit and push the updated files to GitHub to update the live site."
