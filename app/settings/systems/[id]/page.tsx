import { SystemUsers } from "./system-users";

export default async function AdminSystemUsersPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <SystemUsers machineId={id} />;
}
