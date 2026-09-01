import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { IxacsSetupFlow, type DocsSlug } from "../ixacs-setup-flow";

const DOC_SLUGS = new Set<DocsSlug>(["ixacs-connection", "data-explorer", "lost-time", "push-api", "excel-exports", "sap-integration"]);

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  if (slug === "push-api") return { title: "Push API Flow | SAM Bridge", description: "Developer guide for iXacs Push API setup, keys, events, status updates, and notifications." };
  if (slug === "lost-time") return { title: "Lost Time Flow | SAM Bridge", description: "Developer guide for retrieving and aggregating iXacs lost-time data in SAM Bridge." };
  if (slug === "data-explorer") return { title: "Data Explorer Flow | SAM Bridge", description: "Developer guide for loading and displaying iXacs production data in SAM Bridge." };
  if (slug === "excel-exports") return { title: "Excel Exports | SAM Bridge Docs", description: "How SAM Bridge Excel exports read iXacs data and expose .xlsx downloads and Power Query APIs." };
  if (slug === "sap-integration") return { title: "SAP Integration | SAM Bridge Docs", description: "How SAM Bridge connects to SAP Production Orders, maps iXacs data, and simulates confirmations." };
  return { title: "iXacs Connection Flow | SAM Bridge", description: "Developer guide for the iXacs machine connection flow in SAM Bridge settings." };
}

export default async function DocsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!DOC_SLUGS.has(slug as DocsSlug)) notFound();
  return <IxacsSetupFlow docSlug={slug as DocsSlug} />;
}
