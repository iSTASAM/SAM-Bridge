import { redirect } from "next/navigation";

export default function LineWebhookRedirectPage() {
  redirect("/settings/notifications/line-webhook");
}
