import { createHash } from "crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import path from "path";

type RunState = Record<string, Record<string, string>>;

const STATE_FILE = path.join(process.cwd(), "data", "export-run-state.json");
let state: RunState = {};
let hydrated = false;

function hydrate() {
  if (hydrated) return;
  hydrated = true;
  if (!existsSync(STATE_FILE)) return;
  try {
    state = JSON.parse(readFileSync(STATE_FILE, "utf8")) as RunState;
  } catch {
    state = {};
  }
}

function persist() {
  mkdirSync(path.dirname(STATE_FILE), { recursive: true });
  writeFileSync(STATE_FILE, JSON.stringify(state, null, 2), "utf8");
}

function hashRecord(record: unknown) {
  return createHash("sha256").update(JSON.stringify(record)).digest("hex");
}

export function changedRecordIndexes(
  exportId: string,
  records: Array<{ key: string; value: unknown }>,
) {
  hydrate();
  const previous = state[exportId] ?? {};
  const next = Object.fromEntries(records.map(({ key, value }) => [key, hashRecord(value)]));
  const indexes = records.flatMap(({ key }, index) =>
    previous[key] === next[key] ? [] : [index],
  );
  return { indexes, next };
}

export function rememberExportRunState(exportId: string, hashes: Record<string, string>) {
  hydrate();
  state[exportId] = hashes;
  persist();
}

export function deleteExportRunState(exportId: string) {
  hydrate();
  if (!(exportId in state)) return;
  delete state[exportId];
  persist();
}
