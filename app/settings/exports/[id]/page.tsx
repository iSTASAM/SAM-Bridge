import { ExportWizard } from "../export-wizard";

export default async function EditExportPage({ params }: PageProps<"/settings/exports/[id]">) {
  const { id } = await params;
  return <ExportWizard configId={id} />;
}
