import { Platform } from "react-native";

import { FontFamily } from "./fonts";

export const LightColors = {
  pendingSurface: "#F8F0DC",
  pendingForeground: "#72530E",
  pendingBorder: "#7D877B",
  onPrimary: "#FFFFFF",
  onAccent: "#20251F",
  onError: "#FFFFFF",
  successForeground: "#285B33",
  successSurface: "#EAF3EC",
  successBorder: "#3E7D4B",
  warningForeground: "#72530E",
  warningSurface: "#F8F0DC",
  warningBorder: "#9A741D",
  errorForeground: "#9F3732",
  errorSurface: "#FBEDEA",
  errorBorder: "#B84A45",
  infoForeground: "#245B78",
  infoSurface: "#EAF2F8",
  infoBorder: "#41728F",
  mutedSurface: "#F3F1EA",
  disabledForeground: "#687066",
  disabledSurface: "#ECEDE7",
  disabledBorder: "#C5CAC2",
  borderSubtle: "#E2E4DE",
  borderStrong: "#7D877B",
  focusRing: "#2F6B3C",
  surfaceSelected: "#EAF3EC",
  surfacePressed: "#E1EAE1",
  primaryPressed: "#24532F",
  errorPressed: "#9F3732",
  overlayScrim: "rgba(0,0,0,0.50)",
  mediaBackdrop: "rgba(0,0,0,0.94)",
  onMedia: "#FFFFFF",
  primary: "#2F6B3C",
  primaryDark: "#24532F",
  primaryLight: "#EAF3EC",
  accent: "#C89B3C",
  accentLight: "#F8F0DC",
  accentText: "#20251F",
  background: "#FCFBF7",
  surface: "#FFFFFF",
  surfaceSecondary: "#F3F1EA",
  text: "#20251F",
  textSecondary: "#687066",
  textMuted: "#687066",
  border: "#E2E4DE",
  success: "#3E7D4B",
  successText: "#FFFFFF",
  error: "#B84A45",
} as const;

export const DarkColors = {
  pendingSurface: "#303326",
  pendingForeground: "#E7C874",
  pendingBorder: "#757A58",
  onPrimary: "#20251F",
  onAccent: "#20251F",
  onError: "#181D19",
  successForeground: "#A5D3AD",
  successSurface: "#203728",
  successBorder: "#7FB88A",
  warningForeground: "#E7C874",
  warningSurface: "#45391F",
  warningBorder: "#B28A37",
  errorForeground: "#F19D97",
  errorSurface: "#3C2424",
  errorBorder: "#E87972",
  infoForeground: "#A5CEE8",
  infoSurface: "#203340",
  infoBorder: "#7BABCA",
  mutedSurface: "#232923",
  disabledForeground: "#A5ADA5",
  disabledSurface: "#292F29",
  disabledBorder: "#515B52",
  borderSubtle: "#363D37",
  borderStrong: "#7F8A80",
  focusRing: "#7FB88A",
  surfaceSelected: "#29442F",
  surfacePressed: "#334A37",
  primaryPressed: "#93C59D",
  errorPressed: "#F19D97",
  overlayScrim: "rgba(0,0,0,0.65)",
  mediaBackdrop: "rgba(0,0,0,0.96)",
  onMedia: "#FFFFFF",
  primary: "#7FB88A",
  primaryDark: "#659A70",
  primaryLight: "#29442F",

  accent: "#DDBA62",
  accentLight: "#45391F",
  accentText: "#20251F",

  background: "#0D100E",
  surface: "#181D19",
  surfaceSecondary: "#232923",

  text: "#F7F7F2",
  textSecondary: "#C4C9C3",
  textMuted: "#949B94",

  border: "#363D37",

  success: "#7FB88A",
  successText: "#20251F",
  error: "#E87972",
} as const satisfies Record<keyof typeof LightColors, string>;

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

export const BottomNavHeight = 96;

export const MaxContentWidth = 800;

// Opt-in content metrics; legacy tokens and approved navigation remain unchanged.
export const Typography = {
  caption: { fontSize: 12, lineHeight: 20, fontFamily: Fonts.regular },
  label: { fontSize: 13, lineHeight: 21, fontFamily: Fonts.medium },
  body: { fontSize: 14, lineHeight: 23, fontFamily: Fonts.regular },
  bodyStrong: { fontSize: 14, lineHeight: 23, fontFamily: Fonts.semiBold },
  buttonLabel: { fontSize: 14, lineHeight: 23, fontFamily: Fonts.semiBold },
  input: { fontSize: 16, lineHeight: 26, fontFamily: Fonts.regular },
  cardTitle: { fontSize: 15, lineHeight: 24, fontFamily: Fonts.semiBold },
  sectionTitle: { fontSize: 17, lineHeight: 27, fontFamily: Fonts.bold },
  pageTitle: { fontSize: 20, lineHeight: 30, fontFamily: Fonts.bold },
  metric: { fontSize: 24, lineHeight: 34, fontFamily: Fonts.bold },
} as const;
export const LayoutSpacing = { pageGutter:16, sectionGap:16, cardGap:12, cardPadding:16, compactCardPadding:12, rowGap:8, labelValueGap:4, formFieldGap:12, fieldInnerGap:4, actionGap:8 } as const;
export const ControlSizes = { button:48, touch:44, input:48, icon:20, border:1, focusBorder:2 } as const;
