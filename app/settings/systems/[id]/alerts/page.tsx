import { SystemAlerts } from "./system-alerts";

export default async function AdminSystemAlertsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <SystemAlerts machineId={id} />;
}
