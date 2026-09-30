import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { X } from 'lucide-react-native';
import { useTheme } from '../../theme/ThemeProvider';
import { Fonts } from '../../theme/typography';
import { radii } from '../../theme/tokens';
import { CoinLogo } from '../CoinLogo';
import { Drukbaar } from '../Drukbaar';

interface Props {
  symbool: string;
  titel: string;
  sub: string;
  // Zonder omgeving geen badge (bijvoorbeeld bij een trade vastleggen zonder eToro-order).
  omgeving?: 'demo' | 'real';
  onSluiten: () => void;
}

// De kop van elk ordervenster: coin, titel met een ondertitel die mag afbreken, de omgevingsbadge
// en de sluitknop. De titel kapt nooit af met puntjes, hij mag over twee regels.
export function OrderKop({ symbool, titel, sub, omgeving, onSluiten }: Props) {
  const { colors } = useTheme();
  const echt = omgeving === 'real';

  return (
    <View style={styles.rij}>
      <CoinLogo symbool={symbool} grootte={40} />

      <View style={styles.tekst}>
        <Text style={[styles.titel, { color: colors.tekstPrimair }]} numberOfLines={2}>
          {titel}
        </Text>
        <Text style={[styles.sub, { color: colors.tekstGedimd }]}>{sub}</Text>
      </View>

      {omgeving && (
        <View
          accessible
          accessibilityLabel={echt ? 'Echt geld' : 'Demo, speelgeld'}
          style={[
            styles.badge,
            echt
              ? { borderColor: colors.tekstPrimair }
              // 24 hex is ongeveer 14% dekking, zoals de DEMO-badge in het ontwerp.
              : { backgroundColor: `${colors.letOp}24` },
          ]}
        >
          <Text
            style={[styles.badgeTekst, { color: echt ? colors.tekstPrimair : colors.letOp }]}
            importantForAccessibility="no"
          >
            {echt ? 'ECHT' : 'DEMO'}
          </Text>
        </View>
      )}

      <Drukbaar
        onPress={onSluiten}
        accessibilityRole="button"
        accessibilityLabel="Sluiten"
        hitSlop={6}
        schaal={0.9}
        style={[styles.sluit, { backgroundColor: colors.verhoogd }]}
      >
        <X size={16} color={colors.tekstGedimd} strokeWidth={2} />
      </Drukbaar>
    </View>
  );
}

const styles = StyleSheet.create({
  rij: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  tekst: { flex: 1, minWidth: 0 },
  titel: { fontFamily: Fonts.sansSemiBold, fontWeight: '600', fontSize: 19, lineHeight: 24 },
  sub: { fontFamily: Fonts.sansMedium, fontWeight: '500', fontSize: 12.5, lineHeight: 18 },
  // Rand op beide varianten, bij DEMO transparant, zodat de twee badges even groot zijn.
  badge: {
    paddingVertical: 5,
    paddingHorizontal: 8,
    borderRadius: radii.pill,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  badgeTekst: { fontFamily: Fonts.sansBold, fontWeight: '700', fontSize: 10.5, lineHeight: 12, letterSpacing: 0.8 },
  sluit: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
