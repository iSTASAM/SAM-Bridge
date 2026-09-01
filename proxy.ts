import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { AUTH_COOKIE, readSessionToken } from "@/lib/auth";
import { LINE_AUTH_COOKIE, readLineSessionToken } from "@/lib/line-auth";

const PASS_THROUGH = new Set(["GET", "HEAD"]);

function isPushWebhook(request: NextRequest) {
  const method = request.method.toUpperCase();
  const { pathname } = request.nextUrl;
  if (pathname === "/api/push" || pathname.startsWith("/api/push/")) return true;
  // LINE portal routes (/line/api/regist, /line/api/monitor, …) are not iXacs push webhooks.
  if (pathname === "/line" || pathname.startsWith("/line/")) return false;
  return !pathname.startsWith("/api/") && !PASS_THROUGH.has(method);
}

function isPublicPath(pathname: string) {
  return (
    pathname === "/" ||
    pathname === "/login" ||
    pathname === "/admin/login" ||
    pathname === "/api/login" ||
    pathname === "/api/admin/login" ||
    pathname === "/api/logout" ||
    pathname === "/api/session" ||
    pathname === "/line/login" ||
    pathname === "/line/api/logout" ||
    pathname === "/api/line/config" ||
    pathname === "/api/line/auth/login" ||
    pathname === "/api/line/auth/logout" ||
    pathname === "/api/line/webhook" ||
    pathname === "/api/slack/events" ||
    pathname === "/api/gpt-actions/openapi.json" ||
    pathname === "/gpt-actions/privacy"
  );
}

function isGptActionApi(pathname: string) {
  return [
    "/api/gpt-actions/companies",
    "/api/gpt-actions/data",
    "/api/gpt-actions/lost-time",
  ].includes(pathname);
}

function isTabularExportApi(pathname: string) {
  return /^\/api\/(?:power-bi|excel)\/exports\/[^/]+$/.test(pathname);
}

function isAdminPage(pathname: string) {
  return ["/settings/sources", "/settings/ai", "/settings/gpt-actions", "/settings/exports", "/settings/line-webhook", "/settings/systems"].some(
    (path) => pathname === path || pathname.startsWith(`${path}/`),
  );
}

function isAdminApi(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (["/api/sources", "/api/ai", "/api/gpt-actions/settings", "/api/exports", "/api/notifications", "/api/slack/settings", "/api/line/webhook-settings", "/api/line-users", "/api/admin/systems", "/api/admin/accounts"].some(
    (path) => pathname === path || pathname.startsWith(`${path}/`),
  )) return true;
  const isDataRead =
    request.method === "POST" &&
    /^\/api\/connections\/[^/]+\/(?:data|lost-time)$/.test(pathname);
  if (isDataRead) return false;
  return pathname === "/api/connections/login" ||
    ((pathname === "/api/connections" || pathname.startsWith("/api/connections/")) && request.method !== "GET");
}

function rewriteToPush(request: NextRequest) {
  const headers = new Headers(request.headers);
  headers.set("x-original-url", request.url);
  headers.set("x-original-path", request.nextUrl.pathname);

  const url = request.nextUrl.clone();
  url.pathname = "/api/push";

  return NextResponse.rewrite(url, {
    request: { headers },
  });
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Public static assets must bypass auth (e.g. /ixacs-logo.png used on /line/login).
  if (/\.(?:avif|css|gif|ico|jpeg|jpg|js|map|png|svg|txt|webp|woff2?)$/i.test(pathname)) {
    return NextResponse.next();
  }

  if (isPushWebhook(request)) {
    if (pathname.startsWith("/api/")) return NextResponse.next();
    return rewriteToPush(request);
  }

  if (isPublicPath(pathname)) {
    if (pathname === "/login" || pathname === "/admin/login") {
      const session = await readSessionToken(request.cookies.get(AUTH_COOKIE)?.value);
      if (session && (pathname === "/login" || session.role === "admin")) {
        return NextResponse.redirect(new URL("/home", request.url));
      }
    }
    return NextResponse.next();
  }

  if (pathname === "/line" || pathname.startsWith("/line/")) {
    const lineSession = await readLineSessionToken(request.cookies.get(LINE_AUTH_COOKIE)?.value);
    if (lineSession) return NextResponse.next();
    return NextResponse.redirect(new URL("/line/login", request.url));
  }

  // These endpoints authenticate with their own Bearer key so ChatGPT can
  // reach them without a browser session cookie.
  if (isGptActionApi(pathname)) return NextResponse.next();
  // Power BI and Excel authenticate with an export-specific Bearer key.
  if (isTabularExportApi(pathname)) return NextResponse.next();

  const session = await readSessionToken(request.cookies.get(AUTH_COOKIE)?.value);
  if (session) {
    if (session.role !== "admin" && (isAdminPage(pathname) || isAdminApi(request))) {
      if (pathname.startsWith("/api/")) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      return NextResponse.redirect(new URL("/home", request.url));
    }
    return NextResponse.next();
  }

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const login = new URL("/login", request.url);
  if (pathname !== "/" && pathname !== "/home") login.searchParams.set("next", pathname);
  return NextResponse.redirect(login);
}

export const config = {
  matcher: [
    "/",
    "/((?!_next/static|_next/image|_next/webpack-hmr|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|map|txt|woff2?)$).*)",
  ],
};
