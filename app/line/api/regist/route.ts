import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { LINE_AUTH_COOKIE, readLineSessionToken } from "@/lib/line-auth";
import { getConnection } from "@/lib/ixacs-connections";
import { connectionAsTarget, discoverIxacsLines } from "@/lib/ixacs-client";
import { registCtMonitor } from "@/lib/ixacs-regist";
import { dispatchLineStatusChange } from "@/lib/line-notification-runner";
import { isLineControllable } from "@/lib/push-api-keys";

export const dynamic = "force-dynamic";

function readString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export async function POST(request: Request) {
  const session = await readLineSessionToken((await cookies()).get(LINE_AUTH_COOKIE)?.value);
  if (!session) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const productionLineUuid = readString(body.productionLineUuid);
  const andonStatusStyleUuid = readString(body.andonStatusStyleUuid);
  const groupUuid = readString(body.groupUuid);
  const productUuid = readString(body.productUuid);

  if (!productionLineUuid || !andonStatusStyleUuid) {
    return NextResponse.json(
      { ok: false, error: "productionLineUuid and andonStatusStyleUuid are required" },
      { status: 400 },
    );
  }

  const connection = await getConnection(session.connectionId);
  if (!connection || connection.loginId.trim().toLowerCase() !== session.loginId.trim().toLowerCase()) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  if (!(await isLineControllable(connection.id, productionLineUuid))) {
    return NextResponse.json(
      { ok: false, error: "LINE_NOT_CONFIGURED_FOR_PUSH" },
      { status: 403 },
    );
  }

  const discovery = await discoverIxacsLines(connectionAsTarget(connection));
  const allowed = discovery.statusesByLine[productionLineUuid] ?? [];
  if (!allowed.some((status) => status.uuid === andonStatusStyleUuid)) {
    return NextResponse.json({ ok: false, error: "Status is not available for this line" }, { status: 400 });
  }

  const resolvedGroup =
    groupUuid ||
    discovery.groups.find((group) => group.lines.some((line) => line.uuid === productionLineUuid))?.uuid ||
    "";

  const result = await registCtMonitor(
    {
      productionLineUuid,
      andonStatusStyleUuid,
      productUuid,
      groupUuid: resolvedGroup || undefined,
    },
    connection.id,
  );

  if (result.ok) {
    try {
      await dispatchLineStatusChange(
        productionLineUuid,
        andonStatusStyleUuid,
        new Date().toISOString(),
        connection.id,
      );
    } catch (error) {
      console.warn("LINE notification after status change failed:", error);
    }
  }

  return NextResponse.json(result, { status: result.ok ? 200 : 502 });
}
