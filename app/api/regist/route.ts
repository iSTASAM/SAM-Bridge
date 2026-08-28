import { NextRequest, NextResponse } from "next/server";
import { canAccessConnection, getRequestSession } from "@/lib/auth";
import { registCtMonitor } from "@/lib/ixacs-regist";
import { getConnection } from "@/lib/ixacs-connections";
import { getLine, isStatusForLine } from "@/lib/ixacs-store";

function readString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export async function POST(request: NextRequest) {
  const contentType = request.headers.get("content-type") ?? "";
  let productionLineUuid = "";
  let andonStatusStyleUuid = "";
  let productUuid = "";
  let sessionOverride = "";
  let connectionId = "";

  if (contentType.includes("application/json")) {
    const body = (await request.json()) as Record<string, unknown>;
    productionLineUuid = readString(body.productionLineUuid);
    andonStatusStyleUuid = readString(body.andonStatusStyleUuid);
    productUuid = readString(body.productUuid);
    sessionOverride = readString(body.session);
    connectionId = readString(body.connectionId);
  } else {
    const form = await request.formData();
    productionLineUuid = readString(form.get("productionLineUuid"));
    andonStatusStyleUuid = readString(form.get("andonStatusStyleUuid"));
    productUuid = readString(form.get("productUuid"));
    sessionOverride = readString(form.get("session"));
    connectionId = readString(form.get("connectionId"));
  }

  if (!connectionId || !productionLineUuid || !andonStatusStyleUuid) {
    return NextResponse.json(
      {
        ok: false,
        error: "connectionId, productionLineUuid and andonStatusStyleUuid are required",
      },
      { status: 400 },
    );
  }

  const session = await getRequestSession();
  if (!canAccessConnection(session, connectionId)) {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }

  const connection = await getConnection(connectionId);
  const line = await getLine(productionLineUuid);
  if (!connection || !line || line.connectionId !== connectionId || !connection.lineUuids.includes(productionLineUuid)) {
    return NextResponse.json({ ok: false, error: "Line does not belong to this company" }, { status: 403 });
  }
  if (!(await isStatusForLine(productionLineUuid, andonStatusStyleUuid))) {
    return NextResponse.json({ ok: false, error: "Status is not available for this line" }, { status: 400 });
  }

  const result = await registCtMonitor(
    { productionLineUuid, andonStatusStyleUuid, productUuid, groupUuid: line.groupUuid },
    connectionId,
    sessionOverride || null,
  );

  return NextResponse.json(result, { status: result.ok ? 200 : 502 });
}
