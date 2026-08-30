"use client";

import { useLocale } from "../../locale-context";
import { SYSTEMS_COPY } from "./copy";
import { SystemsHub } from "./systems-channel-nav";

export default function AdminSystemsPage() {
  const { locale } = useLocale();
  return <SystemsHub copy={SYSTEMS_COPY[locale]} />;
}
