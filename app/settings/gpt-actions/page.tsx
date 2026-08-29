import { GptActionsPage } from "./gpt-actions-page";

export default function Page() {
  const publicUrl = (process.env.LINE_PUBLIC_URL ?? "").trim().replace(/\/+$/, "");
  return <GptActionsPage publicUrl={publicUrl} />;
}
