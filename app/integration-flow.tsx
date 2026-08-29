"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState, type ComponentType, type CSSProperties } from "react";
import { ClaudeIcon, GeminiIcon, HuggingFaceIcon, OpenAIIcon, OpenRouterIcon } from "./flow/ai-icons";
import {
  flowByDestination,
  flowBySource,
  type DemoDestId,
  type DemoFlow,
  type DemoProviderId,
  type DemoSourceId,
  type DemoStage,
} from "./flow/demo-data";
import { DataPacket } from "./flow/packet";
import { useDemoFlow } from "./flow/use-demo-flow";
import { DEST_ICONS } from "./settings/exports/destination-icons";
import type { DestinationType } from "./settings/exports/types";
import { SOURCE_ICONS } from "./settings/sources/source-icons";
import type { SourceType } from "./settings/sources/types";
import { LINE_WORKS_ICON } from "./settings/notifications/shared";
import { IxacsLogo } from "./line/ixacs-logo";

export type FlowSourceId = Extract<SourceType, "webhook" | "file-upload" | "database" | "mqtt">;
type ConnectedDestId = Extract<DestinationType, "sap-odata" | "power-bi" | "line" | "slack" | "teams">;
export type FlowDestId = ConnectedDestId | "excel" | "powerpoint" | "line-works";
export type FlowDest = { id: FlowDestId; label: string };
export type FlowSource = { id: FlowSourceId; label: string };
export type FlowProviderId = DemoProviderId;

export type FlowCopy = {
  source: string;
  sources: readonly FlowSource[];
  bridge: string;
  dests: readonly FlowDest[];
};

type NodeId = "ixacs" | "bridge" | FlowSourceId | FlowDestId | FlowProviderId;
type Hover = NodeId | null;
type LinkId = `${FlowSourceId | "ixacs"}-bridge` | `bridge-${FlowDestId}` | `${FlowProviderId}-bridge`;
type LinkRank = "is-feed" | "is-out" | "is-ai";
type Point = { x: number; y: number };
type Link = { id: LinkId; d: string; rank: LinkRank };

type View = {
  sources: DemoSourceId[];
  dests: FlowDestId[];
  providers: DemoProviderId[];
  stage: DemoStage;
  flow: DemoFlow;
};

const SOURCE_IDS: FlowSourceId[] = ["webhook", "file-upload", "database", "mqtt"];
const DEST_IDS: FlowDestId[] = [
  "sap-odata",
  "power-bi",
  "excel",
  "powerpoint",
  "line",
  "line-works",
  "slack",
  "teams",
];
const ALL_SOURCES: DemoSourceId[] = ["ixacs", ...SOURCE_IDS];
const PROVIDERS = [
  { id: "claude" as const, name: "Claude", Icon: ClaudeIcon },
  { id: "openai" as const, name: "OpenAI", Icon: OpenAIIcon },
  { id: "gemini" as const, name: "Gemini", Icon: GeminiIcon },
  { id: "huggingface" as const, name: "Hugging Face", Icon: HuggingFaceIcon },
  { id: "openrouter" as const, name: "OpenRouter", Icon: OpenRouterIcon },
];
const ALL_PROVIDERS = PROVIDERS.map((item) => item.id);

function ExcelIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden>
      <rect width="15" height="18" x="7" y="3" rx="2" fill="#21A366" />
      <path fill="#107C41" d="M7 7h15v4H7zM7 15h15v4H7z" opacity=".72" />
      <rect width="12" height="14" x="2" y="5" rx="2" fill="#185C37" />
      <path fill="#fff" d="m5.2 8 1.75 3-1.9 3h1.8l1.05-1.9L9 14h1.85l-1.98-3.08L10.7 8H8.94L8 9.72 7.12 8z" />
    </svg>
  );
}

function PowerPointIcon({ size = 16 }: { size?: number }) {
  const uid = useId().replace(/:/g, "");
  const gradient = (name: string) => `${uid}-ppt-${name}`;

  return (
    <svg width={size} height={size} viewBox="60 78.75 581.25 562.5" aria-hidden>
      <defs>
        <linearGradient id={gradient("a")} x1="22.096" x2="-.876" y1="4.056" y2="26.033" gradientTransform="scale(15)" gradientUnits="userSpaceOnUse"><stop offset=".058" stopColor="#ff7f48" /><stop offset="1" stopColor="#e5495b" /></linearGradient>
        <radialGradient id={gradient("b")} cx="0" cy="0" r="1" gradientTransform="rotate(135 185.459 218.557) scale(564.67953 950.43148)" gradientUnits="userSpaceOnUse"><stop offset=".152" stopColor="#aa1d2d" /><stop offset=".381" stopColor="#d12b18" stopOpacity=".439216" /><stop offset=".602" stopColor="#ff3c00" stopOpacity="0" /></radialGradient>
        <radialGradient id={gradient("c")} cx="0" cy="0" r="1" gradientTransform="matrix(484.01207 -228.61784 414.17447 876.85825 -19.41 588.618)" gradientUnits="userSpaceOnUse"><stop offset=".407" stopColor="#ff66fb" stopOpacity=".501961" /><stop offset="1" stopColor="#ea3d01" stopOpacity="0" /></radialGradient>
        <linearGradient id={gradient("d")} x1="27.549" x2="47.729" y1="28.172" y2="13.216" gradientTransform="scale(15)" gradientUnits="userSpaceOnUse"><stop offset=".311" stopColor="#ff6e30" /><stop offset=".635" stopColor="#ffa05c" /></linearGradient>
        <radialGradient id={gradient("e")} cx="0" cy="0" r="1" gradientTransform="matrix(355.8576 74.56878 -71.0897 339.25471 312.756 393.631)" gradientUnits="userSpaceOnUse"><stop offset=".786" stopColor="#ffa05c" stopOpacity="0" /><stop offset=".905" stopColor="#ffce84" /></radialGradient>
        <radialGradient id={gradient("f")} cx="0" cy="0" r="1" gradientTransform="matrix(307.21144 -201.01593 192.23383 293.78981 369.795 355.78)" gradientUnits="userSpaceOnUse"><stop offset=".295" stopColor="#ff99e9" stopOpacity=".8" /><stop offset=".728" stopColor="#ff99e9" stopOpacity="0" /></radialGradient>
        <radialGradient id={gradient("g")} cx="0" cy="0" r="1" gradientTransform="matrix(257.14316 -294.39511 268.86446 234.84308 328.567 398.718)" gradientUnits="userSpaceOnUse"><stop stopColor="#fd6ef9" /><stop offset=".637" stopColor="#f94" /><stop offset=".852" stopColor="#fcc479" /></radialGradient>
        <radialGradient id={gradient("h")} cx="0" cy="0" r="1" gradientTransform="matrix(-29.04584 196.8193 -444.81484 -65.64406 302.985 115.92)" gradientUnits="userSpaceOnUse"><stop offset=".144" stopColor="#ff8d13" /><stop offset=".537" stopColor="#ff7f29" stopOpacity="0" /></radialGradient>
        <radialGradient id={gradient("i")} cx="0" cy="0" r="1" gradientTransform="rotate(45 -386.466 244.891) scale(339.41099)" gradientUnits="userSpaceOnUse"><stop stopColor="#f8193e" /><stop offset=".939" stopColor="#920616" /></radialGradient>
        <radialGradient id={gradient("j")} cx="0" cy="0" r="1" gradientTransform="matrix(0 168 -191.25 0 179.97 489)" gradientUnits="userSpaceOnUse"><stop offset=".576" stopColor="#ffb055" stopOpacity="0" /><stop offset=".974" stopColor="#fff2be" stopOpacity=".301961" /></radialGradient>
      </defs>
      <path fill={`url(#${gradient("a")})`} d="M641.2 360c0-155.332-125.907-281.25-281.223-281.25C204.66 78.75 78.75 204.668 78.75 360s125.91 281.25 281.227 281.25c155.316 0 281.222-125.918 281.222-281.25Z" />
      <path fill={`url(#${gradient("b")})`} d="M641.2 360c0-155.332-125.907-281.25-281.223-281.25C204.66 78.75 78.75 204.668 78.75 360s125.91 281.25 281.227 281.25c155.316 0 281.222-125.918 281.222-281.25Z" />
      <path fill={`url(#${gradient("c")})`} d="M641.2 360c0-155.332-125.907-281.25-281.223-281.25C204.66 78.75 78.75 204.668 78.75 360s125.91 281.25 281.227 281.25c155.316 0 281.222-125.918 281.222-281.25Z" />
      <path fill={`url(#${gradient("d")})`} d="M360.016 78.75c155.312.004 281.218 125.922 281.218 281.25 0 51.672-13.96 100.07-38.273 141.68l4.57-10.121c27.832-61.797-17.406-131.727-85.183-131.676l-111.93.086c-27.824.023-50.402-22.535-50.402-50.36V197.477c-.004-67.805-70.012-112.993-131.793-85.067l-8.996 4.074c41.406-23.992 89.492-37.734 140.789-37.734Z" />
      <path fill={`url(#${gradient("e")})`} d="M360.016 78.75c155.312.004 281.218 125.922 281.218 281.25 0 51.672-13.96 100.07-38.273 141.68l4.57-10.121c27.832-61.797-17.406-131.727-85.183-131.676l-111.93.086c-27.824.023-50.402-22.535-50.402-50.36V197.477c-.004-67.805-70.012-112.993-131.793-85.067l-8.996 4.074c41.406-23.992 89.492-37.734 140.789-37.734Z" />
      <path fill={`url(#${gradient("f")})`} d="M360.016 78.75c155.312.004 281.218 125.922 281.218 281.25 0 51.672-13.96 100.07-38.273 141.68l4.57-10.121c27.832-61.797-17.406-131.727-85.183-131.676l-111.93.086c-27.824.023-50.402-22.535-50.402-50.36V197.477c-.004-67.805-70.012-112.993-131.793-85.067l-8.996 4.074c41.406-23.992 89.492-37.734 140.789-37.734Z" />
      <path fill={`url(#${gradient("g")})`} d="M360.016 78.75c155.312.004 281.218 125.922 281.218 281.25 0 51.672-13.96 100.07-38.273 141.68l4.57-10.121c27.832-61.797-17.406-131.727-85.183-131.676l-111.93.086c-27.824.023-50.402-22.535-50.402-50.36V197.477c-.004-67.805-70.012-112.993-131.793-85.067l-8.996 4.074c41.406-23.992 89.492-37.734 140.789-37.734Z" />
      <path fill={`url(#${gradient("h")})`} d="M360.016 78.75c155.312.004 281.218 125.922 281.218 281.25 0 51.672-13.96 100.07-38.273 141.68l4.57-10.121c27.832-61.797-17.406-131.727-85.183-131.676l-111.93.086c-27.824.023-50.402-22.535-50.402-50.36V197.477c-.004-67.805-70.012-112.993-131.793-85.067l-8.996 4.074c41.406-23.992 89.492-37.734 140.789-37.734Z" />
      <path fill={`url(#${gradient("i")})`} d="M108.75 345h142.5c26.926 0 48.75 21.824 48.75 48.75v142.5c0 26.926-21.824 48.75-48.75 48.75h-142.5C81.824 585 60 563.176 60 536.25v-142.5C60 366.824 81.824 345 108.75 345Z" />
      <path fill={`url(#${gradient("j")})`} d="M108.75 345h142.5c26.926 0 48.75 21.824 48.75 48.75v142.5c0 26.926-21.824 48.75-48.75 48.75h-142.5C81.824 585 60 563.176 60 536.25v-142.5C60 366.824 81.824 345 108.75 345Z" />
      <path fill="#fff" d="M168.293 488.906v44.664h-30.875V396.426h47.7c17.077 0 30.077 3.73 39 11.191 8.987 7.457 13.48 18.52 13.48 33.184 0 15.113-5.036 26.906-15.106 35.387-10.004 8.48-23.453 12.718-40.34 12.718Zm0-68.761v45.043h12.906c7.645 0 13.543-2.004 17.684-6.024 4.14-4.016 6.215-9.785 6.215-17.309 0-6.949-2.043-12.304-6.121-16.07-4.016-3.762-9.782-5.64-17.301-5.64Z" />
    </svg>
  );
}

function LineWorksIcon({ size = 16 }: { size?: number }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={LINE_WORKS_ICON} alt="" width={size} height={size} draggable={false} />
  );
}

const FLOW_DEST_ICONS: Record<FlowDestId, ComponentType<{ size?: number }>> = {
  "sap-odata": DEST_ICONS["sap-odata"],
  "power-bi": DEST_ICONS["power-bi"],
  excel: ExcelIcon,
  powerpoint: PowerPointIcon,
  line: DEST_ICONS.line,
  "line-works": LineWorksIcon,
  slack: DEST_ICONS.slack,
  teams: DEST_ICONS.teams,
};

function curve(from: Point, to: Point, vertical: boolean) {
  if (vertical) {
    const dy = Math.max(28, Math.abs(to.y - from.y) * 0.42);
    return `M ${from.x} ${from.y} C ${from.x} ${from.y + dy}, ${to.x} ${to.y - dy}, ${to.x} ${to.y}`;
  }
  const dx = Math.max(36, Math.abs(to.x - from.x) * 0.48);
  return `M ${from.x} ${from.y} C ${from.x + dx} ${from.y}, ${to.x - dx} ${to.y}, ${to.x} ${to.y}`;
}

function dropCurve(from: Point, to: Point) {
  const dy = Math.max(16, Math.abs(to.y - from.y) * 0.5);
  return `M ${from.x} ${from.y} C ${from.x} ${from.y + dy}, ${to.x} ${to.y - dy}, ${to.x} ${to.y}`;
}

function handlePoint(root: HTMLElement, name: string): Point | null {
  const el = root.querySelector<HTMLElement>(`[data-handle="${name}"]`);
  if (!el) return null;
  const box = root.getBoundingClientRect();
  const rect = el.getBoundingClientRect();
  return {
    x: rect.left + rect.width / 2 - box.left,
    y: rect.top + rect.height / 2 - box.top,
  };
}

function isSource(id: string): id is FlowSourceId {
  return SOURCE_IDS.includes(id as FlowSourceId);
}

function isDest(id: string): id is FlowDestId {
  return DEST_IDS.includes(id as FlowDestId);
}

function isProvider(id: string): id is FlowProviderId {
  return PROVIDERS.some((item) => item.id === id);
}

function isInbound(id: string): id is DemoSourceId {
  return id === "ixacs" || isSource(id);
}

function isAiLink(id: LinkId) {
  return PROVIDERS.some((item) => id.startsWith(`${item.id}-`));
}

function inspectView(hover: Hover, fallback: DemoFlow): View | null {
  if (!hover) return null;
  if (isInbound(hover)) {
    const flow = hover === "ixacs" ? fallback : flowBySource(hover);
    return { sources: [...flow.sources], dests: [], providers: [], stage: "source", flow };
  }
  if (isDest(hover)) {
    const flow =
      hover === "excel" || hover === "powerpoint" || hover === "line-works"
        ? fallback
        : flowByDestination(hover as DemoDestId);
    return { sources: [], dests: [hover], providers: [], stage: "complete", flow };
  }
  if (isProvider(hover)) {
    return { sources: [], dests: [], providers: [hover], stage: "idle", flow: fallback };
  }
  if (hover === "bridge") {
    return { sources: [], dests: [], providers: [], stage: "idle", flow: fallback };
  }
  return null;
}

function demoView(flow: DemoFlow, stage: DemoStage): View {
  const processing = stage === "processing" || stage === "processed" || stage === "exporting";
  const outbound = stage === "processed" || stage === "exporting" || stage === "complete";
  return {
    sources: stage === "idle" ? [] : [...ALL_SOURCES],
    dests: outbound ? [...DEST_IDS] : [],
    providers: processing ? ALL_PROVIDERS : [],
    stage,
    flow,
  };
}

function linkTone(id: LinkId, hover: Hover, view: View) {
  if (hover === "bridge") return isAiLink(id) ? "is-off" : "is-on";
  if (hover && isProvider(hover) && view.stage === "idle") {
    return id === `${hover}-bridge` ? "is-on" : "is-off";
  }

  const active: string[] = [];
  for (const source of view.sources) active.push(`${source}-bridge`);
  for (const provider of view.providers) active.push(`${provider}-bridge`);
  for (const dest of view.dests) active.push(`bridge-${dest}`);
  if (!active.length) return "is-idle";
  return active.includes(id) ? "is-on" : "is-off";
}

function nodeTone(id: NodeId, hover: Hover, view: View) {
  if (hover === "bridge" && view.stage === "idle") {
    return isInbound(id) || isDest(id) || id === "bridge" ? "is-hot" : "";
  }
  if (
    view.sources.includes(id as DemoSourceId) ||
    view.dests.includes(id as DemoDestId) ||
    view.providers.includes(id as DemoProviderId)
  ) {
    return "is-hot";
  }
  if (view.sources.length || view.dests.length || view.providers.length) return id === "bridge" ? "is-hot" : "";
  return "";
}

function portLive(name: string, hover: Hover, view: View) {
  if (name === "bridge-ai") return view.providers.length > 0 || isProvider(hover ?? "");
  if (view.sources.some((source) => name === `${source}-out`) || (view.sources.length > 0 && name === "bridge-in")) {
    return true;
  }
  if (view.dests.some((dest) => name === `${dest}-in`) || (view.dests.length > 0 && name === "bridge-out")) {
    return true;
  }
  if (view.providers.some((provider) => name === `${provider}-out`)) return true;
  if (hover === "bridge" && name.includes("bridge")) return true;
  if (hover && name.startsWith(`${hover}-`)) return true;
  return false;
}

function railStep(stage: DemoStage) {
  if (stage === "source" || stage === "ingesting") return 1;
  if (stage === "processing") return 2;
  if (stage === "processed") return 3;
  if (stage === "exporting" || stage === "complete") return 4;
  return 0;
}

function Port({
  name,
  side,
  live,
}: {
  name: string;
  side: "in" | "out" | "top" | "bottom";
  live: boolean;
}) {
  return <span className={`flow-port is-${side} ${live ? "is-live" : ""}`} data-handle={name} />;
}

function IntegrationCard({
  id,
  title,
  variant,
  hover,
  view,
  onHover,
  onPlay,
}: {
  id: FlowSourceId | FlowDestId | "ixacs";
  title: string;
  variant: "source" | "dest";
  hover: Hover;
  view: View;
  onHover: (next: Hover, fromPointer?: boolean) => void;
  onPlay?: (id: DemoSourceId) => void;
}) {
  const Icon = id === "ixacs"
    ? null
    : variant === "source"
      ? SOURCE_ICONS[id as FlowSourceId]
      : FLOW_DEST_ICONS[id as FlowDestId];

  return (
    <div
      className={`flow-card is-${variant} ${id === "ixacs" ? "is-logo" : ""} ${nodeTone(id, hover, view)}`}
      data-node={id}
      aria-label={title}
      onMouseEnter={() => onHover(id, true)}
      onMouseLeave={() => onHover(null, true)}
      onFocus={() => onHover(id)}
      onBlur={() => onHover(null)}
      onClick={onPlay && isInbound(id) ? () => onPlay(id) : undefined}
      onKeyDown={
        onPlay && isInbound(id)
          ? (event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                onPlay(id);
              }
            }
          : undefined
      }
      role={onPlay && isInbound(id) ? "button" : undefined}
      tabIndex={0}
    >
      {variant === "dest" ? <Port name={`${id}-in`} side="in" live={portLive(`${id}-in`, hover, view)} /> : null}
      <span className="flow-card-icon">
        {id === "ixacs" ? (
          <IxacsLogo width={72} className="flow-ixacs-logo" alt="" />
        ) : Icon ? (
          <Icon size={16} />
        ) : null}
      </span>
      {id === "ixacs" ? null : <strong>{title}</strong>}
      {variant === "source" ? <Port name={`${id}-out`} side="out" live={portLive(`${id}-out`, hover, view)} /> : null}
    </div>
  );
}

function SAMBridgeNode({
  copy,
  hover,
  view,
  onHover,
}: {
  copy: FlowCopy;
  hover: Hover;
  view: View;
  onHover: (next: Hover, fromPointer?: boolean) => void;
}) {
  const processing = view.stage === "processed";
  const ready = view.stage === "exporting" || view.stage === "complete";
  const step = railStep(view.stage);

  return (
    <div
      className={`flow-engine is-bridge ${nodeTone("bridge", hover, view)} ${processing ? "is-busy" : ""} ${ready ? "is-ready" : ""}`}
      data-node="bridge"
      onMouseEnter={() => onHover("bridge", true)}
      onMouseLeave={() => onHover(null, true)}
      onFocus={() => onHover("bridge")}
      onBlur={() => onHover(null)}
      tabIndex={0}
    >
      <Port name="bridge-ai" side="top" live={portLive("bridge-ai", hover, view)} />
      <Port name="bridge-in" side="in" live={portLive("bridge-in", hover, view)} />
      <Port name="bridge-out" side="out" live={portLive("bridge-out", hover, view)} />
      <h3>{copy.bridge}</h3>
      {processing || ready ? (
        <div className="flow-engine-live">
          <div className="flow-rail" aria-hidden>
            {[1, 2, 3, 4].map((index) => (
              <i key={index} className={step >= index ? "is-on" : ""} />
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function AIChip({
  id,
  name,
  Icon,
  hover,
  view,
  onHover,
  index,
}: {
  id: FlowProviderId;
  name: string;
  Icon: ComponentType<{ size?: number }>;
  hover: Hover;
  view: View;
  onHover: (next: Hover, fromPointer?: boolean) => void;
  index: number;
}) {
  const thinking = view.stage === "processing";
  return (
    <button
      type="button"
      className={`flow-ai-chip is-${id} ${nodeTone(id, hover, view)} ${thinking ? "is-thinking" : ""}`}
      style={{ "--flow-ai-index": index } as CSSProperties}
      title={name}
      aria-label={name}
      data-node={id}
      onMouseEnter={() => onHover(id, true)}
      onMouseLeave={() => onHover(null, true)}
      onFocus={() => onHover(id)}
      onBlur={() => onHover(null)}
    >
      <Port name={`${id}-out`} side="bottom" live={portLive(`${id}-out`, hover, view)} />
      <Icon size={22} />
    </button>
  );
}

export function IntegrationFlowGraph({ copy }: { copy: FlowCopy }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const markerId = useId().replace(/:/g, "");
  const [links, setLinks] = useState<Link[]>([]);
  const [hover, setHover] = useState<Hover>(null);
  const [pointer, setPointer] = useState(false);
  const [motion, setMotion] = useState(true);
  const { flow, stage, play } = useDemoFlow({
    hovering: pointer,
    motion,
  });

  const setNodeHover = useCallback((next: Hover, fromPointer = false) => {
    setHover(next);
    if (fromPointer) setPointer(Boolean(next));
    if (!next) setPointer(false);
  }, []);

  const view = useMemo(() => {
    if (stage === "idle" && hover) return inspectView(hover, flow) ?? demoView(flow, stage);
    return demoView(flow, stage);
  }, [flow, stage, hover]);

  const layout = useCallback(() => {
    const root = rootRef.current;
    if (!root) return;
    const vertical = window.matchMedia("(max-width: 980px)").matches;
    const bridgeIn = handlePoint(root, "bridge-in");
    const bridgeOut = handlePoint(root, "bridge-out");
    const bridgeAi = handlePoint(root, "bridge-ai");
    if (!bridgeIn || !bridgeOut || !bridgeAi) return;

    const next: Link[] = [];
    const ixacs = handlePoint(root, "ixacs-out");
    if (ixacs) next.push({ id: "ixacs-bridge", d: curve(ixacs, bridgeIn, vertical), rank: "is-feed" });

    for (const item of copy.sources) {
      const from = handlePoint(root, `${item.id}-out`);
      if (!from) continue;
      next.push({ id: `${item.id}-bridge`, d: curve(from, bridgeIn, vertical), rank: "is-feed" });
    }

    for (const dest of copy.dests) {
      const target = handlePoint(root, `${dest.id}-in`);
      if (!target) continue;
      next.push({ id: `bridge-${dest.id}`, d: curve(bridgeOut, target, vertical), rank: "is-out" });
    }

    for (const provider of PROVIDERS) {
      const from = handlePoint(root, `${provider.id}-out`);
      if (!from) continue;
      next.push({ id: `${provider.id}-bridge`, d: dropCurve(from, bridgeAi), rank: "is-ai" });
    }
    setLinks(next);
  }, [copy.sources, copy.dests]);

  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
    setMotion(!reduce.matches);
    const onMotion = () => setMotion(!reduce.matches);
    reduce.addEventListener("change", onMotion);
    return () => reduce.removeEventListener("change", onMotion);
  }, []);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const frame = requestAnimationFrame(layout);
    const observer = new ResizeObserver(() => layout());
    observer.observe(root);
    window.addEventListener("resize", layout);
    void document.fonts?.ready.then(layout);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener("resize", layout);
    };
  }, [layout]);

  useEffect(() => {
    layout();
  }, [layout, view.stage, view.sources, view.dests]);

  const inboundLinks = links.filter((link) => view.sources.some((source) => link.id === `${source}-bridge`));
  const outboundLinks = links.filter((link) => view.dests.some((dest) => link.id === `bridge-${dest}`));
  const aiLinks = links.filter((link) => view.providers.some((provider) => link.id === `${provider}-bridge`));

  return (
    <div className="flow-graph">
      <div className="flow-stage" ref={rootRef} data-hover={hover ?? ""} data-stage={view.stage}>
        <svg className="flow-svg" aria-hidden>
          <defs>
            <marker
              id={`${markerId}-arrow`}
              markerWidth="7"
              markerHeight="7"
              refX="6"
              refY="3.5"
              orient="auto"
            >
              <path d="M0 0.7 L6 3.5 L0 6.3" fill="none" stroke="currentColor" strokeWidth="1" />
            </marker>
          </defs>
          {links.map((link) => (
            <path
              key={link.id}
              className={`flow-link ${link.rank} ${linkTone(link.id, hover, view)}`}
              d={link.d}
              markerEnd={link.rank === "is-ai" ? undefined : `url(#${markerId}-arrow)`}
            />
          ))}
        </svg>

        <div className="flow-col is-sources">
          <IntegrationCard
            id="ixacs"
            variant="source"
            title={copy.source}
            hover={hover}
            view={view}
            onHover={setNodeHover}
            onPlay={play}
          />
          {copy.sources.map((item) => (
            <IntegrationCard
              key={item.id}
              id={item.id}
              variant="source"
              title={item.label}
              hover={hover}
              view={view}
              onHover={setNodeHover}
              onPlay={play}
            />
          ))}
        </div>

        <div className="flow-col is-bridge">
          <div className={`flow-ai-zone ${view.stage === "processing" ? "is-thinking" : ""}`}>
            <div className="flow-ai-rack">
            {PROVIDERS.map((provider, index) => (
              <AIChip
                key={provider.id}
                id={provider.id}
                name={provider.name}
                Icon={provider.Icon}
                hover={hover}
                view={view}
                onHover={setNodeHover}
                index={index}
              />
            ))}
            </div>
          </div>
          <SAMBridgeNode copy={copy} hover={hover} view={view} onHover={setNodeHover} />
        </div>

        <div className="flow-col is-dests">
          {copy.dests.map((dest) => (
            <IntegrationCard
              key={dest.id}
              id={dest.id}
              variant="dest"
              title={dest.label}
              hover={hover}
              view={view}
              onHover={setNodeHover}
            />
          ))}
        </div>

        {motion ? (
          <>
            {inboundLinks.map((link) => (
              <DataPacket
                key={link.id}
                path={link.d}
                label=""
                active={view.stage === "ingesting"}
                duration={980}
                tone="in"
              />
            ))}
            {aiLinks.map((link) => (
              <DataPacket
                key={link.id}
                path={link.d}
                label=""
                active={view.stage === "processing"}
                duration={1400}
                tone="ai"
                reverse
              />
            ))}
            {outboundLinks.map((link) => (
              <DataPacket
                key={link.id}
                path={link.d}
                label=""
                active={view.stage === "exporting"}
                duration={880}
                tone="out"
              />
            ))}
          </>
        ) : null}
      </div>
    </div>
  );
}
