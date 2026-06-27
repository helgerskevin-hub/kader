/* engine.js
 * =========
 * Client-side JavaScript port of the Python analysis backend
 * (crypto_analyzer.py + coin_info.py + etoro_auditor.py + app.py API-laag).
 *
 * Alle marktdata komt van GRATIS publieke endpoints (Binance + CoinGecko).
 * Er is geen server meer nodig: de hele analyse draait op het toestel zelf.
 * Opslag van traders/trades gebeurt lokaal in localStorage.
 *
 * In de Capacitor-app worden fetch-calls via de native HTTP-laag (CapacitorHttp)
 * uitgevoerd, zodat er geen CORS-beperkingen zijn.
 */
(function () {
  "use strict";

  // -------------------------------------------------------------------------
  // CONFIGURATIE  (1-op-1 uit crypto_analyzer.py)
  // -------------------------------------------------------------------------
  const STANDAARD_UNIVERSUM = [
    "BTC", "ETH", "SOL", "BNB", "XRP", "ADA", "AVAX", "DOGE",
    "LINK", "DOT", "MATIC", "LTC", "ATOM", "NEAR", "ARB", "OP",
    "INJ", "SUI", "APT", "TIA", "RNDR", "FET", "SEI", "AAVE",
  ];

  const BINANCE_BASES = [
    "https://api.binance.com",
    "https://data-api.binance.vision",
    "https://api1.binance.com",
    "https://api.binance.us",
  ];

  const COINGECKO_BASE = "https://api.coingecko.com/api/v3";

  const COINGECKO_IDS = {
    BTC: "bitcoin", ETH: "ethereum", SOL: "solana", BNB: "binancecoin",
    XRP: "ripple", ADA: "cardano", AVAX: "avalanche-2", DOGE: "dogecoin",
    LINK: "chainlink", DOT: "polkadot", MATIC: "matic-network",
    LTC: "litecoin", ATOM: "cosmos", NEAR: "near", ARB: "arbitrum",
    OP: "optimism", INJ: "injective-protocol", SUI: "sui",
    APT: "aptos", TIA: "celestia", RNDR: "render-token",
    FET: "fetch-ai", SEI: "sei-network", AAVE: "aave",
  };

  const RSI_PERIODE = 14;
  const EMA_KORT = 20;
  const EMA_LANG = 50;
  const ATR_PERIODE = 14;
  const VOLUME_GEMIDDELDE_PERIODE = 20;

  const ATR_STOP_MULTIPLIER = 1.5;
  const MIN_RISK_REWARD = 2.0;
  const REWARD_MULTIPLIER = 3.0;

  const HIGH_CONVICTION_SCORE = 75;
  const HTTP_TIMEOUT = 15000;

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  // -------------------------------------------------------------------------
  // DATA OPHALEN
  // -------------------------------------------------------------------------
  async function httpGetJson(url, timeout) {
    timeout = timeout || HTTP_TIMEOUT;
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeout);
    try {
      const r = await fetch(url, {
        signal: ctrl.signal,
        headers: { Accept: "application/json" },
      });
      if (r.status === 200) return await r.json();
    } catch (e) {
      return null;
    } finally {
      clearTimeout(t);
    }
    return null;
  }

  // DataFrame-vervanger: een object met parallelle arrays.
  function maakDf(rows) {
    // rows: array of [open, high, low, close, volume]
    return {
      open: rows.map((r) => r[0]),
      high: rows.map((r) => r[1]),
      low: rows.map((r) => r[2]),
      close: rows.map((r) => r[3]),
      volume: rows.map((r) => r[4]),
      length: rows.length,
    };
  }

  async function haalBinanceKlines(symbool, interval, limit) {
    interval = interval || "1d";
    limit = limit || 200;
    const pair = symbool + "USDT";
    for (const base of BINANCE_BASES) {
      const url =
        base + "/api/v3/klines?symbol=" + pair + "&interval=" + interval +
        "&limit=" + limit;
      const data = await httpGetJson(url);
      if (Array.isArray(data) && data.length > EMA_LANG) {
        const rows = [];
        for (const k of data) {
          const o = parseFloat(k[1]);
          const h = parseFloat(k[2]);
          const l = parseFloat(k[3]);
          const c = parseFloat(k[4]);
          const v = parseFloat(k[5]);
          if (isFinite(o) && isFinite(h) && isFinite(l) && isFinite(c)) {
            rows.push([o, h, l, c, isFinite(v) ? v : 0]);
          }
        }
        if (rows.length > EMA_LANG) return maakDf(rows);
      }
    }
    return null;
  }

  async function haalCoingeckoOhlc(symbool, days) {
    days = days || 30;
    const cgId = COINGECKO_IDS[symbool];
    if (!cgId) return null;
    const url =
      COINGECKO_BASE + "/coins/" + cgId + "/ohlc?vs_currency=usd&days=" + days;
    const data = await httpGetJson(url);
    if (Array.isArray(data) && data.length > EMA_LANG) {
      // [time, open, high, low, close]; geen volume -> 0
      const rows = data.map((d) => [d[1], d[2], d[3], d[4], 0]);
      return maakDf(rows);
    }
    return null;
  }

  async function haalData(symbool) {
    let df = await haalBinanceKlines(symbool);
    if (df && df.length > EMA_LANG) return { df: df, bron: "Binance" };
    df = await haalCoingeckoOhlc(symbool);
    if (df && df.length > EMA_LANG) {
      return { df: df, bron: "CoinGecko (fallback)" };
    }
    return { df: null, bron: "geen" };
  }

  // -------------------------------------------------------------------------
  // INDICATOREN
  // Recursieve EMA (adjust=False). Voor RSI/ATR gebruiken we de Wilder-variant
  // (alpha = 1/periode). Over 200 candles convergeert dit volledig en levert
  // het dezelfde slotwaarden als de pandas-implementatie.
  // -------------------------------------------------------------------------
  function emaArray(values, period, alpha) {
    if (!values.length) return [];
    const a = alpha != null ? alpha : 2 / (period + 1);
    let prev = values[0];
    const out = [prev];
    for (let i = 1; i < values.length; i++) {
      prev = (1 - a) * prev + a * values[i];
      out.push(prev);
    }
    return out;
  }

  function laatste(arr) {
    return arr.length ? arr[arr.length - 1] : NaN;
  }

  function berekenRsi(close, periode) {
    periode = periode || RSI_PERIODE;
    if (close.length < 2) return 50;
    const gains = [];
    const losses = [];
    for (let i = 1; i < close.length; i++) {
      const d = close[i] - close[i - 1];
      gains.push(d > 0 ? d : 0);
      losses.push(d < 0 ? -d : 0);
    }
    const avgG = laatste(emaArray(gains, periode, 1 / periode));
    const avgL = laatste(emaArray(losses, periode, 1 / periode));
    if (avgL === 0) return 100;
    const rs = avgG / avgL;
    const rsi = 100 - 100 / (1 + rs);
    return isFinite(rsi) ? rsi : 50;
  }

  function berekenEma(close, periode) {
    return emaArray(close, periode);
  }

  function berekenMacd(close, snel, traag, signaal) {
    snel = snel || 12;
    traag = traag || 26;
    signaal = signaal || 9;
    const emaSnel = emaArray(close, snel);
    const emaTraag = emaArray(close, traag);
    const macdLijn = emaSnel.map((v, i) => v - emaTraag[i]);
    const signaalLijn = emaArray(macdLijn, signaal);
    const hist = macdLijn.map((v, i) => v - signaalLijn[i]);
    return { macdLijn: macdLijn, signaalLijn: signaalLijn, hist: hist };
  }

  function berekenAtr(df, periode) {
    periode = periode || ATR_PERIODE;
    const tr = [];
    for (let i = 0; i < df.length; i++) {
      const hl = df.high[i] - df.low[i];
      if (i === 0) {
        tr.push(hl);
      } else {
        const hc = Math.abs(df.high[i] - df.close[i - 1]);
        const lc = Math.abs(df.low[i] - df.close[i - 1]);
        tr.push(Math.max(hl, hc, lc));
      }
    }
    return emaArray(tr, periode, 1 / periode);
  }

  // -------------------------------------------------------------------------
  // ANALYSE PER COIN
  // -------------------------------------------------------------------------
  async function analyseerCoin(symbool) {
    const { df, bron } = await haalData(symbool);
    if (!df || df.length < EMA_LANG + 5) return null;

    const close = df.close;
    const prijs = close[close.length - 1];

    const rsiNu = berekenRsi(close);
    const ema20Arr = berekenEma(close, EMA_KORT);
    const ema50Arr = berekenEma(close, EMA_LANG);
    const macd = berekenMacd(close);
    const atrArr = berekenAtr(df);

    const ema20Nu = laatste(ema20Arr);
    const ema50Nu = laatste(ema50Arr);
    const macdNu = laatste(macd.macdLijn);
    const signaalNu = laatste(macd.signaalLijn);
    const histNu = laatste(macd.hist);
    let atrNu = laatste(atrArr);
    if (!isFinite(atrNu)) atrNu = prijs * 0.03;

    let volumeRatio = 1.0;
    const volSom = df.volume.reduce((a, b) => a + b, 0);
    if (volSom > 0) {
      const staart = df.volume.slice(-VOLUME_GEMIDDELDE_PERIODE);
      const volGem = staart.reduce((a, b) => a + b, 0) / staart.length;
      const volNu = df.volume[df.volume.length - 1];
      volumeRatio = volGem > 0 ? volNu / volGem : 1.0;
    }

    let score = 0;
    const redenen = [];

    if (ema20Nu > ema50Nu) {
      score += 25;
      redenen.push("opwaartse trend (EMA20>EMA50)");
    }
    if (prijs > ema20Nu) {
      score += 15;
      redenen.push("prijs boven EMA20");
    }
    if (rsiNu >= 45 && rsiNu <= 68) {
      score += 20;
      redenen.push("RSI gezond (" + Math.round(rsiNu) + ")");
    } else if (rsiNu < 35) {
      score += 10;
      redenen.push("RSI oversold (" + Math.round(rsiNu) + ") - mogelijke bounce");
    }
    if (macdNu > signaalNu) {
      score += 20;
      redenen.push("MACD bullish");
      if (histNu > 0) score += 5;
    }
    if (volumeRatio >= 1.5) {
      score += 15;
      redenen.push("volume spike (" + volumeRatio.toFixed(1) + "x)");
    } else if (volumeRatio >= 1.2) {
      score += 8;
      redenen.push("verhoogd volume (" + volumeRatio.toFixed(1) + "x)");
    }
    score = Math.min(score, 100);

    const entry = prijs;
    const risk = ATR_STOP_MULTIPLIER * atrNu;
    const stopLoss = entry - risk;
    const takeProfit = entry + REWARD_MULTIPLIER * atrNu;
    const reward = takeProfit - entry;
    const rr = risk > 0 ? reward / risk : 0.0;

    const entryLaag = entry - 0.2 * atrNu;
    const entryHoog = entry + 0.2 * atrNu;

    if (rr < MIN_RISK_REWARD - 1e-9) return null;

    const signaalTekst = score >= 55 ? "KOOP" : "WATCH";
    const highConviction =
      score >= HIGH_CONVICTION_SCORE &&
      ema20Nu > ema50Nu &&
      macdNu > signaalNu &&
      volumeRatio >= 1.3;

    return {
      symbool: symbool,
      bron: bron,
      prijs: prijs,
      entry: entry,
      entry_laag: entryLaag,
      entry_hoog: entryHoog,
      stop_loss: stopLoss,
      take_profit: takeProfit,
      rr: rr,
      atr: atrNu,
      rsi: rsiNu,
      ema20: ema20Nu,
      ema50: ema50Nu,
      macd_bullish: macdNu > signaalNu,
      volume_ratio: volumeRatio,
      score: score,
      redenen: redenen,
      signaal: signaalTekst,
      high_conviction: highConviction,
    };
  }

  async function analyseerMarkt(universum, topN, onProgress) {
    universum = universum || STANDAARD_UNIVERSUM;
    topN = topN || 10;
    const resultaten = [];
    for (let i = 0; i < universum.length; i++) {
      const sym = universum[i];
      if (onProgress) onProgress(i + 1, universum.length, sym);
      try {
        const res = await analyseerCoin(sym);
        if (res) resultaten.push(res);
      } catch (e) {
        /* coin overslaan */
      }
      await sleep(120);
    }
    resultaten.sort((a, b) => {
      if (a.high_conviction !== b.high_conviction) {
        return (b.high_conviction ? 1 : 0) - (a.high_conviction ? 1 : 0);
      }
      if (b.score !== a.score) return b.score - a.score;
      return b.rr - a.rr;
    });
    const limiet = Math.max(5, topN);
    return resultaten.length >= 5 ? resultaten.slice(0, limiet) : resultaten;
  }

  // -------------------------------------------------------------------------
  // GROTE-KANSEN-SCANNER
  // -------------------------------------------------------------------------
  const UITSLUITEN = new Set([
    "USDT", "USDC", "DAI", "TUSD", "FDUSD", "USDE", "PYUSD", "USDD", "BUSD",
    "GUSD", "FRAX", "LUSD", "USDS", "USD0", "WBTC", "WETH", "STETH", "WSTETH",
    "WEETH", "WBETH", "RETH", "CBETH", "BSC-USD", "SOLVBTC", "LBTC",
  ]);

  async function haalCoingeckoMarkten(perPage) {
    perPage = perPage || 250;
    const url =
      COINGECKO_BASE +
      "/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=" +
      perPage +
      "&page=1&price_change_percentage=24h,7d,30d";
    const data = await httpGetJson(url);
    return Array.isArray(data) ? data : [];
  }

  function kansScore(c) {
    const p7 = c.price_change_percentage_7d_in_currency || 0;
    const p30 = c.price_change_percentage_30d_in_currency || 0;
    const p24 = c.price_change_percentage_24h_in_currency || 0;
    const vol = c.total_volume || 0;
    const mcap = c.market_cap || 1;
    const rank = c.market_cap_rank || 999;
    const athChg = c.ath_change_percentage || 0;

    let score = 0.0;
    score += Math.max(Math.min(p7, 40), -20) * 1.2;
    score += Math.max(Math.min(p30, 80), -30) * 0.5;
    const volratio = mcap ? vol / mcap : 0;
    score += Math.min(volratio * 100, 25);
    if (athChg < 0) score += Math.min(Math.abs(athChg) * 0.15, 20);
    if (rank > 50) score += 10;
    if (rank > 120) score += 5;
    if (p24 > 35) score -= 25;
    else if (p24 > 20) score -= 10;
    return score;
  }

  function waaromKans(c) {
    const p7 = c.price_change_percentage_7d_in_currency || 0;
    const p30 = c.price_change_percentage_30d_in_currency || 0;
    const vol = c.total_volume || 0;
    const mcap = c.market_cap || 1;
    const rank = c.market_cap_rank || 999;
    const athChg = c.ath_change_percentage || 0;
    const r = [];
    if (p7 >= 12) r.push("sterk momentum: +" + Math.round(p7) + "% in 7 dagen");
    else if (p7 >= 4) r.push("opwaarts: +" + Math.round(p7) + "% in 7 dagen");
    if (p30 >= 25) r.push("+" + Math.round(p30) + "% over 30 dagen — trend intact");
    if (mcap && vol / mcap >= 0.12) {
      r.push("hoge handelsactiviteit t.o.v. marktcap (groeiende interesse)");
    }
    if (athChg <= -55) {
      r.push(Math.round(Math.abs(athChg)) + "% onder all-time high — veel herstelruimte");
    }
    if (rank >= 60) {
      r.push("kleinere marktcap (#" + rank + ") — meer ruimte om te groeien");
    }
    if (!r.length) {
      r.push("solide combinatie van momentum, liquiditeit en marktpositie");
    }
    return r;
  }

  async function kansNiveaus(symbool, prijsFallback) {
    const { df } = await haalData(symbool);
    if (df && df.length > ATR_PERIODE + 2) {
      const close = df.close;
      const prijs = close[close.length - 1];
      let atr = laatste(berekenAtr(df));
      if (!isFinite(atr) || atr <= 0) atr = prijs * 0.04;
      const ema20 = laatste(berekenEma(close, EMA_KORT));
      const ema50 = laatste(berekenEma(close, EMA_LANG));
      const macd = berekenMacd(close);
      const stop = prijs - ATR_STOP_MULTIPLIER * atr;
      const tp = prijs + REWARD_MULTIPLIER * atr;
      return {
        prijs: prijs,
        entry: prijs,
        stop_loss: stop,
        take_profit: tp,
        rr: prijs > stop ? Math.round(((tp - prijs) / (prijs - stop)) * 10) / 10 : 2.0,
        rsi: Math.round(berekenRsi(close)),
        trend_op: ema20 > ema50,
        macd_bullish: laatste(macd.macdLijn) > laatste(macd.signaalLijn),
        methode: "ATR (candle-data)",
        heeft_technisch: true,
      };
    }
    const prijs = parseFloat(prijsFallback || 0) || 0;
    return {
      prijs: prijs,
      entry: prijs,
      stop_loss: prijs * 0.875,
      take_profit: prijs * 1.25,
      rr: 2.0,
      rsi: null,
      trend_op: null,
      macd_bullish: null,
      methode: "richtlijn (−12,5% / +25%)",
      heeft_technisch: false,
    };
  }

  async function zoekKansen(topN, onProgress) {
    topN = topN || 10;
    const markten = await haalCoingeckoMarkten();
    const kandidaten = [];
    for (const c of markten) {
      const sym = (c.symbol || "").toUpperCase();
      const rank = c.market_cap_rank || 999;
      const vol = c.total_volume || 0;
      if (!sym || UITSLUITEN.has(sym)) continue;
      if (rank < 12 || rank > 260) continue;
      if (vol < 15000000) continue;
      c._score = kansScore(c);
      kandidaten.push(c);
    }
    kandidaten.sort((a, b) => b._score - a._score);

    const resultaten = [];
    for (const c of kandidaten) {
      if (resultaten.length >= topN) break;
      const sym = (c.symbol || "").toUpperCase();
      if (onProgress) onProgress(resultaten.length + 1, topN, sym);
      const niveaus = await kansNiveaus(sym, c.current_price);
      resultaten.push(
        Object.assign(
          {
            symbool: sym,
            naam: c.name || sym,
            rang: c.market_cap_rank,
            marktcap: c.market_cap,
            p24: Math.round((c.price_change_percentage_24h_in_currency || 0) * 10) / 10,
            p7: Math.round((c.price_change_percentage_7d_in_currency || 0) * 10) / 10,
            p30: Math.round((c.price_change_percentage_30d_in_currency || 0) * 10) / 10,
            redenen: waaromKans(c),
          },
          niveaus
        )
      );
      await sleep(120);
    }
    return resultaten;
  }

  // -------------------------------------------------------------------------
  // COIN-INFO  (uit coin_info.py)
  // -------------------------------------------------------------------------
  const COIN_INFO = {
    BTC: { naam: "Bitcoin", categorie: "Large-cap · digitaal goud", wat: "De eerste en grootste cryptomunt; schaars (max 21M) en wordt gezien als waardeopslag. De minst risicovolle crypto, maar ook de traagste groeier." },
    ETH: { naam: "Ethereum", categorie: "Large-cap · smart-contractplatform", wat: "Het grootste platform voor smart contracts en DeFi/NFT's. Fundament van een groot deel van de crypto-economie." },
    SOL: { naam: "Solana", categorie: "Layer-1 · snelle blockchain", wat: "Snelle, goedkope blockchain populair voor DeFi, NFT's en meme-coins. Hoger rendement maar volatieler dan ETH." },
    BNB: { naam: "BNB", categorie: "Exchange-token / Layer-1", wat: "Token van de Binance-exchange en BNB Chain; gebruikt voor handelskorting en gas. Sterk afhankelijk van Binance." },
    XRP: { naam: "XRP", categorie: "Payments", wat: "Gericht op snelle, goedkope grensoverschrijdende betalingen via Ripple. Koers reageert sterk op regelgeving/rechtszaken." },
    ADA: { naam: "Cardano", categorie: "Layer-1", wat: "Onderzoeksgedreven smart-contractplatform. Grote community, maar trage adoptie t.o.v. concurrenten." },
    AVAX: { naam: "Avalanche", categorie: "Layer-1", wat: "Snel Layer-1 met 'subnets' voor eigen blockchains. Concurreert met ETH en SOL voor DeFi en gaming." },
    DOGE: { naam: "Dogecoin", categorie: "Meme-coin", wat: "De originele meme-coin; beweegt vooral op sentiment en bekendheid (o.a. Elon Musk). Speculatief." },
    LINK: { naam: "Chainlink", categorie: "Oracle / infrastructuur", wat: "Levert externe data (oracles) aan smart contracts; cruciale infrastructuur voor DeFi. Brede adoptie." },
    DOT: { naam: "Polkadot", categorie: "Layer-0 · interoperabiliteit", wat: "Verbindt meerdere blockchains ('parachains'). Sterke techniek, maar adoptie blijft achter bij de hype." },
    MATIC: { naam: "Polygon", categorie: "Layer-2 (Ethereum)", wat: "Schaalt Ethereum met goedkopere/snellere transacties. Veel zakelijke partnerschappen. (Token migreert naar POL.)" },
    POL: { naam: "Polygon (POL)", categorie: "Layer-2 (Ethereum)", wat: "Het nieuwe token van Polygon (opvolger van MATIC) voor het geüpgradede netwerk." },
    LTC: { naam: "Litecoin", categorie: "Payments", wat: "Oude, stabiele 'zilver naast Bitcoins goud' voor snelle betalingen. Weinig innovatie, lage volatiliteit." },
    ATOM: { naam: "Cosmos", categorie: "Layer-0 · interoperabiliteit", wat: "'Internet of blockchains' dat netwerken laat communiceren (IBC). Sterke tech, zwakke token-waardevangst." },
    NEAR: { naam: "NEAR Protocol", categorie: "Layer-1", wat: "Gebruiksvriendelijk Layer-1 met focus op AI en eenvoudige apps. Mid-cap met groeipotentieel." },
    ARB: { naam: "Arbitrum", categorie: "Layer-2 (Ethereum)", wat: "Grootste Ethereum Layer-2 (rollup) met veel DeFi-activiteit. Goedkoper dan ETH-mainnet." },
    OP: { naam: "Optimism", categorie: "Layer-2 (Ethereum)", wat: "Ethereum Layer-2; de 'Superchain' (o.a. Coinbase's Base) bouwt op zijn techniek." },
    INJ: { naam: "Injective", categorie: "Layer-1 · DeFi/derivaten", wat: "Snelle blockchain gespecialiseerd in financiële apps en derivaten. Volatiel maar sterke verhalen." },
    SUI: { naam: "Sui", categorie: "Layer-1", wat: "Nieuw, snel Layer-1 (Move-taal) gericht op gaming en consumenten-apps. Hoog risico/rendement." },
    APT: { naam: "Aptos", categorie: "Layer-1", wat: "Layer-1 uit het oude Meta/Diem-team (Move-taal). Concurreert met Sui; speculatief." },
    TIA: { naam: "Celestia", categorie: "Modulair · data-beschikbaarheid", wat: "Pionier in 'modulaire' blockchains die andere ketens goedkope dataruimte bieden. Trendgevoelig." },
    RNDR: { naam: "Render", categorie: "AI / DePIN", wat: "Gedecentraliseerd netwerk voor GPU-rendering; profiteert van de AI- en grafische rekenvraag." },
    RENDER: { naam: "Render", categorie: "AI / DePIN", wat: "Gedecentraliseerd netwerk voor GPU-rendering; profiteert van de AI-trend (nieuwe ticker van RNDR)." },
    FET: { naam: "Artificial Superintelligence (FET)", categorie: "AI", wat: "Fusie van Fetch.ai, SingularityNET en Ocean — een toonaangevend AI-crypto-project. Zeer trendgevoelig." },
    SEI: { naam: "Sei", categorie: "Layer-1 · trading", wat: "Snel Layer-1 geoptimaliseerd voor handelsapps. Mid-cap, volatiel." },
    AAVE: { naam: "Aave", categorie: "DeFi · lenen", wat: "Grootste lenen-en-uitlenen-protocol in DeFi. Een 'blue chip' van DeFi met echt gebruik." },
    TAO: { naam: "Bittensor", categorie: "AI / DePIN", wat: "Gedecentraliseerd netwerk dat machine-learning beloont. Een van de sterkste AI-verhalen, zeer volatiel." },
    ONDO: { naam: "Ondo Finance", categorie: "RWA · tokenisatie", wat: "Brengt echte activa (staatsobligaties) on-chain. Boegbeeld van de 'real-world assets'-trend." },
    ENA: { naam: "Ethena", categorie: "DeFi · synthetische dollar", wat: "Achter de USDe 'synthetische dollar' met hoog rendement. Innovatief maar met eigen risico's." },
    JUP: { naam: "Jupiter", categorie: "DeFi (Solana)", wat: "Grootste handels-aggregator op Solana. Profiteert direct van Solana-activiteit." },
    PYTH: { naam: "Pyth Network", categorie: "Oracle / infrastructuur", wat: "Snelle prijs-oracle (concurrent van Chainlink), sterk op Solana en daarbuiten." },
    WIF: { naam: "dogwifhat", categorie: "Meme-coin (Solana)", wat: "Populaire Solana-meme-coin. Puur sentiment; kan hard stijgen én crashen. Zeer speculatief." },
    PEPE: { naam: "Pepe", categorie: "Meme-coin", wat: "Grote Ethereum-meme-coin zonder fundamentele waarde. Pure speculatie op hype." },
    BONK: { naam: "Bonk", categorie: "Meme-coin (Solana)", wat: "Solana-meme-coin. Extreem volatiel, sentimentgedreven." },
    FLOKI: { naam: "Floki", categorie: "Meme-coin", wat: "Meme-coin met marketing-/gaming-ambities. Speculatief." },
    SHIB: { naam: "Shiba Inu", categorie: "Meme-coin", wat: "Grote meme-coin met eigen ecosysteem (Shibarium). Sentimentgedreven." },
    JTO: { naam: "Jito", categorie: "DeFi (Solana) · staking", wat: "Liquid-staking en MEV op Solana. Groeit mee met het Solana-ecosysteem." },
    STX: { naam: "Stacks", categorie: "Bitcoin Layer-2", wat: "Brengt smart contracts naar Bitcoin. Profiteert van het 'Bitcoin DeFi'-narratief." },
    RUNE: { naam: "THORChain", categorie: "DeFi · cross-chain", wat: "Maakt het ruilen van native coins tussen ketens mogelijk zonder bridge. Nichefunctie, volatiel." },
    IMX: { naam: "Immutable", categorie: "Gaming / Layer-2", wat: "Layer-2 gespecialiseerd in blockchain-gaming en NFT's. Trendgevoelig (gaming-cyclus)." },
    GALA: { naam: "Gala", categorie: "Gaming", wat: "Platform voor blockchain-games. Sterk afhankelijk van de gaming-hype." },
    SAND: { naam: "The Sandbox", categorie: "Metaverse / gaming", wat: "Virtuele wereld/metaverse-project. Beweegt met de metaverse-trend." },
    MANA: { naam: "Decentraland", categorie: "Metaverse", wat: "Virtuele wereld met grond als NFT's. Metaverse-trendgevoelig." },
    FTM: { naam: "Fantom", categorie: "Layer-1", wat: "Snel Layer-1; vernieuwd als 'Sonic' (token S). Sterke developer-community." },
    S: { naam: "Sonic", categorie: "Layer-1", wat: "De opvolger/upgrade van Fantom — zeer snel Layer-1 voor DeFi." },
    ALGO: { naam: "Algorand", categorie: "Layer-1", wat: "Energiezuinig Layer-1 met focus op betalingen en instituties. Trage koersgroei." },
    HBAR: { naam: "Hedera", categorie: "Enterprise DLT", wat: "Bedrijfsgericht netwerk (hashgraph) met grote partners. Anders dan een klassieke blockchain." },
    VET: { naam: "VeChain", categorie: "Supply-chain", wat: "Gericht op toeleveringsketen- en bedrijfsdata. Niche met zakelijke partners." },
    GRT: { naam: "The Graph", categorie: "Infrastructuur / data", wat: "'Google van blockchains' — indexeert on-chain data voor apps. Infrastructuur." },
    UNI: { naam: "Uniswap", categorie: "DeFi · exchange", wat: "Grootste gedecentraliseerde exchange (DEX) op Ethereum. DeFi blue chip." },
    MKR: { naam: "Maker / Sky", categorie: "DeFi · stablecoin", wat: "Achter de DAI-stablecoin; een van de oudste DeFi-protocollen. Lage volatiliteit voor crypto." },
    LDO: { naam: "Lido", categorie: "DeFi · staking", wat: "Grootste liquid-staking-protocol voor ETH. Beweegt met ETH-staking-vraag." },
    CRV: { naam: "Curve", categorie: "DeFi · exchange", wat: "DEX gespecialiseerd in stablecoin-ruil. Kernstuk van DeFi, maar token onder druk." },
    DYDX: { naam: "dYdX", categorie: "DeFi · derivaten", wat: "Gedecentraliseerd platform voor perpetual-futures. Volatiel." },
    WLD: { naam: "Worldcoin", categorie: "Identiteit / AI", wat: "Digitaal identiteits- en token-project (Sam Altman). Veel hype én privacy-discussie." },
    ORDI: { naam: "ORDI", categorie: "Bitcoin (Ordinals)", wat: "Eerste grote 'BRC-20'-token op Bitcoin. Zeer speculatief, trendgevoelig." },
    TRX: { naam: "TRON", categorie: "Layer-1", wat: "Layer-1 met veel stablecoin-verkeer (USDT). Stabiele cashflow, gecentraliseerd." },
    TON: { naam: "Toncoin", categorie: "Layer-1", wat: "Blockchain verbonden met Telegram; profiteert van Telegram's enorme gebruikersbasis." },
    KAS: { naam: "Kaspa", categorie: "Layer-1 · proof-of-work", wat: "Zeer snel proof-of-work-netwerk (blockDAG). Populair groeiverhaal, volatiel." },
  };

  function infoVoor(symbool) {
    const sym = (symbool || "").toUpperCase();
    if (COIN_INFO[sym]) return COIN_INFO[sym];
    if (["CASH", "USD", "USDT", "USDC", "DAI"].indexOf(sym) !== -1) {
      return {
        naam: sym,
        categorie: "Stablecoin / cash",
        wat: "Stabiele waarde (≈$1). Geen koerswinst — dient als veilige buffer.",
      };
    }
    return {
      naam: sym,
      categorie: "Onbekend",
      wat:
        "Geen profielinfo beschikbaar. Doe altijd je eigen onderzoek (DYOR) " +
        "naar het project, het team en het nut voordat je koopt.",
    };
  }

  function genereerKoopadvies(opt) {
    opt = opt || {};
    const score = opt.score != null ? opt.score : null;
    const rsi = opt.rsi != null ? opt.rsi : 50;
    const trendOp = !!opt.trend_op;
    const macdBullish = !!opt.macd_bullish;
    const volumeRatio = opt.volume_ratio != null ? opt.volume_ratio : 1.0;
    const highConviction = !!opt.high_conviction;

    const plus = [];
    const aandacht = [];

    if (trendOp) plus.push("opwaartse trend (EMA20 boven EMA50)");
    else aandacht.push("geen opwaartse trend (EMA20 onder EMA50)");

    if (macdBullish) plus.push("positief momentum (MACD bullish)");
    else aandacht.push("zwak momentum (MACD bearish)");

    if (rsi >= 45 && rsi <= 68) plus.push("gezonde RSI (" + Math.round(rsi) + ")");
    else if (rsi > 72)
      aandacht.push("overbought RSI (" + Math.round(rsi) + ") — verhoogde kans op terugval");
    else if (rsi < 35)
      aandacht.push("oversold RSI (" + Math.round(rsi) + ") — mogelijk bounce, maar riskant");

    if (volumeRatio >= 1.5) plus.push("sterke volume-spike (" + volumeRatio.toFixed(1) + "×)");
    else if (volumeRatio >= 1.2) plus.push("verhoogd volume (" + volumeRatio.toFixed(1) + "×)");

    const s =
      score != null
        ? score
        : (trendOp ? 25 : 0) +
          (macdBullish ? 20 : 0) +
          (rsi >= 45 && rsi <= 68 ? 20 : 0) +
          (volumeRatio >= 1.3 ? 15 : 0);

    let label, kleur;
    if (highConviction || s >= 72) {
      label = "Sterke koop";
      kleur = "groen";
    } else if (s >= 55) {
      label = "Koopwaardig";
      kleur = "groen";
    } else if (s >= 40) {
      label = "Neutraal — wacht op bevestiging";
      kleur = "oranje";
    } else {
      label = "Zwak — nu niet kopen";
      kleur = "rood";
    }

    let uitleg = "";
    if (plus.length) uitleg += "✅ " + plus.join(", ") + ". ";
    if (aandacht.length) uitleg += "⚠️ " + aandacht.join(", ") + ".";
    return { label: label, kleur: kleur, uitleg: uitleg.trim() };
  }

  // -------------------------------------------------------------------------
  // ETORO-AUDITOR  (uit etoro_auditor.py)
  // -------------------------------------------------------------------------
  const CORRELATIE_GROEPEN = {
    "Large-cap": new Set(["BTC", "ETH"]),
    "Layer-1 alts": new Set(["SOL", "AVAX", "NEAR", "ADA", "DOT", "ATOM", "SUI", "APT", "SEI", "TIA"]),
    "Layer-2": new Set(["ARB", "OP", "MATIC"]),
    DeFi: new Set(["AAVE", "LINK", "INJ", "UNI"]),
    Meme: new Set(["DOGE", "SHIB", "PEPE"]),
    AI: new Set(["FET", "RNDR", "TAO"]),
  };

  function classificeerAsset(sym) {
    sym = (sym || "").toUpperCase();
    for (const groep in CORRELATIE_GROEPEN) {
      if (CORRELATIE_GROEPEN[groep].has(sym)) return groep;
    }
    if (["CASH", "USD", "USDT", "USDC"].indexOf(sym) !== -1) return "Cash";
    return "Overig";
  }

  function mean(arr) {
    return arr.reduce((a, b) => a + b, 0) / arr.length;
  }
  function pstdev(arr) {
    if (arr.length < 2) return 0.0;
    const m = mean(arr);
    const v = arr.reduce((a, b) => a + (b - m) * (b - m), 0) / arr.length;
    return Math.sqrt(v);
  }

  function analyseConsistentie(maandrendementen) {
    if (!maandrendementen || !maandrendementen.length) {
      return { score: 0, positief_pct: 0, stdev: 0, opmerking: "Geen maanddata aangeleverd." };
    }
    const positief = maandrendementen.filter((r) => r > 0).length;
    const positiefPct = (100 * positief) / maandrendementen.length;
    const stdev = maandrendementen.length > 1 ? pstdev(maandrendementen) : 0.0;
    const gem = mean(maandrendementen);
    const slechtste = Math.min.apply(null, maandrendementen);

    let score = 0;
    score += Math.min(50, positiefPct * 0.5);
    if (stdev > 0) {
      const sharpeAchtig = gem / stdev;
      score += Math.max(0, Math.min(30, sharpeAchtig * 15));
    } else {
      score += 20;
    }
    if (slechtste > -10) score += 20;
    else if (slechtste > -20) score += 10;

    let opm;
    if (positiefPct >= 65 && stdev < 8) opm = "Zeer consistent: stabiele maand-op-maand winst.";
    else if (positiefPct >= 50) opm = "Redelijk consistent, maar met enige schommeling.";
    else opm = "Inconsistent: rendement lijkt afhankelijk van enkele uitschieters.";

    return {
      score: Math.round(Math.min(score, 100)),
      positief_pct: Math.round(positiefPct),
      stdev: Math.round(stdev * 10) / 10,
      gem_maand: Math.round(gem * 100) / 100,
      slechtste_maand: Math.round(slechtste * 10) / 10,
      opmerking: opm,
    };
  }

  function analyseRisico(maandrendementen, maxDrawdown, jaarrendement, riskScore) {
    if ((jaarrendement === null || jaarrendement === undefined) && maandrendementen && maandrendementen.length) {
      let factor = 1.0;
      for (const r of maandrendementen) factor *= 1 + r / 100;
      jaarrendement = (factor - 1) * 100;
    }
    jaarrendement = jaarrendement || 0.0;
    const dd = Math.max(maxDrawdown, 0.1);
    const ratio = jaarrendement / dd;

    let score = 0;
    let opm;
    if (ratio >= 2) {
      score += 50;
      opm = "Uitstekend: rendement rechtvaardigt het risico ruimschoots.";
    } else if (ratio >= 1) {
      score += 35;
      opm = "Gezond: rendement weegt op tegen de drawdown.";
    } else if (ratio >= 0.5) {
      score += 20;
      opm = "Matig: er wordt veel risico genomen voor het rendement.";
    } else {
      score += 5;
      opm = "Zwak: drawdown te hoog t.o.v. rendement.";
    }
    if (riskScore <= 3) score += 30;
    else if (riskScore <= 5) score += 20;
    else score += 5;

    if (dd <= 25) score += 20;
    else if (dd <= 40) score += 10;

    return {
      score: Math.round(Math.min(score, 100)),
      jaarrendement: Math.round(jaarrendement * 10) / 10,
      max_drawdown: Math.round(dd * 10) / 10,
      ratio: Math.round(ratio * 100) / 100,
      risk_score: riskScore,
      opmerking: opm,
    };
  }

  function analysePortfolio(portfolio) {
    if (!portfolio || !Object.keys(portfolio).length) {
      return { score: 50, opmerking: "Geen portfolio-data aangeleverd.", grootste_positie: 0, groep_concentratie: {} };
    }
    const waarden = Object.values(portfolio);
    const totaal = waarden.reduce((a, b) => a + b, 0) || 100;
    const genormaliseerd = {};
    for (const k in portfolio) genormaliseerd[k] = (100 * portfolio[k]) / totaal;

    let cash = 0;
    for (const k in genormaliseerd) {
      if (classificeerAsset(k) === "Cash") cash += genormaliseerd[k];
    }

    const groepConc = {};
    for (const sym in genormaliseerd) {
      const groep = classificeerAsset(sym);
      if (groep === "Cash") continue;
      groepConc[groep] = (groepConc[groep] || 0) + genormaliseerd[sym];
    }

    let grootstePositie = 0;
    for (const k in genormaliseerd) {
      if (classificeerAsset(k) !== "Cash") grootstePositie = Math.max(grootstePositie, genormaliseerd[k]);
    }
    const groepWaarden = Object.values(groepConc);
    const grootsteGroep = groepWaarden.length ? Math.max.apply(null, groepWaarden) : 0;
    const nGroepen = Object.keys(groepConc).length;

    let score = 100;
    const opmerkingen = [];

    if (grootstePositie > 50) {
      score -= 30;
      opmerkingen.push("zeer geconcentreerd in één asset (" + Math.round(grootstePositie) + "%)");
    } else if (grootstePositie > 35) {
      score -= 15;
      opmerkingen.push("flinke enkele positie (" + Math.round(grootstePositie) + "%)");
    }

    if (grootsteGroep > 60) {
      score -= 25;
      opmerkingen.push("sterk gecorreleerd cluster (" + Math.round(grootsteGroep) + "% in één groep)");
    } else if (grootsteGroep > 45) {
      score -= 12;
      opmerkingen.push("matige correlatie-concentratie (" + Math.round(grootsteGroep) + "%)");
    }

    if (nGroepen >= 3) score += 5;
    else if (nGroepen <= 1) {
      score -= 10;
      opmerkingen.push("nauwelijks spreiding over categorieën");
    }

    if (cash >= 10) opmerkingen.push("gezonde cash-buffer (" + Math.round(cash) + "%)");

    score = Math.max(0, Math.min(score, 100));
    if (!opmerkingen.length) opmerkingen.push("goed gespreide portefeuille");

    const groepConcRound = {};
    for (const k in groepConc) groepConcRound[k] = Math.round(groepConc[k]);

    return {
      score: Math.round(score),
      grootste_positie: Math.round(grootstePositie),
      grootste_groep: Math.round(grootsteGroep),
      cash: Math.round(cash),
      groep_concentratie: groepConcRound,
      opmerking: opmerkingen.join("; "),
    };
  }

  function beoordeelTrader(trader) {
    const cons = analyseConsistentie(trader.maandrendementen || []);
    const risk = analyseRisico(
      trader.maandrendementen || [],
      trader.max_drawdown || 0,
      trader.jaarrendement != null ? trader.jaarrendement : null,
      trader.risk_score != null ? trader.risk_score : 4
    );
    const port = analysePortfolio(trader.portfolio || {});

    const totaal = Math.round(0.35 * cons.score + 0.4 * risk.score + 0.25 * port.score);

    let oordeel, kleur;
    if (totaal >= 70) {
      oordeel = "GROEN";
      kleur = "green";
    } else if (totaal >= 50) {
      oordeel = "GEEL";
      kleur = "yellow";
    } else {
      oordeel = "ROOD";
      kleur = "red";
    }

    const dd = risk.max_drawdown;
    let csl;
    if (oordeel === "GROEN") csl = Math.min(40, Math.max(20, Math.round((dd * 1.2) / 5) * 5));
    else if (oordeel === "GEEL") csl = Math.min(30, Math.max(15, Math.round((dd * 1.0) / 5) * 5));
    else csl = Math.min(20, Math.max(10, Math.round((dd * 0.6) / 5) * 5));

    return {
      naam: trader.naam || "Onbekend",
      consistentie: cons,
      risico: risk,
      portfolio: port,
      totaalscore: totaal,
      oordeel: oordeel,
      kleur: kleur,
      csl: csl,
    };
  }

  // -------------------------------------------------------------------------
  // LIVE INDICATOREN + TRADE-ADVIES  (uit app.py)
  // -------------------------------------------------------------------------
  function fmt(p) {
    if (p == null) return "—";
    if (p >= 100) return "$" + p.toLocaleString("en-US", { maximumFractionDigits: 2 });
    if (p >= 1) return "$" + p.toFixed(3);
    return "$" + p.toFixed(5);
  }

  async function liveIndicatoren(symbool) {
    const { df, bron } = await haalData(symbool);
    if (!df || df.length < EMA_LANG + 5) return null;
    const close = df.close;
    const prijs = close[close.length - 1];
    const ema20 = laatste(berekenEma(close, EMA_KORT));
    const ema50 = laatste(berekenEma(close, EMA_LANG));
    const macd = berekenMacd(close);
    let atr = laatste(berekenAtr(df));
    if (!isFinite(atr)) atr = prijs * 0.03;
    return {
      prijs: prijs,
      bron: bron,
      rsi: berekenRsi(close),
      ema20: ema20,
      ema50: ema50,
      macd_bullish: laatste(macd.macdLijn) > laatste(macd.signaalLijn),
      atr: atr,
    };
  }

  async function adviesVoorTrade(trade) {
    const sym = (trade.symbool || "").toUpperCase();
    const entry = parseFloat(trade.entry);
    const stop = parseFloat(trade.stop_loss);
    const target = parseFloat(trade.take_profit);
    const aantal = parseFloat(trade.aantal || 0) || 0;

    const ind = await liveIndicatoren(sym);
    if (!ind) {
      return Object.assign({}, trade, {
        prijs: null,
        pnl_pct: null,
        pnl_waarde: null,
        advies: "ONBEKEND",
        advies_kleur: "grijs",
        uitleg: "Geen marktdata gevonden voor " + sym + ". Controleer het symbool.",
      });
    }

    const prijs = ind.prijs;
    const pnlPct = entry ? ((prijs - entry) / entry) * 100 : 0.0;
    const pnlWaarde = aantal ? (prijs - entry) * aantal : null;

    const risico = entry - stop;
    const naarTarget = target - entry;
    const voortgang = naarTarget > 0 ? (prijs - entry) / naarTarget : 0.0;

    const redenen = [];
    let advies = "HOUD";
    let kleur = "blauw";

    if (prijs <= stop) {
      advies = "VERKOOP NU";
      kleur = "rood";
      redenen.push("Stop loss geraakt (prijs " + fmt(prijs) + " ≤ stop " + fmt(stop) + ").");
    } else if (prijs >= target) {
      advies = "NEEM WINST";
      kleur = "groen";
      redenen.push("Take profit bereikt (prijs " + fmt(prijs) + " ≥ doel " + fmt(target) + ").");
    } else {
      const trendKapot = ind.ema20 < ind.ema50;
      if (voortgang >= 0.7) {
        advies = "OVERWEEG WINST";
        kleur = "groen";
        redenen.push(
          "Bijna bij je doel (" + Math.round(voortgang * 100) + "% van de weg). " +
            "Overweeg (deel)winst of trail je stop omhoog."
        );
      } else if (ind.rsi >= 75) {
        advies = "OVERWEEG WINST";
        kleur = "groen";
        redenen.push(
          "RSI overbought (" + ind.rsi.toFixed(0) + ") — winst kan keren; overweeg (deel)winst."
        );
      } else if (trendKapot && prijs < entry) {
        advies = "LET OP / ZWAKTE";
        kleur = "oranje";
        redenen.push(
          "Trend is gedraaid (EMA20 < EMA50) én je staat op verlies. " +
            "Overweeg eerder uit te stappen dan de stop."
        );
      } else if (!ind.macd_bullish && pnlPct > 0) {
        advies = "HOUD (let op)";
        kleur = "oranje";
        redenen.push(
          "Momentum zwakt af (MACD bearish), maar je staat op winst. Houd je stop strak."
        );
      } else {
        advies = "HOUD VAST";
        kleur = "blauw";
        redenen.push("Trade ontwikkelt zich normaal binnen plan. Niets doen.");
      }

      if (risico > 0 && prijs - entry >= risico && prijs > stop) {
        const nieuweStop = Math.max(stop, entry);
        if (nieuweStop > stop) {
          redenen.push(
            "💡 Tip: verschuif je stop naar break-even (" + fmt(entry) +
              ") — winst is nu groter dan je risico."
          );
        }
      }
    }

    return Object.assign({}, trade, {
      prijs: prijs,
      rsi: Math.round(ind.rsi),
      macd_bullish: ind.macd_bullish,
      ema20: ind.ema20,
      ema50: ind.ema50,
      bron: ind.bron,
      pnl_pct: Math.round(pnlPct * 100) / 100,
      pnl_waarde: pnlWaarde != null ? Math.round(pnlWaarde * 100) / 100 : null,
      voortgang_pct: Math.round(Math.max(0, Math.min(voortgang, 1.2)) * 100),
      advies: advies,
      advies_kleur: kleur,
      uitleg: redenen.join(" "),
    });
  }

  async function niveausVoorSymbool(sym) {
    const ind = await liveIndicatoren(sym);
    if (!ind) return null;
    const entry = ind.prijs;
    const atr = ind.atr;
    const risk = ATR_STOP_MULTIPLIER * atr;
    const stop = entry - risk;
    const tp = entry + REWARD_MULTIPLIER * atr;
    const rr = risk > 0 ? (tp - entry) / risk : 0.0;
    return {
      prijs: entry,
      entry: entry,
      stop_loss: stop,
      take_profit: tp,
      rr: Math.round(rr * 10) / 10,
      rsi: Math.round(ind.rsi),
      trend_op: ind.ema20 > ind.ema50,
      bron: ind.bron,
    };
  }

  // -------------------------------------------------------------------------
  // OPSLAG  (localStorage i.p.v. JSON-bestanden)
  // -------------------------------------------------------------------------
  function laad(sleutel, standaard) {
    try {
      const raw = localStorage.getItem(sleutel);
      return raw ? JSON.parse(raw) : standaard;
    } catch (e) {
      return standaard;
    }
  }
  function bewaar(sleutel, data) {
    localStorage.setItem(sleutel, JSON.stringify(data));
  }
  const TRADERS_KEY = "traders";
  const PORTFOLIO_KEY = "portfolio";

  // -------------------------------------------------------------------------
  // HULP: parsing van vrije invoer (uit app.py)
  // -------------------------------------------------------------------------
  function parseGetallenlijst(tekst) {
    if (Array.isArray(tekst)) return tekst.map((x) => parseFloat(x)).filter((x) => isFinite(x));
    const out = [];
    for (let stuk of String(tekst).replace(/;/g, ",").split(",")) {
      stuk = stuk.trim().replace(/%/g, "");
      if (!stuk) continue;
      const v = parseFloat(stuk);
      if (isFinite(v)) out.push(v);
    }
    return out;
  }
  function parsePortfolio(tekst) {
    if (tekst && typeof tekst === "object" && !Array.isArray(tekst)) {
      const out = {};
      for (const k in tekst) out[k] = parseFloat(tekst[k]);
      return out;
    }
    const out = {};
    for (const stuk of String(tekst).replace(/;/g, ",").split(",")) {
      if (stuk.indexOf(":") === -1) continue;
      const idx = stuk.indexOf(":");
      const sym = stuk.slice(0, idx).trim().toUpperCase();
      const pct = parseFloat(stuk.slice(idx + 1).trim().replace(/%/g, ""));
      if (sym && isFinite(pct)) out[sym] = pct;
    }
    return out;
  }

  const nuUtc = () => {
    const d = new Date();
    const p = (n) => String(n).padStart(2, "0");
    return (
      d.getUTCFullYear() + "-" + p(d.getUTCMonth() + 1) + "-" + p(d.getUTCDate()) +
      " " + p(d.getUTCHours()) + ":" + p(d.getUTCMinutes()) + " UTC"
    );
  };
  const nuTijd = () => {
    const d = new Date();
    const p = (n) => String(n).padStart(2, "0");
    return p(d.getUTCHours()) + ":" + p(d.getUTCMinutes()) + " UTC";
  };

  // -------------------------------------------------------------------------
  // API-LAAG  (vervangt de HTTP-endpoints uit app.py 1-op-1)
  // -------------------------------------------------------------------------
  async function apiAnalyse(onProgress) {
    const trades = await analyseerMarkt(null, 10, onProgress);
    const schoon = trades.map((t) => {
      const oordeel = genereerKoopadvies({
        score: t.score,
        rsi: t.rsi,
        trend_op: t.ema20 > t.ema50,
        macd_bullish: t.macd_bullish,
        volume_ratio: t.volume_ratio != null ? t.volume_ratio : 1.0,
        high_conviction: t.high_conviction,
      });
      return {
        symbool: t.symbool,
        prijs: t.prijs,
        entry: t.entry,
        entry_laag: t.entry_laag,
        entry_hoog: t.entry_hoog,
        stop_loss: t.stop_loss,
        take_profit: t.take_profit,
        rr: Math.round(t.rr * 10) / 10,
        score: t.score,
        rsi: Math.round(t.rsi),
        signaal: t.signaal,
        high_conviction: t.high_conviction,
        redenen: t.redenen,
        bron: t.bron,
        info: infoVoor(t.symbool),
        oordeel: oordeel,
      };
    });
    return { trades: schoon, tijd: nuUtc() };
  }

  async function apiKansen(onProgress) {
    const kansen = await zoekKansen(10, onProgress);
    const uit = kansen.map((k) => {
      let oordeel;
      if (k.heeft_technisch) {
        oordeel = genereerKoopadvies({
          rsi: k.rsi != null ? k.rsi : 50,
          trend_op: !!k.trend_op,
          macd_bullish: !!k.macd_bullish,
        });
      } else {
        oordeel = {
          label: "Speculatief",
          kleur: "oranje",
          uitleg: "Geen candle-data — niveaus zijn een richtlijn. Hoog risico.",
        };
      }
      return Object.assign({}, k, { info: infoVoor(k.symbool), oordeel: oordeel });
    });
    return { kansen: uit, tijd: nuUtc() };
  }

  async function apiCopytrades(onProgress) {
    const traders = laad(TRADERS_KEY, []);
    const uit = [];
    for (const tr of traders) {
      let oordeel = "?", csl = 0, score = 0;
      try {
        const b = beoordeelTrader({
          naam: tr.naam,
          maandrendementen: tr.maandrendementen || [],
          max_drawdown: tr.max_drawdown || 0,
          jaarrendement: tr.jaarrendement,
          risk_score: tr.risk_score != null ? tr.risk_score : 4,
          portfolio: tr.portfolio || {},
        });
        oordeel = b.oordeel;
        csl = b.csl;
        score = b.totaalscore;
      } catch (e) {}

      const holdings = [];
      const port = tr.portfolio || {};
      for (const sym in port) {
        const pct = port[sym];
        const symu = sym.toUpperCase();
        if (["CASH", "USD", "USDT", "USDC"].indexOf(symu) !== -1) {
          holdings.push({ symbool: symu, allocatie: pct, cash: true, info: infoVoor(symu) });
          continue;
        }
        if (onProgress) onProgress(symu);
        const niv = await niveausVoorSymbool(symu);
        holdings.push(
          Object.assign(
            { symbool: symu, allocatie: pct, cash: false, info: infoVoor(symu) },
            niv || { prijs: null }
          )
        );
      }
      holdings.sort((a, b) => (b.allocatie || 0) - (a.allocatie || 0));

      uit.push({ id: tr.id, naam: tr.naam || "?", oordeel: oordeel, csl: csl, score: score, holdings: holdings });
    }
    return { traders: uit, tijd: nuUtc() };
  }

  function apiTradersLijst() {
    const traders = laad(TRADERS_KEY, []);
    const audits = traders.map((tr) => {
      try {
        const b = beoordeelTrader({
          naam: tr.naam,
          maandrendementen: tr.maandrendementen || [],
          max_drawdown: tr.max_drawdown || 0,
          jaarrendement: tr.jaarrendement,
          risk_score: tr.risk_score != null ? tr.risk_score : 4,
          portfolio: tr.portfolio || {},
        });
        return {
          id: tr.id,
          naam: b.naam,
          oordeel: b.oordeel,
          kleur: b.oordeel,
          score: b.totaalscore,
          csl: b.csl,
          consistentie: b.consistentie,
          risico: b.risico,
          portfolio: b.portfolio,
          invoer: tr,
        };
      } catch (e) {
        return { id: tr.id, naam: tr.naam || "?", oordeel: "FOUT", kleur: "FOUT", score: 0, csl: 0, uitleg: String(e) };
      }
    });
    return { traders: audits };
  }

  function apiTraderToevoegen(body) {
    const traders = laad(TRADERS_KEY, []);
    const jaar = body.jaarrendement;
    const nieuw = {
      id: String(Date.now()),
      naam: (body.naam || "Naamloos").trim() || "Naamloos",
      maandrendementen: parseGetallenlijst(body.maandrendementen || ""),
      max_drawdown: parseFloat(body.max_drawdown || 0) || 0,
      risk_score: parseInt(parseFloat(body.risk_score || 4) || 4, 10),
      jaarrendement: jaar !== null && jaar !== undefined && jaar !== "" ? parseFloat(jaar) : null,
      portfolio: parsePortfolio(body.portfolio || ""),
    };
    traders.push(nieuw);
    bewaar(TRADERS_KEY, traders);
    return apiTradersLijst();
  }

  function apiTraderVerwijderen(tid) {
    const traders = laad(TRADERS_KEY, []).filter((t) => t.id !== tid);
    bewaar(TRADERS_KEY, traders);
    return apiTradersLijst();
  }

  function portfolioSamenvatting(beoordeeld) {
    let inleg = 0, waardeNu = 0, metWaarde = 0, actieNodig = 0;
    for (const t of beoordeeld) {
      const aantal = parseFloat(t.aantal || 0) || 0;
      const prijs = t.prijs;
      const entry = parseFloat(t.entry || 0) || 0;
      if (aantal > 0 && prijs != null && entry > 0) {
        inleg += entry * aantal;
        waardeNu += prijs * aantal;
        metWaarde += 1;
      }
      const advies = t.advies || "";
      if (["VERKOOP", "WINST", "LET OP", "ZWAKTE"].some((k) => advies.indexOf(k) !== -1)) {
        actieNodig += 1;
      }
    }
    const pnl = waardeNu - inleg;
    const pnlPct = inleg > 0 ? (pnl / inleg) * 100 : null;
    return {
      open_posities: beoordeeld.length,
      posities_met_aantal: metWaarde,
      actie_nodig: actieNodig,
      inleg: Math.round(inleg * 100) / 100,
      waarde_nu: Math.round(waardeNu * 100) / 100,
      pnl: Math.round(pnl * 100) / 100,
      pnl_pct: pnlPct != null ? Math.round(pnlPct * 100) / 100 : null,
    };
  }

  async function apiPortfolioLijst(onProgress) {
    const trades = laad(PORTFOLIO_KEY, []);
    const openTrades = trades.filter((t) => (t.status || "open") === "open");
    const gesloten = trades.filter((t) => t.status === "gesloten");
    const beoordeeld = [];
    for (const t of openTrades) {
      if (onProgress) onProgress(t.symbool);
      beoordeeld.push(await adviesVoorTrade(t));
    }
    return {
      open: beoordeeld,
      gesloten: gesloten,
      samenvatting: portfolioSamenvatting(beoordeeld),
      tijd: nuTijd(),
    };
  }

  async function apiTradeToevoegen(body) {
    const trades = laad(PORTFOLIO_KEY, []);
    const nieuw = {
      id: String(Date.now()),
      symbool: (body.symbool || "").trim().toUpperCase(),
      entry: parseFloat(body.entry || 0) || 0,
      stop_loss: parseFloat(body.stop_loss || 0) || 0,
      take_profit: parseFloat(body.take_profit || 0) || 0,
      aantal: parseFloat(body.aantal || 0) || 0,
      datum: new Date().toISOString().slice(0, 10),
      status: "open",
    };
    trades.push(nieuw);
    bewaar(PORTFOLIO_KEY, trades);
    return apiPortfolioLijst();
  }

  async function apiTradeSluiten(tid) {
    const trades = laad(PORTFOLIO_KEY, []);
    for (const t of trades) {
      if (t.id === tid) {
        t.status = "gesloten";
        t.gesloten_op = new Date().toISOString().slice(0, 10);
      }
    }
    bewaar(PORTFOLIO_KEY, trades);
    return apiPortfolioLijst();
  }

  async function apiTradeVerwijderen(tid) {
    const trades = laad(PORTFOLIO_KEY, []).filter((t) => t.id !== tid);
    bewaar(PORTFOLIO_KEY, trades);
    return apiPortfolioLijst();
  }

  // -------------------------------------------------------------------------
  // Publieke router: vervangt fetch("/api/...") in de UI.
  // -------------------------------------------------------------------------
  async function api(pad, body, onProgress) {
    switch (pad) {
      case "/api/analyse":
        return apiAnalyse(onProgress);
      case "/api/kansen":
        return apiKansen(onProgress);
      case "/api/copytrades":
        return apiCopytrades(onProgress);
      case "/api/traders":
        if (body !== undefined) return apiTraderToevoegen(body);
        return apiTradersLijst();
      case "/api/traders/delete":
        return apiTraderVerwijderen((body || {}).id || "");
      case "/api/trades":
        if (body !== undefined) return apiTradeToevoegen(body);
        return apiPortfolioLijst(onProgress);
      case "/api/trades/close":
        return apiTradeSluiten((body || {}).id || "");
      case "/api/trades/delete":
        return apiTradeVerwijderen((body || {}).id || "");
      default:
        return { fout: "onbekend pad" };
    }
  }

  window.AppEngine = { api: api, fmt: fmt };
})();
