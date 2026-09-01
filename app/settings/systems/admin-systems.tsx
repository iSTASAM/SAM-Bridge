"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { FiBell, FiUsers } from "react-icons/fi";
import { useLocale } from "../../locale-context";
import { SYSTEMS_COPY } from "./copy";
import { formatWhen } from "./shared";
import { ChannelPageTitle, SystemsPageShell } from "./systems-channel-nav";
import type { SystemMachine, SystemsSummary } from "./types";

type UsageFilter = "all" | "users" | "online";

function companyNames(machine: SystemMachine): string[] {
  if (machine.companyLabel && machine.companyLabel !== "—") {
    return machine.companyLabel.split(" · ").map((name) => name.trim()).filter(Boolean);
  }
  return machine.customers.map((item) => item.name).filter(Boolean);
}

function CompanyCell({ names }: { names: string[] }) {
  const [expanded, setExpanded] = useState(false);
  if (names.length === 0) return <span className="as-muted">—</span>;
  const limit = 4;
  const hidden = Math.max(0, names.length - limit);
  const visible = expanded ? names : names.slice(0, limit);
  return (
    <div className={`as-company-list${expanded ? " is-expanded" : ""}`}>
      {visible.map((name) => (
        <span key={name} className="as-company-chip">
          {name}
        </span>
      ))}
      {hidden > 0 ? (
        <button
          type="button"
          className="as-company-more"
          aria-expanded={expanded}
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            setExpanded((value) => !value);
          }}
        >
          {expanded ? "−" : `+${hidden}`}
        </button>
      ) : null}
    </div>
  );
}

export function AdminSystems() {
  const { locale } = useLocale();
  const copy = SYSTEMS_COPY[locale];
  const router = useRouter();
  const [machines, setMachines] = useState<SystemMachine[]>([]);
  const [summary, setSummary] = useState<SystemsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<UsageFilter>("all");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/admin/systems", { cache: "no-store" });
      const data = (await response.json()) as {
        summary?: SystemsSummary;
        machines?: SystemMachine[];
        error?: string;
      };
      if (!response.ok) throw new Error(data.error);
      setMachines(data.machines ?? []);
      setSummary(data.summary ?? null);
      setError(null);
    } catch {
      setError(copy.loadError);
    } finally {
      setLoading(false);
    }
  }, [copy.loadError]);

  useEffect(() => {
    void load();
  }, [load]);

  const rows = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return machines.filter((machine) => {
      if (filter === "users" && machine.userCount === 0) return false;
      if (filter === "online" && machine.onlineCount === 0) return false;
      if (!needle) return true;
      const companies = companyNames(machine).join(" ");
      return `${machine.name} ${companies}`.toLowerCase().includes(needle);
    });
  }, [filter, machines, search]);

  return (
    <SystemsPageShell
      copy={copy}
      title={<ChannelPageTitle channel="line" label={copy.navLine} />}
      loading={loading}
      onRefresh={() => void load()}
      backHref="/settings/systems/alerts"
      narrow={false}
    >
      <section className="as-stats" aria-label={copy.title}>
        <article className="as-stat">
          <span className="as-stat-label">{copy.machines}</span>
          <strong>{summary?.machineWithUsers ?? 0}</strong>
        </article>
        <article className="as-stat">
          <span className="as-stat-label">{copy.users}</span>
          <strong>{summary?.userCount ?? 0}</strong>
        </article>
        <article className="as-stat">
          <span className="as-stat-label">{copy.online}</span>
          <strong>{summary?.onlineCount ?? 0}</strong>
        </article>
        <article className="as-stat">
          <span className="as-stat-label">{copy.rules}</span>
          <strong>{summary?.enabledRuleCount ?? 0}</strong>
        </article>
      </section>

      <div className="as-tools">
        <input
          className="pac-search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder={copy.search}
          aria-label={copy.search}
        />
        <select
          className="pac-filter"
          value={filter}
          onChange={(event) => setFilter(event.target.value as UsageFilter)}
          aria-label={copy.filterAll}
        >
          <option value="all">{copy.filterAll}</option>
          <option value="users">{copy.filterUsers}</option>
          <option value="online">{copy.filterOnline}</option>
        </select>
      </div>

      {error ? <p className="inline-error">{error}</p> : null}

      {loading ? (
        <div className="as-console-table-wrap" aria-busy="true">
          <div className="as-console-loading">
            {[0, 1, 2, 3].map((row) => (
              <span key={row} className="skeleton" />
            ))}
          </div>
        </div>
      ) : rows.length === 0 ? (
        <section className="as-empty">{machines.length === 0 ? copy.empty : copy.emptyFilter}</section>
      ) : (
        <>
          <div className="as-console-table-wrap">
            <table className="as-console-table as-systems-table">
              <thead>
                <tr>
                  <th>{copy.colMachine}</th>
                  <th>{copy.colCompany}</th>
                  <th>{copy.colUsers}</th>
                  <th>{copy.colRules}</th>
                  <th>{copy.colLast}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((machine) => {
                  const href = `/settings/systems/${machine.id}`;
                  const names = companyNames(machine);
                  return (
                    <tr
                      key={machine.id}
                      className="as-row-link"
                      tabIndex={0}
                      role="link"
                      aria-label={machine.name}
                      onClick={() => router.push(href)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          router.push(href);
                        }
                      }}
                    >
                      <td>
                        <strong className="as-machine-name">{machine.name}</strong>
                      </td>
                      <td>
                        <CompanyCell names={names} />
                      </td>
                      <td>
                        <span className="as-count">
                          <FiUsers size={13} />
                          {machine.userCount}
                          {machine.onlineCount > 0 ? (
                            <em className="as-online">{machine.onlineCount}</em>
                          ) : null}
                        </span>
                      </td>
                      <td>
                        <span className="as-count">
                          <FiBell size={13} />
                          {machine.enabledRuleCount}
                          <span className="as-muted">/{machine.ruleCount}</span>
                        </span>
                      </td>
                      <td>
                        <time dateTime={machine.lastLoginAt ?? undefined}>
                          {formatWhen(machine.lastLoginAt, locale, copy.never)}
                        </time>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="as-cards">
            {rows.map((machine) => (
              <Link key={machine.id} href={`/settings/systems/${machine.id}`} className="as-card">
                <strong>{machine.name}</strong>
                <CompanyCell names={companyNames(machine)} />
                <div className="as-card-meta">
                  <span>{copy.colUsers} {machine.userCount}</span>
                  <span>{copy.online} {machine.onlineCount}</span>
                  <span>{copy.rules} {machine.enabledRuleCount}</span>
                </div>
              </Link>
            ))}
          </div>
        </>
      )}
    </SystemsPageShell>
  );
}
