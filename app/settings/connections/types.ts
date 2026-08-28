import type { Locale } from "../../locale-context";
import type { Copy } from "./copy";

export type Connection = {
  id: string;
  name: string;
  baseUrl: string;
  loginUrl: string;
  customerId: string;
  customers?: { id: string; name: string }[];
  loginId: string;
  basicAuth: string;
  session: string;
  lineUuids: string[];
  createdAt: string;
  updatedAt: string;
  lastOkAt: string | null;
  lastError: string | null;
  hasPassword: boolean;
};

export type FormState = {
  name: string;
  baseUrl: string;
  loginPath: string;
  customerId: string;
  loginId: string;
  password: string;
  hasSavedPassword: boolean;
  basicAuth: string;
  session: string;
  lineUuids: string;
  curl: string;
};

export type Flash = { kind: "ok" | "error"; title?: string; text: string };
export type ConnectionStatus = "ok" | "error" | "unknown";
export type MonitorRow = {
  uuid: string;
  statusUuid: string | null;
  product: string | null;
  productUuid?: string | null;
  cycleTime: string | null;
  bizTime: string | null;
};

export type CurlDiscovery = {
  name: boolean;
  baseUrl: boolean;
  basicAuth: boolean;
  session: boolean;
  lines: number;
};

export const DEFAULT_LOGIN_PATH = "/gateway/web/login";

export const EMPTY_FORM: FormState = {
  name: "",
  baseUrl: "",
  loginPath: DEFAULT_LOGIN_PATH,
  customerId: "",
  loginId: "",
  password: "",
  hasSavedPassword: false,
  basicAuth: "",
  session: "",
  lineUuids: "",
  curl: "",
};

export function loginPathFromUrl(loginUrl: string, baseUrl: string) {
  const value = loginUrl.trim();
  if (!value) return DEFAULT_LOGIN_PATH;
  try {
    const url = new URL(value);
    const path = `${url.pathname}${url.search}` || DEFAULT_LOGIN_PATH;
    if (baseUrl) {
      try {
        if (new URL(baseUrl).origin !== url.origin) return value;
      } catch {
        return path;
      }
    }
    return path.startsWith("/") ? path : `/${path}`;
  } catch {
    return value.startsWith("/") ? value : DEFAULT_LOGIN_PATH;
  }
}

export function normalizeBaseUrl(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return "";
  try {
    const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
    return new URL(withProtocol).origin;
  } catch {
    return trimmed.replace(/\/+$/, "");
  }
}

export function fullLoginUrl(baseUrl: string, loginPath: string) {
  const base = normalizeBaseUrl(baseUrl);
  const path = loginPath.trim() || DEFAULT_LOGIN_PATH;
  if (/^https?:\/\//i.test(path)) return path;
  if (!base) return "";
  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
}

export function formFromConnection(item: Connection): FormState {
  const multiCustomer = (item.customers?.length ?? 0) > 0;
  return {
    name: item.name,
    baseUrl: normalizeBaseUrl(item.baseUrl) || item.baseUrl,
    loginPath: DEFAULT_LOGIN_PATH,
    // Active session customerId is not a manual setup field for multi-customer machines.
    customerId: multiCustomer ? "" : item.customerId || "",
    loginId: item.loginId || "",
    password: "",
    hasSavedPassword: item.hasPassword,
    basicAuth: item.basicAuth,
    session: item.session,
    lineUuids: item.lineUuids.join("\n"),
    curl: "",
  };
}

export function parseLineList(raw: string) {
  return [...new Set(raw.split(/[\n,]+/).map((item) => item.trim()).filter(Boolean))];
}

export function connectionStatus(item: Connection): ConnectionStatus {
  if (item.lastError) return "error";
  if (item.lastOkAt) return "ok";
  return "unknown";
}

export function formatRelative(iso: string, locale: Locale, justNow: string) {
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return justNow;
  const diff = Date.now() - then;
  if (diff < 45_000) return justNow;
  const rtf = new Intl.RelativeTimeFormat(
    locale === "th" ? "th" : locale === "ja" ? "ja" : "en",
    { numeric: "auto" },
  );
  const minutes = Math.round(diff / 60_000);
  if (Math.abs(minutes) < 60) return rtf.format(-minutes, "minute");
  const hours = Math.round(minutes / 60);
  if (Math.abs(hours) < 24) return rtf.format(-hours, "hour");
  return rtf.format(-Math.round(hours / 24), "day");
}

export function statusLabel(status: ConnectionStatus, copy: Copy) {
  if (status === "ok") return copy.statusOk;
  if (status === "error") return copy.statusError;
  return copy.statusUnknown;
}
