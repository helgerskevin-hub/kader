import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, Pressable, ScrollView, StyleSheet } from 'react-native';
import { X } from 'lucide-react-native';
import { BottomSheet } from './BottomSheet';
import { useTheme } from '../theme/ThemeProvider';
import { Type } from '../theme/typography';
import { spacing, radii } from '../theme/tokens';
import { DoelRegel, Doelverdeling } from '../engine/doelstelling';

interface Props {
  zichtbaar: boolean;
  doel: Doelverdeling;
  onOpslaan: (doel: Doelverdeling) => void;
  onSluiten: () => void;
}

// Een bewerkbare rij houdt zijn velden als tekst, net als elk ander invoerveld in de app: een
// percentage is pas een getal op het moment dat het gevalideerd of opgeslagen wordt. Het eigen
// `id` (los van het symbool) zorgt dat een rij zijn identiteit houdt als je een andere rij
// ertussenuit haalt, anders springt de focus naar de verkeerde regel.
interface BewerkbareRegel {
  id: number;
  symbool: string;
  percentage: string;
}

let volgendeRegelId = 0;
function nieuweRegel(): BewerkbareRegel {
  return { id: volgendeRegelId++, symbool: '', percentage: '' };
}

function fmtPct(n: number): string {
  return n.toLocaleString('nl-NL', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

// Editor voor de doelverdeling: welk percentage van je crypto je in welke coin wil hebben. Overig
// is nooit een invoerbaar veld, het is altijd 100 min de som van de ingevulde percentages (zie
// docs/design-doelstelling-en-projectie.md §0.1), dus het doel telt per constructie altijd op tot
// 100 zodra het opgeslagen wordt.
export function DoelSheet({ zichtbaar, doel, onOpslaan, onSluiten }: Props) {
  const { colors } = useTheme();
  const [regels, setRegels] = useState<BewerkbareRegel[]>([nieuweRegel()]);
  // "Doel verwijderen" hoort alleen bij een bestaand doel. Dat wordt vastgelegd op het moment van
  // openen, niet herberekend terwijl je de rijen bewerkt: anders zou de knop verdwijnen zodra je
  // per ongeluk de laatste rij van een net geopend, bestaand doel weghaalt.
  const [toonVerwijderen, setToonVerwijderen] = useState(false);

  useEffect(() => {
    if (!zichtbaar) return;
    setRegels(doel.length > 0
      ? doel.map(r => ({ id: volgendeRegelId++, symbool: r.sleutel, percentage: String(r.doelPct) }))
      : [nieuweRegel()]);
    setToonVerwijderen(doel.length > 0);
    // Bewust alleen op zichtbaar: de rijen moeten opnieuw gevuld worden bij elke keer openen, niet
    // bij elke wijziging van `doel` terwijl de sheet al open staat (die komt dan van deze sheet
    // zelf, via onOpslaan, en zou anders je eigen invoer overschrijven).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zichtbaar]);

  function wijzigSymbool(id: number, waarde: string) {
    setRegels(prev => prev.map(r => (r.id === id ? { ...r, symbool: waarde } : r)));
  }

  function wijzigPercentage(id: number, waarde: string) {
    setRegels(prev => prev.map(r => (r.id === id ? { ...r, percentage: waarde } : r)));
  }

  function verwijderRegel(id: number) {
    setRegels(prev => prev.filter(r => r.id !== id));
  }

  function voegRegelToe() {
    setRegels(prev => [...prev, nieuweRegel()]);
  }

  const geparsed = regels.map(r => ({
    ...r,
    symboolSchoon: r.symbool.trim().toUpperCase(),
    percentageSchoon: r.percentage.trim(),
    pct: Number(r.percentage.trim().replace(',', '.')),
  }));

  // Precies één foutregel tegelijk, in de vaste volgorde uit de spec: leeg veld voor dubbel
  // symbool voor bereik voor som.
  let fout = '';

  if (!fout) {
    const onvolledig = geparsed.some(r => (r.symboolSchoon === '') !== (r.percentageSchoon === ''));
    if (onvolledig) fout = 'Vul bij elke regel een coin en een percentage in.';
  }
  if (!fout) {
    const gevuldeSymbolen = geparsed.filter(r => r.symboolSchoon !== '').map(r => r.symboolSchoon);
    const dubbel = gevuldeSymbolen.find((s, i) => gevuldeSymbolen.indexOf(s) !== i);
    if (dubbel) fout = `${dubbel} staat al in je doel.`;
  }
  if (!fout) {
    const buitenBereik = geparsed.some(r => {
      if (r.symboolSchoon === '' && r.percentageSchoon === '') return false;
      return !Number.isFinite(r.pct) || r.pct <= 0 || r.pct > 100;
    });
    if (buitenBereik) fout = 'Een percentage moet tussen 0 en 100 liggen.';
  }

  const somPct = geparsed.reduce(
    (totaal, r) => totaal + (r.symboolSchoon !== '' && Number.isFinite(r.pct) ? r.pct : 0),
    0,
  );
  if (!fout && somPct > 100) {
    fout = `Je vult ${fmtPct(somPct)}% in, dat is meer dan 100%. Verlaag een percentage.`;
  }

  const gevuldeRegels = geparsed.filter(r => r.symboolSchoon !== '' && r.percentageSchoon !== '');
  const geenRijen = regels.length === 0;
  const geldig = !fout && !geenRijen && gevuldeRegels.length > 0;

  const overNegatief = somPct > 100;
  const overigTekst = overNegatief ? '—' : `${fmtPct(100 - somPct)}%`;
  const totaalTekst = overNegatief ? '—' : '100,0%';

  function opslaan() {
    if (!geldig) return;
    const nieuwDoel: Doelverdeling = gevuldeRegels.map((r): DoelRegel => ({
      sleutel: r.symboolSchoon,
      doelPct: r.pct,
    }));
    onOpslaan(nieuwDoel);
    onSluiten();
  }

  function verwijderDoel() {
    // Geen bevestigingsdialoog: zelfde lage-drempel-patroon als "leeg laten wist" op
    // KapitaalSheet, een doel is zonder moeite opnieuw in te vullen.
    onOpslaan([]);
    onSluiten();
  }

  const inputStyle = [styles.input, {
    backgroundColor: colors.verhoogd,
    borderColor: colors.rand,
    color: colors.tekstPrimair,
  }];

  return (
    <BottomSheet zichtbaar={zichtbaar} onSluiten={onSluiten} velStijl={styles.vel}>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.inhoud}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.titelRij}>
          <Text style={[Type.titel, { color: colors.tekstPrimair }]}>Doelverdeling</Text>
          <Pressable onPress={onSluiten} accessibilityRole="button" accessibilityLabel="Sluiten" style={styles.sluitKnop}>
            <X size={20} color={colors.tekstGedimd} strokeWidth={1.75} />
          </Pressable>
        </View>

        <Text style={[Type.body, { color: colors.tekstGedimd, lineHeight: 22 }]}>
          Welk percentage van je crypto wil je in welke coin hebben? De rest valt onder Overig.
        </Text>

        <View style={styles.regels}>
          {regels.map((regel, i) => (
            <View key={regel.id} style={styles.regelRij}>
              <TextInput
                style={[inputStyle, styles.symboolVeld]}
                value={regel.symbool}
                onChangeText={v => wijzigSymbool(regel.id, v)}
                placeholder="bijv. BTC"
                placeholderTextColor={colors.tekstGedimd}
                autoCapitalize="characters"
                autoCorrect={false}
                accessibilityLabel={`Coinsymbool, regel ${i + 1}`}
              />
              <View style={styles.percentageGroep}>
                <TextInput
                  style={[inputStyle, styles.percentageVeld]}
                  value={regel.percentage}
                  onChangeText={v => wijzigPercentage(regel.id, v)}
                  placeholder="30"
                  placeholderTextColor={colors.tekstGedimd}
                  keyboardType="decimal-pad"
                  accessibilityLabel={`Percentage, regel ${i + 1}`}
                />
                <Text style={[Type.body, { color: colors.tekstGedimd }]}>%</Text>
              </View>
              <Pressable
                onPress={() => verwijderRegel(regel.id)}
                accessibilityRole="button"
                accessibilityLabel={`${regel.symbool.trim() || 'deze regel'} verwijderen uit doel`}
                style={styles.verwijderKnop}
              >
                <X size={18} color={colors.tekstGedimd} strokeWidth={1.75} />
              </Pressable>
            </View>
          ))}
        </View>

        <Pressable
          onPress={voegRegelToe}
          accessibilityRole="button"
          accessibilityLabel="Coin toevoegen"
          style={styles.toevoegKnop}
        >
          <Text style={[Type.caption, { color: colors.cta, fontWeight: '600' }]}>+ Coin toevoegen</Text>
        </Pressable>

        {geenRijen ? (
          <Text style={[Type.caption, { color: colors.tekstGedimd }]}>Voeg minimaal één coin toe.</Text>
        ) : null}

        <View style={[styles.overigBlok, { borderTopColor: colors.rand }]}>
          <View style={styles.overigRij}>
            <Text style={[Type.caption, { color: colors.tekstGedimd }]}>Overig</Text>
            <Text style={[Type.label, { color: overNegatief ? colors.verlies : colors.tekstGedimd }]}>
              {overigTekst}
            </Text>
          </View>
          <View style={styles.overigRij}>
            <Text style={[Type.body, { color: colors.tekstPrimair, fontWeight: '600' }]}>Totaal</Text>
            <Text style={[Type.body, { color: overNegatief ? colors.verlies : colors.tekstPrimair, fontWeight: '600' }]}>
              {totaalTekst}
            </Text>
          </View>
        </View>

        {fout ? (
          <Text style={[Type.caption, { color: colors.verlies, marginTop: spacing.sm }]}>{fout}</Text>
        ) : null}

        <Pressable
          onPress={opslaan}
          disabled={!geldig}
          accessibilityRole="button"
          accessibilityLabel="Doel opslaan"
          style={[styles.opslaanKnop, { backgroundColor: geldig ? colors.cta : colors.verhoogd }]}
        >
          <Text style={[Type.body, { color: geldig ? 'white' : colors.tekstGedimd, fontWeight: '600' }]}>
            Doel opslaan
          </Text>
        </Pressable>

        {toonVerwijderen ? (
          <Pressable
            onPress={verwijderDoel}
            accessibilityRole="button"
            accessibilityLabel="Doel verwijderen"
            style={styles.verwijderDoelKnop}
          >
            <Text style={[Type.caption, { color: colors.tekstGedimd }]}>Doel verwijderen</Text>
          </Pressable>
        ) : null}
      </ScrollView>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  vel: { maxHeight: '90%' },
  inhoud: { paddingBottom: spacing.xs },
  titelRij: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.base,
  },
  sluitKnop: {
    minHeight: 44,
    minWidth: 44,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  regels: { marginTop: spacing.xs },
  regelRij: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  symboolVeld: { flex: 1 },
  percentageGroep: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  percentageVeld: { width: 72 },
  verwijderKnop: {
    minHeight: 44,
    minWidth: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toevoegKnop: {
    minHeight: 44,
    justifyContent: 'center',
    marginTop: spacing.md,
  },
  overigBlok: {
    borderTopWidth: StyleSheet.hairlineWidth,
    marginTop: spacing.base,
    paddingTop: spacing.md,
    gap: spacing.xs,
  },
  overigRij: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  opslaanKnop: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.knop,
    minHeight: 48,
    marginTop: spacing.lg,
  },
  verwijderDoelKnop: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.sm,
  },
  input: {
    borderWidth: 1,
    borderRadius: radii.veld,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: 15,
    minHeight: 44,
  },
});
