const encoder = new TextEncoder();
export const LINE_AUTH_COOKIE = "sam-line-session";
export const LINE_AUTH_MAX_AGE = 60 * 60 * 12;
export type LineSession = { connectionId: string; customerId: string; loginId: string; lineUserId: string; expiresAt: number };
function secret() { return `${process.env.AUTH_PASSWORD ?? ""}:line-session`; }
async function sign(value: string) {
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret()), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return Buffer.from(await crypto.subtle.sign("HMAC", key, encoder.encode(value))).toString("base64url");
}
export async function createLineSessionToken(input: Omit<LineSession, "expiresAt">) {
  if (!process.env.AUTH_PASSWORD) return null;
  const payload = Buffer.from(JSON.stringify({ ...input, expiresAt: Date.now() + LINE_AUTH_MAX_AGE * 1000 })).toString("base64url");
  return `${payload}.${await sign(payload)}`;
}
export async function readLineSessionToken(token?: string): Promise<LineSession | null> {
  if (!token || !process.env.AUTH_PASSWORD) return null; const [payload, signature, extra] = token.split(".");
  if (!payload || !signature || extra || signature !== await sign(payload)) return null;
  try { const value = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as LineSession; return value.connectionId && value.loginId && value.lineUserId && value.expiresAt > Date.now() ? value : null; } catch { return null; }
}
export function lineSessionCookieOptions() { return { httpOnly: true, sameSite: "lax" as const, secure: process.env.NODE_ENV === "production", path: "/line", maxAge: LINE_AUTH_MAX_AGE }; }
