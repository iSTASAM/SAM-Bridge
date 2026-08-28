"use client";

import type { CSSProperties } from "react";
import { FiCheck } from "react-icons/fi";
import { DEST_ICONS } from "../exports/destination-icons";
import { NOTIFY_COPY } from "./copy";

export type ChannelId = "line" | "slack" | "line-works";

export type SelectableCustomer = {
  key: string;
  connectionId: string;
  connectionName: string;
  customerId: string;
  customerName: string;
  group: boolean;
};

export type ProductionGroup = {
  uuid: string;
  name: string;
  lines: { uuid: string; name: string }[];
};

export type IxacsStatusOption = {
  uuid: string;
  name: string;
  backgroundColor: string | null;
  textColor: string | null;
  blinking: boolean;
  blinkingBackgroundColor: string | null;
  blinkingTextColor: string | null;
};

export type NotifyRule = {
  id: string;
  channel: ChannelId;
  selection: SelectableCustomer;
  lines: { uuid: string; name: string; groupName: string }[];
  statusByLine: Record<string, IxacsStatusOption[]>;
  webhookConfigured?: boolean;
  lastRunStatus?: "success" | "error" | null;
};

export const CHANNELS: ChannelId[] = ["line", "slack", "line-works"];

export const LINE_WORKS_ICON =
  "data:image/svg+xml,%3Csvg%20width='32'%20height='32'%20viewBox='0%200%2032%2032'%20fill='none'%20xmlns='http://www.w3.org/2000/svg'%3E%3Cg%20clip-path='url(%23clip0_6873_9314)'%3E%3Cpath%20d='M19.7284%2025.3183H24.2477C24.4714%2025.3183%2024.6687%2025.1648%2024.7213%2024.9455L28.9863%207.26297C29.0564%206.96475%2028.8328%206.67969%2028.5258%206.67969H23.4846C23.2609%206.67969%2023.068%206.83537%2023.0219%207.05465L19.2548%2024.7306C19.1912%2025.0332%2019.4214%2025.3183%2019.7306%2025.3183H19.7284Z'%20fill='url(%23paint0_linear_6873_9314)'/%3E%3Cpath%20opacity='0.25'%20d='M19.2577%2024.8622L23.0248%207.18622C23.0709%206.96913%2023.2639%206.81125%2023.4875%206.81125H28.5287C28.7721%206.81125%2028.9607%206.99325%2028.9936%207.21692C29.033%206.93624%2028.8181%206.67969%2028.5287%206.67969H23.4875C23.2639%206.67969%2023.0709%206.83537%2023.0248%207.05465L19.2577%2024.7306C19.2445%2024.7876%2019.2467%2024.8446%2019.2533%2024.8973C19.2533%2024.8863%2019.2533%2024.8731%2019.2577%2024.8622Z'%20fill='white'/%3E%3Cpath%20d='M22.9771%2015.5747C20.9291%2011.0926%2017.7254%2010.4238%2015.9975%2010.4238C14.2696%2010.4238%2011.066%2011.0926%209.01795%2015.5747C7.91937%2017.9779%207.31636%2021.1553%207.26373%2024.7931C7.25935%2025.0803%207.48959%2025.3171%207.77684%2025.3171H12.2545C12.533%2025.3171%2012.7632%2025.0935%2012.7676%2024.815C12.8136%2021.9973%2013.2566%2019.5436%2014.024%2017.8617C14.6117%2016.5768%2015.2739%2015.9277%2015.9975%2015.9277C16.7212%2015.9277%2017.3834%2016.5789%2017.971%2017.8617C18.7429%2019.5502%2019.1858%2022.0192%2019.2275%2024.8545C19.2319%2025.111%2019.4424%2025.3171%2019.6989%2025.3171H24.2577C24.5208%2025.3171%2024.7335%2025.1045%2024.7313%2024.8413C24.6831%2021.1838%2024.0779%2017.9889%2022.9749%2015.5747H22.9771Z'%20fill='url(%23paint1_linear_6873_9314)'/%3E%3Cpath%20opacity='0.4'%20d='M9.01984%2015.7062C11.0679%2011.2242%2014.2715%2010.5554%2015.9994%2010.5554C17.7273%2010.5554%2020.931%2011.2242%2022.979%2015.7062C24.071%2018.0963%2024.674%2021.2539%2024.7332%2024.8676C24.7332%2024.8589%2024.7354%2024.8501%2024.7354%2024.8413C24.6872%2021.1838%2024.082%2017.9889%2022.979%2015.5747C20.931%2011.0926%2017.7273%2010.4238%2015.9994%2010.4238C14.2715%2010.4238%2011.0679%2011.0926%209.01984%2015.5747C7.92126%2017.9779%207.31825%2021.1553%207.26563%2024.7931C7.26563%2024.8018%207.26562%2024.8128%207.26782%2024.8216C7.33141%2021.2276%207.93223%2018.0854%209.01984%2015.7062Z'%20fill='white'/%3E%3Cpath%20d='M12.2868%2025.3183H7.73901C7.51973%2025.3183%207.33115%2025.1692%207.27852%2024.9565L3.01358%207.26297C2.94122%206.96475%203.16708%206.67969%203.47407%206.67969H8.51525C8.73891%206.67969%208.93187%206.83537%208.97792%207.05465L12.7495%2024.7481C12.8131%2025.042%2012.5872%2025.3205%2012.2868%2025.3205V25.3183Z'%20fill='url(%23paint2_linear_6873_9314)'/%3E%3Cpath%20opacity='0.5'%20d='M3.46911%206.81125H8.51029C8.73395%206.81125%208.92692%206.96694%208.97297%207.18622L12.7445%2024.8797C12.7445%2024.8797%2012.7445%2024.9016%2012.7467%2024.9126C12.7533%2024.86%2012.7555%2024.8052%2012.7445%2024.7481L8.97297%207.05465C8.92692%206.83537%208.73395%206.67969%208.51248%206.67969H3.46911C3.17967%206.67969%202.96697%206.93624%203.00424%207.21692C3.03714%206.99325%203.22571%206.81125%203.46911%206.81125Z'%20fill='white'/%3E%3C/g%3E%3Cdefs%3E%3ClinearGradient%20id='paint0_linear_6873_9314'%20x1='19.542'%20y1='25.281'%20x2='28.2912'%20y2='6.52182'%20gradientUnits='userSpaceOnUse'%3E%3Cstop%20stop-color='%230563EB'/%3E%3Cstop%20offset='1'%20stop-color='%236040FF'/%3E%3C/linearGradient%3E%3ClinearGradient%20id='paint1_linear_6873_9314'%20x1='7.26373'%20y1='17.8705'%20x2='24.7335'%20y2='17.8705'%20gradientUnits='userSpaceOnUse'%3E%3Cstop%20stop-color='%2300BEFF'/%3E%3Cstop%20offset='1'%20stop-color='%230093FF'/%3E%3C/linearGradient%3E%3ClinearGradient%20id='paint2_linear_6873_9314'%20x1='3.70869'%20y1='6.52181'%20x2='12.4579'%20y2='25.2876'%20gradientUnits='userSpaceOnUse'%3E%3Cstop%20stop-color='%2300E355'/%3E%3Cstop%20offset='1'%20stop-color='%2300CF62'/%3E%3C/linearGradient%3E%3CclipPath%20id='clip0_6873_9314'%3E%3Crect%20width='32'%20height='32'%20fill='white'/%3E%3C/clipPath%3E%3C/defs%3E%3C/svg%3E";

export function ChannelIcon({ id, size = 22 }: { id: ChannelId; size?: number }) {
  if (id === "line-works") {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={LINE_WORKS_ICON}
        alt=""
        width={size}
        height={size}
        className="notify-brand-img"
        draggable={false}
      />
    );
  }
  const Icon = DEST_ICONS[id];
  return <Icon size={size} />;
}

export function channelName(copy: (typeof NOTIFY_COPY)[keyof typeof NOTIFY_COPY], id: ChannelId) {
  if (id === "line") return copy.line;
  if (id === "slack") return copy.slack;
  return copy.lineWorks;
}

export function toggleId(list: string[], id: string) {
  return list.includes(id) ? list.filter((item) => item !== id) : [...list, id];
}

export function StatusChip({
  status,
  active,
  onClick,
}: {
  status: IxacsStatusOption;
  active?: boolean;
  onClick?: () => void;
}) {
  const style = {
    ["--notify-status-bg" as string]: status.backgroundColor ?? "transparent",
    ["--notify-status-fg" as string]: status.textColor ?? "inherit",
    ["--notify-status-blink-bg" as string]: status.blinkingBackgroundColor ?? status.backgroundColor ?? "transparent",
    ["--notify-status-blink-fg" as string]: status.blinkingTextColor ?? status.textColor ?? "inherit",
  } as CSSProperties;

  if (!onClick) {
    return (
      <span
        className={`notify-status ${active ? "is-active" : ""} ${status.blinking ? "is-blinking" : ""}`}
        style={style}
      >
        {status.name}
      </span>
    );
  }

  return (
    <button
      type="button"
      className={`notify-status ${active ? "is-active" : ""} ${status.blinking ? "is-blinking" : ""}`}
      style={style}
      aria-pressed={active}
      onClick={onClick}
    >
      {active ? <FiCheck size={14} aria-hidden /> : null}
      {status.name}
    </button>
  );
}
