"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import type { IconType } from "react-icons";
import { FiActivity, FiArrowLeft, FiBell, FiClipboard, FiCpu, FiLogIn, FiRefreshCw, FiShield } from "react-icons/fi";
import { DEST_ICONS } from "../exports/destination-icons";
import { LINE_WORKS_ICON } from "../notifications/shared";
import { SYSTEMS_COPY, type SystemsCopy } from "./copy";

export type SystemsChannel = "line" | "slack" | "line-works" | "email";

export const SYSTEM_CHANNELS: {
  id: SystemsChannel;
  href: string;
  label: (copy: SystemsCopy) => string;
}[] = [
  { id: "line", href: "/settings/systems/line", label: (copy) => copy.navLine },
  { id: "slack", href: "/settings/systems/slack", label: (copy) => copy.navSlack },
  { id: "line-works", href: "/settings/systems/line-works", label: (copy) => copy.navLineWorks },
  { id: "email", href: "/settings/systems/email", label: (copy) => copy.navEmail },
];

const ADMIN_MENUS: {
  id: string;
  href: string;
  icon: IconType;
  label: (copy: SystemsCopy) => string;
  desc?: (copy: SystemsCopy) => string;
}[] = [
  { id: "admins", href: "/settings/systems/admins", icon: FiShield, label: (copy) => copy.menuAdmins, desc: (copy) => copy.descAdmins },
  { id: "ai", href: "/settings/systems/ai", icon: FiCpu, label: (copy) => copy.menuAi, desc: (copy) => copy.descAi },
  { id: "alerts", href: "/settings/systems/alerts", icon: FiBell, label: (copy) => copy.menuAlerts, desc: (copy) => copy.descAlerts },
  { id: "health", href: "/settings/systems/health", icon: FiActivity, label: (copy) => copy.menuHealth, desc: (copy) => copy.descHealth },
  { id: "audit", href: "/settings/systems/audit", icon: FiClipboard, label: (copy) => copy.menuAudit, desc: (copy) => copy.descAudit },
  { id: "sessions", href: "/settings/systems/sessions", icon: FiLogIn, label: (copy) => copy.menuSessions, desc: (copy) => copy.descSessions },
];

export function ChannelBrandIcon({ id, size = 18 }: { id: SystemsChannel; size?: number }) {
  if (id === "line-works") {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={LINE_WORKS_ICON} alt="" width={size} height={size} draggable={false} />
    );
  }
  const Icon = DEST_ICONS[id];
  return <Icon size={size} />;
}

export function SystemsStage({
  title,
  actions,
  backHref,
  backLabel,
  children,
}: {
  title: string;
  lead?: string;
  actions?: ReactNode;
  backHref?: string;
  backLabel?: string;
  children: ReactNode;
}) {
  return (
    <div className="console-page as-page">
      {backHref && backLabel ? (
        <Link href={backHref} className="notify-back">
          <FiArrowLeft size={15} aria-hidden />
          {backLabel}
        </Link>
      ) : null}
      <header className="as-head">
        <h1 className="console-title">{title}</h1>
        {actions ? <div className="as-head-actions">{actions}</div> : null}
      </header>
      {children}
    </div>
  );
}

export function SystemsFrame(props: {
  title: string;
  lead?: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return <SystemsStage {...props} />;
}

export function SystemsHub({ copy }: { copy: SystemsCopy }) {
  return (
    <SystemsStage title={copy.title}>
      <div className="as-console-table-wrap">
        <table className="as-console-table">
          <thead>
            <tr>
              <th>{copy.colMenu}</th>
              <th>{copy.colDetail}</th>
            </tr>
          </thead>
          <tbody>
            {ADMIN_MENUS.map((item) => {
              const Icon = item.icon;
              return (
                <tr key={item.id}>
                  <td>
                    <Link href={item.href} className="as-console-item">
                      <span className="as-menu-icon" aria-hidden>
                        <Icon size={16} />
                      </span>
                      <strong>{item.label(copy)}</strong>
                    </Link>
                  </td>
                  <td>{item.desc ? item.desc(copy) : copy.never}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </SystemsStage>
  );
}

export function SystemsAlertsHub({ copy }: { copy: SystemsCopy }) {
  return (
    <SystemsStage title={copy.menuAlerts} backHref="/settings/systems" backLabel={copy.back}>
      <div className="as-console-table-wrap">
        <table className="as-console-table">
          <thead>
            <tr>
              <th>{copy.colMenu}</th>
            </tr>
          </thead>
          <tbody>
            {SYSTEM_CHANNELS.map((item) => (
              <tr key={item.id}>
                <td>
                  <Link href={item.href} className="as-console-item">
                    <span className="as-menu-icon" aria-hidden>
                      <ChannelBrandIcon id={item.id} />
                    </span>
                    <strong>{item.label(copy)}</strong>
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </SystemsStage>
  );
}

export function SystemsSoonPage({ copy, title }: { copy: SystemsCopy; title: string }) {
  return (
    <SystemsStage title={title} backHref="/settings/systems" backLabel={copy.back}>
      <section className="as-empty">{copy.soon}</section>
    </SystemsStage>
  );
}

export function SystemsPageShell({
  copy,
  title,
  loading,
  onRefresh,
  extraActions,
  children,
  backHref,
}: {
  copy: SystemsCopy;
  title: string;
  loading?: boolean;
  onRefresh?: () => void;
  extraActions?: ReactNode;
  backHref?: string;
  narrow?: boolean;
  children: ReactNode;
}) {
  return (
    <SystemsStage
      title={title}
      backHref={backHref}
      backLabel={backHref ? copy.back : undefined}
      actions={
        onRefresh || extraActions ? (
          <>
            {onRefresh ? (
              <button
                type="button"
                className="btn btn-secondary pac-icon-btn"
                onClick={onRefresh}
                disabled={loading}
                aria-label={copy.refresh}
              >
                <FiRefreshCw size={16} />
              </button>
            ) : null}
            {extraActions}
          </>
        ) : null
      }
    >
      {children}
    </SystemsStage>
  );
}
