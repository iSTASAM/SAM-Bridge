import { NextResponse } from "next/server";
import { getRequestSession, sessionConnectionScope } from "@/lib/auth";
import { getIssuedKeys, getOverview } from "@/lib/ixacs-store";
import { listConnections } from "@/lib/ixacs-connections";
import { pushKeysStorage } from "@/lib/push-api-keys";
import { supabaseConfigured } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getRequestSession();
  const scope = sessionConnectionScope(session);
  const overview = await getOverview(null, scope);
  return NextResponse.json({
    keys: await getIssuedKeys(scope),
    companies: (await listConnections(scope)).connections.map(({ id, name }) => ({ id, name })),
    groups: overview.groups,
    storage: pushKeysStorage(),
    supabaseConfigured: supabaseConfigured(),
  });
}
