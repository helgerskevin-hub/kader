import React, { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { KaderLogo } from '../KaderLogo';
import { useTheme } from '../../theme/ThemeProvider';
import { Type } from '../../theme/typography';
import { PIN_LENGTE, type BlokkadeWeergave } from '../../state/vergrendelTypes';
import { PinStippen, aftellingInWoorden, type StippenStand } from './PinStippen';
import { PinToetsenbord, useSlotMaat } from './PinToetsenbord';
import { StatusRegel, type StatusSoort } from './SlotOnderdelen';

interface Props {
  titel: string;
  // De regel onder de titel als er geen melding is ("Kader is vergrendeld.").
  sub?: string;
  // Een melding (foute pincode, biometrie) vervangt de sub.
  melding?: { tekst: string; soort: StatusSoort } | null;
  // Het merklogo boven de titel (alleen het slotscherm). Valt weg op lage schermen.
  metLogo?: boolean;
  // Bovenbalk, bijvoorbeeld de sluitknop van het instellen.
  bovenbalk?: React.ReactNode;
  // Tussen stippen en toetsenbord: de link "Pincode vergeten?".
  onderStippen?: React.ReactNode;
  // Invoerstand (uit usePinInvoer).
  ingevoerd: number;
  stippenStand: StippenStand;
  schudTeller: number;
  lengte?: number;
  // Een lopende wachttijd: titel en sub worden die van de wachtstaat, de cijfertoetsen gedimd.
  blokkade?: BlokkadeWeergave | null;
  onCijfer(c: string): void;
  onWis(): void;
  biometrieToets?: boolean;
  onBiometrie?(): void;
  // Na het zesde cijfer, zolang de controle loopt (de KDF kost op de emulator 0,3 tot 1,7 s). Na
  // BEZIG_NA_MS verschijnt in de statusregel een draaiertje, zodat het scherm niet bevroren lijkt.
  bezig?: boolean;
  // Extra ruimte onderaan (bijvoorbeeld de gesturebalk), bovenop de standaard 32.
  onderMarge?: number;
}

// De gedeelde indeling van elk pagina met stippen en toetsenbord, van boven naar onder: logo, titel,
// statusregel (48 dp), stippen, link, toetsenbord. Alleen de kop (logo, titel, status) scrolt, zodat
// bij een grote lettergrootte de stippen en toetsen op hun plek blijven.
export function PinPaneel({
  titel,
  sub,
  melding,
  metLogo = false,
  bovenbalk,
  onderStippen,
  ingevoerd,
  stippenStand,
  schudTeller,
  lengte = PIN_LENGTE,
  blokkade = null,
  onCijfer,
  onWis,
  biometrieToets,
  onBiometrie,
  bezig,
  onderMarge = 0,
}: Props) {
  const { colors, donkerActief } = useTheme();
  const maat = useSlotMaat();
  const wacht = blokkade != null && blokkade.resterendMs > 0;

  // Pas na een korte pauze, zodat een snelle stap (kiezen, een snelle telefoon) niet flitst. Alleen
  // in de normale stand: bij succes of fout vertellen de stippen het al.
  const [toonBezig, setToonBezig] = useState(false);
  const controleert = !!bezig && stippenStand === 'normaal' && !wacht;
  useEffect(() => {
    if (!controleert) {
      setToonBezig(false);
      return;
    }
    const t = setTimeout(() => setToonBezig(true), BEZIG_NA_MS);
    return () => clearTimeout(t);
  }, [controleert]);

  const toonTitel = wacht ? 'Even wachten' : titel;
  const toonStatus = wacht
    ? { tekst: 'Te veel onjuiste pogingen. Probeer het opnieuw over', soort: 'info' as StatusSoort }
    : melding ?? { tekst: sub ?? '', soort: 'info' as StatusSoort };

  return (
    <View style={styles.vul}>
      {bovenbalk}
      <ScrollView
        style={styles.kopScroll}
        contentContainerStyle={styles.kop}
        showsVerticalScrollIndicator={false}
        overScrollMode="never"
        bounces={false}
      >
        {metLogo && maat.logo > 0 ? (
          <View
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            style={{ marginBottom: 16 }}
          >
            <KaderLogo size={maat.logo} variant={donkerActief ? 'donker' : 'licht'} />
          </View>
        ) : null}
        <Text
          accessibilityRole="header"
          style={[Type.titel, { color: colors.tekstPrimair, textAlign: 'center', paddingHorizontal: 24 }]}
        >
          {toonTitel}
        </Text>
        {toonBezig && controleert && !melding ? (
          <View style={styles.bezig}>
            <ActivityIndicator
              color={colors.tekstGedimd}
              accessibilityLabel="Pincode wordt gecontroleerd"
            />
          </View>
        ) : (
          <StatusRegel tekst={toonStatus.tekst} soort={toonStatus.soort} />
        )}
      </ScrollView>

      <View style={styles.stippen}>
        <PinStippen
          ingevoerd={ingevoerd}
          lengte={lengte}
          stand={stippenStand}
          schudTeller={schudTeller}
          wachtMs={wacht ? blokkade!.resterendMs : null}
        />
      </View>
      {onderStippen ? <View style={styles.onderStippen}>{onderStippen}</View> : <View style={{ height: 24 }} />}

      <View style={{ height: maat.logo === 0 ? 8 : 16 }} />
      <PinToetsenbord
        onCijfer={onCijfer}
        onWis={onWis}
        biometrieToets={biometrieToets}
        onBiometrie={onBiometrie}
        gedimd={wacht}
        leeg={ingevoerd === 0}
        bezig={bezig}
      />
      <View style={{ height: 32 + onderMarge }} />
    </View>
  );
}

// Voor schermlezers bij het begin van een wachttijd.
export function wachtAankondiging(ms: number): string {
  return `Even wachten. Te veel onjuiste pogingen. Probeer het opnieuw over ${aftellingInWoorden(ms)}.`;
}

const BEZIG_NA_MS = 150;

const styles = StyleSheet.create({
  bezig: { height: 48, alignItems: 'center', justifyContent: 'center' },
  vul: { flex: 1, alignItems: 'center' },
  kopScroll: { alignSelf: 'stretch', flex: 1 },
  kop: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 8 },
  stippen: { marginTop: 8, alignItems: 'center' },
  onderStippen: { minHeight: 44, marginTop: 8, alignItems: 'center', justifyContent: 'center' },
});
