import { LinePortal } from "../line-portal";
import { loadLinePortalData } from "../load-portal-data";

export const dynamic = "force-dynamic";

export default async function LineAccountPage() {
  const data = await loadLinePortalData();
  return <LinePortal {...data} page="account" />;
}
