import Link from "next/link";
import type { Copy } from "./copy";

type PushSubnavProps = {
  copy: Copy;
  active: "setup" | "events";
};

export function PushSubnav({ copy, active }: PushSubnavProps) {
  return (
    <nav className="pac-subnav" aria-label={copy.title}>
      <Link
        href="/settings/push"
        className={`pac-subnav-link${active === "setup" ? " is-active" : ""}`}
        aria-current={active === "setup" ? "page" : undefined}
      >
        {copy.navSetup}
      </Link>
      <Link
        href="/settings/push/events"
        className={`pac-subnav-link${active === "events" ? " is-active" : ""}`}
        aria-current={active === "events" ? "page" : undefined}
      >
        {copy.navEvents}
      </Link>
    </nav>
  );
}
