/** Shared color families; only general surfaces and text vary by theme. */

import '@/global.css';

import { Platform } from 'react-native';

export const colors = {
  blue: { light: '#D7F2F1', medium: '#46C7C7', dark: '#2F8F95' },
  yellow: { light: '#F8EDC2', medium: '#F0CF4A', dark: '#B8A651' },
  pink: { light: '#FAD4E8', medium: '#F03A9B', dark: '#B31E6B' },
  purple: { light: '#E9D9ED', medium: '#C48FD1', dark: '#8E4FA6' },
  green: { light: '#E4EFD0', medium: '#8DBB17', dark: '#587511' },
  orange: { light: '#F9DFC9', medium: '#F75202', dark: '#B53C00' },
} as const;

export const colorFamilies = {
  cold: ['blue', 'green'],
  warm: ['pink', 'orange', 'yellow'],
} as const;

export type ColorName = keyof typeof colors;
export type ColorVariant = keyof typeof colors.blue;
export type ColorFamily = keyof typeof colorFamilies;

export const tabColors = {
  universe: colors.blue,
  statistics: colors.pink,
  register: colors.yellow,
  categories: colors.green,
  account: colors.purple,
} as const;

export const tabBarColors = {
  background: colors.yellow.light,
  inactive: colors.yellow.dark,
} as const;

export const ThemeSurfaces = {
  light: {
    text: '#000000',
    background: '#ffffff',
    backgroundElement: '#F0F0F3',
    backgroundSelected: '#E0E1E6',
    textSecondary: '#60646C',
  },
  dark: {
    text: '#ffffff',
    background: '#000000',
    backgroundElement: '#212225',
    backgroundSelected: '#2E3135',
    textSecondary: '#B0B4BA',
  },
} as const;

export type ThemeColor = keyof typeof ThemeSurfaces.light & keyof typeof ThemeSurfaces.dark;

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: 'var(--font-display)',
    serif: 'var(--font-serif)',
    rounded: 'var(--font-rounded)',
    mono: 'var(--font-mono)',
  },
});

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 800;
