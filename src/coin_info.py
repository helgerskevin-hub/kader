# -*- coding: utf-8 -*-
"""
coin_info.py
============
Korte, eerlijke achtergrondinfo per crypto ("wat is het?") plus een functie die
op basis van de live technische indicatoren een KOOP-oordeel genereert
("waarom is dit nu wel/niet een goede koop?").

De beschrijvingen zijn educatief, geen advies. Het koop-oordeel is puur
technisch (trend, momentum, RSI, volume) en zegt niets over de lange termijn.
"""

from __future__ import annotations

# ---------------------------------------------------------------------------
#  WAT IS ELKE COIN?  (categorie + 1-regel uitleg)
# ---------------------------------------------------------------------------

COIN_INFO: dict[str, dict] = {
    "BTC": {"naam": "Bitcoin", "categorie": "Large-cap · digitaal goud",
            "wat": "De eerste en grootste cryptomunt; schaars (max 21M) en wordt gezien als waardeopslag. De minst risicovolle crypto, maar ook de traagste groeier."},
    "ETH": {"naam": "Ethereum", "categorie": "Large-cap · smart-contractplatform",
            "wat": "Het grootste platform voor smart contracts en DeFi/NFT's. Fundament van een groot deel van de crypto-economie."},
    "SOL": {"naam": "Solana", "categorie": "Layer-1 · snelle blockchain",
            "wat": "Snelle, goedkope blockchain populair voor DeFi, NFT's en meme-coins. Hoger rendement maar volatieler dan ETH."},
    "BNB": {"naam": "BNB", "categorie": "Exchange-token / Layer-1",
            "wat": "Token van de Binance-exchange en BNB Chain; gebruikt voor handelskorting en gas. Sterk afhankelijk van Binance."},
    "XRP": {"naam": "XRP", "categorie": "Payments",
            "wat": "Gericht op snelle, goedkope grensoverschrijdende betalingen via Ripple. Koers reageert sterk op regelgeving/rechtszaken."},
    "ADA": {"naam": "Cardano", "categorie": "Layer-1",
            "wat": "Onderzoeksgedreven smart-contractplatform. Grote community, maar trage adoptie t.o.v. concurrenten."},
    "AVAX": {"naam": "Avalanche", "categorie": "Layer-1",
             "wat": "Snel Layer-1 met 'subnets' voor eigen blockchains. Concurreert met ETH en SOL voor DeFi en gaming."},
    "DOGE": {"naam": "Dogecoin", "categorie": "Meme-coin",
             "wat": "De originele meme-coin; beweegt vooral op sentiment en bekendheid (o.a. Elon Musk). Speculatief."},
    "LINK": {"naam": "Chainlink", "categorie": "Oracle / infrastructuur",
             "wat": "Levert externe data (oracles) aan smart contracts; cruciale infrastructuur voor DeFi. Brede adoptie."},
    "DOT": {"naam": "Polkadot", "categorie": "Layer-0 · interoperabiliteit",
            "wat": "Verbindt meerdere blockchains ('parachains'). Sterke techniek, maar adoptie blijft achter bij de hype."},
    "MATIC": {"naam": "Polygon", "categorie": "Layer-2 (Ethereum)",
              "wat": "Schaalt Ethereum met goedkopere/snellere transacties. Veel zakelijke partnerschappen. (Token migreert naar POL.)"},
    "POL": {"naam": "Polygon (POL)", "categorie": "Layer-2 (Ethereum)",
            "wat": "Het nieuwe token van Polygon (opvolger van MATIC) voor het geüpgradede netwerk."},
    "LTC": {"naam": "Litecoin", "categorie": "Payments",
            "wat": "Oude, stabiele 'zilver naast Bitcoins goud' voor snelle betalingen. Weinig innovatie, lage volatiliteit."},
    "ATOM": {"naam": "Cosmos", "categorie": "Layer-0 · interoperabiliteit",
             "wat": "'Internet of blockchains' dat netwerken laat communiceren (IBC). Sterke tech, zwakke token-waardevangst."},
    "NEAR": {"naam": "NEAR Protocol", "categorie": "Layer-1",
             "wat": "Gebruiksvriendelijk Layer-1 met focus op AI en eenvoudige apps. Mid-cap met groeipotentieel."},
    "ARB": {"naam": "Arbitrum", "categorie": "Layer-2 (Ethereum)",
            "wat": "Grootste Ethereum Layer-2 (rollup) met veel DeFi-activiteit. Goedkoper dan ETH-mainnet."},
    "OP": {"naam": "Optimism", "categorie": "Layer-2 (Ethereum)",
           "wat": "Ethereum Layer-2; de 'Superchain' (o.a. Coinbase's Base) bouwt op zijn techniek."},
    "INJ": {"naam": "Injective", "categorie": "Layer-1 · DeFi/derivaten",
            "wat": "Snelle blockchain gespecialiseerd in financiële apps en derivaten. Volatiel maar sterke verhalen."},
    "SUI": {"naam": "Sui", "categorie": "Layer-1",
            "wat": "Nieuw, snel Layer-1 (Move-taal) gericht op gaming en consumenten-apps. Hoog risico/rendement."},
    "APT": {"naam": "Aptos", "categorie": "Layer-1",
            "wat": "Layer-1 uit het oude Meta/Diem-team (Move-taal). Concurreert met Sui; speculatief."},
    "TIA": {"naam": "Celestia", "categorie": "Modulair · data-beschikbaarheid",
            "wat": "Pionier in 'modulaire' blockchains die andere ketens goedkope dataruimte bieden. Trendgevoelig."},
    "RNDR": {"naam": "Render", "categorie": "AI / DePIN",
             "wat": "Gedecentraliseerd netwerk voor GPU-rendering; profiteert van de AI- en grafische rekenvraag."},
    "RENDER": {"naam": "Render", "categorie": "AI / DePIN",
               "wat": "Gedecentraliseerd netwerk voor GPU-rendering; profiteert van de AI-trend (nieuwe ticker van RNDR)."},
    "FET": {"naam": "Artificial Superintelligence (FET)", "categorie": "AI",
            "wat": "Fusie van Fetch.ai, SingularityNET en Ocean — een toonaangevend AI-crypto-project. Zeer trendgevoelig."},
    "SEI": {"naam": "Sei", "categorie": "Layer-1 · trading",
            "wat": "Snel Layer-1 geoptimaliseerd voor handelsapps. Mid-cap, volatiel."},
    "AAVE": {"naam": "Aave", "categorie": "DeFi · lenen",
             "wat": "Grootste lenen-en-uitlenen-protocol in DeFi. Een 'blue chip' van DeFi met echt gebruik."},
    "TAO": {"naam": "Bittensor", "categorie": "AI / DePIN",
            "wat": "Gedecentraliseerd netwerk dat machine-learning beloont. Een van de sterkste AI-verhalen, zeer volatiel."},
    "ONDO": {"naam": "Ondo Finance", "categorie": "RWA · tokenisatie",
             "wat": "Brengt echte activa (staatsobligaties) on-chain. Boegbeeld van de 'real-world assets'-trend."},
    "ENA": {"naam": "Ethena", "categorie": "DeFi · synthetische dollar",
            "wat": "Achter de USDe 'synthetische dollar' met hoog rendement. Innovatief maar met eigen risico's."},
    "JUP": {"naam": "Jupiter", "categorie": "DeFi (Solana)",
            "wat": "Grootste handels-aggregator op Solana. Profiteert direct van Solana-activiteit."},
    "PYTH": {"naam": "Pyth Network", "categorie": "Oracle / infrastructuur",
             "wat": "Snelle prijs-oracle (concurrent van Chainlink), sterk op Solana en daarbuiten."},
    "WIF": {"naam": "dogwifhat", "categorie": "Meme-coin (Solana)",
            "wat": "Populaire Solana-meme-coin. Puur sentiment; kan hard stijgen én crashen. Zeer speculatief."},
    "PEPE": {"naam": "Pepe", "categorie": "Meme-coin",
             "wat": "Grote Ethereum-meme-coin zonder fundamentele waarde. Pure speculatie op hype."},
    "BONK": {"naam": "Bonk", "categorie": "Meme-coin (Solana)",
             "wat": "Solana-meme-coin. Extreem volatiel, sentimentgedreven."},
    "FLOKI": {"naam": "Floki", "categorie": "Meme-coin",
              "wat": "Meme-coin met marketing-/gaming-ambities. Speculatief."},
    "SHIB": {"naam": "Shiba Inu", "categorie": "Meme-coin",
             "wat": "Grote meme-coin met eigen ecosysteem (Shibarium). Sentimentgedreven."},
    "JTO": {"naam": "Jito", "categorie": "DeFi (Solana) · staking",
            "wat": "Liquid-staking en MEV op Solana. Groeit mee met het Solana-ecosysteem."},
    "STX": {"naam": "Stacks", "categorie": "Bitcoin Layer-2",
            "wat": "Brengt smart contracts naar Bitcoin. Profiteert van het 'Bitcoin DeFi'-narratief."},
    "RUNE": {"naam": "THORChain", "categorie": "DeFi · cross-chain",
             "wat": "Maakt het ruilen van native coins tussen ketens mogelijk zonder bridge. Nichefunctie, volatiel."},
    "IMX": {"naam": "Immutable", "categorie": "Gaming / Layer-2",
            "wat": "Layer-2 gespecialiseerd in blockchain-gaming en NFT's. Trendgevoelig (gaming-cyclus)."},
    "GALA": {"naam": "Gala", "categorie": "Gaming",
             "wat": "Platform voor blockchain-games. Sterk afhankelijk van de gaming-hype."},
    "SAND": {"naam": "The Sandbox", "categorie": "Metaverse / gaming",
             "wat": "Virtuele wereld/metaverse-project. Beweegt met de metaverse-trend."},
    "MANA": {"naam": "Decentraland", "categorie": "Metaverse",
             "wat": "Virtuele wereld met grond als NFT's. Metaverse-trendgevoelig."},
    "FTM": {"naam": "Fantom", "categorie": "Layer-1",
            "wat": "Snel Layer-1; vernieuwd als 'Sonic' (token S). Sterke developer-community."},
    "S": {"naam": "Sonic", "categorie": "Layer-1",
          "wat": "De opvolger/upgrade van Fantom — zeer snel Layer-1 voor DeFi."},
    "ALGO": {"naam": "Algorand", "categorie": "Layer-1",
             "wat": "Energiezuinig Layer-1 met focus op betalingen en instituties. Trage koersgroei."},
    "HBAR": {"naam": "Hedera", "categorie": "Enterprise DLT",
             "wat": "Bedrijfsgericht netwerk (hashgraph) met grote partners. Anders dan een klassieke blockchain."},
    "VET": {"naam": "VeChain", "categorie": "Supply-chain",
            "wat": "Gericht op toeleveringsketen- en bedrijfsdata. Niche met zakelijke partners."},
    "GRT": {"naam": "The Graph", "categorie": "Infrastructuur / data",
            "wat": "'Google van blockchains' — indexeert on-chain data voor apps. Infrastructuur."},
    "UNI": {"naam": "Uniswap", "categorie": "DeFi · exchange",
            "wat": "Grootste gedecentraliseerde exchange (DEX) op Ethereum. DeFi blue chip."},
    "MKR": {"naam": "Maker / Sky", "categorie": "DeFi · stablecoin",
            "wat": "Achter de DAI-stablecoin; een van de oudste DeFi-protocollen. Lage volatiliteit voor crypto."},
    "LDO": {"naam": "Lido", "categorie": "DeFi · staking",
            "wat": "Grootste liquid-staking-protocol voor ETH. Beweegt met ETH-staking-vraag."},
    "CRV": {"naam": "Curve", "categorie": "DeFi · exchange",
            "wat": "DEX gespecialiseerd in stablecoin-ruil. Kernstuk van DeFi, maar token onder druk."},
    "DYDX": {"naam": "dYdX", "categorie": "DeFi · derivaten",
             "wat": "Gedecentraliseerd platform voor perpetual-futures. Volatiel."},
    "WLD": {"naam": "Worldcoin", "categorie": "Identiteit / AI",
            "wat": "Digitaal identiteits- en token-project (Sam Altman). Veel hype én privacy-discussie."},
    "ORDI": {"naam": "ORDI", "categorie": "Bitcoin (Ordinals)",
             "wat": "Eerste grote 'BRC-20'-token op Bitcoin. Zeer speculatief, trendgevoelig."},
    "TRX": {"naam": "TRON", "categorie": "Layer-1",
            "wat": "Layer-1 met veel stablecoin-verkeer (USDT). Stabiele cashflow, gecentraliseerd."},
    "TON": {"naam": "Toncoin", "categorie": "Layer-1",
            "wat": "Blockchain verbonden met Telegram; profiteert van Telegram's enorme gebruikersbasis."},
    "KAS": {"naam": "Kaspa", "categorie": "Layer-1 · proof-of-work",
            "wat": "Zeer snel proof-of-work-netwerk (blockDAG). Populair groeiverhaal, volatiel."},
}


def info_voor(symbool: str) -> dict:
    """Geeft beschrijving voor een symbool; valt terug op een neutrale tekst."""
    sym = (symbool or "").upper()
    if sym in COIN_INFO:
        return COIN_INFO[sym]
    if sym in ("CASH", "USD", "USDT", "USDC", "DAI"):
        return {"naam": sym, "categorie": "Stablecoin / cash",
                "wat": "Stabiele waarde (≈$1). Geen koerswinst — dient als veilige buffer."}
    return {"naam": sym, "categorie": "Onbekend",
            "wat": "Geen profielinfo beschikbaar. Doe altijd je eigen onderzoek (DYOR) "
                   "naar het project, het team en het nut voordat je koopt."}


# ---------------------------------------------------------------------------
#  KOOP-OORDEEL  (puur technisch, op basis van live indicatoren)
# ---------------------------------------------------------------------------

def genereer_koopadvies(*, score: float | None = None, rsi: float = 50,
                        trend_op: bool = False, macd_bullish: bool = False,
                        volume_ratio: float = 1.0,
                        high_conviction: bool = False) -> dict:
    """
    Vertaalt indicatoren naar een begrijpelijk oordeel + uitleg.
    Geeft {'label', 'kleur', 'uitleg'} terug.
    """
    plus, aandacht = [], []

    if trend_op:
        plus.append("opwaartse trend (EMA20 boven EMA50)")
    else:
        aandacht.append("geen opwaartse trend (EMA20 onder EMA50)")

    if macd_bullish:
        plus.append("positief momentum (MACD bullish)")
    else:
        aandacht.append("zwak momentum (MACD bearish)")

    if 45 <= rsi <= 68:
        plus.append(f"gezonde RSI ({rsi:.0f})")
    elif rsi > 72:
        aandacht.append(f"overbought RSI ({rsi:.0f}) — verhoogde kans op terugval")
    elif rsi < 35:
        aandacht.append(f"oversold RSI ({rsi:.0f}) — mogelijk bounce, maar riskant")

    if volume_ratio >= 1.5:
        plus.append(f"sterke volume-spike ({volume_ratio:.1f}×)")
    elif volume_ratio >= 1.2:
        plus.append(f"verhoogd volume ({volume_ratio:.1f}×)")

    # Bepaal het label.
    s = score if score is not None else (
        (25 if trend_op else 0) + (20 if macd_bullish else 0) +
        (20 if 45 <= rsi <= 68 else 0) + (15 if volume_ratio >= 1.3 else 0))

    if high_conviction or s >= 72:
        label, kleur = "Sterke koop", "groen"
    elif s >= 55:
        label, kleur = "Koopwaardig", "groen"
    elif s >= 40:
        label, kleur = "Neutraal — wacht op bevestiging", "oranje"
    else:
        label, kleur = "Zwak — nu niet kopen", "rood"

    uitleg = ""
    if plus:
        uitleg += "✅ " + ", ".join(plus) + ". "
    if aandacht:
        uitleg += "⚠️ " + ", ".join(aandacht) + "."
    return {"label": label, "kleur": kleur, "uitleg": uitleg.strip()}
