import { Platform } from "react-native";

import { FontFamily } from "./fonts";

export const LightColors = {
  primary: "#2F6B3C",
  primaryDark: "#24532F",
  primaryLight: "#EAF3EC",
  accent: "#C89B3C",
  accentLight: "#F8F0DC",
  background: "#FCFBF7",
  surface: "#FFFFFF",
  surfaceSecondary: "#F3F1EA",
  text: "#20251F",
  textSecondary: "#687066",
  textMuted: "#92998F",
  border: "#E2E4DE",
  success: "#3E7D4B",
  error: "#B84A45",
} as const;

export const DarkColors = {
  primary: "#7FB88A",
  primaryDark: "#659A70",
  primaryLight: "#29442F",

  accent: "#DDBA62",
  accentLight: "#45391F",

  background: "#0D100E",
  surface: "#181D19",
  surfaceSecondary: "#232923",

  text: "#F7F7F2",
  textSecondary: "#C4C9C3",
  textMuted: "#949B94",

  border: "#363D37",

  success: "#7FB88A",
  error: "#E87972",
} as const;

export type ThemeColors = typeof LightColors | typeof DarkColors;

export type ThemeMode = "light" | "dark";

export const Colors = {
  light: LightColors,
  dark: DarkColors,
} as const;

export type ThemeColor = keyof typeof LightColors;

export const Fonts = {
  regular: FontFamily.regular,
  medium: FontFamily.medium,
  semiBold: FontFamily.semiBold,
  bold: FontFamily.bold,
} as const;

export const FontSizes = {
  xs: 12,
  sm: 14,
  md: 16,
  lg: 18,
  xl: 22,
  xxl: 28,
  display: 34,
} as const;

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 12,
  four: 16,
  five: 20,
  six: 24,
  seven: 32,
  eight: 40,
  nine: 48,
  ten: 64,
} as const;

export const Radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  full: 999,
} as const;

export const Shadows = {
  card: Platform.select({
    ios: {
      shadowColor: "#000000",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.06,
      shadowRadius: 8,
    },
    android: {
      elevation: 2,
    },
    default: {},
  }),
} as const;

export const BottomTabInset =
  Platform.select({
    ios: 50,
    android: 80,
    default: 0,
  }) ?? 0;

export const BottomNavHeight = 92;

export const MaxContentWidth = 800;
