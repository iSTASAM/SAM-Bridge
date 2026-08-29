import { LinePortal } from "../line-portal";
import { loadLinePortalData } from "../load-portal-data";

export const dynamic = "force-dynamic";

export default async function LineNotificationsPage() {
  const data = await loadLinePortalData();
  return <LinePortal {...data} page="notifications" />;
}
