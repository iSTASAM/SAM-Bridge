import { NextResponse } from "next/server";
import { canAccessConnection, getRequestSession } from "@/lib/auth";
import { getIssuedKey, rotateApiKey } from "@/lib/ixacs-store";

export const dynamic = "force-dynamic";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ key: string }> },
) {
  const { key } = await params;
  const issued = getIssuedKey(key);
  if (!issued) {
    return NextResponse.json({ error: "Key not found" }, { status: 404 });
  }
  const session = await getRequestSession();
  if (issued.connectionId && !canAccessConnection(session, issued.connectionId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const rotated = rotateApiKey(key);
  if (!rotated) {
    return NextResponse.json({ error: "Key not found" }, { status: 404 });
  }
  return NextResponse.json(rotated);
}
