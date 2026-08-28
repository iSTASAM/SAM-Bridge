import { NextResponse } from "next/server";
import { recordExportActivity, nextSimulationId } from "@/lib/export-activity";
import {
  buildProductionConfirmationPayload,
  getProductionConfirmationTransport,
} from "@/lib/sap-confirmation";
import { getSapConnection } from "@/lib/sap-connections";

export const dynamic = "force-dynamic";

function inputFrom(body: Record<string, unknown>) {
  const orderId = typeof body.orderId === "string" ? body.orderId.trim() : "";
  const yieldQuantity = typeof body.yieldQuantity === "string" ? body.yieldQuantity.trim() : "";
  const unit = typeof body.unit === "string" && body.unit.trim() ? body.unit.trim() : "PC";
  return { orderId, yieldQuantity, unit };
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const connection = getSapConnection(id);
  if (!connection) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const input = inputFrom(body);

  let payload;
  try {
    payload = buildProductionConfirmationPayload(input);
  } catch (error) {
    const code = error instanceof Error ? error.message : "PAYLOAD_INVALID";
    return NextResponse.json({ error: code, mode: "simulation" }, { status: 400 });
  }

  if (body.previewOnly) {
    return NextResponse.json({
      ok: true,
      mode: "simulation",
      executed: false,
      preview: {
        operation: "POST /ProdnOrdConf2",
        label: "Simulation Preview",
        body: payload,
      },
    });
  }

  const transport = getProductionConfirmationTransport();
  const result = await transport.submit(payload, nextSimulationId());
  // SimulationTransport only — never POST to SAP from this route.
  const activity = recordExportActivity({
    transactionId: result.transactionId,
    exportId: typeof body.exportId === "string" ? body.exportId : null,
    exportName: typeof body.exportName === "string" && body.exportName.trim() ? body.exportName.trim() : "SAP Data Export",
    destination: "SAP",
    result: "simulated",
    source: "iXacs",
    orderId: payload.OrderID,
    product: typeof body.product === "string" ? body.product : "",
    plant: typeof body.plant === "string" ? body.plant : "",
    actual: input.yieldQuantity,
    yieldQuantity: payload.ConfirmationYieldQuantity,
    unit: payload.ConfirmationUnit,
    mode: "simulation",
    payload,
  });

  return NextResponse.json({
    ok: true,
    mode: result.mode,
    executed: result.executed,
    transactionId: result.transactionId,
    validation: result.validation,
    payload: result.payload,
    activity,
  });
}
