import { CoinInfo, KoopAdvies } from './types';

export const COIN_INFO: Record<string, CoinInfo> = {
  BTC: { naam: 'Bitcoin', categorie: 'Large-cap · digitaal goud', wat: 'De eerste en grootste cryptomunt; schaars (max 21M) en wordt gezien als waardeopslag. De minst risicovolle crypto, maar ook de traagste groeier.' },
  ETH: { naam: 'Ethereum', categorie: 'Large-cap · smart-contractplatform', wat: 'Het grootste platform voor smart contracts en DeFi/NFT\'s. Fundament van een groot deel van de crypto-economie.' },
  SOL: { naam: 'Solana', categorie: 'Layer-1 · snelle blockchain', wat: 'Snelle, goedkope blockchain populair voor DeFi, NFT\'s en meme-coins. Hoger rendement maar volatieler dan ETH.' },
  BNB: { naam: 'BNB', categorie: 'Exchange-token / Layer-1', wat: 'Token van de Binance-exchange en BNB Chain; gebruikt voor handelskorting en gas. Sterk afhankelijk van Binance.' },
  XRP: { naam: 'XRP', categorie: 'Payments', wat: 'Gericht op snelle, goedkope grensoverschrijdende betalingen via Ripple. Koers reageert sterk op regelgeving/rechtszaken.' },
  ADA: { naam: 'Cardano', categorie: 'Layer-1', wat: 'Onderzoeksgedreven smart-contractplatform. Grote community, maar trage adoptie t.o.v. concurrenten.' },
  AVAX: { naam: 'Avalanche', categorie: 'Layer-1', wat: 'Snel Layer-1 met \'subnets\' voor eigen blockchains. Concurreert met ETH en SOL voor DeFi en gaming.' },
  DOGE: { naam: 'Dogecoin', categorie: 'Meme-coin', wat: 'De originele meme-coin; beweegt vooral op sentiment en bekendheid (o.a. Elon Musk). Speculatief.' },
  LINK: { naam: 'Chainlink', categorie: 'Oracle / infrastructuur', wat: 'Levert externe data (oracles) aan smart contracts; cruciale infrastructuur voor DeFi. Brede adoptie.' },
  DOT: { naam: 'Polkadot', categorie: 'Layer-0 · interoperabiliteit', wat: 'Verbindt meerdere blockchains (\'parachains\'). Sterke techniek, maar adoptie blijft achter bij de hype.' },
  MATIC: { naam: 'Polygon', categorie: 'Layer-2 (Ethereum)', wat: 'Schaalt Ethereum met goedkopere/snellere transacties. Veel zakelijke partnerschappen. (Token migreert naar POL.)' },
  LTC: { naam: 'Litecoin', categorie: 'Payments', wat: 'Oude, stabiele \'zilver naast Bitcoins goud\' voor snelle betalingen. Weinig innovatie, lage volatiliteit.' },
  ATOM: { naam: 'Cosmos', categorie: 'Layer-0 · interoperabiliteit', wat: '\'Internet of blockchains\' dat netwerken laat communiceren (IBC). Sterke tech, zwakke token-waardevangst.' },
  NEAR: { naam: 'NEAR Protocol', categorie: 'Layer-1', wat: 'Gebruiksvriendelijk Layer-1 met focus op AI en eenvoudige apps. Mid-cap met groeipotentieel.' },
  ARB: { naam: 'Arbitrum', categorie: 'Layer-2 (Ethereum)', wat: 'Grootste Ethereum Layer-2 (rollup) met veel DeFi-activiteit. Goedkoper dan ETH-mainnet.' },
  OP: { naam: 'Optimism', categorie: 'Layer-2 (Ethereum)', wat: 'Ethereum Layer-2; de \'Superchain\' (o.a. Coinbase\'s Base) bouwt op zijn techniek.' },
  INJ: { naam: 'Injective', categorie: 'Layer-1 · DeFi/derivaten', wat: 'Snelle blockchain gespecialiseerd in financiële apps en derivaten. Volatiel maar sterke verhalen.' },
  SUI: { naam: 'Sui', categorie: 'Layer-1', wat: 'Nieuw, snel Layer-1 (Move-taal) gericht op gaming en consumenten-apps. Hoog risico/rendement.' },
  APT: { naam: 'Aptos', categorie: 'Layer-1', wat: 'Layer-1 uit het oude Meta/Diem-team (Move-taal). Concurreert met Sui; speculatief.' },
  TIA: { naam: 'Celestia', categorie: 'Modulair · data-beschikbaarheid', wat: 'Pionier in \'modulaire\' blockchains die andere ketens goedkope dataruimte bieden. Trendgevoelig.' },
  RNDR: { naam: 'Render', categorie: 'AI / DePIN', wat: 'Gedecentraliseerd netwerk voor GPU-rendering; profiteert van de AI- en grafische rekenvraag.' },
  FET: { naam: 'Artificial Superintelligence (FET)', categorie: 'AI', wat: 'Fusie van Fetch.ai, SingularityNET en Ocean — een toonaangevend AI-crypto-project. Zeer trendgevoelig.' },
  SEI: { naam: 'Sei', categorie: 'Layer-1 · trading', wat: 'Snel Layer-1 geoptimaliseerd voor handelsapps. Mid-cap, volatiel.' },
  AAVE: { naam: 'Aave', categorie: 'DeFi · lenen', wat: 'Grootste lenen-en-uitlenen-protocol in DeFi. Een \'blue chip\' van DeFi met echt gebruik.' },
};

export function infoVoor(symbool: string): CoinInfo {
  const sym = (symbool ?? '').toUpperCase();
  if (COIN_INFO[sym]) return COIN_INFO[sym];
  if (['CASH', 'USD', 'USDT', 'USDC', 'DAI'].includes(sym)) {
    return { naam: sym, categorie: 'Stablecoin / cash', wat: 'Stabiele waarde (≈$1). Geen koerswinst — dient als veilige buffer.' };
  }
  return { naam: sym, categorie: 'Onbekend', wat: 'Geen profielinfo beschikbaar. Doe altijd je eigen onderzoek (DYOR) naar het project, het team en het nut voordat je koopt.' };
}

export function genereerKoopadvies(opts: {
  score?: number | null;
  rsi?: number;
  trendOp?: boolean;
  macdBullish?: boolean;
  volumeRatio?: number;
  highConviction?: boolean;
}): KoopAdvies {
  const { score, rsi = 50, trendOp = false, macdBullish = false, volumeRatio = 1.0, highConviction = false } = opts;
  const plus: string[] = [];
  const aandacht: string[] = [];

  if (trendOp) plus.push('opwaartse trend (EMA20 boven EMA50)');
  else aandacht.push('geen opwaartse trend (EMA20 onder EMA50)');

  if (macdBullish) plus.push('positief momentum (MACD bullish)');
  else aandacht.push('zwak momentum (MACD bearish)');

  if (rsi >= 45 && rsi <= 68) plus.push(`gezonde RSI (${rsi.toFixed(0)})`);
  else if (rsi > 72) aandacht.push(`overbought RSI (${rsi.toFixed(0)}) — verhoogde kans op terugval`);
  else if (rsi < 35) aandacht.push(`oversold RSI (${rsi.toFixed(0)}) — mogelijk bounce, maar riskant`);

  if (volumeRatio >= 1.5) plus.push(`sterke volume-spike (${volumeRatio.toFixed(1)}×)`);
  else if (volumeRatio >= 1.2) plus.push(`verhoogd volume (${volumeRatio.toFixed(1)}×)`);

  const s = score != null ? score :
    (trendOp ? 25 : 0) + (macdBullish ? 20 : 0) + (rsi >= 45 && rsi <= 68 ? 20 : 0) + (volumeRatio >= 1.3 ? 15 : 0);

  let label: string;
  let kleur: 'groen' | 'oranje' | 'rood';
  if (highConviction || s >= 72) { label = 'Sterke koop'; kleur = 'groen'; }
  else if (s >= 55) { label = 'Koopwaardig'; kleur = 'groen'; }
  else if (s >= 40) { label = 'Neutraal — wacht op bevestiging'; kleur = 'oranje'; }
  else { label = 'Zwak — nu niet kopen'; kleur = 'rood'; }

  let uitleg = '';
  if (plus.length) uitleg += plus.join(', ') + '. ';
  if (aandacht.length) uitleg += 'Let op: ' + aandacht.join(', ') + '.';
  return { label, kleur, uitleg: uitleg.trim() };
}
