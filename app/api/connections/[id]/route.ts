import { NextResponse } from "next/server";
import { canAccessConnection, getRequestSession } from "@/lib/auth";
import {
  deleteConnection,
  getConnection,
  publicConnection,
  setActiveConnection,
  updateConnection,
} from "@/lib/ixacs-connections";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const session = await getRequestSession();
  if (!canAccessConnection(session, id)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const connection = await getConnection(id);
  if (!connection) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(publicConnection(connection));
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const connection = await updateConnection(id, {
      name: typeof body.name === "string" ? body.name : undefined,
      baseUrl: typeof body.baseUrl === "string" ? body.baseUrl : undefined,
      loginUrl: typeof body.loginUrl === "string" ? body.loginUrl : undefined,
      customerId: typeof body.customerId === "string" ? body.customerId : undefined,
      customers: Array.isArray(body.customers) ? body.customers as { id: string; name: string }[] : undefined,
      loginId: typeof body.loginId === "string" ? body.loginId : undefined,
      basicAuth: typeof body.basicAuth === "string" ? body.basicAuth : undefined,
      session: typeof body.session === "string" ? body.session : undefined,
      lineUuids:
        typeof body.lineUuids === "string" || Array.isArray(body.lineUuids)
          ? (body.lineUuids as string[] | string)
          : undefined,
    });
    if (!connection) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(publicConnection(connection));
  } catch (error) {
    const message = error instanceof Error ? error.message : "SAVE_FAILED";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!(await deleteConnection(id))) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}

export async function PUT(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const connection = await setActiveConnection(id);
  if (!connection) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ ok: true, activeId: id });
}
