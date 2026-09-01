const encoder = new TextEncoder();

export const AUTH_COOKIE = "ixacs-session";
export const AUTH_COOKIE_MAX_AGE = 60 * 60 * 24 * 7;

export type AuthRole = "admin" | "user";
export type AuthSession = {
  role: AuthRole;
  username: string;
  connectionId?: string;
  adminAccountId?: string;
  expiresAt: number;
};

function bytesToHex(bytes: ArrayBuffer) {
  return [...new Uint8Array(bytes)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function hmacHex(message: string, secret: string) {
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return bytesToHex(await crypto.subtle.sign("HMAC", key, encoder.encode(message)));
}

async function digest(text: string) {
  return new Uint8Array(await crypto.subtle.digest("SHA-256", encoder.encode(text)));
}

function equalBytes(left: Uint8Array, right: Uint8Array) {
  if (left.length !== right.length) return false;
  let diff = 0;
  for (let i = 0; i < left.length; i += 1) diff |= left[i] ^ right[i];
  return diff === 0;
}

function sessionSecret() {
  return process.env.AUTH_PASSWORD ?? "";
}

function decodePayload(value: string): AuthSession | null {
  try {
    const payload = JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as Partial<AuthSession>;
    if ((payload.role !== "admin" && payload.role !== "user") || typeof payload.username !== "string" || typeof payload.expiresAt !== "number") return null;
    return payload as AuthSession;
  } catch {
    return null;
  }
}

export function authConfigured() {
  return Boolean(process.env.AUTH_USER && process.env.AUTH_PASSWORD);
}

export async function safeCredentialsMatch(username: string, password: string, expectedUser: string, expectedPassword: string) {
  const [userA, userB, passA, passB] = await Promise.all([digest(username), digest(expectedUser), digest(password), digest(expectedPassword)]);
  return equalBytes(userA, userB) && equalBytes(passA, passB);
}

export async function credentialsMatch(username: string, password: string) {
  const expectedUser = process.env.AUTH_USER ?? "";
  const expectedPassword = process.env.AUTH_PASSWORD ?? "";
  return Boolean(expectedUser && expectedPassword) && safeCredentialsMatch(username, password, expectedUser, expectedPassword);
}

export async function createSessionToken(session: Omit<AuthSession, "expiresAt">) {
  const secret = sessionSecret();
  if (!secret) return null;
  const payload = Buffer.from(JSON.stringify({ ...session, expiresAt: Date.now() + AUTH_COOKIE_MAX_AGE * 1000 }), "utf8").toString("base64url");
  return `${payload}.${await hmacHex(payload, secret)}`;
}

export async function readSessionToken(token: string | undefined): Promise<AuthSession | null> {
  if (!token) return null;
  const [payload, signature, extra] = token.split(".");
  const secret = sessionSecret();
  if (!payload || !signature || extra || !secret) return null;
  const expected = await hmacHex(payload, secret);
  const [left, right] = await Promise.all([digest(signature), digest(expected)]);
  if (!equalBytes(left, right)) return null;
  const session = decodePayload(payload);
  return session && session.expiresAt > Date.now() ? session : null;
}

export async function isValidSessionToken(token: string | undefined) {
  return Boolean(await readSessionToken(token));
}

export async function getRequestSession(): Promise<AuthSession | null> {
  const { cookies } = await import("next/headers");
  return readSessionToken((await cookies()).get(AUTH_COOKIE)?.value);
}

/** `null` = admin / unrestricted. Otherwise only that connection id is visible. */
export function sessionConnectionScope(session: AuthSession | null): string | null {
  if (!session || session.role === "admin") return null;
  return session.connectionId ?? "";
}

export function canAccessConnection(session: AuthSession | null, connectionId: string) {
  const scope = sessionConnectionScope(session);
  return scope === null || scope === connectionId;
}

export function sessionCookieOptions() {
  return { httpOnly: true, sameSite: "lax" as const, path: "/", secure: process.env.NODE_ENV === "production", maxAge: AUTH_COOKIE_MAX_AGE };
}
