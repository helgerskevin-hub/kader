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
import { useDialoog } from '../state/DialoogProvider';
import { actieveSleutels } from '../state/etoroSleutels';
import { PortfolioTrade, richtingVan, tekenVan } from '../state/portfolioTypes';
import { OnbekendeOrder } from '../state/lopendeOrders';
import { useTheme } from '../theme/ThemeProvider';
import { Type } from '../theme/typography';
import { radii, spacing } from '../theme/tokens';
import { BottomSheet } from './BottomSheet';
import { OrderBevestigKnop } from './OrderBevestigKnop';
import { useValutaStand } from '../state/useValuta';

interface Props {
  zichtbaar: boolean;
  onSluiten: () => void;
  trade: PortfolioTrade;
  huidigePrijs?: number;
}

export function VerkoopOrderSheet({ zichtbaar, onSluiten, trade, huidigePrijs }: Props) {
  // De formatters lezen de gekozen valuta uit een gewone module, dus zonder dit abonnement
  // blijft dit scherm na het omzetten in de oude valuta staan.
  useValutaStand();

  const { colors } = useTheme();
  const { toonDialoog } = useDialoog();
  const { omgeving, trades, verzoenNaOrder, noteerOnbekendeOrder } = usePortfolio();

  // Bij een short heb je de positie geopend door te verkopen; sluiten gebeurt dan door terug te
  // kopen. "Verkopen" zou dus verwarrend zijn, "sluiten" klopt voor beide richtingen.
  const richting = richtingVan(trade);
  const isShort = richting === 'short';
  const werkwoord = isShort ? 'sluiten' : 'verkopen';
  const werkwoordVervoegd = isShort ? 'sluit' : 'verkoopt';
  // Hele zinsdeel in plaats van los zelfstandig naamwoord: "je verkoop van BTC" loopt, maar de
  // short-variant daarvan ("je sluitorder van BTC") niet, dus die krijgt een eigen formulering.
  const opdrachtTekst = isShort ? `opdracht om ${trade.symbool} te sluiten` : `verkoop van ${trade.symbool}`;

  const [verzoekId, setVerzoekId] = useState('');
  const [bezig, setBezig] = useState(false);
  const [fout, setFout] = useState('');

  // Eén id per keer dat de sheet opengaat, niet per klik. Probeer je het na een fout opnieuw, dan
  // gaat dezelfde x-request-id de deur uit. Sluiten en heropenen is een bewuste nieuwe order.
  useEffect(() => {
    if (!zichtbaar) return;
    setVerzoekId(guid());
    setBezig(false);
    setFout('');
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
    ? (huidigePrijs - trade.entryPrijs) * aantal * tekenVan(trade)
    : undefined;

  // Het percentage wordt uit resultaat en de inleg afgeleid, niet apart uitgerekend: zo is er maar
  // één bron van waarheid en kan het percentage nooit iets anders beweren dan het bedrag ernaast.
  const inleg = aantal !== undefined ? trade.entryPrijs * aantal : undefined;
  const resultaatPct = resultaat !== undefined && inleg !== undefined && inleg > 0
    ? (resultaat / inleg) * 100
    : undefined;

  // Zonder overbodige nullen: 1,371400 leest slechter dan 1,3714, en de komma hoort bij het
  // Nederlands van de rest van de app.
  const aantalTekst = aantal !== undefined
    ? aantal.toFixed(6).replace(/\.?0+$/, '').replace('.', ',')
    : '';

  async function bevestig() {
    if (!mag || bezig || positionId === undefined || instrumentId === undefined) return;
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
        toonDialoog({
          variant: 'gelukt',
          titel: isShort ? 'Sluitorder staat bij eToro' : 'Verkoop staat bij eToro',
          tekst: `Je ${opdrachtTekst} is doorgegeven. Kader werkt je portfolio bij zodra de positie gesloten is.`,
          resultaat: resultaat !== undefined && resultaatPct !== undefined
            ? {
              soort: 'bedrag',
              bedragUsd: resultaat,
              procent: resultaatPct,
              detail: huidigePrijs !== undefined
                ? `${aantalTekst} ${trade.symbool} · aankoop ${fmtPrijs(trade.entryPrijs)} · nu ${fmtPrijs(huidigePrijs)}`
                : undefined,
              toelichting: 'Schatting op de koers van dit moment. eToro sluit op zijn eigen koers en rekent kosten, dus het definitieve bedrag kan afwijken. Kader zet het echte resultaat in je historie na de volgende sync.',
            }
            : {
              soort: 'onbekend',
              toelichting: 'Kader kent het aantal coins of de live koers van deze positie niet, dus een bedrag zou gokwerk zijn. Zodra eToro de verkoop heeft verwerkt staat het echte resultaat in je historie.',
            },
          knoppen: [{ label: 'Oké' }],
        });
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
      onSluiten();
      // Hier staat met opzet geen bedrag en geen percentage, ook al kunnen we ze uitrekenen. Een
      // resultaat tonen bij een order waarvan we niet weten of hij is uitgevoerd doet alsof we
      // weten wat er gebeurd is.
      toonDialoog({
        variant: 'waarschuwing',
        titel: isShort
          ? 'We weten niet of je sluitorder is doorgegaan'
          : 'We weten niet of je verkoop is doorgegaan',
        tekst: 'Kader heeft geen antwoord van eToro gekregen. De opdracht staat genoteerd en Kader controleert het zelf bij eToro.',
        resultaat: {
          soort: 'waarschuwing',
          tekst: isShort
            ? 'Stuur de sluitorder niet opnieuw voordat je bij eToro hebt gekeken.'
            : 'Stuur de verkoop niet opnieuw voordat je bij eToro hebt gekeken.',
        },
        knoppen: [{ label: 'Oké' }],
      });
    } finally {
      setBezig(false);
    }
  }

  return (
    <BottomSheet zichtbaar={zichtbaar} onSluiten={onSluiten} velStijl={stijlen.vel}>
      <View style={stijlen.titelRij}>
        <Text style={[Type.titel, { color: colors.tekstPrimair }]}>{trade.symbool} {werkwoord}</Text>
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
          {isShort
            ? 'Je sluit de hele shortpositie tegen de marktprijs. Het resultaat hierboven is een schatting op basis van de prijs die Kader kent; eToro rekent het werkelijke bedrag af, inclusief kosten.'
            : 'Je verkoopt de hele positie tegen de marktprijs. Het resultaat hierboven is een schatting op basis van de prijs die Kader kent; eToro rekent het werkelijke bedrag af, inclusief kosten.'}
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

        <OrderBevestigKnop
          label={`${trade.symbool} ${werkwoord}`}
          omgeving={omgeving}
          bezig={bezig}
          uitgeschakeld={!mag}
          onBevestig={bevestig}
          echtWaarschuwing={`Dit ${werkwoordVervoegd} een echte positie met echt geld. Houd de knop ingedrukt om te bevestigen.`}
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
