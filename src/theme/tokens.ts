import { Platform, type TextStyle, type ViewStyle } from 'react-native';
import type { ThemeColors } from './colors';

/** 8px grid — use multiples only (0, 8, 16, …). */
export const space = {
  0: 0,
  1: 8,
  2: 16,
  3: 24,
  4: 32,
  5: 40,
  6: 48,
} as const;

export const radii = {
  sm: 8,
  md: 12,
  lg: 16,
  pill: 20,
  full: 9999,
} as const;

export function cardShadow(): ViewStyle {
  return Platform.select<ViewStyle>({
    ios: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.06,
      shadowRadius: 6,
    },
    default: {
      elevation: 2,
    },
  });
}

/** Surfaces: cards, hero blocks, list rows. */
export function surfaceCard(colors: ThemeColors, elevated = false): ViewStyle {
  return {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radii.lg,
    ...(elevated ? cardShadow() : {}),
  };
}

export const type = {
  /** Screen section headings inside cards */
  title: { fontSize: 17, lineHeight: 22, fontWeight: '600' as const },
  /** Prominent stats / row primary */
  titleLarge: { fontSize: 22, lineHeight: 28, fontWeight: '700' as const },
  /** Primary reading */
  body: { fontSize: 15, lineHeight: 22, fontWeight: '400' as const },
  bodyMedium: { fontSize: 15, lineHeight: 22, fontWeight: '600' as const },
  /** Secondary lines, chips */
  bodySmall: { fontSize: 14, lineHeight: 20, fontWeight: '400' as const },
  /** Meta, hints */
  caption: { fontSize: 13, lineHeight: 18, fontWeight: '400' as const },
  captionMedium: { fontSize: 13, lineHeight: 18, fontWeight: '500' as const },
  /** Nav subtitle under screen title */
  navSubtitle: { fontSize: 13, lineHeight: 16, fontWeight: '400' as const },
} satisfies Record<string, TextStyle>;
