"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { FiEdit2 } from "react-icons/fi";
import { useLocale } from "../../locale-context";
import { StatusChip, type NotifyRule } from "../notifications/shared";
import { SYSTEMS_COPY } from "./copy";
import { SystemsPageShell, type SystemsChannel } from "./systems-channel-nav";

export function ChannelSettings({ channel }: { channel: Exclude<SystemsChannel, "line"> }) {
  const { locale } = useLocale();
  const copy = SYSTEMS_COPY[locale];
  const ready = channel === "slack";
  const [rules, setRules] = useState<NotifyRule[]>([]);
  const [loading, setLoading] = useState(ready);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!ready) return;
    setLoading(true);
    try {
      const response = await fetch("/api/notifications", { cache: "no-store" });
      const data = (await response.json()) as {
        rules?: Array<{
          id: string;
          channel: NotifyRule["channel"];
          connectionId: string;
          customerId: string;
          customerName: string;
          lines: NotifyRule["lines"];
          statusByLine: NotifyRule["statusByLine"];
          lastRunStatus: "success" | "error" | null;
        }>;
        error?: string;
      };
      if (!response.ok) throw new Error(data.error);
      setRules(
        (data.rules ?? [])
          .filter((rule) => rule.channel === channel)
          .map((rule) => ({
            id: rule.id,
            channel: rule.channel,
            selection: {
              key: `${rule.connectionId}:${rule.customerId}`,
              connectionId: rule.connectionId,
              connectionName: "",
              customerId: rule.customerId,
              customerName: rule.customerName,
              group: false,
            },
            lines: rule.lines,
            statusByLine: rule.statusByLine,
            lastRunStatus: rule.lastRunStatus,
          })),
      );
      setError(null);
    } catch {
      setError(copy.loadError);
    } finally {
      setLoading(false);
    }
  }, [channel, copy.loadError, ready]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <SystemsPageShell
      copy={copy}
      title={
        channel === "slack"
          ? copy.navSlack
          : channel === "line-works"
            ? copy.navLineWorks
            : copy.navEmail
      }
      loading={loading}
      onRefresh={ready ? () => void load() : undefined}
      backHref="/settings/systems/alerts"
    >
      {error ? <p className="inline-error">{error}</p> : null}

      {!ready ? (
        <section className="as-empty as-channel-empty">
          <p>{copy.comingSoon}</p>
          <Link href="/settings/notifications/new" className="btn btn-secondary">
            {copy.setupNotify}
          </Link>
        </section>
      ) : loading ? (
        <div className="as-console-table-wrap" aria-busy="true">
          <div className="as-console-loading">
            {[0, 1, 2].map((row) => (
              <span key={row} className="skeleton" />
            ))}
          </div>
        </div>
      ) : rules.length === 0 ? (
        <section className="as-empty as-channel-empty">
          <p>{copy.emptyChannel}</p>
          <Link href="/settings/notifications/new" className="btn btn-secondary">
            {copy.setupNotify}
          </Link>
        </section>
      ) : (
        <div className="as-console-table-wrap">
          <table className="as-console-table">
            <thead>
              <tr>
                <th>{copy.colMachine}</th>
                <th>{copy.colLine}</th>
                <th>{copy.colStatuses}</th>
                <th>{copy.colEnabled}</th>
                <th className="as-console-actions" />
              </tr>
            </thead>
            <tbody>
              {rules.map((rule) => (
                <tr key={rule.id}>
                  <td>
                    <strong>{rule.selection.customerName || "—"}</strong>
                  </td>
                  <td>{rule.lines.map((line) => line.name).filter(Boolean).join(" · ") || "—"}</td>
                  <td>
                    <span className="as-status-stack">
                      {rule.lines.flatMap((line) =>
                        (rule.statusByLine[line.uuid] ?? []).map((status) => (
                          <StatusChip key={`${line.uuid}:${status.uuid}`} status={status} active />
                        )),
                      )}
                    </span>
                  </td>
                  <td>
                    <span className={`as-badge ${rule.lastRunStatus === "error" ? "" : "is-on"}`}>
                      {rule.lastRunStatus === "error" ? copy.statusError : copy.statusActive}
                    </span>
                  </td>
                  <td className="as-console-actions">
                    <Link
                      href={`/settings/notifications/${rule.id}`}
                      className="btn-icon"
                      aria-label={copy.edit}
                    >
                      <FiEdit2 size={16} />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </SystemsPageShell>
  );
}
