import { NextResponse } from "next/server";
import { getExportAlertProgress } from "@/lib/export-alert-state";
import { listExportConfigs } from "@/lib/export-configs";

export const dynamic = "force-dynamic";

export async function GET() {
  const progress = Object.fromEntries(
    (await listExportConfigs())
      .filter((config) => config.destinationType === "slack" && config.alertRules.length > 0)
      .map((config) => [config.id, getExportAlertProgress(config.id, config.alertRules)]),
  );
  return NextResponse.json({ progress });
}
