import { connectionAsTarget, getCtMonitorData, summarizeMonitorJson, ixacsFormPost } from "../lib/ixacs-client";
import { getConnection } from "../lib/ixacs-connections";
import { loginIxacs } from "../lib/ixacs-login";
import { writeFileSync } from "fs";

async function main() {
  const logs: unknown[] = [];
  const connection = await getConnection("a696b4ae-d36a-4e12-b452-76266b59022b");
  if (!connection) throw new Error("no connection");

  const login = await loginIxacs({
    loginUrl: connection.loginUrl,
    customerId: connection.customerId,
    loginId: connection.loginId,
    password: connection.password,
    basicAuth: connection.basicAuth,
  });
  logs.push({
    loginOk: login.ok,
    loginError: login.error ?? null,
    session: login.session ? login.session.slice(0, 12) : null,
  });

  const target = connectionAsTarget(connection);
  target.session = login.session;

  const dormant = "28759687-4c97-44ca-8bff-2d28d7e8f743";
  const active = "91c8d8f7-015c-425b-ac55-f840f24dbac5";
  const data = await getCtMonitorData(target, [dormant, active]);
  const rows = summarizeMonitorJson(data.responseJson);
  const dormantRow = rows.find((r) => r.uuid === dormant)!;
  const activeRow = rows.find((r) => r.uuid === active)!;

  async function tryRegist(label: string, body: URLSearchParams, referer?: string) {
    const result = await ixacsFormPost(
      target,
      "/ct-monitor/api/ctMonitor/regist",
      body,
      { referer: referer ?? `${target.baseUrl}/ct-monitor/web/ctMonitor/monitor/realtime` },
      false,
    );
    const json = result.responseJson as { message?: string; success?: boolean } | null;
    logs.push({
      label,
      ok: result.ok,
      message: json?.message ?? result.error ?? null,
      success: json?.success ?? null,
      body: body.toString(),
    });
  }

  // Baseline dormant
  await tryRegist(
    "dormant baseline",
    new URLSearchParams({
      productionLineUuid: dormant,
      andonStatusStyleUuid: dormantRow.statusUuid!,
      productUuid: dormantRow.productUuid || "",
    }),
  );

  // Dormant without product key
  const noProduct = new URLSearchParams();
  noProduct.set("productionLineUuid", dormant);
  noProduct.set("andonStatusStyleUuid", dormantRow.statusUuid!);
  await tryRegist("dormant no product key", noProduct);

  // Dormant with groupUuid if we can find it from detail
  const detailBody = new URLSearchParams({
    productionLineUuid: dormant,
    andonStatusStyleUuid: dormantRow.statusUuid!,
    productUuid: dormantRow.productUuid || "",
    productionGroupUuid: "9a34c490-beef-4cda-a996-1081531544c0",
  });
  await tryRegist("dormant + groupUuid", detailBody);

  // Active change to same status — confirm auth works
  await tryRegist(
    "active same",
    new URLSearchParams({
      productionLineUuid: active,
      andonStatusStyleUuid: activeRow.statusUuid!,
      productUuid: activeRow.productUuid || "",
    }),
  );

  // Active change to a different known status from discovery store for DC#1 if any
  // Try status that dormant uses on active line (may fail for other reasons)
  await tryRegist(
    "active -> dormant status uuid",
    new URLSearchParams({
      productionLineUuid: active,
      andonStatusStyleUuid: dormantRow.statusUuid!,
      productUuid: activeRow.productUuid || "",
    }),
  );

  // Try alternate endpoint spellings sometimes seen in iXacs
  for (const path of [
    "/ct-monitor/api/ctMonitor/regist",
    "/ct-monitor/api/ctMonitor/register",
    "/ct-monitor/api/andon/regist",
  ]) {
    const result = await ixacsFormPost(
      target,
      path,
      new URLSearchParams({
        productionLineUuid: dormant,
        andonStatusStyleUuid: dormantRow.statusUuid!,
        productUuid: dormantRow.productUuid || "",
      }),
      undefined,
      false,
    );
    const json = result.responseJson as { message?: string; success?: boolean } | null;
    logs.push({
      label: `path ${path}`,
      ok: result.ok,
      status: result.status,
      message: json?.message ?? result.error ?? result.responseText.slice(0, 120),
    });
  }

  writeFileSync("data/regist-debug.json", JSON.stringify(logs, null, 2), "utf8");
}

main().catch((error) => {
  writeFileSync(
    "data/regist-debug.json",
    JSON.stringify({ error: String(error), stack: (error as Error)?.stack }, null, 2),
    "utf8",
  );
  process.exit(1);
});
