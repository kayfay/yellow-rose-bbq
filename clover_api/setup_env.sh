#!/bin/bash
# Yellow Rose BBQ - Analytics Environment Provisioning
# Sets up a high-performance Python environment on Debian.

set -e

echo "=== Securing & Provisioning Yellow Rose BBQ ML Environment ==="

# 1. Enforce directory structure
cd "$(dirname "$0")/.."
echo "Working directory: $(pwd)"

# 2. Install Debian system requirements for virtual environments
echo "[1/4] Installing system prerequisites..."
sudo apt-get update -y
sudo apt-get install -y python3-venv python3-pip curl

# 3. Create isolated virtual environment
echo "[2/4] Initializing Python Virtual Environment..."
VENV_DIR="clover_api/.venv"
if [ ! -d "$VENV_DIR" ]; then
    python3 -m venv "$VENV_DIR"
    echo "Virtual environment created at $VENV_DIR"
else
    echo "Virtual environment already exists."
fi

# 4. Install top-tier ML packages
echo "[3/4] Installing Polars, XGBoost, Scikit-Learn, Plotly, and API clients..."
source "$VENV_DIR/bin/activate"
pip install --upgrade pip
pip install polars pandas plotly statsmodels requests python-dotenv xgboost scikit-learn holidays openmeteo-requests requests-cache retry-requests

echo "[4/4] Environment Provisioning Complete!"
echo "To activate the environment manually, run: source clover_api/.venv/bin/activate"
