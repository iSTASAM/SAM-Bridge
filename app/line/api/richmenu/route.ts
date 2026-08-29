import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { LINE_AUTH_COOKIE, readLineSessionToken } from "@/lib/line-auth";
import { lineLoginStatus } from "@/lib/line-logins";
import {
  getLineChannelAccessToken,
  getLinkedRichMenuId,
  lineLoggedInRichMenuId,
  linkLoggedInRichMenu,
} from "@/lib/line-messaging";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await readLineSessionToken((await cookies()).get(LINE_AUTH_COOKIE)?.value);
  if (!session) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  const tokenConfigured = Boolean(await getLineChannelAccessToken());
  const status = await lineLoginStatus(session.lineUserId);
  const linked = await getLinkedRichMenuId(session.lineUserId);
  return NextResponse.json({
    ok: true,
    tokenConfigured,
    loginStatus: status,
    expectedRichMenuId: lineLoggedInRichMenuId(),
    linkedRichMenuId: linked,
  });
}

export async function POST() {
  const session = await readLineSessionToken((await cookies()).get(LINE_AUTH_COOKIE)?.value);
  if (!session) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  const status = await lineLoginStatus(session.lineUserId);
  if (status === "out") {
    return NextResponse.json({ ok: false, error: "LOGGED_OUT" }, { status: 403 });
  }
  const result = await linkLoggedInRichMenu(session.lineUserId);
  return NextResponse.json({
    ...result,
    expectedRichMenuId: lineLoggedInRichMenuId(),
  });
}
