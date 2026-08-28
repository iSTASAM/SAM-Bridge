import { NotificationSetup } from "../notification-setup";

export default async function EditNotificationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <NotificationSetup ruleId={id} />;
}
