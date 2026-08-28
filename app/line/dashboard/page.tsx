import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { LINE_AUTH_COOKIE, readLineSessionToken } from "@/lib/line-auth";
import { getConnection } from "@/lib/ixacs-connections";
import { connectionAsTarget, discoverIxacsLines } from "@/lib/ixacs-client";
import { LinePortal } from "../line-portal";

export const dynamic = "force-dynamic";

export default async function LineDashboardPage() {
  const session = await readLineSessionToken((await cookies()).get(LINE_AUTH_COOKIE)?.value);
  if (!session) redirect("/line/login");
  const connection = await getConnection(session.connectionId);
  if (!connection || connection.loginId.trim().toLowerCase() !== session.loginId.trim().toLowerCase()) redirect("/line/login");
  const discovery = await discoverIxacsLines(connectionAsTarget(connection));
  const customers = connection.customers.length ? connection.customers : connection.customerId ? [{ id:connection.customerId, name:connection.name }] : [];
  return <LinePortal user={{ displayName:connection.name, customerCompanyId:session.customerId || "ไม่ระบุ", loginId:connection.loginId }} customers={customers} groups={discovery.groups} dataError={discovery.error ?? null} />;
}
