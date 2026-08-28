export type DemoSourceId = "ixacs" | "webhook" | "file-upload" | "database" | "mqtt";
export type DemoDestId = "sap-odata" | "power-bi" | "line" | "slack" | "teams";
export type DemoProviderId = "claude" | "openai" | "gemini" | "huggingface" | "openrouter";
export type DemoCompanionId = Exclude<DemoSourceId, "ixacs">;
export type DemoStage =
  | "idle"
  | "source"
  | "ingesting"
  | "processing"
  | "processed"
  | "exporting"
  | "complete";

export type RawPreview =
  | {
      kind: "ixacs";
      kicker: string;
      line: string;
      status: string;
      product: string;
      rows: readonly [string, string][];
    }
  | {
      kind: "webhook";
      kicker: string;
      title: string;
      status: string;
      rows: readonly [string, string][];
    }
  | {
      kind: "csv";
      kicker: string;
      file: string;
      headers: readonly string[];
      rows: readonly string[][];
    }
  | {
      kind: "db";
      kicker: string;
      table: string;
      rows: readonly [string, string][];
    }
  | {
      kind: "mqtt";
      kicker: string;
      topic: string;
      rows: readonly [string, string][];
    };

export type ProcessedPreview = {
  kicker: string;
  title: string;
  status: string;
  rows: readonly [string, string][];
  insight: string;
};

export type OutputPreview =
  | {
      kind: "kpi";
      title: string;
      line: string;
      rows: readonly [string, string][];
    }
  | {
      kind: "record";
      title: string;
      rows: readonly [string, string][];
    }
  | {
      kind: "message";
      title: string;
      body: readonly string[];
    };

export type DemoFlow = {
  sources: readonly [DemoSourceId, DemoCompanionId];
  destination: DemoDestId;
  packets: Partial<Record<DemoSourceId, string>>;
  packetOut: string;
  raw: readonly RawPreview[];
  processed: ProcessedPreview;
  output: OutputPreview;
};

const IXACS_RAW: RawPreview = {
  kind: "ixacs",
  kicker: "iXacs · DC#1",
  line: "DC#1",
  status: "Equipment Operation",
  product: "T351#2",
  rows: [
    ["Plan", "46"],
    ["Actual", "43"],
    ["CT", "40.05 s"],
    ["Volume", "94.0%"],
    ["O.A.", "100.0%"],
    ["Power", "25.2 kWh"],
  ],
};

export const DEMO_FLOWS: readonly DemoFlow[] = [
  {
    sources: ["ixacs", "webhook"],
    destination: "slack",
    packets: { ixacs: "43", webhook: "JSON" },
    packetOut: "✓",
    raw: [
      IXACS_RAW,
      {
        kind: "webhook",
        kicker: "Webhook Event",
        title: "PRESS-07",
        status: "Running",
        rows: [
          ["Temp", "68.4°C"],
          ["Cycle", "39.8 s"],
        ],
      },
    ],
    processed: {
      kicker: "SAM Processed",
      title: "DC#1 + PRESS-07",
      status: "ALIGNED",
      rows: [
        ["Output", "43 / 46"],
        ["Cycle", "39.8 s"],
        ["Temp", "68.4°C"],
        ["Achievement", "94%"],
      ],
      insight: "Press event matched to live DC#1 output",
    },
    output: {
      kind: "message",
      title: "Production update",
      body: ["DC#1 + PRESS-07", "43 / 46 · Cycle 39.8s", "Status: Aligned"],
    },
  },
  {
    sources: ["ixacs", "file-upload"],
    destination: "teams",
    packets: { ixacs: "43", "file-upload": "CSV" },
    packetOut: "✓",
    raw: [
      IXACS_RAW,
      {
        kind: "csv",
        kicker: "Excel / CSV",
        file: "production.csv",
        headers: ["Line", "Product", "Actual"],
        rows: [
          ["DC#1", "T351#2", "43"],
          ["DC#2", "TV2-1#2", "144"],
        ],
      },
    ],
    processed: {
      kicker: "SAM Processed",
      title: "DC#1 · Import Reconciled",
      status: "READY",
      rows: [
        ["Live actual", "43"],
        ["CSV actual", "43"],
        ["Lines", "2"],
        ["Achievement", "94%"],
      ],
      insight: "CSV actuals matched to live DC#1 telemetry",
    },
    output: {
      kind: "message",
      title: "DC#1 status",
      body: ["Live + CSV reconciled", "Actual: 43 / Plan: 46", "O.A.: 100%"],
    },
  },
  {
    sources: ["ixacs", "database"],
    destination: "sap-odata",
    packets: { ixacs: "43", database: "43" },
    packetOut: "✓",
    raw: [
      IXACS_RAW,
      {
        kind: "db",
        kicker: "production_metrics",
        table: "production_metrics",
        rows: [
          ["line_id", "DC#1"],
          ["output", "43"],
          ["target", "46"],
          ["status", "running"],
        ],
      },
    ],
    processed: {
      kicker: "SAM Processed",
      title: "DC#1 · Record Confirmed",
      status: "CONFIRMED",
      rows: [
        ["Line", "DC#1"],
        ["Qty", "43"],
        ["Target", "46"],
        ["Status", "Confirmed"],
      ],
      insight: "Live output confirmed against production_metrics",
    },
    output: {
      kind: "record",
      title: "Production Record",
      rows: [
        ["Line", "DC#1"],
        ["Product", "T351#2"],
        ["Qty", "43"],
        ["Status", "Confirmed"],
      ],
    },
  },
  {
    sources: ["ixacs", "mqtt"],
    destination: "line",
    packets: { ixacs: "43", mqtt: "2.4" },
    packetOut: "✓",
    raw: [
      IXACS_RAW,
      {
        kind: "mqtt",
        kicker: "MQTT Telemetry",
        topic: "factory/dc1/machine/status",
        rows: [
          ["rpm", "1480"],
          ["vibration", "2.4"],
          ["temperature", "68.4"],
        ],
      },
    ],
    processed: {
      kicker: "SAM Processed",
      title: "DC#1 · Telemetry + Output",
      status: "NORMAL",
      rows: [
        ["Output", "43 / 46"],
        ["RPM", "1,480"],
        ["Vibration", "2.4 mm/s"],
        ["Temp", "68.4°C"],
      ],
      insight: "Machine telemetry consistent with running production",
    },
    output: {
      kind: "message",
      title: "DC#1 Production Update",
      body: ["Output: 43 / 46", "Vibration 2.4 · 68.4°C", "Status: Running"],
    },
  },
];

export function flowBySource(source: DemoSourceId) {
  if (source === "ixacs") return DEMO_FLOWS[0];
  return DEMO_FLOWS.find((flow) => flow.sources.includes(source)) ?? DEMO_FLOWS[0];
}

export function flowByDestination(destination: DemoDestId) {
  return DEMO_FLOWS.find((flow) => flow.destination === destination) ?? DEMO_FLOWS[0];
}

export function flowIndexBySource(source: DemoSourceId) {
  if (source === "ixacs") return 0;
  const index = DEMO_FLOWS.findIndex((flow) => flow.sources.includes(source));
  return index >= 0 ? index : 0;
}
