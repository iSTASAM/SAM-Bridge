import { NextResponse } from "next/server";
import { createLineUser, listLineUsers, publicLineUser } from "@/lib/line-users";
import { listConnections } from "@/lib/ixacs-connections";

export const dynamic = "force-dynamic";
function customers() {
  return listConnections().connections.flatMap((connection) => connection.customers?.length
    ? connection.customers.map((customer) => ({ id: customer.id, name: customer.name || customer.id }))
    : [{ id: connection.customerId || connection.id, name: connection.name }]);
}
function withCustomers(user: ReturnType<typeof publicLineUser>) {
  const map = new Map(customers().map((item) => [item.id, item.name]));
  return { ...user, customers: user.customerIds.map((id) => ({ id, name: map.get(id) ?? id })) };
}
export async function GET() { return NextResponse.json({ users: listLineUsers().map(publicLineUser).map(withCustomers), customers: customers() }); }
export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  try {
    const user = createLineUser({ displayName: String(body.displayName ?? ""), loginId: String(body.loginId ?? ""), password: String(body.password ?? ""), customerIds: Array.isArray(body.customerIds) ? body.customerIds.filter((item): item is string => typeof item === "string") : [], accountStatus: String(body.accountStatus ?? ""), lineAllowed: body.lineAllowed !== false });
    return NextResponse.json({ user: withCustomers(publicLineUser(user)) }, { status: 201 });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "CREATE_FAILED" }, { status: 400 }); }
}
