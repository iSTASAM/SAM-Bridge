import { connectionAsTarget, discoverIxacsLines } from "@/lib/ixacs-client";
import {
  getConnection,
  markConnectionResult,
  replaceConnectionLines,
  updateConnection,
  type IxacsConnection,
} from "@/lib/ixacs-connections";
import { loginIxacs } from "@/lib/ixacs-login";

export type ActivateCustomerResult =
  | { ok: true; connection: IxacsConnection; lineCount: number; groupCount: number }
  | { ok: false; error: string; status: number };

function clearConnectionCaches(connectionId: string) {
  const shared = globalThis as typeof globalThis & {
    __ixacsDataDiscoveryCache?: Map<string, unknown>;
    __ixacsProductionDataCache?: Map<string, unknown>;
    __ixacsLostTimeCache?: Map<string, unknown>;
  };
  for (const key of [...(shared.__ixacsDataDiscoveryCache?.keys() ?? [])]) {
    if (key === connectionId || key.startsWith(`${connectionId}:`)) {
      shared.__ixacsDataDiscoveryCache?.delete(key);
    }
  }
  if (shared.__ixacsProductionDataCache) {
    for (const key of [...shared.__ixacsProductionDataCache.keys()]) {
      if (key.startsWith(`${connectionId}:`)) shared.__ixacsProductionDataCache.delete(key);
    }
  }
  if (shared.__ixacsLostTimeCache) {
    for (const key of [...shared.__ixacsLostTimeCache.keys()]) {
      if (key.startsWith(`${connectionId}:`)) shared.__ixacsLostTimeCache.delete(key);
    }
  }
}

/** Login (or re-select) a tenant on this connection and rediscover its lines. */
export async function activateConnectionCustomer(
  connectionId: string,
  customerId: string,
  opts?: { rediscover?: boolean },
): Promise<ActivateCustomerResult> {
  const connection = await getConnection(connectionId);
  if (!connection) {
    return { ok: false, error: "Not found", status: 404 };
  }

  const allowed =
    connection.customers.length === 0 ||
    connection.customers.some((item) => item.id === customerId) ||
    connection.customerId === customerId;
  if (!allowed) {
    return { ok: false, error: "CUSTOMER_NOT_ALLOWED", status: 403 };
  }
  if (!connection.password) {
    return { ok: false, error: "PASSWORD_REQUIRED", status: 400 };
  }

  const alreadyActive =
    connection.customerId === customerId && Boolean(connection.session.trim());
  if (!alreadyActive) {
    const login = await loginIxacs({
      loginUrl: connection.loginUrl,
      customerId: connection.customers.length > 0 ? "" : customerId,
      selectedCustomerId: customerId,
      loginId: connection.loginId,
      password: connection.password,
      basicAuth: connection.basicAuth,
    });

    if (!login.ok || !login.session) {
      await markConnectionResult(connection.id, false, login.error ?? "LOGIN_FAILED");
      return {
        ok: false,
        error: login.error ?? "LOGIN_FAILED",
        status: login.error === "LOGIN_FAILED" ? 401 : 502,
      };
    }

    await replaceConnectionLines(connection.id, []);
    const updated = await updateConnection(connection.id, {
      customerId,
      session: login.session,
      basicAuth: login.basicAuth || connection.basicAuth,
    });
    if (!updated) {
      return { ok: false, error: "Not found", status: 404 };
    }
    await markConnectionResult(updated.id, true);
    clearConnectionCaches(updated.id);
  }

  const fresh = await getConnection(connectionId);
  if (!fresh) {
    return { ok: false, error: "Not found", status: 404 };
  }

  const rediscover = opts?.rediscover !== false;
  let lineCount = fresh.lineUuids.length;
  let groupCount = 0;
  if (rediscover) {
    const discovery = await discoverIxacsLines(connectionAsTarget(fresh));
    groupCount = discovery.groups.length;
    if (discovery.lineUuids.length > 0) {
      await replaceConnectionLines(fresh.id, discovery.lineUuids);
      lineCount = discovery.lineUuids.length;
    }
  }

  const latest = (await getConnection(connectionId)) ?? fresh;
  return { ok: true, connection: latest, lineCount, groupCount };
}

export function resolveRequestedCustomerIds(
  connection: IxacsConnection,
  raw: unknown,
): string[] {
  const fromBody = Array.isArray(raw)
    ? raw
        .filter((value): value is string => typeof value === "string")
        .map((value) => value.trim())
        .filter(Boolean)
    : [];

  if (connection.customers.length === 0) {
    if (fromBody.length > 0) return fromBody.slice(0, 1);
    return connection.customerId ? [connection.customerId] : [];
  }

  const allowed = new Set(connection.customers.map((item) => item.id));
  if (connection.customerId) allowed.add(connection.customerId);

  const selected = (fromBody.length > 0 ? fromBody : connection.customers.map((item) => item.id))
    .filter((id) => allowed.has(id));

  return [...new Set(selected)];
}
