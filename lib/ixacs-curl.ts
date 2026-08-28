const UUID_RE =
  /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;

export function extractUuids(text: string) {
  return [...new Set(text.match(UUID_RE) ?? [])];
}

function toBase64(text: string) {
  if (typeof Buffer !== "undefined") return Buffer.from(text, "utf8").toString("base64");
  return btoa(text);
}

export function normalizeBasicAuth(raw: string) {
  const value = raw.trim().replace(/^Basic\s+/i, "");
  if (!value) return "";
  if (value.includes(":")) return toBase64(value);
  return value;
}

export function normalizeSession(raw: string) {
  const value = raw.trim();
  if (!value) return "";
  const fromCookie = value.match(/(?:^|[;\s])SESSION=([^;]+)/i);
  if (fromCookie?.[1]) return fromCookie[1].trim();
  return value.replace(/^SESSION=/i, "").trim();
}

export function normalizeBaseUrl(raw: string) {
  const value = raw.trim().replace(/\/+$/, "");
  if (!value) return "";
  try {
    return new URL(value).origin;
  } catch {
    return value;
  }
}

export function parseLineUuids(raw: string) {
  const fromPairs = [...raw.matchAll(/productionLines=([0-9a-f-]+)/gi)].map(
    (match) => match[1],
  );
  if (fromPairs.length > 0) return [...new Set(fromPairs)];
  return extractUuids(raw);
}

export function parseIxacsCurl(raw: string) {
  const text = raw.replace(/\^/g, "").replace(/\\\n/g, "\n");
  const urlMatch = text.match(/https?:\/\/[^\s"'\\]+/);
  let baseUrl = "";
  if (urlMatch) {
    try {
      baseUrl = new URL(urlMatch[0]).origin;
    } catch {
      baseUrl = "";
    }
  }

  const basicAuth =
    text.match(/authorization:\s*Basic\s+([A-Za-z0-9+/=]+)/i)?.[1] ?? "";
  const session = text.match(/SESSION=([^;\s"'\\]+)/i)?.[1] ?? "";
  const lineUuids = [
    ...new Set(
      [...text.matchAll(/productionLines=([0-9a-f-]+)/gi)].map((match) => match[1]),
    ),
  ];

  const nameFromHost = baseUrl
    ? baseUrl.replace(/^https?:\/\//, "").replace(/\.ixacs\.jp$/i, "")
    : "";

  return {
    name: nameFromHost,
    baseUrl,
    basicAuth,
    session,
    lineUuids,
  };
}
