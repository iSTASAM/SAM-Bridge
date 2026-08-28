"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { DayNav } from "./day-nav";
import { useLocale, type Locale } from "./locale-context";
import { StatusGantt, type GanttSegment } from "./status-gantt";

type AndonStatus = {
  uuid: string;
  nameTh: string;
  nameEn: string;
  nameJa: string;
  bgColor: string;
  fontColor: string;
  blinking: boolean;
  blinkingBgColor: string | null;
  blinkingFontColor: string | null;
  dispOrd: number;
  statusCode: string | null;
  lastSeenAt: string;
};

type BoardState = {
  connectionId: string | null;
  hasSession: boolean;
  sessionSource: "connection" | "webhook" | "env" | null;
  productionLineUuid: string | null;
  productionLineName: string | null;
  productionLineNameTh: string | null;
  productionLineNameEn: string | null;
  productionLineNameJa: string | null;
  groupNameTh: string | null;
  groupNameEn: string | null;
  groupNameJa: string | null;
  andonStatusStyleUuid: string | null;
  receivedAt: string | null;
  day: string | null;
  currentDay: string | null;
  earliestDay: string | null;
  dayStart: string | null;
  dayEnd: string | null;
  isLive: boolean;
  statuses: AndonStatus[];
  history: GanttSegment[];
};

type Flash = {
  kind: "ok" | "error";
  text: string;
};

const EMPTY: BoardState = {
  connectionId: null,
  hasSession: false,
  sessionSource: null,
  productionLineUuid: null,
  productionLineName: null,
  productionLineNameTh: null,
  productionLineNameEn: null,
  productionLineNameJa: null,
  groupNameTh: null,
  groupNameEn: null,
  groupNameJa: null,
  andonStatusStyleUuid: null,
  receivedAt: null,
  day: null,
  currentDay: null,
  earliestDay: null,
  dayStart: null,
  dayEnd: null,
  isLive: true,
  statuses: [],
  history: [],
};

const COPY = {
  th: {
    waitingLine: "รอไลน์",
    waitingSignal: "รอสัญญาณจากไลน์",
    waitingHint: "เมื่อ iXacs ส่งสถานะมา หลอดนี้จะติดสีตามต้นทาง และปุ่มด้านล่างจะถูกสร้างให้เอง",
    noSignal: "ยังไม่ได้รับสัญญาณ",
    changeStatus: "เปลี่ยนสถานะ",
    sending: "กำลังส่ง...",
    active: "กำลังใช้อยู่",
    waitingPush: "รอรับจาก iXacs",
    sent: "ส่งสถานะแล้ว รอสัญญาณยืนยัน",
    failed: "ส่งสถานะไม่สำเร็จ",
    noSession: "ยังไม่มี SESSION — เพิ่มเครื่อง iXacs ในตั้งค่าก่อนเปลี่ยนสถานะ",
    keyboardHint: "กด 1–9, 0, Q ตามป้ายบนปุ่ม",
    pastDay: "กำลังดูข้อมูลย้อนหลัง ไม่สามารถเปลี่ยนสถานะได้",
  },
  en: {
    waitingLine: "Waiting for line",
    waitingSignal: "Waiting for line signal",
    waitingHint: "When iXacs pushes a status, this lamp uses its colors and a button appears below.",
    noSignal: "No signal yet",
    changeStatus: "Change status",
    sending: "Sending...",
    active: "Current",
    waitingPush: "Waiting for iXacs",
    sent: "Status sent. Waiting for confirmation.",
    failed: "Could not change status",
    noSession: "No SESSION. Add an iXacs host in Settings before changing status.",
    keyboardHint: "Press 1–9, 0, Q as labeled on each button",
    pastDay: "Viewing past data. Status cannot be changed.",
  },
  ja: {
    waitingLine: "ライン待機中",
    waitingSignal: "ライン信号を待っています",
    waitingHint: "iXacsから状態が届くと、このランプに色が付き、下にボタンが追加されます。",
    noSignal: "信号なし",
    changeStatus: "状態を変更",
    sending: "送信中...",
    active: "現在",
    waitingPush: "iXacsからの受信待ち",
    sent: "送信しました。確認を待っています。",
    failed: "状態を変更できませんでした",
    noSession: "SESSIONがありません。状態変更前に設定でiXacsホストを追加してください。",
    keyboardHint: "ボタンの 1–9, 0, Q を押してください",
    pastDay: "過去データを表示中のため、状態は変更できません。",
  },
} as const;

const SHORTCUTS = [
  "1",
  "2",
  "3",
  "4",
  "5",
  "6",
  "7",
  "8",
  "9",
  "0",
  "q",
  "w",
  "e",
  "r",
  "t",
  "y",
  "u",
  "i",
  "o",
  "p",
] as const;

function shortcutForIndex(index: number) {
  return SHORTCUTS[index] ?? null;
}

function shortcutLabel(key: string) {
  return key.toUpperCase();
}

const TIME_LOCALE: Record<Locale, string> = {
  th: "th-TH",
  en: "en-GB",
  ja: "ja-JP",
};

function statusName(status: AndonStatus, locale: Locale) {
  if (locale === "en") return status.nameEn || status.nameTh || status.nameJa;
  if (locale === "ja") return status.nameJa || status.nameEn || status.nameTh;
  return status.nameTh || status.nameEn || status.nameJa;
}

function lineName(state: BoardState, locale: Locale) {
  if (locale === "en") {
    return state.productionLineNameEn || state.productionLineName || null;
  }
  if (locale === "ja") {
    return state.productionLineNameJa || state.productionLineName || null;
  }
  return state.productionLineNameTh || state.productionLineName || null;
}

function groupName(state: BoardState, locale: Locale) {
  if (locale === "en") return state.groupNameEn || state.groupNameTh || state.groupNameJa;
  if (locale === "ja") return state.groupNameJa || state.groupNameEn || state.groupNameTh;
  return state.groupNameTh || state.groupNameEn || state.groupNameJa;
}

function formatTime(iso: string | null, locale: Locale, fallback: string) {
  if (!iso) return fallback;
  return new Date(iso).toLocaleString(TIME_LOCALE[locale], {
    timeZone: "Asia/Bangkok",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export function AndonBoard({
  lineUuid,
  showGantt = false,
}: {
  lineUuid: string;
  showGantt?: boolean;
}) {
  const { locale } = useLocale();
  const router = useRouter();
  const searchParams = useSearchParams();
  const dayParam = searchParams.get("day");
  const [state, setState] = useState<BoardState>(EMPTY);
  const [pendingUuid, setPendingUuid] = useState<string | null>(null);
  const [flash, setFlash] = useState<Flash | null>(null);
  const [now, setNow] = useState(() => Date.now());

  const loadBoard = useCallback(async () => {
    const query = dayParam ? `?day=${encodeURIComponent(dayParam)}` : "";
    const response = await fetch(`/api/lines/${lineUuid}${query}`, { cache: "no-store" });
    if (!response.ok) return;
    const data = (await response.json()) as BoardState;
    setState({
      ...EMPTY,
      ...data,
      statuses: data.statuses ?? [],
      history: data.history ?? [],
      isLive: data.isLive ?? true,
    });
  }, [dayParam, lineUuid]);

  useEffect(() => {
    void loadBoard();
    const poll = window.setInterval(() => void loadBoard(), 1200);
    const tick = window.setInterval(() => setNow(Date.now()), 1000);
    return () => {
      window.clearInterval(poll);
      window.clearInterval(tick);
    };
  }, [loadBoard]);

  const current = useMemo(
    () => state.statuses.find((item) => item.uuid === state.andonStatusStyleUuid) ?? null,
    [state.statuses, state.andonStatusStyleUuid],
  );

  const copy = COPY[locale];
  const waitingSlots = Math.max(1, 3 - state.statuses.length);
  const title = lineName(state, locale) ?? copy.waitingLine;
  const group = groupName(state, locale);
  const live = state.isLive;

  function changeDay(next: string) {
    const href =
      next === state.currentDay ? `/lines/${lineUuid}` : `/lines/${lineUuid}?day=${next}`;
    router.replace(href);
  }

  const changeStatus = useCallback(
    async (status: AndonStatus) => {
      if (!state.isLive || !state.productionLineUuid || pendingUuid) return;
      if (status.uuid === state.andonStatusStyleUuid) return;

      setPendingUuid(status.uuid);
      setFlash(null);

      const response = await fetch("/api/regist", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          connectionId: state.connectionId,
          productionLineUuid: state.productionLineUuid,
          andonStatusStyleUuid: status.uuid,
          productUuid: "",
        }),
      });

      const data = (await response.json()) as {
        ok: boolean;
        responseJson?: { message?: string };
        error?: string;
      };

      setFlash({
        kind: data.ok ? "ok" : "error",
        text: data.ok
          ? data.responseJson?.message || COPY[locale].sent
          : data.responseJson?.message || data.error || COPY[locale].failed,
      });
      setPendingUuid(null);
      void loadBoard();
    },
    [loadBoard, locale, pendingUuid, state.connectionId, state.andonStatusStyleUuid, state.isLive, state.productionLineUuid],
  );

  const stateRef = useRef(state);
  const pendingRef = useRef(pendingUuid);
  const changeRef = useRef(changeStatus);
  stateRef.current = state;
  pendingRef.current = pendingUuid;
  changeRef.current = changeStatus;

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.repeat || event.metaKey || event.ctrlKey || event.altKey) return;

      const target = event.target as HTMLElement | null;
      if (target?.closest("input, textarea, select, [contenteditable='true']")) return;

      const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
      const index = (SHORTCUTS as readonly string[]).indexOf(key);
      if (index < 0) return;

      const status = stateRef.current.statuses[index];
      if (!status || pendingRef.current || !stateRef.current.isLive) return;

      event.preventDefault();
      void changeRef.current(status);
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <div className="page-body">
      <div className="mx-auto flex w-full max-w-5xl flex-col">
        <header>
          {group ? (
            <p className="font-body mb-1 text-xs tracking-wide ink-faint">{group}</p>
          ) : null}
          <h1 className="font-display text-3xl font-semibold tracking-wide ink sm:text-4xl">
            {title}
          </h1>
        </header>

        {state.day && state.currentDay ? (
          <div className="mt-6">
            <DayNav
              day={state.day}
              currentDay={state.currentDay}
              earliestDay={state.earliestDay}
              locale={locale}
              onChange={changeDay}
            />
          </div>
        ) : null}

        <section
          className={`andon-lamp mt-8 flex min-h-64 flex-col items-center justify-center px-8 py-16 text-center sm:min-h-80 ${
            live && current?.blinking ? "is-blinking" : ""
          }`}
          style={
            current
              ? {
                  backgroundColor: current.bgColor,
                  color: current.fontColor,
                  ["--andon-bg" as string]: current.bgColor,
                  ["--andon-fg" as string]: current.fontColor,
                  ["--andon-blink-bg" as string]:
                    current.blinkingBgColor ?? current.bgColor,
                  ["--andon-blink-fg" as string]:
                    current.blinkingFontColor ?? current.fontColor,
                  boxShadow: `inset 0 -40px 80px color-mix(in srgb, ${current.bgColor} 55%, #000), 0 0 48px color-mix(in srgb, ${current.bgColor} 35%, transparent)`,
                }
              : undefined
          }
        >
          {current ? (
            <p className="font-display text-5xl leading-none font-semibold tracking-wide sm:text-6xl">
              {statusName(current, locale)}
            </p>
          ) : (
            <>
              <p className="font-display text-3xl tracking-wide ink-muted">
                {copy.waitingSignal}
              </p>
              <p className="font-body mt-3 max-w-sm text-sm leading-6 ink-faint">
                {copy.waitingHint}
              </p>
            </>
          )}
        </section>

        <p className="font-body mt-3 text-right text-xs ink-faint">
          {formatTime(state.receivedAt, locale, copy.noSignal)}
        </p>

        {flash ? (
          <p
            className={`font-body mt-4 text-sm ${
              flash.kind === "ok" ? "ink-success" : "ink-danger"
            }`}
          >
            {flash.text}
          </p>
        ) : null}

        {live ? (
        <section className="mt-8">
          <div className="flex items-baseline justify-between gap-4">
            <h2 className="font-display text-lg tracking-wide ink">
              {copy.changeStatus}
            </h2>
            <p className="font-body text-xs ink-faint">{copy.keyboardHint}</p>
          </div>

          <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {state.statuses.map((status, index) => {
              const active = status.uuid === state.andonStatusStyleUuid;
              const pending = pendingUuid === status.uuid;
              const shortcut = shortcutForIndex(index);
              return (
                <button
                  key={status.uuid}
                  type="button"
                  disabled={!live || !state.hasSession || !state.productionLineUuid || Boolean(pendingUuid) || active}
                  onClick={() => void changeStatus(status)}
                  className="andon-status-btn relative min-h-16 px-5 py-4 pr-14 text-left disabled:cursor-not-allowed"
                  style={{
                    backgroundColor: status.bgColor,
                    color: status.fontColor,
                    boxShadow: active
                      ? `0 0 0 2px var(--text-primary), 0 0 24px color-mix(in srgb, ${status.bgColor} 45%, transparent)`
                      : undefined,
                    opacity: pendingUuid && !pending ? 0.55 : 1,
                  }}
                >
                  {shortcut ? (
                    <span className="andon-key font-body absolute top-3 right-3 flex h-7 min-w-7 items-center justify-center px-1.5 text-sm font-medium">
                      {shortcutLabel(shortcut)}
                    </span>
                  ) : null}
                  <span className="font-display block text-xl tracking-wide">
                    {pending ? copy.sending : statusName(status, locale)}
                  </span>
                  {active ? (
                    <span className="font-body mt-1 block text-[11px] opacity-80">
                      {copy.active}
                    </span>
                  ) : null}
                </button>
              );
            })}

            {Array.from({ length: waitingSlots }).map((_, index) => (
              <div key={`wait-${index}`} className="andon-wait min-h-16 px-5 py-4">
                <span className="font-display block text-base tracking-wide ink-muted">
                  {copy.waitingPush}
                </span>
              </div>
            ))}
          </div>

          {!state.hasSession ? (
            <p className="font-body mt-4 text-sm ink-warn">{copy.noSession}</p>
          ) : null}
        </section>
        ) : (
          <p className="font-body mt-6 text-sm ink-faint">{copy.pastDay}</p>
        )}

        {showGantt && state.dayStart && state.dayEnd ? (
          <StatusGantt
            history={state.history}
            locale={locale}
            now={now}
            rangeStart={new Date(state.dayStart).getTime()}
            rangeEnd={new Date(state.dayEnd).getTime()}
          />
        ) : null}
      </div>
    </div>
  );
}
