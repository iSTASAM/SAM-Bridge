import { NextRequest, NextResponse } from "next/server";
import { canAccessConnection, getRequestSession } from "@/lib/auth";
import { getLineBoard } from "@/lib/ixacs-store";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ uuid: string }> },
) {
  const { uuid } = await params;
  const board = getLineBoard(uuid, request.nextUrl.searchParams.get("day"));
  if (!board) {
    return NextResponse.json({ error: "Line not found" }, { status: 404 });
  }
  const session = await getRequestSession();
  if (board.connectionId && !canAccessConnection(session, board.connectionId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return NextResponse.json(board);
}
