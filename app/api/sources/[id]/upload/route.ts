import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { NextResponse } from "next/server";
import { getSourceConfig, updateSourceConfig } from "@/lib/source-configs";

export const dynamic = "force-dynamic";

const MAX_FILE_BYTES = 25 * 1024 * 1024;
const ALLOWED_EXTENSIONS = new Set([".md", ".markdown", ".csv", ".xls", ".xlsx"]);

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const source = getSourceConfig(id);
  if (!source) return NextResponse.json({ error: "Source not found" }, { status: 404 });
  if (source.type !== "file-upload") return NextResponse.json({ error: "This source does not accept file uploads" }, { status: 409 });

  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "File is required" }, { status: 400 });
  const extension = path.extname(file.name).toLowerCase();
  if (!ALLOWED_EXTENSIONS.has(extension)) return NextResponse.json({ error: "Only Markdown, CSV and Excel files are supported" }, { status: 415 });
  if (file.size > MAX_FILE_BYTES) return NextResponse.json({ error: "File must not exceed 25 MB" }, { status: 413 });

  const directory = path.join(process.cwd(), "data", "source-files", id);
  await mkdir(directory, { recursive: true });
  const storedName = `latest${extension}`;
  await writeFile(path.join(directory, storedName), Buffer.from(await file.arrayBuffer()));
  updateSourceConfig(id, { uploadFileName: file.name });
  return NextResponse.json({ ok: true, fileName: file.name, size: file.size });
}
