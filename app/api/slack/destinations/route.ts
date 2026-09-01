import { NextResponse } from "next/server";
import {
  createSlackDestination,
  listSlackDestinations,
  publicSlackDestination,
} from "@/lib/slack-destinations";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const destinations = await listSlackDestinations();
    return NextResponse.json({ destinations: destinations.map(publicSlackDestination) });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "LOAD_FAILED" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const result = await createSlackDestination({
      name: typeof body.name === "string" ? body.name : "",
      channelId: typeof body.channelId === "string" ? body.channelId : "",
      botToken: typeof body.botToken === "string" ? body.botToken : "",
    });
    return NextResponse.json(
      {
        destination: publicSlackDestination(result.destination),
        warning: result.warning || null,
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("[slack/destinations] POST failed", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "SAVE_FAILED" }, { status: 400 });
  }
}
