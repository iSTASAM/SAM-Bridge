"use client";

import { usePathname } from "next/navigation";
import { LocaleProvider } from "./locale-context";
import { AppSidebar, useSidebarHiddenState } from "./sidebar";
import { AppToolbar } from "./app-toolbar";
import { ThemeProvider } from "./theme-context";

function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { hidden, hide, show } = useSidebarHiddenState();
  if (pathname === "/login" || pathname === "/admin/login" || pathname.startsWith("/line/")) return children;

  return (
    <div className={`app-shell ${hidden ? "is-sidebar-hidden" : ""}`}>
      <AppSidebar hidden={hidden} onHide={hide} onShow={show} />
      <div className="app-main">
        <div className="app-topbar">
          <AppToolbar />
        </div>
        <main className="app-content">{children}</main>
      </div>
    </div>
  );
}

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <LocaleProvider>
        <AppShell>{children}</AppShell>
      </LocaleProvider>
    </ThemeProvider>
  );
}
