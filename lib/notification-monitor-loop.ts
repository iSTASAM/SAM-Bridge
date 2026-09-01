import { monitorLineNotifications } from "@/lib/line-notification-runner";
import { monitorSlackNotifications } from "@/lib/notification-runner";

const DEFAULT_MS = 5_000;
const MIN_MS = 2_000;

declare global {
  // Persist across HMR in next dev so we don't stack intervals.
  // eslint-disable-next-line no-var
  var __samBridgeNotificationMonitor: { timer: ReturnType<typeof setInterval> } | undefined;
}

function intervalMs() {
  const raw = Number(process.env.NOTIFICATION_MONITOR_MS ?? DEFAULT_MS);
  if (!Number.isFinite(raw) || raw <= 0) return DEFAULT_MS;
  return Math.max(MIN_MS, raw);
}

/**
 * Local/long-running Node only. Vercel serverless must rely on Push + optional
 * Supabase pg_cron — frequent Vercel Cron is rejected on Hobby.
 */
export function ensureNotificationMonitorLoop() {
  if (process.env.VERCEL) return;
  if (globalThis.__samBridgeNotificationMonitor?.timer) return;

  let inFlight = false;
  const tick = async () => {
    if (inFlight) return;
    inFlight = true;
    try {
      const [slack, line] = await Promise.all([
        monitorSlackNotifications().catch((error) => {
          console.warn("Background Slack monitor failed:", error);
          return null;
        }),
        monitorLineNotifications().catch((error) => {
          console.warn("Background LINE monitor failed:", error);
          return null;
        }),
      ]);
      if (slack && (slack.sent > 0 || slack.errors.length > 0)) {
        console.log("Background Slack monitor:", slack);
      }
      if (line && (line.sent > 0 || line.errors.length > 0)) {
        console.log("Background LINE monitor:", line);
      }
    } finally {
      inFlight = false;
    }
  };

  const timer = setInterval(() => void tick(), intervalMs());
  globalThis.__samBridgeNotificationMonitor = { timer };
  console.log(`SAM Bridge notification monitor loop started (${intervalMs()}ms)`);
  void tick();
}
