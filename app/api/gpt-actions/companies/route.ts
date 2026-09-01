import { NextResponse } from "next/server";
import { authenticateGptAction, gptCompanyKey, isGptCompanyAllowed } from "@/lib/gpt-actions";
import { listConnections } from "@/lib/ixacs-connections";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!authenticateGptAction(request)) {
    return NextResponse.json({ error: "Invalid or missing API key" }, { status: 401 });
  }
  const companies = (await listConnections()).connections.flatMap((connection) => {
    const customers = connection.customers ?? [];
    if (customers.length > 1) {
      return customers
        .filter((customer) => isGptCompanyAllowed(connection.id, customer.id))
        .map((customer) => ({
          id: gptCompanyKey(connection.id, customer.id),
          name: customer.name || customer.id,
          connectionId: connection.id,
          connectionName: connection.name,
          customerId: customer.id,
          lastOkAt: connection.lastOkAt,
        }));
    }
    if (!isGptCompanyAllowed(connection.id, customers[0]?.id)) return [];
    return [{
      id: connection.id,
      name: connection.name,
      connectionId: connection.id,
      connectionName: connection.name,
      customerId: customers[0]?.id ?? connection.customerId ?? null,
      lastOkAt: connection.lastOkAt,
    }];
  });
  return NextResponse.json({ ok: true, companies, count: companies.length });
}
