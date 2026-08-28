import { LostTimePage } from "../../../connections/lost-time-page";

type SearchValue = string | string[] | undefined;

function first(value: SearchValue) {
  return Array.isArray(value) ? value[0] : value;
}

function parseIds(value: SearchValue) {
  return (first(value) ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter((item) => /^[a-zA-Z0-9-]{1,80}$/.test(item));
}

export default async function ProductionLostTimePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, SearchValue>>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const selected = parseIds(query.companies);
  const connectionIds = [...new Set(selected.length ? selected : [id])];
  const customerIds = [...new Set(parseIds(query.customers))];
  const modeValue = first(query.mode);
  const mode = modeValue === "range" || modeValue === "month" || modeValue === "year" ? modeValue : "day";
  const dateQuery: Record<string, string> = { mode };

  if (mode === "range") {
    dateQuery.from = first(query.from) ?? "";
    dateQuery.to = first(query.to) ?? "";
  } else if (mode === "month") {
    dateQuery.month = first(query.month) ?? "";
  } else if (mode === "year") {
    dateQuery.year = first(query.year) ?? "";
  } else {
    dateQuery.date = first(query.date) ?? "";
  }

  return (
    <LostTimePage
      machineId={id}
      connectionIds={connectionIds}
      customerIds={customerIds}
      dateQuery={dateQuery}
    />
  );
}
