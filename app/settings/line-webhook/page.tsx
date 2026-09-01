import { redirect } from "next/navigation";

export default function LineWebhookRedirectPage() {
  redirect("/settings/systems/line");
}
