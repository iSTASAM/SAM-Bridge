"use client";

import { useEffect, useId, useRef, useState } from "react";
import { FiCheck, FiMonitor, FiMoon, FiSun } from "react-icons/fi";
import { useLocale } from "./locale-context";
import { useTheme } from "./theme-context";
import type { ThemePreference } from "./theme";

const COPY = {
  th: {
    appearance: "ธีม",
    light: "สว่าง",
    dark: "มืด",
    system: "ตามระบบ",
  },
  en: {
    appearance: "Appearance",
    light: "Light",
    dark: "Dark",
    system: "System",
  },
  ja: {
    appearance: "外観",
    light: "ライト",
    dark: "ダーク",
    system: "システム",
  },
} as const;

const OPTIONS: {
  value: ThemePreference;
  icon: typeof FiSun;
  labelKey: "light" | "dark" | "system";
}[] = [
  { value: "light", icon: FiSun, labelKey: "light" },
  { value: "dark", icon: FiMoon, labelKey: "dark" },
  { value: "system", icon: FiMonitor, labelKey: "system" },
];

export function ThemeMenu() {
  const { locale } = useLocale();
  const { preference, setPreference } = useTheme();
  const copy = COPY[locale];
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const menuId = useId();
  const selected = OPTIONS.find((item) => item.value === preference) ?? OPTIONS[2];
  const SelectedIcon = selected.icon;

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
    <div className="theme-picker" ref={rootRef}>
      <button
        type="button"
        className="lang-trigger"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        aria-label={copy.appearance}
        onClick={() => setOpen((current) => !current)}
      >
        <SelectedIcon size={18} aria-hidden />
      </button>

      {open ? (
        <div className="menu" id={menuId} role="menu" aria-label={copy.appearance}>
          {OPTIONS.map((item) => {
            const Icon = item.icon;
            const active = item.value === preference;
            return (
              <button
                key={item.value}
                type="button"
                role="menuitemradio"
                aria-checked={active}
                onClick={() => {
                  setPreference(item.value);
                  setOpen(false);
                }}
              >
                <Icon size={18} />
                <span>{copy[item.labelKey]}</span>
                {active ? <FiCheck size={14} className="theme-check" aria-hidden /> : null}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
