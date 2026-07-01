import React, { useState, useEffect } from 'react';
import {
  View, Text, Pressable, FlatList, Modal, TextInput, ScrollView,
  StyleSheet, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Plus, X, Users, ChevronDown, ChevronUp } from 'lucide-react-native';
import { TraderInput, TraderAudit } from '../engine/types';
import { beoordeelTrader } from '../engine/auditor';
import { useTheme } from '../theme/ThemeProvider';
import { Type } from '../theme/typography';
import { spacing, radii, shadow } from '../theme/tokens';
import { Disclaimer } from '../components/Disclaimer';
import { ScreenHeader } from '../components/ScreenHeader';
import { laadLijst, bewaarLijst, SLEUTELS } from '../storage/opslag';

// ---------- Helpers ----------
function parseerMaandrendementen(tekst: string): number[] {
  return tekst
    .split(/[,\s]+/)
    .map(s => parseFloat(s.replace(',', '.')))
    .filter(n => !isNaN(n));
}

function parseerPortfolio(tekst: string): Record<string, number> {
  const result: Record<string, number> = {};
  for (const deel of tekst.split(/[,\s]+/)) {
    const [sym, pctStr] = deel.split('=');
    if (sym && pctStr) {
      const pct = parseFloat(pctStr.replace(',', '.'));
      if (!isNaN(pct)) result[sym.toUpperCase()] = pct;
    }
  }
  return result;
}

// ---------- TraderAuditCard ----------
interface OpgeslagenTrader { id: string; audit: TraderAudit }

function TraderAuditCard({ opgeslagen, onVerwijder }: {
  opgeslagen: OpgeslagenTrader;
  onVerwijder: () => void;
}) {
  const { colors } = useTheme();
  const { audit } = opgeslagen;
  const [uitgeklapt, setUitgeklapt] = useState(true);

  const oordeelKleur = audit.oordeel === 'GROEN' ? colors.winst
    : audit.oordeel === 'GEEL' ? colors.letOp
    : colors.verlies;

  return (
    <View style={[auditStyles.kaart, shadow.kaart, { backgroundColor: colors.kaart, borderLeftColor: oordeelKleur }]}>
      {/* Koptekst */}
      <Pressable
        style={auditStyles.kop}
        onPress={() => setUitgeklapt(v => !v)}
        accessibilityRole="button"
        accessibilityLabel={`${audit.naam} ${uitgeklapt ? 'inklappen' : 'uitklappen'}`}
      >
        <View style={auditStyles.kopLinks}>
          <Text style={[Type.sectiekop, { color: colors.tekstPrimair }]}>{audit.naam}</Text>
          <View style={auditStyles.oordeelRij}>
            <View style={[auditStyles.oordeelDot, { backgroundColor: oordeelKleur }]} />
            <Text style={[Type.caption, { color: oordeelKleur, fontWeight: '600' }]}>{audit.oordeel}</Text>
          </View>
        </View>
        <View style={auditStyles.kopRechts}>
          <View style={[auditStyles.scoreBadge, { backgroundColor: oordeelKleur + '22' }]}>
            <Text style={[Type.prijsGroot, { color: oordeelKleur }]}>{audit.totaalscore}</Text>
          </View>
          {uitgeklapt
            ? <ChevronUp size={16} color={colors.tekstGedimd} strokeWidth={1.75} />
            : <ChevronDown size={16} color={colors.tekstGedimd} strokeWidth={1.75} />}
        </View>
      </Pressable>

      {/* CSL-aanbeveling — altijd zichtbaar */}
      <View style={[auditStyles.cslRij, { backgroundColor: colors.verhoogd }]}>
        <Text style={[Type.caption, { color: colors.tekstGedimd }]}>Aanbevolen Copy Stop Loss</Text>
        <Text style={[Type.prijs, { color: colors.tekstPrimair, fontWeight: '700' }]}>{audit.csl}%</Text>
      </View>

      {/* Uitklapbare details */}
      {uitgeklapt && (
        <View style={auditStyles.detail}>
          {/* Deelscores */}
          <View style={auditStyles.deelScores}>
            {([
              { label: 'CONSISTENTIE', score: audit.consistentie.score },
              { label: 'RISICO', score: audit.risico.score },
              { label: 'PORTFOLIO', score: audit.portfolio.score },
            ] as const).map(({ label, score }) => {
              const kleur = score >= 70 ? colors.winst : score >= 50 ? colors.letOp : colors.verlies;
              return (
                <View key={label} style={auditStyles.deelScore}>
                  <Text style={[Type.prijsGroot, { color: kleur }]}>{score}</Text>
                  <Text style={[Type.overline, { color: colors.tekstGedimd }]}>{label}</Text>
                </View>
              );
            })}
          </View>

          {/* Opmerkingen */}
          <View style={[auditStyles.opmerkingen, { borderTopColor: colors.rand }]}>
            {[
              { titel: 'Consistentie', tekst: audit.consistentie.opmerking },
              { titel: 'Risico', tekst: audit.risico.opmerking },
              { titel: 'Portfolio', tekst: audit.portfolio.opmerking },
            ].map(({ titel, tekst }) => (
              <View key={titel} style={auditStyles.opmerking}>
                <Text style={[Type.overline, { color: colors.tekstGedimd }]}>{titel.toUpperCase()}</Text>
                <Text style={[Type.caption, { color: colors.tekstGedimd, lineHeight: 18 }]}>{tekst}</Text>
              </View>
            ))}
          </View>

          {/* Risico-stats */}
          <View style={[auditStyles.statsRij, { borderTopColor: colors.rand }]}>
            <View style={auditStyles.statItem}>
              <Text style={[Type.overline, { color: colors.tekstGedimd }]}>MAX DD</Text>
              <Text style={[Type.prijs, { color: colors.verlies }]}>-{audit.risico.maxDrawdown}%</Text>
            </View>
            <View style={auditStyles.statItem}>
              <Text style={[Type.overline, { color: colors.tekstGedimd }]}>JAAR %</Text>
              <Text style={[Type.prijs, {
                color: audit.risico.jaarrendement >= 0 ? colors.winst : colors.verlies,
              }]}>
                {audit.risico.jaarrendement >= 0 ? '+' : ''}{audit.risico.jaarrendement}%
              </Text>
            </View>
            <View style={auditStyles.statItem}>
              <Text style={[Type.overline, { color: colors.tekstGedimd }]}>RATIO</Text>
              <Text style={[Type.prijs, { color: colors.tekstPrimair }]}>
                {audit.risico.ratio.toFixed(1)}
              </Text>
            </View>
          </View>
        </View>
      )}

      {/* Voet */}
      <View style={[auditStyles.voet, { borderTopColor: colors.rand }]}>
        <Pressable
          style={auditStyles.verwijderKnop}
          onPress={onVerwijder}
          accessibilityRole="button"
          accessibilityLabel={`${audit.naam} verwijderen`}
        >
          <Text style={[Type.caption, { color: colors.verlies }]}>Verwijder</Text>
        </Pressable>
      </View>
    </View>
  );
}

const auditStyles = StyleSheet.create({
  kaart: {
    borderRadius: radii.kaart,
    borderLeftWidth: 4,
    marginHorizontal: spacing.base,
    marginBottom: spacing.md,
  },
  kop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.base,
    minHeight: 44,
  },
  kopLinks: { gap: 4, flex: 1 },
  kopRechts: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  oordeelRij: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  oordeelDot: { width: 8, height: 8, borderRadius: 4 },
  scoreBadge: {
    width: 48,
    height: 48,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cslRij: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.sm,
  },
  detail: {},
  deelScores: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.base,
  },
  deelScore: { alignItems: 'center', gap: 4 },
  opmerkingen: {
    paddingHorizontal: spacing.base,
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
    gap: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  opmerking: { gap: 2 },
  statsRij: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  statItem: { alignItems: 'center', gap: 4 },
  voet: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing.base,
    minHeight: 44,
    alignItems: 'center',
  },
  verwijderKnop: { minHeight: 44, justifyContent: 'center' },
});

// ---------- TraderFormulier ----------
interface TraderFormData {
  naam: string;
  riskScore: string;
  maxDrawdown: string;
  jaarrendement: string;
  maandrendementen: string;
  portfolio: string;
}

const leegTraderForm: TraderFormData = {
  naam: '', riskScore: '4', maxDrawdown: '', jaarrendement: '', maandrendementen: '', portfolio: '',
};

function TraderFormulier({ zichtbaar, onSluiten, onOpslaan }: {
  zichtbaar: boolean;
  onSluiten: () => void;
  onOpslaan: (trader: OpgeslagenTrader) => void;
}) {
  const { colors } = useTheme();
  const [form, setForm] = useState<TraderFormData>(leegTraderForm);
  const [fout, setFout] = useState('');

  function reset() {
    setForm(leegTraderForm);
    setFout('');
  }

  function valideerEnOpslaan() {
    const naam = form.naam.trim();
    if (!naam) { setFout('Voer een naam in'); return; }

    const dd = parseFloat(form.maxDrawdown.replace(',', '.'));
    if (isNaN(dd) || dd < 0) { setFout('Voer een geldige max drawdown in (positief getal, bijv. 32.5)'); return; }

    const riskScore = parseInt(form.riskScore, 10);
    const jaarStr = form.jaarrendement.trim();
    const jaarParsed = jaarStr ? parseFloat(jaarStr.replace(',', '.')) : null;
    const jaarrendement = (jaarParsed !== null && !isNaN(jaarParsed)) ? jaarParsed : null;

    const input: TraderInput = {
      naam,
      maandrendementen: parseerMaandrendementen(form.maandrendementen),
      maxDrawdown: dd,
      jaarrendement,
      riskScore,
      portfolio: parseerPortfolio(form.portfolio),
    };

    const audit = beoordeelTrader(input);
    onOpslaan({ id: Date.now().toString(36), audit });
    reset();
  }

  const inputStyle = [traderFormStyles.input, {
    backgroundColor: colors.verhoogd,
    borderColor: colors.rand,
    color: colors.tekstPrimair,
  }];

  return (
    <Modal visible={zichtbaar} animationType="slide" transparent onRequestClose={onSluiten}>
      <KeyboardAvoidingView
        style={traderFormStyles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={[traderFormStyles.vel, shadow.modal, { backgroundColor: colors.kaart }]}>
          <View style={traderFormStyles.titelRij}>
            <Text style={[Type.titel, { color: colors.tekstPrimair }]}>Trader beoordelen</Text>
            <Pressable
              onPress={() => { reset(); onSluiten(); }}
              style={traderFormStyles.sluitKnop}
              accessibilityLabel="Sluiten"
              accessibilityRole="button"
            >
              <X size={20} color={colors.tekstGedimd} strokeWidth={1.75} />
            </Pressable>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            <Text style={[Type.overline, traderFormStyles.label, { color: colors.tekstGedimd }]}>NAAM *</Text>
            <TextInput
              style={inputStyle}
              value={form.naam}
              onChangeText={v => setForm(f => ({ ...f, naam: v }))}
              placeholder="eToro-gebruikersnaam"
              placeholderTextColor={colors.tekstGedimd}
              autoCapitalize="words"
            />

            <Text style={[Type.overline, traderFormStyles.label, { color: colors.tekstGedimd }]}>
              RISICOSCORE (eToro, 1 = laag, 7 = hoog) *
            </Text>
            <View style={traderFormStyles.riskRij}>
              {['1', '2', '3', '4', '5', '6', '7'].map(v => (
                <Pressable
                  key={v}
                  style={[
                    traderFormStyles.riskKnop,
                    {
                      backgroundColor: form.riskScore === v ? colors.cta : colors.verhoogd,
                      borderColor: form.riskScore === v ? colors.cta : colors.rand,
                    },
                  ]}
                  onPress={() => setForm(f => ({ ...f, riskScore: v }))}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: form.riskScore === v }}
                  accessibilityLabel={`Risicoscore ${v}`}
                >
                  <Text style={[Type.caption, {
                    color: form.riskScore === v ? 'white' : colors.tekstGedimd,
                    fontWeight: '600',
                  }]}>
                    {v}
                  </Text>
                </Pressable>
              ))}
            </View>

            <Text style={[Type.overline, traderFormStyles.label, { color: colors.tekstGedimd }]}>MAX DRAWDOWN % *</Text>
            <TextInput
              style={inputStyle}
              value={form.maxDrawdown}
              onChangeText={v => setForm(f => ({ ...f, maxDrawdown: v }))}
              placeholder="bijv. 32.5"
              placeholderTextColor={colors.tekstGedimd}
              keyboardType="decimal-pad"
            />

            <Text style={[Type.overline, traderFormStyles.label, { color: colors.tekstGedimd }]}>
              JAARRENDEMENT % (optioneel)
            </Text>
            <TextInput
              style={inputStyle}
              value={form.jaarrendement}
              onChangeText={v => setForm(f => ({ ...f, jaarrendement: v }))}
              placeholder="bijv. 85.2"
              placeholderTextColor={colors.tekstGedimd}
              keyboardType="decimal-pad"
            />

            <Text style={[Type.overline, traderFormStyles.label, { color: colors.tekstGedimd }]}>
              MAANDRENDEMENTEN % (komma-gescheiden, optioneel)
            </Text>
            <TextInput
              style={[inputStyle, traderFormStyles.multilineInput]}
              value={form.maandrendementen}
              onChangeText={v => setForm(f => ({ ...f, maandrendementen: v }))}
              placeholder="bijv. 3.2, -1.5, 4.1, 8.3, -2.0"
              placeholderTextColor={colors.tekstGedimd}
              multiline
            />

            <Text style={[Type.overline, traderFormStyles.label, { color: colors.tekstGedimd }]}>
              PORTFOLIO (optioneel, bijv. BTC=40 ETH=30 SOL=30)
            </Text>
            <TextInput
              style={[inputStyle, traderFormStyles.multilineInput]}
              value={form.portfolio}
              onChangeText={v => setForm(f => ({ ...f, portfolio: v }))}
              placeholder="BTC=40 ETH=25 SOL=20 DOGE=15"
              placeholderTextColor={colors.tekstGedimd}
              multiline
              autoCapitalize="characters"
            />

            {fout ? (
              <Text style={[Type.caption, { color: colors.verlies, marginTop: spacing.sm }]}>{fout}</Text>
            ) : null}

            <Pressable
              style={[traderFormStyles.opslaanKnop, { backgroundColor: colors.cta }]}
              onPress={valideerEnOpslaan}
              accessibilityRole="button"
            >
              <Text style={[Type.body, { color: 'white', fontWeight: '600' }]}>Beoordelen</Text>
            </Pressable>

            <Text style={[Type.caption, {
              color: colors.tekstGedimd, textAlign: 'center', marginTop: spacing.md,
            }]}>
              Oordeel is gebaseerd op de ingevoerde statistieken
            </Text>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const traderFormStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.5)',
    justifyContent: 'flex-end',
  },
  vel: {
    borderTopLeftRadius: radii.kaart,
    borderTopRightRadius: radii.kaart,
    padding: spacing.base,
    paddingBottom: spacing.xl,
    maxHeight: '90%',
  },
  titelRij: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.base,
  },
  sluitKnop: { minHeight: 44, minWidth: 44, alignItems: 'flex-end', justifyContent: 'center' },
  label: { marginTop: spacing.md, marginBottom: spacing.xs },
  input: {
    borderWidth: 1,
    borderRadius: radii.veld,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: 15,
    minHeight: 44,
  },
  multilineInput: {
    minHeight: 80,
    paddingTop: spacing.sm,
    textAlignVertical: 'top',
  },
  riskRij: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  riskKnop: {
    flex: 1,
    minHeight: 40,
    borderRadius: radii.veld,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  opslaanKnop: {
    marginTop: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radii.knop,
    alignItems: 'center',
    minHeight: 44,
  },
});

// ---------- Scherm ----------
export function TradersScreen() {
  const { colors } = useTheme();
  const [traders, setTraders] = useState<OpgeslagenTrader[]>([]);
  const [geladen, setGeladen] = useState(false);
  const [formulierZichtbaar, setFormulierZichtbaar] = useState(false);

  useEffect(() => {
    laadLijst<OpgeslagenTrader>(SLEUTELS.traders).then(l => {
      setTraders(l);
      setGeladen(true);
    });
  }, []);

  useEffect(() => {
    if (geladen) bewaarLijst(SLEUTELS.traders, traders);
  }, [traders, geladen]);

  function voegTraderToe(trader: OpgeslagenTrader) {
    setTraders(prev => [trader, ...prev]);
    setFormulierZichtbaar(false);
  }

  function verwijderTrader(id: string) {
    setTraders(prev => prev.filter(t => t.id !== id));
  }

  return (
    <SafeAreaView style={[tradersStyles.root, { backgroundColor: colors.achtergrond }]}>
      <ScreenHeader
        titel="eToro-traders"
        rechts={
          <Pressable
            style={[tradersStyles.toevoegenKnop, { backgroundColor: colors.cta }]}
            onPress={() => setFormulierZichtbaar(true)}
            accessibilityRole="button"
            accessibilityLabel="Trader toevoegen"
          >
            <Plus size={16} color="white" strokeWidth={2} />
            <Text style={[Type.caption, { color: 'white', fontWeight: '600' }]}>Voeg toe</Text>
          </Pressable>
        }
      />

      {traders.length === 0 ? (
        <View style={tradersStyles.leeg}>
          <Users size={40} color={colors.tekstGedimd} strokeWidth={1.5} />
          <Text style={[Type.titel, { color: colors.tekstPrimair, textAlign: 'center', marginTop: spacing.base }]}>
            Geen traders beoordeeld
          </Text>
          <Text style={[Type.body, {
            color: colors.tekstGedimd, textAlign: 'center', marginTop: spacing.sm, lineHeight: 24,
          }]}>
            Vul de statistieken van een eToro Popular Investor in voor een GROEN/GEEL/ROOD oordeel en een aanbevolen Copy Stop Loss.
          </Text>
          <Pressable
            style={[tradersStyles.leegKnop, { backgroundColor: colors.cta }]}
            onPress={() => setFormulierZichtbaar(true)}
            accessibilityRole="button"
          >
            <Plus size={16} color="white" strokeWidth={2} />
            <Text style={[Type.body, { color: 'white', fontWeight: '600' }]}>Eerste trader beoordelen</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={traders}
          keyExtractor={item => item.id}
          renderItem={({ item }) => (
            <TraderAuditCard
              opgeslagen={item}
              onVerwijder={() => verwijderTrader(item.id)}
            />
          )}
          contentContainerStyle={tradersStyles.lijst}
          ListHeaderComponent={
            <View style={tradersStyles.lijstKop}>
              <Text style={[Type.overline, { color: colors.tekstGedimd }]}>
                {traders.length} trader{traders.length !== 1 ? 's' : ''} beoordeeld
              </Text>
            </View>
          }
          ListFooterComponent={<Disclaimer />}
        />
      )}

      <TraderFormulier
        zichtbaar={formulierZichtbaar}
        onSluiten={() => setFormulierZichtbaar(false)}
        onOpslaan={voegTraderToe}
      />
    </SafeAreaView>
  );
}

const tradersStyles = StyleSheet.create({
  root: { flex: 1 },
  toevoegenKnop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: radii.knop,
    minHeight: 36,
  },
  leeg: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  leegKnop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.knop,
    minHeight: 44,
    marginTop: spacing.lg,
  },
  lijst: { paddingTop: spacing.md },
  lijstKop: {
    paddingHorizontal: spacing.base,
    paddingBottom: spacing.sm,
  },
});
