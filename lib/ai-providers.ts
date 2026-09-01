import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import path from "path";
import {
  connectionSecretsConfigured,
  decryptSecret,
  encryptSecret,
} from "@/lib/connection-secrets";
import { getSupabaseAdmin, supabaseConfigured } from "@/lib/supabase-admin";

export const AI_PROVIDER_KINDS = ["openai", "anthropic", "gemini", "openrouter", "custom"] as const;
export type AiProviderKind = (typeof AI_PROVIDER_KINDS)[number];

export type AiProvider = {
  id: string;
  kind: AiProviderKind;
  name: string;
  apiKey: string;
  keyLast4: string;
  model: string;
  baseUrl: string;
  lastTestedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type PublicAiProvider = Omit<AiProvider, "apiKey"> & { connected: boolean };

export type AiDefaultModel = { providerId: string; model: string };

type DbRow = {
  id: string;
  kind: string;
  name: string;
  api_key: string;
  key_last4: string;
  model: string;
  base_url: string;
  last_tested_at: string | null;
  created_at: string;
  updated_at: string;
};

const FILE = path.join(process.cwd(), "data", "ai-providers.json");
const LEGACY = {
  gemini: path.join(process.cwd(), "data", "gemini-settings.json"),
  openrouter: path.join(process.cwd(), "data", "openrouter-settings.json"),
} as const;

let store = new Map<string, AiProvider>();
let defaultModel: AiDefaultModel | null = null;
let hydrated = false;
let hydratePromise: Promise<void> | null = null;

function last4(value: string) {
  const trimmed = value.trim();
  return trimmed.length >= 4 ? trimmed.slice(-4) : trimmed;
}

function storeSecret(plain: string) {
  if (connectionSecretsConfigured()) return encryptSecret(plain);
  return plain;
}

async function hydrateFromSupabase() {
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    hydrateFromFile();
    return;
  }
  const { data, error } = await supabase.from("ai_providers").select("*").order("created_at", { ascending: true });
  if (error) {
    console.warn(`Supabase ai_providers query failed (${error.message}); falling back to local file.`);
    hydrateFromFile();
    return;
  }
  const rows = (data as DbRow[] | null) ?? [];
  store = new Map(rows.flatMap((row) => {
    const item = rowToProvider(row);
    return item ? [[item.id, item] as const] : [];
  }));
  if (store.size > 0) return;
  hydrateFromFile();
  if (store.size === 0) return;
  const { error: upsertError } = await supabase.from("ai_providers").upsert([...store.values()].map(providerToRow));
  if (upsertError) {
    console.warn(`Supabase ai_providers migration upsert failed (${upsertError.message}).`);
  }
}

function readSecret(stored: string) {
  return stored.startsWith("enc:v1:") ? decryptSecret(stored) : stored;
}

function isKind(value: string): value is AiProviderKind {
  return AI_PROVIDER_KINDS.includes(value as AiProviderKind);
}

function normalize(item: Partial<AiProvider> & { id: string }): AiProvider | null {
  if (!item.id || !isKind(item.kind ?? "")) return null;
  const apiKey = item.apiKey ? readSecret(item.apiKey) : "";
  if (!apiKey) return null;
  const now = new Date().toISOString();
  return {
    id: item.id,
    kind: item.kind as AiProviderKind,
    name: item.name?.trim() || item.id,
    apiKey,
    keyLast4: item.keyLast4 || last4(apiKey),
    model: item.model ?? "",
    baseUrl: item.baseUrl ?? "",
    lastTestedAt: item.lastTestedAt ?? null,
    createdAt: item.createdAt || now,
    updatedAt: item.updatedAt || now,
  };
}

function rowToProvider(row: DbRow): AiProvider | null {
  return normalize({
    id: row.id,
    kind: row.kind as AiProviderKind,
    name: row.name,
    apiKey: row.api_key,
    keyLast4: row.key_last4,
    model: row.model,
    baseUrl: row.base_url,
    lastTestedAt: row.last_tested_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  });
}

function providerToRow(item: AiProvider): DbRow {
  return {
    id: item.id,
    kind: item.kind,
    name: item.name,
    api_key: storeSecret(item.apiKey),
    key_last4: item.keyLast4 || last4(item.apiKey),
    model: item.model,
    base_url: item.baseUrl,
    last_tested_at: item.lastTestedAt,
    created_at: item.createdAt,
    updated_at: item.updatedAt,
  };
}

function publicProvider(item: AiProvider): PublicAiProvider {
  return {
    id: item.id,
    kind: item.kind,
    name: item.name,
    keyLast4: item.keyLast4,
    model: item.model,
    baseUrl: item.baseUrl,
    lastTestedAt: item.lastTestedAt,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
    connected: Boolean(item.apiKey && item.model),
  };
}

function readLegacyFile(kind: "gemini" | "openrouter"): AiProvider | null {
  const file = LEGACY[kind];
  if (!existsSync(file)) return null;
  try {
    const value = JSON.parse(readFileSync(file, "utf8")) as { apiKey?: string; model?: string; updatedAt?: string };
    if (!value.apiKey || !value.model) return null;
    return normalize({
      id: kind,
      kind,
      name: kind === "gemini" ? "Google Gemini" : "OpenRouter",
      apiKey: value.apiKey,
      model: value.model,
      updatedAt: value.updatedAt,
      createdAt: value.updatedAt,
    });
  } catch {
    return null;
  }
}

function hydrateFromFile() {
  defaultModel = null;
  const next = new Map<string, AiProvider>();
  if (existsSync(FILE)) {
    try {
      const parsed = JSON.parse(readFileSync(FILE, "utf8")) as {
        providers?: Record<string, Partial<AiProvider> & { id?: string }>;
        default?: Partial<AiDefaultModel> | null;
      };
      if (parsed.default?.providerId && parsed.default.model) {
        defaultModel = { providerId: parsed.default.providerId, model: parsed.default.model };
      }
      for (const [id, raw] of Object.entries(parsed.providers ?? {})) {
        const item = normalize({ ...raw, id: raw.id || id });
        if (item) next.set(item.id, item);
      }
    } catch {
      /* ignore */
    }
  }
  if (next.size === 0) {
    for (const kind of ["gemini", "openrouter"] as const) {
      const legacy = readLegacyFile(kind);
      if (legacy) next.set(legacy.id, legacy);
    }
  }
  store = next;
}

function persistFile() {
  mkdirSync(path.dirname(FILE), { recursive: true });
  const providers = Object.fromEntries(
    [...store.values()].map((item) => [
      item.id,
      {
        ...item,
        apiKey: connectionSecretsConfigured() ? encryptSecret(item.apiKey) : item.apiKey,
      },
    ]),
  );
  writeFileSync(FILE, JSON.stringify({ providers, default: defaultModel }, null, 2), { encoding: "utf8", mode: 0o600 });
}

async function loadDefaultFromSupabase() {
  const supabase = getSupabaseAdmin();
  if (!supabase) return;
  const { data, error } = await supabase.from("ai_settings").select("default_provider_id, default_model").eq("id", "app").maybeSingle();
  if (error || !data) return;
  const row = data as { default_provider_id?: string | null; default_model?: string | null };
  defaultModel = row.default_provider_id && row.default_model
    ? { providerId: row.default_provider_id, model: row.default_model }
    : null;
}

async function persistDefault() {
  if (supabaseConfigured()) {
    const supabase = getSupabaseAdmin();
    if (supabase) {
      const { error } = await supabase.from("ai_settings").upsert({
        id: "app",
        default_provider_id: defaultModel?.providerId ?? null,
        default_model: defaultModel?.model ?? "",
      });
      if (error) throw new Error(`AI_DEFAULT_SAVE_FAILED: ${error.message}`);
    }
  } else {
    persistFile();
  }
}


async function ensureHydrated() {
  if (hydrated) return;
  if (!hydratePromise) {
    hydratePromise = (async () => {
      if (supabaseConfigured()) {
        await hydrateFromSupabase();
        await loadDefaultFromSupabase();
      } else {
        hydrateFromFile();
      }
      hydrated = true;
    })().finally(() => {
      hydratePromise = null;
    });
  }
  await hydratePromise;
}

async function persist(item: AiProvider) {
  store.set(item.id, item);
  if (supabaseConfigured()) {
    const supabase = getSupabaseAdmin();
    if (!supabase) throw new Error("SUPABASE_NOT_CONFIGURED");
    const { error } = await supabase.from("ai_providers").upsert(providerToRow(item));
    if (error) throw new Error(`AI_PROVIDERS_SAVE_FAILED: ${error.message}`);
    return;
  }
  persistFile();
}

export async function listAiProviders() {
  await ensureHydrated();
  if (supabaseConfigured()) await hydrateFromSupabase();
  return [...store.values()].sort((a, b) => a.name.localeCompare(b.name));
}

export async function listPublicAiProviders() {
  return (await listAiProviders()).map(publicProvider);
}

export async function getAiProvider(id: string) {
  if (supabaseConfigured()) {
    const supabase = getSupabaseAdmin();
    if (!supabase) throw new Error("SUPABASE_NOT_CONFIGURED");
    const { data, error } = await supabase.from("ai_providers").select("*").eq("id", id).maybeSingle();
    if (error) throw new Error(`AI_PROVIDERS_LOAD_FAILED: ${error.message}`);
    const item = data ? rowToProvider(data as DbRow) : null;
    if (item) store.set(id, item);
    else store.delete(id);
    return item;
  }
  await ensureHydrated();
  return store.get(id) ?? null;
}

export async function saveAiProvider(input: {
  id: string;
  kind: AiProviderKind;
  name: string;
  apiKey: string;
  model: string;
  baseUrl?: string;
}) {
  await ensureHydrated();
  const current = store.get(input.id);
  const now = new Date().toISOString();
  const next = normalize({
    id: input.id,
    kind: input.kind,
    name: input.name,
    apiKey: input.apiKey,
    keyLast4: last4(input.apiKey),
    model: input.model,
    baseUrl: input.baseUrl ?? "",
    lastTestedAt: now,
    createdAt: current?.createdAt ?? now,
    updatedAt: now,
  });
  if (!next) throw new Error("AI_PROVIDER_INVALID");
  await persist(next);
  return publicProvider(next);
}

export async function deleteAiProvider(id: string) {
  await ensureHydrated();
  const existed = store.delete(id);
  if (!existed && supabaseConfigured()) {
    const current = await getAiProvider(id);
    if (!current) return false;
    store.delete(id);
  } else if (!existed) {
    return false;
  }
  if (defaultModel?.providerId === id) {
    defaultModel = null;
    await persistDefault();
  }
  if (supabaseConfigured()) {
    const supabase = getSupabaseAdmin();
    if (!supabase) throw new Error("SUPABASE_NOT_CONFIGURED");
    const { error } = await supabase.from("ai_providers").delete().eq("id", id);
    if (error) throw new Error(`AI_PROVIDERS_DELETE_FAILED: ${error.message}`);
  } else {
    persistFile();
  }
  return true;
}

export async function getAiDefault() {
  await ensureHydrated();
  return defaultModel;
}

export async function setAiDefault(next: AiDefaultModel | null) {
  await ensureHydrated();
  defaultModel = next?.providerId && next.model ? next : null;
  await persistDefault();
  return defaultModel;
}
