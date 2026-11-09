// "Kopieer alles via eToro": start eToro's eigen CopyTrader voor één belegger. eToro voert daarna
// elke trade van die belegger zelf uit, zonder vertraging en zonder dat Kader iets doet.
//
// Omdat eToro dan ook shorts en hefboom overneemt, kan dit alleen bij een rustige belegger (zie
// toetsAllesKopieren) en hoort er altijd een Copy Stop Loss bij. eToro's API heeft daar geen veld
// voor (gemeten in de docs, november 2026), dus Kader legt de gekozen grens vast, vraagt de
// gebruiker hem in eToro te zetten en vergelijkt hem in Mijn copies met wat eToro werkelijk heeft.
//
// Dit is een geldpad: één verzoekId per keer openen, nooit automatisch herhalen, en een onbekende
// uitkomst wordt nagekeken en niet opnieuw verstuurd.
import React, { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { AlertTriangle, X } from 'lucide-react-native';
import { BottomSheet } from '../BottomSheet';
import { OrderBevestigKnop, useGeluktMoment } from '../OrderBevestigKnop';
import { useTheme } from '../../theme/ThemeProvider';
import { Type } from '../../theme/typography';
import { radii, spacing } from '../../theme/tokens';
import { fmtBedrag } from '../../engine/format';
import { guid } from '../../engine/etoro';
import {
  MAX_CSL, MAX_GEM_HEFBOOM, MAX_SHORT_PCT, MIN_CSL, TraderPositie, begrensCsl, copyReferentie, toetsAllesKopieren,
} from '../../engine/copyTrading';
import { haalCopyUitkomst, startCopy, toetsCopy } from '../../engine/etoroTraders';
import { actieveSleutels } from '../../state/etoroSleutels';
import { usePortfolio } from '../../state/PortfolioProvider';
import { useDialoog } from '../../state/DialoogProvider';
import { AllesCopy, bewaarAllesCopies, laadAllesCopies } from '../../state/copyOpslag';

const DOLLARS = { valuta: 'USD' } as const;
const STANDAARD_BEDRAG = 200;
const POLL_MS = [2_000, 5_000, 10_000];

interface Props {
  zichtbaar: boolean;
  onSluiten: () => void;
  username: string;
  cid: number;
  adviesCsl: number;
  posities: TraderPositie[];
}

type Toets = { stand: 'bezig' } | { stand: 'ok' } | { stand: 'nee'; reden: string } | { stand: 'onbekend' };

export function AllesKopierenSheet({ zichtbaar, onSluiten, username, cid, adviesCsl, posities }: Props) {
  const { colors } = useTheme();
  const { omgeving, magHandelen } = usePortfolio();
  const { toonDialoog } = useDialoog();
  const [bedrag, setBedrag] = useState(String(STANDAARD_BEDRAG));
  const [csl, setCsl] = useState(String(begrensCsl(adviesCsl)));
  const [toets, setToets] = useState<Toets>({ stand: 'bezig' });
  const [bezig, setBezig] = useState(false);
  const [fout, setFout] = useState('');
  const loopt = useRef(false);
  const verzoekId = useRef(guid());
  const { gelukt, vier, wis } = useGeluktMoment(onSluiten);

  const rustig = toetsAllesKopieren(posities);
  const bedragGetal = Math.round(Number(bedrag.replace(',', '.')) * 100) / 100;
  const heeftBedrag = Number.isFinite(bedragGetal) && bedragGetal > 0;
  const cslGetal = Number(csl.replace(',', '.'));
  const cslGeldig = Number.isFinite(cslGetal) && cslGetal >= MIN_CSL && cslGetal <= MAX_CSL;

  useEffect(() => {
    if (!zichtbaar) return;
    verzoekId.current = guid();
    setBedrag(String(STANDAARD_BEDRAG));
    setCsl(String(begrensCsl(adviesCsl)));
    setFout('');
    setBezig(false);
    loopt.current = false;
    wis();
  }, [zichtbaar, adviesCsl]);

  // De droogtest van eToro, kort na het typen. Verandert niets bij eToro.
  useEffect(() => {
    if (!zichtbaar || !rustig.mag || !heeftBedrag || cid <= 0) return;
    setToets({ stand: 'bezig' });
    let actief = true;
    const wekker = setTimeout(async () => {
      try {
        const sleutels = await actieveSleutels();
        if (!sleutels) { if (actief) setToets({ stand: 'onbekend' }); return; }
        const t = await toetsCopy(cid, bedragGetal, sleutels);
        if (!actief) return;
        setToets(t.mag ? { stand: 'ok' } : { stand: 'nee', reden: t.reden ?? 'eToro staat deze copy niet toe.' });
      } catch {
        if (actief) setToets({ stand: 'onbekend' });
      }
    }, 600);
    return () => { actief = false; clearTimeout(wekker); };
  }, [zichtbaar, bedragGetal, cid, rustig.mag, heeftBedrag]);

  const blokkade =
    !magHandelen ? 'Koppel eToro met schrijfrecht om een copy te starten.'
    : cid <= 0 ? 'Kader kent het account-id van deze belegger nog niet. Ververs Ontdek en probeer het opnieuw.'
    : !heeftBedrag ? null
    : !cslGeldig ? `Kies een Copy Stop Loss tussen ${MIN_CSL}% en ${MAX_CSL}%.`
    : toets.stand === 'nee' ? toets.reden
    : null;

  const magBevestigen = rustig.mag && heeftBedrag && cslGeldig && blokkade === null
    && (toets.stand === 'ok' || toets.stand === 'onbekend');

  async function bevestig() {
    if (!magBevestigen || loopt.current) return;
    loopt.current = true;
    setFout('');
    setBezig(true);
    let sleutels: Awaited<ReturnType<typeof actieveSleutels>> = null;
    try {
      sleutels = await actieveSleutels();
    } catch {
      sleutels = null;
    }
    if (!sleutels || (sleutels.omgeving ?? 'real') !== omgeving) {
      setFout(sleutels ? 'Je omgeving is net gewisseld. Sluit dit venster en open het opnieuw.' : 'Er staat geen eToro-sleutel klaar.');
      setBezig(false);
      loopt.current = false;
      return;
    }

    const referentie = copyReferentie();
    const record: AllesCopy = {
      referentie,
      verzoekId: verzoekId.current,
      username,
      cid,
      bedragUsd: bedragGetal,
      cslPct: Math.round(cslGetal),
      omgeving,
      tijd: Date.now(),
      status: 'onderweg',
    };
    // Eerst vastleggen, dan versturen: een app-kill midden in het verzoek laat zo een spoor na.
    try {
      await bewaarAllesCopies([...(await laadAllesCopies()), record]);
    } catch {
      // Zonder spoor gaat het verzoek toch: het blijft één verzoek, en Mijn copies leest eToro zelf.
    }

    const uitkomst = await startCopy(cid, bedragGetal, referentie, sleutels, verzoekId.current);
    if (uitkomst.soort === 'fout') {
      await werkBij(referentie, { status: 'mislukt', reden: uitkomst.bericht });
      setFout(uitkomst.bericht);
      setBezig(false);
      loopt.current = false;
      return;
    }
    if (uitkomst.soort === 'onbekend') {
      await werkBij(referentie, { status: 'onbekend', reden: uitkomst.bericht });
      setBezig(false);
      onSluiten();
      toonDialoog({
        variant: 'waarschuwing',
        rondje: 'onzeker',
        titel: 'Niet zeker of de copy is gestart',
        tekst: `eToro gaf geen duidelijk antwoord. Kijk in eToro onder Portfolio of ${username} erbij staat. Kader verstuurt het verzoek niet opnieuw.`,
        knoppen: [{ label: 'Oké' }],
      });
      return;
    }

    // Aangenomen. De uitkomst komt los; even nakijken, nooit opnieuw versturen.
    let eind: AllesCopy['status'] = 'onderweg';
    let mirrorId: number | undefined;
    let reden: string | undefined;
    for (const wacht of POLL_MS) {
      await new Promise(r => setTimeout(r, wacht));
      try {
        const u = await haalCopyUitkomst(referentie, sleutels);
        if (u.soort === 'gelukt') { eind = 'actief'; mirrorId = u.mirrorId ?? undefined; break; }
        if (u.soort === 'mislukt') { eind = 'mislukt'; reden = u.reden; break; }
      } catch {
        // Nakijken mislukte; de copy kan wel lopen. Mijn copies laat het zien zodra eToro het weet.
      }
    }
    await werkBij(referentie, { status: eind, mirrorId, reden });

    if (eind === 'mislukt') {
      setFout(reden ?? 'eToro heeft de copy niet gestart.');
      setBezig(false);
      loopt.current = false;
      return;
    }

    vier(() => {
      onSluiten();
      toonDialoog({
        variant: 'gelukt',
        rondje: eind === 'actief' ? 'gelukt' : 'onzeker',
        titel: eind === 'actief' ? `Je kopieert nu ${username}` : 'Copy is aangevraagd',
        tekst: `Zet in eToro je Copy Stop Loss voor ${username} op ${Math.round(cslGetal)}%. eToro laat Kader die grens niet zelf zetten. Kader waarschuwt in Mijn copies als hij ruimer staat.`,
        knoppen: [{ label: 'Begrepen' }],
      });
    });
  }

  async function werkBij(referentie: string, wijziging: Partial<AllesCopy>) {
    try {
      const lijst = await laadAllesCopies();
      await bewaarAllesCopies(lijst.map(c => (c.referentie === referentie ? { ...c, ...wijziging } : c)));
    } catch {
      // Alleen het lokale spoor mist dan; de uitkomst bij eToro verandert er niet door.
    }
  }

  return (
    <BottomSheet zichtbaar={zichtbaar} onSluiten={onSluiten} velStijl={styles.vel}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.inhoud} showsVerticalScrollIndicator={false}>
        <View style={styles.titelRij}>
          <Text style={[Type.titel, styles.flex, { color: colors.tekstPrimair }]}>Kopieer alles van {username}</Text>
          <Pressable onPress={onSluiten} accessibilityRole="button" accessibilityLabel="Sluiten" style={styles.sluitKnop}>
            <X size={20} color={colors.tekstGedimd} strokeWidth={1.75} />
          </Pressable>
        </View>

        <Text style={[Type.body, { color: colors.tekstGedimd, lineHeight: 22 }]}>
          eToro kopieert vanaf nu alle trades van {username}, ook die buiten crypto. Je stopt het kopiëren in
          eToro of in Mijn copies.
        </Text>

        {!rustig.mag ? (
          <View style={[styles.waarschuwing, { borderColor: colors.letOp }]}>
            <AlertTriangle size={18} color={colors.letOp} strokeWidth={1.75} />
            <Text style={[Type.body, styles.flex, { color: colors.tekstPrimair, lineHeight: 22 }]}>
              {posities.length === 0
                ? `${username} heeft nu geen open posities. Kader kan dan niet zien hoeveel hefboom en shorts hij gebruikt.`
                : `${username} gebruikt veel hefboom of shorts (gemiddeld ${rustig.gemHefboom}x, ${rustig.shortPct}% short; grens ${MAX_GEM_HEFBOOM}x en ${MAX_SHORT_PCT}%). Kopieer zijn trades liever een voor een.`}
            </Text>
          </View>
        ) : (
          <>
            <Text style={[Type.sectiekop, { color: colors.tekstPrimair }]}>Bedrag</Text>
            <View style={[styles.veldRij, { backgroundColor: colors.verhoogd }]}>
              <Text style={[Type.prijs, { color: colors.tekstGedimd }]}>$</Text>
              <TextInput
                value={bedrag}
                onChangeText={setBedrag}
                keyboardType="decimal-pad"
                style={[Type.prijs, styles.veld, { color: colors.tekstPrimair }]}
                accessibilityLabel="Bedrag voor deze copy in dollars"
              />
            </View>

            <Text style={[Type.sectiekop, { color: colors.tekstPrimair }]}>Copy Stop Loss</Text>
            <View style={[styles.veldRij, { backgroundColor: colors.verhoogd }]}>
              <TextInput
                value={csl}
                onChangeText={setCsl}
                onBlur={() => setCsl(String(begrensCsl(Number(csl.replace(',', '.')))))}
                keyboardType="number-pad"
                style={[Type.prijs, styles.veld, { color: colors.tekstPrimair }]}
                accessibilityLabel="Copy Stop Loss in procent"
              />
              <Text style={[Type.prijs, { color: colors.tekstGedimd }]}>%</Text>
            </View>
            <Text style={[Type.caption, { color: colors.tekstGedimd, lineHeight: 18 }]}>
              Advies van Kader: {begrensCsl(adviesCsl)}%. Krapper mag, ruimer dan {MAX_CSL}% niet. Bij een short of
              hefboom kan een positie meer verliezen dan de inzet. De Copy Stop Loss stopt de hele copy als die grens
              wordt geraakt.
            </Text>

            {heeftBedrag && toets.stand === 'bezig' && (
              <Text style={[Type.caption, { color: colors.tekstGedimd }]}>eToro controleert of deze copy kan...</Text>
            )}
            {(blokkade || fout) && (
              <Text style={[Type.caption, { color: colors.verlies, lineHeight: 18 }]}>{fout || blokkade}</Text>
            )}

            {heeftBedrag && magBevestigen && (
              <Text style={[Type.body, { color: colors.tekstPrimair, lineHeight: 22 }]}>
                Je zet {fmtBedrag(bedragGetal, DOLLARS)} in op een copy van {username}. Copy Stop Loss {Math.round(cslGetal)}%.
              </Text>
            )}

            <OrderBevestigKnop
              label="Start copy"
              omgeving={omgeving}
              bezig={bezig}
              uitgeschakeld={!magBevestigen}
              onBevestig={bevestig}
              gelukt={gelukt}
            />
          </>
        )}
      </ScrollView>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  vel: { maxHeight: '92%' },
  inhoud: { gap: spacing.md },
  titelRij: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  flex: { flex: 1 },
  sluitKnop: { minHeight: 44, minWidth: 44, alignItems: 'flex-end', justifyContent: 'center' },
  waarschuwing: {
    flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start',
    borderWidth: 1, borderRadius: radii.kaart, padding: spacing.base,
  },
  veldRij: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.xs,
    paddingHorizontal: spacing.base, borderRadius: radii.veld, minHeight: 52,
  },
  veld: { flex: 1, paddingVertical: spacing.md },
});
