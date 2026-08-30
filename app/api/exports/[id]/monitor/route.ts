import { NextResponse } from "next/server";
import { getExportConfig } from "@/lib/export-configs";
import { runSlackExport } from "@/lib/export-runner";

export const dynamic = "force-dynamic";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const config = await getExportConfig(id);
  if (!config) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });

  try {
    const result = await runSlackExport(config);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "EXPORT_FAILED";
    return NextResponse.json({ ok: false, error: message }, { status: 502 });
  }
}
