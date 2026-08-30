"use client";

import { useLocale } from "../../locale-context";
import { SYSTEMS_COPY } from "./copy";
import { SystemsSoonPage } from "./systems-channel-nav";

export function SystemsSoonRoute({ titleKey }: { titleKey: "menuHealth" | "menuAudit" | "menuSessions" }) {
  const { locale } = useLocale();
  const copy = SYSTEMS_COPY[locale];
  return <SystemsSoonPage copy={copy} title={copy[titleKey]} />;
}
