export type GptActionDateMode = "day" | "range" | "month" | "year";

export type GptActionPeriod = {
  mode: GptActionDateMode;
  timezone: "Asia/Bangkok";
  requestedDateFrom: string;
  requestedDateTo: string;
  dateFrom: string;
  dateTo: string;
  dateCount: number;
  futureDatesExcluded: boolean;
  granularity: "period-total";
};

export type GptActionPeriodResult =
  | { ok: true; period: GptActionPeriod; body: Record<string, string> }
  | { ok: false; error: string };

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const MONTH_PATTERN = /^\d{4}-\d{2}$/;
const YEAR_PATTERN = /^\d{4}$/;
const MAX_DATES = 366;

export function bangkokDateKey(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function validDate(value: string) {
  if (!DATE_PATTERN.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.valueOf()) && date.toISOString().slice(0, 10) === value;
}

function datesBetween(from: string, to: string) {
  const start = new Date(`${from}T00:00:00Z`);
  const end = new Date(`${to}T00:00:00Z`);
  if (start > end) return 0;
  return Math.floor((end.valueOf() - start.valueOf()) / 86_400_000) + 1;
}

function result(
  mode: GptActionDateMode,
  requestedDateFrom: string,
  requestedDateTo: string,
  today: string,
): GptActionPeriodResult {
  if (!validDate(requestedDateFrom) || !validDate(requestedDateTo) || requestedDateFrom > requestedDateTo) {
    return { ok: false, error: "Invalid date selection" };
  }
  if (requestedDateFrom > today) {
    return { ok: false, error: "The selected period starts in the future (Asia/Bangkok)" };
  }
  const dateTo = requestedDateTo > today ? today : requestedDateTo;
  const dateCount = datesBetween(requestedDateFrom, dateTo);
  if (dateCount < 1 || dateCount > MAX_DATES) {
    return { ok: false, error: `The selected period must contain 1-${MAX_DATES} business dates` };
  }
  const period: GptActionPeriod = {
    mode,
    timezone: "Asia/Bangkok",
    requestedDateFrom,
    requestedDateTo,
    dateFrom: requestedDateFrom,
    dateTo,
    dateCount,
    futureDatesExcluded: requestedDateTo > today,
    granularity: "period-total",
  };
  const body: Record<string, string> = dateCount === 1
    ? { mode: "day", date: requestedDateFrom }
    : { mode: "range", from: requestedDateFrom, to: dateTo };
  return { ok: true, period, body };
}

export function resolveGptActionPeriod(url: URL, today = bangkokDateKey()): GptActionPeriodResult {
  const suppliedMode = url.searchParams.get("mode")?.trim();
  const mode = (suppliedMode || "day") as GptActionDateMode;
  if (mode !== "day" && mode !== "range" && mode !== "month" && mode !== "year") {
    return { ok: false, error: "mode must be one of: day, range, month, year" };
  }

  if (mode === "day") {
    const date = url.searchParams.get("date")?.trim() || today;
    if (!validDate(date)) return { ok: false, error: "date must be a real date in YYYY-MM-DD format" };
    if (date > today) return { ok: false, error: "date cannot be in the future (Asia/Bangkok)" };
    return result(mode, date, date, today);
  }

  if (mode === "range") {
    const from = url.searchParams.get("from")?.trim() ?? "";
    const to = url.searchParams.get("to")?.trim() ?? "";
    if (!validDate(from) || !validDate(to)) {
      return { ok: false, error: "from and to are required real dates in YYYY-MM-DD format when mode=range" };
    }
    if (to > today) return { ok: false, error: "to cannot be in the future (Asia/Bangkok)" };
    return result(mode, from, to, today);
  }

  if (mode === "month") {
    const month = url.searchParams.get("month")?.trim() ?? "";
    if (!MONTH_PATTERN.test(month)) return { ok: false, error: "month is required in YYYY-MM format when mode=month" };
    const [yearValue, monthValue] = month.split("-").map(Number);
    if (yearValue < 2000 || monthValue < 1 || monthValue > 12) {
      return { ok: false, error: "month must be a real month from year 2000 onward" };
    }
    const lastDay = new Date(Date.UTC(yearValue, monthValue, 0)).getUTCDate();
    return result(mode, `${month}-01`, `${month}-${String(lastDay).padStart(2, "0")}`, today);
  }

  const year = url.searchParams.get("year")?.trim() ?? "";
  if (!YEAR_PATTERN.test(year) || Number(year) < 2000) {
    return { ok: false, error: "year is required in YYYY format from 2000 onward when mode=year" };
  }
  return result(mode, `${year}-01-01`, `${year}-12-31`, today);
}

export function periodWarnings(period: GptActionPeriod, coverageComplete = true) {
  const warnings: string[] = [];
  if (period.dateCount > 1) {
    warnings.push(
      `This response aggregates ${period.dateCount} business dates into period totals; it is not a daily time series. Do not infer day-by-day trends from it.`,
    );
  }
  if (period.futureDatesExcluded) {
    warnings.push(`Future dates after ${period.dateTo} were excluded using the Asia/Bangkok business date.`);
  }
  if (!coverageComplete) warnings.push("Some requested production lines were not returned; treat totals as incomplete.");
  return warnings;
}
