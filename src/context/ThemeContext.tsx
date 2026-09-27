import { createContext, ReactNode, useContext, useMemo } from "react";
import { useColorScheme } from "react-native";

import { DarkColors, LightColors, ThemeColors } from "@/constants/theme";
import { useSettings } from "@/context/SettingsContext";

type ResolvedThemeMode = "light" | "dark";

type ThemeContextValue = {
  mode: "system" | "light" | "dark";
  resolvedMode: ResolvedThemeMode;
  colors: ThemeColors;
  isDark: boolean;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const { themeMode } = useSettings();

  const systemColorScheme = useColorScheme();

  const value = useMemo<ThemeContextValue>(() => {
    const resolvedMode: ResolvedThemeMode =
      themeMode === "system"
        ? systemColorScheme === "dark"
          ? "dark"
          : "light"
        : themeMode;

    const isDark = resolvedMode === "dark";

    return {
      mode: themeMode,
      resolvedMode,
      colors: isDark ? DarkColors : LightColors,
      isDark,
    };
  }, [themeMode, systemColorScheme]);

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);

  if (!context) {
    throw new Error("useTheme must be used inside ThemeProvider");
  }

  return context;
}
