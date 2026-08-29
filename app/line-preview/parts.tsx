import { IxacsLogo } from "@/app/line/ixacs-logo";
import { DEST_ICONS } from "@/app/settings/exports/destination-icons";
import {
  FiBarChart2,
  FiBell,
  FiChevronDown,
  FiGrid,
  FiMenu,
  FiMoreHorizontal,
  FiRefreshCw,
  FiSearch,
  FiSettings,
  FiWifi,
} from "react-icons/fi";
import type { LinePreviewModel } from "./types";

const LineIcon = DEST_ICONS.line;

export function LineStatusBar({ time }: { time: string }) {
  return (
    <div className="lop-statusbar" aria-hidden>
      <span>{time}</span>
      <span className="lop-statusbar-icons">
        <FiWifi size={12} />
        <i className="lop-signal" />
        <i className="lop-battery" />
      </span>
    </div>
  );
}

export function LineChatHeader({
  oaName,
  oaBadge,
}: {
  oaName: string;
  oaBadge: string;
}) {
  return (
    <header className="lop-header">
      <button type="button" className="lop-icon-button lop-back" aria-label="Back" />
      <span className="lop-avatar" aria-hidden>
        <LineIcon size={22} />
      </span>
      <div className="lop-heading">
        <p className="lop-name">
          {oaName}
          <span className="lop-verified" title={oaBadge} aria-label={oaBadge}>✓</span>
        </p>
        <span className="lop-friends">Official account</span>
      </div>
      <button type="button" className="lop-icon-button" aria-label="Search">
        <FiSearch size={18} />
      </button>
      <button type="button" className="lop-icon-button" aria-label="Chat menu">
        <FiMenu size={20} />
      </button>
    </header>
  );
}

export function LineMessageBubble({
  text,
  time,
  from,
}: {
  text: string;
  time: string;
  from: "user" | "bot";
}) {
  return (
    <div className={`lop-message-row is-${from}`}>
      {from === "bot" ? (
        <span className="lop-message-avatar" aria-hidden>
          <LineIcon size={17} />
        </span>
      ) : null}
      <div className={`lop-bubble is-${from}`}>
        <p>{text}</p>
      </div>
      <time>{time}</time>
    </div>
  );
}

export function LineStatusRichMessage({
  model,
  time,
  logoVariant,
}: {
  model: LinePreviewModel;
  time: string;
  logoVariant: "dark-text" | "light-text";
}) {
  return (
    <article className="lop-rich" aria-label={model.monitorTitle}>
      <div className="lop-rich-banner">
        <span>LIVE MONITOR</span>
        <span className="lop-rich-live"><i /> Connected</span>
      </div>
      <div className="lop-rich-body">
        <h3 className="lop-rich-title">
          <IxacsLogo width={88} className="lop-ixacs-logo" variant={logoVariant} />
        </h3>
        <div className="lop-rich-context">
          <strong>{model.monitorTitle}</strong>
          <span>{model.companyName}</span>
        </div>
        <ul className="lop-status-list">
          {model.lines.map((line) => (
            <li key={line.id}>
              <span className="lop-status-name">{line.name}</span>
              <span className={`lop-status-value is-${line.tone}`}>
                <i style={line.color ? { background: line.color } : undefined} />
                {line.status}
              </span>
            </li>
          ))}
        </ul>
        <p className="lop-rich-foot">{model.updatedLabel}</p>
      </div>
      <div className="lop-rich-cta">{model.detailsCta}</div>
      <time className="lop-rich-time">{time}</time>
    </article>
  );
}

export function LineAlertRichMessage({
  model,
  time,
}: {
  model: LinePreviewModel;
  time: string;
}) {
  if (!model.alert) return null;
  return (
    <article className="lop-rich is-alert">
      <div className="lop-rich-body">
        <h3>{model.alert.title}</h3>
        <p className="lop-rich-sub">
          {model.alert.lineName}
          <span>·</span>
          {model.alert.detail}
        </p>
        <div className="lop-alert-meta">
          <span>{model.alert.activityLabel}</span>
          <strong>{model.alert.activity}</strong>
        </div>
      </div>
      <div className="lop-rich-actions">
        <span className="lop-rich-cta is-soft">{model.checkCta}</span>
        <span className="lop-rich-cta is-ghost">{model.notifyCta}</span>
      </div>
      <time className="lop-rich-time">{time}</time>
    </article>
  );
}

export function LineRichMenu({
  model,
  activeId,
  onSelect,
  collapsed,
  onToggle,
  logoVariant,
}: {
  model: LinePreviewModel;
  activeId: string;
  onSelect: (id: string) => void;
  collapsed: boolean;
  onToggle: () => void;
  logoVariant: "dark-text" | "light-text";
}) {
  const iconFor = (kind: LinePreviewModel["menu"][number]["kind"]) => {
    if (kind === "alerts") return <FiBell />;
    if (kind === "home") return <FiBarChart2 />;
    if (kind === "refresh") return <FiRefreshCw />;
    if (kind === "more") return <FiMoreHorizontal />;
    if (kind === "status") return <FiGrid />;
    return <FiSettings />;
  };

  return (
    <div className={`lop-menu-shell${collapsed ? " is-collapsed" : ""}`}>
      <button type="button" className="lop-menu-toggle" onClick={onToggle} aria-expanded={!collapsed}>
        <FiGrid size={14} aria-hidden />
        <span>{model.menuHero}</span>
        <FiChevronDown className="lop-menu-chevron" size={15} aria-hidden />
      </button>
      <nav className="lop-menu" aria-label="Rich menu">
        <div className="lop-menu-brand">
          <IxacsLogo width={78} className="lop-ixacs-logo" variant={logoVariant} />
          <span>SMART FACTORY</span>
        </div>
        <div className="lop-menu-grid">
          {model.menu.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`lop-menu-cell${activeId === item.id ? " is-active" : ""}`}
              onClick={() => onSelect(item.id)}
            >
              <span className="lop-menu-icon" aria-hidden>{iconFor(item.kind)}</span>
              <span>{item.label}</span>
            </button>
          ))}
        </div>
      </nav>
      <span className="lop-home-indicator" aria-hidden />
    </div>
  );
}
