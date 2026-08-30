import { NextResponse } from "next/server";
import { loadConnectionProductionData } from "@/lib/ixacs-production-data";
import { canAccessConnection, getRequestSession } from "@/lib/auth";

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

  const requestBody = (await request.json().catch(() => ({}))) as {
    mode?: string;
    date?: string;
    from?: string;
    to?: string;
    month?: string;
    year?: string;
    fresh?: unknown;
    customerIds?: unknown;
  };
  const result = await loadConnectionProductionData({
    connectionId: id,
    dateQuery: requestBody,
    customerIds: requestBody.customerIds,
    fresh: requestBody.fresh === true || requestBody.fresh === "1" || requestBody.fresh === 1,
  });
  if (!result.ok) return NextResponse.json(result.payload, { status: result.status });
  return NextResponse.json(result.payload);
}
