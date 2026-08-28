import { NextResponse } from "next/server";
import {
  createConnection,
  getConnection,
  markConnectionResult,
  rememberConnectionLines,
  setActiveConnection,
  updateConnection,
} from "@/lib/ixacs-connections";
import { connectionAsTarget, discoverIxacsLines } from "@/lib/ixacs-client";
import { loginIxacs } from "@/lib/ixacs-login";
import { normalizeBaseUrl, normalizeBasicAuth } from "@/lib/ixacs-curl";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) {
    return NextResponse.json({ ok: false, error: "INVALID_REQUEST" }, { status: 400 });
  }

  const requestedLoginUrl = typeof body.loginUrl === "string" ? body.loginUrl.trim() : "";
  const requestedBaseUrl =
    typeof body.baseUrl === "string" ? normalizeBaseUrl(body.baseUrl) : "";
  const loginUrl =
    requestedLoginUrl ||
    `${requestedBaseUrl || "https://monitor-pre.ixacs.jp"}/gateway/web/login`;
  const basicAuth =
    normalizeBasicAuth(typeof body.basicAuth === "string" ? body.basicAuth : "");
  const connectionId = typeof body.connectionId === "string" ? body.connectionId : "";
  const savedConnection = connectionId ? await getConnection(connectionId) : null;
  const selectedCustomerId =
    typeof body.selectedCustomerId === "string" ? body.selectedCustomerId.trim() : "";
  const probe = body.probe === true;
  const password =
    typeof body.password === "string" && body.password
      ? body.password
      : savedConnection?.password ?? "";

  const login = await loginIxacs({
    loginUrl,
    customerId: typeof body.customerId === "string" ? body.customerId : "",
    selectedCustomerId,
    loginId: typeof body.loginId === "string" ? body.loginId : "",
    password,
    basicAuth,
    language:
      body.language === "th" || body.language === "en" || body.language === "ja"
        ? body.language
        : undefined,
  });

  if (!login.ok) {
    console.warn("iXacs login failed", {
      host: login.baseUrl,
      status: login.status,
      error: login.error ?? "LOGIN_FAILED",
      diagnostic: login.diagnostic,
    });
    const responseStatus =
      login.error === "LOGIN_CUSTOMER_SELECTION_REQUIRED"
        ? 409
        : login.error === "LOGIN_FAILED"
        ? 401
        : login.error === "LOGIN_MONITOR_UNAUTHORIZED"
          ? 403
          : login.status === 400
            ? 400
            : 502;
    return NextResponse.json(
      {
        ok: false,
        status: login.status,
        error: login.error ?? "LOGIN_FAILED",
        customerIds: login.customerIds ?? login.customers?.map((item) => item.id) ?? [],
        customers: login.customers ?? (login.customerIds ?? []).map((id) => ({ id, name: id })),
      },
      { status: responseStatus },
    );
  }

  if (probe) {
    const discovery = await discoverIxacsLines(connectionAsTarget({
      id: "probe",
      name: "probe",
      baseUrl: login.baseUrl,
      loginUrl: login.loginUrl,
      customerId: selectedCustomerId || (typeof body.customerId === "string" ? body.customerId : ""),
      customers: login.customers ?? [],
      loginId: typeof body.loginId === "string" ? body.loginId : "",
      password,
      basicAuth: login.basicAuth || basicAuth,
      session: login.session,
      lineUuids: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      lastOkAt: null,
      lastError: null,
    }));
    return NextResponse.json({
      ok: true,
      probe: true,
      lineCount: discovery.lineUuids.length,
      discoveryError: discovery.error ?? null,
    });
  }

  const input = {
    name: typeof body.name === "string" ? body.name : undefined,
    baseUrl: login.baseUrl,
    loginUrl: login.loginUrl,
    customerId: selectedCustomerId || (typeof body.customerId === "string" ? body.customerId : undefined),
    customers: Array.isArray(body.customers) ? body.customers as { id: string; name: string }[] : undefined,
    loginId: typeof body.loginId === "string" ? body.loginId : undefined,
    password,
    basicAuth: login.basicAuth || basicAuth,
    session: login.session,
    lineUuids:
      typeof body.lineUuids === "string" || Array.isArray(body.lineUuids)
        ? (body.lineUuids as string[] | string)
        : undefined,
  };

  try {
    const connection = connectionId
      ? await updateConnection(connectionId, input)
      : await createConnection(input);

    if (!connection) {
      return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
    }

    await setActiveConnection(connection.id);
    await markConnectionResult(connection.id, true);
    const discovery = await discoverIxacsLines(connectionAsTarget(connection));
    if (discovery.lineUuids.length > 0) {
      await rememberConnectionLines(connection.id, discovery.lineUuids);
    }

    return NextResponse.json({
      ok: true,
      connectionId: connection.id,
      hasSession: Boolean(connection.session),
      lineCount: discovery.lineUuids.length,
      discoveryError: discovery.error ?? null,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "SAVE_FAILED";
    console.error("iXacs connection save failed", message);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
