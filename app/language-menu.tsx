"use client";

import { useEffect, useId, useRef, useState } from "react";
import { FiCheck, FiGlobe } from "react-icons/fi";
import { useLocale, type Locale } from "./locale-context";

const OPTIONS: { value: Locale; label: string }[] = [
  { value: "th", label: "ไทย" },
  { value: "en", label: "English" },
  { value: "ja", label: "日本語" },
];

const MENU_LABEL: Record<Locale, string> = {
  th: "ภาษา",
  en: "Language",
  ja: "言語",
};

export function LanguageMenu() {
  const { locale, setLocale } = useLocale();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) return;

    function onPointer(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className="lang-picker" ref={rootRef}>
      <button
        type="button"
        className="lang-trigger"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        aria-label={MENU_LABEL[locale]}
        onClick={() => setOpen((current) => !current)}
      >
        <FiGlobe size={18} aria-hidden />
      </button>

      {open ? (
        <div className="menu" id={menuId} role="menu" aria-label={MENU_LABEL[locale]}>
          {OPTIONS.map((item) => {
            const active = item.value === locale;
            return (
              <button
                key={item.value}
                type="button"
                role="menuitemradio"
                aria-checked={active}
                onClick={() => {
                  setLocale(item.value);
                  setOpen(false);
                }}
              >
                <span>{item.label}</span>
                {active ? <FiCheck size={14} className="lang-check" aria-hidden /> : null}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
