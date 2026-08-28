"use client";

import type { ComponentType, ReactNode } from "react";
import { useId } from "react";
import { FaDatabase, FaNetworkWired } from "react-icons/fa";
import {
  FiActivity,
  FiClipboard,
  FiGlobe,
  FiServer,
} from "react-icons/fi";
import { MdOutlineWebhook } from "react-icons/md";
import { PiShareNetworkLight } from "react-icons/pi";
import { SlEnergy } from "react-icons/sl";
import type { SourceType } from "./types";

export type SourceIcon = ComponentType<{ size?: number }>;

function BrandIcon({
  size = 19,
  viewBox,
  children,
}: {
  size?: number;
  viewBox: string;
  children: ReactNode;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox={viewBox}
      fill="none"
      aria-hidden
    >
      {children}
    </svg>
  );
}

function ExcelIcon({ size }: { size?: number }) {
  const uid = useId().replace(/:/g, "");
  const a = `${uid}-a`;
  const b = `${uid}-b`;
  const c = `${uid}-c`;
  const d = `${uid}-d`;
  const e = `${uid}-e`;
  const f = `${uid}-f`;
  const g = `${uid}-g`;
  const h = `${uid}-h`;
  const i = `${uid}-i`;
  const j = `${uid}-j`;

  return (
    <BrandIcon size={size} viewBox="0 0 486 500">
      <defs>
        <radialGradient
          id={a}
          cx="-746.66"
          cy="781.44"
          r="13.89"
          fx="-746.66"
          fy="781.44"
          gradientTransform="matrix(-28.32596 -29.80763 -23.11916 21.97986 -2596.39 -38900.31)"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset=".06" stopColor="#379539" />
          <stop offset=".42" stopColor="#297c2d" />
          <stop offset=".7" stopColor="#15561c" />
        </radialGradient>
        <radialGradient
          id={b}
          cx="-773.19"
          cy="771.25"
          r="13.89"
          fx="-773.19"
          fy="771.25"
          gradientTransform="matrix(-11.97612 -11.58137 -8.95853 9.26806 -2155.12 -15858.88)"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0" stopColor="#073b10" />
          <stop offset=".99" stopColor="#084a13" stopOpacity="0" />
        </radialGradient>
        <radialGradient
          id={f}
          cx="-824.11"
          cy="810.99"
          r="13.89"
          fx="-824.11"
          fy="810.99"
          gradientTransform="matrix(-9.02 0 0 19.09 -7120.4 -15378.69)"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset=".29" stopColor="#4eb43b" />
          <stop offset="1" stopColor="#72cc61" stopOpacity="0" />
        </radialGradient>
        <radialGradient
          id={h}
          cx="-769.14"
          cy="808.9"
          r="13.89"
          fx="-769.14"
          fy="808.9"
          gradientTransform="matrix(-16.9077 -13.68182 13.64112 -16.86345 -23523.37 3309.71)"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset=".44" stopColor="#79e96d" />
          <stop offset="1" stopColor="#d0eb76" />
        </radialGradient>
        <radialGradient
          id={i}
          cx="-675.64"
          cy="793.28"
          r="13.89"
          fx="-675.64"
          fy="793.28"
          gradientTransform="matrix(15.99196 15.99755 45.54153 -45.54797 -25315.85 47178.18)"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0" stopColor="#20a85e" />
          <stop offset=".94" stopColor="#09442a" />
        </radialGradient>
        <radialGradient
          id={j}
          cx="-657.62"
          cy="853.99"
          r="13.89"
          fx="-657.62"
          fy="853.99"
          gradientTransform="matrix(0 11.2 12.9 0 -10902.85 7734.8)"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset=".58" stopColor="#33a662" stopOpacity="0" />
          <stop offset=".97" stopColor="#98f0b0" />
        </radialGradient>
        <linearGradient
          id={c}
          x1="69.43"
          x2="260.84"
          y1="210.33"
          y2="210.33"
          gradientTransform="matrix(1 0 0 -1 0 502)"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0" stopColor="#52d17c" />
          <stop offset=".33" stopColor="#4aa647" />
        </linearGradient>
        <linearGradient
          id={d}
          x1="194.4"
          x2="194.4"
          y1="335.33"
          y2="161.68"
          gradientTransform="matrix(1 0 0 -1 0 502)"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0" stopColor="#29852f" />
          <stop offset=".5" stopColor="#4aa647" stopOpacity="0" />
        </linearGradient>
        <linearGradient
          id={e}
          x1="80.49"
          x2="311.45"
          y1="297.22"
          y2="497.54"
          gradientTransform="matrix(1 0 0 -1 0 502)"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0" stopColor="#66d052" />
          <stop offset="1" stopColor="#85e972" />
        </linearGradient>
        <linearGradient
          id={g}
          x1="182.11"
          x2="69.43"
          y1="377"
          y2="377"
          gradientTransform="matrix(1 0 0 -1 0 502)"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset=".18" stopColor="#c0e075" stopOpacity="0" />
          <stop offset="1" stopColor="#d1eb95" />
        </linearGradient>
      </defs>
      <path d="M69.43 159.72c0-34.52 27.98-62.5 62.49-62.5h354.09v361.11c0 23.01-18.65 41.67-41.66 41.67H152.74c-46.01 0-83.31-37.31-83.31-83.33V159.72Z" fill={`url(#${a})`} />
      <path d="M69.43 159.72c0-34.52 27.98-62.5 62.49-62.5h354.09v361.11c0 23.01-18.65 41.67-41.66 41.67H152.74c-46.01 0-83.31-37.31-83.31-83.33V159.72Z" fill={`url(#${b})`} fillOpacity={0.7} />
      <path d="M69.43 229.17c0-34.52 27.98-62.5 62.49-62.5h187.46c-23.01 0-41.66 18.66-41.66 41.67v83.33c0 23.01-18.65 41.67-41.66 41.67h-83.31c-46.01 0-83.31 37.31-83.31 83.33v-187.5Z" fill={`url(#${c})`} />
      <path d="M69.43 229.17c0-34.52 27.98-62.5 62.49-62.5h187.46c-23.01 0-41.66 18.66-41.66 41.67v83.33c0 23.01-18.65 41.67-41.66 41.67h-83.31c-46.01 0-83.31 37.31-83.31 83.33v-187.5Z" fill={`url(#${d})`} fillOpacity={0.3} />
      <path d="M69.43 83.33C69.43 37.31 106.73 0 152.74 0h166.63v166.67H152.74c-46.01 0-83.31 37.31-83.31 83.33V83.33Z" fill={`url(#${e})`} />
      <path d="M69.43 83.33C69.43 37.31 106.73 0 152.74 0h166.63v166.67H152.74c-46.01 0-83.31 37.31-83.31 83.33V83.33Z" fill={`url(#${f})`} />
      <path d="M69.43 83.33C69.43 37.31 106.73 0 152.74 0h166.63v166.67H152.74c-46.01 0-83.31 37.31-83.31 83.33V83.33Z" fill={`url(#${g})`} />
      <rect width="208.29" height="166.67" x="277.71" rx="41.66" ry="41.66" fill={`url(#${h})`} />
      <rect width="222.17" height="222.22" y="236.11" rx="45.13" ry="45.13" fill={`url(#${i})`} />
      <rect width="222.17" height="222.22" y="236.11" rx="45.13" ry="45.13" fill={`url(#${j})`} fillOpacity={0.3} />
      <path d="M169.48 410.71h-34.25l-21.5-40.47c-.77-1.42-1.36-2.54-1.77-3.37-.35-.88-.74-1.89-1.15-3.01h-.35c-.53 1.42-1.03 2.57-1.5 3.45-.47.89-1.03 1.98-1.68 3.28l-22.3 40.11h-32.3l38.76-63.58-36.1-63.4h33.8l19.11 36.13c.77 1.48 1.42 2.78 1.95 3.9.59 1.06 1.18 2.33 1.77 3.81h.35l1.95-4.07c.53-1 1.24-2.33 2.12-3.98l19.82-35.77h32.21l-36.63 62.43 37.7 64.55Z" fill="#fff" />
    </BrandIcon>
  );
}

function FolderIcon({ size }: { size?: number }) {
  const uid = useId().replace(/:/g, "");
  const fill = `${uid}-folder`;

  return (
    <BrandIcon size={size} viewBox="0 0 18 18">
      <defs>
        <linearGradient id={fill} x1="9.252" y1="0.485" x2="8.842" y2="16.966" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#ffd400" />
          <stop offset="0.415" stopColor="#ffd000" />
          <stop offset="0.845" stopColor="#ffc301" />
          <stop offset="1" stopColor="#ffbd02" />
        </linearGradient>
      </defs>
      <path d="M17.579,3.283H9.727a.419.419,0,0,1-.233-.07L7.251,1.721a.42.42,0,0,0-.233-.071H.421A.42.42,0,0,0,0,2.07V15.93a.42.42,0,0,0,.421.42H17.579A.42.42,0,0,0,18,15.93V3.7A.42.42,0,0,0,17.579,3.283Z" fill="#dfa500" />
      <rect x="1.636" y="2.455" width="4.091" height="0.818" rx="0.172" fill="#fff" />
      <path d="M17.579,3.263H8.956a.421.421,0,0,0-.3.123L7.272,4.773a.42.42,0,0,1-.3.123H.421A.42.42,0,0,0,0,5.316V15.91a.42.42,0,0,0,.421.419H17.579A.42.42,0,0,0,18,15.91V3.683A.42.42,0,0,0,17.579,3.263Z" fill={`url(#${fill})`} />
    </BrandIcon>
  );
}

function MqttIcon({ size }: { size?: number }) {
  return (
    <BrandIcon size={size} viewBox="0 0 24 24">
      <path
        fill="#660066"
        d="M10.657 23.994h-9.45A1.212 1.212 0 0 1 0 22.788v-9.18h.071c5.784 0 10.504 4.65 10.586 10.386Zm7.606 0h-4.045C14.135 16.246 7.795 9.977 0 9.942V6.038h.071c9.983 0 18.121 8.044 18.192 17.956Zm4.53 0h-.97C21.754 12.071 11.995 2.407 0 2.372v-1.16C0 .55.544.006 1.207.006h7.64C15.733 2.49 21.257 7.789 24 14.508v8.291c0 .663-.544 1.195-1.207 1.195ZM16.713.006h6.092A1.19 1.19 0 0 1 24 1.2v5.914c-.91-1.242-2.046-2.65-3.158-3.762C19.588 2.11 18.122.987 16.714.005Z"
      />
    </BrandIcon>
  );
}

export const SOURCE_ICONS: Record<SourceType, SourceIcon> = {
  "rest-api": FiGlobe,
  webhook: MdOutlineWebhook,
  "file-upload": ExcelIcon,
  sftp: FolderIcon,
  database: FaDatabase,
  mqtt: MqttIcon,
  "opc-ua": FaNetworkWired,
  "modbus-tcp": PiShareNetworkLight,
  "erp-mrp": FiServer,
  qms: FiClipboard,
  "energy-meter": SlEnergy,
  "manual-form": FiActivity,
};
