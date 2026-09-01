import { createHash, randomBytes, timingSafeEqual } from "crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import path from "path";

type PersistedSettings = {
  keyHash: string;
  keyPrefix: string;
  keyCreatedAt: string | null;
  allowedCompanyIds: string[];
};

const STATE_FILE = path.join(process.cwd(), "data", "gpt-actions.json");
const EMPTY: PersistedSettings = {
  keyHash: "",
  keyPrefix: "",
  keyCreatedAt: null,
  allowedCompanyIds: [],
};

let state: PersistedSettings | null = null;

function hashKey(value: string) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function load() {
  if (state) return state;
  try {
    if (existsSync(STATE_FILE)) {
      const parsed = JSON.parse(readFileSync(STATE_FILE, "utf8")) as Partial<PersistedSettings>;
      state = {
        keyHash: typeof parsed.keyHash === "string" ? parsed.keyHash : "",
        keyPrefix: typeof parsed.keyPrefix === "string" ? parsed.keyPrefix : "",
        keyCreatedAt: typeof parsed.keyCreatedAt === "string" ? parsed.keyCreatedAt : null,
        allowedCompanyIds: Array.isArray(parsed.allowedCompanyIds)
          ? parsed.allowedCompanyIds.filter((value): value is string => typeof value === "string")
          : [],
      };
      return state;
    }
  } catch {
    // A broken settings file must never grant access.
  }
  state = { ...EMPTY };
  return state;
}

function save(next: PersistedSettings) {
  state = next;
  mkdirSync(path.dirname(STATE_FILE), { recursive: true });
  writeFileSync(STATE_FILE, JSON.stringify(next, null, 2), "utf8");
}

export function publicGptActionSettings() {
  const current = load();
  const envConfigured = Boolean(process.env.GPT_ACTION_API_KEY?.trim());
  return {
    configured: envConfigured || Boolean(current.keyHash),
    managedByEnvironment: envConfigured,
    keyPrefix: envConfigured ? "env••••" : current.keyPrefix,
    keyCreatedAt: envConfigured ? null : current.keyCreatedAt,
    allowedCompanyIds: current.allowedCompanyIds,
  };
}

export function rotateGptActionKey() {
  const apiKey = `ixgpt_${randomBytes(24).toString("base64url")}`;
  const current = load();
  save({
    ...current,
    keyHash: hashKey(apiKey),
    keyPrefix: `${apiKey.slice(0, 11)}••••`,
    keyCreatedAt: new Date().toISOString(),
  });
  return { apiKey, ...publicGptActionSettings() };
}

export function setAllowedGptCompanies(companyIds: string[]) {
  const current = load();
  save({ ...current, allowedCompanyIds: [...new Set(companyIds)] });
  return publicGptActionSettings();
}

export function gptCompanyKey(connectionId: string, customerId?: string) {
  return customerId ? `${connectionId}:${customerId}` : connectionId;
}

export function parseGptCompanyKey(value: string) {
  const index = value.indexOf(":");
  if (index <= 0) return { connectionId: value, customerId: undefined as string | undefined };
  return {
    connectionId: value.slice(0, index),
    customerId: value.slice(index + 1) || undefined,
  };
}

export function isGptCompanyAllowed(connectionId: string, customerId?: string) {
  const allowed = load().allowedCompanyIds;
  if (allowed.length === 0) return true;
  if (allowed.includes(connectionId)) return true;
  if (customerId && allowed.includes(gptCompanyKey(connectionId, customerId))) return true;
  const prefix = `${connectionId}:`;
  const granular = allowed.filter((id) => id.startsWith(prefix));
  if (granular.length === 0) return allowed.includes(connectionId);
  return customerId ? granular.includes(gptCompanyKey(connectionId, customerId)) : false;
}

export function authenticateGptAction(request: Request) {
  const header = request.headers.get("authorization") ?? "";
  const match = /^Bearer\s+(.+)$/i.exec(header);
  const supplied = match?.[1]?.trim() ?? "";
  const envKey = process.env.GPT_ACTION_API_KEY?.trim() ?? "";
  const expectedHash = envKey ? hashKey(envKey) : load().keyHash;
  if (!supplied || !expectedHash) return false;
  const suppliedHash = Buffer.from(hashKey(supplied), "hex");
  const expected = Buffer.from(expectedHash, "hex");
  return suppliedHash.length === expected.length && timingSafeEqual(suppliedHash, expected);
}
