import { NextResponse } from "next/server";
import { getRequestSession } from "@/lib/auth";
import { getAdminSystemMachines } from "@/lib/admin-systems";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getRequestSession();
  if (session?.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { id } = await params;
  const { machines } = await getAdminSystemMachines({ withProfiles: true, connectionId: id });
  const machine = machines[0] ?? null;
  if (!machine) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ machine });
}
