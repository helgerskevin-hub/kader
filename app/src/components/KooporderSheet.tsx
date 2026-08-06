// De sheet die een echte kooporder bij eToro plaatst. Een koopknop op een kaart opent alleen deze
// sheet, hij plaatst nooit zelf een order: kopen kost altijd twee bewuste handelingen.
//
// Alles hier is fail-closed. Ontbreekt het instrumentId, keurt bepaalStop de stop af, of past het
// bedrag niet in je saldo, dan is bevestigen simpelweg uitgeschakeld. En na een onbekende uitkomst
// verschijnt er nergens een knop die het verzoek opnieuw verstuurt.
import React, { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { X } from 'lucide-react-native';
import { fmtPrijs } from '../engine/format';
import { bepaalStop, StopAdvies } from '../engine/etoroLimieten';
import { bouwKooporderBody, guid, haalVrijSaldo, KooporderInvoer, plaatsKooporder } from '../engine/etoro';
import { actieveSleutels } from '../state/etoroSleutels';
import { OnbekendeOrder } from '../state/lopendeOrders';
import { usePortfolio } from '../state/PortfolioProvider';
import { useInstrumentId } from '../state/useInstrumentId';
import { useStopLossLimiet } from '../state/useStopLossLimiet';
import { useTheme } from '../theme/ThemeProvider';
import { Type } from '../theme/typography';
import { radii, spacing } from '../theme/tokens';
import { BottomSheet } from './BottomSheet';
import { OrderBevestigKnop } from './OrderBevestigKnop';

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
}

export function KooporderSheet({ zichtbaar, onSluiten, symbool, naam, entry, stop, doel, onGeslaagd }: Props) {
  const { colors } = useTheme();
  const { omgeving, magHandelen, trades, verzoenNaOrder, noteerOnbekendeOrder } = usePortfolio();
  const instrumentId = useInstrumentId(zichtbaar ? symbool : null);
  const stopLimiet = useStopLossLimiet(zichtbaar ? symbool : null);

  const [bedrag, setBedrag] = useState('');
  const [vrijSaldo, setVrijSaldo] = useState<number | null>(null);
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
    stopLossRate,
    takeProfitRate: doel,
  };

  // De samenvatting komt uit de body die daadwerkelijk verstuurd wordt, niet uit de formuliervelden.
  // Anders kan er iets anders op het scherm staan dan wat er de deur uitgaat.
  const body = bouwKooporderBody(invoer);
  const niveaus: string[] = [];
  if (typeof body.stopLossRate === 'number') niveaus.push(`stop-loss ${fmtPrijs(body.stopLossRate)}`);
  if (typeof body.takeProfitRate === 'number') niveaus.push(`doel ${fmtPrijs(body.takeProfitRate)}`);
  const niveauZin = niveaus.length > 0
    ? ` ${niveaus.join(', ').replace(/^./, t => t.toUpperCase())}.`
    : '';
  const samenvatting = heeftBedrag
    ? `Je koopt voor ${fmtPrijs(bedragGetal)} aan ${symbool} tegen de marktprijs.${niveauZin}`
    : '';

  // Eén rode melding tegelijk, in de volgorde waarin ze zwaarwegend zijn.
  const blokkade =
    instrumentId === null
      ? `Kader kan ${symbool} niet eenduidig aan een eToro-instrument koppelen. Kopen via de app is daarom uitgeschakeld.`
    : advies.soort === 'waarschuwing' ? advies.uitleg
    : heeftBedrag && bedragGetal < MINIMUM_USD ? `Het minimum bij eToro is ${fmtPrijs(MINIMUM_USD)}.`
    : heeftBedrag && vrijSaldo !== null && bedragGetal * KOSTENMARGE > vrijSaldo
      ? `Dit past niet in je vrije saldo van ${fmtPrijs(vrijSaldo)}. eToro rekent kosten bovenop je inleg, dus houd wat ruimte over.`
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
        onGeslaagd?.(`Je koop van ${fmtPrijs(bedragGetal)} in ${symbool} staat bij eToro. Hij verschijnt in je portfolio zodra de order gevuld is.`);
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
        <Text style={[Type.titel, { color: colors.tekstPrimair }]}>{symbool} kopen</Text>
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
        <View style={[stijlen.infoBlok, { backgroundColor: colors.verhoogd, borderColor: colors.rand }]}>
          <Text style={[Type.sectiekop, { color: colors.tekstPrimair }]}>
            {symbool} <Text style={[Type.body, { color: colors.tekstGedimd }]}>{naam}</Text>
          </Text>
          <View style={stijlen.infoRij}>
            <View style={stijlen.infoVeld}>
              <Text style={[Type.overline, { color: colors.tekstGedimd }]}>ENTRY</Text>
              <Text style={[Type.prijs, { color: colors.tekstPrimair }]}>{fmtPrijs(entry)}</Text>
            </View>
            <View style={stijlen.infoVeld}>
              <Text style={[Type.overline, { color: colors.tekstGedimd }]}>
                {advies.soort === 'vast' ? 'STOP (KADER)' : 'STOP'}
              </Text>
              <Text style={[Type.prijs, { color: colors.verlies }]}>{fmtPrijs(getoondeStop)}</Text>
            </View>
            <View style={stijlen.infoVeld}>
              <Text style={[Type.overline, { color: colors.tekstGedimd }]}>DOEL</Text>
              <Text style={[Type.prijs, { color: colors.winst }]}>{fmtPrijs(doel)}</Text>
            </View>
          </View>
          <Text style={[Type.caption, { color: colors.tekstGedimd, marginTop: spacing.sm, lineHeight: 18 }]}>
            De entry komt uit de analyse van Kader. De order gaat tegen de marktprijs, dus je koopt
            tegen de koers van dat moment.
          </Text>
        </View>

        {advies.soort === 'aangepast' || advies.soort === 'vast' ? (
          <View style={[stijlen.waarschuwing, { backgroundColor: colors.verhoogd, borderColor: colors.letOp }]}>
            <Text style={[Type.caption, { color: colors.letOp }]}>{advies.uitleg}</Text>
          </View>
        ) : null}

        <Text style={[Type.overline, stijlen.label, { color: colors.tekstGedimd }]}>BEDRAG IN $</Text>
        <TextInput
          style={inputStyle}
          value={bedrag}
          onChangeText={setBedrag}
          placeholder={`minimaal ${MINIMUM_USD}`}
          placeholderTextColor={colors.tekstGedimd}
          keyboardType="decimal-pad"
          editable={!bezig && onbekend === ''}
        />
        {vrijSaldo !== null ? (
          <Text style={[Type.caption, { color: colors.tekstGedimd, marginTop: spacing.xs }]}>
            Beschikbaar: {fmtPrijs(vrijSaldo)}
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
          label={`${symbool} kopen bij eToro`}
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
  label: { marginTop: spacing.md, marginBottom: spacing.xs },
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
