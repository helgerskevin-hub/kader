# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A personal crypto copy-trading **analysis** tool (not financial advice; it produces technical signals). It analyses free public market data and outputs concrete trades with a pre-computed entry, ATR-based stop-loss and take-profit (minimum 1:2 risk/reward), plus an eToro "Popular Investor" auditor. **All user-facing text is Dutch** -- keep generated output, UI strings and comments in Dutch to match the existing code.

It ships in two forms that share the same analysis logic:

1. **Desktop/dev tool** -- Python (stdlib `http.server`) in `src/`, served at `http://localhost:8765`, plus a CLI daily-report generator.
2. **Android app** -- Capacitor 6 / WebView in `mobile/`. The frontend lives in `mobile/www/` (`index.html` + `engine.js`). All analysis runs **on-device**; no server.

## ⚠️ Critical: the analysis logic is duplicated

`mobile/www/engine.js` is a hand-maintained **1-to-1 JavaScript port** of the Python modules in `src/` (same indicators, scores, stop-loss/take-profit logic). When you change analysis behaviour (the trade universe, indicator math, scoring, R/R multipliers, or the eToro auditor), **you must update both the Python `src/` modules and `mobile/www/engine.js`** or the desktop and mobile apps will diverge.

Note: `mobile/www/` is **gitignored** (and may be absent in a fresh checkout). If it's missing, the mobile frontend has not been generated/restored yet; ask before assuming it should be regenerated.

## Commands

Desktop (Python, from repo root):
```bash
python3 -m venv venv && source venv/bin/activate   # Windows: venv\Scripts\activate
pip install -r requirements.txt
python src/app.py            # web app on http://localhost:8765
python src/daily_report.py   # write reports/daily_trades_<date>.md
python src/crypto_analyzer.py   # print the trade table to stdout
python src/etoro_auditor.py     # run the eToro auditor standalone
```
One-click daily report: `./run_daily.sh` (macOS/Linux) or `run_daily.bat` (Windows); these auto-create the venv and install deps on first run.

Mobile (from `mobile/`):
```bash
npm run sync                 # cap sync android
npm run build:apk            # sync + gradle assembleDebug
```
Building the APK needs JDK 17 and the Android SDK (platform 34 + build-tools 34). Output: `mobile/android/app/build/outputs/apk/debug/app-debug.apk`. After editing `mobile/www/`, run `npx cap sync android` before rebuilding so the WebView assets are copied in.

There is **no test suite** and no linter configured (the Android `*Test.java` files are empty Capacitor scaffolding).

## Architecture (Python `src/`)

- `crypto_analyzer.py` -- the engine. Fetches OHLCV from **Binance** public klines (multiple base URLs in `BINANCE_BASES` for geo-redundancy) with a **CoinGecko fallback**; no API keys. Indicators (RSI, EMA 20/50, MACD, ATR, volume spikes) are computed by hand in pandas so the tool keeps working if external indicator libs change. `analyseer_markt()` returns a ranked list of trade dicts. Also contains the "grote kansen" (big-opportunity) scanner over a wider coin set.
- `etoro_auditor.py` -- scores an eToro trader (consistency, drawdown/return ratio, portfolio concentration) and outputs a 🟢/🟡/🔴 verdict + recommended Copy Stop Loss %.
- `coin_info.py` -- per-coin descriptions + a technical buy-advice badge derived from live indicators.
- `daily_report.py` -- combines analyzer + auditor, writes `reports/daily_trades_<date>.md`.
- `app.py` + `app_ui.py` -- stdlib `ThreadingHTTPServer` (no Flask dependency) wrapping the modules above; `app_ui.py` holds the HTML/CSS/JS. State persists to `data/traders.json` and `data/portfolio.json` (the `data/*.json` files are gitignored).

### Key tunables (top of `crypto_analyzer.py`)
`STANDAARD_UNIVERSUM` (coins analysed), `ATR_STOP_MULTIPLIER` (1.5, stop distance), `REWARD_MULTIPLIER` (3.0, take-profit), `MIN_RISK_REWARD` (2.0), `HIGH_CONVICTION_SCORE` (75). Stop = `entry - 1.5xATR`, take-profit = `entry + 3xATR`, giving R/R >= 1:2; coins below the R/R threshold are filtered out. Score 0-100 rewards uptrend (EMA20>EMA50), price above EMA20, healthy RSI, bullish MACD and volume spikes. Changing any of these requires mirroring the change in `engine.js`.

## Mobile specifics

- `mobile/capacitor.config.json` enables **CapacitorHttp** so market-data requests go through the native HTTP layer and avoid CORS in the WebView. Keep using that path for outbound requests from `engine.js`.
- App id / name: `com.kevinhelgers.cryptocopytrading` / "Crypto Copy-Trading".
- Push notifications via `@capacitor/local-notifications`: every ~10 min the app checks open trades and notifies to raise take-profit (price near TP, momentum strong) or raise stop-loss / exit early (in profit but momentum flattening). Same alert repeats at most once per ~6h unless the suggested level moves >2%.
- The APK is signed with the default debug key (fine for personal sideloading; Play Store would need a release keystore).

## Design context

Before any UI or design work, always read the following files first:

- `docs/app-beschrijving-voor-claude-design.md` -- screen-by-screen description, user flows, and copy
- `docs/huisstijl-kader.md` -- brand identity, colour palette, typography, tone of voice
- `docs/Design system voor React Native app.zip` -- component library, spacing tokens, UI patterns
- `docs/logo.zip` -- official logo assets and usage rules
- `CONTEXT.md` (root) -- dark "fintech/dashboard" theme and additional context

Tone: sober, helpful, Dutch, never hype-y; always carry the "not financial advice / check the live price on eToro" disclaimer.

## Team and Git workflow

Thom and Kevin both work on this project via Claude Code -- both write code and app features, not just design. Neither is a programmer; the AI does the writing.

See `docs/github-werkwijze.md` for the full agreed workflow. Key points:

- **`main` is always stable and installable.** Never commit work-in-progress directly to main.
- **One branch per task.** Create a branch before starting, merge via Pull Request when done.
- **Coordinate first.** Tell each other (chat/WhatsApp) what you're picking up before starting -- two Claude Code sessions working on the same files simultaneously creates hard-to-fix merge conflicts.
- **Before starting any session:** run `git fetch origin` and check `git log --all --oneline --graph` to see what the other person may have pushed.

## Writing and language rules

These rules apply everywhere: code comments, UI strings, generated reports, documentation, and any other text in this project.

**No em-dashes.** Never use an em-dash (--) as punctuation. Use a comma, colon, semicolon, or plain hyphen instead. This includes output generated by code.

**No generic AI text.** Avoid hollow filler phrases like "Certainly!", "Great question!", "It's worth noting that...", "In conclusion...", or any other phrasing that reads like a template. Write like a person who knows what they're talking about and gets to the point.

Keep text direct, human, and in Dutch where the user sees it.
