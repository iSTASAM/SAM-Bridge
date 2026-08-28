import { connectionAsTarget, ixacsFormPost, ixacsWebGet, type IxacsTarget } from "@/lib/ixacs-client";
import { getConnection } from "@/lib/ixacs-connections";

export type RegistInput = {
  productionLineUuid: string;
  andonStatusStyleUuid: string;
  productUuid?: string;
  groupUuid?: string;
};

export type RegistResult = {
  ok: boolean;
  status: number;
  url: string;
  requestBody: string;
  responseText: string;
  responseJson: unknown;
  error?: string;
};

function registMessage(result: { responseJson: unknown; error?: string }) {
  const json = result.responseJson;
  if (json && typeof json === "object" && "message" in json) {
    const message = (json as { message?: unknown }).message;
    if (typeof message === "string" && message.trim()) return message.trim();
  }
  return result.error;
}

function withErrorMessage(result: RegistResult): RegistResult {
  if (result.ok) return result;
  return { ...result, error: registMessage(result) ?? result.error };
}

async function ensureLoginSession(target: IxacsTarget) {
  if (!target.refreshSession) return Boolean(target.session);
  const refreshed = await target.refreshSession();
  if (refreshed) {
    target.session = refreshed;
    return true;
  }
  return Boolean(target.session);
}

function realtimeUrl(baseUrl: string, groupUuid?: string) {
  const origin = baseUrl.replace(/\/+$/, "");
  const url = new URL("/ct-monitor/web/ctMonitor/monitor/realtime", origin);
  if (groupUuid) url.searchParams.set("groupUuids", groupUuid);
  return url.toString();
}

async function prepareMonitorSession(target: IxacsTarget, groupUuid?: string) {
  const origin = target.baseUrl.replace(/\/+$/, "");
  const groupPage = await ixacsWebGet(
    target,
    `${origin}/ct-monitor/web/ctMonitor/summary/selectGroup`,
  );
  const url = realtimeUrl(target.baseUrl, groupUuid);
  const page = await ixacsWebGet(target, url);
  if (!groupPage.ok || !page.ok) {
    console.warn("Could not initialize iXacs realtime monitor session", {
      groupPageStatus: groupPage.status,
      status: page.status,
      groupUuid: groupUuid ?? null,
    });
  } else {
    console.log("initialized iXacs monitor session", {
      groupUuid: groupUuid ?? null,
      groupPageStatus: groupPage.status,
      realtimeStatus: page.status,
    });
  }
  return url;
}

async function postRegist(
  target: IxacsTarget,
  input: RegistInput,
  productUuid: string,
  canRetrySession: boolean,
) {
  const requestBody = new URLSearchParams({
    productionLineUuid: input.productionLineUuid,
    andonStatusStyleUuid: input.andonStatusStyleUuid,
    productUuid,
  });
  return ixacsFormPost(
    target,
    "/ct-monitor/api/ctMonitor/regist",
    requestBody,
    { referer: realtimeUrl(target.baseUrl, input.groupUuid) },
    canRetrySession,
  );
}

export async function registCtMonitor(
  input: RegistInput,
  connectionId: string,
  sessionOverride: string | null = null,
): Promise<RegistResult> {
  const connection = await getConnection(connectionId);
  if (!connection) {
    return {
      ok: false,
      status: 401,
      url: "",
      requestBody: "",
      responseText: "",
      responseJson: null,
      error: "No SESSION. Add an iXacs connection in Settings.",
    };
  }

  const target = connectionAsTarget(connection);
  const explicitSession = Boolean(sessionOverride?.trim());

  if (explicitSession) {
    target.session = sessionOverride!.trim();
  } else if (!target.session && connection.password) {
    // Prefer the saved browser/login SESSION. Push webhooks no longer replace
    // it for password-backed connections, and iXacs may scope regist access to
    // the session that opened the realtime monitor page.
    const ok = await ensureLoginSession(target);
    if (!ok || !target.session) {
      return {
        ok: false,
        status: 401,
        url: "",
        requestBody: "",
        responseText: "",
        responseJson: null,
        error: "Could not login to iXacs. Check connection credentials.",
      };
    }
  } else if (!target.session) {
    return {
      ok: false,
      status: 401,
      url: "",
      requestBody: "",
      responseText: "",
      responseJson: null,
      error: "No SESSION. Add an iXacs connection in Settings.",
    };
  }

  const productUuid = input.productUuid ?? "";

  // iXacs scopes regist permission when the realtime monitor page is opened.
  // Match the browser flow before posting the status change.
  await prepareMonitorSession(target, input.groupUuid);

  console.log("\n========== iXacs regist ==========");
  console.log("url:", `${target.baseUrl}/ct-monitor/api/ctMonitor/regist`);
  console.log("session:", target.session ? `${target.session.slice(0, 8)}...` : "(missing)");
  console.log(
    "body:",
    `productionLineUuid=${input.productionLineUuid}&andonStatusStyleUuid=${input.andonStatusStyleUuid}&productUuid=${productUuid}`,
  );

  // ixacsFormPost refreshes only on a real login/HTTP authorization failure.
  // A JSON { success: false } response is a business validation result and
  // must not replace the browser-scoped SESSION saved on the connection.
  let result = await postRegist(target, input, productUuid, !explicitSession);

  // Some lines reject a stale productUuid from push history; retry without it.
  if (!result.ok && productUuid) {
    console.log("retrying regist without productUuid...");
    result = await postRegist(target, input, "", false);
  }

  result = withErrorMessage(result);

  console.log("status:", result.status);
  console.log(
    "response:",
    result.responseJson !== null
      ? JSON.stringify(result.responseJson, null, 2)
      : result.responseText,
  );
  console.log("=================================\n");

  return result;
}
