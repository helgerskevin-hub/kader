import { TextStyle } from 'react-native';

// Fontnamen, geladen via expo-font + @expo-google-fonts
export const Fonts = {
  sansRegular: 'IBMPlexSans_400Regular',
  sansMedium: 'IBMPlexSans_500Medium',
  sansSemiBold: 'IBMPlexSans_600SemiBold',
  sansBold: 'IBMPlexSans_700Bold',
  monoRegular: 'IBMPlexMono_400Regular',
  monoMedium: 'IBMPlexMono_500Medium',
} as const;

// Typografie-schaal (design: Display·28/700, Titel·21/600, Sectiekop·16/600,
// Body·15/400, Caption·12.5/500, Overline·11/600·0.8tracking)
export const Type = {
  display: {
    fontFamily: Fonts.sansBold,
    fontSize: 28,
    fontWeight: '700',
    lineHeight: 36,
  } as TextStyle,

  titel: {
    fontFamily: Fonts.sansSemiBold,
    fontSize: 21,
    fontWeight: '600',
    lineHeight: 28,
  } as TextStyle,

  sectiekop: {
    fontFamily: Fonts.sansSemiBold,
    fontSize: 16,
    fontWeight: '600',
    lineHeight: 22,
  } as TextStyle,

  body: {
    fontFamily: Fonts.sansRegular,
    fontSize: 15,
    fontWeight: '400',
    lineHeight: 24,
  } as TextStyle,

  caption: {
    fontFamily: Fonts.sansMedium,
    fontSize: 12.5,
    fontWeight: '500',
    lineHeight: 18,
  } as TextStyle,

  overline: {
    fontFamily: Fonts.sansSemiBold,
    fontSize: 11,
    fontWeight: '600',
    lineHeight: 16,
    letterSpacing: 0.8,
  } as TextStyle,

  // IBM Plex Mono voor prijzen, %, R/R, score
  prijs: {
    fontFamily: Fonts.monoRegular,
    fontSize: 15,
    fontVariant: ['tabular-nums'],
  } as TextStyle,

  // IBM Plex Mono heeft geen Bold in het Google Fonts-pakket; Medium volstaat
  prijsGroot: {
    fontFamily: Fonts.monoMedium,
    fontSize: 21,
    fontVariant: ['tabular-nums'],
    fontWeight: '500',
  } as TextStyle,

  label: {
    fontFamily: Fonts.monoMedium,
    fontSize: 11,
    fontVariant: ['tabular-nums'],
    letterSpacing: 0.6,
  } as TextStyle,
} as const;
