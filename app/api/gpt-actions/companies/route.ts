import { NextResponse } from "next/server";
import { authenticateGptAction, isGptCompanyAllowed } from "@/lib/gpt-actions";
import { listConnections } from "@/lib/ixacs-connections";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!authenticateGptAction(request)) {
    return NextResponse.json({ error: "Invalid or missing API key" }, { status: 401 });
  }
  const companies = listConnections().connections
    .filter((company) => isGptCompanyAllowed(company.id))
    .map((company) => ({ id: company.id, name: company.name, lastOkAt: company.lastOkAt }));
  return NextResponse.json({ ok: true, companies, count: companies.length });
}
