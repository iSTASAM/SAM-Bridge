export async function register() {
  // Only the Node.js runtime — not the Edge middleware bundle.
  if (process.env.NEXT_RUNTIME === "edge") return;
  const { ensureNotificationMonitorLoop } = await import("@/lib/notification-monitor-loop");
  ensureNotificationMonitorLoop();
}
