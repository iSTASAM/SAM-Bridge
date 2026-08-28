import { NextResponse } from "next/server";
import { listSapProductionOrders } from "@/lib/sap-client";
import { getSapConnection } from "@/lib/sap-connections";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const connection = getSapConnection(id);
  if (!connection) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  const query = new URL(request.url).searchParams.get("q") ?? "";
  const result = await listSapProductionOrders(connection, query);
  if (!result.ok) {
    return NextResponse.json(
      {
        ok: false,
        orders: [],
        httpStatus: result.httpStatus,
        error: result.errorMessage,
      },
      { status: result.httpStatus && result.httpStatus >= 400 ? result.httpStatus : 502 },
    );
  }
  return NextResponse.json({ ok: true, orders: result.orders });
}
