import { ExportWizard } from "../export-wizard";

export default async function EditExportPage({ params }: PageProps<"/settings/exports/[id]">) {
  const { id } = await params;
  const publicUrl = (process.env.LINE_PUBLIC_URL ?? "").trim().replace(/\/+$/, "") || "https://sam-bridge.vercel.app";
  return <ExportWizard configId={id} publicUrl={publicUrl} />;
}
