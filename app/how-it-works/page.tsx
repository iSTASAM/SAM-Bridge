import type { Metadata } from "next";
import { IxacsSetupFlow } from "./ixacs-setup-flow";

export const metadata: Metadata = {
  title: "SAM Bridge Docs",
  description: "Developer documentation for iXacs connections, data explorer, push API, and data exports (Excel, SAP).",
};

export default function HowItWorksPage() {
  return <IxacsSetupFlow />;
}
