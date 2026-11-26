import React, { useCallback, useEffect, useRef, useState } from 'react';
import { BackHandler, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withDelay } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { KeyRound, TriangleAlert } from 'lucide-react-native';
import { KaderLogo } from '../KaderLogo';
import { useTheme } from '../../theme/ThemeProvider';
import { useReduceMotion } from '../../theme/useReduceMotion';
import { duur, vervaag } from '../../theme/beweging';
import { haptiek } from '../../theme/haptiek';
import { Type } from '../../theme/typography';
import {
  BIOMETRIE_MELDING,
  type SlotSchermProps,
  type SlotStand,
} from '../../state/vergrendelTypes';
import { PinInstellenInhoud } from './PinInstellen';
import { PinPaneel, wachtAankondiging } from './PinPaneel';
import { useSlotMaat } from './PinToetsenbord';
import { IcoonCirkel, PrimaireKnop, TekstKnop } from './SlotOnderdelen';
import { kondigAan, pinUitkomstNaarResultaat, usePinInvoer, type InvoerResultaat } from './usePinInvoer';

// Extra's bovenop het contract, allemaal optioneel zodat SlotSchermProps ongewijzigd blijft.
export interface SlotSchermExtra {
  // Wordt aangeroepen als de ontgrendel-animatie (haken dicht, vervagen) klaar is. SlotLaag mag de
  // Modal tot dan laten staan; zonder dit verdwijnt het slot gewoon zodra de status 'open' is.
  onWeg?: () => void;
  // SlotScherm zet hier zijn terugknop-afhandeling in. Een Modal geeft de terugknop aan
  // onRequestClose en niet aan BackHandler, dus SlotLaag roept dit daar aan: het geeft true terug
  // als het scherm de druk verwerkte (een stap terug, of de app sluiten).
  terugRef?: React.MutableRefObject<(() => boolean) | null>;
  // Een nieuwe waarde start een nieuwe slot-episode: de automatische biometrie mag dan opnieuw en
  // het scherm is weer bruikbaar na een eerdere ontgrendeling. Zonder deze prop geldt: één episode
  // per mount, en een terugkeer van 'afdekken' (of een andere stand) naar 'ontgrendelen' na onWeg
  // telt ook als nieuwe episode voor het scherm zelf (wegvervagen terug, invoer leeg).
  episode?: number;
}

type Modus = 'pin' | 'herstelUitleg' | 'herstelInstellen' | 'setupUitleg' | 'setupInstellen';

function beginModus(stand: SlotStand): Modus {
  if (stand === 'herstel') return 'herstelUitleg';
  if (stand === 'setupVerplicht') return 'setupUitleg';
  return 'pin';
}

// Copy uit de bijlage van het plan, letterlijk.
const HERSTEL_TEKST =
  'Bevestig met het schermslot van je telefoon. Daarna kies je een nieuwe pincode voor Kader. Je gegevens blijven staan.';
const MELDING_GEEN_SCHERMSLOT = 'Stel eerst weer een schermslot in op je telefoon, dan kun je je pincode herstellen.';
const SETUP_TEKST = 'Je eToro-koppeling staat op dit toestel. Daarom opent Kader voortaan pas na een pincode.';
const SETUP_TOELICHTING = 'Verwijder je de koppeling, dan hoef je geen pincode in te stellen.';
// De bevestiging hergebruikt de tekst van de bestaande dialoog in de koppelwizard, plus de extra zin.
const VERWIJDER_TEKST =
  'Weet je zeker dat je je opgeslagen eToro-sleutel van dit toestel wilt wissen? Kader importeert en handelt daarna niets meer, niet in demo en niet in echt, tot je opnieuw koppelt. Daarna opent Kader zonder pincode.';
// Niet in de bijlage: de herstelprompt faalde, en de kluis is niet leesbaar.
const MELDING_HERSTEL_FOUT = 'Bevestigen lukte niet. Probeer het opnieuw.';
const MELDING_KOPPELING_NIET_WEG = 'De koppeling is niet verwijderd. Probeer het opnieuw.';
const KLUISFOUT_TITEL = 'Kader kan je pincode niet lezen';
const KLUISFOUT_TEKST =
  'De beveiligde opslag van je telefoon reageert niet. Je gegevens staan er nog. Probeer het opnieuw.';

// Hoe lang de haken dicht mogen gaan voor het scherm vervaagt.
const SLUIT_VERTRAGING_MS = 180;
const SLOT_WEG_SCHAAL = 1.04;

// De inhoud van de slot-Modal. Puur presentatief: SlotLaag geeft stand en functies uit de provider
// mee, deze component houdt alleen lokale invoerstand bij (cijfers, meldingen, welke stap). Geen
// Modal hier: die en zijn onShow horen bij SlotLaag.
export function SlotScherm({
  stand,
  biometrieToets,
  autoBiometrie,
  blokkade,
  onPin,
  onBiometrie,
  onHerstel,
  pinInstellen,
  onKoppelingVerwijderen,
  onOpnieuwProberen,
  onWeg,
  terugRef,
  episode,
}: SlotSchermProps & SlotSchermExtra) {
  const { colors, donkerActief } = useTheme();
  const insets = useSafeAreaInsets();
  const maat = useSlotMaat();
  const reduceMotion = useReduceMotion();

  const [modus, setModus] = useState<Modus>(beginModus(stand));
  const [bevestigVerwijderen, setBevestigVerwijderen] = useState(false);
  const [bezig, setBezig] = useState(false);
  const [uitlegFout, setUitlegFout] = useState<string | null>(null);
  const [bioMelding, setBioMelding] = useState<string | null>(null);
  const [naWachttijd, setNaWachttijd] = useState(false);

  const gemount = useRef(true);
  useEffect(() => {
    gemount.current = true;
    return () => {
      gemount.current = false;
    };
  }, []);

  // De stand komt van buiten. Alleen een overgang naar een andere stand zet de lokale stap terug;
  // wat de gebruiker lokaal opende (de herstel-uitleg via de link) blijft staan.
  useEffect(() => {
    setBevestigVerwijderen(false);
    setUitlegFout(null);
    setModus(vorige => {
      if (stand === 'herstel') return vorige === 'herstelInstellen' ? vorige : 'herstelUitleg';
      if (stand === 'setupVerplicht') return vorige === 'setupInstellen' ? vorige : 'setupUitleg';
      if (stand === 'ontgrendelen') return vorige.startsWith('setup') ? 'pin' : vorige;
      return vorige;
    });
  }, [stand]);

  // ---------- Ontgrendel-animatie ----------
  // Haken dicht (PinStippen), dan vervaagt het hele scherm met een lichte uitzoom naar 1,04.
  const weg = useSharedValue(0);
  const vertrokken = useRef(false);
  const onWegRef = useRef(onWeg);
  useEffect(() => {
    onWegRef.current = onWeg;
  }, [onWeg]);
  // Is onWeg al gemeld? Dan is dit scherm klaar met zijn episode; komt de stand daarna terug op
  // 'ontgrendelen' (SlotScherm bleef gemount), dan zetten we vertrokken en weg terug.
  const wegGemeld = useRef(false);
  const meldWeg = useCallback(() => {
    wegGemeld.current = true;
    onWegRef.current?.();
  }, []);

  const vertrek = useCallback(() => {
    if (vertrokken.current) return;
    vertrokken.current = true;
    weg.value = withDelay(
      reduceMotion ? 0 : SLUIT_VERTRAGING_MS,
      vervaag(1, duur.midden, finished => {
        'worklet';
        if (finished) scheduleOnRN(meldWeg);
      }),
    );
  }, [meldWeg, reduceMotion, weg]);

  const wegStijl = useAnimatedStyle(() => ({
    opacity: 1 - weg.value,
    transform: reduceMotion ? [] : [{ scale: 1 + (SLOT_WEG_SCHAAL - 1) * weg.value }],
  }));

  const geslaagd = useCallback(() => {
    haptiek('succes');
    kondigAan('Ontgrendeld');
    vertrek();
  }, [vertrek]);

  // ---------- Invoer ----------
  const wacht = blokkade != null && blokkade.resterendMs > 0;

  const invoer = usePinInvoer(
    useCallback(
      async (pin: string): Promise<InvoerResultaat> => {
        const u = await onPin(pin);
        if (u.soort === 'ok') geslaagd();
        return pinUitkomstNaarResultaat(u);
      },
      [onPin, geslaagd],
    ),
    { geblokkeerd: wacht },
  );

  // Herbruikbaar na ontgrendelen: nieuwe episode (andere stand en terug, of een nieuwe episode-prop)
  // zet de animatie en de invoer terug.
  const leegmaken = invoer.leegmaken;
  const invoerCijfer = invoer.cijfer;
  useEffect(() => {
    if (stand !== 'ontgrendelen' || !wegGemeld.current) return;
    wegGemeld.current = false;
    vertrokken.current = false;
    weg.value = 0;
    leegmaken();
  }, [stand, episode, weg, leegmaken]);

  // Aankondigen aan het begin en aan het einde van een wachttijd.
  const vorigeWacht = useRef(false);
  const eersteMeting = useRef(true);
  useEffect(() => {
    if (wacht && !vorigeWacht.current) {
      kondigAan(wachtAankondiging(blokkade!.resterendMs));
      setBioMelding(null);
    }
    if (!wacht && vorigeWacht.current && !eersteMeting.current) {
      kondigAan('Probeer het opnieuw.');
      setNaWachttijd(true);
    }
    vorigeWacht.current = wacht;
    eersteMeting.current = false;
  }, [wacht, blokkade]);

  const bioBezig = useRef(false);
  const startBiometrie = useCallback(async () => {
    if (bioBezig.current || vertrokken.current) return;
    bioBezig.current = true;
    try {
      const uitkomst = await onBiometrie();
      if (!gemount.current) return;
      if (uitkomst === 'ok') {
        geslaagd();
        return;
      }
      const melding = BIOMETRIE_MELDING[uitkomst];
      if (melding) {
        setBioMelding(melding);
        kondigAan(melding);
      }
    } finally {
      bioBezig.current = false;
    }
  }, [geslaagd, onBiometrie]);
  // Via een ref, zodat een nieuwe functie-identiteit (elke render van de ouder) de timer hieronder
  // niet wegneemt en het toetsenbord (React.memo) stabiele props houdt.
  const startBioRef = useRef(startBiometrie);
  useEffect(() => {
    startBioRef.current = startBiometrie;
  }, [startBiometrie]);
  const startBio = useCallback(() => {
    startBioRef.current();
  }, []);

  // Automatisch openen, 350 ms nadat SlotLaag het aanzet, één keer per episode. autoGedaan gaat pas
  // in de timer zelf op true: draait het effect binnen die 350 ms opnieuw (de cleanup wist de
  // timer), dan plant het opnieuw in en blijft de prompt niet weg.
  const autoGedaan = useRef(false);
  useEffect(() => {
    autoGedaan.current = false;
  }, [episode]);
  useEffect(() => {
    if (!autoBiometrie || autoGedaan.current || !biometrieToets || stand !== 'ontgrendelen') return;
    const t = setTimeout(() => {
      if (!gemount.current || autoGedaan.current) return;
      autoGedaan.current = true;
      startBioRef.current();
    }, 350);
    return () => clearTimeout(t);
  }, [autoBiometrie, biometrieToets, stand, episode]);

  const cijfer = useCallback(
    (c: string) => {
      setBioMelding(null);
      setNaWachttijd(false);
      invoerCijfer(c);
    },
    [invoerCijfer],
  );

  // ---------- Herstel en verplichte setup ----------
  async function doorgaan() {
    setBezig(true);
    setUitlegFout(null);
    const uitkomst = await onHerstel();
    if (!gemount.current) return;
    setBezig(false);
    if (uitkomst === 'ok') setModus('herstelInstellen');
    else if (uitkomst === 'geenSchermslot') setUitlegFout(MELDING_GEEN_SCHERMSLOT);
    else if (uitkomst === 'fout') setUitlegFout(MELDING_HERSTEL_FOUT);
  }

  async function verwijderKoppeling() {
    setBezig(true);
    setUitlegFout(null);
    try {
      await onKoppelingVerwijderen();
    } catch (e) {
      // De provider gooit als de sleutels er na het wissen nog staan; terug naar de uitleg.
      if (gemount.current) {
        setBevestigVerwijderen(false);
        setUitlegFout(e instanceof Error && e.message ? e.message : MELDING_KOPPELING_NIET_WEG);
      }
    } finally {
      if (gemount.current) setBezig(false);
    }
  }

  async function opnieuwProberen() {
    setBezig(true);
    try {
      await onOpnieuwProberen();
    } finally {
      if (gemount.current) setBezig(false);
    }
  }

  // ---------- Terugknop ----------
  const annuleerInstellen = useCallback(() => {
    pinInstellenAnnuleerRef.current?.();
    setModus(m => (m === 'herstelInstellen' ? (stand === 'herstel' ? 'herstelUitleg' : 'pin') : 'setupUitleg'));
  }, [stand]);
  const pinInstellenAnnuleerRef = useRef(pinInstellen.onAnnuleer);
  useEffect(() => {
    pinInstellenAnnuleerRef.current = pinInstellen.onAnnuleer;
  }, [pinInstellen.onAnnuleer]);

  const terug = useCallback((): boolean => {
    if (stand === 'afdekken') return true;
    if (bevestigVerwijderen) {
      setBevestigVerwijderen(false);
      return true;
    }
    if (modus === 'herstelInstellen' || modus === 'setupInstellen') {
      // Net als de sluitknop in het instellen.
      annuleerInstellen();
      return true;
    }
    if (modus === 'herstelUitleg' && stand !== 'herstel') {
      setModus('pin');
      return true;
    }
    // Geen venster eronder: de terugknop verlaat Kader, hij omzeilt het slot niet.
    BackHandler.exitApp();
    return true;
  }, [annuleerInstellen, bevestigVerwijderen, modus, stand]);

  useEffect(() => {
    if (terugRef) terugRef.current = terug;
    return () => {
      if (terugRef && terugRef.current === terug) terugRef.current = null;
    };
  }, [terug, terugRef]);

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', terug);
    return () => sub.remove();
  }, [terug]);

  // ---------- Weergave ----------
  const logoVariant = donkerActief ? 'donker' : 'licht';
  const wortel = [
    styles.wortel,
    {
      backgroundColor: colors.achtergrond,
      paddingTop: insets.top,
      paddingLeft: insets.left,
      paddingRight: insets.right,
    },
    wegStijl,
  ];

  if (stand === 'afdekken') {
    return (
      <Animated.View
        style={[...wortel, styles.afdek]}
        importantForAccessibility="no-hide-descendants"
        accessibilityElementsHidden
      >
        <KaderLogo size={56} variant={logoVariant} />
      </Animated.View>
    );
  }

  const onderMarge = insets.bottom;

  // Eén indeling voor de uitlegpagina's (verplichte setup, herstel, kluisfout): icoon, titel en tekst
  // in een scrollende kolom, de knoppen vast onderaan.
  const uitleg = (opties: {
    icoon: React.ReactNode;
    titel: string;
    tekst: string;
    fout?: string | null;
    knoppen: React.ReactNode;
    toelichting?: string;
  }) => (
    <View style={styles.vul}>
      {maat.logo > 0 ? (
        <View
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={styles.uitlegLogo}
        >
          <KaderLogo size={40} variant={logoVariant} />
        </View>
      ) : null}
      <ScrollView
        style={styles.uitlegScroll}
        contentContainerStyle={styles.uitlegInhoud}
        showsVerticalScrollIndicator={false}
        overScrollMode="never"
        bounces={false}
      >
        <IcoonCirkel grootte={84}>{opties.icoon}</IcoonCirkel>
        <Text accessibilityRole="header" style={[Type.titel, styles.titel, { color: colors.tekstPrimair }]}>
          {opties.titel}
        </Text>
        <Text style={[Type.body, styles.tekst, { color: colors.tekstGedimd }]}>{opties.tekst}</Text>
        {opties.fout ? (
          <View style={styles.fout}>
            <TriangleAlert size={18} strokeWidth={2} color={colors.letOp} />
            <Text style={[Type.body, { color: colors.tekstGedimd, lineHeight: 22, flexShrink: 1 }]}>{opties.fout}</Text>
          </View>
        ) : null}
      </ScrollView>
      <View style={[styles.knoppen, { paddingBottom: 24 + onderMarge }]}>
        {opties.knoppen}
        {opties.toelichting ? (
          <Text style={[Type.caption, styles.toelichting, { color: colors.tekstGedimd }]}>{opties.toelichting}</Text>
        ) : null}
      </View>
    </View>
  );

  let inhoud: React.ReactNode;

  // De herstel-modi gaan voor de kluisfout-tak: vanaf het kluisfout-scherm kan "Pincode vergeten?"
  // het herstel via het schermslot starten (een blijvend onleesbaar record is anders een doodlopende
  // route; de provider laat stelPinIn na herstel ook bij een kluisfout overschrijven).
  if (stand === 'kluisfout' && modus !== 'herstelUitleg' && modus !== 'herstelInstellen') {
    inhoud = uitleg({
      icoon: <TriangleAlert size={40} strokeWidth={1.75} color={colors.letOp} />,
      titel: KLUISFOUT_TITEL,
      tekst: KLUISFOUT_TEKST,
      knoppen: (
        <>
          <PrimaireKnop label="Opnieuw proberen" bezig={bezig} onPress={opnieuwProberen} />
          <TekstKnop
            label="Pincode vergeten?"
            minHoogte={48}
            uitgeschakeld={bezig}
            onPress={() => {
              setUitlegFout(null);
              setModus('herstelUitleg');
            }}
          />
        </>
      ),
    });
  } else if (modus === 'herstelInstellen' || modus === 'setupInstellen') {
    const reden = modus === 'herstelInstellen' ? 'herstel' : 'setupVerplicht';
    inhoud = (
      <View style={[styles.vul, { paddingBottom: onderMarge }]}>
        <PinInstellenInhoud
          {...pinInstellen}
          reden={reden}
          onAnnuleer={annuleerInstellen}
        />
      </View>
    );
  } else if (modus === 'herstelUitleg') {
    inhoud = uitleg({
      icoon: <KeyRound size={40} strokeWidth={1.75} color={colors.primair} />,
      titel: 'Pincode vergeten?',
      tekst: HERSTEL_TEKST,
      fout: uitlegFout,
      knoppen: (
        <>
          <PrimaireKnop label="Doorgaan" bezig={bezig} onPress={doorgaan} />
          <TekstKnop
            label="Annuleren"
            minHoogte={48}
            uitgeschakeld={bezig}
            onPress={() => {
              setUitlegFout(null);
              setModus('pin');
            }}
          />
        </>
      ),
    });
  } else if (modus === 'setupUitleg' && bevestigVerwijderen) {
    inhoud = uitleg({
      icoon: <TriangleAlert size={40} strokeWidth={1.75} color={colors.letOp} />,
      titel: 'Koppeling verwijderen',
      tekst: VERWIJDER_TEKST,
      knoppen: (
        <>
          <PrimaireKnop label="Verwijderen" kleur={colors.verlies} bezig={bezig} onPress={verwijderKoppeling} />
          <TekstKnop label="Annuleren" minHoogte={48} uitgeschakeld={bezig} onPress={() => setBevestigVerwijderen(false)} />
        </>
      ),
    });
  } else if (modus === 'setupUitleg') {
    inhoud = uitleg({
      icoon: <KeyRound size={40} strokeWidth={1.75} color={colors.primair} />,
      titel: 'Beveilig Kader met een pincode',
      tekst: SETUP_TEKST,
      fout: uitlegFout,
      knoppen: (
        <>
          <PrimaireKnop
            label="Pincode instellen"
            onPress={() => {
              setUitlegFout(null);
              setModus('setupInstellen');
            }}
          />
          <TekstKnop
            label="Koppeling verwijderen"
            kleur={colors.verlies}
            minHoogte={48}
            onPress={() => setBevestigVerwijderen(true)}
          />
        </>
      ),
      toelichting: SETUP_TOELICHTING,
    });
  } else {
    inhoud = (
      <PinPaneel
        titel="Voer je pincode in"
        sub={naWachttijd ? 'Probeer het opnieuw.' : 'Kader is vergrendeld.'}
        melding={
          invoer.melding
            ? { tekst: invoer.melding, soort: 'fout' }
            : bioMelding
              ? { tekst: bioMelding, soort: 'melding' }
              : null
        }
        metLogo
        ingevoerd={invoer.pin.length}
        stippenStand={invoer.stand}
        schudTeller={invoer.schudTeller}
        blokkade={blokkade}
        onCijfer={cijfer}
        onWis={invoer.wis}
        biometrieToets={biometrieToets}
        onBiometrie={startBio}
        bezig={invoer.bezig}
        onderMarge={onderMarge}
        onderStippen={
          <TekstKnop
            label="Pincode vergeten?"
            onPress={() => {
              setUitlegFout(null);
              setModus('herstelUitleg');
            }}
          />
        }
      />
    );
  }

  return (
    <Animated.View style={wortel} accessibilityViewIsModal>
      {inhoud}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wortel: { flex: 1 },
  afdek: { alignItems: 'center', justifyContent: 'center' },
  vul: { flex: 1, alignItems: 'center' },
  uitlegLogo: { marginTop: 32, alignItems: 'center' },
  uitlegScroll: { alignSelf: 'stretch', flex: 1 },
  uitlegInhoud: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40, paddingVertical: 16 },
  titel: { marginTop: 32, textAlign: 'center' },
  tekst: { marginTop: 12, textAlign: 'center', lineHeight: 26 },
  fout: { marginTop: 16, flexDirection: 'row', alignItems: 'center', gap: 8 },
  knoppen: { alignSelf: 'stretch', paddingHorizontal: 16, paddingBottom: 40, gap: 4, alignItems: 'center' },
  toelichting: { paddingHorizontal: 24, textAlign: 'center', marginTop: 4 },
});
