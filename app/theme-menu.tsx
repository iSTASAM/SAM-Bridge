"use client";

import { FiMoon, FiSun } from "react-icons/fi";
import { useLocale } from "./locale-context";
import { useTheme } from "./theme-context";

const COPY = {
  th: {
    toLight: "เปลี่ยนเป็นธีมสว่าง",
    toDark: "เปลี่ยนเป็นธีมมืด",
  },
  en: {
    toLight: "Switch to light theme",
    toDark: "Switch to dark theme",
  },
  ja: {
    toLight: "ライトテーマに切り替え",
    toDark: "ダークテーマに切り替え",
  },
} as const;

export function ThemeMenu() {
  const { locale } = useLocale();
  const { resolvedTheme, setPreference } = useTheme();
  const copy = COPY[locale];
  const isDark = resolvedTheme === "dark";

  function toggleTheme() {
    setPreference(isDark ? "light" : "dark");
  }

  return (
    <div className="theme-picker">
      <button
        type="button"
        className="lang-trigger"
        aria-label={isDark ? copy.toLight : copy.toDark}
        aria-pressed={isDark}
        onClick={toggleTheme}
      >
        {isDark ? <FiMoon size={18} aria-hidden /> : <FiSun size={18} aria-hidden />}
      </button>
    </div>
  );
}
