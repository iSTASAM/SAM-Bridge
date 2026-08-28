import { DataExplorer } from "../../connections/data-explorer";

export default async function MachineDataPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <DataExplorer machineId={id} />;
}
