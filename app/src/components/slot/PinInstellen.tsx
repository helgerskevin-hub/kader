import React, { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Check, Fingerprint, TriangleAlert, X } from 'lucide-react-native';
import { Drukbaar } from '../Drukbaar';
import { PodiumScherm } from '../PodiumScherm';
import { useTheme } from '../../theme/ThemeProvider';
import { haptiek } from '../../theme/haptiek';
import { Type } from '../../theme/typography';
import {
  BIOMETRIE_MELDING,
  PIN_LENGTE,
  type BlokkadeWeergave,
  type PinInstellenInhoudProps,
  type PinUitkomst,
} from '../../state/vergrendelTypes';
import { PinPaneel, wachtAankondiging } from './PinPaneel';
import { IcoonCirkel, PrimaireKnop, StatusRegel, TekstKnop } from './SlotOnderdelen';
import {
  kondigAan,
  meldingBijFoutePin,
  MELDING_KLUISFOUT,
  pinUitkomstNaarResultaat,
  usePinInvoer,
  type InvoerResultaat,
} from './usePinInvoer';

// Copy uit de bijlage van het plan, letterlijk.
const SUB_KIES = 'Zes cijfers. Je voert ze in om Kader te openen.';
const MELDING_ZWAK = 'Die pincode is te makkelijk te raden. Kies een andere.';
const MELDING_VERSCHILT = 'De pincodes komen niet overeen. Kies opnieuw.';
// Niet in de bijlage: de plekken waar opslaan zelf mislukt.
const MELDING_GEWEIGERD = 'Kader kon je pincode niet opslaan. Probeer het opnieuw.';

// Hoe lang "Pincode ingesteld" blijft staan voor het biometrie-aanbod of het einde volgt.
const KLAAR_ZICHTBAAR_MS = 1200;
// Na een goede pincode in PinVraagInhoud eerst de haken laten sluiten.
const OK_ZICHTBAAR_MS = 320;

// De sluitknop linksboven (44 dp), zoals in de mockup van het instellen.
function Bovenbalk({ onSluiten }: { onSluiten?: () => void }) {
  const { colors } = useTheme();
  return (
    <View style={styles.bovenbalk}>
      {onSluiten ? (
        <Drukbaar
          accessibilityRole="button"
          accessibilityLabel="Sluiten"
          onPress={onSluiten}
          schaal={0.9}
          style={styles.sluit}
        >
          <X size={24} strokeWidth={2} color={colors.tekstPrimair} />
        </Drukbaar>
      ) : null}
    </View>
  );
}

// ---------- Pincode vragen (huidige pincode, uitzetten, terugval bij een order) ----------

export interface PinVraagInhoudProps {
  titel: string;
  sub?: string;
  // Controleert de ingevoerde pincode (ontgrendelMetPin, controleerHuidigePin, zetSlotUit, ...).
  onPin(pin: string): Promise<PinUitkomst>;
  // Na een goede pincode, als de haken gesloten zijn.
  onKlaar(): void;
  onAnnuleer?(): void;
  // Een melding om mee te beginnen (bijvoorbeeld "Onjuiste pincode." na een terugsprong).
  beginMelding?: string;
  // Er loopt al een wachttijd bij het openen (ms): meteen de wachtstaat tonen (en aankondigen),
  // zonder dat er eerst zes cijfers voor niets ingetikt worden.
  beginBlokkadeMs?: number;
  // De volle duur van die trede (ms), voor de weergave. Ontbreekt hij, dan geldt de rest.
  beginBlokkadeDuurMs?: number;
}

// Eén pagina met stippen en toetsenbord die om een bestaande pincode vraagt. Hergebruikt door de
// eerste stap van "Pincode wijzigen", "App vergrendelen uitzetten" en de pincodevraag bij een
// order (SlotLaag). Een wachttijd wordt hier lokaal afgeteld vanaf de uitkomst 'geblokkeerd'.
export function PinVraagInhoud({
  titel,
  sub,
  onPin,
  onKlaar,
  onAnnuleer,
  beginMelding,
  beginBlokkadeMs,
  beginBlokkadeDuurMs,
}: PinVraagInhoudProps) {
  const [blok, setBlok] = useState<{ tot: number; duurMs: number } | null>(() =>
    beginBlokkadeMs && beginBlokkadeMs > 0
      ? {
          tot: Date.now() + beginBlokkadeMs,
          duurMs: Math.max(beginBlokkadeMs, beginBlokkadeDuurMs ?? 0),
        }
      : null,
  );
  useEffect(() => {
    if (beginBlokkadeMs && beginBlokkadeMs > 0) kondigAan(wachtAankondiging(beginBlokkadeMs));
    // Alleen bij het mounten.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [nu, setNu] = useState(Date.now());
  const okTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (okTimer.current) clearTimeout(okTimer.current);
    },
    [],
  );

  const invoer = usePinInvoer(
    useCallback(
      async (pin: string): Promise<InvoerResultaat> => {
        const u = await onPin(pin);
        if (u.soort === 'geblokkeerd') {
          setNu(Date.now());
          setBlok({ tot: Date.now() + u.resterendMs, duurMs: u.resterendMs });
          kondigAan(wachtAankondiging(u.resterendMs));
        }
        if (u.soort === 'ok') {
          haptiek('succes');
          kondigAan('Pincode juist');
          okTimer.current = setTimeout(onKlaar, OK_ZICHTBAAR_MS);
        }
        return pinUitkomstNaarResultaat(u);
      },
      [onPin, onKlaar],
    ),
    { geblokkeerd: blok != null },
  );

  useEffect(() => {
    if (beginMelding) invoer.setMelding(beginMelding);
    // Alleen bij het mounten.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!blok) return;
    const t = setInterval(() => {
      const nieuw = Date.now();
      setNu(nieuw);
      if (nieuw >= blok.tot) {
        setBlok(null);
        kondigAan('Probeer het opnieuw.');
      }
    }, 1000);
    return () => clearInterval(t);
  }, [blok]);

  const blokkade: BlokkadeWeergave | null = blok
    ? { resterendMs: Math.max(0, blok.tot - nu), duurMs: blok.duurMs }
    : null;

  return (
    <PinPaneel
      titel={titel}
      sub={sub}
      melding={invoer.melding ? { tekst: invoer.melding, soort: 'fout' } : null}
      bovenbalk={<Bovenbalk onSluiten={onAnnuleer} />}
      ingevoerd={invoer.pin.length}
      stippenStand={invoer.stand}
      schudTeller={invoer.schudTeller}
      blokkade={blokkade}
      onCijfer={invoer.cijfer}
      onWis={invoer.wis}
      bezig={invoer.bezig}
    />
  );
}

// ---------- Pincode instellen ----------

// Extra prop naast het contract: een plek met een eigen Android-terugknop (de koppelwizard) kan
// hiermee eerst een stap terug binnen het instellen doen. terugRef.current() geeft true als hij een
// stap terugging (van 'herhaal' naar 'kies'), false als de plek zelf terug moet.
export type PinInstellenInhoudExtraProps = PinInstellenInhoudProps & {
  terugRef?: React.MutableRefObject<(() => boolean) | null>;
};

type Stap = 'geenSlot' | 'huidige' | 'kies' | 'herhaal' | 'klaar' | 'aanbod';

// Alle stappen van een pincode instellen, wijzigen of herstellen: (huidige), kiezen, herhalen,
// klaar, en daarna het biometrie-aanbod. Praat niet zelf met de provider: de plek die hem toont
// geeft de functies mee (PinInstellenInhoudProps). Staat inline in de koppelwizard, in
// SlotScherm en in PinInstellenSheet.
export function PinInstellenInhoud({
  reden,
  keurPin,
  onControleerHuidige,
  onOpslaan,
  toestelBeveiligd,
  biometrieAanbod,
  onKlaar,
  onAnnuleer,
  terugRef,
}: PinInstellenInhoudExtraProps) {
  const { colors } = useTheme();
  const wijzigen = reden === 'wijzigen';
  const [stap, setStap] = useState<Stap>(
    !toestelBeveiligd ? 'geenSlot' : wijzigen && onControleerHuidige ? 'huidige' : 'kies',
  );
  const [huidigeMelding, setHuidigeMelding] = useState<string | undefined>(undefined);
  const [aanbodBezig, setAanbodBezig] = useState(false);
  const [aanbodMelding, setAanbodMelding] = useState<string | null>(null);

  const stapRef = useRef<Stap>(stap);
  const gekozen = useRef('');
  const huidige = useRef<string | undefined>(undefined);
  const gemount = useRef(true);
  useEffect(() => {
    gemount.current = true;
    return () => {
      gemount.current = false;
    };
  }, []);

  const naarStap = useCallback((s: Stap) => {
    stapRef.current = s;
    setStap(s);
  }, []);

  // Verwerkt een volledige invoer, afhankelijk van de stap (kiezen of herhalen).
  const sla = useCallback(
    async (pin: string): Promise<InvoerResultaat> => {
      if (stapRef.current === 'kies') {
        const keuring = keurPin(pin);
        if (keuring === 'zwak') return { soort: 'fout', melding: MELDING_ZWAK };
        if (keuring === 'ongeldig') return { soort: 'wis' };
        gekozen.current = pin;
        naarStap('herhaal');
        return { soort: 'wis' };
      }

      // herhaal
      if (pin !== gekozen.current) {
        gekozen.current = '';
        naarStap('kies');
        return { soort: 'fout', melding: MELDING_VERSCHILT };
      }
      const u = await onOpslaan(pin, huidige.current);
      if (!gemount.current) return { soort: 'wis' };
      gekozen.current = '';
      switch (u.soort) {
        case 'ok':
          naarStap('klaar');
          return { soort: 'wis' };
        case 'zwak':
          naarStap('kies');
          return { soort: 'fout', melding: MELDING_ZWAK };
        case 'ongeldig':
          naarStap('kies');
          return { soort: 'wis' };
        case 'geweigerd':
          naarStap('kies');
          return { soort: 'fout', melding: MELDING_GEWEIGERD };
        case 'kluisfout':
          naarStap('kies');
          return { soort: 'fout', melding: MELDING_KLUISFOUT };
        case 'fout':
          // De huidige pincode klopte bij het opslaan toch niet meer: terug naar die vraag.
          huidige.current = undefined;
          setHuidigeMelding(meldingBijFoutePin(u.resterendTotBlokkade));
          naarStap('huidige');
          return { soort: 'wis' };
        case 'geblokkeerd':
          huidige.current = undefined;
          setHuidigeMelding(undefined);
          naarStap('huidige');
          return { soort: 'wis' };
      }
    },
    [keurPin, naarStap, onOpslaan],
  );

  const invoer = usePinInvoer(sla);

  // Android-terug: van herhalen naar kiezen, met een lege invoer. Elders beslist de plek zelf.
  const { leegmaken, setMelding } = invoer;
  useEffect(() => {
    if (!terugRef) return;
    terugRef.current = () => {
      if (stapRef.current !== 'herhaal' || invoer.bezig) return false;
      gekozen.current = '';
      leegmaken();
      setMelding(null);
      naarStap('kies');
      return true;
    };
    return () => {
      terugRef.current = null;
    };
  }, [terugRef, leegmaken, setMelding, naarStap, invoer.bezig]);

  // "Pincode ingesteld": een succesmoment, daarna het aanbod of het einde.
  useEffect(() => {
    if (stap !== 'klaar') return;
    haptiek('succes');
    kondigAan('Pincode ingesteld');
    const t = setTimeout(() => {
      if (!gemount.current) return;
      if (biometrieAanbod) naarStap('aanbod');
      else onKlaar();
    }, KLAAR_ZICHTBAAR_MS);
    return () => clearTimeout(t);
    // onKlaar en biometrieAanbod bewust niet als afhankelijkheid: de timer start één keer per stap.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stap]);

  if (stap === 'geenSlot') {
    return (
      <View style={styles.vul}>
        <Bovenbalk onSluiten={onAnnuleer} />
        <View style={styles.midden}>
          <IcoonCirkel grootte={84}>
            <TriangleAlert size={40} strokeWidth={1.75} color={colors.letOp} />
          </IcoonCirkel>
          <Text accessibilityRole="header" style={[Type.titel, styles.titel, { color: colors.tekstPrimair }]}>
            Stel eerst een schermslot in
          </Text>
          <Text style={[Type.body, styles.tekst, { color: colors.tekstGedimd }]}>
            Zonder schermslot op je telefoon kan Kader een vergeten pincode niet herstellen. Stel een pincode,
            patroon of vingerafdruk in bij de Android-instellingen en probeer het daarna opnieuw.
          </Text>
        </View>
        <View style={styles.knoppen}>
          <PrimaireKnop label="Begrepen" onPress={() => onAnnuleer?.()} />
        </View>
      </View>
    );
  }

  if (stap === 'huidige') {
    return (
      <PinVraagInhoud
        titel="Voer je huidige pincode in"
        sub="Daarna kies je een nieuwe."
        beginMelding={huidigeMelding}
        onAnnuleer={onAnnuleer}
        onPin={async pin => {
          const u = await onControleerHuidige!(pin);
          if (u.soort === 'ok') huidige.current = pin;
          return u;
        }}
        onKlaar={() => {
          setHuidigeMelding(undefined);
          naarStap('kies');
        }}
      />
    );
  }

  if (stap === 'klaar') {
    return (
      <View style={styles.vul}>
        <View style={styles.midden}>
          <IcoonCirkel grootte={84}>
            <Check size={40} strokeWidth={2} color={colors.winst} />
          </IcoonCirkel>
          <Text accessibilityRole="header" style={[Type.titel, styles.titel, { color: colors.tekstPrimair }]}>
            Pincode ingesteld
          </Text>
          <Text style={[Type.body, styles.tekst, { color: colors.tekstGedimd }]}>
            Kader vraagt hem voortaan bij het openen.
          </Text>
        </View>
      </View>
    );
  }

  if (stap === 'aanbod' && biometrieAanbod) {
    return (
      <View style={styles.vul}>
        <View style={styles.midden}>
          <IcoonCirkel grootte={96}>
            <Fingerprint size={46} strokeWidth={1.75} color={colors.primair} />
          </IcoonCirkel>
          <Text accessibilityRole="header" style={[Type.titel, styles.titel, { color: colors.tekstPrimair }]}>
            Ontgrendel met vingerafdruk of gezicht
          </Text>
          <Text style={[Type.body, styles.tekst, { color: colors.tekstGedimd }]}>
            Je hoeft je pincode dan niet elke keer in te voeren. De pincode blijft altijd beschikbaar als terugval.
          </Text>
          {aanbodMelding ? (
            <View style={{ marginTop: 12 }}>
              <StatusRegel tekst={aanbodMelding} soort="melding" />
            </View>
          ) : null}
        </View>
        <View style={styles.knoppen}>
          <PrimaireKnop
            label="Zet biometrie aan"
            bezig={aanbodBezig}
            onPress={async () => {
              setAanbodBezig(true);
              setAanbodMelding(null);
              const uitkomst = await biometrieAanbod.onZetAan();
              if (!gemount.current) return;
              setAanbodBezig(false);
              if (uitkomst === 'ok') {
                onKlaar();
                return;
              }
              // Geannuleerd: gewoon op dezelfde pagina blijven, zonder verwijt.
              const melding = BIOMETRIE_MELDING[uitkomst];
              if (melding) setAanbodMelding(melding);
            }}
          />
          <TekstKnop label="Niet nu" uitgeschakeld={aanbodBezig} onPress={onKlaar} minHoogte={48} />
        </View>
      </View>
    );
  }

  // kies en herhaal
  const kiesTitel = wijzigen && onControleerHuidige ? 'Kies een nieuwe pincode' : 'Kies een pincode';
  return (
    <PinPaneel
      titel={stap === 'herhaal' ? 'Herhaal je pincode' : kiesTitel}
      sub={stap === 'herhaal' ? 'Voer dezelfde zes cijfers nog een keer in.' : SUB_KIES}
      melding={invoer.melding ? { tekst: invoer.melding, soort: 'fout' } : null}
      bovenbalk={<Bovenbalk onSluiten={onAnnuleer} />}
      lengte={PIN_LENGTE}
      ingevoerd={invoer.pin.length}
      stippenStand={invoer.stand}
      schudTeller={invoer.schudTeller}
      onCijfer={invoer.cijfer}
      onWis={invoer.wis}
      bezig={invoer.bezig}
    />
  );
}

// ---------- In een eigen scherm ----------

export interface PinInstellenSheetProps extends Omit<PinInstellenInhoudProps, 'onKlaar' | 'onAnnuleer'> {
  zichtbaar: boolean;
  // Na het sluiten, als er een pincode is ingesteld (of gewijzigd).
  onKlaar(): void;
  // Na het sluiten zonder iets op te slaan.
  onAnnuleer(): void;
}

// PinInstellenInhoud in een PodiumScherm, voor de plekken die geen eigen scherm hebben
// (onboarding, Instellingen, "Nieuw in Kader"). Een eigen sheet-basis dus, geen kale Modal.
export function PinInstellenSheet({ zichtbaar, onKlaar, onAnnuleer, ...rest }: PinInstellenSheetProps) {
  const uitkomst = useRef<'klaar' | 'annuleer'>('annuleer');
  useEffect(() => {
    if (zichtbaar) uitkomst.current = 'annuleer';
  }, [zichtbaar]);

  return (
    <PodiumScherm
      zichtbaar={zichtbaar}
      onSluiten={() => (uitkomst.current === 'klaar' ? onKlaar() : onAnnuleer())}
    >
      {sluit => (
        <PinInstellenInhoud
          {...rest}
          onKlaar={() => {
            uitkomst.current = 'klaar';
            sluit({ naarBron: false });
          }}
          onAnnuleer={() => {
            uitkomst.current = 'annuleer';
            sluit();
          }}
        />
      )}
    </PodiumScherm>
  );
}

const styles = StyleSheet.create({
  vul: { flex: 1, alignItems: 'center' },
  bovenbalk: { height: 56, alignSelf: 'stretch', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8 },
  sluit: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  midden: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40 },
  titel: { marginTop: 32, textAlign: 'center' },
  tekst: { marginTop: 12, textAlign: 'center', lineHeight: 26 },
  knoppen: { alignSelf: 'stretch', paddingHorizontal: 16, paddingBottom: 40, gap: 4 },
});
