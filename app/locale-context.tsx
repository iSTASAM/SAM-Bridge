"use client";

import { createContext, useContext, useEffect, useState } from "react";

export type Locale = "th" | "en" | "ja";

const LocaleContext = createContext<{
  locale: Locale;
  setLocale: (locale: Locale) => void;
}>({
  locale: "th",
  setLocale: () => undefined,
});

export function LocaleProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>("th");

  useEffect(() => {
    const saved = window.localStorage.getItem("ixacs-lang");
    if (saved === "th" || saved === "en" || saved === "ja") setLocaleState(saved);
  }, []);

  function setLocale(next: Locale) {
    setLocaleState(next);
    window.localStorage.setItem("ixacs-lang", next);
    document.documentElement.lang = next;
  }

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  return (
    <LocaleContext.Provider value={{ locale, setLocale }}>
      {children}
    </LocaleContext.Provider>
  );
}

export function useLocale() {
  return useContext(LocaleContext);
}
