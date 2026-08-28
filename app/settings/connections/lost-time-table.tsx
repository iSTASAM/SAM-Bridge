"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { FiRefreshCw } from "react-icons/fi";
import { useLocale, type Locale } from "../../locale-context";

type Topic = {
  key: string;
  status: string;
  nameJa: string;
  nameEn: string;
  name3rd: string;
  backgroundColor: string | null;
};

type Row = {
  companyId: string;
  companyName: string;
  productionGroupUuid: string;
  productionGroupName: string;
  productionLineUuid: string;
  productionLineName: string;
  minutesByTopic: Record<string, number>;
  countByTopic: Record<string, number>;
};

type LostTimeResponse = {
  topics?: Topic[];
  rows?: Row[];
  dateFrom?: string;
  dateTo?: string;
  error?: string;
};

type SortKey = "group" | "line" | "total" | `topic:${string}`;
type SortDir = "asc" | "desc";

function topicLabel(topic: Topic, locale: Locale) {
  if (locale === "ja") return topic.nameJa || topic.nameEn || topic.name3rd;
  if (locale === "th") return topic.name3rd || topic.nameEn || topic.nameJa;
  return topic.nameEn || topic.name3rd || topic.nameJa;
}

export function LostTimeTable({
  connectionIds,
  customerIds = [],
  dateQuery,
  autoLoad = false,
}: {
  connectionIds: string[];
  customerIds?: string[];
  dateQuery: Record<string, string>;
  autoLoad?: boolean;
}) {
  const { locale } = useLocale();
  const [topics, setTopics] = useState<Topic[]>([]);
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("total");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    const results = await Promise.all(connectionIds.map(async (id) => {
      const body: Record<string, unknown> = { ...dateQuery };
      if (customerIds.length > 0) body.customerIds = customerIds;
      const response = await fetch(`/api/connections/${id}/lost-time`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await response.json().catch(() => ({})) as LostTimeResponse;
      return { ok: response.ok, data };
    }));

    const topicMap = new Map<string, Topic>();
    for (const result of results) {
      for (const topic of result.data.topics ?? []) {
        if (!topicMap.has(topic.key)) topicMap.set(topic.key, topic);
      }
    }
    setTopics([...topicMap.values()]);
    setRows(results.flatMap((result) => result.data.rows ?? []).sort((a, b) =>
      a.companyName.localeCompare(b.companyName) ||
      a.productionGroupName.localeCompare(b.productionGroupName) ||
      a.productionLineName.localeCompare(b.productionLineName),
    ));
    setError(results.find((result) => !result.ok)?.data.error ?? "");
    const datedResult = results.find((result) => result.data.dateFrom);
    setDateFrom(datedResult?.data.dateFrom ?? "");
    setDateTo(datedResult?.data.dateTo ?? datedResult?.data.dateFrom ?? "");
    setLoaded(true);
    setLoading(false);
  }, [connectionIds, customerIds.join(","), dateQuery]);

  useEffect(() => {
    if (!autoLoad) return;
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [autoLoad, load]);

  const totalForRow = useCallback((row: Row) =>
    Object.values(row.minutesByTopic).reduce((sum, value) => sum + (Number.isFinite(value) ? value : 0), 0), []);

  const sortedRows = useMemo(() => [...rows].sort((left, right) => {
    let comparison = 0;
    if (sortKey === "group") comparison = left.productionGroupName.localeCompare(right.productionGroupName, locale);
    else if (sortKey === "line") comparison = left.productionLineName.localeCompare(right.productionLineName, locale);
    else if (sortKey === "total") comparison = totalForRow(left) - totalForRow(right);
    else {
      const topicKey = sortKey.slice("topic:".length);
      comparison = (left.minutesByTopic[topicKey] ?? 0) - (right.minutesByTopic[topicKey] ?? 0);
    }
    if (!comparison) comparison = left.companyName.localeCompare(right.companyName, locale)
      || left.productionLineName.localeCompare(right.productionLineName, locale);
    return sortDir === "asc" ? comparison : -comparison;
  }), [locale, rows, sortDir, sortKey, totalForRow]);

  const totals = useMemo(() => {
    const byTopic: Record<string, number> = {};
    let total = 0;
    for (const row of rows) {
      for (const topic of topics) {
        const minutes = row.minutesByTopic[topic.key] ?? 0;
        byTopic[topic.key] = (byTopic[topic.key] ?? 0) + minutes;
        total += minutes;
      }
    }
    return { byTopic, total };
  }, [rows, topics]);

  function toggleSort(key: SortKey) {
    if (sortKey !== key) {
      setSortKey(key);
      setSortDir(key === "group" || key === "line" ? "asc" : "desc");
      return;
    }
    setSortDir((current) => current === "asc" ? "desc" : "asc");
  }

  function sortHeader(key: SortKey, label: React.ReactNode) {
    return <button type="button" className="dx-lost-sort" onClick={() => toggleSort(key)}>
      <span>{label}</span>
      {sortKey === key ? <span className="dx-sort" aria-hidden>{sortDir === "asc" ? "↑" : "↓"}</span> : null}
    </button>;
  }

  const th = locale === "th";
  return <>
    <section className="dx-lost-time">
      <header>
        <span>
          <strong>{th ? "เวลาหยุดตามหัวข้อจาก iXacs" : "Lost time by iXacs topic"}</strong>
          {dateFrom ? <small>{dateFrom}{dateTo && dateTo !== dateFrom ? ` → ${dateTo}` : ""}</small> : null}
        </span>
        <button type="button" className="btn btn-secondary" disabled={loading} onClick={() => void load()}>
          <FiRefreshCw size={14} className={loading ? "dx-spin" : undefined} />
          {loaded ? (th ? "โหลดใหม่" : "Reload") : (th ? "แสดง Lost Time" : "Load lost time")}
        </button>
      </header>
      {loading ? <div className="dx-lost-skeleton">{Array.from({ length: 5 }, (_, index) => <span className="skeleton" key={index} />)}</div> : null}
      {!loading && error ? <p className="dx-ai-error">{error}</p> : null}
      {!loading && loaded && rows.length ? <div className="dx-lost-scroll"><table>
        <thead><tr>
          <th aria-sort={sortKey === "group" ? (sortDir === "asc" ? "ascending" : "descending") : "none"}>{sortHeader("group", "Production Group")}</th>
          <th aria-sort={sortKey === "line" ? (sortDir === "asc" ? "ascending" : "descending") : "none"}>{sortHeader("line", "Production Line")}</th>
          <th className="dx-lost-topic" aria-sort={sortKey === "total" ? (sortDir === "asc" ? "ascending" : "descending") : "none"}>{sortHeader("total", th ? "Lost Time รวม" : "Total Lost Time")}</th>
          {topics.map((topic) => <th className="dx-lost-topic" key={topic.key}>
            {sortHeader(`topic:${topic.key}`, <><i style={{ backgroundColor: topic.backgroundColor ?? undefined }} />{topicLabel(topic, locale)}</>)}
          </th>)}
        </tr></thead>
        <tbody>{sortedRows.map((row) => <tr key={`${row.companyId}-${row.productionLineUuid}`}>
          <td>{row.productionGroupName}</td>
          <td>{row.productionLineName}</td>
          <td className="dx-lost-minutes dx-lost-total">{totalForRow(row).toLocaleString(undefined, { maximumFractionDigits: 1 })}</td>
          {topics.map((topic) => {
            const minutes = row.minutesByTopic[topic.key];
            return <td className="dx-lost-minutes" key={topic.key}>{minutes === undefined ? "" : minutes.toLocaleString(undefined, { maximumFractionDigits: 1 })}</td>;
          })}
        </tr>)}</tbody>
        <tfoot><tr>
          <th colSpan={2}>{th ? "รวมทุกสายการผลิต" : "All production lines"}</th>
          <th className="dx-lost-minutes dx-lost-total">{totals.total.toLocaleString(undefined, { maximumFractionDigits: 1 })}</th>
          {topics.map((topic) => <th className="dx-lost-minutes" key={topic.key}>
            {(totals.byTopic[topic.key] ?? 0).toLocaleString(undefined, { maximumFractionDigits: 1 })}
          </th>)}
        </tr></tfoot>
      </table></div> : null}
      {!loading && loaded && !rows.length && !error ? <p className="ew-muted">{th ? "ไม่พบไลน์การผลิตในช่วงที่เลือก" : "No production lines found for this period"}</p> : null}
    </section>
  </>;
}
