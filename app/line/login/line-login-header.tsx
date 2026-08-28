"use client";

import { LanguageMenu } from "@/app/language-menu";
import { ThemeMenu } from "@/app/theme-menu";
import type { LineLoginCopy } from "./line-login-copy";

export function LineLoginHeader({ copy }: { copy: LineLoginCopy }) {
  return (
    <header className="line-login-header">
      <p className="line-login-brand">{copy.brand}</p>
      <div className="line-login-header-tools">
        <ThemeMenu />
        <LanguageMenu />
      </div>
    </header>
  );
}
