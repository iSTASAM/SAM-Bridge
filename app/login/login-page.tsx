"use client";

import { AppToolbar } from "../app-toolbar";
import { useLocale } from "../locale-context";
import { LOGIN_COPY } from "./login-copy";
import { LoginForm } from "./login-form";

export function LoginPage({ admin = false }: { admin?: boolean }) {
  const { locale } = useLocale();
  const copy = LOGIN_COPY[locale];

  return (
    <div className="login-page">
      <header className="login-topbar">
        <div className="login-topbar-inner">
          <p className="login-brand">{copy.brand}</p>
          <AppToolbar />
        </div>
      </header>

      <main className="login-content">
        <LoginForm
          copy={admin ? {
            ...copy,
            signIn: `${copy.signIn} Admin`,
            signInLead: copy.adminLead,
            failed: copy.adminFailed,
          } : copy}
          admin={admin}
        />
      </main>

      <p className="login-footnote">{copy.footnote}</p>
    </div>
  );
}
