import { NextResponse } from "next/server";
import {
  deleteSapConnection,
  getSapConnection,
  parseSapServiceUrl,
  publicSapConnection,
  recordSapTest,
  saveSapConnection,
  testSapProductionOrder,
} from "@/lib/sap-connections";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const connection = getSapConnection(id);
  if (!connection) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  return NextResponse.json({ connection: publicSapConnection(connection) });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const current = getSapConnection(id);
  if (!current) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const suppliedKey = typeof body.apiKey === "string" ? body.apiKey.trim() : "";
  const apiKey = suppliedKey || current.apiKey;
  const serviceUrl =
    typeof body.serviceUrl === "string" && body.serviceUrl.trim()
      ? body.serviceUrl.trim()
      : current.serviceUrl;
  if (!serviceUrl) {
    return NextResponse.json({ ok: false, error: "SERVICE_URL_REQUIRED" }, { status: 400 });
  }
  if (!apiKey) {
    return NextResponse.json({ ok: false, error: "API_KEY_REQUIRED" }, { status: 400 });
  }

  let result;
  try {
    result = await testSapProductionOrder(serviceUrl, apiKey);
  } catch (error) {
    const code = error instanceof Error ? error.message : "SAP_TEST_FAILED";
    return NextResponse.json(
      {
        ok: false,
        error: code,
        httpStatus: null,
        responseTimeMs: 0,
        operation: "GET /ProductionOrder",
        apiLabel: "Production Order API",
      },
      { status: 400 },
    );
  }

  if (!result.ok) {
    recordSapTest(id, result);
    return NextResponse.json({
      ok: false,
      httpStatus: result.httpStatus,
      responseTimeMs: result.responseTimeMs,
      operation: result.operation,
      apiLabel: result.apiLabel,
      connection: publicSapConnection(getSapConnection(id) ?? current),
    });
  }

  const saved = saveSapConnection(id, {
    name: typeof body.name === "string" ? body.name : undefined,
    environment: typeof body.environment === "string" ? body.environment : undefined,
    api: typeof body.api === "string" ? body.api : undefined,
    serviceUrl,
    apiKey: suppliedKey || undefined,
  });
  if (!saved) {
    return NextResponse.json({ ok: false, error: "SAP_SAVE_FAILED" }, { status: 500 });
  }
  const recorded = recordSapTest(saved.id, result) ?? saved;
  return NextResponse.json({
    ok: true,
    httpStatus: result.httpStatus,
    responseTimeMs: result.responseTimeMs,
    operation: result.operation,
    apiLabel: result.apiLabel,
    connection: publicSapConnection(recorded),
  });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const current = getSapConnection(id);
  if (!current) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  if (typeof body.confirmationServiceUrl === "string" && body.confirmationServiceUrl.trim()) {
    try {
      parseSapServiceUrl(body.confirmationServiceUrl);
    } catch (error) {
      const code = error instanceof Error ? error.message : "SERVICE_URL_INVALID";
      return NextResponse.json({ error: code }, { status: 400 });
    }
  }
  const saved = saveSapConnection(id, {
    confirmationServiceUrl:
      typeof body.confirmationServiceUrl === "string" ? body.confirmationServiceUrl : undefined,
  });
  if (!saved) return NextResponse.json({ error: "SAP_SAVE_FAILED" }, { status: 500 });
  return NextResponse.json({ connection: publicSapConnection(saved) });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!deleteSapConnection(id)) {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
