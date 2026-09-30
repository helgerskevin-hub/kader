// Verkoopt een lopende eToro-positie vanuit Kader. Naar het model van SluitTradeModal in
// PortfolioScreen, maar dit is een geldpad: er gaat een echte order naar eToro in plaats van een
// regel naar het lokale portfolio.
//
// Twee regels die niet mogen wijken: er wordt nooit automatisch opnieuw verstuurd, en er is geen
// knop die dat handmatig doet. Weten we het niet, dan verzoenen we.
import React, { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { fmtBedrag, fmtPct, fmtPrijs, fmtResultaatUsd } from '../engine/format';
import { guid, sluitPositie } from '../engine/etoro';
import { schatSluiting } from '../engine/planInGeld';
import { usePortfolio } from '../state/PortfolioProvider';
import { useDialoog } from '../state/DialoogProvider';
import { actieveSleutels } from '../state/etoroSleutels';
import { PortfolioTrade, richtingVan, tekenVan } from '../state/portfolioTypes';
import { OnbekendeOrder } from '../state/lopendeOrders';
import { GeplaatsteOrder } from '../state/orderUitkomsten';
import { useTheme } from '../theme/ThemeProvider';
import { Fonts, Type } from '../theme/typography';
import { radii, spacing } from '../theme/tokens';
import { AnimatedGetal } from './AnimatedGetal';
import { BottomSheet } from './BottomSheet';
import { OrderKop } from './order/OrderKop';
import { StopDoelBaan } from './StopDoelBaan';
import { OrderBevestigKnop, useGeluktMoment } from './OrderBevestigKnop';
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
  const { omgeving, trades, verzoenNaOrder, noteerOnbekendeOrder, noteerGeplaatsteOrder } = usePortfolio();

  // Bij een short heb je de positie geopend door te verkopen; sluiten gebeurt dan door terug te
  // kopen. "Verkopen" zou dus verwarrend zijn, "sluiten" klopt voor beide richtingen.
  const richting = richtingVan(trade);
  const isShort = richting === 'short';
  const werkwoord = isShort ? 'sluiten' : 'verkopen';
  // Hele zinsdeel in plaats van los zelfstandig naamwoord: "je verkoop van BTC" loopt, maar de
  // short-variant daarvan ("je sluitorder van BTC") niet, dus die krijgt een eigen formulering.
  const opdrachtTekst = isShort ? `opdracht om ${trade.symbool} te sluiten` : `verkoop van ${trade.symbool}`;

  const [verzoekId, setVerzoekId] = useState('');
  const [bezig, setBezig] = useState(false);
  const { gelukt, vier, sluit, wis } = useGeluktMoment(onSluiten);
  const [fout, setFout] = useState('');

  // Eén id per keer dat de sheet opengaat, niet per klik. Probeer je het na een fout opnieuw, dan
  // gaat dezelfde x-request-id de deur uit. Sluiten en heropenen is een bewuste nieuwe order.
  useEffect(() => {
    if (!zichtbaar) return;
    setVerzoekId(guid());
    setBezig(false);
    wis();
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

  // Alleen om te tonen: de schatting voor het grote getal en de lijst. De berekening hierboven
  // (resultaat, resultaatPct) blijft ongemoeid, zodat wat de dialoog na het verkopen meldt niet
  // verandert.
  const koersBekend = huidigePrijs !== undefined && huidigePrijs > 0;
  const sluiting = schatSluiting({
    inleg: trade.bedragUsd ?? (aantal !== undefined ? aantal * trade.entryPrijs : 0),
    aantal: aantal ?? 0,
    entry: trade.entryPrijs,
    prijs: huidigePrijs,
    richting,
  });
  const heeftBaan = trade.stopLoss > 0 && trade.takeProfit > 0;

  const { fontScale } = useWindowDimensions();
  const [resBreedte, setResBreedte] = useState(0);
  // Op honderdsten afronden voor teken en kleur: -0,004 toont $0.00 en hoort dan niet rood te zijn.
  const resAfgerond = sluiting ? Math.round(sluiting.resultaat * 100) / 100 : 0;
  const resTekst = fmtResultaatUsd(resAfgerond);
  const resKleur = resAfgerond > 0 ? colors.winst : resAfgerond < 0 ? colors.verlies : colors.tekstPrimair;
  // Het grote getal krimpt mee met zijn lengte, zodat een groot resultaat op 360 dp en bij een
  // grote systeemletter nooit uit beeld loopt. AnimatedGetal geeft geen maxFontSizeMultiplier door,
  // dus de systeemletter is hier teruggerekend: de getekende grootte is de grootte hieronder.
  const resGrootte = resBreedte > 0
    ? Math.max(24, Math.min(44, resBreedte / (resTekst.length * 0.62)))
    : 44;
  const resStijl = {
    fontFamily: Fonts.monoMedium,
    fontWeight: '500' as const,
    fontVariant: ['tabular-nums' as const],
    fontSize: resGrootte / fontScale,
    lineHeight: (resGrootte * 1.18) / fontScale,
    letterSpacing: (-resGrootte * 0.034) / fontScale,
    color: colors.tekstPrimair,
  };

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
      // De knop is getekend voor één omgeving. Is die intussen gewisseld, dan gaat er niets de deur
      // uit: anders zou een order die je als demo bevestigde met echt geld kunnen lopen, of andersom.
      if ((sleutels.omgeving ?? 'real') !== omgeving) {
        setFout('Je omgeving is net gewisseld. Sluit dit venster en open het opnieuw.');
        return;
      }

      // unitsToDeduct null: altijd de hele positie. Gedeeltelijk verkopen zit niet in deze versie.
      const uitkomst = await sluitPositie(positionId, instrumentId, null, sleutels, verzoekId);

      if (uitkomst.soort === 'ok') {
        // Eerst wegschrijven, dan pas verzoenen. De sync die verzoenNaOrder meteen start kan de
        // gesloten positie al in eToro's historie zien, en de sluitingsmelding moet dan weten dat
        // Kader dit zelf verkocht, anders meldt hij een verkoop op het doel als "doel gehaald". Een
        // fout bij het wegschrijven blijft stil: dan mist alleen de latere "geannuleerd/geweigerd"-
        // melding, de order zelf is al bij eToro binnen.
        const geplaatst: GeplaatsteOrder = {
          verzoekId,
          orderId: uitkomst.orderId,
          soort: 'verkoop',
          symbool: trade.symbool,
          positionId,
          // De omgeving van de sleutels waarmee de order echt de deur uitging, niet de context-state:
          // die kan net gewisseld zijn, en dan zou de sync de status bij het verkeerde account opvragen.
          omgeving: sleutels.omgeving ?? 'real',
          bedragUsd: trade.bedragUsd,
          richting,
          tijd: Date.now(),
        };
        await noteerGeplaatsteOrder(geplaatst).catch(() => {});
        verzoenNaOrder();
        // Eerst het vinkje in de knop, dan pas sluiten en bevestigen.
        vier(() => {
          onSluiten();
          toonDialoog({
            variant: 'gelukt',
            rondje: 'gelukt',
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
        omgeving: sleutels.omgeving ?? 'real',
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
        rondje: 'onzeker',
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
    <BottomSheet zichtbaar={zichtbaar} onSluiten={sluit} velStijl={stijlen.vel}>
      <View style={stijlen.kop}>
        <OrderKop
          symbool={trade.symbool}
          titel={`${trade.symbool} ${werkwoord}`}
          sub={`${trade.naam || trade.symbool} · hele positie`}
          omgeving={omgeving}
          onSluiten={sluit}
        />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={stijlen.inhoud}
      >
        <View style={stijlen.resultaatBlok} onLayout={e => setResBreedte(e.nativeEvent.layout.width)}>
          <Text style={[Type.overline, { color: colors.tekstGedimd }]}>GESCHAT RESULTAAT</Text>
          {sluiting ? (
            <>
              <AnimatedGetal
                waarde={resAfgerond}
                format={fmtResultaatUsd}
                style={resStijl}
                kleurBijTeken={{
                  positief: colors.winst,
                  negatief: colors.verlies,
                  neutraal: colors.tekstPrimair,
                }}
              />
              <View
                style={[
                  stijlen.pil,
                  { backgroundColor: resAfgerond === 0 ? colors.verhoogd : `${resKleur}24` },
                ]}
              >
                <Text style={[stijlen.pilTekst, { color: resKleur }]}>{fmtPct(sluiting.pct, 2)}</Text>
              </View>
            </>
          ) : (
            <Text style={[Type.caption, stijlen.midden, { color: colors.tekstGedimd }]}>
              {koersBekend ? 'Kader kent het aantal coins van deze positie niet, dus een bedrag zou gokwerk zijn.' : 'Nog geen actuele koers. eToro sluit op zijn eigen koers.'}
            </Text>
          )}
        </View>

        {heeftBaan ? (
          <StopDoelBaan
            stop={trade.stopLoss}
            entry={trade.entryPrijs}
            doel={trade.takeProfit}
            live={koersBekend ? huidigePrijs : undefined}
            labels
          />
        ) : null}

        <View style={[stijlen.lijst, { backgroundColor: colors.verhoogd }]}>
          <LijstRij
            label="Aantal coins"
            waarde={aantalTekst || 'onbekend'}
            eerste
          />
          <LijstRij label="Aankoopprijs" waarde={fmtPrijs(trade.entryPrijs)} />
          {koersBekend ? <LijstRij label="Huidige prijs" waarde={fmtPrijs(huidigePrijs as number)} /> : null}
          {sluiting ? <LijstRij label="Je krijgt ongeveer" waarde={fmtBedrag(sluiting.terug)} /> : null}
        </View>

        <Text style={[stijlen.eerlijk, { color: colors.tekstGedimd }]}>
          Schatting op de koers van nu. eToro sluit op zijn eigen koers en rekent kosten, het echte resultaat staat na de sync in je historie.
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
          label={omgeving === 'real'
            ? (isShort ? 'Houd vast om te sluiten' : 'Houd vast om te verkopen')
            : (isShort ? 'Sluiten in demo' : 'Verkopen in demo')}
          omgeving={omgeving}
          bezig={bezig}
          uitgeschakeld={!mag}
          onBevestig={bevestig}
          gelukt={gelukt}
          echtWaarschuwing={isShort
            ? 'Echt geld. Houd de knop vast om te sluiten.'
            : 'Echt geld. Houd de knop vast om te verkopen.'}
        />
      </ScrollView>
    </BottomSheet>
  );
}

// Een rij van de lijst: label links (mag afbreken), getal rechts (kapt nooit af).
function LijstRij({ label, waarde, eerste }: { label: string; waarde: string; eerste?: boolean }) {
  const { colors } = useTheme();
  return (
    <View
      style={[
        stijlen.lijstRij,
        !eerste && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.rand },
      ]}
    >
      <Text style={[stijlen.lijstLabel, { color: colors.tekstGedimd }]}>{label}</Text>
      <Text style={[stijlen.lijstWaarde, { color: colors.tekstPrimair }]}>{waarde}</Text>
    </View>
  );
}

const stijlen = StyleSheet.create({
  vel: {
    maxHeight: '90%',
  },
  kop: { marginBottom: spacing.base },
  inhoud: { gap: 14 },
  resultaatBlok: { alignItems: 'center', gap: 6 },
  midden: { textAlign: 'center' },
  pil: { paddingVertical: 4, paddingHorizontal: 8, borderRadius: radii.pill },
  pilTekst: { fontFamily: Fonts.monoMedium, fontWeight: '500', fontSize: 11.5, lineHeight: 14 },
  lijst: { borderRadius: 16, paddingHorizontal: 14 },
  lijstRij: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 44,
    paddingVertical: 8,
    gap: 12,
  },
  lijstLabel: { flex: 1, fontFamily: Fonts.sansMedium, fontWeight: '500', fontSize: 13.5, lineHeight: 18 },
  lijstWaarde: {
    flexShrink: 0,
    fontFamily: Fonts.monoRegular,
    fontSize: 14.5,
    lineHeight: 20,
    fontVariant: ['tabular-nums'],
    textAlign: 'right',
  },
  eerlijk: { fontSize: 13, lineHeight: 19, textAlign: 'center' },
  melding: {
    borderWidth: 1,
    borderRadius: radii.veld,
    padding: spacing.md,
  },
});
