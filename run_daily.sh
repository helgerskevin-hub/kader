#!/usr/bin/env bash
# =============================================================================
# run_daily.sh — One-click dagelijkse run (macOS / Linux)
# Maakt automatisch een virtuele omgeving aan, installeert dependencies en
# genereert het dagrapport.
# =============================================================================
set -e

# Ga naar de map van dit script.
cd "$(dirname "$0")"

PY="python3"
VENV_DIR="venv"

echo "================================================"
echo "  Crypto Copy-Trading — Dagelijkse Run"
echo "================================================"

# 1. Virtuele omgeving aanmaken indien nodig.
if [ ! -d "$VENV_DIR" ]; then
  echo "[1/3] Virtuele omgeving aanmaken..."
  $PY -m venv "$VENV_DIR"
fi

# 2. Dependencies installeren (stil als al aanwezig).
echo "[2/3] Dependencies controleren/installeren..."
"$VENV_DIR/bin/python" -m pip install --upgrade pip -q
"$VENV_DIR/bin/python" -m pip install -r requirements.txt -q

# 3. Dagrapport genereren.
echo "[3/3] Dagrapport genereren..."
"$VENV_DIR/bin/python" src/daily_report.py

echo ""
echo "Klaar! Open het bestand reports/daily_trades_$(date +%Y-%m-%d).md"
