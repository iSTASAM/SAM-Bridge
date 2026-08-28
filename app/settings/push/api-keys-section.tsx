"use client";

import { useMemo, useState } from "react";
import { FiChevronRight, FiPlus } from "react-icons/fi";
import type { Locale } from "../../locale-context";
import { keyName, lineLabel, relativeUsed, type Copy } from "./copy";
import type { IssuedKey } from "./types";

function isExpired(item: IssuedKey) {
  return Boolean(item.expiresAt && Date.parse(item.expiresAt) <= Date.now());
}

function statusMeta(item: IssuedKey, copy: Copy) {
  if (isExpired(item)) return { label: copy.expired, tone: "expired" as const };
  if (item.status === "disabled") return { label: copy.statusDisabled, tone: "disabled" as const };
  return { label: copy.statusActive, tone: "active" as const };
}

export function ApiKeysSection({
  copy,
  locale,
  keys,
  loading,
  error,
  onCreate,
  onOpen,
}: {
  copy: Copy;
  locale: Locale;
  keys: IssuedKey[];
  loading: boolean;
  error: string | null;
  onCreate: () => void;
  onOpen: (item: IssuedKey) => void;
}) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [lineUuid, setLineUuid] = useState("all");

  const lineOptions = useMemo(() => {
    const seen = new Map<string, string>();
    for (const item of keys) {
      if (!item.line) continue;
      if (!seen.has(item.line.uuid)) seen.set(item.line.uuid, lineLabel(item, locale, copy.unused));
    }
    return [...seen.entries()].sort((a, b) => a[1].localeCompare(b[1], locale));
  }, [copy.unused, keys, locale]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return keys.filter((item) => {
      const name = keyName(item, locale).toLowerCase();
      const line = lineLabel(item, locale, "").toLowerCase();
      if (needle && !name.includes(needle) && !line.includes(needle)) return false;
      if (status === "active" && (item.status !== "active" || isExpired(item))) return false;
      if (status === "disabled" && item.status !== "disabled" && !isExpired(item)) return false;
      if (lineUuid !== "all" && item.line?.uuid !== lineUuid) return false;
      return true;
    });
  }, [keys, lineUuid, locale, query, status]);

  const empty = !loading && keys.length === 0;

  return (
    <section className="pac-keys">
      {empty ? null : (
        <div className="pac-keys-head">
          <h2 className="pac-keys-title">{copy.keys}</h2>
          <button
            type="button"
            className="btn btn-primary pac-icon-btn"
            onClick={onCreate}
            disabled={loading}
            aria-label={copy.create}
          >
            <FiPlus size={18} />
          </button>
        </div>
      )}

      {error ? <p className="inline-error">{error}</p> : null}

      {loading ? (
        <div className="pac-table" aria-hidden="true">
          <div className="pac-row pac-row-head">
            <span>{copy.colName}</span>
            <span>{copy.colLine}</span>
            <span>{copy.colStatus}</span>
            <span>{copy.colUsed}</span>
            <span />
          </div>
          {[0, 1, 2, 3].map((row) => (
            <div key={row} className="pac-row">
              <span className="skeleton skeleton-key" />
              <span className="skeleton skeleton-assign" />
              <span className="skeleton skeleton-assign" />
              <span className="skeleton skeleton-action" />
              <span />
            </div>
          ))}
        </div>
      ) : empty ? (
        <div className="pac-empty">
          <h3>{copy.emptyTitle}</h3>
          <p>{copy.emptyBody}</p>
          <button type="button" className="btn btn-primary" onClick={onCreate}>
            <FiPlus size={16} />
            {copy.create}
          </button>
        </div>
      ) : (
        <>
          <div className="pac-tools">
            <input
              className="pac-search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={copy.search}
              aria-label={copy.search}
            />
            <select
              className="pac-filter"
              value={status}
              onChange={(event) => setStatus(event.target.value)}
              aria-label={copy.status}
            >
              <option value="all">{copy.statusAll}</option>
              <option value="active">{copy.statusActive}</option>
              <option value="disabled">{copy.statusDisabled}</option>
            </select>
            <select
              className="pac-filter"
              value={lineUuid}
              onChange={(event) => setLineUuid(event.target.value)}
              aria-label={copy.line}
            >
              <option value="all">{copy.lineAll}</option>
              {lineOptions.map(([uuid, name]) => (
                <option key={uuid} value={uuid}>
                  {name}
                </option>
              ))}
            </select>
          </div>
          {filtered.length === 0 ? (
            <p className="pac-nomatch">{copy.noMatch}</p>
          ) : (
            <div className="pac-table-wrap">
              <div className="pac-table">
                <div className="pac-row pac-row-head">
                  <span>{copy.colName}</span>
                  <span>{copy.colLine}</span>
                  <span>{copy.colStatus}</span>
                  <span>{copy.colUsed}</span>
                  <span />
                </div>
                {filtered.map((item) => {
                  const meta = statusMeta(item, copy);
                  return (
                    <button
                      type="button"
                      key={item.key}
                      className="pac-row pac-row-btn"
                      onClick={() => onOpen(item)}
                    >
                      <span className="pac-name">{keyName(item, locale)}</span>
                      <span className="pac-line">{lineLabel(item, locale, copy.unused)}</span>
                      <span className={`pac-status is-${meta.tone}`}>
                        <span className="pac-status-dot" aria-hidden="true" />
                        {meta.label}
                      </span>
                      <span className="pac-used">{relativeUsed(item.lastUsedAt, locale, copy)}</span>
                      <FiChevronRight className="pac-chevron" size={16} aria-hidden="true" />
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}
    </section>
  );
}
