"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { FiEdit2, FiInbox, FiPlus, FiTrash2, FiX } from "react-icons/fi";
import { useLocale } from "../../locale-context";
import { SOURCE_COPY } from "./source-copy";
import { SOURCE_ICONS } from "./source-icons";
import { SOURCE_CONNECTORS, type SourceConfig } from "./types";

const MODE_LABELS = {
  push: "Push",
  poll: "Polling",
  stream: "Streaming",
  manual: "Manual",
} as const;

export function SourceList() {
  const { locale } = useLocale();
  const copy = SOURCE_COPY[locale];
  const [configs, setConfigs] = useState<SourceConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState<SourceConfig | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    const response = await fetch("/api/sources", { cache: "no-store" });
    const data = (await response.json()) as { configs?: SourceConfig[] };
    setConfigs(data.configs ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  async function remove() {
    if (!deleteTarget) return;
    setDeleting(true);
    await fetch(`/api/sources/${deleteTarget.id}`, { method: "DELETE" });
    setDeleteTarget(null);
    setDeleting(false);
    await load();
  }

  const dateLocale = locale === "th" ? "th-TH" : locale === "ja" ? "ja-JP" : "en-US";

  return (
    <div className="console-page source-page">
      <header className="source-page-head">
        <div>
          <h1 className="console-title">{copy.title}</h1>
        </div>
        <Link href="/settings/sources/new" className="btn btn-primary console-icon-btn" aria-label={copy.create}>
          <FiPlus size={16} />
        </Link>
      </header>

      {loading ? (
        <div className="source-table-wrap" aria-busy="true">
          <div className="source-table-loading">
            {Array.from({ length: 3 }, (_, index) => (
              <span key={index} className="skeleton" />
            ))}
          </div>
        </div>
      ) : configs.length === 0 ? (
        <section className="source-empty-state">
          <span className="source-empty-icon">
            <FiInbox size={22} />
          </span>
          <h2>{copy.emptyTitle}</h2>
          <p>{copy.empty}</p>
          <Link href="/settings/sources/new" className="btn btn-primary console-icon-btn" aria-label={copy.create}>
            <FiPlus size={16} />
          </Link>
        </section>
      ) : (
        <div className="source-table-wrap">
          <table className="source-table">
            <thead>
              <tr>
                <th>{copy.nameCol}</th>
                <th>{copy.connectorCol}</th>
                <th>{copy.mode}</th>
                <th>{copy.domains}</th>
                <th>{copy.updated}</th>
                <th>{copy.statusCol}</th>
                <th className="source-table-actions-col">{copy.actionsCol}</th>
              </tr>
            </thead>
            <tbody>
              {configs.map((config) => {
                const connector = SOURCE_CONNECTORS.find((item) => item.id === config.type);
                const Icon = SOURCE_ICONS[config.type];
                return (
                  <tr key={config.id}>
                    <td>
                      <div className="source-table-name">
                        <strong>{config.name}</strong>
                        {config.description ? <span>{config.description}</span> : null}
                      </div>
                    </td>
                    <td>
                      <span className="source-table-connector">
                        {Icon ? <Icon size={16} /> : null}
                        {connector?.name ?? config.type}
                      </span>
                    </td>
                    <td>{MODE_LABELS[config.ingestionMode]}</td>
                    <td>{config.domains.length}</td>
                    <td>
                      {new Intl.DateTimeFormat(dateLocale, { dateStyle: "medium" }).format(new Date(config.updatedAt))}
                    </td>
                    <td>
                      <span className="source-draft-badge">{copy.draft}</span>
                    </td>
                    <td className="source-table-actions-col">
                      <div className="source-table-actions">
                        <Link
                          href={`/settings/sources/${config.id}`}
                          className="btn-icon"
                          aria-label={copy.edit}
                          title={copy.edit}
                        >
                          <FiEdit2 size={16} />
                        </Link>
                        <button
                          type="button"
                          className="btn-icon"
                          aria-label={copy.remove}
                          title={copy.remove}
                          onClick={() => setDeleteTarget(config)}
                        >
                          <FiTrash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {deleteTarget ? (
        <div
          className="modal-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !deleting) setDeleteTarget(null);
          }}
        >
          <section
            className="modal source-delete-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="source-delete-title"
          >
            <button
              type="button"
              className="btn-icon source-delete-close"
              aria-label={copy.cancel}
              onClick={() => setDeleteTarget(null)}
            >
              <FiX size={16} />
            </button>
            <h2 id="source-delete-title">{copy.deleteTitle}</h2>
            <p className="modal-copy">{copy.deleteBody}</p>
            <div className="modal-card">
              <strong>{deleteTarget.name}</strong>
              <span>{SOURCE_CONNECTORS.find((item) => item.id === deleteTarget.type)?.name}</span>
            </div>
            <div className="modal-actions">
              <button type="button" className="btn btn-secondary" disabled={deleting} onClick={() => setDeleteTarget(null)}>
                {copy.cancel}
              </button>
              <button type="button" className="btn btn-danger" disabled={deleting} onClick={() => void remove()}>
                {copy.confirmDelete}
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}
