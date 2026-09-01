"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocale } from "../../../locale-context";
import { formatWhen, maskUserId } from "../shared";
import type { SystemMachine } from "../types";
import { PersonCell, SystemShell, SYSTEMS_COPY } from "./system-shell";

export function SystemUsers({ machineId }: { machineId: string }) {
  const { locale } = useLocale();
  const copy = SYSTEMS_COPY[locale];
  const [machine, setMachine] = useState<SystemMachine | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/admin/systems/${machineId}`, { cache: "no-store" });
      const data = (await response.json()) as { machine?: SystemMachine; error?: string };
      if (!response.ok) throw new Error(data.error);
      setMachine(data.machine ?? null);
      setError(data.machine ? null : copy.empty);
    } catch {
      setError(copy.loadError);
    } finally {
      setLoading(false);
    }
  }, [copy.empty, copy.loadError, machineId]);

  useEffect(() => {
    void load();
  }, [load]);

  const users = useMemo(() => {
    const needle = search.trim().toLowerCase();
    const list = machine?.users ?? [];
    if (!needle) return list;
    return list.filter((user) =>
      [user.displayName, user.customerId, user.customerName, user.lineUserId].some((value) =>
        value?.toLowerCase().includes(needle),
      ),
    );
  }, [machine, search]);

  return (
    <SystemShell
      machineId={machineId}
      title={machine?.name ?? ""}
      meta={machine?.companyLabel}
      copy={copy}
      active="users"
      loading={loading}
      onRefresh={() => void load()}
    >
      <div className="as-tools">
        {loading && !machine ? (
          <span className="skeleton as-tools-skel" aria-hidden />
        ) : (
          <input
            className="pac-search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={copy.searchUsers}
            aria-label={copy.searchUsers}
          />
        )}
      </div>
      {error ? <p className="inline-error">{error}</p> : null}
      {loading && !machine ? (
        <div className="as-data-wrap" aria-busy="true">
          <div className="as-data as-data-users">
            <div className="as-data-row as-data-head">
              <span>{copy.colName}</span>
              <span>{copy.ixacsId}</span>
              <span>{copy.colCompany}</span>
              <span>{copy.lineId}</span>
              <span>{copy.colOnline}</span>
              <span>{copy.colLast}</span>
            </div>
            {[0, 1, 2, 3].map((row) => (
              <div key={row} className="as-data-row">
                <span className="skeleton skeleton-key" />
                <span className="skeleton skeleton-assign" />
                <span className="skeleton skeleton-assign" />
                <span className="skeleton skeleton-action" />
                <span className="skeleton skeleton-action" />
                <span className="skeleton skeleton-assign" />
              </div>
            ))}
          </div>
        </div>
      ) : !machine ? null : users.length === 0 ? (
        <div className="as-empty">{machine.users.length === 0 ? copy.noUsers : copy.noUserMatch}</div>
      ) : (
        <div className="as-data-wrap">
          <div className="as-data as-data-users">
            <div className="as-data-row as-data-head">
              <span>{copy.colName}</span>
              <span>{copy.ixacsId}</span>
              <span>{copy.colCompany}</span>
              <span>{copy.lineId}</span>
              <span>{copy.colOnline}</span>
              <span>{copy.colLast}</span>
            </div>
            {users.map((user) => (
              <div key={user.lineUserId} className="as-data-row">
                <PersonCell name={user.displayName || maskUserId(user.lineUserId)} pictureUrl={user.pictureUrl} />
                <span className="as-mono">{user.customerId || ""}</span>
                <span>{user.customerName || ""}</span>
                <span className="as-mono">{maskUserId(user.lineUserId)}</span>
                <span>
                  <span className={`as-badge ${user.loggedIn ? "is-on" : ""}`}>
                    {user.loggedIn ? copy.loggedIn : copy.loggedOut}
                  </span>
                </span>
                <time className="as-cell-muted" dateTime={user.lastLoginAt ?? undefined}>
                  {formatWhen(user.lastLoginAt, locale, copy.never)}
                </time>
              </div>
            ))}
          </div>
        </div>
      )}
    </SystemShell>
  );
}
