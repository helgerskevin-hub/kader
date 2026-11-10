// Kan deze rij bij eToro verkocht en gewijzigd worden? Alles moet kloppen: de trade komt uit eToro,
// we kennen zowel het positie- als het instrument-ID, en de positie hoort bij de omgeving waar de
// app nu in staat. Een positie-ID uit de ene omgeving naar het endpoint van de andere sturen is een
// slechte afloop, dus bij twijfel verschijnt de knop simpelweg niet. Oude opgeslagen trades missen
// deze velden en herstellen zichzelf bij de volgende sync.
import type { EtoroOmgeving } from '../engine/etoro';
import type { PortfolioTrade } from './portfolioTypes';

export function isEtoroBestuurbaar(trade: PortfolioTrade, omgeving: EtoroOmgeving): boolean {
  return trade.bron === 'etoro'
    && trade.status === 'open'
    && typeof trade.etoroPositionID === 'number'
    && typeof trade.etoroInstrumentID === 'number'
    && (trade.etoroOmgeving ?? 'real') === omgeving;
}
