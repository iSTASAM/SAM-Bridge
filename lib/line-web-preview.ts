/** Allow /line UX review in a normal browser (not only LINE OA). */
export function lineWebPreviewEnabled() {
  if (process.env.LINE_ALLOW_WEB_PREVIEW === "1") return true;
  if (process.env.LINE_ALLOW_WEB_PREVIEW === "0") return false;
  return process.env.NODE_ENV !== "production";
}
