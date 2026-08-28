import { SourceWizard } from "../source-wizard";

export default async function EditSourcePage({ params }: PageProps<"/settings/sources/[id]">) {
  const { id } = await params;
  return <SourceWizard configId={id} />;
}
