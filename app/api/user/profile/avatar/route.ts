import { NextResponse } from "next/server";
import { getRequestSession } from "@/lib/auth";
import {
  profileIdFromSession,
  readProfileAvatar,
  setProfileAvatar,
} from "@/lib/user-profiles";

export const dynamic = "force-dynamic";

const MAX_BYTES = 2 * 1024 * 1024;
const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

export async function GET() {
  const session = await getRequestSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const avatar = readProfileAvatar(profileIdFromSession(session));
  if (!avatar) return new NextResponse(null, { status: 404 });
  return new NextResponse(new Uint8Array(avatar.buffer), {
    headers: {
      "content-type": avatar.contentType,
      "cache-control": "private, max-age=3600",
    },
  });
}

export async function POST(request: Request) {
  const session = await getRequestSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const form = await request.formData().catch(() => null);
  const file = form?.get("avatar");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "avatar file is required" }, { status: 400 });
  }
  if (!ALLOWED.has(file.type)) {
    return NextResponse.json({ error: "Unsupported image type" }, { status: 400 });
  }
  const buffer = Buffer.from(await file.arrayBuffer());
  if (buffer.length === 0 || buffer.length > MAX_BYTES) {
    return NextResponse.json({ error: "Image must be between 1 byte and 2 MB" }, { status: 400 });
  }

  try {
    const profile = await setProfileAvatar(session, buffer, file.type);
    return NextResponse.json(profile);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not save avatar";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
