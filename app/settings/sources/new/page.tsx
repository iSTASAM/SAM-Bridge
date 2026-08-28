import { SOURCE_CONNECTORS, type SourceType } from "../types";
import { SourceWizard } from "../source-wizard";

export default async function NewSourcePage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string }>;
}) {
  const { type } = await searchParams;
  const initialType = SOURCE_CONNECTORS.some((item) => item.id === type)
    ? (type as SourceType)
    : undefined;
  return <SourceWizard initialType={initialType} />;
}
