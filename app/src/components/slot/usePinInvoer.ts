import { useCallback, useEffect, useRef, useState } from 'react';
import { AccessibilityInfo } from 'react-native';
import { haptiek } from '../../theme/haptiek';
import { PIN_LENGTE, type PinUitkomst } from '../../state/vergrendelTypes';
import type { StippenStand } from './PinStippen';

// Wat de aanroeper antwoordt zodra er een volledige pincode is ingevoerd.
// - ok: gelukt. De stippen blijven gevuld en de haken sluiten; verder invoer is dicht.
// - fout: de stippen worden rood en schudden, met de melding in de statusregel. Daarna wordt de
//   invoer leeggemaakt.
// - wis: stil leegmaken (een wachttijd begon, of een tussenstap in het instellen is klaar).
export type InvoerResultaat =
  | { soort: 'ok' }
  | { soort: 'fout'; melding: string }
  | { soort: 'wis' };

// Hoe lang de rode stippen blijven staan voor ze leeg gaan: lang genoeg om te zien en te horen
// wat er mis was, kort genoeg om meteen opnieuw te kunnen.
const FOUT_ZICHTBAAR_MS = 450;

// De melding bij een foute pincode (copy uit het plan): fout 1 en 2 kaal, fout 3 "Nog 2 pogingen",
// fout 4 "Nog 1 poging". resterendTotBlokkade komt uit PinUitkomst.
export function meldingBijFoutePin(resterendTotBlokkade: number): string {
  if (resterendTotBlokkade === 2) return 'Onjuiste pincode. Nog 2 pogingen.';
  if (resterendTotBlokkade === 1) return 'Onjuiste pincode. Nog 1 poging.';
  return 'Onjuiste pincode.';
}

export const MELDING_KLUISFOUT = 'Kader kan je pincode nu niet controleren. Probeer het opnieuw.';

// Vertaalt de uitkomst van de provider naar wat de invoer moet doen. Bij 'geblokkeerd' gebeurt er
// hier niets zichtbaars: de wachtstaat komt uit de blokkade die het scherm al krijgt.
export function pinUitkomstNaarResultaat(u: PinUitkomst): InvoerResultaat {
  switch (u.soort) {
    case 'ok':
      return { soort: 'ok' };
    case 'fout':
      return { soort: 'fout', melding: meldingBijFoutePin(u.resterendTotBlokkade) };
    case 'geblokkeerd':
      return { soort: 'wis' };
    case 'kluisfout':
      return { soort: 'fout', melding: MELDING_KLUISFOUT };
  }
}

export function kondigAan(tekst: string): void {
  try {
    AccessibilityInfo.announceForAccessibility(tekst);
  } catch {
    // Geen schermlezer: niets te doen.
  }
}

interface Opties {
  lengte?: number;
  // Wachttijd of een andere reden om geen cijfers aan te nemen.
  geblokkeerd?: boolean;
}

// De invoerstand van een pincode: cijfers, de stand van de stippen en de foutmelding. Bewust zonder
// UI, zodat het slotscherm, het instellen en de pincodevraag dezelfde regels delen.
export function usePinInvoer(
  onVolledig: (pin: string) => Promise<InvoerResultaat>,
  { lengte = PIN_LENGTE, geblokkeerd = false }: Opties = {},
) {
  const [pin, setPin] = useState('');
  const [stand, setStand] = useState<StippenStand>('normaal');
  const [schudTeller, setSchudTeller] = useState(0);
  const [melding, setMelding] = useState<string | null>(null);
  const [bezig, setBezig] = useState(false);

  const pinRef = useRef('');
  const bezigRef = useRef(false);
  const gemount = useRef(true);
  const onVolledigRef = useRef(onVolledig);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    onVolledigRef.current = onVolledig;
  }, [onVolledig]);

  useEffect(() => {
    gemount.current = true;
    return () => {
      gemount.current = false;
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  const leegmaken = useCallback(() => {
    pinRef.current = '';
    bezigRef.current = false;
    setPin('');
    setStand('normaal');
    setBezig(false);
  }, []);

  // Een lopende wachttijd maakt de invoer leeg: wat er half getikt stond hoort er dan niet meer.
  useEffect(() => {
    if (geblokkeerd) {
      if (timer.current) clearTimeout(timer.current);
      leegmaken();
    }
  }, [geblokkeerd, leegmaken]);

  const cijfer = useCallback(
    (c: string) => {
      if (bezigRef.current || geblokkeerd || pinRef.current.length >= lengte) return;
      const nieuw = pinRef.current + c;
      pinRef.current = nieuw;
      setPin(nieuw);
      setMelding(null);
      if (nieuw.length < lengte) return;

      bezigRef.current = true;
      setBezig(true);
      onVolledigRef
        .current(nieuw)
        .then(res => {
          if (!gemount.current) return;
          if (res.soort === 'ok') {
            setStand('succes');
            return;
          }
          if (res.soort === 'wis') {
            leegmaken();
            return;
          }
          haptiek('waarschuwing');
          setStand('fout');
          setSchudTeller(t => t + 1);
          setMelding(res.melding);
          kondigAan(res.melding);
          timer.current = setTimeout(() => {
            if (gemount.current) leegmaken();
          }, FOUT_ZICHTBAAR_MS);
        })
        .catch(() => {
          if (gemount.current) leegmaken();
        });
    },
    [geblokkeerd, lengte, leegmaken],
  );

  const wis = useCallback(() => {
    if (bezigRef.current || pinRef.current.length === 0) return;
    pinRef.current = pinRef.current.slice(0, -1);
    setPin(pinRef.current);
    setMelding(null);
  }, []);

  return { pin, stand, schudTeller, melding, setMelding, bezig, cijfer, wis, leegmaken };
}
