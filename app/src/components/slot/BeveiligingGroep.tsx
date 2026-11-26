import React, { useState } from 'react';
import { StyleSheet, Switch, Text, View } from 'react-native';
import { Fingerprint, KeyRound, Lock } from 'lucide-react-native';
import { useTheme } from '../../theme/ThemeProvider';
import { Type } from '../../theme/typography';
import { spacing } from '../../theme/tokens';
import { LijstGroep } from '../lijst/LijstGroep';
import { LijstRij } from '../lijst/LijstRij';
import { SegmentKnop, type SegmentOptie } from '../SegmentKnop';
import { useSlotIntern, useVergrendeling } from '../../state/VergrendelProvider';
import { BIOMETRIE_MELDING, SLOT_TERMIJNEN, TERMIJN_LABEL, type PinUitkomst, type SlotTermijn } from '../../state/vergrendelTypes';
import { PinVraagSheet } from './SlotLaag';

const TERMIJNEN: SegmentOptie<SlotTermijn>[] = SLOT_TERMIJNEN.map(id => ({ id, label: TERMIJN_LABEL[id] }));

const VOETNOOT_SLOT_AAN =
  'Kader vraagt je pincode bij het openen en nadat de app zo lang op de achtergrond stond. Echte orders vragen altijd om je vingerafdruk of pincode. Vergeet je je pincode, dan herstel je hem met het schermslot van je telefoon; je gegevens blijven staan. In Recente apps ziet niemand je saldo.';
const VOETNOOT_SLOT_UIT =
  'Met een pincode kan niemand anders Kader openen. Zodra je eToro koppelt, is een pincode verplicht.';

const BIOMETRIE_NIET_BESCHIKBAAR = 'Stel eerst een vingerafdruk of gezicht in bij de Android-instellingen.';
const BIOMETRIE_WEGGEVALLEN = 'Staat uit omdat er geen vingerafdruk of gezicht is ingesteld op je telefoon.';

// Instellingen > Beveiliging. Buiten de VergrendelProvider (bijvoorbeeld in een losse preview)
// rendert dit niets in plaats van te crashen: useSlotIntern() geeft daar null, useVergrendeling()
// zou gooien.
export function BeveiligingGroep() {
  const intern = useSlotIntern();
  if (!intern) return null;
  return <BeveiligingGroepInhoud />;
}

function BeveiligingGroepInhoud() {
  const { colors } = useTheme();
  const v = useVergrendeling();
  const [uitzettenOpen, setUitzettenOpen] = useState(false);
  const [bezig, setBezig] = useState(false);
  // Korte uitleg onder de biometrie-rij als aanzetten niet lukte.
  const [bioMelding, setBioMelding] = useState<string | null>(null);

  const slotAan = v.pincodeIngesteld;
  const bio = v.biometrieBeschikbaar;
  const bioOnbeschikbaar = bio !== null && (!bio.hardware || !bio.ingeschreven);
  const bioWeggevallen = bioOnbeschikbaar && v.biometrieAan;

  async function kiesSlot(aan: boolean) {
    if (v.etoroGekoppeld || bezig) return;
    if (!aan) {
      setUitzettenOpen(true);
      return;
    }
    setBezig(true);
    try {
      await v.vraagPinInstellen('optIn');
    } finally {
      setBezig(false);
    }
  }

  async function wijzig() {
    if (bezig) return;
    setBezig(true);
    try {
      await v.vraagPinInstellen('wijzigen');
    } finally {
      setBezig(false);
    }
  }

  async function kiesBiometrie(aan: boolean) {
    setBioMelding(null);
    const uitkomst = await v.zetBiometrie(aan);
    if (aan && uitkomst !== 'ok') setBioMelding(BIOMETRIE_MELDING[uitkomst] ?? null);
  }

  async function uitzetten(pin: string): Promise<PinUitkomst> {
    const u = await v.zetSlotUit(pin);
    if (u.soort === 'etoroGekoppeld') {
      return { soort: 'kluisfout', bericht: 'Zolang eToro gekoppeld is, blijft de pincode verplicht.' };
    }
    return u;
  }

  const bioSub = bioMelding
    ? bioMelding
    : bioWeggevallen
    ? BIOMETRIE_WEGGEVALLEN
    : bioOnbeschikbaar
      ? BIOMETRIE_NIET_BESCHIKBAAR
      : 'Biometrie van dit toestel';

  const slotWaarde = slotAan || v.etoroGekoppeld;

  return (
    <>
      <LijstGroep
        titel="Beveiliging"
        style={styles.groep}
        lijnInspringing={spacing.base}
        voetnoot={slotAan ? VOETNOOT_SLOT_AAN : VOETNOOT_SLOT_UIT}
      >
        <LijstRij
          icoon={Lock}
          titel="App vergrendelen"
          sub={v.etoroGekoppeld ? 'Verplicht zolang eToro gekoppeld is' : 'Pincode bij het openen van Kader'}
          rechts={
            <Switch
              value={slotWaarde}
              onValueChange={kiesSlot}
              disabled={v.etoroGekoppeld || bezig}
              trackColor={{ true: colors.tekstGedimd, false: colors.rand }}
              thumbColor={slotWaarde ? colors.tekstPrimair : colors.verhoogd}
              accessibilityLabel="App vergrendelen"
            />
          }
        />
        {slotAan ? (
          <>
            <LijstRij icoon={KeyRound} titel="Pincode wijzigen" rechts="pijl" onPress={wijzig} />
            <LijstRij
              icoon={Fingerprint}
              titel="Vingerafdruk of gezicht"
              sub={bioSub}
              rechts={
                <Switch
                  value={v.biometrieBruikbaar}
                  onValueChange={aan => {
                    void kiesBiometrie(aan);
                  }}
                  disabled={bioOnbeschikbaar}
                  trackColor={{ true: colors.tekstGedimd, false: colors.rand }}
                  thumbColor={v.biometrieBruikbaar ? colors.tekstPrimair : colors.verhoogd}
                  accessibilityLabel="Vingerafdruk of gezicht"
                />
              }
            />
            <View style={styles.segmentRij}>
              <Text style={[Type.body, styles.rijLabel, { color: colors.tekstPrimair }]}>Opnieuw vergrendelen</Text>
              <SegmentKnop opties={TERMIJNEN} actief={v.termijn} onKies={t => void v.zetTermijn(t)} />
            </View>
          </>
        ) : null}
      </LijstGroep>

      <PinVraagSheet
        zichtbaar={uitzettenOpen}
        titel="Voer je pincode in"
        sub="Om de vergrendeling uit te zetten."
        onPin={uitzetten}
        onKlaar={() => setUitzettenOpen(false)}
        onAnnuleer={() => setUitzettenOpen(false)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  groep: { marginTop: spacing.lg },
  segmentRij: {
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.md,
    gap: spacing.sm,
  },
  rijLabel: { fontWeight: '600' },
});
