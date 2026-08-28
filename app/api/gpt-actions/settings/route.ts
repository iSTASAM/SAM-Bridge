import { NextResponse } from "next/server";
import { listConnections } from "@/lib/ixacs-connections";
import {
  publicGptActionSettings,
  rotateGptActionKey,
  setAllowedGptCompanies,
} from "@/lib/gpt-actions";

export const dynamic = "force-dynamic";

export async function GET() {
  const { connections } = listConnections();
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
  const known = new Set(listConnections().connections.map((connection) => connection.id));
  const ids = body.allowedCompanyIds.filter(
    (value): value is string => typeof value === "string" && known.has(value),
  );
  return NextResponse.json(setAllowedGptCompanies(ids));
}
