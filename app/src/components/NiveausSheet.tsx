// Verzet de stop-loss en de take-profit van een lopende eToro-positie, of haalt ze weg.
//
// Het belangrijkste hier is dat bepaalStop blokkeert vóór er een verzoek uitgaat. eToro weigert een
// stop buiten zijn eigen grenzen toch, en een afgewezen order op een geldpad is een slechtere
// gebruikerservaring dan een knop die uit staat met de reden erbij.
import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { AlertTriangle, X } from 'lucide-react-native';
import { fmtPrijs } from '../engine/format';
import { bepaalStop, StopAdvies } from '../engine/etoroLimieten';
import { guid, wijzigNiveaus, NiveauWijziging } from '../engine/etoro';
import { usePortfolio } from '../state/PortfolioProvider';
import { useDialoog } from '../state/DialoogProvider';
import { useStopLossLimiet } from '../state/useStopLossLimiet';
import { actieveSleutels } from '../state/etoroSleutels';
import { PortfolioTrade, richtingVan } from '../state/portfolioTypes';
import { OnbekendeOrder } from '../state/lopendeOrders';
import { useTheme } from '../theme/ThemeProvider';
import { Type } from '../theme/typography';
import { radii, spacing } from '../theme/tokens';
import { BottomSheet } from './BottomSheet';
import { OrderBevestigKnop } from './OrderBevestigKnop';

// De niveaus die je hier intikt gaan als dollarprijzen naar eToro, dus dit scherm blijft in dollars,
// ook als de app op euro's staat.
const DOLLARS = { valuta: 'USD' } as const;


interface Props {
  zichtbaar: boolean;
  onSluiten: () => void;
  trade: PortfolioTrade;
}

const getal = (tekst: string): number => parseFloat(tekst.replace(',', '.'));

// Prijzen komen als float uit eToro terug; een directe ongelijkheid zou een wijziging melden die er
// niet is. Een cent verschil op de goedkoopste coin is nog altijd meer dan dit.
const anders = (a: number, b: number) => Math.abs(a - b) > 1e-9;

export function NiveausSheet({ zichtbaar, onSluiten, trade }: Props) {
  const { colors } = useTheme();
  const { toonDialoog } = useDialoog();
  const { omgeving, trades, verzoenNaOrder, noteerOnbekendeOrder } = usePortfolio();
  const limiet = useStopLossLimiet(trade.symbool, richtingVan(trade));

  const [stopVeld, setStopVeld] = useState('');
  const [doelVeld, setDoelVeld] = useState('');
  const [wisStop, setWisStop] = useState(false);
  const [wisDoel, setWisDoel] = useState(false);
  const [verzoekId, setVerzoekId] = useState('');
  const [bezig, setBezig] = useState(false);
  const [fout, setFout] = useState('');

  // Eén id per keer dat de sheet opengaat, niet per klik, zodat een handmatige herhaling na een fout
  // dezelfde x-request-id hergebruikt.
  useEffect(() => {
    if (!zichtbaar) return;
    setStopVeld(trade.stopLoss > 0 ? trade.stopLoss.toString() : '');
    setDoelVeld(trade.takeProfit > 0 ? trade.takeProfit.toString() : '');
    setWisStop(false);
    setWisDoel(false);
    setVerzoekId(guid());
    setBezig(false);
    setFout('');
  }, [zichtbaar, trade.id, trade.stopLoss, trade.takeProfit]);

  // Fail-closed poort. Een positie-ID uit de ene omgeving naar het endpoint van de andere sturen is
  // een slechte afloop: dezelfde sleutel wordt op beide paden geaccepteerd, dus het pad is het enige
  // dat echt geld van speelgeld scheidt. Het instrumentID heeft dit endpoint niet nodig.
  const tradeOmgeving = trade.etoroOmgeving ?? 'real';
  const positionId = trade.etoroPositionID;
  const blokkade =
    trade.bron !== 'etoro' ? 'Deze trade heb je zelf ingevoerd, hij staat niet als positie bij eToro. Pas hem aan met Aanpassen.'
      : positionId === undefined ? 'Kader mist het eToro-positienummer van deze trade. Ververs je portfolio, dan vult de sync het aan.'
        : tradeOmgeving !== omgeving ? `Deze positie staat in je ${tradeOmgeving === 'demo' ? 'demo' : 'echte'}-account en je staat nu op ${omgeving === 'demo' ? 'demo' : 'echt'}. Schakel om om hem te kunnen wijzigen.`
          : '';
  const poortOpen = blokkade === '';

  const bekendePosities = useMemo(
    () => trades
      .filter(t => t.bron === 'etoro' && t.status === 'open' && t.etoroPositionID !== undefined
        && (t.etoroOmgeving ?? 'real') === omgeving)
      .map(t => t.etoroPositionID as number),
    [trades, omgeving],
  );

  const ingevuldeStop = getal(stopVeld);
  const ingevuldDoel = getal(doelVeld);

  // Wissen is geen niveau, dus dan valt er ook niets te toetsen. bepaalStop meet tegen de
  // aankoopprijs van de positie, want dat is waar eToro zijn percentages op rekent.
  // De limiet komt nu per richting binnen, dus een short wordt tegen eToro's short-grenzen getoetst
  // (gemeten: minimaal 10% en maximaal 50% BOVEN de entry, waar een long tot 100% eronder mag).
  // Wissen is geen niveau, dus dan valt er niets te toetsen.
  const advies: StopAdvies = wisStop
    ? { soort: 'ok' }
    : bepaalStop(trade.entryPrijs, ingevuldeStop, limiet);

  // Exact de tabel uit het plan: 'aangepast' stuurt het bijgestelde niveau, 'vast' stuurt niets, en
  // 'waarschuwing' komt hieronder niet eens aan een verzoek toe.
  const stopTeSturen: number | undefined =
    advies.soort === 'aangepast' ? advies.stop
      : advies.soort === 'vast' ? undefined
        : ingevuldeStop > 0 ? ingevuldeStop
          : undefined;

  const doelTeSturen = ingevuldDoel > 0 ? ingevuldDoel : undefined;

  const stopWijzigt = wisStop
    ? trade.stopLoss > 0
    : stopTeSturen !== undefined && anders(stopTeSturen, trade.stopLoss);
  const doelWijzigt = wisDoel
    ? trade.takeProfit > 0
    : doelTeSturen !== undefined && anders(doelTeSturen, trade.takeProfit);

  const ietsGewijzigd = stopWijzigt || doelWijzigt;
  const geblokkeerdDoorStop = advies.soort === 'waarschuwing';
  const magBevestigen = poortOpen && ietsGewijzigd && !geblokkeerdDoorStop;

  function bouwWijziging(): NiveauWijziging {
    const wijziging: NiveauWijziging = {};
    if (wisStop) wijziging.clearStopLoss = true;
    else if (stopWijzigt && stopTeSturen !== undefined) wijziging.stopLossRate = stopTeSturen;
    if (wisDoel) wijziging.clearTakeProfit = true;
    else if (doelWijzigt && doelTeSturen !== undefined) wijziging.takeProfitRate = doelTeSturen;
    return wijziging;
  }

  async function bevestig() {
    if (!magBevestigen || bezig || positionId === undefined) return;
    setBezig(true);
    setFout('');

    try {
      const sleutels = await actieveSleutels();
      if (!sleutels) {
        setFout('Geen eToro-sleutels gevonden voor deze omgeving. Koppel je account opnieuw in Instellingen.');
        return;
      }

      const uitkomst = await wijzigNiveaus(positionId, bouwWijziging(), sleutels, verzoekId);

      if (uitkomst.soort === 'ok') {
        verzoenNaOrder();
        onSluiten();
        toonDialoog({
          variant: 'gelukt',
          titel: 'Niveaus doorgegeven',
          tekst: `De stop-loss en het doel van ${trade.symbool} staan bij eToro. Kader werkt ze bij na de volgende sync.`,
          knoppen: [{ label: 'Oké' }],
        });
        return;
      }

      if (uitkomst.soort === 'fout') {
        setFout(uitkomst.bericht);
        return;
      }

      // Onbekend: eerst naar schijf, dan pas de melding.
      const order: OnbekendeOrder = {
        verzoekId: uitkomst.verzoekId,
        soort: 'niveaus',
        symbool: trade.symbool,
        omgeving,
        positionId,
        bekendePosities,
        tijd: Date.now(),
      };
      await noteerOnbekendeOrder(order);
      onSluiten();
      toonDialoog({
        variant: 'waarschuwing',
        titel: 'We weten niet of je wijziging is doorgegaan',
        tekst: 'Kader heeft geen antwoord van eToro gekregen. De opdracht staat genoteerd en Kader controleert het zelf bij eToro.',
        resultaat: {
          soort: 'waarschuwing',
          tekst: 'Stuur de niveaus niet opnieuw voordat je bij eToro hebt gekeken.',
        },
        knoppen: [{ label: 'Oké' }],
      });
    } finally {
      setBezig(false);
    }
  }

  const veldStijl = (uit: boolean) => [stijlen.input, {
    backgroundColor: colors.verhoogd,
    borderColor: colors.rand,
    color: uit ? colors.tekstGedimd : colors.tekstPrimair,
    opacity: uit ? 0.5 : 1,
  }];

  return (
    <BottomSheet zichtbaar={zichtbaar} onSluiten={onSluiten} velStijl={stijlen.vel}>
      <View style={stijlen.titelRij}>
        <Text style={[Type.titel, { color: colors.tekstPrimair }]}>
          Stop-loss en doel van {trade.symbool}
        </Text>
        <Pressable
          onPress={onSluiten}
          accessibilityLabel="Sluiten"
          accessibilityRole="button"
          style={stijlen.sluitKnop}
        >
          <X size={20} color={colors.tekstGedimd} strokeWidth={1.75} />
        </Pressable>
      </View>

      <ScrollView
        style={stijlen.lijst}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={[Type.caption, { color: colors.tekstGedimd, lineHeight: 18 }]}>
          Aankoopprijs {fmtPrijs(trade.entryPrijs, DOLLARS)}. Een veld dat je niet wijzigt blijft bij eToro
          staan zoals het stond.
        </Text>

        <Text style={[Type.overline, stijlen.label, { color: colors.tekstGedimd }]}>STOP-LOSS</Text>
        <TextInput
          style={veldStijl(wisStop)}
          value={stopVeld}
          onChangeText={setStopVeld}
          editable={!wisStop}
          placeholder="bijv. 92400"
          placeholderTextColor={colors.tekstGedimd}
          keyboardType="decimal-pad"
        />
        {/* De aan-stand van deze schakelaar haalt je stop-loss wég, dus die hoort herkenbaar te
            zijn zonder dat de schakelaar zelf een kleur claimt. */}
        <View style={stijlen.schakelRij}>
          {wisStop ? <AlertTriangle size={15} color={colors.letOp} strokeWidth={1.75} /> : null}
          <Text style={[Type.caption, { color: wisStop ? colors.letOp : colors.tekstGedimd, flex: 1 }]}>
            Stop-loss weghalen in plaats van verzetten
          </Text>
          <Switch
            value={wisStop}
            onValueChange={setWisStop}
            trackColor={{ false: colors.rand, true: colors.schakelaarAan }}
            thumbColor={colors.schakelaarDuim}
            ios_backgroundColor={colors.rand}
            accessibilityLabel="Stop-loss weghalen"
            accessibilityHint="Zet dit aan om je stop-loss bij eToro te verwijderen in plaats van te verzetten."
          />
        </View>

        {/* Altijd aanwezig, ook leeg: anders krimpt de sheet zodra het stop-advies verdwijnt. */}
        <View
          style={[
            stijlen.adviesSlot,
            advies.soort !== 'ok' && stijlen.adviesVak,
            advies.soort !== 'ok' && {
              backgroundColor: colors.verhoogd,
              borderColor: advies.soort === 'waarschuwing' ? colors.verlies : colors.letOp,
            },
          ]}
        >
          {advies.soort !== 'ok' ? (
            <Text
              style={[
                Type.caption,
                { color: advies.soort === 'waarschuwing' ? colors.verlies : colors.letOp, lineHeight: 18 },
              ]}
            >
              {advies.uitleg}
            </Text>
          ) : null}
        </View>

        <Text style={[Type.overline, stijlen.label, { color: colors.tekstGedimd }]}>DOEL (TAKE-PROFIT)</Text>
        <TextInput
          style={veldStijl(wisDoel)}
          value={doelVeld}
          onChangeText={setDoelVeld}
          editable={!wisDoel}
          placeholder="bijv. 118000"
          placeholderTextColor={colors.tekstGedimd}
          keyboardType="decimal-pad"
        />
        <View style={stijlen.schakelRij}>
          <Text style={[Type.caption, { color: colors.tekstGedimd, flex: 1 }]}>
            Doel weghalen in plaats van verzetten
          </Text>
          <Switch
            value={wisDoel}
            onValueChange={setWisDoel}
            trackColor={{ false: colors.rand, true: colors.schakelaarAan }}
            thumbColor={colors.schakelaarDuim}
            ios_backgroundColor={colors.rand}
            accessibilityLabel="Doel weghalen"
            accessibilityHint="Zet dit aan om je doel bij eToro te verwijderen in plaats van te verzetten."
          />
        </View>

        {!poortOpen ? (
          <View style={[stijlen.melding, { backgroundColor: colors.verhoogd, borderColor: colors.letOp }]}>
            <Text style={[Type.caption, { color: colors.letOp, lineHeight: 18 }]}>{blokkade}</Text>
          </View>
        ) : null}

        {fout ? (
          <View style={[stijlen.melding, { backgroundColor: colors.verhoogd, borderColor: colors.verlies }]}>
            <Text style={[Type.caption, { color: colors.verlies, lineHeight: 18 }]}>{fout}</Text>
          </View>
        ) : null}

      </ScrollView>

      {/* De hulpregel en de knop staan buiten de ScrollView, en de regel heeft een eigen
          gereserveerde hoogte. Zo blijft de knop op dezelfde plek staan of er nu een hulpregel is
          of niet, en scrollt hij niet mee weg. */}
      <View style={stijlen.hulpSlot}>
        {poortOpen && !ietsGewijzigd ? (
          <Text style={[Type.caption, { color: colors.tekstGedimd }]}>
            Wijzig een niveau of zet een schakelaar aan om te kunnen bevestigen.
          </Text>
        ) : null}
      </View>

      <OrderBevestigKnop
        label="Niveaus doorgeven"
        omgeving={omgeving}
        bezig={bezig}
        uitgeschakeld={!magBevestigen}
        onBevestig={bevestig}
        echtWaarschuwing="Dit wijzigt een echte positie met echt geld. Houd de knop ingedrukt om te bevestigen."
      />
    </BottomSheet>
  );
}

const stijlen = StyleSheet.create({
  vel: {
    maxHeight: '90%',
  },
  titelRij: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.base,
    gap: spacing.sm,
  },
  sluitKnop: { minHeight: 44, minWidth: 44, alignItems: 'flex-end', justifyContent: 'center' },
  // Levert hoogte in aan de voet eronder in plaats van hem van het scherm te duwen.
  lijst: { flexShrink: 1 },
  label: { marginTop: spacing.md, marginBottom: spacing.xs },
  input: {
    borderWidth: 1,
    borderRadius: radii.veld,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: 15,
    minHeight: 44,
  },
  schakelRij: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginTop: spacing.sm,
    minHeight: 44,
  },
  melding: {
    borderWidth: 1,
    borderRadius: radii.veld,
    padding: spacing.md,
    marginTop: spacing.md,
  },
  // 60px is padding 12 boven en onder plus twee regels Type.caption op lineHeight 18: de hoogte die
  // het stop-advies inneemt als het er wél staat.
  adviesSlot: {
    minHeight: 60,
    marginTop: spacing.md,
    justifyContent: 'center',
  },
  adviesVak: {
    borderWidth: 1,
    borderRadius: radii.veld,
    padding: spacing.md,
  },
  // Twee regels Type.caption plus lucht. Onder de zin zat eerst helemaal niets.
  hulpSlot: {
    minHeight: 60,
    marginTop: spacing.md,
    marginBottom: spacing.base,
    justifyContent: 'center',
  },
});
