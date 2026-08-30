"use client";

import { useLocale } from "../../../locale-context";
import { SYSTEMS_COPY } from "../copy";
import { SystemsAlertsHub } from "../systems-channel-nav";

export default function SystemsAlertsPage() {
  const { locale } = useLocale();
  return <SystemsAlertsHub copy={SYSTEMS_COPY[locale]} />;
}
