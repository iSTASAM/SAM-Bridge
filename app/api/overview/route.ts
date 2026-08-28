import { NextRequest, NextResponse } from "next/server";
import { getRequestSession, sessionConnectionScope } from "@/lib/auth";
import { getOverview } from "@/lib/ixacs-store";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const session = await getRequestSession();
  const scope = sessionConnectionScope(session);
  return NextResponse.json(await getOverview(request.nextUrl.searchParams.get("day"), scope));
}
