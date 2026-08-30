import { NextResponse } from "next/server";
import { getRequestSession } from "@/lib/auth";
import { getAdminSystemMachines } from "@/lib/admin-systems";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getRequestSession();
  if (session?.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { summary, machines } = await getAdminSystemMachines();
  return NextResponse.json({
    summary,
    machines: machines.map(({ users: _users, ...machine }) => {
      void _users;
      return machine;
    }),
  });
}
