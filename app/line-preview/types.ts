export type LinePreviewTone = "available" | "busy" | "offline" | "neutral";

export type LinePreviewRow = {
  id: string;
  name: string;
  status: string;
  tone: LinePreviewTone;
  color: string | null;
};

export type LinePreviewAlert = {
  title: string;
  lineName: string;
  detail: string;
  activityLabel: string;
  activity: string;
} | null;

export type LinePreviewMenuItem = {
  id: string;
  label: string;
  kind: "status" | "ixacs" | "alerts" | "home" | "refresh" | "more";
};

export type LinePreviewModel = {
  source: "live" | "demo";
  oaName: string;
  oaBadge: string;
  connectedLabel: string;
  companyName: string;
  updatedLabel: string;
  updatedAt: string | null;
  userMessage: string;
  botReady: string;
  botAlert: string | null;
  monitorTitle: string;
  detailsCta: string;
  checkCta: string;
  notifyCta: string;
  lines: LinePreviewRow[];
  alert: LinePreviewAlert;
  menu: LinePreviewMenuItem[];
  menuHero: string;
};
