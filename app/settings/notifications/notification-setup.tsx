"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FiArrowLeft, FiCheck } from "react-icons/fi";
import { useLocale } from "@/app/locale-context";
import type { Connection } from "../connections/types";
import { NOTIFY_COPY } from "./copy";
import {
  CHANNELS,
  ChannelIcon,
  StatusChip,
  channelName,
  toggleId,
  type ChannelId,
  type IxacsStatusOption,
  type ProductionGroup,
  type SelectableCustomer,
} from "./shared";

type LineStatusMap = Record<string, string[]>;

function buildSelectableCustomers(connections: Connection[]) {
  const groups: { connectionId: string; name: string; items: SelectableCustomer[] }[] = [];
  const singles: SelectableCustomer[] = [];

  for (const connection of connections) {
    const nested = connection.customers ?? [];
    if (nested.length > 0) {
      groups.push({
        connectionId: connection.id,
        name: connection.name,
        items: nested.map((customer) => ({
          key: `${connection.id}:${customer.id}`,
          connectionId: connection.id,
          connectionName: connection.name,
          customerId: customer.id,
          customerName: customer.name || customer.id,
          group: true,
        })),
      });
      continue;
    }
    const customerId = connection.customerId || connection.id;
    singles.push({
      key: `${connection.id}:${customerId}`,
      connectionId: connection.id,
      connectionName: connection.name,
      customerId,
      customerName: connection.name,
      group: false,
    });
  }

  return { groups, singles };
}

export function NotificationSetup({ ruleId }: { ruleId?: string }) {
  const router = useRouter();
  const { locale } = useLocale();
  const copy = NOTIFY_COPY[locale];
  const isEdit = Boolean(ruleId);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [machinesLoading, setMachinesLoading] = useState(true);
  const [ruleLoading, setRuleLoading] = useState(isEdit);
  const [channel, setChannel] = useState<ChannelId | null>(null);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [groups, setGroups] = useState<ProductionGroup[]>([]);
  const [statusesByLineCatalog, setStatusesByLineCatalog] = useState<Record<string, IxacsStatusOption[]>>({});
  const [lineStatusLoading, setLineStatusLoading] = useState<string | null>(null);
  const [scopeLoading, setScopeLoading] = useState(false);
  const [scopeError, setScopeError] = useState<string | null>(null);
  const [groupIds, setGroupIds] = useState<string[]>([]);
  const [lineIds, setLineIds] = useState<string[]>([]);
  const [statusByLine, setStatusByLine] = useState<LineStatusMap>({});
  const [activeStatusLine, setActiveStatusLine] = useState<string | null>(null);
  const [webhookUrl, setWebhookUrl] = useState("");
  const [webhookConfigured, setWebhookConfigured] = useState(false);
  const [saving, setSaving] = useState(false);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const detailFetchedRef = useRef(new Set<string>());
  const pendingSelectionRef = useRef<{
    groupNames: string[];
    lineUuids: string[];
    statusByLine: LineStatusMap;
    catalog: Record<string, IxacsStatusOption[]>;
  } | null>(null);

  const machineLists = useMemo(() => buildSelectableCustomers(connections), [connections]);
  const allMachines = useMemo(
    () => [...machineLists.groups.flatMap((group) => group.items), ...machineLists.singles],
    [machineLists],
  );
  const selectedMachine = allMachines.find((item) => item.key === selectedKey) ?? null;

  const selectedGroups = useMemo(
    () => groups.filter((group) => groupIds.includes(group.uuid)),
    [groups, groupIds],
  );
  const availableLines = useMemo(
    () =>
      selectedGroups.flatMap((group) =>
        group.lines.map((line) => ({ ...line, groupName: group.name, groupUuid: group.uuid })),
      ),
    [selectedGroups],
  );
  const selectedLines = useMemo(
    () => availableLines.filter((line) => lineIds.includes(line.uuid)),
    [availableLines, lineIds],
  );

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setMachinesLoading(true);
      try {
        const response = await fetch("/api/connections", { cache: "no-store" });
        const data = (await response.json()) as { connections?: Connection[] };
        if (!cancelled) setConnections(data.connections ?? []);
      } finally {
        if (!cancelled) setMachinesLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!ruleId) return;
    let cancelled = false;
    void (async () => {
      setRuleLoading(true);
      try {
        const response = await fetch(`/api/notifications/${ruleId}`, { cache: "no-store" });
        const data = (await response.json().catch(() => ({}))) as {
          rule?: {
            channel: ChannelId;
            connectionId: string;
            customerId: string;
            customerName: string;
            lines: { uuid: string; name: string; groupName: string }[];
            statusByLine: Record<string, IxacsStatusOption[]>;
            webhookConfigured?: boolean;
          };
          error?: string;
        };
        if (cancelled) return;
        if (!response.ok || !data.rule) {
          setActionMessage(data.error || copy.actionFailed);
          return;
        }
        const rule = data.rule;
        setChannel(rule.channel);
        setSelectedKey(`${rule.connectionId}:${rule.customerId}`);
        setWebhookConfigured(Boolean(rule.webhookConfigured));
        const statusMap: LineStatusMap = {};
        const catalog: Record<string, IxacsStatusOption[]> = {};
        for (const line of rule.lines) {
          const statuses = rule.statusByLine[line.uuid] ?? [];
          statusMap[line.uuid] = statuses.map((item) => item.uuid);
          catalog[line.uuid] = statuses.map((item) => ({
            uuid: item.uuid,
            name: item.name,
            backgroundColor: item.backgroundColor ?? null,
            textColor: null,
            blinking: false,
            blinkingBackgroundColor: null,
            blinkingTextColor: null,
          }));
        }
        pendingSelectionRef.current = {
          groupNames: [...new Set(rule.lines.map((line) => line.groupName))],
          lineUuids: rule.lines.map((line) => line.uuid),
          statusByLine: statusMap,
          catalog,
        };
      } finally {
        if (!cancelled) setRuleLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [copy.actionFailed, ruleId]);

  const loadScope = useCallback(
    async (machine: SelectableCustomer | null) => {
      setGroups([]);
      setStatusesByLineCatalog({});
      setGroupIds([]);
      setLineIds([]);
      setStatusByLine({});
      setActiveStatusLine(null);
      detailFetchedRef.current = new Set();
      setScopeError(null);
      if (!machine) return;

      setScopeLoading(true);
      try {
        const response = await fetch(`/api/connections/${machine.connectionId}/statuses`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ customerId: machine.customerId }),
        });
        const data = (await response.json().catch(() => ({}))) as {
          ok?: boolean;
          error?: string;
          groups?: ProductionGroup[];
          statusesByLine?: Record<string, IxacsStatusOption[]>;
        };
        if (!response.ok || data.ok === false) {
          throw new Error(data.error || copy.scopeError);
        }
        const nextGroups = data.groups ?? [];
        const discovered = data.statusesByLine ?? {};
        setGroups(nextGroups);

        const pending = pendingSelectionRef.current;
        if (pending) {
          const nextGroupIds = nextGroups
            .filter((group) => group.lines.some((line) => pending.lineUuids.includes(line.uuid)))
            .map((group) => group.uuid);
          setGroupIds(nextGroupIds);
          setLineIds(pending.lineUuids);
          setStatusByLine(pending.statusByLine);
          setStatusesByLineCatalog({ ...discovered, ...pending.catalog });
          setActiveStatusLine(pending.lineUuids[0] ?? null);
          pendingSelectionRef.current = null;
        } else {
          setStatusesByLineCatalog(discovered);
        }
      } catch {
        setScopeError(copy.scopeError);
      } finally {
        setScopeLoading(false);
      }
    },
    [copy.scopeError],
  );

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadScope(selectedMachine);
    }, 180);
    return () => window.clearTimeout(timer);
  }, [loadScope, selectedMachine]);

  useEffect(() => {
    setLineIds((current) => current.filter((id) => availableLines.some((line) => line.uuid === id)));
  }, [availableLines]);

  useEffect(() => {
    setStatusByLine((current) => {
      const next: LineStatusMap = {};
      for (const line of selectedLines) {
        next[line.uuid] = current[line.uuid] ?? [];
      }
      return next;
    });
    setActiveStatusLine((current) => {
      if (current && selectedLines.some((line) => line.uuid === current)) return current;
      return selectedLines[0]?.uuid ?? null;
    });
  }, [selectedLines]);

  useEffect(() => {
    if (!selectedMachine || !activeStatusLine) return;
    const line = selectedLines.find((item) => item.uuid === activeStatusLine);
    if (!line) return;
    if (detailFetchedRef.current.has(line.uuid)) return;

    let cancelled = false;
    setLineStatusLoading(line.uuid);
    void (async () => {
      try {
        const response = await fetch(`/api/connections/${selectedMachine.connectionId}/statuses`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            customerId: selectedMachine.customerId,
            lineUuid: line.uuid,
            groupUuid: line.groupUuid,
          }),
        });
        const data = (await response.json().catch(() => ({}))) as {
          ok?: boolean;
          statuses?: IxacsStatusOption[];
        };
        if (cancelled || !response.ok || data.ok === false) return;
        const next = data.statuses ?? [];
        detailFetchedRef.current.add(line.uuid);
        if (next.length === 0) return;
        setStatusesByLineCatalog((current) => ({
          ...current,
          [line.uuid]: next,
        }));
      } finally {
        if (!cancelled) setLineStatusLoading((current) => (current === line.uuid ? null : current));
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [activeStatusLine, selectedLines, selectedMachine]);

  const totalStatusPicks = useMemo(
    () => Object.values(statusByLine).reduce((sum, list) => sum + list.length, 0),
    [statusByLine],
  );
  const canPreview = Boolean(
    channel === "slack" &&
      (webhookUrl.trim() || (isEdit && webhookConfigured)) &&
      selectedMachine &&
      selectedLines.length > 0 &&
      totalStatusPicks > 0,
  );

  const summaryText = useMemo(() => {
    if (!channel || selectedLines.length === 0 || totalStatusPicks === 0) return copy.summaryEmpty;
    if (selectedLines.length === 1 && totalStatusPicks === 1) {
      const line = selectedLines[0];
      const statusUuid = statusByLine[line.uuid]?.[0];
      const status = (statusesByLineCatalog[line.uuid] ?? []).find((item) => item.uuid === statusUuid);
      return copy.summaryLine(status?.name ?? statusUuid ?? "", line.name, channelName(copy, channel));
    }
    return copy.summaryMulti(selectedLines.length, totalStatusPicks, channelName(copy, channel));
  }, [channel, copy, selectedLines, statusByLine, statusesByLineCatalog, totalStatusPicks]);

  function toggleStatus(lineUuid: string, statusUuid: string) {
    setStatusByLine((current) => ({
      ...current,
      [lineUuid]: toggleId(current[lineUuid] ?? [], statusUuid),
    }));
  }

  async function addDraft() {
    if (!channel || !selectedMachine || selectedLines.length === 0 || totalStatusPicks === 0) return;
    if (!webhookUrl.trim() && !(isEdit && webhookConfigured)) return;
    const statusByLineFull: Record<string, IxacsStatusOption[]> = {};
    for (const line of selectedLines) {
      const ids = statusByLine[line.uuid] ?? [];
      const catalog = statusesByLineCatalog[line.uuid] ?? [];
      statusByLineFull[line.uuid] = catalog.filter((item) => ids.includes(item.uuid));
    }
    setSaving(true);
    setActionMessage(null);
    const payload = {
      channel,
      connectionId: selectedMachine.connectionId,
      customerId: selectedMachine.customerId,
      customerName: selectedMachine.customerName,
      webhookUrl,
      lines: selectedLines.map((line) => ({
        uuid: line.uuid,
        name: line.name,
        groupName: line.groupName,
      })),
      statusByLine: statusByLineFull,
    };
    const response = await fetch(
      isEdit ? `/api/notifications/${ruleId}` : "/api/notifications",
      {
        method: isEdit ? "PATCH" : "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      },
    );
    const data = (await response.json().catch(() => ({}))) as { error?: string };
    if (!response.ok) {
      setActionMessage(data.error || copy.actionFailed);
      setSaving(false);
      return;
    }
    router.push("/settings/notifications");
  }

  return (
    <div className="console-page notify-page">
      <header className="notify-head">
        <div>
          <Link href="/settings/notifications" className="notify-back">
            <FiArrowLeft size={15} aria-hidden />
            {copy.backToList}
          </Link>
          <h1 className="console-title">{isEdit ? copy.editTitle : copy.setupTitle}</h1>
        </div>
      </header>

      {ruleLoading ? (
        <p className="notify-muted">{copy.loadingScope}</p>
      ) : null}

      {actionMessage ? (
        <p className="notify-action-message" aria-live="polite">
          {actionMessage}
        </p>
      ) : null}

      <div className={`notify-setup ${ruleLoading ? "is-loading" : ""}`}>
        <section className="notify-step" aria-labelledby="notify-step-channel">
          <div className="notify-step-head">
            <h2 id="notify-step-channel">{copy.stepChannel}</h2>
            <p>{copy.stepChannelHint}</p>
          </div>
          <div className="notify-dest-row" role="radiogroup" aria-label={copy.stepChannel}>
            {CHANNELS.map((id) => {
              const active = channel === id;
              return (
                <button
                  key={id}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  className={`notify-dest ${active ? "is-active" : ""}`}
                  onClick={() => setChannel(id)}
                  disabled={id !== "slack"}
                  title={id !== "slack" ? copy.comingSoon : undefined}
                >
                  <span className="notify-dest-icon">
                    <ChannelIcon id={id} size={24} />
                  </span>
                  <strong>{channelName(copy, id)}</strong>
                  {active ? <FiCheck size={16} className="notify-dest-check" aria-hidden /> : null}
                </button>
              );
            })}
          </div>
          {channel === "slack" ? (
            <label className="machine-field notify-webhook-field">
              <span className="machine-label">{copy.webhookLabel}</span>
              <input
                className="machine-input"
                type="password"
                autoComplete="off"
                placeholder={
                  isEdit && webhookConfigured
                    ? "••••••••••••••••"
                    : "https://hooks.slack.com/services/..."
                }
                value={webhookUrl}
                onChange={(event) => setWebhookUrl(event.target.value)}
              />
            </label>
          ) : null}
        </section>

        <section className="notify-step" aria-labelledby="notify-step-machine">
          <div className="notify-step-head">
            <h2 id="notify-step-machine">{copy.stepMachine}</h2>
          </div>
          {machinesLoading ? (
            <p className="notify-muted">{copy.loadingMachines}</p>
          ) : allMachines.length === 0 ? (
            <p className="notify-muted">{copy.noMachines}</p>
          ) : (
            <div className="notify-customer-groups">
              {machineLists.groups.map((group) => (
                <div key={group.connectionId} className="notify-customer-group">
                  <div className="notify-group-head">
                    <strong>{group.name}</strong>
                    <span>{copy.groupCustomers(group.items.length)}</span>
                  </div>
                  <div className="notify-pick-list" role="radiogroup">
                    {group.items.map((machine) => {
                      const active = selectedKey === machine.key;
                      return (
                        <button
                          key={machine.key}
                          type="button"
                          role="radio"
                          aria-checked={active}
                          className={`notify-pick ${active ? "is-active" : ""}`}
                          onClick={() => setSelectedKey(machine.key)}
                        >
                          <span className="notify-pick-check" aria-hidden>
                            {active ? <FiCheck size={14} /> : null}
                          </span>
                          <span className="notify-pick-copy">
                            <strong>{machine.customerName}</strong>
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
              {machineLists.singles.length > 0 ? (
                <div className="notify-customer-group">
                  <div className="notify-pick-list" role="radiogroup">
                    {machineLists.singles.map((machine) => {
                      const active = selectedKey === machine.key;
                      return (
                        <button
                          key={machine.key}
                          type="button"
                          role="radio"
                          aria-checked={active}
                          className={`notify-pick ${active ? "is-active" : ""}`}
                          onClick={() => setSelectedKey(machine.key)}
                        >
                          <span className="notify-pick-check" aria-hidden>
                            {active ? <FiCheck size={14} /> : null}
                          </span>
                          <span className="notify-pick-copy">
                            <strong>{machine.customerName}</strong>
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : null}
            </div>
          )}
        </section>

        {!selectedMachine ? null : scopeLoading ? (
          <p className="notify-muted">{copy.loadingScope}</p>
        ) : scopeError ? (
          <p className="notify-muted is-error">{scopeError}</p>
        ) : (
          <>
            <section className="notify-step" aria-labelledby="notify-step-scope">
              <div className="notify-step-head">
                <div>
                  <h2 id="notify-step-scope">{copy.stepScope}</h2>
                  <p>{copy.stepScopeHint}</p>
                </div>
              </div>

              {groups.length === 0 ? (
                <p className="notify-muted">{copy.noGroups}</p>
              ) : (
                <>
                  <p className="notify-mini-label">{copy.groups}</p>
                  <div className="notify-chip-row">
                    {groups.map((group) => {
                      const active = groupIds.includes(group.uuid);
                      return (
                        <button
                          key={group.uuid}
                          type="button"
                          className={`notify-chip ${active ? "is-active" : ""}`}
                          aria-pressed={active}
                          onClick={() => setGroupIds((current) => toggleId(current, group.uuid))}
                        >
                          {group.name}
                          <small>{group.lines.length}</small>
                        </button>
                      );
                    })}
                  </div>

                  {groupIds.length > 0 ? (
                    <>
                      <p className="notify-mini-label">{copy.lines}</p>
                      {availableLines.length === 0 ? (
                        <p className="notify-muted">{copy.noLines}</p>
                      ) : (
                        <div className="notify-pick-list">
                          {availableLines.map((line) => {
                            const active = lineIds.includes(line.uuid);
                            return (
                              <button
                                key={line.uuid}
                                type="button"
                                className={`notify-pick ${active ? "is-active" : ""}`}
                                aria-pressed={active}
                                onClick={() => setLineIds((current) => toggleId(current, line.uuid))}
                              >
                                <span className="notify-pick-check" aria-hidden>
                                  {active ? <FiCheck size={14} /> : null}
                                </span>
                                <span className="notify-pick-copy">
                                  <strong>{line.name}</strong>
                                  <small>{line.groupName}</small>
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </>
                  ) : null}
                </>
              )}
            </section>

            {selectedLines.length === 0 ? (
              <p className="notify-muted notify-status-placeholder">{copy.pickLinesFirst}</p>
            ) : (
              <section className="notify-step" aria-labelledby="notify-step-status">
                <div className="notify-step-head">
                  <div>
                    <h2 id="notify-step-status">{copy.stepStatus}</h2>
                    <p>{copy.stepStatusHint}</p>
                  </div>
                </div>
                <div className="notify-line-status-list">
                  {selectedLines.map((line) => {
                    const picked = statusByLine[line.uuid] ?? [];
                    const lineStatuses = statusesByLineCatalog[line.uuid] ?? [];
                    const open = activeStatusLine === line.uuid;
                    const loading = lineStatusLoading === line.uuid;
                    return (
                      <article
                        key={line.uuid}
                        className={`notify-line-status ${open ? "is-open" : ""}`}
                      >
                        <button
                          type="button"
                          className="notify-line-status-toggle"
                          aria-expanded={open}
                          onClick={() =>
                            setActiveStatusLine((current) => (current === line.uuid ? null : line.uuid))
                          }
                        >
                          <span className="notify-pick-copy">
                            <strong>{line.name}</strong>
                            <small>{line.groupName}</small>
                          </span>
                          <span className="notify-line-status-count">
                            {copy.statusesPicked(picked.length)}
                          </span>
                        </button>
                        {open ? (
                          <div className="notify-line-status-body">
                            <p className="notify-mini-label">{copy.statusForLine}</p>
                            {loading && lineStatuses.length === 0 ? (
                              <p className="notify-muted">{copy.loadingScope}</p>
                            ) : lineStatuses.length === 0 ? (
                              <p className="notify-muted">{copy.noStatuses}</p>
                            ) : (
                              <div className="notify-status-row">
                                {lineStatuses.map((status) => (
                                  <StatusChip
                                    key={`${line.uuid}:${status.uuid}`}
                                    status={status}
                                    active={picked.includes(status.uuid)}
                                    onClick={() => toggleStatus(line.uuid, status.uuid)}
                                  />
                                ))}
                              </div>
                            )}
                          </div>
                        ) : picked.length > 0 ? (
                          <div className="notify-status-row notify-status-picked">
                            {lineStatuses
                              .filter((status) => picked.includes(status.uuid))
                              .map((status) => (
                                <StatusChip key={`summary-${status.uuid}`} status={status} active />
                              ))}
                          </div>
                        ) : null}
                      </article>
                    );
                  })}
                </div>
              </section>
            )}
          </>
        )}

        <section className="notify-summary" aria-live="polite">
          <p>{summaryText}</p>
          <div className="notify-summary-actions">
            <button
              type="button"
              className="btn btn-primary"
              disabled={!canPreview || saving}
              title={copy.comingSoon}
              onClick={() => void addDraft()}
            >
              {saving ? copy.saving : isEdit ? copy.saveChanges : copy.save}
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}
