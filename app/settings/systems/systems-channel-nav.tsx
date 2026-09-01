"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import type { IconType } from "react-icons";
import { FiActivity, FiArrowLeft, FiBell, FiChevronRight, FiClipboard, FiCpu, FiLogIn, FiRefreshCw, FiShield } from "react-icons/fi";
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

export function ChannelPageTitle({ channel, label }: { channel: SystemsChannel; label: string }) {
  return (
    <span className="as-channel-title">
      <span className="as-brand-mark" aria-hidden>
        <ChannelBrandIcon id={channel} size={34} />
      </span>
      {label}
    </span>
  );
}

export function SystemsStage({
  title,
  lead,
  titleLoading,
  actions,
  backHref,
  backLabel,
  children,
}: {
  title: ReactNode;
  lead?: string;
  titleLoading?: boolean;
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
        <div className="as-head-copy">
          {titleLoading ? (
            <div className="as-head-skel" aria-busy="true" aria-hidden>
              <span className="skeleton as-title-skel" />
              <span className="skeleton as-meta-skel" />
            </div>
          ) : (
            <>
              <h1 className="console-title">{title}</h1>
              {lead ? <p className="as-machine-meta">{lead}</p> : null}
            </>
          )}
        </div>
        {actions ? <div className="as-head-actions">{actions}</div> : null}
      </header>
      {children}
    </div>
  );
}

export function SystemsFrame(props: {
  title: ReactNode;
  lead?: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return <SystemsStage {...props} />;
}

export function SystemsHub({ copy }: { copy: SystemsCopy }) {
  return (
    <SystemsStage title={copy.title} lead={copy.overviewLead}>
      <nav className="as-menu" aria-label={copy.title}>
        {ADMIN_MENUS.map((item) => {
          const Icon = item.icon;
          return (
            <Link key={item.id} href={item.href} className="as-menu-row">
              <span className="as-menu-icon" aria-hidden>
                <Icon size={16} />
              </span>
              <strong>{item.label(copy)}</strong>
              <FiChevronRight size={16} aria-hidden />
            </Link>
          );
        })}
      </nav>
    </SystemsStage>
  );
}

export function SystemsAlertsHub({ copy }: { copy: SystemsCopy }) {
  return (
    <SystemsStage title={copy.menuAlerts} backHref="/settings/systems" backLabel={copy.back}>
      <nav className="as-menu" aria-label={copy.menuAlerts}>
        {SYSTEM_CHANNELS.map((item) => (
          <Link key={item.id} href={item.href} className="as-menu-row">
            <span className="as-menu-icon" aria-hidden>
              <ChannelBrandIcon id={item.id} />
            </span>
            <strong>{item.label(copy)}</strong>
            <FiChevronRight size={16} aria-hidden />
          </Link>
        ))}
      </nav>
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
  title: ReactNode;
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
            {extraActions}
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
          </>
        ) : null
      }
    >
      {children}
    </SystemsStage>
  );
}
