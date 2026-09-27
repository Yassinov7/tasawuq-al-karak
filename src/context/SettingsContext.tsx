import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

export type ThemeMode = "system" | "light" | "dark";

type SettingsContextValue = {
  notificationsEnabled: boolean;
  themeMode: ThemeMode;
  settingsReady: boolean;
  setNotificationsEnabled: (enabled: boolean) => void;
  setThemeMode: (mode: ThemeMode) => void;
};

const THEME_MODE_STORAGE_KEY = "@taswoq/theme-mode";

const isThemeMode = (value: string | null): value is ThemeMode => {
  return value === "system" || value === "light" || value === "dark";
};

const SettingsContext = createContext<SettingsContextValue | null>(null);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [notificationsEnabled, setNotificationsEnabledState] = useState(true);

  const [themeMode, setThemeModeState] = useState<ThemeMode>("system");

  const [settingsReady, setSettingsReady] = useState(false);

  useEffect(() => {
    let mounted = true;

    const loadSettings = async () => {
      try {
        const storedThemeMode = await AsyncStorage.getItem(
          THEME_MODE_STORAGE_KEY,
        );

        if (mounted && isThemeMode(storedThemeMode)) {
          setThemeModeState(storedThemeMode);
        }
      } catch {
        // Keep the default "system" mode if local storage fails.
      } finally {
        if (mounted) {
          setSettingsReady(true);
        }
      }
    };

    void loadSettings();

    return () => {
      mounted = false;
    };
  }, []);

  const setNotificationsEnabled = useCallback((enabled: boolean) => {
    setNotificationsEnabledState(enabled);
  }, []);

  const setThemeMode = useCallback((mode: ThemeMode) => {
    setThemeModeState(mode);

    void AsyncStorage.setItem(THEME_MODE_STORAGE_KEY, mode).catch(() => {
      // Keep the in-memory setting even if persistence fails.
    });
  }, []);

  const value = useMemo(
    () => ({
      notificationsEnabled,
      themeMode,
      settingsReady,
      setNotificationsEnabled,
      setThemeMode,
    }),
    [
      notificationsEnabled,
      themeMode,
      settingsReady,
      setNotificationsEnabled,
      setThemeMode,
    ],
  );

  return (
    <SettingsContext.Provider value={value}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const context = useContext(SettingsContext);

  if (!context) {
    throw new Error("useSettings must be used inside SettingsProvider");
  }

  return context;
}
