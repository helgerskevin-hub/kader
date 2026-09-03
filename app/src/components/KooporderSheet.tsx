// De sheet die een echte kooporder bij eToro plaatst. Een koopknop op een kaart opent alleen deze
// sheet, hij plaatst nooit zelf een order: kopen kost altijd twee bewuste handelingen.
//
// Alles hier is fail-closed. Ontbreekt het instrumentId, keurt bepaalStop de stop af, of past het
// bedrag niet in je saldo, dan is bevestigen simpelweg uitgeschakeld. En na een onbekende uitkomst
// verschijnt er nergens een knop die het verzoek opnieuw verstuurt.
import React, { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Wallet, X } from 'lucide-react-native';
import { fmtBedrag, fmtPrijs } from '../engine/format';
import { bepaalStop, StopAdvies } from '../engine/etoroLimieten';
import { bouwKooporderBody, guid, haalVrijSaldo, KooporderInvoer, plaatsKooporder } from '../engine/etoro';
import { actieveSleutels } from '../state/etoroSleutels';
import { OnbekendeOrder } from '../state/lopendeOrders';
import { usePortfolio } from '../state/PortfolioProvider';
import { Richting } from '../state/portfolioTypes';
import { useInstrumentId } from '../state/useInstrumentId';
import { useStopLossLimiet } from '../state/useStopLossLimiet';
import { useValuta } from '../state/useValuta';
import { useTheme } from '../theme/ThemeProvider';
import { Type } from '../theme/typography';
import { radii, spacing } from '../theme/tokens';
import { BottomSheet } from './BottomSheet';
import { OrderBevestigKnop } from './OrderBevestigKnop';
import { RichtingBadge } from './RichtingBadge';

// eToro rekent orders in dollars af en het bedrag dat je hier intikt gaat letterlijk zo de order in.
// Daarom blijft dit scherm in dollars, ook als de app op euro's staat: een omgerekend getal naast
// een invoerveld dat dollars verwacht is precies de verwarring die geld kost. Onder het veld staat
// wel de euro-tegenwaarde, zie EuroHint.
const DOLLARS = { valuta: 'USD' } as const;


// Gemeten bij eToro: minPositionAmount en minPositionExposure staan allebei op 10 voor BTC x1.
const MINIMUM_USD = 10;

// eToro rekent kosten bovenop je inleg: een order van $10 haalde $10,08 van het saldo af. Een order
// van precies je vrije saldo wordt daardoor geweigerd, dus we toetsen met wat marge in plaats van
// tegen het kale bedrag.
const KOSTENMARGE = 1.02;

interface Props {
  zichtbaar: boolean;
  onSluiten: () => void;
  symbool: string;
  naam: string;
  entry: number;
  stop: number;
  doel: number;
  onGeslaagd?: (bericht: string) => void;
  // Ontbreekt = 'long', dezelfde afspraak als overal elders. Deze sheet plaatst een echte order, dus
  // een short komt hier alleen aan als de aanroeper 'm expliciet meegeeft: het marktscherm geeft de
  // richting van de Trade zelf door, die staat al goed op elke short die de engine oplevert.
  richting?: Richting;
}

export function KooporderSheet({
  zichtbaar, onSluiten, symbool, naam, entry, stop, doel, onGeslaagd, richting = 'long',
}: Props) {
  const { colors } = useTheme();
  const isShort = richting === 'short';
  const { omgeving, magHandelen, trades, verzoenNaOrder, noteerOnbekendeOrder } = usePortfolio();
  const instrumentId = useInstrumentId(zichtbaar ? symbool : null);
  const stopLimiet = useStopLossLimiet(zichtbaar ? symbool : null, richting);
  // Staat de app op euro's, dan blijft dit scherm in dollars maar tonen we wel wat je inleg in
  // euro's is. Anders moet je zelf gaan rekenen om te weten wat je uitgeeft.
  const { valuta, eurPerUsd } = useValuta();

  const [bedrag, setBedrag] = useState('');
  const [vrijSaldo, setVrijSaldo] = useState<number | null>(null);
  const [saldoBezig, setSaldoBezig] = useState(true);
  const [bezig, setBezig] = useState(false);
  const [fout, setFout] = useState('');
  const [onbekend, setOnbekend] = useState('');

  // Eén verzoekId per keer dat de sheet opengaat, zodat een handmatige herhaling na een afwijzing
  // dezelfde x-request-id draagt. Sluiten en opnieuw openen geeft een nieuwe id: dat is een bewuste
  // tweede order.
  const verzoekId = useRef(guid());

  useEffect(() => {
    if (!zichtbaar) return;
    verzoekId.current = guid();
    setBedrag('');
    setFout('');
    setOnbekend('');
    setBezig(false);
    setVrijSaldo(null);
    setSaldoBezig(true);
  }, [zichtbaar]);

  // Het saldo bewijst meteen dat de sleutels van deze omgeving werken. Lukt het ophalen niet, dan
  // tonen we niets over saldo en blijft bevestigen gewoon mogelijk: een verzonnen bedrag is erger
  // dan geen bedrag, maar het is geen reden om kopen te blokkeren.
  useEffect(() => {
    if (!zichtbaar) return;
    let actief = true;
    (async () => {
      try {
        const sleutels = await actieveSleutels();
        if (!sleutels) return;
        const saldo = await haalVrijSaldo(sleutels);
        if (actief) setVrijSaldo(saldo);
      } catch {
        // Zonder saldo verder, zie hierboven.
      } finally {
        if (actief) setSaldoBezig(false);
      }
    })();
    return () => { actief = false; };
  }, [zichtbaar]);

  const advies: StopAdvies = bepaalStop(entry, stop, stopLimiet);
  const getoondeStop = advies.soort === 'aangepast' ? advies.stop : stop;

  // Wat er werkelijk als stop meegaat. Bij 'vast' laten we het veld weg en zet eToro zijn eigen
  // stop; bij 'waarschuwing' gaat er sowieso niets uit, want bevestigen staat dan uit.
  const stopLossRate = advies.soort === 'ok' ? stop
    : advies.soort === 'aangepast' ? advies.stop
    : undefined;

  const bedragGetal = parseFloat(bedrag.replace(',', '.'));
  const heeftBedrag = !isNaN(bedragGetal) && bedragGetal > 0;

  const invoer: KooporderInvoer = {
    instrumentId: instrumentId ?? 0,
    bedragUsd: heeftBedrag ? bedragGetal : 0,
    richting,
    stopLossRate,
    takeProfitRate: doel,
  };

  // De samenvatting komt uit de body die daadwerkelijk verstuurd wordt, niet uit de formuliervelden.
  // Anders kan er iets anders op het scherm staan dan wat er de deur uitgaat.
  const body = bouwKooporderBody(invoer);
  const niveaus: string[] = [];
  if (typeof body.stopLossRate === 'number') niveaus.push(`stop-loss ${fmtPrijs(body.stopLossRate, DOLLARS)}`);
  if (typeof body.takeProfitRate === 'number') niveaus.push(`doel ${fmtPrijs(body.takeProfitRate, DOLLARS)}`);
  const niveauZin = niveaus.length > 0
    ? ` ${niveaus.join(', ').replace(/^./, t => t.toUpperCase())}.`
    : '';
  // Bij een short verkoop je de coin om de positie te openen, zonder 'm te bezitten: "kopen" zou hier
  // het tegenovergestelde beweren van wat er werkelijk gebeurt.
  const samenvatting = heeftBedrag
    ? isShort
      ? `Je opent een short van ${fmtBedrag(bedragGetal, DOLLARS)} in ${symbool} tegen de marktprijs.${niveauZin}`
      : `Je koopt voor ${fmtBedrag(bedragGetal, DOLLARS)} aan ${symbool} tegen de marktprijs.${niveauZin}`
    : '';

  // Eén rode melding tegelijk, in de volgorde waarin ze zwaarwegend zijn.
  const blokkade =
    instrumentId === null
      ? `Kader kan ${symbool} niet eenduidig aan een eToro-instrument koppelen. Handelen via de app is daarom uitgeschakeld.`
    : advies.soort === 'waarschuwing' ? advies.uitleg
    : heeftBedrag && bedragGetal < MINIMUM_USD ? `Het minimum bij eToro is ${fmtBedrag(MINIMUM_USD, DOLLARS)}.`
    : heeftBedrag && vrijSaldo !== null && bedragGetal * KOSTENMARGE > vrijSaldo
      ? `Dit past niet in je vrije saldo van ${fmtBedrag(vrijSaldo, DOLLARS)}. eToro rekent kosten bovenop je inleg, dus houd wat ruimte over.`
    : null;

  const magBevestigen = heeftBedrag && blokkade === null && onbekend === '';

  async function bevestig() {
    if (!magBevestigen || instrumentId === null) return;

    // Vastleggen vóór het versturen: welke posities stonden er al open? Zonder die lijst zou een
    // positie die je al had een onbevestigde order ten onrechte oplossen.
    const bekendePosities = trades
      .filter(t => t.bron === 'etoro' && t.status === 'open' && t.etoroPositionID !== undefined)
      .map(t => t.etoroPositionID as number);

    setFout('');
    setBezig(true);
    try {
      const sleutels = await actieveSleutels();
      if (!sleutels) {
        setFout('Er staat geen eToro-sleutel klaar voor deze omgeving.');
        setBezig(false);
        return;
      }

      const uitkomst = await plaatsKooporder(invoer, sleutels, verzoekId.current);

      if (uitkomst.soort === 'ok') {
        verzoenNaOrder();
        onSluiten();
        onGeslaagd?.(isShort
          ? `Je short van ${fmtBedrag(bedragGetal, DOLLARS)} in ${symbool} staat bij eToro. Hij verschijnt in je portfolio zodra de order gevuld is.`
          : `Je koop van ${fmtBedrag(bedragGetal, DOLLARS)} in ${symbool} staat bij eToro. Hij verschijnt in je portfolio zodra de order gevuld is.`);
        return;
      }

      if (uitkomst.soort === 'fout') {
        setFout(uitkomst.bericht);
        setBezig(false);
        return;
      }

      // Onbekend: eerst naar schijf, dan pas melden. Wordt de app op dit moment weggegooid, dan is
      // het record er nog en pakt de verzoening hem alsnog op.
      const order: OnbekendeOrder = {
        verzoekId: verzoekId.current,
        soort: 'koop',
        symbool,
        omgeving,
        bedragUsd: bedragGetal,
        bekendePosities,
        tijd: Date.now(),
      };
      try {
        await noteerOnbekendeOrder(order);
      } catch {
        // Wegschrijven mislukte. De melding hieronder klopt hoe dan ook, en opnieuw versturen is
        // ook nu geen optie.
      }
      setOnbekend('We weten niet of je order is doorgegaan. Kader kijkt nu bij eToro.');
      setBezig(false);
    } catch (e) {
      setFout(e instanceof Error ? e.message : 'Er ging iets mis bij het plaatsen van de order.');
      setBezig(false);
    }
  }

  // Zonder schrijfrecht hoort deze sheet niet open te kunnen. Komt hij er toch, dan gebeurt er
  // niets in plaats van een half formulier.
  if (!magHandelen) return null;

  const inputStyle = [stijlen.input, {
    backgroundColor: colors.verhoogd,
    borderColor: colors.rand,
    color: colors.tekstPrimair,
  }];

  return (
    <BottomSheet zichtbaar={zichtbaar} onSluiten={onSluiten} velStijl={stijlen.vel}>
      <View style={stijlen.titelRij}>
        <Text style={[Type.titel, { color: colors.tekstPrimair }]}>{symbool} {isShort ? 'shorten' : 'kopen'}</Text>
        <Pressable
          onPress={onSluiten}
          accessibilityLabel="Sluiten"
          accessibilityRole="button"
          style={stijlen.sluitKnop}
        >
          <X size={20} color={colors.tekstGedimd} strokeWidth={1.75} />
        </Pressable>
      </View>

      {/* Het onderscheid met een gewone koop moet hier niet te missen zijn: bij een short liggen
          stop en doel omgekeerd, en wie dit voor een koop aanziet verliest geld op precies het
          moment dat de koers stijgt. */}
      {isShort && (
        <View style={[stijlen.richtingBanner, { backgroundColor: colors.goud + '1A', borderColor: colors.goud }]}>
          <RichtingBadge richting="short" />
          <Text style={[Type.caption, stijlen.richtingBannerTekst, { color: colors.goud }]}>
            Je opent deze positie door te verkopen. Je verdient als de koers van {symbool} daalt,
            en verliest als hij stijgt.
          </Text>
        </View>
      )}

      <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <View style={[stijlen.infoBlok, { backgroundColor: colors.verhoogd, borderColor: colors.rand }]}>
          <Text style={[Type.sectiekop, { color: colors.tekstPrimair }]}>
            {symbool} <Text style={[Type.body, { color: colors.tekstGedimd }]}>{naam}</Text>
          </Text>
          <View style={stijlen.infoRij}>
            <View style={stijlen.infoVeld}>
              <Text style={[Type.overline, { color: colors.tekstGedimd }]}>ENTRY</Text>
              <Text style={[Type.prijs, { color: colors.tekstPrimair }]}>{fmtPrijs(entry, DOLLARS)}</Text>
            </View>
            <View style={stijlen.infoVeld}>
              <Text style={[Type.overline, { color: colors.tekstGedimd }]}>
                {advies.soort === 'vast' ? 'STOP (KADER)' : 'STOP'}
              </Text>
              <Text style={[Type.prijs, { color: colors.verlies }]}>{fmtPrijs(getoondeStop, DOLLARS)}</Text>
            </View>
            <View style={stijlen.infoVeld}>
              <Text style={[Type.overline, { color: colors.tekstGedimd }]}>DOEL</Text>
              <Text style={[Type.prijs, { color: colors.winst }]}>{fmtPrijs(doel, DOLLARS)}</Text>
            </View>
          </View>
          <Text style={[Type.caption, { color: colors.tekstGedimd, marginTop: spacing.sm, lineHeight: 18 }]}>
            {isShort
              ? `De entry komt uit de analyse van Kader. De order gaat tegen de marktprijs: bij een short verkoop je ${symbool} zonder het te bezitten, en verdien je zodra de koers daalt.`
              : 'De entry komt uit de analyse van Kader. De order gaat tegen de marktprijs, dus je koopt tegen de koers van dat moment.'}
          </Text>
        </View>

        {advies.soort === 'aangepast' || advies.soort === 'vast' ? (
          <View style={[stijlen.waarschuwing, { backgroundColor: colors.verhoogd, borderColor: colors.letOp }]}>
            <Text style={[Type.caption, { color: colors.letOp }]}>{advies.uitleg}</Text>
          </View>
        ) : null}

        {/* Het bedrag is het enige dat de gebruiker zelf invult, dus hoort er te staan hoeveel er
            te besteden is voordat hij begint te tikken en niet als voetnoot eronder. */}
        <View style={stijlen.labelRij}>
          <Text style={[Type.overline, { color: colors.tekstGedimd }]}>BEDRAG IN $</Text>
          <View style={stijlen.saldoRij}>
            <Wallet size={13} color={colors.tekstGedimd} strokeWidth={1.75} />
            <Text style={[Type.caption, { color: colors.tekstGedimd }]}>Te besteden</Text>
            <Text style={[Type.prijs, stijlen.saldoBedrag, { color: colors.tekstPrimair }]}>
              {vrijSaldo !== null ? fmtBedrag(vrijSaldo, DOLLARS) : saldoBezig ? 'ophalen...' : 'onbekend'}
            </Text>
          </View>
        </View>
        <TextInput
          style={inputStyle}
          value={bedrag}
          onChangeText={setBedrag}
          placeholder={`minimaal ${MINIMUM_USD}`}
          placeholderTextColor={colors.tekstGedimd}
          keyboardType="decimal-pad"
          editable={!bezig && onbekend === ''}
        />
        {valuta === 'EUR' && eurPerUsd !== null && heeftBedrag ? (
          <Text style={[Type.caption, { color: colors.tekstGedimd, marginTop: spacing.xs }]}>
            Dat is ongeveer €{(bedragGetal * eurPerUsd).toFixed(2)}. eToro rekent in dollars af.
          </Text>
        ) : null}
        {vrijSaldo === null && !saldoBezig ? (
          <Text style={[Type.caption, { color: colors.tekstGedimd, marginTop: spacing.xs }]}>
            Kader kon je saldo niet bij eToro ophalen. Controleer zelf of dit bedrag past voor je
            bevestigt.
          </Text>
        ) : null}

        {blokkade ? (
          <Text style={[Type.caption, stijlen.melding, { color: colors.verlies }]}>{blokkade}</Text>
        ) : null}

        {fout ? (
          <Text style={[Type.caption, stijlen.melding, { color: colors.verlies }]}>{fout}</Text>
        ) : null}

        {onbekend ? (
          <View style={[stijlen.waarschuwing, stijlen.melding, { backgroundColor: colors.verhoogd, borderColor: colors.rand }]}>
            <Text style={[Type.body, { color: colors.tekstPrimair, lineHeight: 22 }]}>{onbekend}</Text>
          </View>
        ) : null}

        {samenvatting && onbekend === '' ? (
          <Text style={[Type.body, stijlen.samenvatting, { color: colors.tekstGedimd }]}>{samenvatting}</Text>
        ) : null}

        <OrderBevestigKnop
          label={`${symbool} ${isShort ? 'shorten' : 'kopen'} bij eToro`}
          omgeving={omgeving}
          bezig={bezig}
          uitgeschakeld={!magBevestigen}
          onBevestig={bevestig}
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
  richtingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderWidth: 1,
    borderRadius: radii.veld,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  richtingBannerTekst: { flex: 1, lineHeight: 18 },
  infoBlok: {
    borderWidth: 1,
    borderRadius: radii.veld,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  infoRij: {
    flexDirection: 'row',
    marginTop: spacing.sm,
    gap: spacing.base,
  },
  infoVeld: { flex: 1 },
  waarschuwing: {
    borderWidth: 1,
    borderRadius: radii.veld,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  labelRij: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.md,
    marginBottom: spacing.xs,
  },
  saldoRij: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  saldoBedrag: { fontSize: 14 },
  input: {
    borderWidth: 1,
    borderRadius: radii.veld,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: 15,
    minHeight: 44,
  },
  melding: { marginTop: spacing.md },
  samenvatting: { marginTop: spacing.md, lineHeight: 22 },
});
