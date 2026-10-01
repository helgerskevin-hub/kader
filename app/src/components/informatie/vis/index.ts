import type { ComponentType } from 'react';
import type { VisProps } from './types';
import { VisScore } from './score';
import { VisAdvies } from './advies';
import { VisAtr } from './atr';
import { VisEtorostop } from './etorostop';
import { VisIndicatoren } from './indicatoren';
import { VisGrafiek } from './grafiek';
import { VisKlimaat } from './klimaat';
import { VisBear } from './bear';
import { VisRs } from './rs';
import { VisFg } from './fg';
import { VisRadar } from './radar';
import { VisVermogen } from './vermogen';
import { VisVerdeling } from './verdeling';
import { VisBlootstelling } from './blootstelling';
import { VisMeldingen } from './meldingen';
import { VisAlerts } from './alerts';
import { VisStats } from './stats';
import { VisHandelen } from './handelen';
import { VisKoppelen } from './koppelen';
import { VisPlatforms } from './platforms';
import { VisTrader } from './trader';

// Hoofdstuk-id naar visualisatie. Shorts heeft er bewust geen.
export const VISUALISATIES: Record<string, ComponentType<VisProps>> = {
  score: VisScore,
  advies: VisAdvies,
  atr: VisAtr,
  etorostop: VisEtorostop,
  indicatoren: VisIndicatoren,
  grafiek: VisGrafiek,
  klimaat: VisKlimaat,
  bear: VisBear,
  rs: VisRs,
  fg: VisFg,
  radar: VisRadar,
  vermogen: VisVermogen,
  verdeling: VisVerdeling,
  blootstelling: VisBlootstelling,
  meldingen: VisMeldingen,
  alerts: VisAlerts,
  stats: VisStats,
  handelen: VisHandelen,
  koppelen: VisKoppelen,
  platforms: VisPlatforms,
  trader: VisTrader,
};
