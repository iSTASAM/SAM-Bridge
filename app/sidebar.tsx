"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  FiBell,
  FiHome,
  FiInbox,
  FiKey,
  FiLogOut,
  FiMenu,
  FiSend,
  FiSidebar,
  FiServer,
  FiCpu,
} from "react-icons/fi";
import { OpenAIIcon } from "./flow/ai-icons";
import { useLocale } from "./locale-context";
import { AppToolbar } from "./app-toolbar";
import { SIDEBAR_HIDDEN_STORAGE_KEY } from "./sidebar-pref";

const COPY = {
  th: {
    brand: "SAM Bridge",
    home: "หน้าแรก",
    devices: "iXacs",
    push: "Push API",
    sources: "Data Sources",
    models: "AI Models",
    gptActions: "GPT Actions",
    exports: "Data Export",
    notifications: "Notifications",
    logout: "ออกจากระบบ",
    openMenu: "เปิดเมนู",
    closeMenu: "ปิดเมนู",
    hideSidebar: "ซ่อนแถบด้านข้าง",
    showSidebar: "แสดงแถบด้านข้าง",
    mockUser: "SAM",
    mockRole: "ผู้ดูแลระบบ",
  },
  en: {
    brand: "SAM Bridge",
    home: "Home",
    devices: "iXacs",
    push: "Push API",
    sources: "Data Sources",
    models: "AI Models",
    gptActions: "GPT Actions",
    exports: "Data Export",
    notifications: "Notifications",
    logout: "Log out",
    openMenu: "Open menu",
    closeMenu: "Close menu",
    hideSidebar: "Hide sidebar",
    showSidebar: "Show sidebar",
    mockUser: "SAM",
    mockRole: "Administrator",
  },
  ja: {
    brand: "SAM Bridge",
    home: "ホーム",
    devices: "iXacs",
    push: "Push API",
    sources: "Data Sources",
    models: "AI Models",
    gptActions: "GPT Actions",
    exports: "Data Export",
    notifications: "Notifications",
    logout: "ログアウト",
    openMenu: "メニューを開く",
    closeMenu: "メニューを閉じる",
    hideSidebar: "サイドバーを隠す",
    showSidebar: "サイドバーを表示",
    mockUser: "SAM",
    mockRole: "管理者",
  },
} as const;

function active(pathname: string, href: string, exact: boolean) {
  if (exact) return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

function readHidden() {
  try {
    return window.localStorage.getItem(SIDEBAR_HIDDEN_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

function applyHiddenAttr(hidden: boolean) {
  if (typeof document === "undefined") return;
  if (hidden) document.documentElement.setAttribute("data-sidebar-hidden", "1");
  else document.documentElement.removeAttribute("data-sidebar-hidden");
}

function writeHidden(hidden: boolean) {
  try {
    window.localStorage.setItem(SIDEBAR_HIDDEN_STORAGE_KEY, hidden ? "1" : "0");
  } catch {
    /* ignore */
  }
  applyHiddenAttr(hidden);
}

export function AppSidebar({
  hidden,
  onHide,
  onShow,
}: {
  hidden: boolean;
  onHide: () => void;
  onShow: () => void;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { locale } = useLocale();
  const copy = COPY[locale];
  const [open, setOpen] = useState(false);
  const [session, setSession] = useState<{ role: "admin" | "user"; username: string } | null>(null);

  useEffect(() => {
    void fetch("/api/session", { cache: "no-store" })
      .then((response) => response.ok ? response.json() : null)
      .then((value) => setSession(value && (value.role === "admin" || value.role === "user") ? value : null));
  }, []);

  const nav = [
    { href: "/home", label: copy.home, exact: true, icon: FiHome },
    { href: "/settings", label: copy.devices, exact: false, icon: FiServer },
    { href: "/settings/push", label: copy.push, exact: false, icon: FiKey },
    ...(session?.role === "admin" ? [
      { href: "/settings/sources", label: copy.sources, exact: false, icon: FiInbox },
      { href: "/settings/ai", label: copy.models, exact: false, icon: FiCpu },
      { href: "/settings/gpt-actions", label: copy.gptActions, exact: false, icon: OpenAIIcon },
      { href: "/settings/exports", label: copy.exports, exact: false, icon: FiSend },
      { href: "/settings/notifications", label: copy.notifications, exact: false, icon: FiBell },
    ] : []),
  ] as const;

  async function logout() {
    await fetch("/api/logout", { method: "POST" });
    router.replace("/login");
    router.refresh();
  }

  return (
    <>
      <header className="app-mobilebar">
        <button
          type="button"
          className="app-icon-btn"
          aria-label={copy.openMenu}
          onClick={() => setOpen(true)}
        >
          <FiMenu size={18} />
        </button>
        <Link href="/home" className="font-display text-sm tracking-wide">
          {copy.brand}
        </Link>
        <AppToolbar />
      </header>

      {open ? (
        <button
          type="button"
          className="app-backdrop"
          aria-label={copy.closeMenu}
          onClick={() => setOpen(false)}
        />
      ) : null}

      <aside
        className={`app-sidebar ${open ? "is-open" : ""} ${hidden ? "is-hidden" : ""}`}
      >
        <div className="app-sidebar-head">
          <Link href="/home" className="app-sidebar-brand" onClick={() => setOpen(false)}>
            {copy.brand}
          </Link>
          <button
            type="button"
            className="app-icon-btn app-sidebar-hide"
            aria-label={hidden ? copy.showSidebar : copy.hideSidebar}
            title={hidden ? copy.showSidebar : copy.hideSidebar}
            aria-expanded={!hidden}
            onClick={hidden ? onShow : onHide}
          >
            <FiSidebar size={18} />
          </button>
        </div>

        <nav className="app-nav" aria-label={copy.brand}>
          {nav.map((item) => {
            const Icon = item.icon;
            const isActive =
              item.href === "/settings"
                ? pathname === "/settings" || /^\/settings\/[^/]+\/data(?:\/|$)/.test(pathname)
                : active(pathname, item.href, item.exact);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`app-nav-item ${isActive ? "is-active" : ""}`}
                title={hidden ? item.label : undefined}
                aria-label={hidden ? item.label : undefined}
                onClick={() => setOpen(false)}
              >
                <Icon size={18} />
                <span className="app-nav-label">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="app-sidebar-foot">
          <div className="app-sidebar-user">
            <img src="/mock-user.svg" alt="" className="app-sidebar-user-avatar" width={36} height={34} />
            <div className="app-sidebar-user-copy">
              <p className="app-sidebar-user-name">{session?.username ?? copy.mockUser}</p>
              <p className="app-sidebar-user-role">
                {session?.role === "admin" ? copy.mockRole : session ? "User" : copy.mockRole}
              </p>
            </div>
          </div>
          <button
            type="button"
            className="app-icon-btn"
            aria-label={copy.logout}
            title={copy.logout}
            onClick={() => void logout()}
          >
            <FiLogOut size={16} />
          </button>
        </div>
      </aside>
    </>
  );
}

export function SidebarShowButton({ onShow }: { onShow: () => void }) {
  const { locale } = useLocale();
  const copy = COPY[locale];
  return (
    <button
      type="button"
      className="app-icon-btn app-sidebar-show"
      aria-label={copy.showSidebar}
      title={copy.showSidebar}
      onClick={onShow}
    >
      <FiSidebar size={18} />
    </button>
  );
}

export function useSidebarHiddenState() {
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    const value = readHidden();
    setHidden(value);
    applyHiddenAttr(value);
  }, []);

  function hide() {
    setHidden(true);
    writeHidden(true);
  }

  function show() {
    setHidden(false);
    writeHidden(false);
  }

  return { hidden, hide, show };
}
