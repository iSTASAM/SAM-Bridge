import { request as httpRequest } from "node:http";
import { request as httpsRequest } from "node:https";
import { normalizeBaseUrl, normalizeBasicAuth, normalizeSession } from "@/lib/ixacs-curl";

export type IxacsLoginInput = {
  loginUrl: string;
  customerId: string;
  selectedCustomerId?: string;
  loginId: string;
  password: string;
  basicAuth?: string;
  language?: "th" | "en" | "ja";
};

export type IxacsCustomerOption = {
  id: string;
  name: string;
};

export type IxacsLoginResult = {
  ok: boolean;
  status: number;
  baseUrl: string;
  loginUrl: string;
  session: string;
  basicAuth?: string;
  customers?: IxacsCustomerOption[];
  /** @deprecated Prefer customers */
  customerIds?: string[];
  error?: string;
  diagnostic?: {
    transport: "raw-navigation-v2";
    hasSession: boolean;
    sessionRotated: boolean;
    followedRedirect: boolean;
    endedAtLogin: boolean;
    finalPath: string;
    serverRejected: boolean;
    authenticated: boolean;
    postContentType: string;
    postHasLoginForm: boolean;
    checkLoginStatus: number;
    checkLoginResponse: string;
    gatewayVersion: string;
    gatewaySessionInitialized: boolean;
    credentialLengths: {
      customerId: number;
      loginId: number;
      password: number;
    };
    serverMessage?: string;
  };
};

const MAX_REDIRECTS = 5;
const BROWSER_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36 Edg/151.0.0.0";
const BROWSER_SEC_CH_UA =
  '"Not=A?Brand";v="99", "Microsoft Edge";v="151", "Chromium";v="151"';

export function normalizeLoginUrl(raw: string) {
  const value = raw.trim();
  if (!value) return "";

  try {
    const url = new URL(value);
    if (url.protocol !== "https:" && url.protocol !== "http:") return "";
    url.hash = "";
    return url.toString();
  } catch {
    return "";
  }
}

function setCookieValues(headers: Headers) {
  const extended = headers as Headers & { getSetCookie?: () => string[] };
  const values = extended.getSetCookie?.();
  if (values && values.length > 0) return values;

  const combined = headers.get("set-cookie");
  return combined ? [combined] : [];
}

function rememberCookies(headers: Headers, jar: Map<string, string>) {
  for (const value of setCookieValues(headers)) {
    const matches = value.matchAll(/(?:^|,\s*)([^=;,\s]+)=([^;]*)/g);
    for (const match of matches) {
      const name = match[1]?.trim();
      if (!name || name.toLowerCase() === "expires") continue;
      jar.set(name, match[2]?.trim() ?? "");
    }
  }
}

function cookieHeader(jar: Map<string, string>) {
  return [...jar.entries()]
    .filter(([, value]) => value !== "")
    .map(([name, value]) => `${name}=${value}`)
    .join("; ");
}

function sessionFromJar(jar: Map<string, string>) {
  for (const [name, value] of jar) {
    if (name.toLowerCase() === "session") return normalizeSession(value);
  }
  return "";
}

function requestHeaders(jar: Map<string, string>) {
  const headers: Record<string, string> = {};
  const cookies = cookieHeader(jar);
  if (cookies) headers.cookie = cookies;
  return headers;
}

function browserNavigationHeaders(
  jar: Map<string, string>,
  options?: { origin?: string; referer?: string; form?: boolean },
) {
  const headers = requestHeaders(jar);
  headers.accept = options?.form
    ? "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8"
    : "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8";
  headers["accept-language"] = "en-US,en;q=0.9,th;q=0.8,ja;q=0.7";
  headers["cache-control"] = "max-age=0";
  headers["upgrade-insecure-requests"] = "1";
  headers["user-agent"] = BROWSER_USER_AGENT;
  if (options?.origin) headers.origin = options.origin;
  if (options?.referer) headers.referer = options.referer;
  if (options?.form) {
    headers["content-type"] = "application/x-www-form-urlencoded";
    headers.priority = "u=0, i";
    headers["sec-ch-ua"] = BROWSER_SEC_CH_UA;
    headers["sec-ch-ua-mobile"] = "?0";
    headers["sec-ch-ua-platform"] = '"Windows"';
    headers["sec-fetch-dest"] = "document";
    headers["sec-fetch-mode"] = "navigate";
    headers["sec-fetch-site"] = "same-origin";
    headers["sec-fetch-user"] = "?1";
  }
  return headers;
}

function postBrowserForm(url: string, headers: Record<string, string>, body: string) {
  const target = new URL(url);
  const send = target.protocol === "https:" ? httpsRequest : httpRequest;

  return new Promise<Response>((resolve, reject) => {
    const request = send(
      target,
      {
        method: "POST",
        headers: {
          ...headers,
          "content-length": Buffer.byteLength(body).toString(),
        },
      },
      (response) => {
        const chunks: Buffer[] = [];
        response.on("data", (chunk: Buffer) => chunks.push(chunk));
        response.on("error", reject);
        response.on("end", () => {
          const responseHeaders = new Headers();
          for (let index = 0; index < response.rawHeaders.length; index += 2) {
            responseHeaders.append(
              response.rawHeaders[index],
              response.rawHeaders[index + 1] ?? "",
            );
          }
          resolve(
            new Response(Buffer.concat(chunks), {
              status: response.statusCode ?? 502,
              statusText: response.statusMessage,
              headers: responseHeaders,
            }),
          );
        });
      },
    );
    request.setTimeout(15_000, () => {
      request.destroy(new Error("iXacs login request timed out"));
    });
    request.on("error", reject);
    request.end(body);
  });
}

function loginServerMessage(html: string) {
  const messageHtml = html.match(
    /<div\b[^>]*\bid=["']message_area["'][^>]*>([\s\S]*?)<\/div>/i,
  )?.[1];
  if (!messageHtml) return "";
  return messageHtml
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 300);
}

function decodeHtmlText(value: string) {
  return value
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function preferCustomerName(id: string, rawName: string) {
  const text = decodeHtmlText(rawName);
  if (!text) return "";
  if (text === id) return "";
  // "ID Company Name" or "Company Name (ID)" → keep the company part.
  const withoutId = text
    .replace(new RegExp(`\\b${id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "gi"), " ")
    .replace(/[()［］【】]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return withoutId || (text !== id ? text : "");
}

function rememberCustomer(
  map: Map<string, string>,
  id: string,
  name?: string,
) {
  const cleanId = id.trim();
  if (!cleanId || cleanId.length >= 120) return;
  const cleanName = name ? preferCustomerName(cleanId, name) : "";
  const previous = map.get(cleanId) ?? "";
  if (!map.has(cleanId)) {
    map.set(cleanId, cleanName);
    return;
  }
  if (cleanName && (!previous || cleanName.length > previous.length)) {
    map.set(cleanId, cleanName);
  }
}

function customersFromSelectionPage(html: string): IxacsCustomerOption[] {
  const map = new Map<string, string>();

  for (const select of html.matchAll(
    /<select\b[^>]*\bname=["']customerId["'][^>]*>([\s\S]*?)<\/select>/gi,
  )) {
    for (const option of select[1].matchAll(
      /<option\b([^>]*)>([\s\S]*?)<\/option>/gi,
    )) {
      const value = option[1].match(/\bvalue=["']([^"']+)["']/i)?.[1]?.trim();
      if (!value) continue;
      rememberCustomer(map, value, option[2]);
    }
  }

  for (const button of html.matchAll(
    /<button\b([^>]*)>([\s\S]*?)<\/button>/gi,
  )) {
    if (!/\bname=["']customerId["']/i.test(button[1])) continue;
    const value = button[1].match(/\bvalue=["']([^"']+)["']/i)?.[1]?.trim();
    if (!value) continue;
    rememberCustomer(map, value, button[2]);
  }

  for (const label of html.matchAll(/<label\b[^>]*>([\s\S]*?)<\/label>/gi)) {
    const input = label[1].match(/<(?:input|button)\b([^>]*)>/i);
    if (!input || !/\bname=["']customerId["']/i.test(input[1])) continue;
    const value = input[1].match(/\bvalue=["']([^"']+)["']/i)?.[1]?.trim();
    if (!value) continue;
    rememberCustomer(map, value, label[1]);
  }

  for (const row of html.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const input = row[1].match(/<(?:input|button)\b([^>]*)>/i);
    if (!input || !/\bname=["']customerId["']/i.test(input[1])) continue;
    const value = input[1].match(/\bvalue=["']([^"']+)["']/i)?.[1]?.trim();
    if (!value) continue;
    const cells = [...row[1].matchAll(/<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi)]
      .map((cell) => decodeHtmlText(cell[1]))
      .filter(Boolean);
    const name =
      cells.find((cell) => cell !== value && !/^(選択|select|choose)$/i.test(cell)) ||
      cells.find((cell) => cell !== value) ||
      "";
    rememberCustomer(map, value, name);
  }

  for (const tag of html.matchAll(/<(?:input|button)\b([^>]*)>/gi)) {
    if (!/\bname=["']customerId["']/i.test(tag[1])) continue;
    const value = tag[1].match(/\bvalue=["']([^"']+)["']/i)?.[1]?.trim();
    if (!value) continue;
    const index = tag.index ?? 0;
    const nearby = html.slice(index, index + 600);
    const nearbyName =
      nearby.match(/\bdata-customer-name=["']([^"']+)["']/i)?.[1] ||
      nearby.match(/\bdata-name=["']([^"']+)["']/i)?.[1] ||
      [...nearby.matchAll(/<(?:span|div|p|td|strong|label)\b[^>]*>([\s\S]*?)<\//gi)]
        .map((item) => preferCustomerName(value, item[1]))
        .find((item) => item.length > 0) ||
      "";
    rememberCustomer(map, value, nearbyName);
  }

  for (const match of html.matchAll(
    /(?:href|action)=["'][^"']*selectCustomer[^"']*[?&]customerId=([^"'&]+)[^"']*["'][^>]*>([\s\S]*?)<\//gi,
  )) {
    rememberCustomer(map, decodeURIComponent(match[1]), match[2]);
  }

  for (const match of html.matchAll(/\bdata-customer-id=["']([^"']+)["'][^>]*>/gi)) {
    const chunk = html.slice(match.index ?? 0, (match.index ?? 0) + 400);
    const name =
      chunk.match(/\bdata-customer-name=["']([^"']+)["']/i)?.[1] ||
      chunk.match(/\bdata-name=["']([^"']+)["']/i)?.[1] ||
      "";
    rememberCustomer(map, match[1], name);
  }

  return [...map.entries()].map(([id, name]) => ({ id, name: name || id }));
}

function isCustomerSelectionPage(url: string, html: string) {
  try {
    if (new URL(url).pathname === "/gateway/web/selectCustomer") return true;
  } catch {
    // ignore
  }
  return (
    /\/gateway\/web\/selectCustomer/i.test(html) &&
    (/\bname=["']customerId["']/i.test(html) || /selectCustomer/i.test(html))
  );
}

function gatewayApiHeaders(
  jar: Map<string, string>,
  basicAuth: string | undefined,
  baseUrl: string,
  referer: string,
) {
  const headers = requestHeaders(jar);
  const authorization = normalizeBasicAuth(basicAuth ?? "");
  headers.accept = "application/json, text/javascript, */*; q=0.01";
  headers["accept-language"] = "en-US,en;q=0.9,th;q=0.8,ja;q=0.7";
  headers.origin = baseUrl;
  headers.referer = referer;
  headers["user-agent"] = BROWSER_USER_AGENT;
  headers["x-requested-with"] = "XMLHttpRequest";
  if (authorization) headers.authorization = `Basic ${authorization}`;
  return headers;
}

export async function loginIxacs(input: IxacsLoginInput): Promise<IxacsLoginResult> {
  const loginUrl = normalizeLoginUrl(input.loginUrl);
  const customerId = input.customerId.trim();
  const loginId = input.loginId.trim();
  const baseUrl = loginUrl ? normalizeBaseUrl(loginUrl) : "";

  if (!loginUrl || !loginId || !input.password) {
    return {
      ok: false,
      status: 400,
      baseUrl,
      loginUrl,
      session: "",
      error: "LOGIN_FIELDS_REQUIRED",
    };
  }

  const jar = new Map<string, string>();
  let currentUrl = loginUrl;
  let status = 0;

  try {
    const loginOrigin = new URL(loginUrl).origin;
    const loginPageUrl = new URL(loginUrl);
    if (input.language && !loginPageUrl.searchParams.has("lang")) {
      loginPageUrl.searchParams.set("lang", input.language);
    }
    const initial = await fetch(loginPageUrl, {
      method: "GET",
      cache: "no-store",
      redirect: "manual",
      headers: browserNavigationHeaders(jar),
      signal: AbortSignal.timeout(15_000),
    });
    rememberCookies(initial.headers, jar);
    const initialHtml = await initial.text();
    const pageBasicAuth = normalizeBasicAuth(
      initialHtml.match(/BASIC_AUTH_INFO\s*=\s*["']Basic\s+([^"']+)/i)?.[1] ?? "",
    );
    const effectiveBasicAuth = normalizeBasicAuth(input.basicAuth ?? "") || pageBasicAuth;

    const bootstrapHeaders = () =>
      gatewayApiHeaders(
        jar,
        effectiveBasicAuth,
        baseUrl,
        loginPageUrl.toString(),
      );
    const versionResponse = await fetch(`${baseUrl}/gateway/api/getVersion`, {
      method: "POST",
      cache: "no-store",
      redirect: "manual",
      headers: bootstrapHeaders(),
      signal: AbortSignal.timeout(15_000),
    });
    rememberCookies(versionResponse.headers, jar);
    const gatewayVersion = (await versionResponse.text()).trim().slice(0, 50);

    const sessionIdResponse = await fetch(`${baseUrl}/gateway/api/getSessionId`, {
      method: "POST",
      cache: "no-store",
      redirect: "manual",
      headers: bootstrapHeaders(),
      signal: AbortSignal.timeout(15_000),
    });
    rememberCookies(sessionIdResponse.headers, jar);
    const gatewaySessionInitialized = Boolean((await sessionIdResponse.text()).trim());

    if (!versionResponse.ok || !gatewayVersion || !sessionIdResponse.ok || !gatewaySessionInitialized) {
      return {
        ok: false,
        status: !versionResponse.ok ? versionResponse.status : sessionIdResponse.status,
        baseUrl,
        loginUrl,
        session: "",
        error: "LOGIN_GATEWAY_BOOTSTRAP_FAILED",
      };
    }
    const preLoginSession = sessionFromJar(jar);

    const body = new URLSearchParams({
      customerId,
      loginId,
      password: input.password,
    });
    // Some iXacs tenants infer the customer from the Login ID. For those
    // tenants, omitting customerId is different from posting customerId=.
    if (!customerId) body.delete("customerId");

    let response = await postBrowserForm(
      loginUrl,
      browserNavigationHeaders(jar, {
        origin: loginOrigin,
        referer: loginPageUrl.toString(),
        form: true,
      }),
      body.toString(),
    );

    let followedLoginRedirect = false;
    for (let redirect = 0; redirect <= MAX_REDIRECTS; redirect += 1) {
      status = response.status;
      rememberCookies(response.headers, jar);

      const location = response.headers.get("location");
      if (!location || ![301, 302, 303, 307, 308].includes(response.status)) break;

      const nextUrl = new URL(location, currentUrl);
      if (nextUrl.origin !== new URL(loginUrl).origin) {
        return {
          ok: false,
          status,
          baseUrl,
          loginUrl,
          session: "",
          error: "LOGIN_REDIRECT_NOT_ALLOWED",
        };
      }

      const previousUrl = currentUrl;
      currentUrl = nextUrl.toString();
      followedLoginRedirect = true;
      response = await fetch(currentUrl, {
        method: "GET",
        cache: "no-store",
        redirect: "manual",
        headers: browserNavigationHeaders(jar, { referer: previousUrl }),
        signal: AbortSignal.timeout(15_000),
      });
    }

    let responseHtml = await response.text().catch(() => "");

    if (isCustomerSelectionPage(currentUrl, responseHtml)) {
      // Prefer an explicit GET of the selection page so the HTML is complete.
      if (new URL(currentUrl).pathname !== "/gateway/web/selectCustomer") {
        const selectionPage = await fetch(`${baseUrl}/gateway/web/selectCustomer`, {
          method: "GET",
          cache: "no-store",
          redirect: "manual",
          headers: browserNavigationHeaders(jar, { referer: currentUrl }),
          signal: AbortSignal.timeout(15_000),
        });
        rememberCookies(selectionPage.headers, jar);
        response = selectionPage;
        currentUrl = `${baseUrl}/gateway/web/selectCustomer`;
        responseHtml = await selectionPage.text().catch(() => responseHtml);
      }

      const customers = customersFromSelectionPage(responseHtml);
      const selectedCustomerId =
        input.selectedCustomerId?.trim() || customerId;

      if (!selectedCustomerId) {
        if (customers.every((item) => !item.name || item.name === item.id)) {
          console.warn("iXacs selectCustomer name parse miss", {
            count: customers.length,
            sample: customers.slice(0, 5),
            htmlSnippet: responseHtml.replace(/\s+/g, " ").slice(0, 1200),
          });
        }
        return {
          ok: false,
          status: 409,
          baseUrl,
          loginUrl,
          session: "",
          error: "LOGIN_CUSTOMER_SELECTION_REQUIRED",
          customers,
          customerIds: customers.map((item) => item.id),
        };
      }

      response = await postBrowserForm(
        `${baseUrl}/gateway/web/selectCustomer`,
        browserNavigationHeaders(jar, {
          origin: loginOrigin,
          referer: `${baseUrl}/gateway/web/selectCustomer`,
          form: true,
        }),
        new URLSearchParams({ customerId: selectedCustomerId }).toString(),
      );
      currentUrl = `${baseUrl}/gateway/web/selectCustomer`;
      responseHtml = "";

      for (let redirect = 0; redirect <= MAX_REDIRECTS; redirect += 1) {
        status = response.status;
        rememberCookies(response.headers, jar);
        const location = response.headers.get("location");
        if (!location || ![301, 302, 303, 307, 308].includes(response.status)) break;
        const previousUrl = currentUrl;
        const nextUrl = new URL(location, currentUrl);
        if (nextUrl.origin !== new URL(loginUrl).origin) break;
        currentUrl = nextUrl.toString();
        followedLoginRedirect = true;
        response = await fetch(currentUrl, {
          method: "GET",
          cache: "no-store",
          redirect: "manual",
          headers: browserNavigationHeaders(jar, { referer: previousUrl }),
          signal: AbortSignal.timeout(15_000),
        });
      }
    }

    const session = sessionFromJar(jar);
    const endedAtLogin =
      new URL(currentUrl).pathname === new URL(loginUrl).pathname;
    let authenticated = false;
    let checkLoginStatus = 0;
    let checkLoginResponse = "";
    if (session) {
      const checkLogin = await fetch(`${baseUrl}/gateway/api/checkLogin`, {
        method: "POST",
        cache: "no-store",
        redirect: "manual",
        headers: gatewayApiHeaders(
          jar,
          effectiveBasicAuth,
          baseUrl,
          loginPageUrl.toString(),
        ),
        signal: AbortSignal.timeout(15_000),
      });
      rememberCookies(checkLogin.headers, jar);
      checkLoginStatus = checkLogin.status;
      checkLoginResponse = (await checkLogin.text()).trim().toLowerCase().slice(0, 100);
      authenticated = checkLogin.ok && checkLoginResponse === "true";
    }
    if (!session || !authenticated) {
      if (!responseHtml) {
        responseHtml = await response.text().catch(() => "");
      }
      const serverMessage = loginServerMessage(responseHtml);
      return {
        ok: false,
        status,
        baseUrl,
        loginUrl,
        session: "",
        error: "LOGIN_FAILED",
        diagnostic: {
          transport: "raw-navigation-v2",
          hasSession: Boolean(session),
          sessionRotated: Boolean(preLoginSession && session && preLoginSession !== session),
          followedRedirect: followedLoginRedirect,
          endedAtLogin,
          finalPath: new URL(currentUrl).pathname,
          serverRejected: !authenticated && (
            endedAtLogin ||
            /class=["'][^"']*text-danger/i.test(responseHtml) ||
            /ログインできませんでした|login failed|เข้าสู่ระบบไม่ได้/i.test(responseHtml)
          ),
          authenticated,
          postContentType: response.headers.get("content-type") ?? "",
          postHasLoginForm: /<form\b[^>]*\bid=["']LoginForm["']/i.test(responseHtml),
          checkLoginStatus,
          checkLoginResponse,
          gatewayVersion,
          gatewaySessionInitialized,
          credentialLengths: {
            customerId: customerId.length,
            loginId: loginId.length,
            password: input.password.length,
          },
          ...(serverMessage ? { serverMessage } : {}),
        },
      };
    }

    currentUrl = `${baseUrl}/ct-monitor`;
    response = await fetch(currentUrl, {
      method: "GET",
      cache: "no-store",
      redirect: "manual",
      headers: requestHeaders(jar),
      signal: AbortSignal.timeout(15_000),
    });

    for (let redirect = 0; redirect <= MAX_REDIRECTS; redirect += 1) {
      status = response.status;
      rememberCookies(response.headers, jar);

      const location = response.headers.get("location");
      if (!location || ![301, 302, 303, 307, 308].includes(response.status)) break;

      const nextUrl = new URL(location, currentUrl);
      if (nextUrl.origin !== new URL(loginUrl).origin) break;
      const previousUrl = currentUrl;
      currentUrl = nextUrl.toString();
      response = await fetch(currentUrl, {
        method: "GET",
        cache: "no-store",
        redirect: "manual",
        headers: browserNavigationHeaders(jar, { referer: previousUrl }),
        signal: AbortSignal.timeout(15_000),
      });
    }

    if (new URL(currentUrl).pathname === new URL(loginUrl).pathname) {
      return {
        ok: false,
        status,
        baseUrl,
        loginUrl,
        session: "",
        error: "LOGIN_MONITOR_UNAUTHORIZED",
      };
    }

    return {
      ok: true,
      status,
      baseUrl,
      loginUrl,
      session: sessionFromJar(jar),
      basicAuth: effectiveBasicAuth,
    };

  } catch (error) {
    return {
      ok: false,
      status,
      baseUrl,
      loginUrl,
      session: "",
      error: error instanceof Error ? error.message : "LOGIN_REQUEST_FAILED",
    };
  }
}
