"use client";

import { FiChevronLeft, FiChevronRight } from "react-icons/fi";
import { addDayKey } from "@/lib/production-day";
import type { Locale } from "./locale-context";

const COPY = {
  th: { prev: "วันก่อน", next: "วันถัดไป", range: "07:00–07:00" },
  en: { prev: "Previous day", next: "Next day", range: "07:00–07:00" },
  ja: { prev: "前日", next: "翌日", range: "07:00–07:00" },
} as const;

const DATE_LOCALE: Record<Locale, string> = {
  th: "th-TH",
  en: "en-GB",
  ja: "ja-JP",
};

function formatDay(dayKey: string, locale: Locale) {
  return new Date(`${dayKey}T00:00:00.000Z`).toLocaleDateString(DATE_LOCALE[locale], {
    timeZone: "UTC",
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function DayNav({
  day,
  currentDay,
  earliestDay,
  locale,
  onChange,
  className,
}: {
  day: string;
  currentDay: string;
  earliestDay: string | null;
  locale: Locale;
  onChange: (day: string) => void;
  className?: string;
}) {
  const copy = COPY[locale];
  const canPrev = earliestDay !== null && day > earliestDay;
  const canNext = day < currentDay;

  return (
    <div className={["day-nav", className].filter(Boolean).join(" ")}>
      <button
        type="button"
        className="settings-icon-btn"
        disabled={!canPrev}
        aria-label={copy.prev}
        title={copy.prev}
        onClick={() => onChange(addDayKey(day, -1))}
      >
        <FiChevronLeft size={18} />
      </button>
      <div className="min-w-0 text-center">
        <p className="font-display text-base tracking-wide ink">
          {formatDay(day, locale)}
        </p>
        <p className="font-body mt-0.5 text-[11px] ink-faint">{copy.range}</p>
      </div>
      <button
        type="button"
        className="settings-icon-btn"
        disabled={!canNext}
        aria-label={copy.next}
        title={copy.next}
        onClick={() => onChange(addDayKey(day, 1))}
      >
        <FiChevronRight size={18} />
      </button>
    </div>
  );
}
