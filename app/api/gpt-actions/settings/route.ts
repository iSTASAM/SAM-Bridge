import { NextResponse } from "next/server";
import { listConnections } from "@/lib/ixacs-connections";
import {
  gptCompanyKey,
  parseGptCompanyKey,
  publicGptActionSettings,
  rotateGptActionKey,
  setAllowedGptCompanies,
} from "@/lib/gpt-actions";
import type { IxacsCustomerOption } from "@/lib/ixacs-login";

export const dynamic = "force-dynamic";

type AllowedConnection = {
  id: string;
  customers?: IxacsCustomerOption[];
};

function isAllowedCompanyId(id: string, connections: AllowedConnection[]) {
  const { connectionId, customerId } = parseGptCompanyKey(id);
  const connection = connections.find((item) => item.id === connectionId);
  if (!connection) return false;
  if (!customerId) return true;
  return (connection.customers ?? []).some((customer) => customer.id === customerId);
}

export async function GET() {
  const { connections } = await listConnections();
  return NextResponse.json({ ...publicGptActionSettings(), connections });
}

export async function POST() {
  return NextResponse.json(rotateGptActionKey(), { status: 201 });
}

export async function PATCH(request: Request) {
  const body = (await request.json().catch(() => null)) as { allowedCompanyIds?: unknown } | null;
  if (!Array.isArray(body?.allowedCompanyIds)) {
    return NextResponse.json({ error: "allowedCompanyIds must be an array" }, { status: 400 });
  }
  const connections = (await listConnections()).connections;
  const ids = body.allowedCompanyIds.filter(
    (value): value is string => typeof value === "string" && isAllowedCompanyId(value, connections),
  );
  return NextResponse.json(setAllowedGptCompanies(ids));
}
