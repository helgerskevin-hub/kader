import { CoinInfo, KoopAdvies } from './types';
import { DREMPEL_KOOP, DREMPEL_STERK_KOOP, DREMPEL_BADGE_MATIG, DREMPEL_SHORT, HIGH_CONVICTION_VOLUME_MIN } from './drempels';

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
  FET: { naam: 'Artificial Superintelligence (FET)', categorie: 'AI', wat: 'Fusie van Fetch.ai, SingularityNET en Ocean, een toonaangevend AI-crypto-project. Zeer trendgevoelig.' },
  SEI: { naam: 'Sei', categorie: 'Layer-1 · trading', wat: 'Snel Layer-1 geoptimaliseerd voor handelsapps. Mid-cap, volatiel.' },
  AAVE: { naam: 'Aave', categorie: 'DeFi · lenen', wat: 'Grootste lenen-en-uitlenen-protocol in DeFi. Een \'blue chip\' van DeFi met echt gebruik.' },
};

export function infoVoor(symbool: string): CoinInfo {
  const sym = (symbool ?? '').toUpperCase();
  if (COIN_INFO[sym]) return COIN_INFO[sym];
  if (['CASH', 'USD', 'USDT', 'USDC', 'DAI'].includes(sym)) {
    return { naam: sym, categorie: 'Stablecoin / cash', wat: 'Stabiele waarde (≈$1). Geen koerswinst, dient als veilige buffer.' };
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
  else if (rsi > 72) aandacht.push(`overbought RSI (${rsi.toFixed(0)}), verhoogde kans op terugval`);
  else if (rsi < 35) aandacht.push(`oversold RSI (${rsi.toFixed(0)}), mogelijk bounce, maar riskant`);

  if (volumeRatio >= 1.5) plus.push(`sterke volume-spike (${volumeRatio.toFixed(1)}×)`);
  else if (volumeRatio >= 1.2) plus.push(`verhoogd volume (${volumeRatio.toFixed(1)}×)`);

  const s = score != null ? score :
    (trendOp ? 25 : 0) + (macdBullish ? 20 : 0) + (rsi >= 45 && rsi <= 68 ? 20 : 0) + (volumeRatio >= HIGH_CONVICTION_VOLUME_MIN ? 15 : 0);

  let label: string;
  let kleur: 'groen' | 'oranje' | 'rood';
  if (highConviction || s >= DREMPEL_STERK_KOOP) { label = 'Sterke koop'; kleur = 'groen'; }
  else if (s >= DREMPEL_KOOP) { label = 'Koopwaardig'; kleur = 'groen'; }
  else if (s >= DREMPEL_BADGE_MATIG) { label = 'Neutraal: wacht op bevestiging'; kleur = 'oranje'; }
  else { label = 'Zwak: nu niet kopen'; kleur = 'rood'; }

  let uitleg = '';
  if (plus.length) uitleg += plus.join(', ') + '. ';
  if (aandacht.length) uitleg += 'Let op: ' + aandacht.join(', ') + '.';
  return { label, kleur, uitleg: uitleg.trim() };
}

// Het spiegelbeeld van genereerKoopadvies, voor een short. Bewust een eigen functie en geen vlag in
// de bestaande: elke regel draait om, en dan wordt één functie met overal een "als short"-tak
// moeilijker te lezen dan twee die je naast elkaar kunt houden.
//
// Waarom dit nodig was: het coin-detailscherm bouwt zijn "Waarom" met genereerKoopadvies, en dat
// kent alleen bullish onderbouwing. Een short die daar zou openen kreeg dus tekst als "geen
// opwaartse trend, let op" onder een signaal dat juist op die dalende trend instapt, en een rood
// "Zwak: nu niet kopen" boven een positie die je aan het openen bent. Daarom kon je een short tot
// nu toe niet aantikken.
//
// De grens is DREMPEL_SHORT (40), dezelfde die de engine gebruikt om een short te laten vuren, en
// niet een eigen visuele drempel: het label mag niet groen staan waar de engine niet vuurt.
export function genereerShortadvies(opts: {
  score?: number | null;
  rsi?: number;
  trendOp?: boolean;
  macdBullish?: boolean;
  volumeRatio?: number;
}): KoopAdvies {
  const { score, rsi = 50, trendOp = true, macdBullish = true, volumeRatio = 1.0 } = opts;
  const plus: string[] = [];
  const aandacht: string[] = [];

  // Bij een short is een dalende trend het argument vóór, niet tegen.
  if (!trendOp) plus.push('neerwaartse trend (EMA20 onder EMA50)');
  else aandacht.push('de trend is nog opwaarts (EMA20 boven EMA50)');

  if (!macdBullish) plus.push('negatief momentum (MACD bearish)');
  else aandacht.push('het momentum is nog positief (MACD bullish)');

  // Ruimte om te dalen is wat een short nodig heeft. Diep oversold is juist gevaarlijk: dan is de
  // beweging grotendeels geweest en is een terugveer waarschijnlijker dan verder zakken.
  if (rsi < 30) aandacht.push(`diep oversold RSI (${rsi.toFixed(0)}), grote kans op een terugveer omhoog`);
  else if (rsi <= 55) plus.push(`RSI met ruimte omlaag (${rsi.toFixed(0)})`);
  else if (rsi > 68) aandacht.push(`overbought RSI (${rsi.toFixed(0)}), de koers is nog sterk aan het stijgen`);

  // Volume bevestigt de beweging, ongeacht de richting.
  if (volumeRatio >= 1.5) plus.push(`sterke volume-spike (${volumeRatio.toFixed(1)}×)`);
  else if (volumeRatio >= 1.2) plus.push(`verhoogd volume (${volumeRatio.toFixed(1)}×)`);

  // Bij een short is een LAGE score het sterke signaal, dus de schaal draait om.
  const s = score != null ? score :
    (trendOp ? 25 : 0) + (macdBullish ? 20 : 0) + (rsi >= 45 && rsi <= 68 ? 20 : 0) + (volumeRatio >= HIGH_CONVICTION_VOLUME_MIN ? 15 : 0);

  let label: string;
  let kleur: 'groen' | 'oranje' | 'rood';
  if (s < DREMPEL_SHORT / 2) { label = 'Sterk short-signaal'; kleur = 'groen'; }
  else if (s < DREMPEL_SHORT) { label = 'Short-waardig'; kleur = 'groen'; }
  else if (s < DREMPEL_KOOP) { label = 'Neutraal: te sterk om te shorten'; kleur = 'oranje'; }
  else { label = 'Te sterk: nu niet shorten'; kleur = 'rood'; }

  let uitleg = '';
  if (plus.length) uitleg += plus.join(', ') + '. ';
  if (aandacht.length) uitleg += 'Let op: ' + aandacht.join(', ') + '.';
  return { label, kleur, uitleg: uitleg.trim() };
}

// ponytail: self-check ipv testframework, run met `npx tsx app/src/engine/coinInfo.ts`
if (require.main === module) {
  // Een tekstboek-short: alles wijst omlaag, score ver onder de drempel.
  const sterk = genereerShortadvies({ score: 15, rsi: 45, trendOp: false, macdBullish: false, volumeRatio: 1.6 });
  console.assert(sterk.label === 'Sterk short-signaal', `score 15 hoort sterk te zijn, was ${sterk.label}`);
  console.assert(sterk.kleur === 'groen', 'een sterk short-signaal is groen, net als een sterke koop');
  console.assert(sterk.uitleg.includes('neerwaartse trend'), 'een dalende trend is bij een short een plus');
  console.assert(sterk.uitleg.includes('negatief momentum'), 'bearish MACD is bij een short een plus');
  console.assert(!sterk.uitleg.includes('Let op'), `niets aan te merken hier, was: ${sterk.uitleg}`);

  // Precies op de drempel waar de engine vuurt: 40 vuurt NIET (score < 40), dus het label mag hier
  // niet groen staan.
  console.assert(genereerShortadvies({ score: DREMPEL_SHORT }).kleur === 'oranje',
    'precies op de short-drempel vuurt de engine niet, dus geen groen label');
  console.assert(genereerShortadvies({ score: DREMPEL_SHORT - 1 }).kleur === 'groen',
    'net onder de drempel vuurt hij wel');

  // Een sterke coin is een slechte short, en dat moet er ook staan.
  const sterkeCoin = genereerShortadvies({ score: 90, rsi: 60, trendOp: true, macdBullish: true, volumeRatio: 1.0 });
  console.assert(sterkeCoin.kleur === 'rood' && sterkeCoin.label.includes('niet shorten'),
    `score 90 hoort een rood short-oordeel te geven, was ${sterkeCoin.label}`);
  console.assert(sterkeCoin.uitleg.includes('trend is nog opwaarts'), 'een stijgende trend is bij een short een waarschuwing');

  // Diep oversold: de val is grotendeels geweest, dat hoort een waarschuwing te zijn en geen plus.
  const oversold = genereerShortadvies({ score: 20, rsi: 22, trendOp: false, macdBullish: false });
  console.assert(oversold.uitleg.includes('terugveer'), `diep oversold hoort te waarschuwen, was: ${oversold.uitleg}`);

  // De koopkant mag niet veranderd zijn.
  const koop = genereerKoopadvies({ score: 90, rsi: 60, trendOp: true, macdBullish: true, volumeRatio: 1.6 });
  console.assert(koop.label === 'Sterke koop' && koop.kleur === 'groen', 'het koopadvies blijft ongewijzigd');
  console.assert(genereerKoopadvies({ score: 20 }).kleur === 'rood', 'een zwakke coin blijft rood aan de koopkant');

  console.log('coinInfo.ts self-check geslaagd');
}
