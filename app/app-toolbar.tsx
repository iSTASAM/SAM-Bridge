"use client";

import { LanguageMenu } from "./language-menu";
import { ThemeMenu } from "./theme-menu";

export function AppToolbar() {
  return (
    <div className="app-topbar-tools">
      <LanguageMenu />
      <ThemeMenu />
    </div>
  );
}
