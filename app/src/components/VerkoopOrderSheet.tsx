// Verkoopt een lopende eToro-positie vanuit Kader. Naar het model van SluitTradeModal in
// PortfolioScreen, maar dit is een geldpad: er gaat een echte order naar eToro in plaats van een
// regel naar het lokale portfolio.
//
// Twee regels die niet mogen wijken: er wordt nooit automatisch opnieuw verstuurd, en er is geen
// knop die dat handmatig doet. Weten we het niet, dan verzoenen we.
import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { X } from 'lucide-react-native';
import { fmtPrijs, fmtResultaatUsd } from '../engine/format';
import { guid, sluitPositie } from '../engine/etoro';
import { usePortfolio } from '../state/PortfolioProvider';
import { actieveSleutels } from '../state/etoroSleutels';
import { PortfolioTrade } from '../state/portfolioTypes';
import { OnbekendeOrder } from '../state/lopendeOrders';
import { useTheme } from '../theme/ThemeProvider';
import { Type } from '../theme/typography';
import { radii, spacing } from '../theme/tokens';
import { BottomSheet } from './BottomSheet';
import { OrderBevestigKnop } from './OrderBevestigKnop';

interface Props {
  zichtbaar: boolean;
  onSluiten: () => void;
  trade: PortfolioTrade;
  huidigePrijs?: number;
  onGeslaagd?: (bericht: string) => void;
}

export function VerkoopOrderSheet({ zichtbaar, onSluiten, trade, huidigePrijs, onGeslaagd }: Props) {
  const { colors } = useTheme();
  const { omgeving, trades, verzoenNaOrder, noteerOnbekendeOrder } = usePortfolio();

  const [verzoekId, setVerzoekId] = useState('');
  const [bezig, setBezig] = useState(false);
  const [fout, setFout] = useState('');
  const [onbekend, setOnbekend] = useState('');

  // Eén id per keer dat de sheet opengaat, niet per klik. Probeer je het na een fout opnieuw, dan
  // gaat dezelfde x-request-id de deur uit. Sluiten en heropenen is een bewuste nieuwe order.
  useEffect(() => {
    if (!zichtbaar) return;
    setVerzoekId(guid());
    setBezig(false);
    setFout('');
    setOnbekend('');
  }, [zichtbaar, trade.id]);

  // Fail-closed poort. Een positie-ID uit de ene omgeving naar het endpoint van de andere sturen is
  // een slechte afloop: dezelfde sleutel wordt op beide paden geaccepteerd, dus het pad is het
  // enige dat echt geld van speelgeld scheidt. Klopt er iets niet, dan gaat er niets uit.
  const tradeOmgeving = trade.etoroOmgeving ?? 'real';
  const positionId = trade.etoroPositionID;
  const instrumentId = trade.etoroInstrumentID;
  const blokkade =
    trade.bron !== 'etoro' ? 'Deze trade heb je zelf ingevoerd, hij staat niet als positie bij eToro. Sluit hem af met Gewonnen of Verloren.'
      : positionId === undefined || instrumentId === undefined ? 'Kader mist de eToro-gegevens van deze positie. Ververs je portfolio, dan vult de sync ze aan.'
        : tradeOmgeving !== omgeving ? `Deze positie staat in je ${tradeOmgeving === 'demo' ? 'demo' : 'echte'}-account en je staat nu op ${omgeving === 'demo' ? 'demo' : 'echt'}. Schakel om om hem te kunnen verkopen.`
          : '';
  const mag = blokkade === '';

  // Alle eToro-posities die nu open staan in deze omgeving. Zonder die lijst zou een positie die je
  // al had een onbevestigde order kunnen "oplossen".
  const bekendePosities = useMemo(
    () => trades
      .filter(t => t.bron === 'etoro' && t.status === 'open' && t.etoroPositionID !== undefined
        && (t.etoroOmgeving ?? 'real') === omgeving)
      .map(t => t.etoroPositionID as number),
    [trades, omgeving],
  );

  const aantal = trade.aantalCoins
    ?? (trade.bedragUsd && trade.entryPrijs > 0 ? trade.bedragUsd / trade.entryPrijs : undefined);
  const resultaat = aantal !== undefined && huidigePrijs !== undefined && huidigePrijs > 0
    ? (huidigePrijs - trade.entryPrijs) * aantal
    : undefined;

  async function bevestig() {
    if (!mag || bezig || onbekend || positionId === undefined || instrumentId === undefined) return;
    setBezig(true);
    setFout('');

    try {
      const sleutels = await actieveSleutels();
      if (!sleutels) {
        setFout('Geen eToro-sleutels gevonden voor deze omgeving. Koppel je account opnieuw in Instellingen.');
        return;
      }

      // unitsToDeduct null: altijd de hele positie. Gedeeltelijk verkopen zit niet in deze versie.
      const uitkomst = await sluitPositie(positionId, instrumentId, null, sleutels, verzoekId);

      if (uitkomst.soort === 'ok') {
        verzoenNaOrder();
        onSluiten();
        onGeslaagd?.(`Je verkoop van ${trade.symbool} staat bij eToro. Kader werkt je portfolio bij zodra de positie gesloten is.`);
        return;
      }

      if (uitkomst.soort === 'fout') {
        setFout(uitkomst.bericht);
        return;
      }

      // Onbekend: eerst naar schijf, dan pas de melding. Een app-kill op dit moment mag het spoor
      // van deze order niet wissen.
      const order: OnbekendeOrder = {
        verzoekId: uitkomst.verzoekId,
        soort: 'verkoop',
        symbool: trade.symbool,
        omgeving,
        positionId,
        bekendePosities,
        tijd: Date.now(),
      };
      await noteerOnbekendeOrder(order);
      setOnbekend('We weten niet of je opdracht is doorgegaan. Kader kijkt nu bij eToro.');
    } finally {
      setBezig(false);
    }
  }

  return (
    <BottomSheet zichtbaar={zichtbaar} onSluiten={onSluiten} velStijl={stijlen.vel}>
      <View style={stijlen.titelRij}>
        <Text style={[Type.titel, { color: colors.tekstPrimair }]}>{trade.symbool} verkopen</Text>
        <Pressable
          onPress={onSluiten}
          accessibilityLabel="Sluiten"
          accessibilityRole="button"
          style={stijlen.sluitKnop}
        >
          <X size={20} color={colors.tekstGedimd} strokeWidth={1.75} />
        </Pressable>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <View style={[stijlen.blok, { backgroundColor: colors.verhoogd, borderColor: colors.rand }]}>
          <Text style={[Type.sectiekop, { color: colors.tekstPrimair }]}>
            {trade.symbool} <Text style={[Type.body, { color: colors.tekstGedimd }]}>{trade.naam}</Text>
          </Text>

          <View style={stijlen.rij}>
            <Text style={[Type.caption, { color: colors.tekstGedimd }]}>Aantal coins</Text>
            <Text style={[Type.prijs, { color: colors.tekstPrimair }]}>
              {aantal !== undefined ? aantal.toFixed(6) : 'onbekend'}
            </Text>
          </View>

          <View style={stijlen.rij}>
            <Text style={[Type.caption, { color: colors.tekstGedimd }]}>Aankoopprijs</Text>
            <Text style={[Type.prijs, { color: colors.tekstPrimair }]}>{fmtPrijs(trade.entryPrijs)}</Text>
          </View>

          {huidigePrijs !== undefined && huidigePrijs > 0 ? (
            <View style={stijlen.rij}>
              <Text style={[Type.caption, { color: colors.tekstGedimd }]}>Huidige prijs</Text>
              <Text style={[Type.prijs, { color: colors.tekstPrimair }]}>{fmtPrijs(huidigePrijs)}</Text>
            </View>
          ) : null}

          {resultaat !== undefined ? (
            <View style={stijlen.rij}>
              <Text style={[Type.caption, { color: colors.tekstGedimd }]}>Geschat resultaat</Text>
              <Text style={[Type.prijs, { color: resultaat >= 0 ? colors.winst : colors.verlies }]}>
                {fmtResultaatUsd(resultaat)}
              </Text>
            </View>
          ) : null}
        </View>

        <Text style={[Type.caption, { color: colors.tekstGedimd, lineHeight: 18 }]}>
          Je verkoopt de hele positie tegen de marktprijs. Het resultaat hierboven is een schatting op
          basis van de prijs die Kader kent; eToro rekent het werkelijke bedrag af, inclusief kosten.
        </Text>

        {!mag ? (
          <View style={[stijlen.melding, { backgroundColor: colors.verhoogd, borderColor: colors.letOp }]}>
            <Text style={[Type.caption, { color: colors.letOp, lineHeight: 18 }]}>{blokkade}</Text>
          </View>
        ) : null}

        {fout ? (
          <View style={[stijlen.melding, { backgroundColor: colors.verhoogd, borderColor: colors.verlies }]}>
            <Text style={[Type.caption, { color: colors.verlies, lineHeight: 18 }]}>{fout}</Text>
          </View>
        ) : null}

        {onbekend ? (
          <View style={[stijlen.melding, { backgroundColor: colors.verhoogd, borderColor: colors.rand }]}>
            <Text style={[Type.caption, { color: colors.tekstPrimair, lineHeight: 18 }]}>{onbekend}</Text>
          </View>
        ) : null}

        <OrderBevestigKnop
          label={`${trade.symbool} verkopen`}
          omgeving={omgeving}
          bezig={bezig}
          // Na een onbekende uitkomst blijft de knop uit: opnieuw versturen kan een tweede order
          // opleveren terwijl de eerste misschien gelukt is.
          uitgeschakeld={!mag || onbekend !== ''}
          onBevestig={bevestig}
          echtWaarschuwing="Dit verkoopt een echte positie met echt geld. Houd de knop ingedrukt om te bevestigen."
        />
      </ScrollView>
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
  },
  sluitKnop: { minHeight: 44, minWidth: 44, alignItems: 'flex-end', justifyContent: 'center' },
  blok: {
    borderWidth: 1,
    borderRadius: radii.veld,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  rij: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  melding: {
    borderWidth: 1,
    borderRadius: radii.veld,
    padding: spacing.md,
    marginTop: spacing.md,
  },
});
