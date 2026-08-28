"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import {
  FiArrowLeft,
  FiCheck,
  FiChevronDown,
  FiColumns,
  FiCopy,
  FiClock,
  FiFilter,
  FiRefreshCw,
  FiSearch,
  FiX,
} from "react-icons/fi";
import { useLocale } from "../../locale-context";
import { DX_COPY, type DxCopy } from "./data-explorer-copy";
import { type Connection } from "./types";
import { DataAiChat } from "./data-ai-chat";

export type ExplorerRow = {
  uuid: string;
  machineId: string | null;
  machineName: string | null;
  customerId: string | null;
  customerName: string | null;
  productionGroupUuid: string | null;
  productionGroupName: string | null;
  productionLineName: string | null;
  statusUuid: string | null;
  statusName: string | null;
  statusBackgroundColor: string | null;
  statusTextColor: string | null;
  product: string | null;
  productUuid: string | null;
  bizTime: string | null;
  planNum: string | null;
  actualNum: string | null;
  currentCt: string | null;
  averageCt: string | null;
  baseCt: string | null;
  pcsPerHour: string | null;
  volumeRate: string | null;
  operationalAvailability: string | null;
  operatingTime: string | null;
  stopTime: string | null;
  raw: Record<string, unknown>;
};

type ColumnId =
  | "machineName"
  | "productionGroupName"
  | "productionLineName"
  | "product"
  | "planNum"
  | "actualNum"
  | "currentCt"
  | "averageCt"
  | "baseCt"
  | "pcsPerHour"
  | "volumeRate"
  | "operationalAvailability"
  | "operatingTime"
  | "stopTime"
  | "time"
  | "status"
  | "uuid";
type SortKey = ColumnId | null;
type SortDir = "asc" | "desc";
type CtFilter = "all" | "has" | "empty";
type DateMode = "day" | "range" | "month" | "year";

const ROW_H = 42;
const CARD_H = 88;
const OVERSCAN = 12;
const DEFAULT_COLS: ColumnId[] = [
  "machineName",
  "productionGroupName",
  "productionLineName",
  "product",
  "planNum",
  "actualNum",
  "currentCt",
  "averageCt",
  "baseCt",
  "pcsPerHour",
  "volumeRate",
  "operationalAvailability",
  "operatingTime",
  "stopTime",
  "time",
  "status",
  "uuid",
];
const INITIAL_COLS: ColumnId[] = [
  "productionGroupName",
  "productionLineName",
  "product",
  "planNum",
  "actualNum",
  "currentCt",
  "averageCt",
  "baseCt",
  "pcsPerHour",
];
const COL_PX: Record<ColumnId, number> = {
  machineName: 220,
  productionGroupName: 150,
  productionLineName: 220,
  product: 200,
  planNum: 100,
  actualNum: 100,
  currentCt: 110,
  averageCt: 110,
  baseCt: 100,
  pcsPerHour: 90,
  volumeRate: 112,
  operationalAvailability: 188,
  operatingTime: 132,
  stopTime: 112,
  time: 112,
  status: 168,
  uuid: 168,
};
const AUTO_MIN_SEC = 0.5;

function truncateId(value: string, head = 8, tail = 4) {
  if (value.length <= head + tail + 1) return value;
  return `${value.slice(0, head)}…${value.slice(-tail)}`;
}

function display(value: string | null | undefined, missing: string) {
  return value && value.trim() ? value : missing;
}

function isCtOver(row: ExplorerRow) {
  const avg = Number.parseFloat(row.currentCt ?? "");
  const base = Number.parseFloat(row.baseCt ?? "");
  return Number.isFinite(avg) && Number.isFinite(base) && avg > base;
}

function isPlanBehind(row: ExplorerRow) {
  const plan = Number.parseFloat(row.planNum ?? "");
  const actual = Number.parseFloat(row.actualNum ?? "");
  return Number.isFinite(plan) && Number.isFinite(actual) && actual < plan;
}

function useCompactViewport() {
  const [compact, setCompact] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 720px)");
    const sync = () => setCompact(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);
  return compact;
}

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

function rowKey(row: ExplorerRow) {
  return `${row.machineId ?? ""}:${row.customerId ?? ""}:${row.uuid}`;
}

function compareRows(a: ExplorerRow, b: ExplorerRow, key: ColumnId, dir: SortDir) {
  const pick = (row: ExplorerRow) => {
    if (key === "uuid") return row.uuid;
    if (key === "machineName") return row.machineName ?? "";
    if (key === "productionGroupName") return row.productionGroupName ?? "";
    if (key === "productionLineName") return row.productionLineName ?? "";
    if (key === "product") return row.product ?? "";
    if (key === "time") return row.bizTime ?? "";
    if (key === "status") return row.statusName ?? row.statusUuid ?? "";
    return row[key] ?? "";
  };
  const left = pick(a);
  const right = pick(b);
  if (!["uuid", "machineName", "productionGroupName", "productionLineName", "product", "time", "status"].includes(key)) {
    const ln = Number.parseFloat(left);
    const rn = Number.parseFloat(right);
    if (Number.isFinite(ln) || Number.isFinite(rn)) {
      const delta =
        (Number.isFinite(ln) ? ln : Number.NEGATIVE_INFINITY) -
        (Number.isFinite(rn) ? rn : Number.NEGATIVE_INFINITY);
      return dir === "asc" ? delta : -delta;
    }
  }
  const delta = left.localeCompare(right, undefined, { numeric: true, sensitivity: "base" });
  return dir === "asc" ? delta : -delta;
}

export function DataExplorer({ machineId }: { machineId: string }) {
  const { locale } = useLocale();
  const copy = DX_COPY[locale];
  const compact = useCompactViewport();
  const today = bangkokDateKey();

  const [machine, setMachine] = useState<Connection | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [machines, setMachines] = useState<Connection[]>([]);
  const [rows, setRows] = useState<ExplorerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [autoSeconds, setAutoSeconds] = useState<number | null>(null);
  const [autoInput, setAutoInput] = useState("");
  const [dateMode, setDateMode] = useState<DateMode>("day");
  const [selectedDate, setSelectedDate] = useState(today);
  const [dateFrom, setDateFrom] = useState(today);
  const [dateTo, setDateTo] = useState(today);
  const [selectedMonth, setSelectedMonth] = useState(today.slice(0, 7));
  const [selectedYear, setSelectedYear] = useState(today.slice(0, 4));
  const [appliedDateQuery, setAppliedDateQuery] = useState<Record<string, string>>({ mode: "day", date: today });
  const [switchOpen, setSwitchOpen] = useState(false);
  const [customerOpen, setCustomerOpen] = useState(false);
  const [selectedCustomerIds, setSelectedCustomerIds] = useState<string[]>([]);

  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [groupFilter, setGroupFilter] = useState("all");
  const [productFilter, setProductFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [ctFilter, setCtFilter] = useState<CtFilter>("all");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [columnsOpen, setColumnsOpen] = useState(false);
  const [visibleCols, setVisibleCols] = useState<ColumnId[]>(INITIAL_COLS);
  const [sortKey, setSortKey] = useState<SortKey>("productionGroupName");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [selected, setSelected] = useState<ExplorerRow | null>(null);
  const [detailTab, setDetailTab] = useState<"details" | "raw">("details");
  const [copied, setCopied] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([machineId]);
  const rowH = compact
    ? (selectedIds.length > 1 || selectedCustomerIds.length > 1 ? CARD_H + 18 : CARD_H)
    : ROW_H;

  const tableShellRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [viewportH, setViewportH] = useState(480);
  const toolsRef = useRef<HTMLDivElement>(null);
  const switchRef = useRef<HTMLDivElement>(null);
  const customerRef = useRef<HTMLDivElement>(null);
  const pullAbortRef = useRef<AbortController | null>(null);
  const pullVersionRef = useRef(0);
  const pullInFlightRef = useRef(false);
  const hasRowsRef = useRef(false);
  const selectedIdsRef = useRef(selectedIds);
  const selectedCustomerIdsRef = useRef(selectedCustomerIds);
  const machinesRef = useRef(machines);
  const dateQueryRef = useRef<Record<string, string>>({ mode: "day", date: selectedDate });
  const skipSelectFetch = useRef(true);
  const skipCustomerFetch = useRef(true);

  useEffect(() => {
    void fetch("/api/session", { cache: "no-store" })
      .then((response) => response.ok ? response.json() : null)
      .then((session) => setIsAdmin(session?.role === "admin"));
  }, []);

  useEffect(() => {
    selectedIdsRef.current = selectedIds;
    selectedCustomerIdsRef.current = selectedCustomerIds;
    machinesRef.current = machines;
  }, [selectedIds, selectedCustomerIds, machines]);

  const loadMachine = useCallback(async () => {
    const response = await fetch("/api/connections", { cache: "no-store" });
    const data = (await response.json()) as { connections?: Connection[] };
    const list = data.connections ?? [];
    setMachines(list);
    const found = list.find((item) => item.id === machineId) ?? null;
    setMachine(found);
    return found;
  }, [machineId]);

  const pullData = useCallback(
    async (opts?: { soft?: boolean }) => {
      const soft = opts?.soft ?? hasRowsRef.current;
      // A slow iXacs round must be allowed to finish. Starting another soft
      // refresh here used to abort every prior request when the interval was short.
      if (soft && pullInFlightRef.current) return;
      const version = ++pullVersionRef.current;
      if (!soft) pullAbortRef.current?.abort();
      const controller = new AbortController();
      pullAbortRef.current = controller;
      pullInFlightRef.current = true;
      if (soft) setRefreshing(true);
      else setLoading(true);

      const ids = selectedIdsRef.current.length > 0 ? selectedIdsRef.current : [machineId];
      const list = machinesRef.current;

      try {
        const customerIds = selectedCustomerIdsRef.current;
        const results = await Promise.all(
          ids.map(async (id) => {
            try {
              const targetMachine = list.find((item) => item.id === id);
              const machineCustomerIds = (targetMachine?.customers ?? [])
                .map((item) => item.id)
                .filter((customerId) => customerIds.includes(customerId));
              const body: Record<string, unknown> = { ...dateQueryRef.current };
              if (machineCustomerIds.length > 0) {
                body.customerIds = machineCustomerIds;
              } else if ((targetMachine?.customers?.length ?? 0) > 0 && customerIds.length > 0) {
                body.customerIds = customerIds;
              }
              const response = await fetch(`/api/connections/${id}/data`, {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify(body),
                signal: controller.signal,
              });
              const data = (await response.json()) as {
                ok?: boolean;
                error?: string | null;
                rows?: ExplorerRow[];
              };
              return { id, data };
            } catch (requestError) {
              if (requestError instanceof DOMException && requestError.name === "AbortError") {
                throw requestError;
              }
              return { id, data: { ok: false as const, error: copy.errorBody, rows: [] } };
            }
          }),
        );

        if (version !== pullVersionRef.current) return;

        const okResults = results.filter((item) => item.data.ok);
        if (okResults.length > 0) {
          const multiCustomer = customerIds.length > 1;
          const next = okResults.flatMap((item) => {
            const name = list.find((machine) => machine.id === item.id)?.name ?? item.id;
            return (item.data.rows ?? []).map((row) => {
              const customerName = row.customerName?.trim() || null;
              return {
                ...row,
                machineId: item.id,
                machineName: multiCustomer && customerName
                  ? (ids.length > 1 ? `${name} · ${customerName}` : customerName)
                  : name,
                customerId: row.customerId ?? null,
                customerName,
              };
            });
          });
          hasRowsRef.current = next.length > 0;
          setRows(next);
          setError(null);
          setSelected((current) => {
            if (!current) return null;
            return next.find((row) => rowKey(row) === rowKey(current)) ?? current;
          });
        } else {
          const failed = results[0]?.data;
          const message =
            failed?.error === "NEED_LINES" ? copy.needLines : failed?.error || copy.errorBody;
          setError(message);
          if (!soft) {
            hasRowsRef.current = false;
            setRows([]);
          }
        }

        if (!soft) await loadMachine();
      } catch (requestError) {
        if (requestError instanceof DOMException && requestError.name === "AbortError") return;
        if (version !== pullVersionRef.current) return;
        setError(copy.errorBody);
        if (!soft) {
          hasRowsRef.current = false;
          setRows([]);
        }
      } finally {
        if (version === pullVersionRef.current) {
          setLoading(false);
          setRefreshing(false);
          pullAbortRef.current = null;
        }
        if (pullAbortRef.current === null || pullAbortRef.current === controller) {
          pullInFlightRef.current = false;
        }
      }
    },
    [machineId, copy.needLines, copy.errorBody, loadMachine],
  );

  const pullDataRef = useRef(pullData);
  const loadMachineRef = useRef(loadMachine);

  useEffect(() => {
    pullDataRef.current = pullData;
    loadMachineRef.current = loadMachine;
  }, [pullData, loadMachine]);

  useEffect(() => {
    let cancelled = false;
    hasRowsRef.current = false;
    skipSelectFetch.current = true;
    skipCustomerFetch.current = true;
    setSelectedIds([machineId]);
    setSelectedCustomerIds([]);
    selectedCustomerIdsRef.current = [];
    setRows([]);
    setSelected(null);
    setError(null);
    setLoading(true);
    setAutoSeconds(null);
    setAutoInput("");
    setDateMode("day");
    setSelectedDate(today);
    setDateFrom(today);
    setDateTo(today);
    setSelectedMonth(today.slice(0, 7));
    setSelectedYear(today.slice(0, 4));
    dateQueryRef.current = { mode: "day", date: today };
    setAppliedDateQuery({ mode: "day", date: today });

    void (async () => {
      const found = await loadMachineRef.current();
      if (cancelled) return;
      if (!found) {
        setLoading(false);
        setError(copy.notFound);
        skipSelectFetch.current = false;
        skipCustomerFetch.current = false;
        return;
      }
      const initialCustomers =
        (found.customers?.length ?? 0) > 0
          ? found.customers!.map((item) => item.id)
          : found.customerId
            ? [found.customerId]
            : [];
      skipCustomerFetch.current = true;
      selectedCustomerIdsRef.current = initialCustomers;
      setSelectedCustomerIds(initialCustomers);
      await pullDataRef.current({ soft: false });
      skipSelectFetch.current = false;
      skipCustomerFetch.current = false;
    })();

    return () => {
      cancelled = true;
      pullAbortRef.current?.abort();
    };
  }, [machineId, copy.notFound, today]);

  useEffect(() => {
    if (autoSeconds == null || dateMode !== "day" || selectedDate !== today) return;
    const ms = Math.max(AUTO_MIN_SEC * 1000, Math.round(autoSeconds * 1000));
    const timer = window.setInterval(() => {
      void pullDataRef.current({ soft: true });
    }, ms);
    return () => window.clearInterval(timer);
  }, [autoSeconds, dateMode, selectedDate, today]);

  const selectedKey = selectedIds.slice().sort().join(",");
  useEffect(() => {
    if (skipSelectFetch.current) {
      skipSelectFetch.current = false;
      return;
    }
    pullAbortRef.current?.abort();
    // Let rapid checkbox changes settle, then fetch only the latest selection.
    const timer = window.setTimeout(() => {
      void pullDataRef.current({ soft: hasRowsRef.current });
    }, 180);
    return () => window.clearTimeout(timer);
  }, [selectedKey]);

  const selectedCustomerKey = selectedCustomerIds.slice().sort().join(",");
  useEffect(() => {
    if (skipCustomerFetch.current) {
      skipCustomerFetch.current = false;
      return;
    }
    if (selectedCustomerIds.length === 0) return;
    pullAbortRef.current?.abort();
    setLoading(true);
    setRefreshing(false);
    setRows([]);
    hasRowsRef.current = false;
    const timer = window.setTimeout(() => {
      dateQueryRef.current = { ...dateQueryRef.current, fresh: "1" };
      void pullDataRef.current({ soft: false }).finally(() => {
        const { fresh: _fresh, ...rest } = dateQueryRef.current;
        dateQueryRef.current = rest;
      });
    }, 180);
    return () => window.clearTimeout(timer);
  }, [selectedCustomerKey, selectedCustomerIds.length]);

  const dateSelectionValid = dateMode === "range"
    ? Boolean(dateFrom && dateTo && dateFrom <= dateTo && dateTo <= today)
    : dateMode === "month"
      ? Boolean(selectedMonth && selectedMonth <= today.slice(0, 7))
      : dateMode === "year"
        ? /^\d{4}$/.test(selectedYear) && selectedYear <= today.slice(0, 4)
        : Boolean(selectedDate && selectedDate <= today);

  function applyDateSelection() {
    if (!dateSelectionValid) return;
    const nextQuery: Record<string, string> = dateMode === "range"
      ? { mode: dateMode, from: dateFrom, to: dateTo }
      : dateMode === "month"
        ? { mode: dateMode, month: selectedMonth }
        : dateMode === "year"
          ? { mode: dateMode, year: selectedYear }
          : { mode: dateMode, date: selectedDate };
    dateQueryRef.current = nextQuery;
    setAppliedDateQuery(nextQuery);
    setAutoSeconds(null);
    setAutoInput("");
    hasRowsRef.current = false;
    setRows([]);
    setSelected(null);
    setError(null);
    void pullData({ soft: false });
  }

  useEffect(() => {
    const timer = window.setTimeout(() => setSearch(searchInput.trim().toLowerCase()), 250);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    function onPointer(event: MouseEvent) {
      if (!toolsRef.current?.contains(event.target as Node)) {
        setFiltersOpen(false);
        setColumnsOpen(false);
      }
      if (!switchRef.current?.contains(event.target as Node)) {
        setSwitchOpen(false);
      }
      if (!customerRef.current?.contains(event.target as Node)) {
        setCustomerOpen(false);
      }
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

  useEffect(() => {
    const el = tableShellRef.current;
    if (!el) return;
    const update = () => {
      const head = el.querySelector(".dx-table-head") as HTMLElement | null;
      const headH = compact ? 0 : (head?.offsetHeight ?? 0);
      setViewportH(Math.max(0, el.clientHeight - headH));
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, [loading, error, rows.length, compact, visibleCols, selectedIds.length]);

  useEffect(() => {
    setScrollTop(0);
    if (tableShellRef.current) {
      tableShellRef.current.scrollTop = 0;
      tableShellRef.current.scrollLeft = 0;
    }
  }, [search, groupFilter, productFilter, statusFilter, ctFilter, sortKey, sortDir, machineId, selectedKey]);

  const productionGroups = useMemo(() => {
    return [
      ...new Set(
        rows
          .map((row) => row.productionGroupName)
          .filter((value): value is string => Boolean(value)),
      ),
    ].sort();
  }, [rows]);

  const products = useMemo(() => {
    return [...new Set(rows.map((row) => row.product).filter((v): v is string => Boolean(v)))].sort();
  }, [rows]);

  const statuses = useMemo(() => {
    const values = new Map<string, string>();
    for (const row of rows) {
      if (row.statusUuid) values.set(row.statusUuid, row.statusName || row.statusUuid);
    }
    return [...values].map(([uuid, name]) => ({ uuid, name })).sort((a, b) =>
      a.name.localeCompare(b.name),
    );
  }, [rows]);

  const selectedStatusName =
    statuses.find((status) => status.uuid === statusFilter)?.name ?? statusFilter;

  const filtered = useMemo(() => {
    let next = rows;
    if (search) {
      next = next.filter((row) => {
        const hay = [
          row.uuid,
          row.machineName,
          row.productionGroupName,
          row.productionLineName,
          row.product,
          row.statusUuid,
          row.statusName,
          row.bizTime,
          row.productUuid,
          row.planNum,
          row.actualNum,
          row.currentCt,
          row.averageCt,
          row.baseCt,
          row.pcsPerHour,
          row.volumeRate,
          row.operationalAvailability,
          row.operatingTime,
          row.stopTime,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return hay.includes(search);
      });
    }
    if (groupFilter !== "all") {
      next = next.filter((row) => row.productionGroupName === groupFilter);
    }
    if (productFilter !== "all") next = next.filter((row) => row.product === productFilter);
    if (statusFilter !== "all") next = next.filter((row) => row.statusUuid === statusFilter);
    if (ctFilter === "has") next = next.filter((row) => row.currentCt != null && row.currentCt !== "-");
    if (ctFilter === "empty") next = next.filter((row) => row.currentCt == null || row.currentCt === "-");
    if (sortKey) {
      next = [...next].sort((a, b) => compareRows(a, b, sortKey, sortDir));
    }
    return next;
  }, [rows, search, groupFilter, productFilter, statusFilter, ctFilter, sortKey, sortDir]);

  const activeFilterCount =
    (groupFilter !== "all" ? 1 : 0) +
    (productFilter !== "all" ? 1 : 0) +
    (statusFilter !== "all" ? 1 : 0) +
    (ctFilter !== "all" ? 1 : 0);

  const showCompanyCol = selectedIds.length > 1 || selectedCustomerIds.length > 1;
  const tableCols = useMemo(() => {
    if (showCompanyCol) {
      return visibleCols.includes("machineName")
        ? visibleCols
        : (["machineName", ...visibleCols] as ColumnId[]);
    }
    return visibleCols.filter((id) => id !== "machineName");
  }, [visibleCols, showCompanyCol]);

  const tableMinWidth = useMemo(
    () => tableCols.reduce((sum, id) => sum + COL_PX[id], 0),
    [tableCols],
  );

  const tableVars = {
    "--dx-table-min": `${tableMinWidth}px`,
    "--dx-cols": tableCols.map((id) => `minmax(${COL_PX[id]}px, 1fr)`).join(" "),
  } as CSSProperties;

  const totalH = filtered.length * rowH;
  const start = Math.max(0, Math.floor(scrollTop / rowH) - OVERSCAN);
  const end = Math.min(filtered.length, Math.ceil((scrollTop + viewportH) / rowH) + OVERSCAN);
  const visible = filtered.slice(start, end);

  function toggleSort(key: ColumnId) {
    if (sortKey !== key) {
      setSortKey(key);
      setSortDir(
        key === "time" ||
          ![
            "uuid",
            "machineName",
            "productionGroupName",
            "productionLineName",
            "product",
            "status",
          ].includes(key)
          ? "desc"
          : "asc",
      );
      return;
    }
    if (sortDir === "asc") setSortDir("desc");
    else if (sortDir === "desc") setSortKey(null);
    else setSortDir("asc");
  }

  function toggleCol(id: ColumnId) {
    setVisibleCols((current) => {
      if (current.includes(id)) {
        if (current.length === 1) return current;
        return current.filter((item) => item !== id);
      }
      return DEFAULT_COLS.filter((col) => current.includes(col) || col === id);
    });
  }

  function clearFilters() {
    setGroupFilter("all");
    setProductFilter("all");
    setStatusFilter("all");
    setCtFilter("all");
  }

  function toggleMachine(id: string) {
    setSelectedIds((current) => {
      if (current.includes(id)) {
        if (current.length === 1) return current;
        return current.filter((item) => item !== id);
      }
      return [...current, id];
    });
  }

  const customerOptions = useMemo(() => {
    const list = machine?.customers ?? [];
    if (list.length > 0) return list;
    if (machine?.customerId) {
      return [{ id: machine.customerId, name: machine.customerId }];
    }
    return [];
  }, [machine]);

  const customerLabel = useMemo(() => {
    if (selectedCustomerIds.length === 0) return copy.switchCustomer;
    if (selectedCustomerIds.length === customerOptions.length && customerOptions.length > 1) {
      return copy.allCustomers;
    }
    if (selectedCustomerIds.length > 1) return copy.selectedCustomers(selectedCustomerIds.length);
    const one = customerOptions.find((item) => item.id === selectedCustomerIds[0]);
    return one?.name && one.name !== one.id ? one.name : (one?.id ?? copy.switchCustomer);
  }, [selectedCustomerIds, customerOptions, copy]);

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

  function openRow(row: ExplorerRow) {
    setSelected(row);
    setDetailTab("details");
  }

  async function copyText(id: string, value: string) {
    await navigator.clipboard.writeText(value);
    setCopied(id);
    window.setTimeout(() => setCopied((current) => (current === id ? null : current)), 1400);
  }

  if (!loading && !machine) {
    return (
      <div className="dx-page">
        <div className="dx-empty is-page">
          <h2 className="dx-error-title">{copy.notFound}</h2>
          <Link href="/settings" className="btn btn-secondary">
            {copy.crumbMachines}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="dx-page">
      <Link href="/settings" className="dx-back-link">
        <FiArrowLeft size={16} aria-hidden />
        {copy.crumbMachines}
      </Link>

      <header className="dx-head">
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
                    : (machines.find((item) => item.id === selectedIds[0])?.name ??
                      machine?.name ??
                      "…")}
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
          ) : machine ? (
            <h1 className="dx-page-title">{machine.name}</h1>
          ) : (
            <span className="dx-title-skel skeleton" aria-hidden />
          )}
          {customerOptions.length > 1 ? (
            <div className="dx-switch dx-customer-pick" ref={customerRef}>
              <button
                type="button"
                className="dx-customer-trigger"
                aria-haspopup="menu"
                aria-expanded={customerOpen}
                aria-label={copy.switchCustomer}
                disabled={loading}
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
          ) : customerOptions[0] && customerOptions[0].name !== customerOptions[0].id ? (
            <p className="dx-customer-current">{customerOptions[0].name}</p>
          ) : null}
        </div>
      </header>

      <div className="dx-toolbar" ref={toolsRef}>
        <label className="dx-search">
          <FiSearch size={15} aria-hidden />
          <input
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            placeholder={copy.searchPlaceholder}
          />
          {searchInput ? (
            <button
              type="button"
              className="dx-search-clear"
              aria-label={copy.clearFilters}
              onClick={() => setSearchInput("")}
            >
              <FiX size={14} />
            </button>
          ) : null}
        </label>

        <div className="dx-toolbar-actions">
          <div className="dx-menu-wrap">
            <button
              type="button"
              className={`btn btn-secondary dx-tool ${activeFilterCount > 0 ? "is-active" : ""}`}
              title={copy.filters}
              aria-label={copy.filters}
              aria-expanded={filtersOpen}
              onClick={() => {
                setFiltersOpen((v) => !v);
                setColumnsOpen(false);
              }}
            >
              <FiFilter size={16} />
              {activeFilterCount > 0 ? <span className="dx-tool-count">{activeFilterCount}</span> : null}
            </button>
            {filtersOpen ? (
              <div className="dx-popover">
                <label className="dx-field">
                  <span>{copy.filterGroup}</span>
                  <select value={groupFilter} onChange={(e) => setGroupFilter(e.target.value)}>
                    <option value="all">{copy.allGroups}</option>
                    {productionGroups.map((item) => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="dx-field">
                  <span>{copy.filterProduct}</span>
                  <select value={productFilter} onChange={(e) => setProductFilter(e.target.value)}>
                    <option value="all">{copy.allProducts}</option>
                    {products.map((item) => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="dx-field">
                  <span>{copy.filterStatus}</span>
                  <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                    <option value="all">{copy.allStatuses}</option>
                    {statuses.map((item) => (
                      <option key={item.uuid} value={item.uuid}>
                        {item.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="dx-field">
                  <span>{copy.filterCt}</span>
                  <select
                    value={ctFilter}
                    onChange={(e) => setCtFilter(e.target.value as CtFilter)}
                  >
                    <option value="all">{copy.ctAll}</option>
                    <option value="has">{copy.ctHas}</option>
                    <option value="empty">{copy.ctEmpty}</option>
                  </select>
                </label>
                {activeFilterCount > 0 ? (
                  <button type="button" className="btn btn-ghost" onClick={clearFilters}>
                    {copy.clearFilters}
                  </button>
                ) : null}
              </div>
            ) : null}
          </div>

          <div className="dx-menu-wrap">
            <button
              type="button"
              className="btn btn-secondary dx-tool"
              title={copy.columns}
              aria-label={copy.columns}
              aria-expanded={columnsOpen}
              onClick={() => {
                setColumnsOpen((v) => !v);
                setFiltersOpen(false);
              }}
            >
              <FiColumns size={16} />
            </button>
            {columnsOpen ? (
              <div className="dx-popover dx-popover-cols">
                {(showCompanyCol ? DEFAULT_COLS : DEFAULT_COLS.filter((id) => id !== "machineName")).map(
                  (id) => {
                  const on = tableCols.includes(id);
                  return (
                    <label key={id} className={`dx-check ${on ? "is-on" : ""}`}>
                      <input
                        type="checkbox"
                        checked={on}
                        onChange={() => toggleCol(id)}
                      />
                      <FiCheck size={14} aria-hidden />
                      {columnLabel(id, copy)}
                    </label>
                  );
                })}
              </div>
            ) : null}
          </div>

          <Link
            href={{
              pathname: `/settings/${machineId}/data/lost-time`,
              query: {
                companies: selectedIds.join(","),
                ...(selectedCustomerIds.length > 0
                  ? { customers: selectedCustomerIds.join(",") }
                  : {}),
                ...appliedDateQuery,
              },
            }}
            className="btn btn-secondary dx-lost-time-link"
          >
            <FiClock size={15} aria-hidden />
            Lost Time
          </Link>
        </div>

        <div className="dx-toolbar-end">
          <div className="dx-history-date">
            <span>{locale === "th" ? "ช่วงข้อมูล" : locale === "ja" ? "データ期間" : "Data period"}</span>
            <select
              value={dateMode}
              onChange={(event) => {
                const mode = event.target.value as DateMode;
                setDateMode(mode);
                if (mode !== "day" || selectedDate !== today) {
                  setAutoSeconds(null);
                  setAutoInput("");
                }
              }}
            >
              <option value="day">{locale === "th" ? "รายวัน" : locale === "ja" ? "日" : "Day"}</option>
              <option value="range">{locale === "th" ? "ช่วงวันที่" : locale === "ja" ? "期間" : "Date range"}</option>
              <option value="month">{locale === "th" ? "รายเดือน" : locale === "ja" ? "月" : "Month"}</option>
              <option value="year">{locale === "th" ? "รายปี" : locale === "ja" ? "年" : "Year"}</option>
            </select>
            {dateMode === "day" ? (
              <input
                type="date"
                value={selectedDate}
                max={today}
                onChange={(event) => {
                  const next = event.target.value || today;
                  setSelectedDate(next);
                  if (next !== today) {
                    setAutoSeconds(null);
                    setAutoInput("");
                  }
                }}
              />
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
            <button
              type="button"
              className="btn btn-primary dx-history-apply"
              disabled={!dateSelectionValid || loading}
              onClick={applyDateSelection}
            >
              {locale === "th" ? "แสดงข้อมูล" : locale === "ja" ? "表示" : "Show data"}
            </button>
          </div>
          <label className={`dx-auto ${autoSeconds != null ? "is-on" : ""}`}>
            <span className="dx-auto-label">{copy.autoRefresh}</span>
            <input
              className="dx-auto-input"
              type="number"
              inputMode="decimal"
              min={AUTO_MIN_SEC}
              step={0.5}
              disabled={dateMode !== "day" || selectedDate !== today}
              placeholder={copy.autoOff}
              value={autoInput}
              aria-label={copy.autoSec}
              onChange={(event) => setAutoInput(event.target.value)}
              onBlur={() => {
                const trimmed = autoInput.trim();
                if (!trimmed) {
                  setAutoSeconds(null);
                  setAutoInput("");
                  return;
                }
                const parsed = Number.parseFloat(trimmed);
                if (!Number.isFinite(parsed) || parsed <= 0) {
                  setAutoSeconds(null);
                  setAutoInput("");
                  return;
                }
                const next = Math.max(AUTO_MIN_SEC, parsed);
                setAutoSeconds(next);
                setAutoInput(String(next));
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  (event.target as HTMLInputElement).blur();
                }
              }}
            />
            {autoSeconds != null ? <span className="dx-auto-unit">{copy.autoUnit}</span> : null}
          </label>
          <button
            type="button"
            className="btn btn-secondary dx-tool dx-refresh"
            title={copy.refreshHint}
            aria-label={copy.refreshHint}
            onClick={() => void pullData({ soft: true })}
          >
            <FiRefreshCw size={16} className={refreshing ? "dx-spin" : undefined} />
          </button>
        </div>
      </div>

      {activeFilterCount > 0 ? (
        <div className="dx-chips">
          {groupFilter !== "all" ? (
            <button type="button" className="dx-chip" onClick={() => setGroupFilter("all")}>
              {copy.filterGroup}: {groupFilter} <FiX size={12} />
            </button>
          ) : null}
          {productFilter !== "all" ? (
            <button type="button" className="dx-chip" onClick={() => setProductFilter("all")}>
              {copy.filterProduct}: {productFilter} <FiX size={12} />
            </button>
          ) : null}
          {statusFilter !== "all" ? (
            <button type="button" className="dx-chip" onClick={() => setStatusFilter("all")}>
              {copy.filterStatus}: {selectedStatusName} <FiX size={12} />
            </button>
          ) : null}
          {ctFilter !== "all" ? (
            <button type="button" className="dx-chip" onClick={() => setCtFilter("all")}>
              {copy.filterCt}: {ctFilter === "has" ? copy.ctHas : copy.ctEmpty} <FiX size={12} />
            </button>
          ) : null}
          <button type="button" className="dx-chip is-clear" onClick={clearFilters}>
            {copy.clearFilters}
          </button>
        </div>
      ) : null}

      <section className="dx-workspace" aria-busy={loading}>
        {loading ? (
          <div
            className={`dx-table-shell is-loading ${compact ? "is-compact" : ""}`}
            aria-label={copy.loading}
          >
            <div className="dx-table-inner" style={tableVars}>
              {compact ? null : (
                <div className="dx-table-head">
                  {tableCols.map((id) => (
                    <span key={id} className={`dx-th is-${id}`}>
                      {columnLabel(id, copy)}
                    </span>
                  ))}
                </div>
              )}
              <div className="dx-skeleton">
                {Array.from({ length: compact ? 6 : 12 }, (_, i) => (
                  <div
                    key={i}
                    className={compact ? "dx-skeleton-card" : "dx-skeleton-row"}
                  >
                    {compact ? (
                      <>
                        <span className="skeleton" />
                        <span className="skeleton" />
                        <span className="skeleton" />
                      </>
                    ) : (
                      tableCols.map((id) => <span key={id} className="skeleton" />)
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : error && rows.length === 0 ? (
          <div className="dx-empty">
            <h2 className="dx-error-title">{copy.errorTitle}</h2>
            <p>{error}</p>
            <button type="button" className="btn btn-primary" onClick={() => void pullData()}>
              {copy.tryAgain}
            </button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="dx-empty">
            <h2>{copy.emptyTitle}</h2>
            <p>{copy.emptyBody}</p>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => void pullData({ soft: true })}
            >
              {copy.refresh}
            </button>
          </div>
        ) : (
          <div
            ref={tableShellRef}
            className={`dx-table-shell ${compact ? "is-compact" : ""}`}
            onScroll={(event) => setScrollTop(event.currentTarget.scrollTop)}
          >
            <div className="dx-table-inner" style={tableVars}>
              {compact ? null : (
                <div className="dx-table-head" role="row">
                  {tableCols.map((id) => (
                    <button
                      key={id}
                      type="button"
                      className={`dx-th is-${id}`}
                      aria-sort={
                        sortKey === id ? (sortDir === "asc" ? "ascending" : "descending") : "none"
                      }
                      onClick={() => toggleSort(id)}
                    >
                      {columnLabel(id, copy)}
                      {sortKey === id ? (
                        <span className="dx-sort" aria-hidden>
                          {sortDir === "asc" ? "↑" : "↓"}
                        </span>
                      ) : null}
                    </button>
                  ))}
                </div>
              )}
              <div className="dx-viewport">
                <div className="dx-spacer" style={{ height: totalH }}>
                  <div
                    className="dx-window"
                    style={{ transform: `translateY(${start * rowH}px)` }}
                  >
                    {visible.map((row) =>
                      compact ? (
                        <button
                          key={rowKey(row)}
                          type="button"
                          className={`dx-card ${selected && rowKey(selected) === rowKey(row) ? "is-selected" : ""}`}
                          style={{ height: rowH }}
                          onClick={() => openRow(row)}
                        >
                          {showCompanyCol ? (
                            <span className="dx-card-company">
                              {display(row.machineName, copy.missing)}
                            </span>
                          ) : null}
                          <span className="dx-card-line">
                            {display(row.productionLineName, copy.missing)}
                          </span>
                          <span className="dx-card-product">
                            {display(row.product, copy.missing)}
                          </span>
                          <span className="dx-card-metrics">
                            <span>
                              {copy.planNum} {display(row.planNum, copy.missing)}
                            </span>
                            <span className={isPlanBehind(row) ? "is-diff" : undefined}>
                              {copy.actualNum} {display(row.actualNum, copy.missing)}
                            </span>
                            <span className={isCtOver(row) ? "is-over" : undefined}>
                              {copy.currentCt} {display(row.currentCt, copy.missing)}
                            </span>
                          </span>
                        </button>
                      ) : (
                        <button
                          key={rowKey(row)}
                          type="button"
                          className={`dx-row ${selected && rowKey(selected) === rowKey(row) ? "is-selected" : ""}`}
                          style={{ height: rowH }}
                          onClick={() => openRow(row)}
                        >
                          {tableCols.map((id) => (
                            <span
                              key={id}
                              className={`dx-td is-${id}${id === "currentCt" && isCtOver(row) ? " is-over" : ""}${id === "actualNum" && isPlanBehind(row) ? " is-diff" : ""}`}
                              title={cellTitle(row, id)}
                            >
                              {renderCell(row, id, copy)}
                            </span>
                          ))}
                        </button>
                      ),
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </section>

      {selected ? (
        <RecordDetail
          row={selected}
          copy={copy}
          tab={detailTab}
          copied={copied}
          onTab={setDetailTab}
          onCopy={copyText}
          onClose={() => setSelected(null)}
        />
      ) : null}
      {isAdmin ? (
        <DataAiChat connectionIds={selectedIds} dateQuery={appliedDateQuery} />
      ) : null}
    </div>
  );
}

function columnLabel(id: ColumnId, copy: DxCopy) {
  if (id === "machineName") return copy.company;
  if (id === "uuid") return copy.uuid;
  if (id === "productionGroupName") return copy.productionGroup;
  if (id === "productionLineName") return copy.productionLine;
  if (id === "product") return copy.product;
  if (id === "planNum") return copy.planNum;
  if (id === "actualNum") return copy.actualNum;
  if (id === "currentCt") return copy.currentCt;
  if (id === "averageCt") return copy.averageCt;
  if (id === "baseCt") return copy.baseCt;
  if (id === "pcsPerHour") return copy.pcsPerHour;
  if (id === "volumeRate") return copy.volumeRate;
  if (id === "operationalAvailability") return copy.operationalAvailability;
  if (id === "operatingTime") return copy.operatingTime;
  if (id === "stopTime") return copy.stopTime;
  if (id === "time") return copy.time;
  return copy.status;
}

function cellTitle(row: ExplorerRow, id: ColumnId) {
  if (id === "machineName") return row.machineName ?? "";
  if (id === "uuid") return row.uuid;
  if (id === "productionGroupName") return row.productionGroupName ?? "";
  if (id === "productionLineName") return row.productionLineName ?? "";
  if (id === "product") return row.product ?? "";
  if (id === "time") return row.bizTime ?? "";
  if (id === "status") return row.statusName ?? row.statusUuid ?? "";
  return row[id] ?? "";
}

function renderCell(row: ExplorerRow, id: ColumnId, copy: DxCopy): ReactNode {
  if (id === "machineName") return display(row.machineName, copy.missing);
  if (id === "uuid") return truncateId(row.uuid);
  if (id === "productionGroupName") return display(row.productionGroupName, copy.missing);
  if (id === "productionLineName") return display(row.productionLineName, copy.missing);
  if (id === "product") return display(row.product, copy.missing);
  if (id === "time") return display(row.bizTime, copy.missing);
  if (id === "status") {
    if (!row.statusUuid) return copy.missing;
    return (
      <span
        className="dx-status-pill"
        style={{
          backgroundColor: row.statusBackgroundColor ?? undefined,
          color: row.statusTextColor ?? undefined,
        }}
      >
        {row.statusName || truncateId(row.statusUuid)}
      </span>
    );
  }
  return display(row[id], copy.missing);
}

function RecordDetail({
  row,
  copy,
  tab,
  copied,
  onTab,
  onCopy,
  onClose,
}: {
  row: ExplorerRow;
  copy: DxCopy;
  tab: "details" | "raw";
  copied: string | null;
  onTab: (tab: "details" | "raw") => void;
  onCopy: (id: string, value: string) => void;
  onClose: () => void;
}) {
  const json = JSON.stringify(row.raw, null, 2);
  const title =
    row.productionLineName?.trim() || row.product?.trim() || truncateId(row.uuid);
  const fields: { label: string; value: string | null }[] = [
    { label: copy.company, value: row.machineName },
    { label: copy.productionGroup, value: row.productionGroupName },
    { label: copy.productionLine, value: row.productionLineName },
    { label: copy.product, value: row.product },
    { label: copy.planNum, value: row.planNum },
    { label: copy.actualNum, value: row.actualNum },
    { label: copy.currentCt, value: row.currentCt },
    { label: copy.averageCt, value: row.averageCt },
    { label: copy.baseCt, value: row.baseCt },
    { label: copy.pcsPerHour, value: row.pcsPerHour },
    { label: copy.volumeRate, value: row.volumeRate },
    { label: copy.operationalAvailability, value: row.operationalAvailability },
    { label: copy.operatingTime, value: row.operatingTime },
    { label: copy.stopTime, value: row.stopTime },
    { label: copy.time, value: row.bizTime },
    { label: copy.status, value: row.statusName },
    { label: copy.statusUuid, value: row.statusUuid },
    { label: copy.uuid, value: row.uuid },
    { label: copy.productUuid, value: row.productUuid },
    { label: copy.productionGroupUuid, value: row.productionGroupUuid },
  ];

  return (
    <div className="dx-detail-backdrop" onClick={onClose} role="presentation">
      <aside
        className="dx-detail"
        role="dialog"
        aria-modal="true"
        aria-label={copy.details}
        onClick={(event) => event.stopPropagation()}
      >
        <header className="dx-detail-head">
          <div>
            <p className="dx-detail-kicker">{copy.details}</p>
            <h2>{title}</h2>
          </div>
          <button type="button" className="btn-icon" aria-label={copy.close} onClick={onClose}>
            <FiX size={18} />
          </button>
        </header>
        <div className="dx-detail-tabs">
          <button
            type="button"
            className={tab === "details" ? "is-active" : ""}
            onClick={() => onTab("details")}
          >
            {copy.details}
          </button>
          <button
            type="button"
            className={tab === "raw" ? "is-active" : ""}
            onClick={() => onTab("raw")}
          >
            {copy.rawJson}
          </button>
        </div>
        {tab === "details" ? (
          <dl className="dx-detail-list">
            {fields.map((field) => (
              <div key={field.label} className="dx-detail-row">
                <dt>{field.label}</dt>
                <dd>
                  <span>{display(field.value, copy.missing)}</span>
                  {field.value ? (
                    <button
                      type="button"
                      className="btn-icon"
                      aria-label={copied === field.label ? copy.copied : copy.copyValue}
                      onClick={() => void onCopy(field.label, field.value!)}
                    >
                      {copied === field.label ? <FiCheck size={14} /> : <FiCopy size={14} />}
                    </button>
                  ) : null}
                </dd>
              </div>
            ))}
          </dl>
        ) : (
          <pre className="dx-raw">{json}</pre>
        )}
        <footer className="dx-detail-foot">
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => void onCopy("json", json)}
          >
            {copied === "json" ? <FiCheck size={14} /> : <FiCopy size={14} />}
            {copied === "json" ? copy.copied : copy.copyJson}
          </button>
        </footer>
      </aside>
    </div>
  );
}
