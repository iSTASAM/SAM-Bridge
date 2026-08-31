import { NextRequest, NextResponse } from "next/server";
import {
  extractSession,
  getPushKeyAssignment,
  isPushAuthorized,
  rememberPushBatch,
} from "@/lib/ixacs-store";
import { dispatchPushNotifications } from "@/lib/notification-runner";
import { dispatchLineNotificationEvents } from "@/lib/line-notification-runner";

function headersToObject(headers: Headers) {
  const obj: Record<string, string> = {};
  headers.forEach((value, key) => {
    obj[key] = value;
  });
  return obj;
}

async function parseBody(request: NextRequest) {
  const contentType = request.headers.get("content-type") ?? "";
  const raw = await request.text();

  if (!raw) {
    return { raw: null, parsed: null };
  }

  const looksLikeJson =
    contentType.includes("application/json") ||
    raw.trim().startsWith("{") ||
    raw.trim().startsWith("[");

  if (looksLikeJson) {
    try {
      return { raw, parsed: JSON.parse(raw) as unknown };
    } catch {
      return { raw, parsed: null };
    }
  }

  return { raw, parsed: null };
}

function logIncoming(
  method: string,
  request: NextRequest,
  body: { raw: string | null; parsed: unknown },
) {
  const apiKey = request.headers.get("x-api-key");
  const maskedApiKey = apiKey
    ? `${apiKey.slice(0, 8)}...${apiKey.slice(-4)}`
    : "(missing)";

  const originalUrl = request.headers.get("x-original-url") ?? request.url;
  const originalPath = request.headers.get("x-original-path");

  console.log("\n========== SAM Bridge ==========");
  console.log("receivedAt:", new Date().toISOString());
  console.log("method:", method);
  console.log("url:", originalUrl);
  if (originalPath) {
    console.log("path:", originalPath);
  }
  console.log("x-api-key:", maskedApiKey);
  const safeHeaders = headersToObject(request.headers);
  if (safeHeaders["x-api-key"]) safeHeaders["x-api-key"] = maskedApiKey;
  if (safeHeaders.cookie) safeHeaders.cookie = "(redacted)";
  console.log("headers:", JSON.stringify(safeHeaders, null, 2));
  console.log(
    "query:",
    JSON.stringify(Object.fromEntries(request.nextUrl.searchParams.entries()), null, 2),
  );

  if (body.parsed !== null) {
    const serialized = JSON.stringify(body.parsed);
    console.log("bodyBytes:", Buffer.byteLength(serialized, "utf8"));
    console.log("bodyPreview:", serialized.slice(0, 4_000));
  } else {
    console.log("bodyBytes:", body.raw ? Buffer.byteLength(body.raw, "utf8") : 0);
    console.log("bodyPreview:", body.raw?.slice(0, 4_000) ?? "(empty)");
  }

  console.log("====================================\n");
}

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, x-api-key",
    "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, OPTIONS",
  };
}

function json(data: unknown, status = 200) {
  return NextResponse.json(data, { status, headers: corsHeaders() });
}

async function handle(request: NextRequest, method: string) {
  const contentLength = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(contentLength) && contentLength > 10 * 1024 * 1024) {
    return json({ ok: false, error: "Payload exceeds 10 MB" }, 413);
  }
  if (!(await isPushAuthorized(request.headers.get("x-api-key")))) {
    console.log("Rejected request: x-api-key is not valid");
    return json({ ok: false, error: "Invalid x-api-key" }, 401);
  }
  const body =
    method === "GET" || method === "HEAD"
      ? { raw: null, parsed: null }
      : await parseBody(request);

  if (body.raw && Buffer.byteLength(body.raw, "utf8") > 10 * 1024 * 1024) {
    return json({ ok: false, error: "Payload exceeds 10 MB" }, 413);
  }

  logIncoming(method, request, body);

  if (body.parsed !== null) {
    const session = extractSession(request.headers.get("cookie"), body.parsed);
    if (session) {
      console.log("Captured SESSION from iXacs push:", `${session.slice(0, 8)}...`);
    }
    const stored = await rememberPushBatch(body.parsed, session, request.headers.get("x-api-key"));
    let lineDispatchFailed = false;
    if (stored.acceptedEvents.length > 0) {
      try {
        const lineResult = await dispatchLineNotificationEvents(stored.acceptedEvents);
        console.log("LINE notification dispatch from Push:", lineResult);
        lineDispatchFailed = Boolean(lineResult.error);
      } catch (error) {
        lineDispatchFailed = true;
        console.error("LINE notification dispatch failed:", error);
      }
      try {
        await dispatchPushNotifications(stored.acceptedEvents);
      } catch (error) {
        console.error("Slack notification dispatch failed:", error);
      }
    }
    const { acceptedEvents: _acceptedEvents, ...storedResult } = stored;
    void _acceptedEvents;
    if (lineDispatchFailed) {
      return json(
        {
          ...storedResult,
          ok: false,
          received: true,
          retryable: true,
          error: "LINE_NOTIFICATION_DISPATCH_FAILED",
          receivedAt: new Date().toISOString(),
        },
        503,
      );
    }
    if (stored.accepted === 0) {
      const errors = "errors" in stored ? stored.errors : undefined;
      const forbidden = Boolean(
        errors?.KEY_ASSIGNED_TO_ANOTHER_LINE ||
        errors?.KEY_ASSIGNED_TO_ANOTHER_GROUP ||
        errors?.LINE_NOT_IN_COMPANY ||
        errors?.KEY_HAS_NO_COMPANY
      );
      return json(
        { ...storedResult, ok: false },
        "error" in stored && stored.error === "TOO_MANY_RECORDS" ? 413 : forbidden ? 403 : 422,
      );
    }
    if (stored.partial) {
      return json({ ...storedResult, ok: false, received: true, receivedAt: new Date().toISOString() }, 207);
    }
    return json({ ...storedResult, ok: true, received: true, receivedAt: new Date().toISOString() });
  }

  const assignment = await getPushKeyAssignment(request.headers.get("x-api-key"));

  return json({
    ok: true,
    received: true,
    method,
    receivedAt: new Date().toISOString(),
    companyId: assignment?.connectionId ?? null,
    lineUuid: assignment?.lineUuid ?? null,
  });
}

export async function GET(request: NextRequest) {
  return handle(request, "GET");
}

export async function POST(request: NextRequest) {
  return handle(request, "POST");
}

export async function PUT(request: NextRequest) {
  return handle(request, "PUT");
}

export async function PATCH(request: NextRequest) {
  return handle(request, "PATCH");
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      Allow: "GET, POST, PUT, PATCH, OPTIONS",
      ...corsHeaders(),
    },
  });
}
