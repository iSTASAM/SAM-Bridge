"use client";

import { useCallback, useEffect, useState } from "react";
import { useLocale } from "../../locale-context";
import { SYSTEMS_COPY } from "./copy";
import { ChannelPageTitle, SystemsPageShell, type SystemsChannel } from "./systems-channel-nav";

export function ChannelSettings({ channel }: { channel: Exclude<SystemsChannel, "line" | "slack"> }) {
  const { locale } = useLocale();
  const copy = SYSTEMS_COPY[locale];
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <SystemsPageShell
      copy={copy}
      title={
        <ChannelPageTitle
          channel={channel}
          label={channel === "line-works" ? copy.navLineWorks : copy.navEmail}
        />
      }
      loading={loading}
      backHref="/settings/systems/alerts"
    >
      <section className="as-empty as-channel-empty">
        <p>{copy.comingSoon}</p>
      </section>
    </SystemsPageShell>
  );
}
