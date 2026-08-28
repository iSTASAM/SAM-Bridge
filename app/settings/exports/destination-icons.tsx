"use client";

import type { ComponentType, ReactNode } from "react";
import { useId } from "react";
import { FaDatabase } from "react-icons/fa";
import { FiFolder, FiGlobe, FiShare2 } from "react-icons/fi";
import { MdOutlineWebhook } from "react-icons/md";
import { TbBuildingWarehouse } from "react-icons/tb";
import type { DestinationType } from "./types";

type DestIcon = ComponentType<{ size?: number }>;

function BrandIcon({
  size = 16,
  viewBox,
  children,
}: {
  size?: number;
  viewBox: string;
  children: ReactNode;
}) {
  return (
    <svg
      className="ew-dest-logo"
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

function SapIcon({ size }: { size?: number }) {
  return (
    <BrandIcon size={size} viewBox="0 0 24 24">
      <path
        fill="#0FAAFF"
        d="M0 6.064v11.872h12.13L24 6.064zm3.264 2.208h.005c.863.001 1.915.245 2.676.633l-.82 1.43c-.835-.404-1.255-.442-1.73-.467-.708-.038-1.064.215-1.069.488-.007.332.669.633 1.305.838.964.306 2.19.715 2.377 1.9L7.77 8.437h2.046l2.064 5.576-.007-5.575h2.37c2.257 0 3.318.764 3.318 2.519 0 1.575-1.09 2.514-2.936 2.514h-.763l-.01 2.094-3.588-.003-.25-.908c-.37.122-.787.189-1.23.189-.456 0-.885-.071-1.263-.2l-.358.919-2 .006.09-.462c-.029.025-.057.05-.087.074-.535.43-1.208.629-2.037.644l-.213.002a5.075 5.075 0 0 1-2.581-.675l.73-1.448c.79.467 1.286.572 1.956.558.347-.007.598-.07.761-.239a.557.557 0 0 0 .156-.369c.007-.376-.53-.553-1.185-.756-.531-.164-1.135-.389-1.606-.735-.559-.41-.825-.924-.812-1.65a1.99 1.99 0 0 1 .566-1.377c.519-.537 1.357-.863 2.363-.863zm10.597 1.67v1.904h.521c.694 0 1.247-.23 1.248-.964 0-.709-.554-.94-1.248-.94zm-5.087.767l-.748 2.362c.223.085.481.133.757.133.268 0 .52-.047.742-.126l-.736-2.37z"
      />
    </BrandIcon>
  );
}

function LineIcon({ size }: { size?: number }) {
  return (
    <BrandIcon size={size} viewBox="0 0 24 24">
      <path
        fill="#00C300"
        d="M19.365 9.863c.349 0 .63.285.63.631 0 .345-.281.63-.63.63H17.61v1.125h1.755c.349 0 .63.283.63.63 0 .344-.281.629-.63.629h-2.386c-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.63-.63h2.386c.346 0 .627.285.627.63 0 .349-.281.63-.63.63H17.61v1.125h1.755zm-3.855 3.016c0 .27-.174.51-.432.596-.064.021-.133.031-.199.031-.211 0-.391-.09-.51-.25l-2.443-3.317v2.94c0 .344-.279.629-.631.629-.346 0-.626-.285-.626-.629V8.108c0-.27.173-.51.43-.595.06-.023.136-.033.194-.033.195 0 .375.104.495.254l2.462 3.33V8.108c0-.345.282-.63.63-.63.345 0 .63.285.63.63v4.771zm-5.741 0c0 .344-.282.629-.631.629-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.63-.63.346 0 .628.285.628.63v4.771zm-2.466.629H4.917c-.345 0-.63-.285-.63-.629V8.108c0-.345.285-.63.63-.63.348 0 .63.285.63.63v4.141h1.756c.348 0 .629.283.629.63 0 .344-.282.629-.629.629M24 10.314C24 4.943 18.615.572 12 .572S0 4.943 0 10.314c0 4.811 4.27 8.842 10.035 9.608.391.082.923.258 1.058.59.12.301.079.766.038 1.08l-.164 1.02c-.045.301-.24 1.186 1.049.645 1.291-.539 6.916-4.078 9.436-6.975C23.176 14.393 24 12.458 24 10.314"
      />
    </BrandIcon>
  );
}

function ExcelIcon({ size = 16 }: { size?: number }) {
  return (
    <BrandIcon size={size} viewBox="0 0 24 24">
      <rect width="15" height="18" x="7" y="3" rx="2" fill="#21A366" />
      <path fill="#107C41" d="M7 7h15v4H7zM7 15h15v4H7z" opacity=".72" />
      <rect width="12" height="14" x="2" y="5" rx="2" fill="#185C37" />
      <path fill="#fff" d="m5.2 8 1.75 3-1.9 3h1.8l1.05-1.9L9 14h1.85l-1.98-3.08L10.7 8H8.94L8 9.72 7.12 8z" />
    </BrandIcon>
  );
}

function TeamsIcon({ size }: { size?: number }) {
  return (
    <BrandIcon size={size} viewBox="0 0 256 256">
      <path fill="#F1511B" d="M121.666 121.666H0V0h121.666z" />
      <path fill="#80CC28" d="M256 121.666H134.335V0H256z" />
      <path fill="#00ADEF" d="M121.663 256.002H0V134.336h121.663z" />
      <path fill="#FBBC09" d="M256 256.002H134.335V134.336H256z" />
    </BrandIcon>
  );
}

function EmailIcon({ size = 16 }: { size?: number }) {
  const uid = useId().replace(/:/g, "");
  const a = `${uid}-email-a`;
  const b = `${uid}-email-b`;

  return (
    <BrandIcon size={size} viewBox="0 0 192 192">
      <path fill={`url(#${a})`} d="M146 44h38v110c0 6.627-5.373 12-12 12h-20a6 6 0 0 1-6-6z" />
      <path fill="#fc413d" d="M46 44H8v110c0 6.627 5.373 12 12 12h20a6 6 0 0 0 6-6z" />
      <path
        fill={`url(#${b})`}
        d="M39.226 30.456c-8.033-6.752-20.018-5.714-26.77 2.319-6.752 8.032-5.714 20.017 2.319 26.77l76.078 63.949a8 8 0 0 0 10.295 0l76.078-63.95c8.032-6.752 9.07-18.737 2.318-26.77-6.752-8.032-18.737-9.07-26.769-2.318L96 78.18z"
      />
      <defs>
        <linearGradient id={a} x1="165" x2="165" y1="44" y2="166" gradientUnits="userSpaceOnUse">
          <stop stopColor="#60d673" />
          <stop offset=".17" stopColor="#42c868" />
          <stop offset=".39" stopColor="#0ebc5f" />
          <stop offset=".62" stopColor="#00a9bb" />
          <stop offset=".86" stopColor="#3c90ff" />
          <stop offset="1" stopColor="#3186ff" />
        </linearGradient>
        <linearGradient id={b} x1="8" x2="184" y1="46.13" y2="46.13" gradientUnits="userSpaceOnUse">
          <stop offset=".08" stopColor="#ff63a0" />
          <stop offset=".3" stopColor="#fc413d" />
          <stop offset=".5" stopColor="#fc413d" />
          <stop offset=".65" stopColor="#fc413d" />
          <stop offset=".72" stopColor="#fc5c30" />
          <stop offset=".86" stopColor="#feb10c" />
          <stop offset=".91" stopColor="#fec700" />
          <stop offset=".96" stopColor="#ffdb0f" />
        </linearGradient>
      </defs>
    </BrandIcon>
  );
}

function PowerBiIcon({ size = 16 }: { size?: number }) {
  const uid = useId().replace(/:/g, "");
  const mask = `${uid}-pbi-mask`;
  const g0 = `${uid}-pbi-g0`;
  const g1 = `${uid}-pbi-g1`;
  const g2 = `${uid}-pbi-g2`;

  return (
    <BrandIcon size={size} viewBox="0 0 48 48">
      <mask
        id={mask}
        width="30"
        height="40"
        x="9"
        y="4"
        maskUnits="userSpaceOnUse"
        style={{ maskType: "alpha" }}
      >
        <path
          fill="#fff"
          d="M25.667 5.667c0-.92.746-1.667 1.666-1.667h10C38.253 4 39 4.746 39 5.667v36.665c0 .92-.746 1.667-1.667 1.667H10.667c-.92 0-1.667-.746-1.667-1.667V25.666c0-.92.747-1.666 1.667-1.666h6.667v-8.334c0-.92.746-1.666 1.666-1.666h6.667z"
        />
      </mask>
      <g mask={`url(#${mask})`}>
        <path fill={`url(#${g0})`} d="M39 4v39.999H25.667V4z" />
        <path fill={`url(#${g1})`} d="M30.667 15.666V44H17.334v-30H29c.92 0 1.667.747 1.667 1.667" />
        <path
          fill={`url(#${g2})`}
          d="M9 24v19.999h13.334V25.666c0-.92-.747-1.666-1.667-1.666z"
        />
      </g>
      <defs>
        <linearGradient id={g0} x1="23.445" x2="41.027" y1="4" y2="41.268" gradientUnits="userSpaceOnUse">
          <stop stopColor="#E6AD10" />
          <stop offset="1" stopColor="#C87E0E" />
        </linearGradient>
        <linearGradient id={g1} x1="17.333" x2="32.119" y1="14" y2="42.677" gradientUnits="userSpaceOnUse">
          <stop stopColor="#F6D751" />
          <stop offset="1" stopColor="#E6AD10" />
        </linearGradient>
        <linearGradient id={g2} x1="8.999" x2="17.17" y1="24" y2="43.365" gradientUnits="userSpaceOnUse">
          <stop stopColor="#F9E589" />
          <stop offset="1" stopColor="#F6D751" />
        </linearGradient>
      </defs>
    </BrandIcon>
  );
}

function SlackIcon({ size }: { size?: number }) {
  return (
    <BrandIcon size={size} viewBox="0 0 2447.6 2452.5">
      <g clipRule="evenodd" fillRule="evenodd">
        <path
          fill="#36c5f0"
          d="m897.4 0c-135.3.1-244.8 109.9-244.7 245.2-.1 135.3 109.5 245.1 244.8 245.2h244.8v-245.1c.1-135.3-109.5-245.1-244.9-245.3.1 0 .1 0 0 0m0 654h-652.6c-135.3.1-244.9 109.9-244.8 245.2-.2 135.3 109.4 245.1 244.7 245.3h652.7c135.3-.1 244.9-109.9 244.8-245.2.1-135.4-109.5-245.2-244.8-245.3z"
        />
        <path
          fill="#2eb67d"
          d="m2447.6 899.2c.1-135.3-109.5-245.1-244.8-245.2-135.3.1-244.9 109.9-244.8 245.2v245.3h244.8c135.3-.1 244.9-109.9 244.8-245.3zm-652.7 0v-654c.1-135.2-109.4-245-244.7-245.2-135.3.1-244.9 109.9-244.8 245.2v654c-.2 135.3 109.4 245.1 244.7 245.3 135.3-.1 244.9-109.9 244.8-245.3z"
        />
        <path
          fill="#ecb22e"
          d="m1550.1 2452.5c135.3-.1 244.9-109.9 244.8-245.2.1-135.3-109.5-245.1-244.8-245.2h-244.8v245.2c-.1 135.2 109.5 245 244.8 245.2zm0-654.1h652.7c135.3-.1 244.9-109.9 244.8-245.2.2-135.3-109.4-245.1-244.7-245.3h-652.7c-135.3.1-244.9 109.9-244.8 245.2-.1 135.4 109.4 245.2 244.7 245.3z"
        />
        <path
          fill="#e01e5a"
          d="m0 1553.2c-.1 135.3 109.5 245.1 244.8 245.2 135.3-.1 244.9-109.9 244.8-245.2v-245.2h-244.8c-135.3.1-244.9 109.9-244.8 245.2zm652.7 0v654c-.2 135.3 109.4 245.1 244.7 245.3 135.3-.1 244.9-109.9 244.8-245.2v-653.9c.2-135.3-109.4-245.1-244.7-245.3-135.4 0-244.9 109.8-244.8 245.1 0 0 0 .1 0 0"
        />
      </g>
    </BrandIcon>
  );
}

export const DEST_ICONS: Record<DestinationType, DestIcon> = {
  rest: FiGlobe,
  webhook: MdOutlineWebhook,
  "sap-odata": SapIcon,
  sftp: FiFolder,
  database: FaDatabase,
  "message-queue": FiShare2,
  email: EmailIcon,
  line: LineIcon,
  teams: TeamsIcon,
  slack: SlackIcon,
  "power-bi": PowerBiIcon,
  excel: ExcelIcon,
  "data-warehouse": TbBuildingWarehouse,
};
