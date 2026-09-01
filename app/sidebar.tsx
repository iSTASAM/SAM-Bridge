"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  FiGrid,
  FiHome,
  FiInbox,
  FiKey,
  FiLogOut,
  FiMenu,
  FiSend,
  FiSidebar,
  FiServer,
} from "react-icons/fi";
import { OpenAIIcon } from "./flow/ai-icons";
import { APP_VERSION } from "@/lib/app-version";
import { useLocale } from "./locale-context";
import { AppToolbar } from "./app-toolbar";
import { SIDEBAR_HIDDEN_STORAGE_KEY } from "./sidebar-pref";

const COPY = {
  th: {
    brand: "SAM Bridge",
    home: "Home",
    getStarted: "Get started",
    devices: "iXacs",
    push: "Push API",
    coreConcepts: "Core concepts",
    sources: "Data Sources",
    models: "AI Models",
    gptActions: "GPT Actions",
    exports: "Data Export",
    sdksAndCli: "SDKs and CLI",
    systems: "Admin Systems",
    logout: "ออกจากระบบ",
    openMenu: "เปิดเมนู",
    closeMenu: "ปิดเมนู",
    hideSidebar: "ซ่อนแถบด้านข้าง",
    showSidebar: "แสดงแถบด้านข้าง",
    mockUser: "SAM",
    mockRole: "ผู้ดูแลระบบ",
    accountSettings: "ตั้งค่าบัญชี",
  },
  en: {
    brand: "SAM Bridge",
    home: "Home",
    getStarted: "Get started",
    devices: "iXacs",
    push: "Push API",
    coreConcepts: "Core concepts",
    sources: "Data Sources",
    models: "AI Models",
    gptActions: "GPT Actions",
    exports: "Data Export",
    sdksAndCli: "SDKs and CLI",
    systems: "Admin Systems",
    logout: "Log out",
    openMenu: "Open menu",
    closeMenu: "Close menu",
    hideSidebar: "Hide sidebar",
    showSidebar: "Show sidebar",
    mockUser: "SAM",
    mockRole: "Administrator",
    accountSettings: "Account settings",
  },
  ja: {
    brand: "SAM Bridge",
    home: "Home",
    getStarted: "Get started",
    devices: "iXacs",
    push: "Push API",
    coreConcepts: "Core concepts",
    sources: "Data Sources",
    models: "AI Models",
    gptActions: "GPT Actions",
    exports: "Data Export",
    sdksAndCli: "SDKs and CLI",
    systems: "Admin Systems",
    logout: "ログアウト",
    openMenu: "メニューを開く",
    closeMenu: "メニューを閉じる",
    hideSidebar: "サイドバーを隠す",
    showSidebar: "サイドバーを表示",
    mockUser: "SAM",
    mockRole: "管理者",
    accountSettings: "アカウント設定",
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
  const [session, setSession] = useState<{
    role: "admin" | "user";
    username: string;
    displayName?: string;
    avatarUrl?: string;
  } | null>(null);

  useEffect(() => {
    function loadSession() {
      void fetch("/api/session", { cache: "no-store" })
        .then((response) => (response.ok ? response.json() : null))
        .then((value) => setSession(value && (value.role === "admin" || value.role === "user") ? value : null));
    }
    loadSession();
    window.addEventListener("profile-updated", loadSession);
    return () => window.removeEventListener("profile-updated", loadSession);
  }, []);

  const navGroups = [
    {
      title: null,
      items: [
        { href: "/home", label: copy.home, exact: true, icon: FiHome, isHome: true },
      ],
    },
    {
      title: copy.getStarted,
      items: [
        { href: "/settings", label: copy.devices, exact: false, icon: FiServer, isHome: false },
        { href: "/settings/push", label: copy.push, exact: false, icon: FiKey, isHome: false },
      ],
    },
    {
      title: copy.coreConcepts,
      items: [
        ...(session?.role === "admin"
          ? [
              { href: "/settings/sources", label: copy.sources, exact: false, icon: FiInbox, isHome: false },
              { href: "/settings/gpt-actions", label: copy.gptActions, exact: false, icon: OpenAIIcon, isHome: false },
              { href: "/settings/exports", label: copy.exports, exact: false, icon: FiSend, isHome: false },
            ]
          : []),
      ],
    },
    {
      title: copy.sdksAndCli,
      items: [
        ...(session?.role === "admin"
          ? [{ href: "/settings/systems", label: copy.systems, exact: false, icon: FiGrid, isHome: false }]
          : []),
      ],
    },
  ];

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
        <AppToolbar showDocs />
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
          <div className="app-sidebar-brand-wrap">
            <Link href="/home" className="app-sidebar-brand" onClick={() => setOpen(false)}>
              {copy.brand}
            </Link>
          </div>
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
          {navGroups.map((group, groupIdx) => {
            if (group.items.length === 0) return null;
            return (
              <div key={groupIdx} className="app-nav-group">
                {group.title && <div className="app-nav-section-title">{group.title}</div>}
                {group.items.map((item) => {
                  const Icon = item.icon;
                  const isActive =
                    item.href === "/settings"
                      ? pathname === "/settings" || /^\/settings\/[^/]+\/data(?:\/|$)/.test(pathname)
                      : active(pathname, item.href, item.exact);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`app-nav-item ${item.isHome ? "is-home" : ""} ${isActive ? "is-active" : ""}`}
                      title={hidden ? item.label : undefined}
                      aria-label={hidden ? item.label : undefined}
                      onClick={() => setOpen(false)}
                    >
                      <Icon size={17} className="app-nav-icon" />
                      <span className="app-nav-label">{item.label}</span>
                    </Link>
                  );
                })}
              </div>
            );
          })}
        </nav>

        <div className="app-sidebar-foot">
          <Link
            href="/settings/profile"
            className="profile-sidebar-link"
            title={copy.accountSettings}
            onClick={() => setOpen(false)}
          >
            <img
              src={session?.avatarUrl || "/mock-user.svg"}
              alt=""
              className="app-sidebar-user-avatar"
              width={36}
              height={34}
            />
            <div className="app-sidebar-user-copy">
              <p className="app-sidebar-user-name">{session?.displayName ?? session?.username ?? copy.mockUser}</p>
              <p className="app-sidebar-user-role">
                {session?.role === "admin" ? copy.mockRole : session ? "User" : copy.mockRole}
              </p>
            </div>
          </Link>
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
        <p className="app-sidebar-version">v{APP_VERSION}</p>
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
