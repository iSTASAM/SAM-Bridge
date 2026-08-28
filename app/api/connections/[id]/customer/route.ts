import { NextResponse } from "next/server";
import { canAccessConnection, getRequestSession } from "@/lib/auth";
import { activateConnectionCustomer } from "@/lib/ixacs-activate-customer";
import { getConnection, publicConnection } from "@/lib/ixacs-connections";

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const session = await getRequestSession();
  if (!canAccessConnection(session, id)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const connection = await getConnection(id);
  if (!connection) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = (await request.json().catch(() => null)) as { customerId?: unknown } | null;
  const customerId = typeof body?.customerId === "string" ? body.customerId.trim() : "";
  if (!customerId) {
    return NextResponse.json({ ok: false, error: "CUSTOMER_REQUIRED" }, { status: 400 });
  }

  const result = await activateConnectionCustomer(id, customerId);
  if (!result.ok) {
    return NextResponse.json(
      { ok: false, error: result.error },
      { status: result.status },
    );
  }

  return NextResponse.json({
    ok: true,
    connection: publicConnection(result.connection),
    lineCount: result.lineCount,
    groupCount: result.groupCount,
  });
}
