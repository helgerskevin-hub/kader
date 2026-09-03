// Een prijsalert zetten op een coin. Het enige scherm in Kader waar de gebruiker zelf een niveau
// kiest in plaats van er een uit de analyse te krijgen, dus de belangrijkste taak hier is dat er
// geen twijfel bestaat over wat er straks gemeld wordt: onder het veld staat de zin die de app
// straks waarmaakt, in gewone taal.
//
// De invoer staat in de weergavevaluta (dus in euro's als de app op euro's staat), want daar staat
// de koers erboven ook in. Opslaan gebeurt in dollars, net als alle marktdata; vanWeergave doet
// die omrekening op het moment van opslaan.
import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Bell, Trash2, X } from 'lucide-react-native';
import { fmtPrijs, relatieveTijd } from '../engine/format';
import { naarWeergave, vanWeergave } from '../engine/valuta';
import { nieuweId } from '../state/portfolioTypes';
import {
  MAX_ALERTS, Prijsalert, bewaarAlerts, laadAlerts, niveauProbleem, richtingVoor, wacht,
} from '../state/prijsalerts';
import { useValutaStand } from '../state/useValuta';
import { useTheme } from '../theme/ThemeProvider';
import { Type } from '../theme/typography';
import { radii, spacing } from '../theme/tokens';
import { BottomSheet } from './BottomSheet';

interface Props {
  zichtbaar: boolean;
  onSluiten: () => void;
  symbool: string;
  naam: string;
  // De koers van dit moment, in dollars. Zonder koers kan de richting niet bepaald worden en is
  // een alert zetten uitgeschakeld: dan zou Kader moeten gokken of je boven of onder bedoelt.
  huidigePrijs?: number;
}

// Snelknoppen, zodat je een cryptokoers niet hoeft over te tikken. Percentages ten opzichte van de
// koers van dit moment.
const SNELKEUZES = [-10, -5, 5, 10] as const;

export function PrijsalertSheet({ zichtbaar, onSluiten, symbool, naam, huidigePrijs }: Props) {
  const { colors } = useTheme();
  // De formatters lezen de valuta uit een gewone module; zonder dit abonnement blijft dit scherm
  // na het omzetten in de oude valuta staan.
  useValutaStand();

  const [niveau, setNiveau] = useState('');
  const [alerts, setAlerts] = useState<Prijsalert[]>([]);
  const [fout, setFout] = useState('');
  const [bezig, setBezig] = useState(false);

  useEffect(() => {
    if (!zichtbaar) return;
    setNiveau('');
    setFout('');
    setBezig(false);
    let actief = true;
    laadAlerts().then(geladen => { if (actief) setAlerts(geladen); });
    return () => { actief = false; };
  }, [zichtbaar]);

  const vanDezeCoin = alerts.filter(a => a.symbool === symbool.toUpperCase());
  const wachtend = alerts.filter(wacht);
  const vol = wachtend.length >= MAX_ALERTS;

  const ingevuld = parseFloat(niveau.replace(',', '.'));
  const heeftNiveau = !isNaN(ingevuld) && ingevuld > 0;
  // Het ingetikte bedrag staat in de weergavevaluta, de vergelijking met de koers moet in dollars.
  const niveauUsd = heeftNiveau ? vanWeergave(ingevuld) : NaN;
  const probleem = heeftNiveau ? niveauProbleem(niveauUsd, huidigePrijs ?? null) : null;
  const richting = heeftNiveau && huidigePrijs !== undefined
    ? richtingVoor(niveauUsd, huidigePrijs)
    : null;

  const belofte = richting !== null && probleem === null
    ? `Kader meldt het zodra ${symbool} ${richting === 'boven' ? 'op of boven' : 'op of onder'} ${fmtPrijs(niveauUsd)} staat. De melding komt één keer.`
    : '';

  function vulSnelkeuze(pct: number) {
    if (huidigePrijs === undefined) return;
    // In de weergavevaluta invullen, want dat is wat het veld verwacht. fmtPrijs kan hier niet:
    // die zet er een valutateken en scheidingstekens bij, en dat is geen invoer meer.
    const doelUsd = huidigePrijs * (1 + pct / 100);
    const inWeergave = naarWeergave(doelUsd).waarde;
    // Zelfde aantal decimalen als de koers zelf nodig heeft: bij SHIB is 2 decimalen niets waard.
    const decimalen = inWeergave < 1 ? 8 : inWeergave < 100 ? 4 : 2;
    setNiveau(inWeergave.toFixed(decimalen).replace(/0+$/, '').replace(/\.$/, ''));
    setFout('');
  }

  async function bewaar() {
    if (!heeftNiveau || richting === null || probleem !== null || vol || bezig) return;
    setBezig(true);
    try {
      // Opnieuw van schijf lezen in plaats van de state in het geheugen: de achtergrondcheck kan
      // ondertussen een alert op afgegaan hebben gezet, en die wijziging mogen we niet overschrijven.
      const actueel = await laadAlerts();
      const nieuw: Prijsalert = {
        id: nieuweId(),
        symbool: symbool.toUpperCase(),
        prijs: niveauUsd,
        richting,
        aangemaakt: Date.now(),
      };
      const volgende = [nieuw, ...actueel];
      await bewaarAlerts(volgende);
      setAlerts(volgende);
      setNiveau('');
    } catch {
      setFout('Kader kon de alert niet opslaan. Probeer het nog een keer.');
    } finally {
      setBezig(false);
    }
  }

  async function verwijder(id: string) {
    try {
      const actueel = await laadAlerts();
      const volgende = actueel.filter(a => a.id !== id);
      await bewaarAlerts(volgende);
      setAlerts(volgende);
    } catch {
      setFout('Kader kon de alert niet verwijderen. Probeer het nog een keer.');
    }
  }

  return (
    <BottomSheet zichtbaar={zichtbaar} onSluiten={onSluiten} velStijl={stijlen.vel}>
      <View style={stijlen.titelRij}>
        <Text style={[Type.titel, { color: colors.tekstPrimair }]}>Prijsalert</Text>
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
        <View style={[stijlen.koersBlok, { backgroundColor: colors.verhoogd, borderColor: colors.rand }]}>
          <Text style={[Type.sectiekop, { color: colors.tekstPrimair }]}>
            {symbool} <Text style={[Type.body, { color: colors.tekstGedimd }]}>{naam}</Text>
          </Text>
          <Text style={[Type.overline, { color: colors.tekstGedimd, marginTop: spacing.sm }]}>KOERS NU</Text>
          <Text style={[Type.prijsGroot, { color: colors.tekstPrimair }]}>
            {huidigePrijs !== undefined ? fmtPrijs(huidigePrijs) : 'onbekend'}
          </Text>
        </View>

        {huidigePrijs === undefined ? (
          <Text style={[Type.body, stijlen.melding, { color: colors.tekstGedimd }]}>
            Kader heeft nu geen koers voor {symbool}, dus een alert zetten kan niet: zonder koers is
            niet te bepalen of je boven of onder dit niveau bedoelt. Probeer het opnieuw zodra de
            koers geladen is.
          </Text>
        ) : (
          <>
            <Text style={[Type.overline, stijlen.label, { color: colors.tekstGedimd }]}>
              MELD ME BIJ DEZE PRIJS
            </Text>
            <TextInput
              style={[stijlen.input, {
                backgroundColor: colors.verhoogd,
                borderColor: probleem ? colors.letOp : colors.rand,
                color: colors.tekstPrimair,
              }]}
              value={niveau}
              onChangeText={t => { setNiveau(t); setFout(''); }}
              placeholder="bijvoorbeeld 80000"
              placeholderTextColor={colors.tekstGedimd}
              keyboardType="decimal-pad"
              editable={!bezig && !vol}
            />

            <View style={stijlen.snelRij}>
              {SNELKEUZES.map(pct => (
                <Pressable
                  key={pct}
                  onPress={() => vulSnelkeuze(pct)}
                  disabled={vol}
                  style={[stijlen.snelKnop, { borderColor: colors.rand, backgroundColor: colors.verhoogd }]}
                  accessibilityRole="button"
                  accessibilityLabel={`${pct > 0 ? pct + ' procent erboven' : Math.abs(pct) + ' procent eronder'}`}
                >
                  <Text style={[Type.caption, { color: pct > 0 ? colors.winst : colors.verlies }]}>
                    {pct > 0 ? `+${pct}%` : `${pct}%`}
                  </Text>
                </Pressable>
              ))}
            </View>

            {probleem ? (
              <Text style={[Type.caption, stijlen.melding, { color: colors.letOp }]}>{probleem}</Text>
            ) : belofte ? (
              <Text style={[Type.body, stijlen.melding, { color: colors.tekstGedimd, lineHeight: 22 }]}>
                {belofte}
              </Text>
            ) : null}

            {vol ? (
              <Text style={[Type.caption, stijlen.melding, { color: colors.letOp }]}>
                Je hebt al {MAX_ALERTS} alerts openstaan, het maximum. Verwijder er eerst een.
              </Text>
            ) : null}

            {fout ? (
              <Text style={[Type.caption, stijlen.melding, { color: colors.verlies }]}>{fout}</Text>
            ) : null}

            <Pressable
              onPress={bewaar}
              disabled={!heeftNiveau || probleem !== null || vol || bezig}
              style={[stijlen.bewaarKnop, {
                backgroundColor: (!heeftNiveau || probleem !== null || vol || bezig)
                  ? colors.rand
                  : colors.cta,
              }]}
              accessibilityRole="button"
              accessibilityLabel={`Alert instellen voor ${symbool}`}
            >
              <Bell size={16} color="white" strokeWidth={1.75} />
              <Text style={[Type.body, stijlen.bewaarTekst]}>Alert instellen</Text>
            </Pressable>
          </>
        )}

        {vanDezeCoin.length > 0 && (
          <View style={stijlen.lijst}>
            <Text style={[Type.overline, { color: colors.tekstGedimd, marginBottom: spacing.sm }]}>
              JOUW ALERTS VOOR {symbool}
            </Text>
            {vanDezeCoin.map(alert => (
              <View
                key={alert.id}
                style={[stijlen.regel, { backgroundColor: colors.verhoogd, borderColor: colors.rand }]}
              >
                <View style={stijlen.regelTekst}>
                  <Text style={[Type.body, { color: colors.tekstPrimair }]}>
                    {alert.richting === 'boven' ? 'Boven' : 'Onder'} {fmtPrijs(alert.prijs)}
                  </Text>
                  <Text style={[Type.caption, { color: alert.afgegaanOp ? colors.winst : colors.tekstGedimd }]}>
                    {alert.afgegaanOp
                      ? `Afgegaan ${relatieveTijd(alert.afgegaanOp)}${alert.afgegaanBij !== undefined ? ` op ${fmtPrijs(alert.afgegaanBij)}` : ''}`
                      : 'Wacht op dit niveau'}
                  </Text>
                </View>
                <Pressable
                  onPress={() => verwijder(alert.id)}
                  style={stijlen.wisKnop}
                  accessibilityRole="button"
                  accessibilityLabel={`Alert op ${fmtPrijs(alert.prijs)} verwijderen`}
                  hitSlop={8}
                >
                  <Trash2 size={17} color={colors.verlies} strokeWidth={1.75} />
                </Pressable>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </BottomSheet>
  );
}

const stijlen = StyleSheet.create({
  vel: { maxHeight: '90%' },
  titelRij: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.base,
  },
  sluitKnop: { minHeight: 44, minWidth: 44, alignItems: 'flex-end', justifyContent: 'center' },
  koersBlok: {
    borderWidth: 1,
    borderRadius: radii.veld,
    padding: spacing.md,
  },
  label: { marginTop: spacing.base, marginBottom: spacing.xs },
  input: {
    borderWidth: 1,
    borderRadius: radii.veld,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: 15,
    minHeight: 44,
  },
  snelRij: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  snelKnop: {
    flex: 1,
    borderWidth: 1,
    borderRadius: radii.pill,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 40,
  },
  melding: { marginTop: spacing.md },
  bewaarKnop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    borderRadius: radii.knop,
    paddingVertical: spacing.md,
    marginTop: spacing.base,
    minHeight: 44,
  },
  bewaarTekst: { color: 'white', fontWeight: '600' },
  lijst: { marginTop: spacing.xl },
  regel: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: radii.veld,
    padding: spacing.md,
    marginBottom: spacing.sm,
    gap: spacing.sm,
  },
  regelTekst: { flex: 1, gap: 2 },
  wisKnop: { minHeight: 44, minWidth: 44, alignItems: 'center', justifyContent: 'center' },
});
