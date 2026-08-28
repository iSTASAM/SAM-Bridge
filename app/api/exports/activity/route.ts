import { NextResponse } from "next/server";
import { listExportActivity } from "@/lib/export-activity";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ activities: listExportActivity() });
}
