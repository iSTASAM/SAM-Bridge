import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import path from "path";
import type { AlertRule } from "@/lib/export-configs";

type AlertState = Record<string, Record<string, Record<string, number>>>;
const STATE_FILE = path.join(process.cwd(), "data", "export-alert-state.json");
let state: AlertState = {};
let hydrated = false;

function load() {
  if (hydrated) return;
  hydrated = true;
  if (!existsSync(STATE_FILE)) return;
  try { state = JSON.parse(readFileSync(STATE_FILE, "utf8")) as AlertState; } catch { state = {}; }
}

function persist() {
  mkdirSync(path.dirname(STATE_FILE), { recursive: true });
  writeFileSync(STATE_FILE, JSON.stringify(state, null, 2), "utf8");
}

function number(value: unknown) {
  const parsed = Number.parseFloat(String(value ?? ""));
  return Number.isFinite(parsed) ? parsed : null;
}

function matches(rule: AlertRule, record: Record<string, unknown>) {
  const performance = record.performance && typeof record.performance === "object"
    ? record.performance as Record<string, unknown>
    : {};
  if (rule.metric === "currentCtOverBase") {
    const current = number(performance.currentCt);
    const base = number(performance.baseCt);
    return current !== null && base !== null && current > base;
  }
  const value = number(performance[rule.metric]);
  return value !== null && (rule.operator === "above" ? value > rule.threshold : value < rule.threshold);
}

function actualNum(record: Record<string, unknown>) {
  const production = record.production && typeof record.production === "object"
    ? record.production as Record<string, unknown>
    : {};
  return number(production.actualNum);
}

function ruleKey(rule: AlertRule) {
  return `${rule.metric}:${rule.operator}:${rule.threshold}`;
}

export function getExportAlertProgress(exportId: string, rules: AlertRule[]) {
  load();
  const exportState = state[exportId] ?? {};
  return Object.fromEntries(
    Object.entries(exportState).map(([lineUuid, lineState]) => [
      lineUuid,
      Object.fromEntries(rules.map((rule) => {
        const count = lineState[ruleKey(rule)] ?? 0;
        return [rule.metric, count < 0 ? rule.occurrences : count];
      })),
    ]),
  );
}

export function matchingAlertIndexes(
  exportId: string,
  rules: AlertRule[],
  records: Array<{ key: string; value: Record<string, unknown> }>,
) {
  load();
  const exportState = state[exportId] ?? {};
  const indexes: number[] = [];
  records.forEach((record, index) => {
    const lineState = exportState[record.key] ?? {};
    let notify = false;
    rules.forEach((rule) => {
      const key = ruleKey(rule);
      const stored = lineState[key] ?? 0;
      const previous = stored < 0 ? 0 : stored;
      const matched = matches(rule, record.value);
      if (rule.metric === "currentCtOverBase") {
        const actual = actualNum(record.value);
        const actualKey = `__actual:${key}`;
        const countedKey = `__countedActual:${key}`;
        const previousActual = lineState[actualKey];
        let countedActual = lineState[countedKey];

        // Actual identifies the production cycle. Count a cycle immediately
        // when its Current CT crosses Base CT, but only once for that Actual.
        if (actual === null) {
          lineState[key] = 0;
          return;
        }
        if (previousActual !== undefined && countedActual === undefined) {
          // Migrate state written by the previous cycle-boundary strategy
          // without counting the currently displayed cycle twice.
          countedActual = previousActual;
          lineState[countedKey] = previousActual;
        }
        if (previousActual !== undefined && actual !== previousActual) {
          if (actual < previousActual || countedActual !== previousActual) {
            lineState[key] = 0;
          }
        }
        lineState[actualKey] = actual;
        if (!matched || countedActual === actual) {
          return;
        }

        lineState[countedKey] = actual;
        const count = (lineState[key] ?? 0) + 1;
        if (count >= rule.occurrences) {
          notify = true;
          lineState[key] = 0;
        } else {
          lineState[key] = count;
        }
        return;
      }
      if (!matched) {
        lineState[key] = 0;
        return;
      }
      const count = previous + 1;
      if (count >= rule.occurrences) {
        notify = true;
        lineState[key] = 0;
      } else {
        lineState[key] = count;
      }
    });
    exportState[record.key] = lineState;
    if (notify) indexes.push(index);
  });
  state[exportId] = exportState;
  persist();
  return indexes;
}

export function deleteExportAlertState(exportId: string) {
  load();
  if (!(exportId in state)) return;
  delete state[exportId];
  persist();
}
