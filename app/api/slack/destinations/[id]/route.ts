import { NextResponse } from "next/server";
import {
  deleteSlackDestination,
  getSlackDestination,
  publicSlackDestination,
  testSlackDestination,
  updateSlackDestination,
} from "@/lib/slack-destinations";

export const dynamic = "force-dynamic";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const destination = await getSlackDestination(id);
    if (!destination) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
    return NextResponse.json({ destination: publicSlackDestination(destination) });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "LOAD_FAILED" }, { status: 500 });
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    if (body.action === "test") {
      await testSlackDestination(id);
      return NextResponse.json({ ok: true });
    }
    const result = await updateSlackDestination(id, {
      name: typeof body.name === "string" ? body.name : undefined,
      channelId: typeof body.channelId === "string" ? body.channelId : undefined,
      botToken: typeof body.botToken === "string" ? body.botToken : undefined,
      enabled: typeof body.enabled === "boolean" ? body.enabled : undefined,
      aiEnabled: typeof body.aiEnabled === "boolean" ? body.aiEnabled : undefined,
    });
    if (!result) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
    return NextResponse.json({
      destination: publicSlackDestination(result.destination),
      warning: result.warning || null,
    });
  } catch (error) {
    console.error("[slack/destinations] PATCH failed", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "SAVE_FAILED" }, { status: 400 });
  }
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const ok = await deleteSlackDestination(id);
    if (!ok) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "DELETE_FAILED" }, { status: 400 });
  }
}
