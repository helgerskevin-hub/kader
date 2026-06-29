@echo off
REM ============================================================================
REM run_daily.bat - One-click dagelijkse run (Windows)
REM Maakt automatisch een virtuele omgeving aan, installeert dependencies en
REM genereert het dagrapport.
REM ============================================================================

cd /d "%~dp0"

echo ================================================
echo   Crypto Copy-Trading - Dagelijkse Run
echo ================================================

REM 1. Virtuele omgeving aanmaken indien nodig.
if not exist "venv\" (
  echo [1/3] Virtuele omgeving aanmaken...
  python -m venv venv
)

REM 2. Dependencies installeren.
echo [2/3] Dependencies controleren/installeren...
venv\Scripts\python.exe -m pip install --upgrade pip -q
venv\Scripts\python.exe -m pip install -r requirements.txt -q

REM 3. Dagrapport genereren.
echo [3/3] Dagrapport genereren...
venv\Scripts\python.exe src\daily_report.py

echo.
echo Klaar! Open het gegenereerde bestand reports\daily_trades_DATUM.md
pause
