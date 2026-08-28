"use client";
import { useEffect, useState } from "react";
import { useLocale } from "@/app/locale-context";
import { LINE_LOGIN_COPY, lineLoginErrorMessage, type LineLoginCopy, type LineLoginErrorCode, type LineLoginUiState } from "./line-login-copy";
import { LineLoginForm } from "./line-login-form";
import { LineLoginHeader } from "./line-login-header";
import { LineLoginIntro } from "./line-login-intro";
import { LineLoginStatus } from "./line-login-status";
import { LineLoginTrust } from "./line-login-trust";

type Liff = { init(o:{liffId:string}):Promise<void>; isLoggedIn():boolean; login():void; isInClient():boolean; getIDToken():string|null; closeWindow():void };
declare global { interface Window { liff?: Liff } }

function loadLiff() {
  if (window.liff) return Promise.resolve(window.liff);
  return new Promise<Liff>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://static.line-scdn.net/liff/edge/2/sdk.js"; script.async = true;
    script.onload = () => window.liff ? resolve(window.liff) : reject(new Error("LIFF_NOT_LOADED"));
    script.onerror = () => reject(new Error("LIFF_NOT_LOADED"));
    document.head.appendChild(script);
  });
}

function mapError(code?: string): LineLoginErrorCode {
  if (code === "ACCOUNT_SUSPENDED") return "suspended";
  if (code === "LINE_LINKED_OTHER" || code === "LINE_USER_ALREADY_LINKED") return "lineLinkedOther";
  if (code === "ACCOUNT_NOT_FOUND") return "notFound";
  if (code === "LINE_ACCESS_DENIED") return "unauthorized";
  return "invalid";
}

function Shell({ copy, state, error, onSubmit, onAction }: { copy:LineLoginCopy; state:LineLoginUiState; error:string|null; onSubmit:(companyId:string,id:string,password:string)=>void; onAction:()=>void }) {
  const form = state === "ready" || state === "submitting" || state === "error";
  return <div className="line-login-page"><LineLoginHeader copy={copy} /><main className="line-login-main"><div className="line-login-card">
    {!form ? <LineLoginStatus copy={copy} state={state} onPrimaryAction={onAction} /> : null}
    {form ? <><LineLoginIntro copy={copy} /><LineLoginForm copy={copy} disabled={state === "submitting"} pending={state === "submitting"} error={error} onSubmit={onSubmit} /><LineLoginTrust copy={copy} /></> : null}
  </div></main></div>;
}

export function LineLoginPage() {
  const { locale } = useLocale(); const copy = LINE_LOGIN_COPY[locale];
  const [state, setState] = useState<LineLoginUiState>("loading");
  const [error, setError] = useState<string|null>(null); const [liff, setLiff] = useState<Liff|null>(null);
  useEffect(() => { let active = true; void (async () => {
    try {
      const response = await fetch("/api/line/config", { cache:"no-store" });
      const config = await response.json() as { configured?:boolean; liffId?:string };
      if (!config.configured || !config.liffId) throw new Error("NOT_CONFIGURED");
      const sdk = await loadLiff(); await sdk.init({ liffId:config.liffId });
      if (!sdk.isInClient()) throw new Error("LINE_CLIENT_REQUIRED");
      if (!sdk.isLoggedIn()) { sdk.login(); return; }
      if (active) { setLiff(sdk); setState("ready"); }
    } catch { if (active) setState("unavailable"); }
  })(); return () => { active = false; }; }, []);

  async function submit(customerCompanyId:string, loginId:string, password:string) {
    if (!liff) { setState("unavailable"); return; }
    setState("submitting"); setError(null);
    try {
      const response = await fetch("/api/line/auth/login", { method:"POST", headers:{"content-type":"application/json"}, body:JSON.stringify({ customerCompanyId, loginId, password, idToken:liff.getIDToken(), inClient:liff.isInClient() }) });
      const result = await response.json().catch(() => ({})) as { error?:string };
      if (!response.ok) { setState("error"); setError(lineLoginErrorMessage(copy, mapError(result.error))); return; }
      window.location.replace("/line/dashboard");
    } catch { setState("error"); setError(copy.errorGeneric); }
  }
  return <Shell copy={copy} state={state} error={error} onSubmit={submit} onAction={() => liff?.closeWindow()} />;
}
