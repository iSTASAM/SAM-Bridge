import { serveTabularExport } from "@/app/api/power-bi/exports/[id]/route";

export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return serveTabularExport(request, id, "excel");
}
