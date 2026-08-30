export type ProductionAiHistoryItem = { role: "user" | "assistant"; text: string };
export type ProductionAiDateQuery = {
  mode?: string;
  date?: string;
  from?: string;
  to?: string;
  month?: string;
  year?: string;
};

const THAI_MONTH_PATTERN = "มกราคม|ม\\.?ค\\.?|กุมภาพันธ์|ก\\.?พ\\.?|มีนาคม|มี\\.?ค\\.?|เมษายน|เม\\.?ย\\.?|พฤษภาคม|พ\\.?ค\\.?|มิถุนายน|มิ\\.?ย\\.?|กรกฎาคม|ก\\.?ค\\.?|สิงหาคม|ส\\.?ค\\.?|กันยายน|ก\\.?ย\\.?|ตุลาคม|ต\\.?ค\\.?|พฤศจิกายน|พ\\.?ย\\.?|ธันวาคม|ธ\\.?ค\\.?";
const ENGLISH_MONTH_PATTERN = "January|Jan|February|Feb|March|Mar|April|Apr|May|June|Jun|July|Jul|August|Aug|September|Sept?|October|Oct|November|Nov|December|Dec";

const THAI_MONTHS: Record<string, number> = {
  มกราคม: 1, มค: 1,
  กุมภาพันธ์: 2, กพ: 2,
  มีนาคม: 3, มีค: 3,
  เมษายน: 4, เมย: 4,
  พฤษภาคม: 5, พค: 5,
  มิถุนายน: 6, มิย: 6,
  กรกฎาคม: 7, กค: 7,
  สิงหาคม: 8, สค: 8,
  กันยายน: 9, กย: 9,
  ตุลาคม: 10, ตค: 10,
  พฤศจิกายน: 11, พย: 11,
  ธันวาคม: 12, ธค: 12,
};

const ENGLISH_MONTHS: Record<string, number> = {
  january: 1, jan: 1,
  february: 2, feb: 2,
  march: 3, mar: 3,
  april: 4, apr: 4,
  may: 5,
  june: 6, jun: 6,
  july: 7, jul: 7,
  august: 8, aug: 8,
  september: 9, sep: 9, sept: 9,
  october: 10, oct: 10,
  november: 11, nov: 11,
  december: 12, dec: 12,
};

const THAI_DIGIT = "๐๑๒๓๔๕๖๗๘๙";

export function todayBangkok() {
  const parts = new Intl.DateTimeFormat("en", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${value.year}-${value.month}-${value.day}`;
}

export function normalizeQuestion(value: string) {
  return value
    .normalize("NFKC")
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .replace(/[๐-๙]/g, (digit) => String(THAI_DIGIT.indexOf(digit)))
    .replace(/\s+/g, " ")
    .trim();
}

function monthKey(value: string) {
  return value.toLocaleLowerCase("en-US").replace(/[.\s]/g, "");
}

function normalizedYear(value: string | undefined, fallback: number) {
  if (!value) return fallback;
  let year = Number(value);
  if (!Number.isInteger(year)) return fallback;
  if (year >= 2400) year -= 543;
  if (year < 100) year += 2000;
  return year;
}

function isoDate(year: number, month: number, day: number) {
  const value = new Date(Date.UTC(year, month - 1, day));
  if (
    value.getUTCFullYear() !== year ||
    value.getUTCMonth() !== month - 1 ||
    value.getUTCDate() !== day
  ) return null;
  return value.toISOString().slice(0, 10);
}

export function shiftDate(date: string, days: number) {
  const value = new Date(`${date}T00:00:00Z`);
  if (!Number.isFinite(value.valueOf())) return date;
  return new Date(value.valueOf() + days * 86_400_000).toISOString().slice(0, 10);
}

function shiftMonth(date: string, months: number) {
  const [year, month, day] = date.split("-").map(Number);
  const cursor = new Date(Date.UTC(year, month - 1 + months, 1));
  const lastDay = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, 0)).getUTCDate();
  return isoDate(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, Math.min(day, lastDay)) ?? date;
}

export function displayBizDate(date: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return date;
  const [year, month, day] = date.split("-");
  return `${day}/${month}/${year}`;
}

function parseFlexibleDateToken(token: string, today: string): string | null {
  const text = normalizeQuestion(token);
  const thisYear = Number(today.slice(0, 4));
  const iso = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (iso) return isoDate(normalizedYear(iso[1], thisYear), Number(iso[2]), Number(iso[3]));
  const slash = text.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{2,4})$/);
  if (slash) return isoDate(normalizedYear(slash[3], thisYear), Number(slash[2]), Number(slash[1]));
  const thai = text.match(new RegExp(`^(\\d{1,2})\\s*(${THAI_MONTH_PATTERN})\\s*(?:พ\\.?ศ\\.?\\s*)?(\\d{2,4})?$`, "i"));
  if (thai) {
    return isoDate(normalizedYear(thai[3], thisYear), THAI_MONTHS[monthKey(thai[2])], Number(thai[1]));
  }
  const english = text.match(new RegExp(`^(\\d{1,2})\\s+(${ENGLISH_MONTH_PATTERN})[,\\s]+(\\d{2,4})$`, "i"))
    ?? text.match(new RegExp(`^(${ENGLISH_MONTH_PATTERN})\\s+(\\d{1,2})[,\\s]+(\\d{2,4})$`, "i"));
  if (english) {
    const monthFirst = Number.isNaN(Number(english[1]));
    const month = ENGLISH_MONTHS[monthKey(monthFirst ? english[1] : english[2])];
    const day = Number(monthFirst ? english[2] : english[1]);
    return isoDate(normalizedYear(english[3], thisYear), month, day);
  }
  return null;
}

export function dateQueryFromQuestion(question: string): ProductionAiDateQuery | null {
  const text = normalizeQuestion(question);
  const today = todayBangkok();
  const thisYear = Number(today.slice(0, 4));
  const thisMonth = Number(today.slice(5, 7));
  const thisDay = Number(today.slice(8, 10));

  if (/เมื่อวานซืน|มะรืน|day before yesterday/i.test(text)) {
    return { mode: "day", date: shiftDate(today, -2) };
  }
  if (/เมื่อวาน|วานนี้|yesterday|昨日/i.test(text)) {
    return { mode: "day", date: shiftDate(today, -1) };
  }
  if (/วันนี้|today|本日|今日/i.test(text)) return { mode: "day", date: today };
  if (/เดือนที่แล้ว|last month|前月/i.test(text)) {
    const previous = new Date(Date.UTC(thisYear, thisMonth - 2, 1));
    return { mode: "month", month: previous.toISOString().slice(0, 7) };
  }
  if (/ปีที่แล้ว|last year|昨年|去年/i.test(text)) {
    return { mode: "year", year: String(thisYear - 1) };
  }
  if (/สัปดาห์ที่แล้ว|อาทิตย์ที่แล้ว|last week/i.test(text)) {
    return { mode: "range", from: shiftDate(today, -7), to: shiftDate(today, -1) };
  }

  const relative = text.match(/(?:ย้อนหลัง|ย้อนไป|ล่าสุด|past|last|previous)\s*(\d{1,3})\s*(วัน|weeks?|สัปดาห์|อาทิตย์|เดือน|months?|ปี|years?)/i);
  if (relative) {
    const amount = Math.max(1, Math.min(366, Number(relative[1])));
    const unit = relative[2].toLocaleLowerCase("en-US");
    if (/วัน|day/i.test(unit)) {
      return { mode: "range", from: shiftDate(today, -amount), to: today };
    }
    if (/สัปดาห์|อาทิตย์|week/i.test(unit)) {
      return { mode: "range", from: shiftDate(today, -(amount * 7)), to: today };
    }
    if (/เดือน|month/i.test(unit)) {
      return { mode: "range", from: shiftMonth(today, -amount), to: today };
    }
    if (/ปี|year/i.test(unit)) {
      return { mode: "range", from: shiftMonth(today, -(amount * 12)), to: today };
    }
  }

  const rangeMatch = text.match(/(?:ตั้งแต่|จาก|from)\s*(.+?)\s*(?:ถึง|ถึงวันที่|to|-|–|—)\s*(.+)$/i);
  if (rangeMatch) {
    const from = parseFlexibleDateToken(rangeMatch[1], today);
    const to = parseFlexibleDateToken(rangeMatch[2], today);
    if (from && to && from <= to) return { mode: "range", from, to };
  }

  const isoFullDate = text.match(/\b(\d{4})-(\d{1,2})-(\d{1,2})\b/);
  if (isoFullDate) {
    const date = isoDate(normalizedYear(isoFullDate[1], thisYear), Number(isoFullDate[2]), Number(isoFullDate[3]));
    if (date) return { mode: "day", date };
  }
  const fullDate = text.match(/\b(\d{1,2})[\/-](\d{1,2})[\/-](\d{2,4})\b/);
  if (fullDate) {
    const date = isoDate(normalizedYear(fullDate[3], thisYear), Number(fullDate[2]), Number(fullDate[1]));
    if (date) return { mode: "day", date };
  }
  const thaiDate = text.match(new RegExp(`(\\d{1,2})\\s*(${THAI_MONTH_PATTERN})\\s*(?:พ\\.?ศ\\.?\\s*)?(\\d{2,4})?`, "i"));
  if (thaiDate) {
    const month = THAI_MONTHS[monthKey(thaiDate[2])];
    const date = isoDate(normalizedYear(thaiDate[3], thisYear), month, Number(thaiDate[1]));
    if (date) return { mode: "day", date };
  }
  const englishDate = text.match(new RegExp(`\\b(\\d{1,2})\\s+(${ENGLISH_MONTH_PATTERN})[,\\s]+(\\d{2,4})\\b`, "i"))
    ?? text.match(new RegExp(`\\b(${ENGLISH_MONTH_PATTERN})\\s+(\\d{1,2})[,\\s]+(\\d{2,4})\\b`, "i"));
  if (englishDate) {
    const monthFirst = Number.isNaN(Number(englishDate[1]));
    const month = ENGLISH_MONTHS[monthKey(monthFirst ? englishDate[1] : englishDate[2])];
    const day = Number(monthFirst ? englishDate[2] : englishDate[1]);
    const date = isoDate(normalizedYear(englishDate[3], thisYear), month, day);
    if (date) return { mode: "day", date };
  }

  // Month name without day, e.g. "เดือนกรกฎาคม 2026", "สิงหาคม 2569", "July 2026"
  const thaiMonthOnly = text.match(new RegExp(`(?:เดือน\\s*)?(${THAI_MONTH_PATTERN})\\s*(?:พ\\.?ศ\\.?\\s*)?(\\d{2,4})`, "i"));
  if (thaiMonthOnly) {
    const month = THAI_MONTHS[monthKey(thaiMonthOnly[1])];
    const year = normalizedYear(thaiMonthOnly[2], thisYear);
    if (month) return { mode: "month", month: `${year}-${String(month).padStart(2, "0")}` };
  }
  const englishMonthOnly = text.match(new RegExp(`\\b(${ENGLISH_MONTH_PATTERN})\\s+(\\d{2,4})\\b`, "i"));
  if (englishMonthOnly) {
    const month = ENGLISH_MONTHS[monthKey(englishMonthOnly[1])];
    const year = normalizedYear(englishMonthOnly[2], thisYear);
    if (month) return { mode: "month", month: `${year}-${String(month).padStart(2, "0")}` };
  }

  const dayMonth = text.match(/\b(\d{1,2})[\/-](\d{1,2})\b/);
  if (dayMonth) {
    const date = isoDate(thisYear, Number(dayMonth[2]), Number(dayMonth[1]));
    if (date) return { mode: "day", date };
  }
  const slashMonth = text.match(/(?:เดือน\s*)?\b(0?[1-9]|1[0-2])[\/-](\d{4})\b/i);
  if (slashMonth) {
    const year = normalizedYear(slashMonth[2], thisYear);
    return { mode: "month", month: `${year}-${slashMonth[1].padStart(2, "0")}` };
  }
  const isoMonth = text.match(/\b(\d{4})-(0[1-9]|1[0-2])\b/);
  if (isoMonth) return { mode: "month", month: `${isoMonth[1]}-${isoMonth[2]}` };
  const year = text.match(/(?:ปี|year)\s*(\d{4})\b/i) ?? text.match(/\b(20\d{2}|25\d{2})\b/);
  if (year && /ปี|year|ทั้งปี|ทั้งปีนี้/i.test(text)) {
    return { mode: "year", year: String(normalizedYear(year[1], thisYear)) };
  }

  const dayOnly = text.match(/วันที่\s*(\d{1,2})\b/) ?? text.match(/\b(?:on\s+)?the\s+(\d{1,2})(?:st|nd|rd|th)?\b/i);
  if (dayOnly) {
    const day = Number(dayOnly[1]);
    const month = day > thisDay ? thisMonth - 1 : thisMonth;
    const yearValue = month < 1 ? thisYear - 1 : thisYear;
    const date = isoDate(yearValue, month < 1 ? 12 : month, day);
    if (date) return { mode: "day", date };
  }
  return null;
}

export function dateQueryFromHistory(history: ProductionAiHistoryItem[]) {
  for (let index = history.length - 1; index >= 0; index -= 1) {
    const item = history[index];
    if (item.role !== "user") continue;
    const parsed = dateQueryFromQuestion(item.text);
    if (parsed) return parsed;
  }
  return null;
}

export function resolveDateQuery(
  question: string,
  history: ProductionAiHistoryItem[] = [],
  fallback?: ProductionAiDateQuery,
) {
  return dateQueryFromQuestion(question) ?? dateQueryFromHistory(history) ?? fallback ?? {};
}

export function lineHintsFromQuestion(question: string, history: ProductionAiHistoryItem[] = []) {
  const texts = [question, ...history.filter((item) => item.role === "user").map((item) => item.text)].map(normalizeQuestion);
  const hints = new Set<string>();
  for (const text of texts) {
    const matched = text.matchAll(/(?:เอาแค่|เฉพาะ|แค่|only|just|line)\s+([A-Za-z0-9_\-./]+|[ก-๙A-Za-z0-9_\-./]+)/gi);
    for (const match of matched) {
      const hint = match[1].trim();
      if (hint && !/^(วัน|date|ข้อมูล|data|line)$/i.test(hint)) hints.add(hint);
    }
  }
  return [...hints];
}

export function matchingProductionRows<T extends Record<string, unknown>>(
  rows: T[],
  question: string,
  hints: string[],
) {
  const text = normalizeQuestion(question).toLocaleLowerCase("en-US");
  const normalizedHints = hints.map((hint) => hint.toLocaleLowerCase("en-US")).filter((hint) => hint.length >= 2);
  const searchable = (row: T) => [row.line, row.group, row.product].map((value) => String(value ?? "").toLocaleLowerCase("en-US"));

  if (normalizedHints.length) {
    const hinted = rows.filter((row) => searchable(row).some((value) => normalizedHints.some((hint) => value.includes(hint))));
    if (hinted.length) return hinted;
  }

  const mentioned = rows.filter((row) => searchable(row).some((value) => value.length >= 3 && text.includes(value)));
  return mentioned.length ? mentioned : rows;
}

export function needsLostTime(question: string, hasLineFilter: boolean) {
  if (/lost[ -]?time|losstime|downtime|เวลาสูญเสีย|สาเหตุ(?:การ)?หยุด|หยุด.*(?:เพราะ|สาเหตุ)|pareto|พาเรโต|stop time|ชั่วโมงหยุด/i.test(question)) {
    return true;
  }
  // Line-scoped summaries/details should include Lost Time like the Settings data page.
  return hasLineFilter && /สรุป|summary|รวม|overview|รายละเอียด|วิเคราะห์|performance/i.test(question);
}

export function needsTrend(question: string) {
  // "ย้อนหลัง N เดือน" is a date-period request, not a trend chart request.
  if (/(?:ย้อนหลัง|ย้อนไป|ล่าสุด|past|last|previous)\s*\d{1,3}\s*(วัน|weeks?|สัปดาห์|อาทิตย์|เดือน|months?|ปี|years?)/i.test(question)) {
    return false;
  }
  return /trend|แนวโน้ม|เทียบ.*(?:ก่อน|เดือน|วัน|สัปดาห์|ปี)|เปรียบเทียบ|previous|last (?:day|week|month|year)/i.test(question);
}
