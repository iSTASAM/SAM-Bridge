"use client";

import Link from "next/link";
import { FiRefreshCw } from "react-icons/fi";
import { SYSTEMS_COPY, type SystemsCopy } from "../copy";
import { SystemsStage } from "../systems-channel-nav";

export function SystemShell({
  machineId,
  title,
  meta,
  copy,
  active,
  loading,
  onRefresh,
  children,
}: {
  machineId: string;
  title: string;
  meta?: string | null;
  copy: SystemsCopy;
  active: "users" | "alerts";
  loading: boolean;
  onRefresh: () => void;
  children: React.ReactNode;
}) {
  return (
    <SystemsStage
      title={title}
      lead={meta ?? undefined}
      backHref="/settings/systems/line"
      backLabel={copy.back}
      actions={
        <button
          type="button"
          className="btn btn-secondary pac-icon-btn"
          onClick={onRefresh}
          disabled={loading}
          aria-label={copy.refresh}
        >
          <FiRefreshCw size={16} />
        </button>
      }
    >
      <nav className="as-tabs" aria-label={copy.title}>
        <Link
          href={`/settings/systems/${machineId}`}
          className={`as-tab${active === "users" ? " is-active" : ""}`}
          aria-current={active === "users" ? "page" : undefined}
        >
          {copy.navUsers}
        </Link>
        <Link
          href={`/settings/systems/${machineId}/alerts`}
          className={`as-tab${active === "alerts" ? " is-active" : ""}`}
          aria-current={active === "alerts" ? "page" : undefined}
        >
          {copy.navAlerts}
        </Link>
      </nav>
      {children}
    </SystemsStage>
  );
}

export function PersonCell({
  name,
  pictureUrl,
}: {
  name: string;
  pictureUrl: string | null;
}) {
  const initials = name.trim().split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase() || "?";
  return (
    <span className="as-person">
      {pictureUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={pictureUrl} alt="" className="as-avatar as-avatar-sm" width={32} height={32} />
      ) : (
        <span className="as-avatar as-avatar-sm as-avatar-fallback" aria-hidden>{initials}</span>
      )}
      <span className="as-person-name">{name}</span>
    </span>
  );
}

export { SYSTEMS_COPY };
