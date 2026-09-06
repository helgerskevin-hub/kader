// Design-tokens voor Kader
// Licht = default; donker beschikbaar voor latere toggle.

export interface ColorTokens {
  // Oppervlak
  achtergrond: string;
  kaart: string;
  verhoogd: string;
  rand: string;
  // Tekst
  tekstPrimair: string;
  tekstGedimd: string;
  // Merk & semantiek
  primair: string;
  cta: string;
  winst: string;
  verlies: string;
  letOp: string;
  goud: string;
  // Schakelaars: neutraal grijs. De aan-stand van een schakelaar is geen goedkeuring, dus hij
  // hoort niet groen te worden. Android kleurt de duim anders zelf in.
  schakelaarAan: string;
  schakelaarDuim: string;
  // Categorische kleuren voor het cirkeldiagram op Portfolio. Bewust geen groen of rood: die twee
  // betekenen in Kader winst en verlies, en een segment van je verdeling is geen resultaat.
  verdeling: readonly string[];
  verdelingOverig: string;
}

export const lightTokens: ColorTokens = {
  achtergrond: '#F8FAFC',
  kaart: '#FFFFFF',
  verhoogd: '#EEF2F7',
  rand: '#E2E8F0',
  tekstPrimair: '#0F172A',
  tekstGedimd: '#64748B',
  primair: '#1E3A8A',
  cta: '#2563EB',
  winst: '#16A34A',
  verlies: '#DC2626',
  letOp: '#D97706',
  goud: '#A16207',
  schakelaarAan: '#94A3B8',
  schakelaarDuim: '#FFFFFF',
  verdeling: ['#1E3A8A', '#2563EB', '#0E7490', '#6D28D9', '#A21CAF', '#B45309'],
  verdelingOverig: '#94A3B8',
};

export const darkTokens: ColorTokens = {
  achtergrond: '#0E1117',
  kaart: '#161B22',
  verhoogd: '#1C2230',
  rand: '#2A3140',
  tekstPrimair: '#E6EDF3',
  tekstGedimd: '#8B949E',
  primair: '#3B82F6',
  cta: '#2563EB',
  winst: '#22C55E',
  verlies: '#EF4444',
  letOp: '#F59E0B',
  goud: '#D4A24E',
  schakelaarAan: '#6B7280',
  schakelaarDuim: '#E6EDF3',
  verdeling: ['#93C5FD', '#3B82F6', '#22D3EE', '#A78BFA', '#F0ABFC', '#FCD34D'],
  verdelingOverig: '#64748B',
};

// 8px-basis spacing-schaal
export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  base: 16,
  lg: 24,
  xl: 32,
} as const;

// Hoekradii
export const radii = {
  veld: 8,
  knop: 12,
  kaart: 16,
  pill: 999,
} as const;

// Schaduw-niveaus (elevatie)
export const shadow = {
  kaart: {
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  modal: {
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 24,
    elevation: 8,
  },
} as const;
