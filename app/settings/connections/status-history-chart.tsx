"use client";

import { useEffect, useMemo, useRef, useState, type PointerEvent } from "react";
import { useLocale, type Locale } from "../../locale-context";

export type StatusHistorySegment = {
  productionLineId: string;
  productionLineName: string;
  productionGroupName?: string;
  status: string;
  nameJa: string;
  nameEn: string;
  name3rd: string;
  backgroundColor: string | null;
  start: string;
  end: string;
  durationMinutes: number;
};

function statusName(segment: Pick<StatusHistorySegment, "nameJa" | "nameEn" | "name3rd" | "status">, locale: Locale) {
  if (locale === "ja") return segment.nameJa || segment.nameEn || segment.name3rd || segment.status;
  if (locale === "th") return segment.name3rd || segment.nameEn || segment.nameJa || segment.status;
  return segment.nameEn || segment.name3rd || segment.nameJa || segment.status;
}

function clock(iso: string, locale: Locale) {
  return new Date(iso).toLocaleString(locale === "th" ? "th-TH" : locale === "ja" ? "ja-JP" : "en-GB", {
    timeZone: "Asia/Bangkok",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function durationLabel(minutes: number, locale: Locale) {
  const total = Math.max(0, Math.round(minutes));
  const hours = Math.floor(total / 60);
  const rest = total % 60;
  if (locale === "ja") return hours ? `${hours}時間${rest}分` : `${rest}分`;
  if (locale === "th") return hours ? `${hours} ชม. ${rest} นาที` : `${rest} นาที`;
  return hours ? `${hours}h ${rest} min` : `${rest} min`;
}

function copy(locale: Locale) {
  if (locale === "th") {
    return {
      title: "Status History",
      line: "Production Line",
      all: "All Lines",
      empty: "ไม่มีประวัติสถานะในช่วงที่เลือก",
      start: "Start",
      end: "End",
      duration: "Duration",
      source: "Event source",
    };
  }
  if (locale === "ja") {
    return {
      title: "Status History",
      line: "Production Line",
      all: "All Lines",
      empty: "選択した期間にステータス履歴がありません",
      start: "Start",
      end: "End",
      duration: "Duration",
      source: "Event source",
    };
  }
  return {
    title: "Status History",
    line: "Production Line",
    all: "All Lines",
    empty: "No status history in this period",
    start: "Start",
    end: "End",
    duration: "Duration",
    source: "Event source",
  };
}

type Tip = { id: string; x: number; y: number };

function tipPosition(clientX: number, clientY: number) {
  const margin = 12;
  const width = Math.min(280, window.innerWidth - margin * 2);
  return {
    x: Math.min(Math.max(clientX, margin + width / 2), window.innerWidth - margin - width / 2),
    y: Math.min(Math.max(clientY, margin + 8), window.innerHeight - margin),
  };
}

function buildTicks(startMs: number, endMs: number, widthPx: number) {
  const span = Math.max(endMs - startMs, 1);
  const maxTicks = Math.max(3, Math.floor(Math.max(widthPx, 160) / 56));
  const hour = 3_600_000;
  const step = [hour, 2 * hour, 3 * hour, 4 * hour, 6 * hour].find((value) => span / value + 1 <= maxTicks) ?? 6 * hour;
  const ticks: number[] = [];
  for (let tick = startMs; tick < endMs; tick += step) ticks.push(tick);
  if (ticks.length && endMs - ticks.at(-1)! < step * 0.35) ticks.pop();
  ticks.push(endMs);
  return ticks;
}

export function StatusHistoryChart({
  segments,
  lines: lineList,
  rangeStart,
  rangeEnd,
  highlightedLineId,
  onSelectLine,
}: {
  segments: StatusHistorySegment[];
  lines?: Array<{ id: string; name: string }>;
  rangeStart: string;
  rangeEnd: string;
  highlightedLineId?: string | null;
  onSelectLine?: (lineId: string) => void;
}) {
  const { locale } = useLocale();
  const label = copy(locale);
  const rangeStartMs = new Date(rangeStart).getTime();
  const rangeEndMs = new Date(rangeEnd).getTime();
  const [now, setNow] = useState(() => Date.now());
  const [plotWidth, setPlotWidth] = useState(720);
  const live = now > rangeStartMs && now < rangeEndMs;
  const startMs = rangeStartMs;
  const endMs = live ? now : rangeEndMs;
  const span = Math.max(endMs - startMs, 1);
  const lines = useMemo(() => {
    const map = new Map<string, string>();
    for (const line of lineList ?? []) map.set(line.id, line.name);
    for (const segment of segments) {
      if (!map.has(segment.productionLineId)) map.set(segment.productionLineId, segment.productionLineName);
    }
    return [...map.entries()].map(([id, name]) => ({ id, name }));
  }, [lineList, segments]);
  const [tip, setTip] = useState<Tip | null>(null);
  const plotRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!live) return;
    const timer = window.setInterval(() => setNow(Date.now()), 15_000);
    return () => window.clearInterval(timer);
  }, [live]);

  useEffect(() => {
    const plot = plotRef.current;
    if (!plot) return;
    const update = () => setPlotWidth(plot.clientWidth);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(plot);
    return () => observer.disconnect();
  }, [lines.length]);

  const visibleLines = lines;
  const visibleSegments = useMemo(
    () =>
      segments
        .map((segment, index) => {
          const start = Math.max(new Date(segment.start).getTime(), startMs);
          const end = Math.min(new Date(segment.end).getTime(), endMs);
          return { segment, index, start, end };
        })
        .filter((item) => item.end > item.start),
    [endMs, segments, startMs],
  );
  const legend = useMemo(() => {
    const seen = new Map<string, StatusHistorySegment>();
    for (const item of visibleSegments) {
      const key = `${item.segment.status}\u001f${statusName(item.segment, locale)}`;
      if (!seen.has(key)) seen.set(key, item.segment);
    }
    return [...seen.values()];
  }, [locale, visibleSegments]);
  const ticks = useMemo(() => buildTicks(startMs, endMs, plotWidth), [endMs, plotWidth, startMs]);

  function x(ms: number) {
    return ((ms - startMs) / span) * 100;
  }

  function width(start: number, end: number) {
    return Math.max(((end - start) / span) * 100, 0.12);
  }

  const hovered = tip ? visibleSegments.find((item) => String(item.index) === tip.id) ?? null : null;

  return (
    <section className="dx-status-history">
      <header>
        <strong>{label.title}</strong>
        {live ? <small>{clock(new Date(now).toISOString(), locale)}</small> : null}
      </header>

      {!visibleLines.length ? (
        <p className="dx-sh-empty">{label.empty}</p>
      ) : (
        <>
          <div className="dx-sh-legend">
            {legend.map((item) => (
              <span key={`${item.status}-${statusName(item, locale)}`}>
                <i style={{ backgroundColor: item.backgroundColor ?? "var(--text-tertiary)" }} />
                {statusName(item, locale)}
              </span>
            ))}
          </div>
          <div className={`dx-sh-chart ${visibleLines.length ? "has-labels" : ""}`}>
            <div className="dx-sh-ylabels">
              {visibleLines.map((line) => (
                <span key={line.id} className={highlightedLineId === line.id ? "is-on" : undefined}>{line.name}</span>
              ))}
            </div>
            <div className="dx-sh-plot" ref={plotRef}>
              {ticks.map((tick) => (
                <span key={tick} className="dx-sh-grid" style={{ left: `${x(tick)}%` }} />
              ))}
              {live ? <span className="dx-sh-now" /> : null}
              <div className="dx-sh-rows">
                {visibleLines.map((line) => (
                  <div key={line.id} className={`dx-sh-track ${highlightedLineId === line.id ? "is-on" : ""}`}>
                    {visibleSegments
                      .filter((item) => item.segment.productionLineId === line.id)
                      .map((item) => (
                        <button
                          key={`${item.segment.productionLineId}-${item.index}`}
                          type="button"
                          className="dx-sh-seg"
                          style={{
                            left: `${x(item.start)}%`,
                            width: `${width(item.start, item.end)}%`,
                            backgroundColor: item.segment.backgroundColor ?? "var(--text-tertiary)",
                          }}
                          onPointerEnter={(event: PointerEvent<HTMLButtonElement>) => {
                            if (event.pointerType === "touch") return;
                            setTip({ id: String(item.index), ...tipPosition(event.clientX, event.clientY) });
                          }}
                          onPointerMove={(event: PointerEvent<HTMLButtonElement>) => {
                            if (event.pointerType === "touch") return;
                            setTip({ id: String(item.index), ...tipPosition(event.clientX, event.clientY) });
                          }}
                          onPointerLeave={() => setTip(null)}
                          onFocus={(event) => {
                            const rect = event.currentTarget.getBoundingClientRect();
                            setTip({ id: String(item.index), ...tipPosition(rect.left + rect.width / 2, rect.top) });
                          }}
                          onBlur={() => setTip(null)}
                          onClick={() => onSelectLine?.(item.segment.productionLineId)}
                        />
                      ))}
                  </div>
                ))}
              </div>
              <div className="dx-sh-axis">
                {ticks.map((tick, index) => (
                  <span key={tick} className={index === 0 ? "is-start" : index === ticks.length - 1 ? "is-end" : undefined} style={{ left: `${x(tick)}%` }}>
                    {new Date(tick).toLocaleString(locale === "th" ? "th-TH" : locale === "ja" ? "ja-JP" : "en-GB", {
                      timeZone: "Asia/Bangkok",
                      hour: "2-digit",
                      minute: "2-digit",
                      hour12: false,
                    })}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </>
      )}

      {hovered && tip ? (
        <div className="dx-sh-tip" style={{ left: tip.x, top: tip.y }}>
          <strong>{statusName(hovered.segment, locale)}</strong>
          <dl>
            <div><dt>{label.start}</dt><dd>{clock(new Date(hovered.start).toISOString(), locale)}</dd></div>
            <div><dt>{label.end}</dt><dd>{clock(new Date(hovered.end).toISOString(), locale)}</dd></div>
            <div><dt>{label.duration}</dt><dd>{durationLabel((hovered.end - hovered.start) / 60_000, locale)}</dd></div>
            <div><dt>{label.line}</dt><dd>{hovered.segment.productionLineName}</dd></div>
            <div><dt>{label.source}</dt><dd>iXacs</dd></div>
          </dl>
        </div>
      ) : null}
    </section>
  );
}
