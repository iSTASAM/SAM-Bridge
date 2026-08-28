import { NextResponse } from "next/server";
import { activateConnectionCustomer, resolveRequestedCustomerIds } from "@/lib/ixacs-activate-customer";
import { canAccessConnection, getRequestSession } from "@/lib/auth";
import {
  connectionAsTarget,
  discoverIxacsLineStatuses,
  discoverIxacsLines,
} from "@/lib/ixacs-client";
import { getConnection, rememberConnectionLines } from "@/lib/ixacs-connections";
import { acquireIxacsConnectionLock } from "@/lib/ixacs-request-lock";

export const dynamic = "force-dynamic";

/** Load groups, lines, and statuses for one iXacs customer session.
 *  Optional lineUuid+groupUuid returns the full status catalog for that line only.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const session = await getRequestSession();
  if (!canAccessConnection(session, id)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let connection = await getConnection(id);
  if (!connection) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    customerId?: unknown;
    customerIds?: unknown;
    lineUuid?: unknown;
    groupUuid?: unknown;
  };
  const customerId =
    typeof body.customerId === "string" && body.customerId.trim()
      ? body.customerId.trim()
      : resolveRequestedCustomerIds(connection, body.customerIds)[0] ?? "";
  if (!customerId) {
    return NextResponse.json(
      { ok: false, error: "CUSTOMER_REQUIRED", groups: [], statuses: [], statusesByLine: {} },
      { status: 400 },
    );
  }

  const lineUuid = typeof body.lineUuid === "string" ? body.lineUuid.trim() : "";
  const groupUuid = typeof body.groupUuid === "string" ? body.groupUuid.trim() : "";

  const releaseLock = await acquireIxacsConnectionLock(id);
  try {
    if (connection.customers.length > 0 || (customerId && connection.customerId !== customerId)) {
      const activated = await activateConnectionCustomer(id, customerId, { rediscover: false });
      if (!activated.ok) {
        return NextResponse.json(
          {
            ok: false,
            error: activated.error,
            customerId,
            groups: [],
            statuses: [],
            statusesByLine: {},
          },
          { status: activated.status },
        );
      }
      connection = activated.connection;
    } else {
      connection = await getConnection(id) ?? connection;
    }

    const target = connectionAsTarget(connection);

    if (lineUuid && groupUuid) {
      const statuses = await discoverIxacsLineStatuses(target, groupUuid, lineUuid);
      return NextResponse.json({
        ok: true,
        customerId,
        lineUuid,
        groupUuid,
        statuses,
      });
    }

    const discovery = await discoverIxacsLines(target);
    if (discovery.lineUuids.length > 0) {
      await rememberConnectionLines(id, discovery.lineUuids);
    }

    return NextResponse.json({
      ok: true,
      customerId,
      groups: discovery.groups,
      statuses: discovery.statuses ?? [],
      statusesByLine: discovery.statusesByLine ?? {},
      error: discovery.ok ? undefined : discovery.error,
    });
  } finally {
    releaseLock();
  }
}
