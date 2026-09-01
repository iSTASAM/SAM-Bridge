import { NextResponse } from "next/server";
import { fetchAiUsageHeatmapData } from "@/lib/ai-usage-store";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const daysParam = searchParams.get("days");
    const days = daysParam ? Math.min(365, Math.max(7, parseInt(daysParam, 10) || 365)) : 365;

    const data = await fetchAiUsageHeatmapData(days);
    return NextResponse.json(data);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load AI usage heatmap";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
