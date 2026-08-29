"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useTheme } from "@/app/theme-context";
import {
  LineAlertRichMessage,
  LineChatHeader,
  LineMessageBubble,
  LineRichMenu,
  LineStatusBar,
  LineStatusRichMessage,
} from "./parts";
import type { LinePreviewModel } from "./types";

function clock(iso: string | null, offsetMin = 0) {
  const base = iso ? new Date(iso) : new Date();
  if (Number.isNaN(base.getTime())) return "10:42";
  const date = new Date(base.getTime() + offsetMin * 60_000);
  return date.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false });
}

export function LinePhonePreview({ model }: { model: LinePreviewModel }) {
  const { resolvedTheme } = useTheme();
  const [active, setActive] = useState("ixacs");
  const [menuCollapsed, setMenuCollapsed] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const times = useMemo(
    () => ({
      user: clock(model.updatedAt, -1),
      bot: clock(model.updatedAt, 0),
    }),
    [model.updatedAt],
  );

  const showAlerts = active === "alerts";
  const showGate = active === "more" || active === "dash" || active === "reports";
  const logoVariant = resolvedTheme === "dark" ? "light-text" : "dark-text";

  function onMenu(id: string) {
    if (id === "refresh") {
      setActive("refresh");
      setRefreshKey((value) => value + 1);
      return;
    }
    setActive(id === "status" ? "ixacs" : id);
  }

  return (
    <div className="lop-phone" id="demo">
      <div className="lop-device">
        <div className="lop-island" aria-hidden />
        <div className="lop-screen">
          <LineStatusBar time={times.bot} />
          <LineChatHeader oaName={model.oaName} oaBadge={model.oaBadge} />

          <div className="lop-chat">
            <div className="lop-day-chip">Today</div>
            <LineMessageBubble text={model.userMessage} time={times.user} from="user" />
            <LineMessageBubble text={model.botReady} time={times.bot} from="bot" />
            {!showAlerts ? (
              <LineStatusRichMessage
                key={refreshKey}
                model={model}
                time={times.bot}
                logoVariant={logoVariant}
              />
            ) : null}
            {showAlerts && model.botAlert ? (
              <>
                <LineMessageBubble text={model.botAlert} time={times.bot} from="bot" />
                <LineAlertRichMessage model={model} time={times.bot} />
              </>
            ) : null}
            {showAlerts && !model.botAlert ? (
              <LineMessageBubble
                text={model.botReady}
                time={times.bot}
                from="bot"
              />
            ) : null}
            {showGate ? (
              <div className="lop-login-hint">
                <p>Sign in to open the live LINE portal.</p>
                <Link href="/login" className="lop-login-link">
                  Login
                </Link>
              </div>
            ) : null}
            <p className={`lop-demo-tag${model.source === "live" ? " is-live" : ""}`}>
              <i /> {model.source === "live" ? "Live data" : "Interactive preview"}
            </p>
          </div>

          <LineRichMenu
            model={model}
            activeId={active}
            onSelect={onMenu}
            collapsed={menuCollapsed}
            onToggle={() => setMenuCollapsed((value) => !value)}
            logoVariant={logoVariant}
          />
        </div>
      </div>
    </div>
  );
}
