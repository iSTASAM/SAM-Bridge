"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { FiBell, FiEdit2, FiPlus, FiSettings, FiTrash2, FiZap } from "react-icons/fi";
import { useLocale } from "@/app/locale-context";
import { NOTIFY_COPY } from "./copy";
import {
  ChannelIcon,
  StatusChip,
  channelName,
  type NotifyRule,
} from "./shared";

export function NotificationList() {
  const { locale } = useLocale();
  const copy = NOTIFY_COPY[locale];
  const [rules, setRules] = useState<NotifyRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionBusy, setActionBusy] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const monitorInFlightRef = useRef(false);

  const loadRules = useCallback(async () => {
    const response = await fetch("/api/notifications", { cache: "no-store" });
    const data = (await response.json()) as {
      rules?: Array<{
        id: string;
        channel: "slack";
        connectionId: string;
        customerId: string;
        customerName: string;
        lines: NotifyRule["lines"];
        statusByLine: NotifyRule["statusByLine"];
        webhookConfigured: boolean;
        lastRunStatus: "success" | "error" | null;
      }>;
    };
    setRules(
      (data.rules ?? []).map((rule) => ({
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
        webhookConfigured: rule.webhookConfigured,
        lastRunStatus: rule.lastRunStatus,
      })),
    );
    setLoading(false);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadRules(), 0);
    return () => window.clearTimeout(timer);
  }, [loadRules]);

  useEffect(() => {
    async function monitor() {
      if (monitorInFlightRef.current) return;
      monitorInFlightRef.current = true;
      try {
        await fetch("/api/notifications/monitor", { method: "POST" }).catch(() => null);
        await loadRules().catch(() => null);
      } finally {
        monitorInFlightRef.current = false;
      }
    }
    void monitor();
    const timer = window.setInterval(() => void monitor(), 2_000);
    return () => window.clearInterval(timer);
  }, [loadRules]);

  async function ruleAction(rule: NotifyRule, action: "test" | "delete") {
    setActionBusy(`${rule.id}:${action}`);
    setFeedback(null);
    try {
      const response = await fetch(
        `/api/notifications/${rule.id}${action === "test" ? "/test" : ""}`,
        { method: action === "test" ? "POST" : "DELETE" },
      );
      const data = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        setFeedback(data.error || copy.actionFailed);
        return;
      }
      setFeedback(action === "test" ? copy.testOk : copy.deleteOk);
      await loadRules();
    } finally {
      setActionBusy(null);
    }
  }

  return (
    <div className="console-page notify-page">
      <header className="notify-page-head">
        <div>
          <h1 className="console-title">{copy.title}</h1>
        </div>
        <div className="notify-page-actions">
          <Link
            href="/settings/notifications/line-webhook"
            className="btn btn-secondary"
            aria-label={copy.lineWebhook}
          >
            <FiSettings size={15} />
            {copy.lineWebhook}
          </Link>
          <Link
            href="/settings/notifications/new"
            className="btn btn-primary console-icon-btn"
            aria-label={copy.create}
          >
            <FiPlus size={16} />
          </Link>
        </div>
      </header>

      {feedback ? (
        <p className="notify-list-feedback" aria-live="polite">
          {feedback}
        </p>
      ) : null}

      {loading ? (
        <div className="notify-table-wrap" aria-busy="true">
          <div className="notify-table-loading">
            {Array.from({ length: 3 }, (_, index) => (
              <span key={index} className="skeleton" />
            ))}
          </div>
        </div>
      ) : rules.length === 0 ? (
        <section className="notify-empty-state">
          <span className="notify-empty-icon">
            <FiBell size={22} />
          </span>
          <h2>{copy.emptyRules}</h2>
          <p>{copy.emptyRulesBody}</p>
          <Link
            href="/settings/notifications/new"
            className="btn btn-primary console-icon-btn"
            aria-label={copy.create}
          >
            <FiPlus size={16} />
          </Link>
        </section>
      ) : (
        <div className="notify-table-wrap">
          <table className="notify-table">
            <thead>
              <tr>
                <th>{copy.channelCol}</th>
                <th>{copy.machine}</th>
                <th>{copy.linesCol}</th>
                <th>{copy.statusesCol}</th>
                <th>{copy.statusCol}</th>
                <th className="notify-table-actions-col">{copy.actionsCol}</th>
              </tr>
            </thead>
            <tbody>
              {rules.map((rule) => {
                const statusError = rule.lastRunStatus === "error";
                return (
                  <tr key={rule.id}>
                    <td>
                      <span className="notify-table-channel">
                        <ChannelIcon id={rule.channel} size={16} />
                        {channelName(copy, rule.channel)}
                      </span>
                    </td>
                    <td>{rule.selection.customerName}</td>
                    <td>
                      <ul className="notify-table-lines">
                        {rule.lines.map((line) => (
                          <li key={line.uuid}>{line.name}</li>
                        ))}
                      </ul>
                    </td>
                    <td>
                      <div className="notify-status-row">
                        {rule.lines.flatMap((line) =>
                          (rule.statusByLine[line.uuid] ?? []).map((status) => (
                            <StatusChip key={`${line.uuid}:${status.uuid}`} status={status} active />
                          )),
                        )}
                      </div>
                    </td>
                    <td>
                      <span className={`notify-draft-badge ${statusError ? "is-error" : "is-ready"}`}>
                        {statusError ? copy.statusError : copy.statusActive}
                      </span>
                    </td>
                    <td className="notify-table-actions-col">
                      <div className="notify-table-actions">
                        <button
                          type="button"
                          className="btn btn-secondary"
                          disabled={Boolean(actionBusy)}
                          onClick={() => void ruleAction(rule, "test")}
                        >
                          <FiZap size={15} />
                          {actionBusy === `${rule.id}:test` ? copy.testing : copy.testSlack}
                        </button>
                        <Link
                          href={`/settings/notifications/${rule.id}`}
                          className="btn-icon"
                          title={copy.edit}
                          aria-label={copy.edit}
                        >
                          <FiEdit2 size={16} />
                        </Link>
                        <button
                          type="button"
                          className="btn-icon"
                          title={copy.remove}
                          aria-label={copy.remove}
                          disabled={Boolean(actionBusy)}
                          onClick={() => void ruleAction(rule, "delete")}
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
    </div>
  );
}
