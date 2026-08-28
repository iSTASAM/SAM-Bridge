import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import path from "path";

const FILE = path.join(process.cwd(), "data", "notification-state.json");
type State = Record<string, Record<string, string | null>>;

function readState(): State {
  if (!existsSync(FILE)) return {};
  try { return JSON.parse(readFileSync(FILE, "utf8")) as State; } catch { return {}; }
}
function writeState(state: State) {
  mkdirSync(path.dirname(FILE), { recursive: true });
  writeFileSync(FILE, JSON.stringify(state, null, 2), "utf8");
}
export function statusTransitions(ruleId: string, current: Record<string, string | null>) {
  const state = readState(); const previous = state[ruleId] ?? {};
  return Object.keys(current).filter((lineId) => previous[lineId] !== current[lineId]);
}
export function rememberNotificationState(ruleId: string, current: Record<string, string | null>) {
  const state = readState(); state[ruleId] = current; writeState(state);
}
export function previousNotificationStatus(ruleId: string, lineId: string) {
  return readState()[ruleId]?.[lineId];
}
export function rememberNotificationLineStatus(ruleId: string, lineId: string, statusUuid: string | null) {
  const state = readState();
  state[ruleId] = { ...(state[ruleId] ?? {}), [lineId]: statusUuid };
  writeState(state);
}
export function deleteNotificationState(ruleId: string) {
  const state = readState(); delete state[ruleId]; writeState(state);
}
