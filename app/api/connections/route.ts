import { NextResponse } from "next/server";
import { getRequestSession, sessionConnectionScope } from "@/lib/auth";
import { createConnection, listConnections, publicConnection } from "@/lib/ixacs-connections";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getRequestSession();
  const scope = sessionConnectionScope(session);
  return NextResponse.json(listConnections(scope));
}

export async function POST(request: Request) {
  const body = (await request.json()) as Record<string, unknown>;
  const connection = createConnection({
    name: typeof body.name === "string" ? body.name : undefined,
    baseUrl: typeof body.baseUrl === "string" ? body.baseUrl : undefined,
    loginUrl: typeof body.loginUrl === "string" ? body.loginUrl : undefined,
    customerId: typeof body.customerId === "string" ? body.customerId : undefined,
    loginId: typeof body.loginId === "string" ? body.loginId : undefined,
    basicAuth: typeof body.basicAuth === "string" ? body.basicAuth : undefined,
    session: typeof body.session === "string" ? body.session : undefined,
    lineUuids:
      typeof body.lineUuids === "string" || Array.isArray(body.lineUuids)
        ? (body.lineUuids as string[] | string)
        : undefined,
  });
  return NextResponse.json(publicConnection(connection), { status: 201 });
}
