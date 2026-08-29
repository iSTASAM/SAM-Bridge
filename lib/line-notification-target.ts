import { connectionAsTarget, discoverIxacsLineStatuses, discoverIxacsLines, type IxacsStatus } from "@/lib/ixacs-client";
import type { IxacsConnection } from "@/lib/ixacs-connections";

export async function resolveLineNotificationTarget(
  connection: IxacsConnection,
  lineUuid: string,
  statusUuid: string,
) {
  const target = connectionAsTarget(connection);
  const discovery = await discoverIxacsLines(target);
  const group = discovery.groups.find((item) => item.lines.some((line) => line.uuid === lineUuid));
  const line = group?.lines.find((item) => item.uuid === lineUuid);
  if (!line || !group) return null;

  const fromRealtime = (discovery.statusesByLine[lineUuid] ?? []).find((item) => item.uuid === statusUuid);
  let status: IxacsStatus | undefined = fromRealtime;
  if (!status) {
    const detail = await discoverIxacsLineStatuses(target, group.uuid, lineUuid);
    status = detail.find((item) => item.uuid === statusUuid);
  }
  if (!status) status = discovery.statuses.find((item) => item.uuid === statusUuid);
  if (!status) return null;

  return {
    lineUuid,
    lineName: line.name,
    groupName: group.name,
    statusUuid: status.uuid,
    statusNameTh: status.nameTh,
    statusNameEn: status.nameEn,
    statusNameJa: status.nameJa,
    statusBackgroundColor: status.backgroundColor,
    statusTextColor: status.textColor,
  };
}
