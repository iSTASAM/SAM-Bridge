import { listConnections } from "@/lib/ixacs-connections";
import { listLineLogins } from "@/lib/line-logins";
import { listLineNotificationRules } from "@/lib/line-notification-rules";
import { getLineUserProfiles } from "@/lib/line-profiles";

export type SystemRule = {
  id: string;
  lineUuid: string;
  lineName: string;
  groupName: string;
  statusUuid: string;
  statusNameTh: string;
  statusNameEn: string;
  statusNameJa: string;
  statusBackgroundColor: string | null;
  statusTextColor: string | null;
  durationMinutes: number;
  enabled: boolean;
  lastNotifiedAt: string | null;
};

export type SystemUser = {
  lineUserId: string;
  loginId: string;
  customerId: string;
  customerName: string;
  loggedIn: boolean;
  lastLoginAt: string | null;
  lastLogoutAt: string | null;
  displayName: string | null;
  pictureUrl: string | null;
  statusMessage: string | null;
  rules: SystemRule[];
};

export type SystemMachine = {
  id: string;
  name: string;
  customers: { id: string; name: string }[];
  companyLabel: string;
  userCount: number;
  onlineCount: number;
  ruleCount: number;
  enabledRuleCount: number;
  lastLoginAt: string | null;
  users: SystemUser[];
};

export type SystemsSummary = {
  machineCount: number;
  machineWithUsers: number;
  userCount: number;
  onlineCount: number;
  ruleCount: number;
  enabledRuleCount: number;
};

function customerName(
  customers: { id: string; name: string }[],
  fallbackName: string,
  customerId: string,
) {
  return customers.find((item) => item.id === customerId)?.name || (customerId ? customerId : fallbackName);
}

function companyLabel(customers: { id: string; name: string }[], users: { customerName: string }[]) {
  const fromUsers = [...new Set(users.map((user) => user.customerName).filter(Boolean))];
  if (fromUsers.length > 0) return fromUsers.join(" · ");
  return customers.map((item) => item.name).filter(Boolean).join(" · ") || "—";
}

export async function getAdminSystemMachines(options?: { withProfiles?: boolean; connectionId?: string }) {
  const [{ connections }, logins, rules] = await Promise.all([
    listConnections(),
    listLineLogins(),
    listLineNotificationRules(),
  ]);
  const scoped = options?.connectionId
    ? connections.filter((item) => item.id === options.connectionId)
    : connections;
  const scopedLogins = options?.connectionId
    ? logins.filter((item) => item.connectionId === options.connectionId)
    : logins;

  const profiles = options?.withProfiles
    ? await getLineUserProfiles(scopedLogins.map((login) => login.lineUserId))
    : new Map();

  const machines: SystemMachine[] = scoped.map((connection) => {
    const customers = [...(connection.customers ?? [])];
    if (connection.customerId && !customers.some((item) => item.id === connection.customerId)) {
      customers.unshift({ id: connection.customerId, name: connection.name });
    }

    const machineLogins = scopedLogins.filter((login) => login.connectionId === connection.id);
    const machineRules = rules.filter((rule) => rule.connectionId === connection.id);
    const users: SystemUser[] = machineLogins
      .map((login) => {
        const profile = profiles.get(login.lineUserId) ?? null;
        const userRules = machineRules.filter((rule) => rule.lineUserId === login.lineUserId);
        return {
          lineUserId: login.lineUserId,
          loginId: login.loginId,
          customerId: login.customerId,
          customerName: customerName(customers, connection.name, login.customerId),
          loggedIn: login.loggedIn,
          lastLoginAt: login.lastLoginAt,
          lastLogoutAt: login.lastLogoutAt,
          displayName: profile?.displayName ?? null,
          pictureUrl: profile?.pictureUrl ?? null,
          statusMessage: profile?.statusMessage ?? null,
          rules: userRules.map((rule) => ({
            id: rule.id,
            lineUuid: rule.lineUuid,
            lineName: rule.lineName,
            groupName: rule.groupName,
            statusUuid: rule.statusUuid,
            statusNameTh: rule.statusNameTh,
            statusNameEn: rule.statusNameEn,
            statusNameJa: rule.statusNameJa,
            statusBackgroundColor: rule.statusBackgroundColor,
            statusTextColor: rule.statusTextColor,
            durationMinutes: rule.durationMinutes,
            enabled: rule.enabled,
            lastNotifiedAt: rule.lastNotifiedAt,
          })),
        };
      })
      .sort((a, b) => Number(b.loggedIn) - Number(a.loggedIn) || (b.lastLoginAt ?? "").localeCompare(a.lastLoginAt ?? ""));

    const lastLoginAt = users
      .map((user) => user.lastLoginAt)
      .filter((value): value is string => Boolean(value))
      .sort()
      .at(-1) ?? null;

    return {
      id: connection.id,
      name: connection.name,
      customers,
      companyLabel: companyLabel(customers, users),
      userCount: users.length,
      onlineCount: users.filter((user) => user.loggedIn).length,
      ruleCount: machineRules.length,
      enabledRuleCount: machineRules.filter((rule) => rule.enabled).length,
      lastLoginAt,
      users,
    };
  });

  const summary: SystemsSummary = {
    machineCount: machines.length,
    machineWithUsers: machines.filter((item) => item.userCount > 0).length,
    userCount: scopedLogins.length,
    onlineCount: scopedLogins.filter((login) => login.loggedIn).length,
    ruleCount: rules.filter((rule) => !options?.connectionId || rule.connectionId === options.connectionId).length,
    enabledRuleCount: rules.filter((rule) => (!options?.connectionId || rule.connectionId === options.connectionId) && rule.enabled).length,
  };

  return { summary, machines };
}
