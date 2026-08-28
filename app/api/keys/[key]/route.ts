import { NextResponse } from "next/server";
import { canAccessConnection, getRequestSession } from "@/lib/auth";
import { getIssuedKey, revokeApiKey, setApiKeyStatus } from "@/lib/ixacs-store";

export const dynamic = "force-dynamic";

async function assertKeyAccess(key: string) {
  const issued = await getIssuedKey(key);
  if (!issued) return { error: NextResponse.json({ error: "Key not found" }, { status: 404 }) } as const;
  const session = await getRequestSession();
  if (issued.connectionId && !canAccessConnection(session, issued.connectionId)) {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) } as const;
  }
  return { issued } as const;
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ key: string }> },
) {
  const { key } = await params;
  const access = await assertKeyAccess(key);
  if ("error" in access) return access.error;
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const status = body?.status === "disabled" ? "disabled" : body?.status === "active" ? "active" : null;
  if (!status) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }
  const updated = await setApiKeyStatus(key, status);
  if (!updated) {
    return NextResponse.json({ error: "Key not found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true, status: updated.status });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ key: string }> },
) {
  const { key } = await params;
  const access = await assertKeyAccess(key);
  if ("error" in access) return access.error;
  if (!(await revokeApiKey(key))) {
    return NextResponse.json({ error: "Key not found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
