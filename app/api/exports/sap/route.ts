import { NextResponse } from "next/server";
import {
  publicSapConnection,
  recordSapTest,
  saveSapConnection,
  testSapProductionOrder,
} from "@/lib/sap-connections";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const apiKey = typeof body.apiKey === "string" ? body.apiKey.trim() : "";
  const serviceUrl = typeof body.serviceUrl === "string" ? body.serviceUrl.trim() : "";
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
    return NextResponse.json({
      ok: false,
      httpStatus: result.httpStatus,
      responseTimeMs: result.responseTimeMs,
      operation: result.operation,
      apiLabel: result.apiLabel,
    });
  }

  const saved = saveSapConnection(null, {
    name: typeof body.name === "string" ? body.name : undefined,
    environment: typeof body.environment === "string" ? body.environment : undefined,
    api: typeof body.api === "string" ? body.api : undefined,
    serviceUrl,
    apiKey,
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
