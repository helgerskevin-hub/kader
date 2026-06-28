// Typography scale from docs/huisstijl-kader.md
// IBM Plex Sans for UI text, IBM Plex Mono for numbers
export const Font = {
  sans:  'IBMPlexSans_400Regular',
  sansMd:'IBMPlexSans_500Medium',
  sansSb:'IBMPlexSans_600SemiBold',
  sansBd:'IBMPlexSans_700Bold',
  mono:  'IBMPlexMono_400Regular',
  monoMd:'IBMPlexMono_500Medium',
} as const;

export const Size = {
  display: 28,
  title:   21,
  section: 16,
  body:    15,
  caption: 12.5,
  over:    11,
} as const;
