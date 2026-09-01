"use client";

import { FiGlobe } from "react-icons/fi";
import { useLocale, type Locale } from "./locale-context";

const ORDER: Locale[] = ["th", "en", "ja"];

const MENU_LABEL: Record<Locale, string> = {
  th: "เปลี่ยนภาษา",
  en: "Switch language",
  ja: "言語を切り替え",
};

export function LanguageMenu() {
  const { locale, setLocale } = useLocale();

  function cycleLocale() {
    const index = ORDER.indexOf(locale);
    setLocale(ORDER[(index + 1) % ORDER.length]);
  }

  return (
    <div className="lang-picker">
      <button
        type="button"
        className="lang-trigger"
        aria-label={MENU_LABEL[locale]}
        onClick={cycleLocale}
      >
        <FiGlobe size={18} aria-hidden />
      </button>
    </div>
  );
}
