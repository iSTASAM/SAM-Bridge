import { ExportWizard } from "../export-wizard";

export default function NewExportPage() {
  const publicUrl = (process.env.LINE_PUBLIC_URL ?? "").trim().replace(/\/+$/, "") || "https://sam-bridge.vercel.app";
  return <ExportWizard publicUrl={publicUrl} />;
}
