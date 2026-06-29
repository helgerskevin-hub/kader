# Crypto Copy-Trading — App Context (for Claude Design)

This file is a single, self-contained context for design work on the
**Crypto Copy-Trading** app (new UI designs, app icon, splash, store/promo
screenshots, component redesigns). A longer Dutch version lives in
`docs/app-beschrijving-voor-claude-design.md`.

> ⚠️ The app gives **no financial advice** — it produces technical signals to
> support the user's own research. Keep the tone sober and helpful, never
> hype-y ("to the moon"). The UI language is **Dutch**.

---

## 1. What the app is

A **personal Android app** (Capacitor 6 / WebView, sideloaded — not on the Play
Store) that helps a crypto investor:

1. **Analyse the market** and generate promising trades with a pre-computed
   entry, stop-loss and take-profit (minimum 1:2 risk/reward).
2. **Evaluate eToro traders** (Popular Investors) and see their current
   portfolio so positions can be copied ("copy trading").
3. **Track their own open positions** with a live SELL / HOLD / TAKE-PROFIT tip.
4. **Get push notifications** when a take-profit can be raised or it's better to
   exit early.

All analysis runs **on the device** (no server). Only fresh market data is
fetched live from free public sources (**Binance** + **CoinGecko**). Traders and
trades are stored locally (`localStorage`).

There is also a **desktop/dev companion** (a Python stdlib HTTP-server app in
`src/`) used to run the same analysis from a browser at `http://localhost:8765`.

- **App id / name:** `com.kevinhelgers.cryptocopytrading` — "Crypto Copy-Trading"
- **Platform:** Android (Capacitor 6, WebView). One HTML/CSS/JS frontend.
- **Interface language:** Dutch.

---

## 2. Tech stack & repo layout

| Part | Tech |
|------|------|
| Mobile app | Capacitor 6 (`@capacitor/core`, `@capacitor/android`, `@capacitor/local-notifications`), single-page HTML/CSS/JS in `mobile/www` |
| Desktop/dev tool | Python (stdlib `http.server`) in `src/` — `app.py`, `app_ui.py`, `crypto_analyzer.py`, `etoro_auditor.py`, `coin_info.py`, `daily_report.py` |
| Market data | Binance + CoinGecko (free public APIs) |
| Storage | `localStorage` (trades, traders, settings) |
| Notifications | Native Android via `@capacitor/local-notifications` |

```
mobile/        Capacitor Android app (www = the live frontend)
src/           Python analysis engine + stdlib HTTP-server dev UI
docs/          Plans + Dutch design-context doc
reports/       Generated daily reports
data/          Local data (gitignored)
```

---

## 3. Screens / navigation

Header: title "📊 Crypto Copy-Trading" + a live clock. Below it a main tab bar
with 3 tabs.

### Tab 1 — 🎯 Analyse (3 sub-tabs)
- **📊 Marktanalyse** — "🚀 Start Analyse" button. Per opportunity a card with:
  current price, entry zone, 🛑 stop-loss, 🎯 take-profit, risk/reward, signal
  score + RSI, a buy-advice badge, and an expandable "ℹ️ Over deze coin" block.
  Per-card buttons: "✅ Getrade" and "✏️ Aanpassen".
- **👥 Traders kopiëren** — each saved trader's current positions in a table
  with live entry/stop/take-profit; per row a "✅ Getrade" button.
- **🚀 Grote kansen** — scans hundreds of coins for momentum / low market cap /
  recovery room. Speculative candidates with a clear risk warning.

### Tab 2 — 📈 Mijn Trades
- Form to add a trade: Symbol, Amount (optional), Entry, Stop-loss, Take-profit.
- **🔔 Push-notifications card**: on/off toggle ("check every 10 min") + test
  button, explanation, and a timestamp of the last check.
- **Summary card** (5 cells): Open positions · Invested · Current value ·
  Total P/L · Action needed.
- "Auto-refresh (1 min)" option + "🔄 Prijzen vernieuwen" button.
- **Open positions** as cards: live price, your entry, result (P/L % and €),
  🛑 stop / 🎯 target, a progress bar (entry → take-profit), and a tip with an
  advice badge (VERKOOP NU / NEEM WINST / OVERWEEG WINST / HOUD VAST / LET OP).
  Buttons: "✓ Gesloten markeren" and "verwijderen".
- **Closed** positions in a table.

### Tab 3 — 👥 eToro Traders
- Form to score a trader: name, eToro Risk Score (1–7), monthly returns, max
  drawdown, yearly return, portfolio allocation.
- Result cards with 🟢/🟡/🔴 verdict, total score /100, recommended **Copy Stop
  Loss (%)**, and an explanation (consistency, risk, portfolio).

---

## 4. Push notifications (every 10 min)

Every 10 minutes the app checks open trades and sends a native notification in
two cases:

1. **🎯 Raise take-profit** — price nears/exceeds the take-profit while momentum
   is still strong (uptrend, MACD bullish, RSI not yet extreme). Includes the
   suggested higher take-profit + a short why.
2. **🛑 Raise stop-loss / "exit earlier"** — you're in profit but momentum
   flattens or turns (RSI overbought, MACD bearish, or trend broken). Includes
   the suggested higher stop-loss with the message "Stap eerder uit" and reason.

To avoid spam, the same alert repeats at most once per ~6 hours unless the
suggested level changes by >2%.

---

## 5. Visual style (current)

Dark, tight "fintech/dashboard" theme. Designs may refine this or propose a
nicer version. Current tokens:

| Role | Color |
|------|-------|
| Background | `#0e1117` |
| Panels/cards | `#161b22` / `#1c2230` |
| Borders/lines | `#2a3140` |
| Text | `#e6edf3` |
| Dimmed text | `#8b949e` |
| Accent (blue) | `#3b82f6` / `#2563eb` |
| Green (profit/buy) | `#22c55e` |
| Red (loss/stop) | `#ef4444` |
| Orange (caution) | `#f59e0b` |

- **Typography:** system sans (-apple-system / Segoe UI / Roboto), ~15px base,
  tabular-nums for numbers/prices.
- **Shape:** rounded corners (cards ~13px, buttons ~9px), soft 1px borders,
  subtle gradients on header and summary card.
- **Badges/pills:** colored status labels (green/yellow/red/blue/orange/grey)
  on matching dark backgrounds with a border.
- **Icons:** emoji as lightweight icons (📊 🎯 📈 👥 🚀 🛑 🔔 ✅).
- **Components:** card grid (auto-fill, min 300px), data tables with horizontal
  scroll on mobile, progress bar, bottom toast messages.
- **Mobile-first:** safe-area padding (notch), sticky header + tab bar.

---

## 6. Tone of voice

Sober, helpful, Dutch, not hype-y. Always carry the disclaimer that this is
**not financial advice** and that the user must check the live price on eToro
before placing an order.

---

## 7. Possible design briefs

- A **modern redesign** of the three main screens (Analyse, Mijn Trades, eToro
  Traders) in the same dark fintech style, but more refined.
- An **app icon** ("Crypto Copy-Trading") and splash screen.
- A polished design for the **push-notification card** and the notifications.
- A **trade-card** hero component (live price, entry→take-profit progress bar,
  advice badge).
- A set of **store/promo screenshots**.
