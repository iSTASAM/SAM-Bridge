"use client";

import {
  useEffect,
  useMemo,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";

export type GanttLocale = "th" | "en" | "ja";

export type GanttSegment = {
  id: string;
  statusUuid: string;
  nameTh: string;
  nameEn: string;
  nameJa: string;
  bgColor: string;
  fontColor: string;
  startedAt: string;
  endedAt: string | null;
};

const COPY = {
  th: {
    title: "ประวัติสถานะ",
    empty: "ไม่มีประวัติในช่วง 07:00–07:00 ของวันนี้",
    current: "กำลังดำเนิน",
  },
  en: {
    title: "Status History",
    empty: "No history in this 07:00–07:00 window.",
    current: "In progress",
  },
  ja: {
    title: "ステータス履歴",
    empty: "この 07:00–07:00 の期間に履歴はありません。",
    current: "進行中",
  },
} as const;

const TIME_LOCALE: Record<GanttLocale, string> = {
  th: "th-TH",
  en: "en-GB",
  ja: "ja-JP",
};

function nameOf(segment: GanttSegment, locale: GanttLocale) {
  if (locale === "en") return segment.nameEn || segment.nameTh || segment.nameJa;
  if (locale === "ja") return segment.nameJa || segment.nameEn || segment.nameTh;
  return segment.nameTh || segment.nameEn || segment.nameJa;
}

function formatClock(ms: number, locale: GanttLocale) {
  return new Date(ms).toLocaleString(TIME_LOCALE[locale], {
    timeZone: "Asia/Bangkok",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDuration(ms: number, locale: GanttLocale) {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(totalSec / 3600);
  const minutes = Math.floor((totalSec % 3600) / 60);
  const seconds = totalSec % 60;

  if (locale === "en") {
    if (hours > 0) return `${hours}h ${minutes}m`;
    if (minutes > 0) return `${minutes}m ${seconds}s`;
    return `${seconds}s`;
  }
  if (locale === "ja") {
    if (hours > 0) return `${hours}時間${minutes}分`;
    if (minutes > 0) return `${minutes}分${seconds}秒`;
    return `${seconds}秒`;
  }
  if (hours > 0) return `${hours} ชม. ${minutes} นาที`;
  if (minutes > 0) return `${minutes} นาที ${seconds} วินาที`;
  return `${seconds} วินาที`;
}

function buildTicks(startMs: number, endMs: number) {
  const step = 2 * 60 * 60 * 1000;
  const ticks: number[] = [];
  for (let t = startMs; t <= endMs; t += step) ticks.push(t);
  return ticks;
}

type Tip = {
  id: string;
  x: number;
  y: number;
  place: "above" | "below";
};

function clampTip(clientX: number, clientY: number): Omit<Tip, "id"> {
  const margin = 12;
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const tipW = Math.min(300, vw - margin * 2);
  const place: "above" | "below" = clientY < 88 ? "below" : "above";
  const x = Math.min(Math.max(clientX, margin + tipW / 2), vw - margin - tipW / 2);
  const y = Math.min(Math.max(clientY, margin), vh - margin);
  return { x, y, place };
}

export function StatusGantt({
  history,
  locale,
  now,
  rangeStart,
  rangeEnd,
  compact = false,
}: {
  history: GanttSegment[];
  locale: GanttLocale;
  now: number;
  rangeStart: number;
  rangeEnd: number;
  compact?: boolean;
}) {
  const [tip, setTip] = useState<Tip | null>(null);
  const [touchLock, setTouchLock] = useState(false);
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const copy = COPY[locale];
  const span = Math.max(rangeEnd - rangeStart, 1);

  useEffect(() => {
    if (!touchLock) return;
    function close(event: PointerEvent) {
      const target = event.target as HTMLElement | null;
      if (target?.closest(".gantt-bar")) return;
      setTip(null);
      setTouchLock(false);
    }
    window.addEventListener("pointerdown", close);
    return () => window.removeEventListener("pointerdown", close);
  }, [touchLock]);

  const liveHistory = useMemo(
    () =>
      history.map((item) =>
        item.endedAt ? item : { ...item, endedAt: new Date(Math.min(now, rangeEnd)).toISOString() },
      ),
    [history, now, rangeEnd],
  );

  const ticks = useMemo(() => buildTicks(rangeStart, rangeEnd), [rangeStart, rangeEnd]);

  const visible = useMemo(
    () =>
      liveHistory
        .map((item) => {
          const start = Math.max(new Date(item.startedAt).getTime(), rangeStart);
          const end = Math.min(new Date(item.endedAt ?? now).getTime(), rangeEnd);
          return { item, start, end };
        })
        .filter((entry) => entry.end > entry.start)
        .filter((entry) => !hidden.has(entry.item.statusUuid)),
    [hidden, liveHistory, now, rangeEnd, rangeStart],
  );

  const legend = useMemo(() => {
    const seen = new Map<string, GanttSegment>();
    for (const item of liveHistory) {
      if (!seen.has(item.statusUuid)) seen.set(item.statusUuid, item);
    }
    return [...seen.values()].sort((a, b) => {
      const color = a.bgColor.localeCompare(b.bgColor);
      if (color !== 0) return color;
      return nameOf(a, locale).localeCompare(nameOf(b, locale), locale);
    });
  }, [liveHistory, locale]);

  function x(ms: number) {
    return ((ms - rangeStart) / span) * 100;
  }

  function barWidth(start: number, end: number) {
    return Math.max(((end - start) / span) * 100, 0.25);
  }

  function showTip(id: string, clientX: number, clientY: number) {
    setTip({ id, ...clampTip(clientX, clientY) });
  }

  function toggleStatus(uuid: string) {
    setHidden((current) => {
      const next = new Set(current);
      if (next.has(uuid)) next.delete(uuid);
      else next.add(uuid);
      return next;
    });
    setTip(null);
  }

  const hovered = tip ? (liveHistory.find((item) => item.id === tip.id) ?? null) : null;
  const showNow = now > rangeStart && now < rangeEnd;
  const board = (
    <div className={`gantt-board ${compact ? "is-compact" : "mt-4"}`}>
      {ticks.map((tick) => (
        <span key={tick} className="gantt-gridline" style={{ left: `${x(tick)}%` }} />
      ))}
      {visible.map(({ item, start, end }) => {
        const style = {
          left: `${x(start)}%`,
          width: `${barWidth(start, end)}%`,
          backgroundColor: item.bgColor,
        };
        const handlers = {
          onPointerEnter: (event: ReactPointerEvent<HTMLElement>) => {
            if (event.pointerType === "touch") return;
            showTip(item.id, event.clientX, event.clientY);
          },
          onPointerMove: (event: ReactPointerEvent<HTMLElement>) => {
            if (event.pointerType === "touch") return;
            showTip(item.id, event.clientX, event.clientY);
          },
          onPointerLeave: () => setTip(null),
          onPointerDown: (event: ReactPointerEvent<HTMLElement>) => {
            if (event.pointerType !== "touch") return;
            const rect = event.currentTarget.getBoundingClientRect();
            setTouchLock(true);
            showTip(item.id, rect.left + rect.width / 2, rect.top);
          },
        };
        return compact ? (
          <div key={item.id} className="gantt-bar" style={style} {...handlers} />
        ) : (
          <button
            key={item.id}
            type="button"
            className="gantt-bar"
            style={style}
            {...handlers}
            onFocus={(event) => {
              const rect = event.currentTarget.getBoundingClientRect();
              showTip(item.id, rect.left + rect.width / 2, rect.top);
            }}
            onBlur={() => setTip(null)}
          />
        );
      })}
      {showNow ? <span className="gantt-now" style={{ left: `${x(now)}%` }} /> : null}
    </div>
  );

  return (
    <div className={compact ? undefined : "mt-10"}>
      <div className={compact ? undefined : "gantt-card"}>
        {compact ? null : (
          <h2 className="font-display text-center text-lg tracking-wide ink">
            {copy.title}
          </h2>
        )}

        {liveHistory.length === 0 && !compact ? (
          <p className="font-body mt-6 text-center text-sm ink-muted">{copy.empty}</p>
        ) : (
          <>
            {compact ? null : (
              <div className="mt-4 flex flex-wrap justify-center gap-2">
                {legend.map((item) => {
                  const off = hidden.has(item.statusUuid);
                  return (
                    <button
                      key={item.statusUuid}
                      type="button"
                      aria-pressed={!off}
                      onClick={() => toggleStatus(item.statusUuid)}
                      className={`gantt-legend-btn font-body ${off ? "is-off" : ""}`}
                    >
                      <span
                        className="h-3.5 w-3.5 shrink-0"
                        style={{ backgroundColor: item.bgColor }}
                      />
                      {nameOf(item, locale)}
                    </button>
                  );
                })}
              </div>
            )}

            {board}

            {compact ? null : (
              <GanttTimeAxis rangeStart={rangeStart} rangeEnd={rangeEnd} locale={locale} />
            )}
          </>
        )}
      </div>

      {hovered && tip ? (
        <div
          className={`gantt-tooltip font-body ${tip.place === "below" ? "is-below" : ""}`}
          style={{ left: tip.x, top: tip.y }}
        >
          <p className="text-sm font-medium ink">{nameOf(hovered, locale)}</p>
          <p className="mt-1 text-xs leading-5 ink-muted">
            {formatClock(new Date(hovered.startedAt).getTime(), locale)} –{" "}
            {history.find((item) => item.id === hovered.id)?.endedAt
              ? formatClock(new Date(hovered.endedAt!).getTime(), locale)
              : copy.current}
          </p>
          <p className="text-xs ink-muted">
            {formatDuration(
              new Date(hovered.endedAt ?? now).getTime() -
                new Date(hovered.startedAt).getTime(),
              locale,
            )}
          </p>
        </div>
      ) : null}
    </div>
  );
}

export function GanttTimeAxis({
  rangeStart,
  rangeEnd,
  locale,
}: {
  rangeStart: number;
  rangeEnd: number;
  locale: GanttLocale;
}) {
  const span = Math.max(rangeEnd - rangeStart, 1);
  const ticks = buildTicks(rangeStart, rangeEnd);

  return (
    <div className="gantt-times is-header font-body">
      {ticks.map((tick, index) => {
        const transform =
          index === 0
            ? "translateX(0)"
            : index === ticks.length - 1
              ? "translateX(-100%)"
              : "translateX(-50%)";
        return (
          <span
            key={tick}
            className="absolute text-[11px] ink-faint"
            style={{
              left: `${((tick - rangeStart) / span) * 100}%`,
              transform,
            }}
          >
            {formatClock(tick, locale)}
          </span>
        );
      })}
    </div>
  );
}
