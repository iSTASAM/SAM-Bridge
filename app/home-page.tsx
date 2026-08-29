"use client";

import { IntegrationFlowGraph } from "./integration-flow";
import { useLocale } from "./locale-context";

const COPY = {
  th: {
    titleA: "เชื่อมข้อมูลจาก iXacs",
    titleB: "ไปยังทุกระบบที่คุณใช้งาน",
    source: "iXacs",
    sources: [
      { id: "webhook" as const, label: "Webhook" },
      { id: "file-upload" as const, label: "Excel / CSV" },
      { id: "database" as const, label: "Database" },
      { id: "mqtt" as const, label: "MQTT" },
    ],
    bridge: "SAM Bridge",
    dests: [
      { id: "sap-odata" as const, label: "SAP" },
      { id: "power-bi" as const, label: "Power BI" },
      { id: "excel" as const, label: "Excel" },
      { id: "powerpoint" as const, label: "PowerPoint" },
      { id: "line" as const, label: "LINE" },
      { id: "line-works" as const, label: "LINE WORKS" },
      { id: "slack" as const, label: "Slack" },
      { id: "teams" as const, label: "Teams" },
    ],
  },
  en: {
    titleA: "Connect your iXacs data",
    titleB: "to the systems that matter.",
    source: "iXacs",
    sources: [
      { id: "webhook" as const, label: "Webhook" },
      { id: "file-upload" as const, label: "Excel / CSV" },
      { id: "database" as const, label: "Database" },
      { id: "mqtt" as const, label: "MQTT" },
    ],
    bridge: "SAM Bridge",
    dests: [
      { id: "sap-odata" as const, label: "SAP" },
      { id: "power-bi" as const, label: "Power BI" },
      { id: "excel" as const, label: "Excel" },
      { id: "powerpoint" as const, label: "PowerPoint" },
      { id: "line" as const, label: "LINE" },
      { id: "line-works" as const, label: "LINE WORKS" },
      { id: "slack" as const, label: "Slack" },
      { id: "teams" as const, label: "Teams" },
    ],
  },
  ja: {
    titleA: "iXacsのデータを",
    titleB: "使うシステムへつなぐ",
    source: "iXacs",
    sources: [
      { id: "webhook" as const, label: "Webhook" },
      { id: "file-upload" as const, label: "Excel / CSV" },
      { id: "database" as const, label: "Database" },
      { id: "mqtt" as const, label: "MQTT" },
    ],
    bridge: "SAM Bridge",
    dests: [
      { id: "sap-odata" as const, label: "SAP" },
      { id: "power-bi" as const, label: "Power BI" },
      { id: "excel" as const, label: "Excel" },
      { id: "powerpoint" as const, label: "PowerPoint" },
      { id: "line" as const, label: "LINE" },
      { id: "line-works" as const, label: "LINE WORKS" },
      { id: "slack" as const, label: "Slack" },
      { id: "teams" as const, label: "Teams" },
    ],
  },
} as const;

type HomeCopy = (typeof COPY)[keyof typeof COPY];

function HeroSection({ copy }: { copy: HomeCopy }) {
  return (
    <section className="home-hero">
      <h1 className="home-title">
        {copy.titleA}
        <br />
        {copy.titleB}
      </h1>
    </section>
  );
}

function IntegrationFlow({ copy }: { copy: HomeCopy }) {
  return (
    <section className="home-section is-canvas" id="how">
      <IntegrationFlowGraph
        copy={{
          source: copy.source,
          sources: copy.sources,
          bridge: copy.bridge,
          dests: copy.dests,
        }}
      />
    </section>
  );
}

/** Authenticated console home — integration flow (unchanged). */
export function HomePage() {
  const { locale } = useLocale();
  const copy = COPY[locale];

  return (
    <div className="home-page">
      <HeroSection copy={copy} />
      <IntegrationFlow copy={copy} />
    </div>
  );
}
