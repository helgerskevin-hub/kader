// Een CopyTrader-relatie stoppen. eToro verkoopt dan alle gekopieerde posities en zet het geld
// terug op je saldo. Geldpad: één bevestiging, nooit automatisch herhalen.
import React, { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { X } from 'lucide-react-native';
import { BottomSheet } from '../BottomSheet';
import { OrderBevestigKnop, useGeluktMoment } from '../OrderBevestigKnop';
import { useTheme } from '../../theme/ThemeProvider';
import { Type } from '../../theme/typography';
import { spacing } from '../../theme/tokens';
import { guid } from '../../engine/etoro';
import { stopCopy } from '../../engine/etoroTraders';
import { actieveSleutels } from '../../state/etoroSleutels';
import { usePortfolio } from '../../state/PortfolioProvider';
import { useDialoog } from '../../state/DialoogProvider';

interface Props {
  doel: { mirrorId: number; username: string } | null;
  onSluiten: () => void;
  onGestopt: () => void;
}

export function StopCopySheet({ doel, onSluiten, onGestopt }: Props) {
  const { colors } = useTheme();
  const { omgeving, magHandelen, verzoenNaOrder } = usePortfolio();
  const { toonDialoog } = useDialoog();
  const [bezig, setBezig] = useState(false);
  const [fout, setFout] = useState('');
  const verzoekId = useRef(guid());
  const loopt = useRef(false);
  const { gelukt, vier, wis } = useGeluktMoment(onSluiten);

  useEffect(() => {
    if (!doel) return;
    verzoekId.current = guid();
    setFout('');
    setBezig(false);
    loopt.current = false;
    wis();
  }, [doel]);

  async function bevestig() {
    if (!doel || loopt.current) return;
    loopt.current = true;
    setBezig(true);
    setFout('');
    const sleutels = await actieveSleutels();
    if (!sleutels || (sleutels.omgeving ?? 'real') !== omgeving) {
      setFout('Je omgeving is net gewisseld. Sluit dit venster en open het opnieuw.');
      setBezig(false);
      loopt.current = false;
      return;
    }
    const uitkomst = await stopCopy(doel.mirrorId, sleutels, verzoekId.current);
    if (uitkomst.soort === 'fout') {
      setFout(uitkomst.bericht);
      setBezig(false);
      loopt.current = false;
      return;
    }
    verzoenNaOrder();
    onGestopt();
    if (uitkomst.soort === 'onbekend') {
      setBezig(false);
      onSluiten();
      toonDialoog({
        variant: 'waarschuwing',
        rondje: 'onzeker',
        titel: 'Niet zeker of de copy is gestopt',
        tekst: `eToro gaf geen duidelijk antwoord. Kijk in eToro of de copy van ${doel.username} er nog staat. Kader verstuurt het verzoek niet opnieuw.`,
        knoppen: [{ label: 'Oké' }],
      });
      return;
    }
    vier(() => {
      onSluiten();
      toonDialoog({
        variant: 'gelukt',
        rondje: 'gelukt',
        titel: 'Stoppen is doorgegeven',
        tekst: `eToro sluit de copy van ${doel.username} en zet het geld terug op je saldo. Dat kan even duren.`,
        knoppen: [{ label: 'Oké' }],
      });
    });
  }

  return (
    <BottomSheet zichtbaar={doel !== null} onSluiten={onSluiten}>
      <View style={styles.inhoud}>
        <View style={styles.titelRij}>
          <Text style={[Type.titel, styles.flex, { color: colors.tekstPrimair }]}>Copy van {doel?.username} stoppen</Text>
          <Pressable onPress={onSluiten} accessibilityRole="button" accessibilityLabel="Sluiten" style={styles.sluitKnop}>
            <X size={20} color={colors.tekstGedimd} strokeWidth={1.75} />
          </Pressable>
        </View>
        <Text style={[Type.body, { color: colors.tekstGedimd, lineHeight: 22 }]}>
          eToro verkoopt alle gekopieerde posities tegen de marktprijs en zet het geld terug op je saldo.
        </Text>
        {!magHandelen && (
          <Text style={[Type.caption, { color: colors.verlies }]}>Koppel eToro met schrijfrecht om te stoppen, of stop de copy in eToro.</Text>
        )}
        {fout ? <Text style={[Type.caption, { color: colors.verlies, lineHeight: 18 }]}>{fout}</Text> : null}
        <OrderBevestigKnop
          label="Stop copy"
          omgeving={omgeving}
          bezig={bezig}
          uitgeschakeld={!magHandelen || !doel}
          onBevestig={bevestig}
          gelukt={gelukt}
        />
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  inhoud: { gap: spacing.md },
  titelRij: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  flex: { flex: 1 },
  sluitKnop: { minHeight: 44, minWidth: 44, alignItems: 'flex-end', justifyContent: 'center' },
});
