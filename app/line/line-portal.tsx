"use client";

import { startTransition, useEffect, useMemo, useState, type CSSProperties } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FiBell, FiHome, FiLogOut, FiUser, FiX } from "react-icons/fi";
import { LanguageMenu } from "@/app/language-menu";
import { useLocale, type Locale } from "@/app/locale-context";
import { ThemeMenu } from "@/app/theme-menu";
import styles from "./line-portal.module.css";
import { LineNotificationSettings } from "./line-notification-settings";

type Group = { uuid: string; name: string; lines: Array<{ uuid: string; name: string }> };

export type LineStatusOption = {
  uuid: string;
  nameTh: string;
  nameEn: string;
  nameJa: string;
  backgroundColor: string | null;
  textColor: string | null;
  blinking: boolean;
  blinkingBackgroundColor: string | null;
  blinkingTextColor: string | null;
};

export type LineStatusRow = {
  uuid: string;
  name: string;
  groupUuid: string;
  groupName: string;
  statusUuid: string | null;
  nameTh: string | null;
  nameEn: string | null;
  nameJa: string | null;
  backgroundColor: string | null;
  textColor: string | null;
  blinking: boolean;
  blinkingBackgroundColor: string | null;
  blinkingTextColor: string | null;
  options: LineStatusOption[];
  /** True when this line has an active Push API key in /settings/push. */
  controllable: boolean;
};

export type LinePortalProps = {
  page: "home" | "notifications" | "account";
  connectionId: string;
  user: { displayName: string; customerCompanyId: string; loginId: string };
  lineProfile: { displayName: string; pictureUrl: string | null } | null;
  groups: Group[];
  lines: LineStatusRow[];
  dataError: string | null;
};

type Props = LinePortalProps;

const COPY = {
  th: {
    brand: "SAM Bridge",
    groups: "กลุ่มการผลิต",
    lines: "ไลน์ทั้งหมด",
    noStatus: "—",
    loadError: "ไม่สามารถโหลดสถานะการผลิตได้ในขณะนี้",
    noLineData: "ยังไม่มีข้อมูลไลน์",
    account: "บัญชีของฉัน",
    lineProfile: "โปรไฟล์ LINE",
    customerId: "ID บริษัทลูกค้า",
    loginId: "Login ID",
    company: "บริษัท (iXacs)",
    accountNote: "บัญชีนี้ใช้สำหรับพอร์ทัล LINE และแยกจาก session ของ Web Application",
    home: "หน้าหลัก",
    profile: "บัญชี",
    notifications: "แจ้งเตือน",
    logout: "ออกจากระบบ",
    nav: "เมนู",
    changeStatus: "เปลี่ยนสถานะ",
    viewStatus: "ดูสถานะ",
    viewOnlyHint: "ไลน์นี้ยังไม่ได้ตั้งค่า Push API — ดูได้อย่างเดียว สั่งกลับ iXacs ไม่ได้",
    filter: "ค้นหาสถานะ",
    filterPlaceholder: "พิมพ์เพื่อกรอง",
    noOptions: "ไลน์นี้ยังไม่มีสถานะที่ตั้งค่าไว้",
    current: "ปัจจุบัน",
    saving: "กำลังบันทึก...",
    changed: "เปลี่ยนสถานะแล้ว",
    close: "ปิด",
  },
  en: {
    brand: "SAM Bridge",
    groups: "Production groups",
    lines: "All lines",
    noStatus: "—",
    loadError: "Could not load production status right now",
    noLineData: "No line data yet",
    account: "My account",
    lineProfile: "LINE profile",
    customerId: "Customer company ID",
    loginId: "Login ID",
    company: "Company (iXacs)",
    accountNote: "This account is for the LINE portal and is separate from the web app session.",
    home: "Home",
    profile: "Account",
    notifications: "Alerts",
    logout: "Log out",
    nav: "Menu",
    changeStatus: "Change status",
    viewStatus: "View status",
    viewOnlyHint: "This line has no Push API key — view only; cannot send to iXacs",
    filter: "Filter statuses",
    filterPlaceholder: "Type to filter",
    noOptions: "No configured statuses for this line",
    current: "Current",
    saving: "Saving...",
    changed: "Status updated",
    close: "Close",
  },
  ja: {
    brand: "SAM Bridge",
    groups: "生産グループ",
    lines: "ライン合計",
    noStatus: "—",
    loadError: "現在 生産ステータスを読み込めません",
    noLineData: "ラインデータがありません",
    account: "マイアカウント",
    lineProfile: "LINEプロフィール",
    customerId: "顧客会社ID",
    loginId: "ログインID",
    company: "会社（iXacs）",
    accountNote: "このアカウントは LINE ポータル用で、Web アプリのセッションとは分離されています。",
    home: "ホーム",
    profile: "アカウント",
    notifications: "通知",
    logout: "ログアウト",
    nav: "メニュー",
    changeStatus: "ステータス変更",
    viewStatus: "ステータスを見る",
    viewOnlyHint: "このラインは Push API 未設定のため閲覧のみです（iXacs へ送信不可）",
    filter: "ステータス検索",
    filterPlaceholder: "入力して絞り込み",
    noOptions: "このラインに設定されたステータスがありません",
    current: "現在",
    saving: "保存中...",
    changed: "ステータスを更新しました",
    close: "閉じる",
  },
} as const;

function pickStatusName(
  locale: Locale,
  th?: string | null,
  en?: string | null,
  ja?: string | null,
  fallback = "—",
) {
  if (locale === "en") return en || th || ja || fallback;
  if (locale === "ja") return ja || en || th || fallback;
  return th || en || ja || fallback;
}

function statusCellStyle(input: {
  backgroundColor: string | null;
  textColor: string | null;
  blinking: boolean;
  blinkingBackgroundColor: string | null;
  blinkingTextColor: string | null;
}): CSSProperties {
  const bg = input.backgroundColor || "transparent";
  const fg = input.textColor || "var(--text-primary)";
  if (!input.blinking) {
    return { backgroundColor: bg, color: fg };
  }
  return {
    color: fg,
    backgroundColor: bg,
    ["--status-bg" as string]: bg,
    ["--status-fg" as string]: fg,
    ["--status-blink-bg" as string]: input.blinkingBackgroundColor || bg,
    ["--status-blink-fg" as string]: input.blinkingTextColor || fg,
  };
}

function StatusBoard({
  lines,
  dataError,
  emptyLabel,
  errorLabel,
  noStatus,
  locale,
  onPick,
}: {
  lines: LineStatusRow[];
  dataError: string | null;
  emptyLabel: string;
  errorLabel: string;
  noStatus: string;
  locale: Locale;
  onPick: (line: LineStatusRow) => void;
}) {
  if (!lines.length) {
    return <p className={styles.empty}>{dataError ? errorLabel : emptyLabel}</p>;
  }

  return (
    <div className={styles.board} role="table" aria-label="Production status">
      {lines.map((line) => {
        const label = pickStatusName(locale, line.nameTh, line.nameEn, line.nameJa, noStatus);
        const canOpen = line.options.length > 0;
        return (
          <div className={styles.boardRow} role="row" key={line.uuid}>
            <div className={styles.boardName} role="cell">
              {line.name}
            </div>
            {canOpen ? (
              <button
                type="button"
                className={`${styles.boardStatus} ${styles.boardStatusBtn} ${line.blinking ? styles.boardStatusBlink : ""}`}
                style={statusCellStyle(line)}
                onClick={() => onPick(line)}
              >
                {label}
              </button>
            ) : (
              <div
                className={`${styles.boardStatus} ${line.blinking ? styles.boardStatusBlink : ""}`}
                role="cell"
                style={statusCellStyle(line)}
              >
                {label}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function StatusPicker({
  line,
  locale,
  copy,
  pendingUuid,
  error,
  readOnly,
  onClose,
  onSelect,
}: {
  line: LineStatusRow;
  locale: Locale;
  copy: (typeof COPY)[Locale];
  pendingUuid: string | null;
  error: string | null;
  readOnly: boolean;
  onClose: () => void;
  onSelect: (status: LineStatusOption) => void;
}) {
  const [filter, setFilter] = useState("");
  const filtered = useMemo(() => {
    const needle = filter.trim().toLocaleLowerCase("en-US");
    if (!needle) return line.options;
    return line.options.filter((status) => {
      const label = pickStatusName(locale, status.nameTh, status.nameEn, status.nameJa);
      return label.toLocaleLowerCase("en-US").includes(needle);
    });
  }, [filter, line.options, locale]);

  return (
    <div className={styles.sheetRoot} role="presentation">
      <button type="button" className={styles.sheetBackdrop} aria-label={copy.close} onClick={onClose} />
      <div className={styles.sheet} role="dialog" aria-modal="true" aria-labelledby="line-status-sheet-title">
        <header className={styles.sheetHead}>
          <div>
            <p className={styles.sheetEyebrow}>{line.name}</p>
            <h2 id="line-status-sheet-title" className={styles.sheetTitle}>
              {readOnly ? copy.viewStatus : copy.changeStatus}
            </h2>
          </div>
          <button type="button" className={styles.iconBtn} aria-label={copy.close} onClick={onClose}>
            <FiX size={18} aria-hidden />
          </button>
        </header>

        {readOnly ? <p className={styles.sheetHint}>{copy.viewOnlyHint}</p> : null}

        <label className={styles.sheetFilter}>
          <span>{copy.filter}</span>
          <input
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
            placeholder={copy.filterPlaceholder}
            autoComplete="off"
          />
        </label>

        <div className={styles.sheetList}>
          {filtered.length ? (
            filtered.map((status) => {
              const active = status.uuid === line.statusUuid;
              const pending = pendingUuid === status.uuid;
              const label = pickStatusName(locale, status.nameTh, status.nameEn, status.nameJa);
              return (
                <button
                  key={status.uuid}
                  type="button"
                  className={`${styles.statusOption} ${active ? styles.statusOptionActive : ""}`}
                  style={statusCellStyle(status)}
                  disabled={readOnly || Boolean(pendingUuid) || active}
                  onClick={() => {
                    if (!readOnly) onSelect(status);
                  }}
                >
                  <span>{pending ? copy.saving : label}</span>
                  {active ? <em>{copy.current}</em> : null}
                </button>
              );
            })
          ) : (
            <p className={styles.sheetEmpty}>{copy.noOptions}</p>
          )}
        </div>

        {error ? <p className={styles.sheetError}>{error}</p> : null}
      </div>
    </div>
  );
}

export function LinePortal({
  page,
  connectionId,
  user,
  lineProfile: initialLineProfile,
  groups,
  lines: initialLines,
  dataError,
}: Props) {
  const { locale } = useLocale();
  const copy = COPY[locale];
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);
  const [lines, setLines] = useState(initialLines);
  const [lineProfile, setLineProfile] = useState(initialLineProfile);
  const [selected, setSelected] = useState<LineStatusRow | null>(null);
  const [pendingUuid, setPendingUuid] = useState<string | null>(null);
  const [pickerError, setPickerError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    setLines(initialLines);
  }, [initialLines]);

  useEffect(() => {
    setLineProfile(initialLineProfile);
  }, [initialLineProfile]);

  useEffect(() => {
    if (page !== "home") return;
    void fetch("/line/api/richmenu", { method: "POST", cache: "no-store" }).catch(() => undefined);
  }, [page]);

  // Lightweight realtime poll — only while home is visible; skips when tab is hidden.
  useEffect(() => {
    if (page !== "home") return;

    const POLL_MS = 5_000;
    let timer: number | null = null;
    let inFlight: AbortController | null = null;
    let disposed = false;

    function applySnapshot(updates: Array<{ uuid: string; statusUuid: string | null }>) {
      const byId = new Map(updates.map((item) => [item.uuid, item.statusUuid]));
      startTransition(() => {
        setLines((current) => {
          let changed = false;
          const next = current.map((line) => {
            if (!byId.has(line.uuid)) return line;
            const statusUuid = byId.get(line.uuid) ?? null;
            if (statusUuid === line.statusUuid) return line;
            changed = true;
            const option = statusUuid ? line.options.find((item) => item.uuid === statusUuid) : null;
            if (!option) {
              return {
                ...line,
                statusUuid,
                nameTh: statusUuid ? line.nameTh : null,
                nameEn: statusUuid ? line.nameEn : null,
                nameJa: statusUuid ? line.nameJa : null,
              };
            }
            return {
              ...line,
              statusUuid,
              nameTh: option.nameTh,
              nameEn: option.nameEn,
              nameJa: option.nameJa,
              backgroundColor: option.backgroundColor,
              textColor: option.textColor,
              blinking: option.blinking,
              blinkingBackgroundColor: option.blinkingBackgroundColor,
              blinkingTextColor: option.blinkingTextColor,
            };
          });
          return changed ? next : current;
        });
      });
    }

    async function tick() {
      if (disposed || document.visibilityState === "hidden") return;
      if (inFlight) return;
      const controller = new AbortController();
      inFlight = controller;
      try {
        const response = await fetch("/line/api/monitor", {
          cache: "no-store",
          signal: controller.signal,
        });
        if (!response.ok) return;
        const data = (await response.json()) as {
          ok?: boolean;
          lines?: Array<{ uuid: string; statusUuid: string | null }>;
        };
        if (!data.ok || !data.lines) return;
        applySnapshot(data.lines);
      } catch (error) {
        if ((error as { name?: string } | null)?.name === "AbortError") return;
      } finally {
        if (inFlight === controller) inFlight = null;
      }
    }

    function schedule() {
      if (disposed) return;
      if (timer != null) window.clearInterval(timer);
      if (document.visibilityState === "visible") {
        void tick();
        timer = window.setInterval(() => void tick(), POLL_MS);
      }
    }

    function onVisibility() {
      if (document.visibilityState === "hidden") {
        inFlight?.abort();
        inFlight = null;
        if (timer != null) {
          window.clearInterval(timer);
          timer = null;
        }
        return;
      }
      schedule();
    }

    schedule();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      disposed = true;
      document.removeEventListener("visibilitychange", onVisibility);
      inFlight?.abort();
      if (timer != null) window.clearInterval(timer);
    };
  }, [page]);

  useEffect(() => {
    if (lineProfile?.displayName && lineProfile.pictureUrl) return;
    let cancelled = false;
    void (async () => {
      try {
        const configRes = await fetch("/api/line/config", { cache: "no-store" });
        const config = (await configRes.json()) as { liffId?: string; configured?: boolean };
        if (!config.configured || !config.liffId) return;
        const w = window as Window & {
          liff?: {
            init(o: { liffId: string }): Promise<void>;
            isLoggedIn(): boolean;
            isInClient(): boolean;
            getProfile(): Promise<{ displayName: string; pictureUrl?: string }>;
          };
        };
        if (!w.liff) {
          await new Promise<void>((resolve, reject) => {
            const script = document.createElement("script");
            script.src = "https://static.line-scdn.net/liff/edge/2/sdk.js";
            script.async = true;
            script.onload = () => resolve();
            script.onerror = () => reject(new Error("LIFF_NOT_LOADED"));
            document.head.appendChild(script);
          });
        }
        const liff = (window as typeof w).liff;
        if (!liff) return;
        await liff.init({ liffId: config.liffId });
        if (!liff.isLoggedIn()) return;
        const profile = await liff.getProfile();
        if (cancelled || !profile.displayName) return;
        setLineProfile({
          displayName: profile.displayName,
          pictureUrl: profile.pictureUrl?.trim() || null,
        });
      } catch {
        // Optional enrichment
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [lineProfile?.displayName, lineProfile?.pictureUrl]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 2200);
    return () => window.clearTimeout(timer);
  }, [toast]);

  async function logout() {
    if (loggingOut) return;
    setLoggingOut(true);
    // Navigate so LIFF applies Set-Cookie expire, unlinks Rich Menu 2, then shows login.
    window.location.assign("/line/api/logout");
  }

  async function changeStatus(status: LineStatusOption) {
    if (!selected || !selected.controllable || pendingUuid || status.uuid === selected.statusUuid) return;
    setPendingUuid(status.uuid);
    setPickerError(null);

    try {
      const response = await fetch("/line/api/regist", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          productionLineUuid: selected.uuid,
          andonStatusStyleUuid: status.uuid,
          groupUuid: selected.groupUuid,
          productUuid: "",
          connectionId,
        }),
      });
      const data = (await response.json()) as {
        ok?: boolean;
        error?: string;
        responseJson?: { message?: string };
      };
      if (!data.ok) {
        const code = data.error === "LINE_NOT_CONFIGURED_FOR_PUSH" ? copy.viewOnlyHint : null;
        setPickerError(code || data.responseJson?.message || data.error || copy.loadError);
        return;
      }

      setLines((current) =>
        current.map((line) =>
          line.uuid === selected.uuid
            ? {
                ...line,
                statusUuid: status.uuid,
                nameTh: status.nameTh,
                nameEn: status.nameEn,
                nameJa: status.nameJa,
                backgroundColor: status.backgroundColor,
                textColor: status.textColor,
                blinking: status.blinking,
                blinkingBackgroundColor: status.blinkingBackgroundColor,
                blinkingTextColor: status.blinkingTextColor,
              }
            : line,
        ),
      );
      const label = pickStatusName(locale, status.nameTh, status.nameEn, status.nameJa);
      setSelected(null);
      setPickerError(null);
      setToast(`${copy.changed} · ${label}`);
      router.refresh();
    } catch {
      setPickerError(copy.loadError);
    } finally {
      setPendingUuid(null);
    }
  }

  const selectedLive = selected ? lines.find((line) => line.uuid === selected.uuid) ?? selected : null;

  return (
    <div className={styles.page}>
      <header className={styles.head}>
        <div className={styles.brandRow}>
          <span className={styles.brandName}>{copy.brand}</span>
          <div className={styles.headTools}>
            <ThemeMenu />
            <LanguageMenu />
            <button
              type="button"
              className={styles.iconBtn}
              aria-label={copy.logout}
              title={copy.logout}
              disabled={loggingOut}
              onClick={() => void logout()}
            >
              <FiLogOut size={18} aria-hidden />
            </button>
          </div>
        </div>
        <h1 className={styles.hello}>{lineProfile?.displayName || user.displayName}</h1>
      </header>

      <main className={styles.main}>
        {page === "home" ? (
          <>
            <div className={styles.grid}>
              <section className={styles.card}>
                <p className={styles.eyebrow}>{copy.groups}</p>
                <p className={styles.value}>{groups.length}</p>
              </section>
              <section className={styles.card}>
                <p className={styles.eyebrow}>{copy.lines}</p>
                <p className={styles.value}>{lines.length}</p>
              </section>
            </div>
            <StatusBoard
              lines={lines}
              dataError={dataError}
              emptyLabel={copy.noLineData}
              errorLabel={copy.loadError}
              noStatus={copy.noStatus}
              locale={locale}
              onPick={setSelected}
            />
          </>
        ) : null}

        {page === "account" ? (
          <>
            <section className={styles.card}>
              <p className={styles.eyebrow}>{copy.lineProfile}</p>
              <div className={styles.profileRow}>
                {lineProfile?.pictureUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    className={styles.avatar}
                    src={lineProfile.pictureUrl}
                    alt=""
                    width={56}
                    height={56}
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <span className={styles.avatarFallback} aria-hidden>
                    <FiUser size={24} />
                  </span>
                )}
                <div className={styles.profileText}>
                  <p className={styles.value}>{lineProfile?.displayName || "—"}</p>
                </div>
              </div>
            </section>
            <section className={styles.card}>
              <p className={styles.eyebrow}>{copy.account}</p>
              <div className={styles.list}>
                <div className={styles.item}>
                  <strong>{copy.company}</strong>
                  <span>{user.displayName}</span>
                </div>
                <div className={styles.item}>
                  <strong>{copy.customerId}</strong>
                  <span className={styles.id}>{user.customerCompanyId}</span>
                </div>
                <div className={styles.item}>
                  <strong>{copy.loginId}</strong>
                  <span className={styles.id}>{user.loginId}</span>
                </div>
              </div>
            </section>
            <div className={styles.notice}>{copy.accountNote}</div>
          </>
        ) : null}

        {page === "notifications" ? <LineNotificationSettings lines={lines} /> : null}
      </main>

      <nav className={styles.nav} aria-label={copy.nav}>
        <Link
          href="/line/dashboard"
          className={`${styles.navItem} ${page === "home" ? styles.active : ""}`}
          aria-current={page === "home" ? "page" : undefined}
        >
          <FiHome size={18} aria-hidden />
          <span>{copy.home}</span>
        </Link>
        <Link
          href="/line/notifications"
          className={`${styles.navItem} ${page === "notifications" ? styles.active : ""}`}
          aria-current={page === "notifications" ? "page" : undefined}
        >
          <FiBell size={18} aria-hidden />
          <span>{copy.notifications}</span>
        </Link>
        <Link
          href="/line/account"
          className={`${styles.navItem} ${page === "account" ? styles.active : ""}`}
          aria-current={page === "account" ? "page" : undefined}
        >
          <FiUser size={18} aria-hidden />
          <span>{copy.profile}</span>
        </Link>
      </nav>

      {selectedLive ? (
        <StatusPicker
          line={selectedLive}
          locale={locale}
          copy={copy}
          pendingUuid={pendingUuid}
          error={pickerError}
          readOnly={!selectedLive.controllable}
          onClose={() => {
            if (pendingUuid) return;
            setSelected(null);
            setPickerError(null);
          }}
          onSelect={(status) => void changeStatus(status)}
        />
      ) : null}

      {toast ? (
        <div className={styles.toast} role="status" aria-live="polite">
          {toast}
        </div>
      ) : null}
    </div>
  );
}
