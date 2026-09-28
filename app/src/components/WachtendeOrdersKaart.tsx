import React from 'react';
import { View, Text, Pressable, StyleSheet, ActivityIndicator } from 'react-native';
import Animated from 'react-native-reanimated';
import { useTheme } from '../theme/ThemeProvider';
import { Type } from '../theme/typography';
import { spacing, radii, shadow } from '../theme/tokens';
import { fmtBedrag, fmtPrijs } from '../engine/format';
import { WachtendeOrder, statusInGewoneTaal } from '../engine/etoro';
import { useReduceMotion } from '../theme/useReduceMotion';
import { uitklapIn, uitklapUit } from '../theme/lijstBeweging';

// Orders staan altijd in dollars bij eToro; de gekozen weergavevaluta is hier niet aan de orde,
// zoals ook de orderschermen zelf dollars afdwingen.
const DOLLARS = { valuta: 'USD' } as const;

interface Props {
  orders: WachtendeOrder[];
  magHandelen: boolean;
  onAnnuleer: (order: WachtendeOrder) => void;
  // orderId van de order die op dit moment geannuleerd wordt, of null als er niets loopt. Een
  // order zonder orderId kan nooit "bezig" zijn: die heeft immers geen Annuleren-knop.
  bezigId: number | null;
  // orderIds waarvoor eToro het annuleerverzoek heeft aangenomen. Aangenomen is niet hetzelfde als
  // geannuleerd (een al gevulde order geeft ook 200), dus de order blijft staan tot de sync hem niet
  // meer meestuurt; tot dan staat er geen knop maar een melding, zodat niemand dubbel annuleert.
  doorgegevenIds: ReadonlySet<number>;
}

// Toont eToro's wachtende orders (nog niet gevuld) met het geld dat ze vasthouden. Rendert niets
// bij een lege lijst, net als VerdelingKaart geen kaart toont zonder open posities.
export function WachtendeOrdersKaart({ orders, magHandelen, onAnnuleer, bezigId, doorgegevenIds }: Props) {
  const { colors } = useTheme();
  const reduceMotion = useReduceMotion();

  if (orders.length === 0) return null;

  return (
    <View style={[styles.kaart, shadow.kaart, { backgroundColor: colors.kaart }]}>
      <View style={styles.kop}>
        <Text style={[Type.overline, { color: colors.tekstGedimd }]}>
          WACHTENDE ORDERS · {orders.length}
        </Text>
      </View>
      <Text style={[Type.caption, styles.uitleg, { color: colors.tekstGedimd }]}>
        Nog niet uitgevoerd door eToro. Het bedrag staat zolang vast.
      </Text>

      {orders.map((order, i) => (
        <Animated.View
          key={order.orderId ?? `${order.symbool}-${order.soort}-${order.openTijd ?? i}`}
          entering={uitklapIn(reduceMotion)}
          exiting={uitklapUit()}
          style={[
            styles.regel,
            i > 0 && styles.regelGescheiden,
            i > 0 && { borderTopColor: colors.rand },
          ]}
        >
          <OrderRegel
            order={order}
            magHandelen={magHandelen}
            bezig={order.orderId !== null && bezigId === order.orderId}
            doorgegeven={order.orderId !== null && doorgegevenIds.has(order.orderId)}
            onAnnuleer={() => onAnnuleer(order)}
          />
        </Animated.View>
      ))}
    </View>
  );
}

function OrderRegel({ order, magHandelen, bezig, doorgegeven, onAnnuleer }: {
  order: WachtendeOrder;
  magHandelen: boolean;
  bezig: boolean;
  doorgegeven: boolean;
  onAnnuleer: () => void;
}) {
  const { colors } = useTheme();
  const isShort = order.richting === 'short';
  const richtingKleur = isShort ? colors.goud : colors.winst;

  const soortTekst = order.soort === 'limiet'
    ? (order.limietKoers !== null ? `Limiet op ${fmtPrijs(order.limietKoers, DOLLARS)}` : 'Limietorder')
    : 'Marktorder';

  const niveaus: string[] = [];
  if (order.stopLoss !== null) niveaus.push(`stop-loss ${fmtPrijs(order.stopLoss, DOLLARS)}`);
  if (order.takeProfit !== null) niveaus.push(`doel ${fmtPrijs(order.takeProfit, DOLLARS)}`);
  const niveauTekst = niveaus.length > 0 ? niveaus.join(' · ') : null;

  const geplaatstOp = order.openTijd !== null
    ? `${new Date(order.openTijd).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', year: 'numeric' })} om ${new Date(order.openTijd).toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' })}`
    : null;

  const statusTekst = order.statusId !== null ? statusInGewoneTaal(order.statusId) : null;

  const toonAnnuleren = magHandelen && order.orderId !== null && !doorgegeven;

  const accessibilityLabel = [
    `${order.symbool}, ${isShort ? 'short' : 'koop'}`,
    order.bedragUsd !== null ? fmtBedrag(order.bedragUsd, DOLLARS) : null,
    soortTekst,
    niveauTekst,
    geplaatstOp ? `geplaatst op ${geplaatstOp}` : null,
    statusTekst,
    doorgegeven ? 'annulering doorgegeven' : null,
  ].filter(Boolean).join(', ') + '.';

  return (
    <View accessible accessibilityLabel={accessibilityLabel}>
      <View style={styles.bovenRij}>
        <View style={styles.links}>
          <View style={styles.symboolRij}>
            <Text style={[Type.sectiekop, { color: colors.tekstPrimair }]} numberOfLines={1}>
              {order.symbool}
            </Text>
            <Text style={[Type.label, { color: richtingKleur }]}>
              {isShort ? 'SHORT' : 'KOOP'}
            </Text>
          </View>
          <Text style={[Type.caption, { color: colors.tekstGedimd }]} numberOfLines={1}>
            {order.naam}
          </Text>
        </View>
        <Text style={[Type.prijs, { color: colors.tekstPrimair }]}>
          {order.bedragUsd !== null ? fmtBedrag(order.bedragUsd, DOLLARS) : '—'}
        </Text>
      </View>

      <Text style={[Type.caption, styles.detailRegel, { color: colors.tekstGedimd }]}>
        {soortTekst}
        {niveauTekst ? ` · ${niveauTekst}` : ''}
      </Text>

      {geplaatstOp !== null && (
        <Text style={[Type.caption, styles.detailRegel, { color: colors.tekstGedimd }]}>
          Geplaatst op {geplaatstOp}
        </Text>
      )}

      {statusTekst !== null && (
        <Text style={[Type.caption, styles.detailRegel, { color: colors.letOp }]}>
          Status: {statusTekst}
        </Text>
      )}

      {doorgegeven && (
        <Text style={[Type.caption, styles.detailRegel, { color: colors.tekstGedimd }]}>
          Annulering doorgegeven
        </Text>
      )}

      {toonAnnuleren && (
        <Pressable
          onPress={onAnnuleer}
          disabled={bezig}
          accessibilityRole="button"
          accessibilityLabel={`Annuleer wachtende order ${order.symbool}`}
          accessibilityState={{ disabled: bezig }}
          style={[styles.annuleerKnop, { borderColor: colors.verlies, opacity: bezig ? 0.6 : 1 }]}
        >
          {bezig
            ? <ActivityIndicator size="small" color={colors.verlies} />
            : null}
          <Text style={[Type.caption, { color: colors.verlies, fontWeight: '600' }]}>
            {bezig ? 'Bezig' : 'Annuleren'}
          </Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  kaart: {
    borderRadius: radii.kaart,
    padding: spacing.base,
    marginHorizontal: spacing.base,
    marginBottom: spacing.base,
  },
  kop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  uitleg: {
    marginTop: 2,
    lineHeight: 18,
  },
  regel: {
    marginTop: spacing.md,
  },
  regelGescheiden: {
    paddingTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  bovenRij: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  links: { flex: 1, gap: 2 },
  symboolRij: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  detailRegel: {
    marginTop: 4,
    lineHeight: 18,
  },
  annuleerKnop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    alignSelf: 'flex-start',
    marginTop: spacing.sm,
    borderWidth: 1.5,
    borderRadius: radii.knop,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    minHeight: 44,
  },
});
