"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { FiArrowLeft, FiCheck, FiChevronDown } from "react-icons/fi";
import { useLocale } from "../../locale-context";
import { DX_COPY } from "./data-explorer-copy";
import { LostTimeTable } from "./lost-time-table";
import { type Connection } from "./types";

type DateMode = "day" | "range" | "month" | "year";

function bangkokDateKey() {
  const parts = new Intl.DateTimeFormat("en", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${value.year}-${value.month}-${value.day}`;
}

function parseMode(query: Record<string, string>): DateMode {
  return query.mode === "range" || query.mode === "month" || query.mode === "year" ? query.mode : "day";
}

function buildDateQuery(
  mode: DateMode,
  values: { date: string; from: string; to: string; month: string; year: string },
): Record<string, string> {
  if (mode === "range") return { mode, from: values.from, to: values.to };
  if (mode === "month") return { mode, month: values.month };
  if (mode === "year") return { mode, year: values.year };
  return { mode, date: values.date };
}

function idsKey(ids: string[]) {
  return ids.slice().sort().join(",");
}

export function LostTimePage({
  machineId,
  connectionIds,
  customerIds: initialCustomerIds,
  dateQuery,
}: {
  machineId: string;
  connectionIds: string[];
  customerIds: string[];
  dateQuery: Record<string, string>;
}) {
  const { locale } = useLocale();
  const copy = DX_COPY[locale];
  const today = bangkokDateKey();
  const initialMode = parseMode(dateQuery);
  const [machines, setMachines] = useState<Connection[]>([]);
  const [switchOpen, setSwitchOpen] = useState(false);
  const [customerOpen, setCustomerOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState(connectionIds);
  const [appliedIds, setAppliedIds] = useState(connectionIds);
  const [selectedCustomerIds, setSelectedCustomerIds] = useState(initialCustomerIds);
  const [appliedCustomerIds, setAppliedCustomerIds] = useState(initialCustomerIds);
  const [dateMode, setDateMode] = useState<DateMode>(initialMode);
  const [selectedDate, setSelectedDate] = useState(dateQuery.date || today);
  const [dateFrom, setDateFrom] = useState(dateQuery.from || today);
  const [dateTo, setDateTo] = useState(dateQuery.to || today);
  const [selectedMonth, setSelectedMonth] = useState(dateQuery.month || today.slice(0, 7));
  const [selectedYear, setSelectedYear] = useState(dateQuery.year || today.slice(0, 4));
  const [appliedDateQuery, setAppliedDateQuery] = useState(() =>
    buildDateQuery(initialMode, {
      date: dateQuery.date || today,
      from: dateQuery.from || today,
      to: dateQuery.to || today,
      month: dateQuery.month || today.slice(0, 7),
      year: dateQuery.year || today.slice(0, 4),
    }),
  );
  const switchRef = useRef<HTMLDivElement>(null);
  const customerRef = useRef<HTMLDivElement>(null);
  const machine = machines.find((item) => item.id === machineId) ?? machines.find((item) => appliedIds.includes(item.id)) ?? null;

  const customerOptions = useMemo(() => {
    const byId = new Map<string, { id: string; name: string }>();
    for (const item of machines) {
      if (!appliedIds.includes(item.id) && item.id !== machineId) continue;
      for (const customer of item.customers ?? []) {
        if (!byId.has(customer.id)) byId.set(customer.id, customer);
      }
      if ((item.customers?.length ?? 0) === 0 && item.customerId && !byId.has(item.customerId)) {
        byId.set(item.customerId, { id: item.customerId, name: item.customerId });
      }
    }
    // Prefer the page machine's customer list when present.
    if ((machine?.customers?.length ?? 0) > 0) {
      return machine!.customers!;
    }
    return [...byId.values()];
  }, [machines, appliedIds, machineId, machine]);

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/connections", { cache: "no-store" }).then(async (response) => {
      const data = (await response.json()) as { connections?: Connection[] };
      if (cancelled) return;
      const list = data.connections ?? [];
      setMachines(list);
      const pageMachine = list.find((item) => item.id === machineId);
      if (!pageMachine) return;
      if (initialCustomerIds.length > 0) return;
      const defaults =
        (pageMachine.customers?.length ?? 0) > 0
          ? pageMachine.customers!.map((item) => item.id)
          : pageMachine.customerId
            ? [pageMachine.customerId]
            : [];
      if (defaults.length === 0) return;
      setSelectedCustomerIds(defaults);
      setAppliedCustomerIds(defaults);
    });
    return () => {
      cancelled = true;
    };
  }, [machineId, initialCustomerIds.length]);

  useEffect(() => {
    const key = idsKey(selectedIds);
    const timer = window.setTimeout(() => {
      setAppliedIds((current) => (idsKey(current) === key ? current : selectedIds));
    }, 180);
    return () => window.clearTimeout(timer);
  }, [selectedIds]);

  useEffect(() => {
    const key = idsKey(selectedCustomerIds);
    const timer = window.setTimeout(() => {
      setAppliedCustomerIds((current) => (idsKey(current) === key ? current : selectedCustomerIds));
    }, 180);
    return () => window.clearTimeout(timer);
  }, [selectedCustomerIds]);

  useEffect(() => {
    const params = new URLSearchParams({
      companies: appliedIds.join(","),
      ...appliedDateQuery,
    });
    if (appliedCustomerIds.length > 0) {
      params.set("customers", appliedCustomerIds.join(","));
    }
    const url = `/settings/${machineId}/data/lost-time?${params.toString()}`;
    window.history.replaceState(window.history.state, "", url);
  }, [appliedIds, appliedCustomerIds, appliedDateQuery, machineId]);

  useEffect(() => {
    function onPointer(event: MouseEvent) {
      if (!switchRef.current?.contains(event.target as Node)) setSwitchOpen(false);
      if (!customerRef.current?.contains(event.target as Node)) setCustomerOpen(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setSwitchOpen(false);
        setCustomerOpen(false);
      }
    }
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  const dateSelectionValid = dateMode === "range"
    ? Boolean(dateFrom && dateTo && dateFrom <= dateTo && dateTo <= today)
    : dateMode === "month"
      ? Boolean(selectedMonth && selectedMonth <= today.slice(0, 7))
      : dateMode === "year"
        ? /^\d{4}$/.test(selectedYear) && selectedYear <= today.slice(0, 4)
        : Boolean(selectedDate && selectedDate <= today);

  const periodLabels = useMemo(() => ({
    period: locale === "th" ? "ช่วงข้อมูล" : locale === "ja" ? "データ期間" : "Data period",
    day: locale === "th" ? "รายวัน" : locale === "ja" ? "日" : "Day",
    range: locale === "th" ? "ช่วงวันที่" : locale === "ja" ? "期間" : "Date range",
    month: locale === "th" ? "รายเดือน" : locale === "ja" ? "月" : "Month",
    year: locale === "th" ? "รายปี" : locale === "ja" ? "年" : "Year",
    historical: locale === "th" ? "ข้อมูลย้อนหลัง" : locale === "ja" ? "履歴データ" : "Historical",
    show: locale === "th" ? "แสดงข้อมูล" : locale === "ja" ? "表示" : "Show data",
    back: locale === "th" ? "กลับไปข้อมูลการผลิต" : locale === "ja" ? "生産データに戻る" : "Back to production data",
  }), [locale]);

  const customerLabel = useMemo(() => {
    if (selectedCustomerIds.length === 0) return copy.switchCustomer;
    if (customerOptions.length > 1 && selectedCustomerIds.length === customerOptions.length) {
      return copy.allCustomers;
    }
    if (selectedCustomerIds.length > 1) return copy.selectedCustomers(selectedCustomerIds.length);
    const one = customerOptions.find((item) => item.id === selectedCustomerIds[0]);
    return one?.name && one.name !== one.id ? one.name : (one?.id ?? copy.switchCustomer);
  }, [selectedCustomerIds, customerOptions, copy]);

  function toggleMachine(id: string) {
    setSelectedIds((current) => {
      if (current.includes(id)) {
        if (current.length === 1) return current;
        return current.filter((item) => item !== id);
      }
      return [...current, id];
    });
  }

  function toggleCustomer(id: string) {
    setSelectedCustomerIds((current) => {
      if (current.includes(id)) {
        if (current.length === 1) return current;
        return current.filter((item) => item !== id);
      }
      return [...current, id];
    });
  }

  function selectAllCustomers() {
    setSelectedCustomerIds(customerOptions.map((item) => item.id));
  }

  function applyDateSelection() {
    if (!dateSelectionValid) return;
    setAppliedDateQuery(buildDateQuery(dateMode, {
      date: selectedDate,
      from: dateFrom,
      to: dateTo,
      month: selectedMonth,
      year: selectedYear,
    }));
  }

  return <div className="dx-page dx-lost-page">
    <Link href={`/settings/${machineId}/data`} className="dx-back-link">
      <FiArrowLeft size={16} aria-hidden />
      {periodLabels.back}
    </Link>

    <header className="dx-head dx-lost-page-head">
      <div className="dx-title-block">
        {machines.length > 1 ? (
          <div className="dx-switch" ref={switchRef}>
            <button
              type="button"
              className="dx-page-title dx-switch-trigger"
              aria-haspopup="menu"
              aria-expanded={switchOpen}
              aria-label={copy.switchMachine}
              onClick={() => setSwitchOpen((open) => !open)}
            >
              <span className="dx-switch-label">
                {selectedIds.length > 1
                  ? copy.selectedMachines(selectedIds.length)
                  : (machines.find((item) => item.id === selectedIds[0])?.name ?? machine?.name ?? "…")}
              </span>
              <FiChevronDown size={16} aria-hidden />
            </button>
            {switchOpen ? (
              <div className="menu dx-switch-menu" role="menu" aria-label={copy.switchMachine}>
                {machines.map((item) => {
                  const active = selectedIds.includes(item.id);
                  return (
                    <button
                      key={item.id}
                      type="button"
                      role="menuitemcheckbox"
                      aria-checked={active}
                      className={active ? "is-active" : undefined}
                      onClick={() => toggleMachine(item.id)}
                    >
                      <span>{item.name}</span>
                      {active ? <FiCheck size={14} aria-hidden /> : null}
                    </button>
                  );
                })}
              </div>
            ) : null}
          </div>
        ) : (
          <h1 className="dx-page-title">{machine?.name || "Lost Time"}</h1>
        )}

        {customerOptions.length > 1 ? (
          <div className="dx-switch dx-customer-pick" ref={customerRef}>
            <button
              type="button"
              className="dx-customer-trigger"
              aria-haspopup="menu"
              aria-expanded={customerOpen}
              aria-label={copy.switchCustomer}
              onClick={() => setCustomerOpen((open) => !open)}
            >
              <span className="dx-customer-trigger-label">{customerLabel}</span>
              <FiChevronDown size={15} aria-hidden />
            </button>
            {customerOpen ? (
              <div className="menu dx-switch-menu dx-customer-menu" role="menu" aria-label={copy.switchCustomer}>
                <button
                  type="button"
                  role="menuitem"
                  className={selectedCustomerIds.length === customerOptions.length ? "is-active" : undefined}
                  onClick={selectAllCustomers}
                >
                  <span>{copy.selectAllCustomers}</span>
                  {selectedCustomerIds.length === customerOptions.length ? <FiCheck size={14} aria-hidden /> : null}
                </button>
                {customerOptions.map((item) => {
                  const active = selectedCustomerIds.includes(item.id);
                  return (
                    <button
                      key={item.id}
                      type="button"
                      role="menuitemcheckbox"
                      aria-checked={active}
                      className={active ? "is-active" : undefined}
                      onClick={() => toggleCustomer(item.id)}
                    >
                      <span>
                        {item.name && item.name !== item.id ? `${item.name} (${item.id})` : item.id}
                      </span>
                      {active ? <FiCheck size={14} aria-hidden /> : null}
                    </button>
                  );
                })}
              </div>
            ) : null}
          </div>
        ) : customerOptions[0] ? (
          <p className="dx-customer-current">
            {customerOptions[0].name && customerOptions[0].name !== customerOptions[0].id
              ? customerOptions[0].name
              : customerOptions[0].id}
          </p>
        ) : null}
      </div>
    </header>

    <div className="dx-toolbar">
      <div className="dx-toolbar-end">
        <div className="dx-history-date">
          <span>{periodLabels.period}</span>
          <select value={dateMode} onChange={(event) => setDateMode(event.target.value as DateMode)}>
            <option value="day">{periodLabels.day}</option>
            <option value="range">{periodLabels.range}</option>
            <option value="month">{periodLabels.month}</option>
            <option value="year">{periodLabels.year}</option>
          </select>
          {dateMode === "day" ? (
            <input type="date" value={selectedDate} max={today} onChange={(event) => setSelectedDate(event.target.value || today)} />
          ) : null}
          {dateMode === "range" ? (
            <span className="dx-history-range">
              <input type="date" value={dateFrom} max={dateTo || today} onChange={(event) => setDateFrom(event.target.value)} />
              <span>–</span>
              <input type="date" value={dateTo} min={dateFrom} max={today} onChange={(event) => setDateTo(event.target.value)} />
            </span>
          ) : null}
          {dateMode === "month" ? (
            <input type="month" value={selectedMonth} max={today.slice(0, 7)} onChange={(event) => setSelectedMonth(event.target.value)} />
          ) : null}
          {dateMode === "year" ? (
            <input type="number" min="2000" max={today.slice(0, 4)} value={selectedYear} onChange={(event) => setSelectedYear(event.target.value)} />
          ) : null}
          {dateMode !== "day" || selectedDate !== today ? <small>{periodLabels.historical}</small> : null}
          <button type="button" className="btn btn-primary dx-history-apply" disabled={!dateSelectionValid} onClick={applyDateSelection}>
            {periodLabels.show}
          </button>
        </div>
      </div>
    </div>

    <LostTimeTable
      connectionIds={appliedIds}
      customerIds={appliedCustomerIds}
      dateQuery={appliedDateQuery}
      autoLoad
    />
  </div>;
}
