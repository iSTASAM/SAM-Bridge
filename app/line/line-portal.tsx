"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import { FiDatabase, FiHome, FiLogOut, FiUser, FiX } from "react-icons/fi";
import { LanguageMenu } from "@/app/language-menu";
import { useLocale, type Locale } from "@/app/locale-context";
import { ThemeMenu } from "@/app/theme-menu";
import styles from "./line-portal.module.css";

type Customer = { id: string; name: string };
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
};

type Props = {
  connectionId: string;
  user: { displayName: string; customerCompanyId: string; loginId: string };
  customers: Customer[];
  groups: Group[];
  lines: LineStatusRow[];
  dataError: string | null;
};

const COPY = {
  th: {
    brand: "SAM Bridge",
    groups: "กลุ่มการผลิต",
    lines: "ไลน์ทั้งหมด",
    statusBoard: "สถานะการผลิต",
    noStatus: "—",
    loadError: "ไม่สามารถโหลดสถานะการผลิตได้ในขณะนี้",
    noLineData: "ยังไม่มีข้อมูลไลน์",
    customers: "บริษัทลูกค้า",
    account: "บัญชีของฉัน",
    customerId: "ID บริษัทลูกค้า",
    loginId: "Login ID",
    accountNote: "บัญชีนี้ใช้สำหรับพอร์ทัล LINE และแยกจาก session ของ Web Application",
    home: "หน้าหลัก",
    data: "ข้อมูล",
    profile: "บัญชี",
    logout: "ออกจากระบบ",
    nav: "เมนู",
    changeStatus: "เปลี่ยนสถานะ",
    filter: "ค้นหาสถานะ",
    filterPlaceholder: "พิมพ์เพื่อกรอง",
    noOptions: "ไลน์นี้ยังไม่มีสถานะที่ตั้งค่าไว้",
    current: "ปัจจุบัน",
    saving: "กำลังบันทึก...",
    close: "ปิด",
  },
  en: {
    brand: "SAM Bridge",
    groups: "Production groups",
    lines: "All lines",
    statusBoard: "Production status",
    noStatus: "—",
    loadError: "Could not load production status right now",
    noLineData: "No line data yet",
    customers: "Customer companies",
    account: "My account",
    customerId: "Customer company ID",
    loginId: "Login ID",
    accountNote: "This account is for the LINE portal and is separate from the web app session.",
    home: "Home",
    data: "Data",
    profile: "Account",
    logout: "Log out",
    nav: "Menu",
    changeStatus: "Change status",
    filter: "Filter statuses",
    filterPlaceholder: "Type to filter",
    noOptions: "No configured statuses for this line",
    current: "Current",
    saving: "Saving...",
    close: "Close",
  },
  ja: {
    brand: "SAM Bridge",
    groups: "生産グループ",
    lines: "ライン合計",
    statusBoard: "生産ステータス",
    noStatus: "—",
    loadError: "現在 生産ステータスを読み込めません",
    noLineData: "ラインデータがありません",
    customers: "顧客会社",
    account: "マイアカウント",
    customerId: "顧客会社ID",
    loginId: "ログインID",
    accountNote: "このアカウントは LINE ポータル用で、Web アプリのセッションとは分離されています。",
    home: "ホーム",
    data: "データ",
    profile: "アカウント",
    logout: "ログアウト",
    nav: "メニュー",
    changeStatus: "ステータス変更",
    filter: "ステータス検索",
    filterPlaceholder: "入力して絞り込み",
    noOptions: "このラインに設定されたステータスがありません",
    current: "現在",
    saving: "保存中...",
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
  onClose,
  onSelect,
}: {
  line: LineStatusRow;
  locale: Locale;
  copy: (typeof COPY)[Locale];
  pendingUuid: string | null;
  error: string | null;
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
              {copy.changeStatus}
            </h2>
          </div>
          <button type="button" className={styles.iconBtn} aria-label={copy.close} onClick={onClose}>
            <FiX size={18} aria-hidden />
          </button>
        </header>

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
                  disabled={Boolean(pendingUuid) || active}
                  onClick={() => onSelect(status)}
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

export function LinePortal({ connectionId, user, customers, groups, lines: initialLines, dataError }: Props) {
  const { locale } = useLocale();
  const copy = COPY[locale];
  const router = useRouter();
  const [tab, setTab] = useState<"home" | "data" | "account">("home");
  const [loggingOut, setLoggingOut] = useState(false);
  const [lines, setLines] = useState(initialLines);
  const [selected, setSelected] = useState<LineStatusRow | null>(null);
  const [pendingUuid, setPendingUuid] = useState<string | null>(null);
  const [pickerError, setPickerError] = useState<string | null>(null);

  useEffect(() => {
    setLines(initialLines);
  }, [initialLines]);

  async function logout() {
    if (loggingOut) return;
    setLoggingOut(true);
    try {
      await fetch("/api/line/auth/logout", { method: "POST" });
    } finally {
      window.location.replace("/line/login");
    }
  }

  async function changeStatus(status: LineStatusOption) {
    if (!selected || pendingUuid || status.uuid === selected.statusUuid) return;
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
        setPickerError(data.responseJson?.message || data.error || copy.loadError);
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
      setSelected(null);
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
        <h1 className={styles.hello}>{user.displayName}</h1>
      </header>

      <main className={styles.main}>
        {tab === "home" ? (
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

        {tab === "data" ? (
          <>
            <p className={styles.sectionLabel}>{copy.statusBoard}</p>
            <StatusBoard
              lines={lines}
              dataError={dataError}
              emptyLabel={copy.noLineData}
              errorLabel={copy.loadError}
              noStatus={copy.noStatus}
              locale={locale}
              onPick={setSelected}
            />
            {customers.length ? (
              <section className={styles.card}>
                <p className={styles.eyebrow}>{copy.customers}</p>
                <div className={styles.list}>
                  {customers.map((item) => (
                    <div className={styles.item} key={item.id}>
                      <strong>{item.name}</strong>
                      <span>{item.id}</span>
                    </div>
                  ))}
                </div>
              </section>
            ) : null}
          </>
        ) : null}

        {tab === "account" ? (
          <>
            <section className={styles.card}>
              <p className={styles.eyebrow}>{copy.account}</p>
              <p className={styles.value}>{user.displayName}</p>
              <div className={styles.list}>
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
      </main>

      <nav className={styles.nav} aria-label={copy.nav}>
        <button
          type="button"
          className={`${styles.navItem} ${tab === "home" ? styles.active : ""}`}
          onClick={() => setTab("home")}
        >
          <FiHome size={18} aria-hidden />
          <span>{copy.home}</span>
        </button>
        <button
          type="button"
          className={`${styles.navItem} ${tab === "data" ? styles.active : ""}`}
          onClick={() => setTab("data")}
        >
          <FiDatabase size={18} aria-hidden />
          <span>{copy.data}</span>
        </button>
        <button
          type="button"
          className={`${styles.navItem} ${tab === "account" ? styles.active : ""}`}
          onClick={() => setTab("account")}
        >
          <FiUser size={18} aria-hidden />
          <span>{copy.profile}</span>
        </button>
      </nav>

      {selectedLive ? (
        <StatusPicker
          line={selectedLive}
          locale={locale}
          copy={copy}
          pendingUuid={pendingUuid}
          error={pickerError}
          onClose={() => {
            if (pendingUuid) return;
            setSelected(null);
            setPickerError(null);
          }}
          onSelect={(status) => void changeStatus(status)}
        />
      ) : null}
    </div>
  );
}
