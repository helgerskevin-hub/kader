import React, { memo, useEffect, useRef, useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import Animated, {
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
} from 'react-native-reanimated';
import { fmtBedrag, fmtPct, fmtPrijs, fmtResultaatUsd, fmtRR } from '../engine/format';
import { useTheme } from '../theme/ThemeProvider';
import { Fonts, Type } from '../theme/typography';
import { spacing, radii, shadow } from '../theme/tokens';
import { duur, vervaag } from '../theme/beweging';
import { useReduceMotion } from '../theme/useReduceMotion';
import { schuifOvergang, uitklapInGestaffeld, uitklapUit } from '../theme/lijstBeweging';
import { PortfolioTrade, bronVan, richtingVan, tekenVan } from '../state/portfolioTypes';
import { bepaalAdvies } from '../state/advies';
import { AfbouwAdvies } from '../state/afbouw';
import { useValutaStand } from '../state/useValuta';
import { useDialoog } from '../state/DialoogProvider';
import { AfbouwRegel } from './AfbouwRegel';
import { AnimatedGetal } from './AnimatedGetal';
import { CoinLogo } from './CoinLogo';
import { useDrukVeer } from './Drukbaar';
import { PilKnop } from './PilKnop';
import { RichtingBadge } from './RichtingBadge';
import { StopDoelBaan } from './StopDoelBaan';
import { UitklapPijl } from './UitklapPijl';

interface Props {
  trade: PortfolioTrade;
  livePrijs: number | undefined;
  // Het klimaat-bewuste advies, of null als er niets bijzonders te melden is.
  afbouw?: AfbouwAdvies | null;
  onOpenDetail: (trade: PortfolioTrade) => void;
  onVraagSluiten: (trade: PortfolioTrade, status: 'gewonnen' | 'verloren') => void;
  onVerwijder: (id: string) => void;
  onBewerk: (trade: PortfolioTrade) => void;
  // Ontbreken als deze positie niet bij eToro te besturen is; dan blijven de handmatige knoppen.
  onVerkoop?: (trade: PortfolioTrade) => void;
  onNiveaus?: (trade: PortfolioTrade) => void;
}

// Hoe fel de koerspuls achter het resultaat oplicht. Net genoeg om te zien dat er een nieuwe koers
// binnenkwam, niet zo fel dat een lijst met tien posities bij elke poll gaat knipperen.
const PULS_OPACITY = 0.16;

// Eén open positie in de kaartfamilie van Markt en Kansen: compact is het logo, de status en het
// resultaat met de stop-doel-baan eronder, een tik klapt de niveaus, het plan en de knoppen uit.
// Alleen voor open trades: afgesloten trades staan in de historie, die een eigen scherm heeft.
//
// Memo: de prijs-poll tekent PortfolioScreen elke paar minuten opnieuw, en zonder memo tekenden ook de
// kaarten mee waarvan de koers niet veranderde. Het scherm houdt de callbacks daarvoor stabiel.
export const PositieKaart = memo(function PositieKaart({
  trade, livePrijs, afbouw, onOpenDetail, onVraagSluiten, onVerwijder, onBewerk, onVerkoop, onNiveaus,
}: Props) {
  // De formatters lezen de gekozen valuta uit een gewone module, dus zonder dit abonnement
  // blijft dit scherm na het omzetten in de oude valuta staan.
  useValutaStand();

  const { colors } = useTheme();
  const { toonDialoog } = useDialoog();
  const reduceMotion = useReduceMotion();
  const [uitgeklapt, setUitgeklapt] = useState(false);
  // De hele kaart veert mee als je het bovenste deel indrukt, niet alleen dat deel. Het
  // detailscherm groeit uit deze kaart, ook als je het via de Details-knop opent.
  const druk = useDrukVeer(undefined, { kleur: colors.kaart, radius: radii.kaart });

  const richting = richtingVan(trade);
  const teken = tekenVan(trade);
  const advies = bepaalAdvies(trade.entryPrijs, trade.stopLoss, trade.takeProfit, livePrijs, richting);

  const adviesKleur = advies.kleur === 'winst' ? colors.winst
    : advies.kleur === 'verlies' ? colors.verlies
    : advies.kleur === 'letOp' ? colors.letOp
    : colors.tekstGedimd;
  const afbouwKleur = afbouw?.niveau === 'houden' ? colors.winst : colors.letOp;

  const heeftAantal = typeof trade.aantalCoins === 'number' && trade.aantalCoins > 0;
  const resultaatUsd = livePrijs !== undefined && heeftAantal
    ? (livePrijs - trade.entryPrijs) * trade.aantalCoins! * teken
    : null;
  const resultaatPct = livePrijs !== undefined
    ? (livePrijs - trade.entryPrijs) / trade.entryPrijs * 100 * teken
    : null;
  const resultaatKleur = resultaatPct !== null && resultaatPct < 0 ? colors.verlies : colors.winst;

  // Koerspuls: een nieuwe koers laat een vlak achter het resultaat heel even oplichten, groen als de
  // koers voor deze positie de goede kant op bewoog en rood als niet. Via tekenVan, zodat een
  // stijging bij een short rood oplicht. Alleen opacity, en via vervaag(), dus ook onder Minder
  // beweging: een korte fade is juist het alternatief voor beweging. Geen haptiek, dit gebeurt
  // vanzelf bij elke poll en is geen reactie op iets dat jij doet.
  const puls = useSharedValue(0);
  const pulsGunstig = useSharedValue(1);
  const vorigePrijs = useRef(livePrijs);
  useEffect(() => {
    const vorige = vorigePrijs.current;
    vorigePrijs.current = livePrijs;
    if (vorige === undefined || livePrijs === undefined || vorige === livePrijs) return;
    pulsGunstig.value = (livePrijs - vorige) * teken > 0 ? 1 : 0;
    // Never op de reeks zelf: met de standaard (System) slaat withSequence onder Minder beweging
    // de stappen over, ook al speelt vervaag() ze zelf wel af.
    puls.value = withSequence(
      ReduceMotion.Never,
      vervaag(PULS_OPACITY, duur.midden),
      vervaag(0, duur.lang),
    );
    // Alleen een nieuwe koers start de puls; teken verandert niet zolang de trade dezelfde is.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [livePrijs]);

  const pulsStijl = useAnimatedStyle(() => ({
    opacity: puls.value,
    backgroundColor: pulsGunstig.value === 1 ? colors.winst : colors.verlies,
  }), [colors.winst, colors.verlies]);

  // De kaart groeit op een veer mee met de uitklap. De kaarten eronder volgen via de lijst
  // (itemLayoutAnimation op PortfolioScreen).
  const schuif = schuifOvergang(reduceMotion);

  const kaartLabel =
    `${trade.symbool}${richting === 'short' ? ', short' : ''}, ${advies.kort}`
    + `${afbouw ? `, ${afbouw.kort}` : ''}`
    + `${resultaatPct !== null ? `, resultaat ${fmtPct(resultaatPct)}` : ''}`;

  const heeftInleg = typeof trade.bedragUsd === 'number' && trade.bedragUsd > 0;
  const heeftRr = trade.rr > 0;
  const eToroBestuurbaar = onVerkoop !== undefined && onNiveaus !== undefined;

  // Verwijderen is onomkeerbaar en zat vlak naast Details: eerst vragen. Bij een eToro-positie zegt
  // de tekst wat er echt gebeurt: Kader onthoudt het id in de negeerlijst (verwijderTrade in
  // PortfolioProvider) en importeert hem daarna niet meer, terwijl de positie bij eToro open blijft.
  function vraagVerwijderen() {
    toonDialoog({
      variant: 'waarschuwing',
      titel: 'Trade verwijderen?',
      tekst: bronVan(trade) === 'etoro'
        ? `${trade.symbool} verdwijnt uit Kader. Bij eToro blijft de positie gewoon open, en Kader haalt hem daarna niet meer op.`
        : `${trade.symbool} verdwijnt uit je portfolio in Kader.`,
      knoppen: [
        { label: 'Terug' },
        { label: 'Verwijderen', soort: 'destructief', onDruk: () => onVerwijder(trade.id) },
      ],
    });
  }

  return (
    // Neutrale kaart, zoals op Markt en Kansen: groen en rood staan alleen op cijfers, pillen en
    // lijnen. De gekleurde linkerstreep van de oude compacte regel is daarom weg.
    <Animated.View ref={druk.ref} layout={schuif} style={[
      styles.kaart,
      shadow.kaart,
      { backgroundColor: colors.kaart },
      druk.stijl,
    ]}>
      {/* Het bovenste deel klapt de kaart uit en weer in. Het detailscherm opent alleen nog via
          Details in het uitgeklapte deel, zodat een tik om te lezen je niet meteen naar een ander
          scherm stuurt. */}
      <Pressable
        onPress={() => {
          // Deze tik is geen opening van het detailscherm: een oude meting van dit indrukken mag
          // niet blijven liggen voor een latere activering van Details.
          druk.vergeetBron();
          setUitgeklapt(v => !v);
        }}
        onPressIn={druk.drukIn}
        onPressOut={druk.drukUit}
        accessibilityRole="button"
        accessibilityState={{ expanded: uitgeklapt }}
        accessibilityLabel={kaartLabel}
        accessibilityHint={uitgeklapt ? 'Tik om in te klappen' : 'Tik om uit te klappen'}
        // De padding zit op het tikvlak en niet op de kaart, zodat ook de rand rond de kop tikbaar is.
        style={styles.boven}
      >
        <View style={styles.kop}>
          {/* Los logo, geen scorering: een positie heeft geen score. */}
          <CoinLogo symbool={trade.symbool} grootte={40} />
          <View style={styles.kopMidden}>
            {/* Symbool en SHORT-label naast elkaar: zonder dat label zijn een long en een short op
                dezelfde coin niet uit elkaar te houden, terwijl hun resultaat precies
                tegenovergesteld is. */}
            <View style={styles.symboolRij}>
              <Text style={[Type.sectiekop, styles.symbool, { color: colors.tekstPrimair }]}>
                {trade.symbool}
              </Text>
              <RichtingBadge richting={richting} />
            </View>
            {/* Status en afbouw elk op een eigen regel en zonder afkappen: op 360 dp met een grote
                systeemletter breekt een regel liever af dan dat er "Winst besch..." staat. */}
            <View style={styles.statusRegel}>
              <View style={[styles.statusStip, { backgroundColor: adviesKleur }]} />
              <Text style={[Type.caption, styles.statusTekst, { color: adviesKleur }]}>
                {advies.kort}
              </Text>
            </View>
            {afbouw && (
              <Text style={[Type.caption, styles.statusTekst, { color: afbouwKleur }]}>
                {afbouw.kort}
              </Text>
            )}
          </View>
          <View style={styles.kopRechts}>
            {resultaatPct !== null ? (
              <>
                <View style={styles.heroVak}>
                  <Animated.View pointerEvents="none" style={[styles.puls, pulsStijl]} />
                  <AnimatedGetal
                    waarde={resultaatPct}
                    format={fmtPct}
                    style={[styles.hero, { color: resultaatKleur }]}
                    kleurBijTeken={{ positief: colors.winst, negatief: colors.verlies }}
                  />
                </View>
                {resultaatUsd !== null && (
                  <Text style={[Type.prijs, styles.heroSub, { color: resultaatKleur }]}>
                    {fmtResultaatUsd(resultaatUsd)}
                  </Text>
                )}
              </>
            ) : (
              // Zonder koers geen verzonnen getal en geen los streepje: gewoon zeggen wat er gebeurt.
              <Text style={[Type.caption, { color: colors.tekstGedimd }]}>Laden</Text>
            )}
          </View>
        </View>

        {/* Het pijlrondje staat rechts naast de baan en niet rechtsboven in de kop: daar staat het
            resultaat, en een extra rondje ernaast drukt op 360 dp het symbool en de status in
            elkaar. Naast de baan kost het alleen wat baanbreedte, en het staat op dezelfde plek als
            op de Markt- en Kansen-kaarten: rechts, onderaan het tikvlak. Zonder stop of doel
            tekent de baan zich niet, maar de labels blijven staan met "Geen" bij wat ontbreekt, en
            het rondje blijft rechts ernaast. */}
        <View style={styles.voet}>
          <View style={styles.baan}>
            <StopDoelBaan
              stop={trade.stopLoss}
              entry={trade.entryPrijs}
              doel={trade.takeProfit}
              live={livePrijs}
              labels
              accessible={false}
            />
          </View>
          <View style={[styles.pijlRondje, { backgroundColor: colors.verhoogd }]}>
            <UitklapPijl open={uitgeklapt} size={14} color={colors.tekstGedimd} strokeWidth={2} veerNaam="stevig" />
          </View>
        </View>
      </Pressable>

      {/* Het uitgeklapte deel klapt niet dicht bij een tik erop: hier staan knoppen en tekst die je
          wil kunnen aanraken en lezen zonder dat de kaart onder je vinger wegvouwt. */}
      {uitgeklapt && (
        <Animated.View exiting={uitklapUit()} style={[styles.uitklap, { borderTopColor: colors.rand }]}>
          {/* Alleen de container heeft een exiting: de blokken erin laten hun entering, en een tweede
              exiting per blok speelde dubbel af bovenop die van de container. */}
          {/* Vaste kolommen op één regel; een brede prijs krimpt in zijn kolom. Een rij met flexWrap
              en groeiende kolommen kreeg van Yoga de hoogte van twee regels, met een gat eronder. */}
          <Animated.View
            entering={uitklapInGestaffeld(0, reduceMotion)}
            style={styles.niveaus}
          >
            <View style={styles.niveauPaar}>
              <View style={styles.niveau}>
                <Text style={[Type.overline, { color: colors.tekstGedimd }]}>LIVE</Text>
                <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75} style={[Type.prijs, styles.niveauWaarde, { color: colors.tekstPrimair }]}>
                  {livePrijs !== undefined ? fmtPrijs(livePrijs) : 'Laden'}
                </Text>
              </View>
              <View style={styles.niveau}>
                <Text style={[Type.overline, { color: colors.tekstGedimd }]}>ENTRY</Text>
                <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75} style={[Type.prijs, styles.niveauWaarde, { color: colors.tekstPrimair }]}>
                  {fmtPrijs(trade.entryPrijs)}
                </Text>
              </View>
            </View>
            {(heeftInleg || heeftRr) && (
              <View style={styles.niveauPaar}>
                {heeftInleg && (
                  <View style={styles.niveau}>
                    <Text style={[Type.overline, { color: colors.tekstGedimd }]}>INLEG</Text>
                    <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75} style={[Type.prijs, styles.niveauWaarde, { color: colors.tekstPrimair }]}>
                      {fmtBedrag(trade.bedragUsd!)}
                    </Text>
                  </View>
                )}
                {heeftRr && (
                  <View style={styles.niveau}>
                    <Text style={[Type.overline, { color: colors.tekstGedimd }]}>R/R</Text>
                    <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75} style={[Type.prijs, styles.niveauWaarde, { color: colors.tekstPrimair }]}>
                      {fmtRR(trade.rr)}
                    </Text>
                  </View>
                )}
              </View>
            )}
          </Animated.View>

          {/* Het plan: de volledige adviestekst. De stip draagt dezelfde kleur als in de status. */}
          <Animated.View
            entering={uitklapInGestaffeld(1, reduceMotion)}
            style={[styles.plan, { backgroundColor: colors.verhoogd }]}
          >
            <View style={[styles.planStip, { backgroundColor: adviesKleur }]} />
            <Text style={[Type.caption, styles.planTekst, { color: adviesKleur }]}>
              {advies.tekst}
            </Text>
          </Animated.View>

          {afbouw && (
            <Animated.View entering={uitklapInGestaffeld(2, reduceMotion)}>
              <AfbouwRegel advies={afbouw} huidigeStop={trade.stopLoss} />
            </Animated.View>
          )}

          {trade.notitie ? (
            <Animated.View entering={uitklapInGestaffeld(3, reduceMotion)}>
              <Text style={[Type.caption, styles.notitie, { color: colors.tekstGedimd }]}>
                {trade.notitie}
              </Text>
            </Animated.View>
          ) : null}

          {/* Mag afbreken: vier knoppen passen op 360 dp niet op één regel, en een knop gaat liever
              naar de volgende regel dan dat zijn label afkapt. */}
          <Animated.View
            entering={uitklapInGestaffeld(4, reduceMotion)}
            style={styles.pilRij}
          >
            {/* Bij een eToro-positie die Kader echt kan besturen vervangen Verkopen en SL/TP de
                handmatige knoppen: Gewonnen en Verloren zouden hier alleen de lokale administratie
                wijzigen terwijl de positie bij eToro gewoon open blijft staan, en dat is misleidend. */}
            {eToroBestuurbaar ? (
              <>
                <PilKnop
                  label="Verkopen"
                  variant="tweede"
                  onPress={() => onVerkoop!(trade)}
                  accessibilityLabel={`${trade.symbool} verkopen bij eToro`}
                />
                <PilKnop
                  label="SL/TP"
                  variant="tweede"
                  onPress={() => onNiveaus!(trade)}
                  accessibilityLabel="Stop-loss en doel aanpassen"
                />
              </>
            ) : (
              <>
                <PilKnop
                  label="Gewonnen"
                  variant="tweede"
                  onPress={() => onVraagSluiten(trade, 'gewonnen')}
                  accessibilityLabel="Gewonnen"
                />
                <PilKnop
                  label="Verloren"
                  variant="tweede"
                  onPress={() => onVraagSluiten(trade, 'verloren')}
                  accessibilityLabel="Verloren"
                />
                <PilKnop
                  label="Aanpassen"
                  variant="tweede"
                  onPress={() => onBewerk(trade)}
                  accessibilityLabel="Trade aanpassen"
                />
              </>
            )}
            <PilKnop
              label="Verwijder"
              variant="tweede"
              onPress={vraagVerwijderen}
              accessibilityLabel="Trade verwijderen"
              tekstKleur={colors.verlies}
            />
          </Animated.View>

          {/* De naam staat alleen hier: een lange naam hoort in het uitgeklapte deel, niet in de
              compacte kop waar hij op 360 dp het resultaat zou verdringen. Details staat ernaast,
              buiten de afbrekende knoppenrij: daar rekende Yoga een lege extra regel bij. */}
          <Animated.View entering={uitklapInGestaffeld(5, reduceMotion)} style={styles.voetRij}>
            <Text style={[Type.caption, styles.geopend, { color: colors.tekstGedimd }]}>
              {trade.naam ? `${trade.naam} · ` : ''}geopend {trade.datum}
            </Text>
            <PilKnop
              label="Details"
              variant="link"
              // Alleen meten, niet krimpen: het detailscherm groeit uit de hele kaart, en de knop
              // zelf veert al als Drukbaar.
              onPressIn={druk.meetBron}
              onPress={() => {
                druk.legBronVast();
                onOpenDetail(trade);
              }}
              accessibilityLabel={`${trade.symbool} details bekijken`}
            />
          </Animated.View>
        </Animated.View>
      )}
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  kaart: {
    borderRadius: radii.kaart,
    marginHorizontal: spacing.base,
    marginBottom: spacing.md,
    // Knipt de blokken die bij het dichtklappen nog uitfaden af op de rand van de krimpende kaart.
    overflow: 'hidden',
  },
  boven: { padding: spacing.base },
  kop: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  kopMidden: { flex: 1, minWidth: 0, gap: 2 },
  // Wrap: bij een lang symbool met een grote systeemletter valt het SHORT-label liever onder het
  // symbool dan over het resultaat heen.
  symboolRij: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6 },
  // Type.sectiekop is 16; het ontwerp zet het symbool op 17.
  symbool: { fontSize: 17 },
  statusRegel: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  statusStip: { width: 6, height: 6, borderRadius: 3 },
  statusTekst: { flexShrink: 1, fontFamily: Fonts.sansSemiBold, fontWeight: '600' },
  // Mag krimpen als een grote systeemletter het midden anders dichtknijpt. Geen maxWidth zoals op
  // Markt en Kansen: het resultaat is een groot getal dat niet op twee regels hoort te breken.
  kopRechts: { alignItems: 'flex-end', flexShrink: 1 },
  // Het vak rond het getal is het oppervlak van de koerspuls: 4 punten ruimte opzij, en die ruimte
  // rechts weer teruggegeven zodat het getal op de rand van de kaartinhoud blijft staan.
  heroVak: {
    paddingHorizontal: 4,
    marginRight: -4,
  },
  puls: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    borderRadius: 8,
  },
  hero: {
    fontFamily: Type.prijsGroot.fontFamily,
    fontWeight: Type.prijsGroot.fontWeight,
    fontVariant: Type.prijsGroot.fontVariant,
    fontSize: 28,
    lineHeight: 32,
    letterSpacing: -0.5,
  },
  heroSub: { fontSize: 13 },
  voet: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginTop: 14,
  },
  baan: { flex: 1, minWidth: 0 },
  pijlRondje: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 'auto',
  },
  // Het tikvlak erboven levert de 16 punten boven de haarlijn al.
  uitklap: {
    borderTopWidth: StyleSheet.hairlineWidth,
    marginHorizontal: spacing.base,
    marginBottom: spacing.base,
    paddingTop: spacing.base,
    gap: spacing.base,
  },
  niveaus: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  niveauPaar: { flexDirection: 'row', flex: 1, gap: spacing.sm },
  niveau: { flex: 1, minWidth: 0, gap: 2 },
  niveauWaarde: { fontSize: 13 },
  plan: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    borderRadius: 12,
    padding: 12,
  },
  planStip: { width: 8, height: 8, borderRadius: 4, marginTop: 5 },
  planTekst: { flex: 1, fontFamily: Fonts.sansSemiBold, fontWeight: '600', lineHeight: 18 },
  notitie: { fontStyle: 'italic', lineHeight: 18 },
  pilRij: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: spacing.sm,
  },
  voetRij: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  geopend: { flexShrink: 1 },
});
