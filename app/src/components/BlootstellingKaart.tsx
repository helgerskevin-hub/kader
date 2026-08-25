import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Gauge } from 'lucide-react-native';
import { Klimaat } from '../engine/marktklimaat';
import { beoordeelBlootstelling } from '../state/blootstelling';
import { fmtBedrag } from '../engine/format';
import { useTheme } from '../theme/ThemeProvider';
import { Type } from '../theme/typography';
import { spacing, radii } from '../theme/tokens';
import { useUitleg, UitlegKnop, UitlegTekst } from './UitlegKnop';
import { useValutaStand } from '../state/useValuta';

interface Props {
  inMarktUsd: number;
  // Open posities die we niet kunnen waarderen (geen aantal of geen live prijs). Die tellen niet
  // mee in het bedrag, en dat moet erbij staan, anders lijkt het percentage vollediger dan het is.
  nietGewaardeerd: number;
  klimaat: Klimaat;
  kapitaalUsd: number | null;
  onKapitaalWijzigen: () => void;
}

const LABEL: Record<Klimaat, string> = {
  gunstig: 'gunstig',
  gemengd: 'gemengd',
  ongunstig: 'ongunstig',
};

const UITLEG = 'Het plafond is een risicorichtlijn, geen uitkomst van de backtest. Die meet losse trades (wat een signaal gemiddeld oplevert) en kan dus niets zeggen over hoeveel geld er in totaal in de markt hoort te staan. De redenering erachter is simpel: in een klimaat waarin koopsignalen historisch gemiddeld geld verloren, hoort er minder geld in de markt te staan. Bij een gunstig klimaat houdt Kader geen plafond aan, bij gemengd de helft van je kapitaal, bij ongunstig een vijfde. Zit je erboven, dan is dat geen foutmelding en geen verkoopopdracht: het is een cijfer om bewust naar te kijken voordat je iets bijkoopt. Het bedrag in de markt telt alleen posities waarvan Kader een aantal munten én een live koers heeft.';

// Hoeveel van je kapitaal er in de markt staat, afgezet tegen wat bij dit klimaat past. Zonder
// ingevuld kapitaal blijft dit de richtlijn plus het bedrag; er komt dan bewust geen percentage uit,
// want een verzonnen noemer maakt elk percentage waardeloos.
export function BlootstellingKaart({ inMarktUsd, nietGewaardeerd, klimaat, kapitaalUsd, onKapitaalWijzigen }: Props) {
  useValutaStand();

  const { colors } = useTheme();
  const { open, wissel } = useUitleg();
  const oordeel = beoordeelBlootstelling(inMarktUsd, kapitaalUsd, klimaat);

  const teVeel = oordeel.binnenPlafond === false;
  const balkKleur = oordeel.binnenPlafond === null ? colors.tekstGedimd
    : teVeel ? colors.letOp
    : colors.winst;

  return (
    <View style={[styles.wrapper, { backgroundColor: colors.kaart }]}>
      <View style={styles.titelRij}>
        <View style={styles.titelLinks}>
          <Gauge size={15} color={colors.tekstGedimd} strokeWidth={2} />
          <Text style={[Type.overline, { color: colors.tekstGedimd }]}>BLOOTSTELLING</Text>
        </View>
        <UitlegKnop open={open} onWissel={wissel} onderwerp="het blootstellingsplafond" />
      </View>

      <Text style={[Type.body, { color: colors.tekstPrimair, lineHeight: 22 }]}>
        Het klimaat is {LABEL[klimaat]}. Daar past{' '}
        {oordeel.plafondPct >= 100
          ? 'geen plafond bij: je mag volledig belegd staan'
          : `hooguit ${Math.round(oordeel.plafondPct)}% van je kapitaal in de markt`}.
      </Text>

      {oordeel.huidigPct !== null ? (
        <>
          <Balk huidigPct={oordeel.huidigPct} plafondPct={oordeel.plafondPct} kleur={balkKleur} />
          <View style={styles.cijferRij}>
            <Text style={[Type.caption, { color: colors.tekstGedimd }]}>
              Nu {Math.round(oordeel.huidigPct)}% ({fmtBedrag(inMarktUsd)} van {fmtBedrag(oordeel.kapitaalUsd!)})
            </Text>
            {oordeel.plafondPct < 100 && (
              <Text style={[Type.caption, { color: colors.tekstGedimd }]}>
                Plafond {Math.round(oordeel.plafondPct)}%
              </Text>
            )}
          </View>
          {teVeel && (
            <Text style={[Type.caption, { color: colors.letOp, lineHeight: 18 }]}>
              Dat is {fmtBedrag(oordeel.bovenPlafondUsd!)} meer dan bij dit klimaat past. Geen reden
              om vandaag te verkopen, wel om er niets bij te kopen.
            </Text>
          )}
        </>
      ) : (
        <Text style={[Type.caption, { color: colors.tekstGedimd, lineHeight: 18 }]}>
          Je hebt {fmtBedrag(inMarktUsd)} in de markt staan. Vul je handelskapitaal in om te zien
          welk deel van je geld dat is.
        </Text>
      )}

      {nietGewaardeerd > 0 && (
        <Text style={[Type.caption, { color: colors.tekstGedimd, lineHeight: 18 }]}>
          {nietGewaardeerd === 1
            ? '1 open positie telt niet mee: daarvan kent Kader het aantal munten of de live koers niet.'
            : `${nietGewaardeerd} open posities tellen niet mee: daarvan kent Kader het aantal munten of de live koers niet.`}
        </Text>
      )}

      <Pressable
        onPress={onKapitaalWijzigen}
        accessibilityRole="button"
        accessibilityLabel={kapitaalUsd === null ? 'Handelskapitaal invullen' : 'Handelskapitaal aanpassen'}
        style={[styles.knop, { borderColor: colors.cta }]}
      >
        <Text style={[Type.caption, { color: colors.cta, fontWeight: '600' }]}>
          {kapitaalUsd === null ? 'Handelskapitaal invullen' : 'Kapitaal aanpassen'}
        </Text>
      </Pressable>

      <UitlegTekst open={open} tekst={UITLEG} />
    </View>
  );
}

// De balk toont de blootstelling op een schaal van 0 tot 100% van je kapitaal, met een streep op de
// plafondwaarde. Boven de 100% kan niet: dan staat er meer in de markt dan je als kapitaal hebt
// opgegeven, en dan is de balk vol en klopt het cijfer ernaast nog steeds.
function Balk({ huidigPct, plafondPct, kleur }: { huidigPct: number; plafondPct: number; kleur: string }) {
  const { colors } = useTheme();
  const vulling = Math.min(100, Math.max(0, huidigPct));
  const streep = Math.min(100, Math.max(0, plafondPct));

  return (
    <View
      style={[styles.baan, { backgroundColor: colors.verhoogd }]}
      accessibilityRole="progressbar"
      accessibilityLabel={`${Math.round(huidigPct)} procent van je kapitaal in de markt, plafond ${Math.round(plafondPct)} procent`}
    >
      <View style={[styles.vulling, { width: `${vulling}%`, backgroundColor: kleur }]} />
      {plafondPct < 100 && (
        <View style={[styles.streep, { left: `${streep}%`, backgroundColor: colors.tekstPrimair }]} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    marginHorizontal: spacing.base,
    marginBottom: spacing.sm,
    borderRadius: radii.kaart,
    padding: spacing.base,
    gap: spacing.sm,
  },
  titelRij: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  titelLinks: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  baan: {
    height: 10,
    borderRadius: 5,
    overflow: 'hidden',
    justifyContent: 'center',
  },
  vulling: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
  },
  streep: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 2,
  },
  cijferRij: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  knop: {
    alignSelf: 'flex-start',
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radii.knop,
    paddingHorizontal: spacing.base,
    justifyContent: 'center',
    minHeight: 36,
  },
});
