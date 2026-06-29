#!/bin/bash
# Dubbelklik dit bestand om de Crypto Copy-Trading app te starten.
cd "$(dirname "$0")"

# Maak/gebruik de virtuele omgeving en installeer dependencies (alleen 1e keer).
if [ ! -d "venv" ]; then
  echo "Eenmalige installatie..."
  python3 -m venv venv
  ./venv/bin/pip install -q -r requirements.txt
fi

echo "App starten — je browser opent zo vanzelf op http://localhost:8765"
./venv/bin/python src/app.py
