import { LandingPage } from "./landing-page";
import { loadLinePreviewData } from "./line-preview/load-preview-data";

/** Public marketing landing — always available at `/`. */
export default async function Page() {
  const preview = await loadLinePreviewData("th");
  return <LandingPage preview={preview} />;
}
