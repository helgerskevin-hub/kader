import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { X } from 'lucide-react-native';
import { BottomSheet } from './BottomSheet';
import { Drukbaar } from './Drukbaar';
import { SegmentKnop, type SegmentOptie } from './SegmentKnop';
import { useTheme } from '../theme/ThemeProvider';
import { Type } from '../theme/typography';
import { spacing, radii } from '../theme/tokens';
import { haptiek } from '../theme/haptiek';
import type { PortfolioTrade } from '../state/portfolioTypes';
import { beschikbareJaren, bouwJaaroverzicht, isEchtGeld, type Jaaroverzicht } from '../state/export';
import { deelCsv, deelPdf, haalExportKoersen } from '../state/exportDelen';

interface Props {
  zichtbaar: boolean;
  // De trades uit de provider horen bij de actieve omgeving. In Demo staan de echte trades er dus
  // niet in, en dan is er niets betrouwbaars om te exporteren.
  trades: PortfolioTrade[];
  omgeving: 'real' | 'demo';
  onSluiten: () => void;
}

// Meer knoppen passen niet naast elkaar zonder dat de labels krimpen; oudere jaren vallen af.
const MAX_JAREN = 4;

type Bezig = 'csv' | 'pdf' | null;

export function ExportSheet({ zichtbaar, trades, omgeving, onSluiten }: Props) {
  const { colors } = useTheme();
  const echt = useMemo(() => trades.filter(isEchtGeld), [trades]);
  const jaren = useMemo(() => beschikbareJaren(echt).slice(0, MAX_JAREN), [echt]);
  const [jaar, setJaar] = useState<number>(jaren[0]);
  const [bezig, setBezig] = useState<Bezig>(null);
  const [fout, setFout] = useState<string | null>(null);

  useEffect(() => {
    if (zichtbaar) { setJaar(jaren[0]); setFout(null); }
  }, [zichtbaar, jaren]);

  const opties: SegmentOptie<string>[] = jaren.map(j => ({ id: String(j), label: String(j) }));
  const inDemo = omgeving === 'demo';

  const deel = async (soort: 'csv' | 'pdf') => {
    if (bezig) return;
    setBezig(soort);
    setFout(null);
    haptiek('tik');
    try {
      const koersen = await haalExportKoersen(echt.map(t => t.symbool));
      const overzicht: Jaaroverzicht = bouwJaaroverzicht(echt, jaar, koersen);
      if (soort === 'csv') await deelCsv(overzicht); else await deelPdf(overzicht);
    } catch {
      setFout('Delen is niet gelukt. Probeer het opnieuw.');
    } finally {
      setBezig(null);
    }
  };

  const knop = (soort: 'csv' | 'pdf', label: string) => (
    <Drukbaar
      onPress={() => deel(soort)}
      disabled={inDemo || bezig !== null}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={[styles.knop, { backgroundColor: inDemo ? colors.verhoogd : colors.cta, opacity: bezig !== null && bezig !== soort ? 0.5 : 1 }]}
    >
      {bezig === soort
        ? <ActivityIndicator color="white" />
        : <Text style={[Type.body, { color: inDemo ? colors.tekstGedimd : 'white', fontWeight: '600' }]}>{label}</Text>}
    </Drukbaar>
  );

  return (
    <BottomSheet zichtbaar={zichtbaar} onSluiten={onSluiten}>
      <View style={styles.inhoud}>
        <View style={styles.titelRij}>
          <Text style={[Type.titel, { color: colors.tekstPrimair }]}>Exporteren</Text>
          <Drukbaar onPress={onSluiten} accessibilityRole="button" accessibilityLabel="Sluiten" style={styles.sluitKnop}>
            <X size={20} color={colors.tekstGedimd} strokeWidth={1.75} />
          </Drukbaar>
        </View>

        <Text style={[Type.body, { color: colors.tekstGedimd, lineHeight: 22 }]}>
          Je afgesloten trades per jaar, met de waarde van je open posities op 1 januari. Demo-trades
          gaan nooit mee, alleen echt geld.
        </Text>

        {inDemo ? (
          <Text style={[Type.body, { color: colors.tekstPrimair, lineHeight: 22 }]}>
            Je kijkt nu naar Demo. Schakel naar Echt om je echte trades te exporteren.
          </Text>
        ) : (
          <>
            <SegmentKnop opties={opties} actief={String(jaar)} onKies={id => { setJaar(Number(id)); haptiek('tik'); }} />
            {knop('csv', 'CSV delen')}
            {knop('pdf', 'PDF-jaaroverzicht delen')}
            {bezig !== null && (
              <Text style={[Type.caption, { color: colors.tekstGedimd }]}>Koersen van 1 januari ophalen...</Text>
            )}
          </>
        )}

        {fout && <Text style={[Type.caption, { color: colors.tekstPrimair }]}>{fout}</Text>}

        <Text style={[Type.caption, { color: colors.tekstGedimd, lineHeight: 18 }]}>
          Eurobedragen gebruiken de EUR/USD-koers van de betreffende dag. Is die niet te vinden, dan
          blijft het veld leeg of staat er "koers onbekend". Kader geeft geen belastingadvies.
        </Text>
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  inhoud: { gap: spacing.base },
  titelRij: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sluitKnop: { minHeight: 44, minWidth: 44, alignItems: 'flex-end', justifyContent: 'center' },
  knop: { alignItems: 'center', justifyContent: 'center', borderRadius: radii.knop, minHeight: 48 },
});
