import {
  parseSapServiceUrl,
  type SapConnection,
} from "@/lib/sap-connections";

const TIMEOUT_MS = 20_000;
const ORDER_PAGE_SIZE = 40;

export type SapProductionOrder = {
  id: string;
  product: string;
  plant: string;
  plannedQty: string;
  unit: string;
};

export type SapConfirmationInput = {
  orderId: string;
  yieldQuantity: string;
  unit: string;
};

export type SapWriteResult = {
  ok: boolean;
  httpStatus: number | null;
  responseTimeMs: number;
  operation: string;
  errorMessage: string | null;
};

function sapHeaders(apiKey: string, extra?: HeadersInit): Headers {
  const headers = new Headers(extra);
  headers.set("APIKey", apiKey);
  headers.set("Accept", "application/json");
  return headers;
}

function redact(text: string, secret: string) {
  if (!secret) return text;
  return text.split(secret).join("[redacted]");
}

function looksLikeHtml(contentType: string, body: string) {
  if (contentType.includes("text/html")) return true;
  const trimmed = body.trim();
  return /^<!doctype html/i.test(trimmed) || /^<html[\s>]/i.test(trimmed);
}

export function parseSapErrorMessage(body: string, httpStatus: number | null) {
  const trimmed = body.trim();
  if (!trimmed) return httpStatus ? `HTTP ${httpStatus}` : "SAP request failed";
  try {
    const json = JSON.parse(trimmed) as {
      error?: { message?: string | { value?: string }; details?: Array<{ message?: string }> };
      message?: string;
    };
    const nested = json.error?.message;
    const fromError =
      typeof nested === "string"
        ? nested
        : nested && typeof nested.value === "string"
          ? nested.value
          : "";
    const fromDetails = json.error?.details?.map((item) => item.message).filter(Boolean).join(" · ");
    const fromMessage = typeof json.message === "string" ? json.message : "";
    return fromError || fromDetails || fromMessage || trimmed.slice(0, 400);
  } catch {
    return trimmed.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 400) || `HTTP ${httpStatus}`;
  }
}

function firstString(record: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

function asRecords(payload: unknown): Record<string, unknown>[] {
  if (Array.isArray(payload)) {
    return payload.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object" && !Array.isArray(item));
  }
  if (!payload || typeof payload !== "object") return [];
  const root = payload as Record<string, unknown>;
  if (Array.isArray(root.value)) return asRecords(root.value);
  if (root.d && typeof root.d === "object") {
    const data = root.d as Record<string, unknown>;
    if (Array.isArray(data.results)) return asRecords(data.results);
    return asRecords(data);
  }
  if (Array.isArray(root.results)) return asRecords(root.results);
  if (Array.isArray(root.ProductionOrder)) return asRecords(root.ProductionOrder);
  if (firstString(root, ["ProductionOrder", "ManufacturingOrder", "OrderID", "Order"])) {
    return [root];
  }
  return [];
}

export function mapSapProductionOrder(record: Record<string, unknown>): SapProductionOrder | null {
  const id = firstString(record, [
    "ProductionOrder",
    "ManufacturingOrder",
    "OrderID",
    "ProductionOrderNumber",
    "ManufacturingOrderID",
    "Order",
    "productionOrder",
  ]);
  if (!id) return null;
  return {
    id,
    product: firstString(record, [
      "Product",
      "Material",
      "MaterialNumber",
      "ManufacturingOrderMaterial",
      "ProductExternalID",
      "ProductionOrderProduct",
    ]),
    plant: firstString(record, [
      "Plant",
      "ProductionPlant",
      "ProductionPlantName",
      "ManufacturingOrderPlant",
    ]),
    plannedQty: firstString(record, [
      "PlannedTotalQty",
      "TotalQuantity",
      "MRPPlannedQuantity",
      "ManufacturingOrderPlannedTotalQty",
      "PlannedQuantity",
      "Quantity",
    ]),
    unit: firstString(record, [
      "ProductionUnit",
      "BaseUnit",
      "ManufacturingOrderPlannedTotalQtyUnit",
      "ProductionUnitISOCode",
      "ConfirmationUnit",
      "Unit",
    ]) || "PC",
  };
}

function entityUrl(serviceUrl: string, entity: string, query = "") {
  const parsed = parseSapServiceUrl(serviceUrl);
  parsed.pathname = parsed.pathname.replace(/\/+$/, "");
  const last = parsed.pathname.split("/").filter(Boolean).pop() ?? "";
  if (last.toLowerCase() === "$metadata") {
    parsed.pathname = parsed.pathname.replace(/\/\$metadata$/i, `/${entity}`);
  } else if (last.toLowerCase() !== entity.toLowerCase()) {
    parsed.pathname = `${parsed.pathname}/${entity}`;
  }
  return query ? `${parsed.origin}${parsed.pathname}?${query}` : `${parsed.origin}${parsed.pathname}`;
}

async function sapRequest(
  url: string,
  apiKey: string,
  init: RequestInit,
): Promise<{ status: number; body: string; contentType: string; ms: number }> {
  const started = Date.now();
  const response = await fetch(url, {
    ...init,
    headers: sapHeaders(apiKey, init.headers),
    cache: "no-store",
    redirect: "follow",
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  const body = await response.text().catch(() => "");
  return {
    status: response.status,
    body: redact(body, apiKey),
    contentType: response.headers.get("content-type") ?? "",
    ms: Date.now() - started,
  };
}

export async function listSapProductionOrders(
  connection: SapConnection,
  query = "",
): Promise<{ ok: boolean; orders: SapProductionOrder[]; httpStatus: number | null; errorMessage: string | null }> {
  const url = entityUrl(connection.serviceUrl, "ProductionOrder", `$top=${ORDER_PAGE_SIZE}`);
  try {
    const result = await sapRequest(url, connection.apiKey, { method: "GET" });
    if (result.status !== 200 || looksLikeHtml(result.contentType, result.body)) {
      return {
        ok: false,
        orders: [],
        httpStatus: result.status,
        errorMessage: parseSapErrorMessage(result.body, result.status),
      };
    }
    const parsed = JSON.parse(result.body) as unknown;
    const orders = asRecords(parsed).flatMap((record) => {
      const order = mapSapProductionOrder(record);
      return order ? [order] : [];
    });
    const needle = query.trim().toLowerCase();
    return {
      ok: true,
      orders: needle
        ? orders.filter((order) =>
            [order.id, order.product, order.plant].join(" ").toLowerCase().includes(needle),
          )
        : orders,
      httpStatus: result.status,
      errorMessage: null,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "SAP_ORDER_LIST_FAILED";
    if (message.startsWith("SERVICE_URL")) {
      return { ok: false, orders: [], httpStatus: null, errorMessage: message };
    }
    return { ok: false, orders: [], httpStatus: null, errorMessage: "Could not load Production Orders from SAP." };
  }
}

function confirmationTarget(serviceUrl: string) {
  const parsed = parseSapServiceUrl(serviceUrl);
  const path = parsed.pathname.toLowerCase();
  if (path.includes("prodnordconf")) return entityUrl(serviceUrl, path.includes("prodnordconf2") ? "ProdnOrdConf2" : "ProdnOrdConf");
  if (path.includes("productionorderconfirmation")) return entityUrl(serviceUrl, "ProductionOrderConfirmation");
  if (path.includes("api_prod_order_confirmation")) return entityUrl(serviceUrl, "ProdnOrdConf2");
  return entityUrl(serviceUrl, "ProductionOrderConfirmation");
}

function confirmationPayload(serviceUrl: string, input: SapConfirmationInput) {
  const path = serviceUrl.toLowerCase();
  if (path.includes("api_prod_order_confirmation") || path.includes("prodnordconf")) {
    return {
      OrderID: input.orderId,
      ConfirmationYieldQuantity: input.yieldQuantity,
      ConfirmationUnit: input.unit || "PC",
    };
  }
  return {
    ProductionOrder: input.orderId,
    ConfirmationYieldQuantity: input.yieldQuantity,
    ConfirmationYieldQuantityUnit: input.unit || "PC",
  };
}

export function previewSapConfirmation(serviceUrl: string, input: SapConfirmationInput) {
  const url = confirmationTarget(serviceUrl);
  return {
    method: "POST" as const,
    url,
    operation: url.includes("ProdnOrdConf") ? "POST /ProdnOrdConf2" : "POST /ProductionOrderConfirmation",
    body: confirmationPayload(serviceUrl, input),
  };
}

export async function sendSapProductionConfirmation(
  connection: SapConnection,
  input: SapConfirmationInput,
): Promise<SapWriteResult> {
  if (!connection.confirmationServiceUrl.trim()) {
    return {
      ok: false,
      httpStatus: null,
      responseTimeMs: 0,
      operation: "POST /ProductionOrderConfirmation",
      errorMessage: "CONFIRMATION_URL_REQUIRED",
    };
  }
  const preview = previewSapConfirmation(connection.confirmationServiceUrl, input);
  try {
    const result = await sapRequest(preview.url, connection.apiKey, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(preview.body),
    });
    const ok = result.status === 201 || result.status === 200;
    return {
      ok,
      httpStatus: result.status,
      responseTimeMs: result.ms,
      operation: preview.operation,
      errorMessage: ok ? null : parseSapErrorMessage(result.body, result.status),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "SAP_CONFIRM_FAILED";
    return {
      ok: false,
      httpStatus: null,
      responseTimeMs: 0,
      operation: preview.operation,
      errorMessage: message.startsWith("SERVICE_URL") ? message : "Could not send confirmation to SAP.",
    };
  }
}
