"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { FiEdit2, FiPlus, FiTrash2, FiX, FiZap } from "react-icons/fi";
import type { Connection } from "../../connections/types";
import { OverlayFrame } from "../../connections/overlay-frame";
import { useLocale, type Locale } from "../../../locale-context";
import {
  StatusChip,
  toggleId,
  type IxacsStatusOption,
  type ProductionGroup,
  type SelectableCustomer,
} from "../../notifications/shared";
import { SYSTEMS_COPY } from "../copy";
import { ChannelPageTitle, SystemsPageShell } from "../systems-channel-nav";

type Destination = {
  id: string;
  name: string;
  channelId: string;
  botTokenConfigured: boolean;
  botTokenPreview: string;
  enabled: boolean;
  aiEnabled: boolean;
};

type NotifyRule = {
  id: string;
  connectionId: string;
  customerId: string;
  customerName: string;
  destinationId: string | null;
  lines: { uuid: string; name: string; groupName: string }[];
  statusByLine: Record<string, IxacsStatusOption[]>;
  lastRunStatus: "success" | "error" | null;
};

const COPY: Record<
  Locale,
  {
    configured: string;
    addSettings: string;
    alerts: string;
    token: string;
    channel: string;
    name: string;
    save: string;
    saving: string;
    saved: string;
    test: string;
    testing: string;
    tested: string;
    edit: string;
    remove: string;
    cancel: string;
    emptyDest: string;
    emptyAlerts: string;
    addAlert: string;
    editAlert: string;
    destLabel: string;
    machine: string;
    groups: string;
    lines: string;
    statuses: string;
    pickPlaceholder: string;
    errorToken: string;
    errorChannel: string;
    errorAuth: string;
    errorGeneric: string;
    errorScope: string;
    errorChannelInfo: string;
    confirmTitle: string;
    confirmBody: string;
    confirmAlertTitle: string;
    confirmAlertBody: string;
    ai: string;
    aiOn: string;
    aiOff: string;
    aiEnabledMsg: string;
    aiDisabledMsg: string;
    eventsTitle: string;
    eventsLead: string;
    eventsUrl: string;
    signingSecret: string;
    signingSecretHint: string;
    signingConfigured: string;
    signingMissing: string;
    saveEvents: string;
    eventsSaved: string;
    errorSigning: string;
    inviteBot: string;
  }
> = {
  th: {
    configured: "ที่ตั้งค่าไว้แล้ว",
    addSettings: "เพิ่มการตั้งค่า",
    alerts: "การแจ้งเตือนสถานะ iXacs",
    token: "Bot User OAuth Token",
    channel: "Channel ID",
    name: "Channel Name",
    save: "บันทึก",
    saving: "กำลังบันทึก…",
    saved: "บันทึกแล้ว",
    test: "ทดสอบส่ง",
    testing: "กำลังทดสอบ…",
    tested: "ส่งข้อความทดสอบสำเร็จ",
    edit: "แก้ไข",
    remove: "ลบ",
    cancel: "ยกเลิก",
    emptyDest: "ยังไม่มี Channel Slack",
    emptyAlerts: "ยังไม่มีการแจ้งเตือน",
    addAlert: "เพิ่มการแจ้งเตือน",
    editAlert: "แก้ไขการแจ้งเตือน",
    destLabel: "ส่งไปที่ Slack Channel",
    machine: "เครื่อง / ลูกค้า",
    groups: "กลุ่ม",
    lines: "ไลน์",
    statuses: "สถานะ",
    pickPlaceholder: "เลือก…",
    errorToken: "ใส่ Bot Token ที่ขึ้นต้นด้วย xoxb-",
    errorChannel: "ใส่ Channel ID แบบ C… หรือ G…",
    errorAuth: "Bot Token ไม่ถูกต้อง หรือยังไม่ได้ Install / Invite Bot",
    errorGeneric: "ดำเนินการไม่สำเร็จ",
    errorScope: "เพิ่ม Bot Token Scope: channels:read, channels:history (และ groups:read, groups:history ถ้า private) แล้ว Reinstall App — เพื่อให้อ่านประวัติการสนทนาและชื่อ Channel ได้",
    errorChannelInfo: "ดึงชื่อ Channel ไม่ได้ — เช็ค Channel ID และ Invite Bot เข้า Channel",
    confirmTitle: "ลบ Channel นี้?",
    confirmBody: "หลังจากลบ จะส่งการแจ้งเตือนไปยัง Channel นี้ไม่ได้อีก จนกว่าจะตั้งค่าใหม่",
    confirmAlertTitle: "ลบการแจ้งเตือนนี้?",
    confirmAlertBody: "กฎการแจ้งเตือนนี้จะถูกลบ และจะไม่ส่งสถานะไป Slack ตามเงื่อนไขนี้อีก",
    ai: "AI",
    aiOn: "ปิดใช้งาน AI",
    aiOff: "เปิดใช้งาน AI",
    aiEnabledMsg: "เปิดใช้งาน AI สำหรับ Channel นี้แล้ว — @mention bot เพื่อถามได้",
    aiDisabledMsg: "ปิดใช้งาน AI สำหรับ Channel นี้แล้ว",
    eventsTitle: "Event Subscriptions",
    eventsLead: "จำเป็นสำหรับ @mention AI — ใส่ Signing Secret และตั้ง Request URL ใน Slack App",
    eventsUrl: "Request URL",
    signingSecret: "Signing Secret",
    signingSecretHint: "จาก Slack App → Basic Information → Signing Secret",
    signingConfigured: "ตั้งค่าแล้ว",
    signingMissing: "ยังไม่ตั้งค่า — @mention จะไม่ทำงาน",
    saveEvents: "บันทึก Signing Secret",
    eventsSaved: "บันทึก Signing Secret แล้ว",
    errorSigning: "ใส่ Signing Secret จาก Slack App (อย่างน้อย 24 ตัวอักษร)",
    inviteBot: "เชิญ @SAM Bridge เข้า Channel ด้วยคำสั่ง /invite @SAM Bridge — ไม่งั้น app_mention จะไม่ถูกส่งมา",
  },
  en: {
    configured: "Configured",
    addSettings: "Add settings",
    alerts: "iXacs status alerts",
    token: "Bot User OAuth Token",
    channel: "Channel ID",
    name: "Channel Name",
    save: "Save",
    saving: "Saving…",
    saved: "Saved",
    test: "Send test",
    testing: "Testing…",
    tested: "Test message sent",
    edit: "Edit",
    remove: "Delete",
    cancel: "Cancel",
    emptyDest: "No Slack channels yet",
    emptyAlerts: "No alerts yet",
    addAlert: "Add alert",
    editAlert: "Edit alert",
    destLabel: "Send to Slack channel",
    machine: "Machine / customer",
    groups: "Group",
    lines: "Line",
    statuses: "Statuses",
    pickPlaceholder: "Select…",
    errorToken: "Enter a Bot Token starting with xoxb-",
    errorChannel: "Enter a Channel ID like C… or G…",
    errorAuth: "Bot Token is invalid or the bot is not installed/invited",
    errorGeneric: "Something went wrong",
    errorScope: "Add Bot Token Scope: channels:read, channels:history (and groups:read, groups:history for private), then reinstall — required to read conversation history and resolve channel names",
    errorChannelInfo: "Could not resolve the channel name — check the Channel ID and invite the bot",
    confirmTitle: "Delete this channel?",
    confirmBody: "After deleting, alerts will no longer be sent to this channel until you set it up again.",
    confirmAlertTitle: "Delete this alert?",
    confirmAlertBody: "This alert rule will be removed and status updates will no longer be sent to Slack under these conditions.",
    ai: "AI",
    aiOn: "Disable AI",
    aiOff: "Enable AI",
    aiEnabledMsg: "AI enabled for this channel — @mention the bot to ask",
    aiDisabledMsg: "AI disabled for this channel",
    eventsTitle: "Event Subscriptions",
    eventsLead: "Required for @mention AI — set Signing Secret here and the Request URL in your Slack App",
    eventsUrl: "Request URL",
    signingSecret: "Signing Secret",
    signingSecretHint: "From Slack App → Basic Information → Signing Secret",
    signingConfigured: "Configured",
    signingMissing: "Missing — @mention AI will not work",
    saveEvents: "Save Signing Secret",
    eventsSaved: "Signing Secret saved",
    errorSigning: "Enter the Slack App Signing Secret (at least 24 characters)",
    inviteBot: "Invite @SAM Bridge with /invite @SAM Bridge — otherwise app_mention events are never delivered",
  },
  ja: {
    configured: "設定済み",
    addSettings: "設定を追加",
    alerts: "iXacs 状態通知",
    token: "Bot User OAuth Token",
    channel: "Channel ID",
    name: "Channel Name",
    save: "保存",
    saving: "保存中…",
    saved: "保存しました",
    test: "テスト送信",
    testing: "テスト中…",
    tested: "テストメッセージを送信しました",
    edit: "編集",
    remove: "削除",
    cancel: "キャンセル",
    emptyDest: "Slack Channel はまだありません",
    emptyAlerts: "通知はまだありません",
    addAlert: "通知を追加",
    editAlert: "通知を編集",
    destLabel: "送信先 Slack Channel",
    machine: "機器 / 顧客",
    groups: "グループ",
    lines: "ライン",
    statuses: "ステータス",
    pickPlaceholder: "選択…",
    errorToken: "xoxb- で始まる Bot Token を入力してください",
    errorChannel: "C… または G… 形式の Channel ID を入力してください",
    errorAuth: "Bot Token が無効か、未インストール/未招待です",
    errorGeneric: "処理に失敗しました",
    errorScope: "Bot Token Scope に channels:read, channels:history（private は groups:read, groups:history）を追加して再インストールしてください。会話履歴や Channel 名を取得するのに必要です",
    errorChannelInfo: "Channel 名を取得できません — Channel ID と Bot の招待を確認してください",
    confirmTitle: "この Channel を削除しますか？",
    confirmBody: "削除すると、再設定するまでこの Channel へ通知を送れなくなります。",
    confirmAlertTitle: "この通知を削除しますか？",
    confirmAlertBody: "この通知ルールは削除され、同じ条件では Slack へ状態は送られません。",
    ai: "AI",
    aiOn: "AI を無効化",
    aiOff: "AI を有効化",
    aiEnabledMsg: "この Channel で AI を有効にしました — @mention で質問できます",
    aiDisabledMsg: "この Channel の AI を無効にしました",
    eventsTitle: "Event Subscriptions",
    eventsLead: "@mention AI に必須 — Signing Secret を保存し、Slack App に Request URL を設定してください",
    eventsUrl: "Request URL",
    signingSecret: "Signing Secret",
    signingSecretHint: "Slack App → Basic Information → Signing Secret",
    signingConfigured: "設定済み",
    signingMissing: "未設定 — @mention AI は動きません",
    saveEvents: "Signing Secret を保存",
    eventsSaved: "Signing Secret を保存しました",
    errorSigning: "Slack App の Signing Secret を入力してください（24文字以上）",
    inviteBot: "/invite @SAM Bridge で Bot を Channel に招待してください — 未招待だと app_mention が届きません",
  },
};

function friendlyError(code: string, copy: (typeof COPY)[Locale]) {
  if (code === "INVALID_SLACK_BOT_TOKEN") return copy.errorToken;
  if (code === "INVALID_SLACK_CHANNEL_ID") return copy.errorChannel;
  if (code === "INVALID_SLACK_SIGNING_SECRET") return copy.errorSigning;
  if (code === "PUBLIC_HTTPS_URL_REQUIRED") return copy.errorGeneric;
  if (code.startsWith("SLACK_MISSING_SCOPE") || code.includes("missing_scope")) return copy.errorScope;
  if (code.startsWith("SLACK_CHANNEL_INFO_FAILED")) return copy.errorChannelInfo;
  if (code.startsWith("SLACK_AUTH_FAILED") || code.includes("not_in_channel") || code.includes("channel_not_found")) {
    return copy.errorAuth;
  }
  return code || copy.errorGeneric;
}

function buildMachines(connections: Connection[]) {
  const groups: { connectionId: string; name: string; items: SelectableCustomer[] }[] = [];
  const singles: SelectableCustomer[] = [];
  for (const connection of connections) {
    const nested = connection.customers ?? [];
    if (nested.length > 0) {
      groups.push({
        connectionId: connection.id,
        name: connection.name,
        items: nested.map((customer) => ({
          key: `${connection.id}:${customer.id}`,
          connectionId: connection.id,
          connectionName: connection.name,
          customerId: customer.id,
          customerName: customer.name || customer.id,
          group: true,
        })),
      });
      continue;
    }
    const customerId = connection.customerId || connection.id;
    singles.push({
      key: `${connection.id}:${customerId}`,
      connectionId: connection.id,
      connectionName: connection.name,
      customerId,
      customerName: connection.name,
      group: false,
    });
  }
  return { groups, singles };
}

export function SlackChannelPage() {
  const { locale } = useLocale();
  const systems = SYSTEMS_COPY[locale];
  const copy = COPY[locale];

  const [destinations, setDestinations] = useState<Destination[]>([]);
  const [rules, setRules] = useState<NotifyRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const [botToken, setBotToken] = useState("");
  const [channelId, setChannelId] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<
    | { kind: "destination"; item: Destination }
    | { kind: "alert"; id: string; label: string }
    | null
  >(null);

  const [alertOpen, setAlertOpen] = useState(false);
  const [editingAlertId, setEditingAlertId] = useState<string | null>(null);
  const pendingAlertHydrate = useRef<{ lineUuid: string; groupName: string; statusIds: string[] } | null>(null);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [destPick, setDestPick] = useState("");
  const [selectedKey, setSelectedKey] = useState("");
  const [groups, setGroups] = useState<ProductionGroup[]>([]);
  const [groupId, setGroupId] = useState("");
  const [lineId, setLineId] = useState("");
  const [statusIds, setStatusIds] = useState<string[]>([]);
  const [catalog, setCatalog] = useState<IxacsStatusOption[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [scopeLoading, setScopeLoading] = useState(false);
  const [tab, setTab] = useState<"configured" | "alerts" | "events">("configured");
  const [callbackUrl, setCallbackUrl] = useState("");
  const [signingConfigured, setSigningConfigured] = useState(false);
  const [signingSecret, setSigningSecret] = useState("");
  const deleteTitleId = useId();
  const deleteBodyId = useId();
  const settingsTitleId = useId();
  const eventsTitleId = useId();

  const machineLists = useMemo(() => buildMachines(connections), [connections]);
  const allMachines = useMemo(
    () => [...machineLists.groups.flatMap((group) => group.items), ...machineLists.singles],
    [machineLists],
  );
  const selectedMachine = allMachines.find((item) => item.key === selectedKey) ?? null;
  const selectedGroup = groups.find((group) => group.uuid === groupId) ?? null;
  const availableLines = selectedGroup?.lines ?? [];
  const selectedLine = availableLines.find((line) => line.uuid === lineId) ?? null;
  const destMap = useMemo(() => Object.fromEntries(destinations.map((item) => [item.id, item])), [destinations]);

  function resetAlertForm() {
    pendingAlertHydrate.current = null;
    setEditingAlertId(null);
    setDestPick(destinations[0]?.id ?? "");
    setSelectedKey("");
    setGroups([]);
    setGroupId("");
    setLineId("");
    setStatusIds([]);
    setCatalog([]);
  }

  function openAddAlert() {
    resetAlertForm();
    setAlertOpen(true);
  }

  function startEditAlert(rule: NotifyRule) {
    const line = rule.lines[0];
    pendingAlertHydrate.current = {
      lineUuid: line?.uuid ?? "",
      groupName: line?.groupName ?? "",
      statusIds: line ? (rule.statusByLine[line.uuid] ?? []).map((status) => status.uuid) : [],
    };
    setEditingAlertId(rule.id);
    setDestPick(rule.destinationId || destinations[0]?.id || "");
    const machine = allMachines.find(
      (item) => item.connectionId === rule.connectionId && item.customerId === rule.customerId,
    );
    setSelectedKey(machine?.key ?? "");
    setGroupId("");
    setLineId("");
    setStatusIds([]);
    setCatalog([]);
    setAlertOpen(true);
  }

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      const [destRes, ruleRes, connRes, settingsRes] = await Promise.all([
        fetch("/api/slack/destinations", { cache: "no-store" }),
        fetch("/api/notifications", { cache: "no-store" }),
        fetch("/api/connections", { cache: "no-store" }),
        fetch("/api/slack/settings", { cache: "no-store" }),
      ]);
      const destData = (await destRes.json()) as { destinations?: Destination[]; error?: string };
      const ruleData = (await ruleRes.json()) as { rules?: NotifyRule[]; error?: string };
      const connData = (await connRes.json()) as { connections?: Connection[] };
      const settingsData = (await settingsRes.json().catch(() => ({}))) as {
        callbackUrl?: string;
        publicUrl?: string;
        signingSecretConfigured?: boolean;
        error?: string;
      };
      if (!destRes.ok) throw new Error(destData.error || systems.loadError);
      if (!ruleRes.ok) throw new Error(ruleData.error || systems.loadError);
      setDestinations(destData.destinations ?? []);
      setRules((ruleData.rules ?? []).filter((rule) => rule));
      setConnections(connData.connections ?? []);
      const origin = typeof window !== "undefined" ? window.location.origin : "";
      setCallbackUrl(
        settingsData.callbackUrl ||
          (settingsData.publicUrl ? `${settingsData.publicUrl.replace(/\/+$/, "")}/api/slack/events` : "") ||
          (origin ? `${origin}/api/slack/events` : ""),
      );
      setSigningConfigured(Boolean(settingsData.signingSecretConfigured));
    } catch (err) {
      setError(err instanceof Error ? err.message : systems.loadError);
    } finally {
      setLoading(false);
    }
  }, [systems.loadError]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  // While this page is open, poll iXacs like the LINE portal so Slack alerts fire
  // even when Push payloads omit status (same cadence as /settings/notifications).
  useEffect(() => {
    if (rules.length === 0) return;
    let cancelled = false;
    let inFlight = false;
    const tick = async () => {
      if (cancelled || inFlight || document.visibilityState === "hidden") return;
      inFlight = true;
      try {
        await fetch("/api/notifications/monitor", { method: "POST", cache: "no-store" });
      } catch (error) {
        console.warn("Slack notification monitor failed:", error);
      } finally {
        inFlight = false;
      }
    };
    void tick();
    const timer = window.setInterval(() => void tick(), 2000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [rules.length]);

  useEffect(() => {
    if (!selectedMachine) {
      setGroups([]);
      setGroupId("");
      setLineId("");
      setStatusIds([]);
      setCatalog([]);
      return;
    }
    let cancelled = false;
    void (async () => {
      setScopeLoading(true);
      try {
        const response = await fetch(`/api/connections/${selectedMachine.connectionId}/statuses`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ customerId: selectedMachine.customerId }),
        });
        const data = (await response.json()) as { groups?: ProductionGroup[] };
        if (!cancelled) {
          setGroups(data.groups ?? []);
          const pending = pendingAlertHydrate.current;
          if (pending?.lineUuid) {
            const group =
              (data.groups ?? []).find((item) => item.lines.some((line) => line.uuid === pending.lineUuid)) ??
              (data.groups ?? []).find((item) => item.name === pending.groupName);
            setGroupId(group?.uuid ?? "");
            setLineId(pending.lineUuid);
          } else {
            setGroupId("");
            setLineId("");
            setStatusIds([]);
            setCatalog([]);
          }
        }
      } finally {
        if (!cancelled) setScopeLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedMachine]);

  useEffect(() => {
    if (!selectedMachine || !lineId) {
      setCatalog([]);
      setStatusIds([]);
      return;
    }
    let cancelled = false;
    void (async () => {
      setCatalogLoading(true);
      try {
        const response = await fetch(`/api/connections/${selectedMachine.connectionId}/statuses`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            customerId: selectedMachine.customerId,
            lineUuid: lineId,
            groupUuid: groupId || undefined,
          }),
        });
        const data = (await response.json()) as { statuses?: IxacsStatusOption[]; statusesByLine?: Record<string, IxacsStatusOption[]> };
        if (cancelled) return;
        const next = data.statuses ?? data.statusesByLine?.[lineId] ?? [];
        setCatalog(next);
        const pending = pendingAlertHydrate.current;
        if (pending && pending.lineUuid === lineId) {
          setStatusIds(pending.statusIds.filter((id) => next.some((status) => status.uuid === id)));
          pendingAlertHydrate.current = null;
        } else {
          setStatusIds([]);
        }
      } finally {
        if (!cancelled) setCatalogLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [groupId, lineId, selectedMachine]);

  function resetForm() {
    setEditingId(null);
    setBotToken("");
    setChannelId("");
  }

  function openAddSettings() {
    resetForm();
    setSettingsOpen(true);
  }

  function startEdit(item: Destination) {
    setEditingId(item.id);
    setChannelId(item.channelId);
    setBotToken("");
    setSettingsOpen(true);
  }

  async function saveDestination() {
    setBusy("save-dest");
    setMessage(null);
    setError(null);
    try {
      const response = await fetch(editingId ? `/api/slack/destinations/${editingId}` : "/api/slack/destinations", {
        method: editingId ? "PATCH" : "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ channelId, botToken }),
      });
      const data = (await response.json()) as { error?: string; warning?: string | null };
      if (!response.ok) throw new Error(data.error || systems.saveError);
      resetForm();
      setSettingsOpen(false);
      setTab("configured");
      await load();
      if (data.warning) {
        setError(friendlyError(data.warning, copy));
        setMessage(copy.saved);
      } else {
        setMessage(copy.saved);
      }
    } catch (err) {
      setError(friendlyError(err instanceof Error ? err.message : "", copy));
    } finally {
      setBusy(null);
    }
  }

  async function testDestination(id: string) {
    setBusy(`test:${id}`);
    setMessage(null);
    setError(null);
    try {
      const response = await fetch(`/api/slack/destinations/${id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "test" }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(data.error || systems.saveError);
      setMessage(copy.tested);
    } catch (err) {
      setError(friendlyError(err instanceof Error ? err.message : "", copy));
    } finally {
      setBusy(null);
    }
  }

  async function toggleAi(item: Destination) {
    const next = !item.aiEnabled;
    setBusy(`ai:${item.id}`);
    setMessage(null);
    setError(null);
    try {
      const response = await fetch(`/api/slack/destinations/${item.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ aiEnabled: next }),
      });
      const data = (await response.json()) as { destination?: Destination; error?: string };
      if (!response.ok) throw new Error(data.error || systems.saveError);
      setDestinations((current) =>
        current.map((row) => (row.id === item.id ? { ...row, aiEnabled: data.destination?.aiEnabled ?? next } : row)),
      );
      setMessage(next ? copy.aiEnabledMsg : copy.aiDisabledMsg);
    } catch (err) {
      setError(friendlyError(err instanceof Error ? err.message : "", copy));
    } finally {
      setBusy(null);
    }
  }

  async function saveEvents() {
    setBusy("save-events");
    setMessage(null);
    setError(null);
    try {
      let publicUrl: string | undefined;
      if (typeof window !== "undefined") {
        try {
          const origin = new URL(window.location.origin);
          if (origin.protocol === "https:" && !origin.port) publicUrl = origin.origin;
        } catch {
          publicUrl = undefined;
        }
      }
      const response = await fetch("/api/slack/settings", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "events",
          signingSecret,
          publicUrl,
        }),
      });
      const data = (await response.json()) as {
        error?: string;
        signingSecretConfigured?: boolean;
        callbackUrl?: string;
        publicUrl?: string;
      };
      if (!response.ok) throw new Error(data.error || systems.saveError);
      setSigningConfigured(Boolean(data.signingSecretConfigured));
      setCallbackUrl(
        data.callbackUrl ||
          (data.publicUrl ? `${data.publicUrl.replace(/\/+$/, "")}/api/slack/events` : callbackUrl),
      );
      setSigningSecret("");
      setMessage(copy.eventsSaved);
    } catch (err) {
      setError(friendlyError(err instanceof Error ? err.message : "", copy));
    } finally {
      setBusy(null);
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    if (deleteTarget.kind === "destination") {
      const id = deleteTarget.item.id;
      setBusy(`del:${id}`);
      setError(null);
      try {
        const response = await fetch(`/api/slack/destinations/${id}`, { method: "DELETE" });
        const data = (await response.json()) as { error?: string };
        if (!response.ok) throw new Error(data.error || systems.saveError);
        if (editingId === id) resetForm();
        setDeleteTarget(null);
        await load();
      } catch (err) {
        setError(friendlyError(err instanceof Error ? err.message : "", copy));
      } finally {
        setBusy(null);
      }
      return;
    }
    const id = deleteTarget.id;
    setBusy(`del-alert:${id}`);
    setError(null);
    try {
      const response = await fetch(`/api/notifications/${id}`, { method: "DELETE" });
      if (!response.ok) throw new Error(systems.saveError);
      setDeleteTarget(null);
      await load();
    } catch (err) {
      setError(friendlyError(err instanceof Error ? err.message : "", copy));
    } finally {
      setBusy(null);
    }
  }

  async function saveAlert() {
    if (!selectedMachine || !destPick || !selectedLine || !selectedGroup || statusIds.length === 0) return;
    const pickedStatuses = catalog.filter((item) => statusIds.includes(item.uuid));
    if (pickedStatuses.length === 0) return;
    setBusy("save-alert");
    setError(null);
    try {
      const payload = {
        channel: "slack",
        destinationId: destPick,
        connectionId: selectedMachine.connectionId,
        customerId: selectedMachine.customerId,
        customerName: selectedMachine.customerName,
        lines: [{ uuid: selectedLine.uuid, name: selectedLine.name, groupName: selectedGroup.name }],
        statusByLine: {
          [selectedLine.uuid]: pickedStatuses.map((status) => ({
            uuid: status.uuid,
            name: status.name || status.uuid,
            backgroundColor: status.backgroundColor ?? null,
          })),
        },
      };
      const response = await fetch(editingAlertId ? `/api/notifications/${editingAlertId}` : "/api/notifications", {
        method: editingAlertId ? "PATCH" : "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(data.error || systems.saveError);
      setAlertOpen(false);
      resetAlertForm();
      setMessage(copy.saved);
      setTab("alerts");
      await load();
    } catch (err) {
      setError(friendlyError(err instanceof Error ? err.message : "", copy));
    } finally {
      setBusy(null);
    }
  }

  const canSaveDestination =
    Boolean(channelId.trim()) &&
    (/^[CG][A-Z0-9]+$/i.test(channelId.trim())) &&
    (editingId ? !botToken.trim() || /^xoxb-[A-Za-z0-9-]+$/.test(botToken.trim()) : /^xoxb-[A-Za-z0-9-]+$/.test(botToken.trim()));

  const canSaveAlert = Boolean(destPick && selectedMachine && groupId && lineId && statusIds.length > 0);

  const deleting = Boolean(busy?.startsWith("del"));

  return (
    <SystemsPageShell
      copy={systems}
      title={<ChannelPageTitle channel="slack" label={systems.navSlack} />}
      loading={loading}
      onRefresh={() => void load()}
      backHref="/settings/systems/alerts"
      extraActions={
        tab === "alerts" ? (
          <button
            type="button"
            className="btn btn-secondary pac-icon-btn"
            aria-label={copy.addAlert}
            disabled={destinations.length === 0 || loading}
            onClick={openAddAlert}
          >
            <FiPlus size={16} />
          </button>
        ) : tab === "configured" ? (
          <button
            type="button"
            className="btn btn-secondary pac-icon-btn"
            aria-label={copy.addSettings}
            disabled={loading}
            onClick={openAddSettings}
          >
            <FiPlus size={16} />
          </button>
        ) : null
      }
    >
      {!loading && error ? <p className="inline-error">{error}</p> : null}

      <nav className="as-tabs" aria-label={systems.navSlack}>
        <button
          type="button"
          className={`as-tab${tab === "configured" ? " is-active" : ""}`}
          aria-current={tab === "configured" ? "page" : undefined}
          onClick={() => setTab("configured")}
        >
          {copy.configured}
        </button>
        <button
          type="button"
          className={`as-tab${tab === "alerts" ? " is-active" : ""}`}
          aria-current={tab === "alerts" ? "page" : undefined}
          onClick={() => setTab("alerts")}
        >
          {copy.alerts}
        </button>
        <button
          type="button"
          className={`as-tab${tab === "events" ? " is-active" : ""}`}
          aria-current={tab === "events" ? "page" : undefined}
          onClick={() => setTab("events")}
        >
          {copy.eventsTitle}
        </button>
      </nav>

      {tab === "events" ? (
        <section className="as-block as-events-panel as-tab-panel" aria-labelledby={eventsTitleId}>
          <div className="as-events-head">
            <div>
              <h2 id={eventsTitleId}>{copy.eventsTitle}</h2>
              <p>{copy.eventsLead}</p>
            </div>
            <span className={`as-ai-badge${signingConfigured ? " is-on" : ""}`}>
              {signingConfigured ? copy.signingConfigured : copy.signingMissing}
            </span>
          </div>
          <label className="modal-field">
            <span>{copy.eventsUrl}</span>
            <code className="as-events-url">{callbackUrl || "https://<your-domain>/api/slack/events"}</code>
          </label>
          <label className="modal-field">
            <span>{copy.signingSecret}</span>
            <input
              className="machine-input"
              type="password"
              autoComplete="off"
              spellCheck={false}
              value={signingSecret}
              placeholder={signingConfigured ? "••••••••••••••••••••••••" : copy.signingSecretHint}
              onChange={(event) => setSigningSecret(event.target.value)}
            />
          </label>
          <p className="as-events-hint">{copy.inviteBot}</p>
          <div className="as-events-actions">
            <button
              type="button"
              className="btn btn-secondary"
              disabled={Boolean(busy) || signingSecret.trim().length < 24}
              onClick={() => void saveEvents()}
            >
              {busy === "save-events" ? copy.saving : copy.saveEvents}
            </button>
          </div>
        </section>
      ) : null}

      {tab === "configured" ? (
      <section className="as-block as-tab-panel">
        {loading ? (
          <div className="as-console-table-wrap" aria-busy="true">
            <div className="as-console-loading">
              {[0, 1].map((row) => (
                <span key={row} className="skeleton" />
              ))}
            </div>
          </div>
        ) : destinations.length === 0 ? (
          <section className="as-empty as-channel-empty">
            <p>{copy.emptyDest}</p>
          </section>
        ) : (
          <div className="as-console-table-wrap">
            <table className="as-console-table">
              <thead>
                <tr>
                  <th>{copy.name}</th>
                  <th>{copy.token}</th>
                  <th>{copy.channel}</th>
                  <th>{copy.ai}</th>
                  <th className="as-console-actions" />
                </tr>
              </thead>
              <tbody>
                {destinations.map((item) => (
                  <tr key={item.id} className={editingId === item.id ? "is-editing" : undefined}>
                    <td>
                      <strong>{item.name || item.channelId}</strong>
                    </td>
                    <td>
                      <code className="as-token-preview">{item.botTokenPreview || "—"}</code>
                    </td>
                    <td>
                      <code>{item.channelId}</code>
                    </td>
                    <td>
                      <label className="as-ai-toggle" title={item.aiEnabled ? copy.aiOn : copy.aiOff}>
                        <input
                          type="checkbox"
                          checked={item.aiEnabled}
                          disabled={Boolean(busy)}
                          aria-label={item.aiEnabled ? copy.aiOn : copy.aiOff}
                          onChange={() => void toggleAi(item)}
                        />
                        <span className="as-ai-toggle-track" aria-hidden>
                          <span />
                        </span>
                        <strong>{item.aiEnabled ? "ON" : "OFF"}</strong>
                      </label>
                    </td>
                    <td className="as-console-actions">
                      <div className="notify-table-actions">
                        <button type="button" className="btn-icon" aria-label={copy.test} disabled={Boolean(busy)} onClick={() => void testDestination(item.id)}>
                          <FiZap size={16} />
                        </button>
                        <button type="button" className="btn-icon" aria-label={copy.edit} disabled={Boolean(busy)} onClick={() => startEdit(item)}>
                          <FiEdit2 size={16} />
                        </button>
                        <button type="button" className="btn-icon" aria-label={copy.remove} disabled={Boolean(busy)} onClick={() => setDeleteTarget({ kind: "destination", item })}>
                          <FiTrash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      ) : null}

      {tab === "alerts" ? (
      <section className="as-block as-tab-panel">
        {rules.length === 0 ? (
          <section className="as-empty as-channel-empty">
            <p>{copy.emptyAlerts}</p>
          </section>
        ) : (
          <div className="as-console-table-wrap">
            <table className="as-console-table">
              <thead>
                <tr>
                  <th>{copy.machine}</th>
                  <th>{copy.lines}</th>
                  <th>{copy.statuses}</th>
                  <th>{copy.destLabel}</th>
                  <th className="as-console-actions" />
                </tr>
              </thead>
              <tbody>
                {rules.map((rule) => (
                  <tr key={rule.id}>
                    <td>
                      <strong>{rule.customerName || "—"}</strong>
                    </td>
                    <td>{rule.lines.map((line) => line.name).filter(Boolean).join(" · ") || "—"}</td>
                    <td>
                      <span className="as-status-stack">
                        {rule.lines.flatMap((line) =>
                          (rule.statusByLine[line.uuid] ?? []).map((status) => (
                            <StatusChip
                              key={`${line.uuid}:${status.uuid}`}
                              status={{
                                uuid: status.uuid,
                                name: status.name,
                                backgroundColor: status.backgroundColor ?? null,
                                textColor: status.textColor ?? null,
                                blinking: Boolean(status.blinking),
                                blinkingBackgroundColor: status.blinkingBackgroundColor ?? null,
                                blinkingTextColor: status.blinkingTextColor ?? null,
                              }}
                              active
                            />
                          )),
                        )}
                      </span>
                    </td>
                    <td>{rule.destinationId ? destMap[rule.destinationId]?.name || destMap[rule.destinationId]?.channelId || "—" : "—"}</td>
                    <td className="as-console-actions">
                      <div className="notify-table-actions">
                        <button
                          type="button"
                          className="btn-icon"
                          aria-label={copy.edit}
                          disabled={Boolean(busy)}
                          onClick={() => startEditAlert(rule)}
                        >
                          <FiEdit2 size={16} />
                        </button>
                        <button
                          type="button"
                          className="btn-icon"
                          aria-label={copy.remove}
                          disabled={Boolean(busy)}
                          onClick={() =>
                            setDeleteTarget({
                              kind: "alert",
                              id: rule.id,
                              label: rule.customerName || rule.lines.map((line) => line.name).filter(Boolean).join(" · ") || rule.id,
                            })
                          }
                        >
                          <FiTrash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      ) : null}

      {message ? <p className="lw-message as-page-message">{message}</p> : null}

      <OverlayFrame
        open={settingsOpen}
        labelledBy={settingsTitleId}
        onClose={() => {
          if (!busy) {
            setSettingsOpen(false);
            resetForm();
          }
        }}
        className="modal as-alert-modal"
        backdropClassName="modal-backdrop"
      >
        <header className="as-alert-head">
          <div>
            <h2 id={settingsTitleId}>{editingId ? copy.edit : copy.addSettings}</h2>
          </div>
          <button
            type="button"
            className="btn-icon"
            onClick={() => {
              setSettingsOpen(false);
              resetForm();
            }}
            aria-label={copy.cancel}
            disabled={Boolean(busy)}
            data-dialog-initial-focus
          >
            <FiX size={18} />
          </button>
        </header>

        <label className="as-field">
          <span>{copy.token}</span>
          <input
            spellCheck={false}
            value={botToken}
            placeholder={
              editingId
                ? destinations.find((item) => item.id === editingId)?.botTokenPreview || "xoxb-••••••••••••••••"
                : "xoxb-••••••••••••••••"
            }
            autoComplete="off"
            onChange={(event) => setBotToken(event.target.value)}
          />
        </label>
        <label className="as-field">
          <span>{copy.channel}</span>
          <input value={channelId} placeholder="C0123456789" autoComplete="off" onChange={(event) => setChannelId(event.target.value)} />
        </label>

        <div className="as-alert-actions">
          <button
            type="button"
            className="btn btn-secondary"
            disabled={Boolean(busy)}
            onClick={() => {
              setSettingsOpen(false);
              resetForm();
            }}
          >
            {copy.cancel}
          </button>
          <button type="button" className="btn btn-primary" disabled={Boolean(busy) || loading || !canSaveDestination} onClick={() => void saveDestination()}>
            {busy === "save-dest" ? copy.saving : copy.save}
          </button>
        </div>
      </OverlayFrame>

      <OverlayFrame
        open={alertOpen}
        labelledBy="slack-alert-title"
        onClose={() => {
          if (!busy) {
            setAlertOpen(false);
            resetAlertForm();
          }
        }}
        className="modal as-alert-modal"
        backdropClassName="modal-backdrop"
      >
        <header className="as-alert-head">
          <div>
            <h2 id="slack-alert-title">{editingAlertId ? copy.editAlert : copy.addAlert}</h2>
          </div>
          <button
            type="button"
            className="btn-icon"
            onClick={() => {
              setAlertOpen(false);
              resetAlertForm();
            }}
            aria-label={copy.cancel}
            disabled={Boolean(busy)}
            data-dialog-initial-focus
          >
            <FiX size={18} />
          </button>
        </header>

        <label className="as-field">
          <span>{copy.destLabel}</span>
          <select value={destPick} onChange={(event) => setDestPick(event.target.value)}>
            {destinations.length === 0 ? <option value="">{copy.pickPlaceholder}</option> : null}
            {destinations.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name || item.channelId}
              </option>
            ))}
          </select>
        </label>

        <label className="as-field">
          <span>{copy.machine}</span>
          <select
            value={selectedKey}
            onChange={(event) => setSelectedKey(event.target.value)}
            disabled={Boolean(busy)}
          >
            <option value="">{copy.pickPlaceholder}</option>
            {allMachines.map((machine) => (
              <option key={machine.key} value={machine.key}>
                {machine.customerName}
                {machine.connectionName && machine.connectionName !== machine.customerName
                  ? ` · ${machine.connectionName}`
                  : ""}
              </option>
            ))}
          </select>
        </label>

        {selectedMachine ? (
          scopeLoading ? (
            <div className="as-field-skel" aria-busy="true" aria-label={systems.loadingStatuses}>
              <span className="skeleton" />
              <span className="skeleton" />
            </div>
          ) : (
            <>
              <label className="as-field">
                <span>{copy.groups}</span>
                <select
                  value={groupId}
                  onChange={(event) => {
                    setGroupId(event.target.value);
                    setLineId("");
                    setStatusIds([]);
                    setCatalog([]);
                  }}
                >
                  <option value="">{copy.pickPlaceholder}</option>
                  {groups.map((group) => (
                    <option key={group.uuid} value={group.uuid}>
                      {group.name}
                    </option>
                  ))}
                </select>
              </label>

              {groupId ? (
                <label className="as-field">
                  <span>{copy.lines}</span>
                  <select
                    value={lineId}
                    onChange={(event) => {
                      setLineId(event.target.value);
                      setStatusIds([]);
                    }}
                  >
                    <option value="">{copy.pickPlaceholder}</option>
                    {availableLines.map((line) => (
                      <option key={line.uuid} value={line.uuid}>
                        {line.name}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}

              {lineId ? (
                <div className="as-field">
                  <span>{copy.statuses}</span>
                  {catalogLoading ? (
                    <div className="as-field-skel" aria-busy="true" aria-label={systems.loadingStatuses}>
                      <span className="skeleton" />
                      <span className="skeleton" />
                    </div>
                  ) : (
                    <div className="as-status-pick">
                      {catalog.map((status) => {
                        const active = statusIds.includes(status.uuid);
                        return (
                          <button
                            key={status.uuid}
                            type="button"
                            className={`as-status-pick-item${active ? " is-active" : ""}`}
                            aria-pressed={active}
                            onClick={() => setStatusIds((current) => toggleId(current, status.uuid))}
                          >
                            <StatusChip status={status} active={active} />
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              ) : null}
            </>
          )
        ) : null}

        <div className="as-alert-actions">
          <button
            type="button"
            className="btn btn-secondary"
            disabled={Boolean(busy)}
            onClick={() => {
              setAlertOpen(false);
              resetAlertForm();
            }}
          >
            {copy.cancel}
          </button>
          <button
            type="button"
            className="btn btn-primary"
            disabled={Boolean(busy) || !canSaveAlert}
            onClick={() => void saveAlert()}
          >
            {busy === "save-alert" ? copy.saving : copy.save}
          </button>
        </div>
      </OverlayFrame>

      <OverlayFrame
        open={Boolean(deleteTarget)}
        labelledBy={deleteTitleId}
        describedBy={deleteBodyId}
        onClose={() => {
          if (!deleting) setDeleteTarget(null);
        }}
        className="modal"
        backdropClassName="modal-backdrop"
      >
        <h2 id={deleteTitleId}>{deleteTarget?.kind === "alert" ? copy.confirmAlertTitle : copy.confirmTitle}</h2>
        {deleteTarget?.kind === "destination" ? (
          <p className="machine-delete-name">{deleteTarget.item.name || deleteTarget.item.channelId}</p>
        ) : deleteTarget?.kind === "alert" ? (
          <p className="machine-delete-name">{deleteTarget.label}</p>
        ) : null}
        <p id={deleteBodyId} className="modal-copy">
          {deleteTarget?.kind === "alert" ? copy.confirmAlertBody : copy.confirmBody}
        </p>
        <div className="modal-actions">
          <button
            type="button"
            className="btn btn-secondary"
            data-dialog-initial-focus
            onClick={() => setDeleteTarget(null)}
            disabled={deleting}
          >
            {copy.cancel}
          </button>
          <button type="button" className="btn btn-danger" onClick={() => void confirmDelete()} disabled={deleting}>
            {copy.remove}
          </button>
        </div>
      </OverlayFrame>
    </SystemsPageShell>
  );
}
