import { randomBytes, randomUUID, scryptSync, timingSafeEqual } from "crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import path from "path";

export type LineAccountStatus = "active" | "suspended" | "disabled";
export type LineLinkStatus = "not_linked" | "linked" | "blocked" | "relink";
export type StoredLineUser = {
  id: string; displayName: string; loginId: string; passwordHash: string;
  customerIds: string[]; accountStatus: LineAccountStatus; lineAllowed: boolean;
  lineUserId: string | null; lineDisplayName: string | null; lineStatus: LineLinkStatus;
  lineLinkedAt: string | null; notificationPermission: boolean; lastLoginAt: string | null;
  createdAt: string; updatedAt: string;
};

const FILE = path.join(process.cwd(), "data", "line-users.json");
function readUsers(): Record<string, StoredLineUser> {
  if (!existsSync(FILE)) return {};
  try { return (JSON.parse(readFileSync(FILE, "utf8")) as { users?: Record<string, StoredLineUser> }).users ?? {}; } catch { return {}; }
}
function writeUsers(users: Record<string, StoredLineUser>) {
  try {
    mkdirSync(path.dirname(FILE), { recursive: true });
    writeFileSync(FILE, JSON.stringify({ users }, null, 2), { encoding: "utf8", mode: 0o600 });
  } catch {
    // Vercel/ephemeral FS: skip durable write so webhook verify can still return 200.
  }
}
function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  return `scrypt:${salt}:${scryptSync(password, salt, 64).toString("hex")}`;
}
function passwordMatches(password: string, encoded: string) {
  const [algorithm, salt, expected] = encoded.split(":");
  if (algorithm !== "scrypt" || !salt || !expected) return false;
  const actual = scryptSync(password, salt, 64); const expectedBuffer = Buffer.from(expected, "hex");
  return actual.length === expectedBuffer.length && timingSafeEqual(actual, expectedBuffer);
}
function normalizeLoginId(value: string) { return value.trim().toLowerCase(); }
function maskLineId(value: string | null) { return value ? `${value.slice(0, 10)}••••••${value.slice(-5)}` : undefined; }

export function publicLineUser(user: StoredLineUser) {
  const { passwordHash: _passwordHash, lineUserId: _lineUserId, ...rest } = user; void _passwordHash; void _lineUserId;
  return { ...rest, lineUserIdMasked: maskLineId(user.lineUserId) };
}
export function listLineUsers() { return Object.values(readUsers()).sort((a, b) => b.createdAt.localeCompare(a.createdAt)); }
export function getLineUser(id: string) { return readUsers()[id] ?? null; }
export function createLineUser(input: { displayName: string; loginId: string; password: string; customerIds: string[]; accountStatus?: string; lineAllowed?: boolean }) {
  const users = readUsers(); const loginId = normalizeLoginId(input.loginId);
  if (!input.displayName.trim() || !loginId || input.password.length < 8 || !input.customerIds.length) throw new Error("INVALID_USER");
  if (Object.values(users).some((user) => normalizeLoginId(user.loginId) === loginId)) throw new Error("LOGIN_ID_EXISTS");
  const now = new Date().toISOString(); const user: StoredLineUser = {
    id: randomUUID(), displayName: input.displayName.trim(), loginId, passwordHash: hashPassword(input.password),
    customerIds: [...new Set(input.customerIds)], accountStatus: input.accountStatus === "disabled" ? "disabled" : "active",
    lineAllowed: input.lineAllowed !== false, lineUserId: null, lineDisplayName: null, lineStatus: "not_linked",
    lineLinkedAt: null, notificationPermission: input.lineAllowed !== false, lastLoginAt: null, createdAt: now, updatedAt: now,
  };
  users[user.id] = user; writeUsers(users); return user;
}
export function updateLineUser(id: string, input: Partial<Pick<StoredLineUser, "displayName" | "customerIds" | "accountStatus" | "lineAllowed" | "notificationPermission">>) {
  const users = readUsers(); const current = users[id]; if (!current) return null;
  users[id] = { ...current,
    displayName: typeof input.displayName === "string" && input.displayName.trim() ? input.displayName.trim() : current.displayName,
    customerIds: Array.isArray(input.customerIds) && input.customerIds.length ? [...new Set(input.customerIds)] : current.customerIds,
    accountStatus: input.accountStatus === "active" || input.accountStatus === "suspended" || input.accountStatus === "disabled" ? input.accountStatus : current.accountStatus,
    lineAllowed: typeof input.lineAllowed === "boolean" ? input.lineAllowed : current.lineAllowed,
    notificationPermission: typeof input.notificationPermission === "boolean" ? input.notificationPermission : current.notificationPermission,
    updatedAt: new Date().toISOString(),
  }; writeUsers(users); return users[id];
}
export function deleteLineUser(id: string) { const users = readUsers(); if (!users[id]) return false; delete users[id]; writeUsers(users); return true; }
export function resetLineUserPassword(id: string, password: string) { const users = readUsers(); const user = users[id]; if (!user || password.length < 8) return null; users[id] = { ...user, passwordHash: hashPassword(password), updatedAt: new Date().toISOString() }; writeUsers(users); return users[id]; }
export function unlinkLineUser(id: string) { const users = readUsers(); const user = users[id]; if (!user) return null; users[id] = { ...user, lineUserId: null, lineDisplayName: null, lineStatus: "not_linked", lineLinkedAt: null, updatedAt: new Date().toISOString() }; writeUsers(users); return users[id]; }
export function authenticateAndLinkLineUser(loginId: string, password: string, lineUserId: string, lineDisplayName: string | null) {
  const users = readUsers(); const user = Object.values(users).find((item) => normalizeLoginId(item.loginId) === normalizeLoginId(loginId));
  if (!user || !passwordMatches(password, user.passwordHash)) throw new Error("INVALID_CREDENTIALS");
  if (user.accountStatus !== "active" || !user.lineAllowed) throw new Error("LINE_ACCESS_DENIED");
  if (user.lineUserId && user.lineUserId !== lineUserId) throw new Error("LINE_LINKED_OTHER");
  if (Object.values(users).some((item) => item.id !== user.id && item.lineUserId === lineUserId)) throw new Error("LINE_USER_ALREADY_LINKED");
  const now = new Date().toISOString(); users[user.id] = { ...user, lineUserId, lineDisplayName, lineStatus: "linked", lineLinkedAt: user.lineLinkedAt ?? now, lastLoginAt: now, updatedAt: now };
  writeUsers(users); return users[user.id];
}
export function markLineFriendship(lineUserId: string, status: "linked" | "blocked") {
  const users = readUsers(); let changed = false;
  for (const [id, user] of Object.entries(users)) if (user.lineUserId === lineUserId) { users[id] = { ...user, lineStatus: status, updatedAt: new Date().toISOString() }; changed = true; }
  if (changed) writeUsers(users);
}
