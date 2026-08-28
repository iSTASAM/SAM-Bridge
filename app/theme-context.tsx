"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import {
  THEME_STORAGE_KEY,
  applyResolvedTheme,
  isThemePreference,
  resolveTheme,
  type ResolvedTheme,
  type ThemePreference,
} from "./theme";

type ThemeContextValue = {
  preference: ThemePreference;
  resolvedTheme: ResolvedTheme;
  setPreference: (preference: ThemePreference) => void;
};

const ThemeContext = createContext<ThemeContextValue>({
  preference: "system",
  resolvedTheme: "light",
  setPreference: () => undefined,
});

function subscribePrefersDark(onStoreChange: () => void) {
  const media = window.matchMedia("(prefers-color-scheme: dark)");
  media.addEventListener("change", onStoreChange);
  return () => media.removeEventListener("change", onStoreChange);
}

function getPrefersDark() {
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [preference, setPreferenceState] = useState<ThemePreference>("system");
  const [ready, setReady] = useState(false);
  const prefersDark = useSyncExternalStore(
    subscribePrefersDark,
    getPrefersDark,
    () => false,
  );

  useEffect(() => {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
    setPreferenceState(isThemePreference(stored) ? stored : "system");
    setReady(true);
  }, []);

  const resolvedTheme = resolveTheme(preference, prefersDark);

  useEffect(() => {
    if (!ready) return;
    applyResolvedTheme(resolvedTheme);
  }, [ready, resolvedTheme]);

  const value = useMemo(
    () => ({
      preference,
      resolvedTheme,
      setPreference(next: ThemePreference) {
        setPreferenceState(next);
        window.localStorage.setItem(THEME_STORAGE_KEY, next);
      },
    }),
    [preference, resolvedTheme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  return useContext(ThemeContext);
}
