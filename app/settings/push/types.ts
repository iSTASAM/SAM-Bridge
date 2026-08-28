export type Named = {
  uuid: string;
  nameTh: string;
  nameEn: string;
  nameJa: string;
};

export type KeyStatus = "active" | "disabled";
export type KeyEnvironment = "live" | "test";

export type IssuedKey = {
  key: string;
  createdAt: string;
  name: string | null;
  status: KeyStatus;
  environment: KeyEnvironment;
  expiresAt: string | null;
  lastUsedAt: string | null;
  line: Named | null;
  group: Named | null;
  company: Company | null;
};

export type Company = { id: string; name: string };

export type CatalogLine = { uuid: string; name: string };
export type CatalogGroup = { uuid: string; name: string; lines: CatalogLine[] };
export type CatalogChoice = {
  groupUuid: string;
  groupName: string;
  lineUuid: string;
  lineName: string;
  label: string;
};

export function flattenCatalog(groups: CatalogGroup[]): CatalogChoice[] {
  return groups.flatMap((group) =>
    group.lines.map((line) => ({
      groupUuid: group.uuid,
      groupName: group.name,
      lineUuid: line.uuid,
      lineName: line.name,
      label: group.name && group.name !== line.name ? `${group.name} · ${line.name}` : line.name,
    })),
  );
}
