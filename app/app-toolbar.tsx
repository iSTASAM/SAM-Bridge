"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { FiBookOpen } from "react-icons/fi";
import { LanguageMenu } from "./language-menu";
import { ThemeMenu } from "./theme-menu";

export function AppToolbar({ showDocs = false }: { showDocs?: boolean }) {
  const pathname = usePathname();
  const isActive = pathname === "/how-it-works" || pathname.startsWith("/how-it-works/");

  return (
    <div className="app-topbar-tools">
      {showDocs ? (
        <Link
          href="/how-it-works"
          className={`app-docs-link ${isActive ? "is-active" : ""}`}
          title="Docs"
          target="_blank"
          rel="noopener noreferrer"
        >
          <FiBookOpen size={16} aria-hidden />
          <span className="app-docs-text">Docs</span>
        </Link>
      ) : null}
      <LanguageMenu />
      <ThemeMenu />
    </div>
  );
}
