"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { FiLogIn, FiLogOut } from "react-icons/fi";
import { AppToolbar } from "./app-toolbar";
import { TypewriterHeadline } from "./landing-typewriter";
import { IxacsLogo } from "./line/ixacs-logo";
import { LinePhonePreview } from "./line-preview/line-phone-preview";
import { demoLinePreview } from "./line-preview/normalize";
import type { LinePreviewModel } from "./line-preview/types";
import { useLocale } from "./locale-context";

const COPY = {
  th: {
    brand: "SAM Bridge",
    login: "เข้าสู่ระบบ",
    logout: "ออกจากระบบ",
    headlineA: "เชื่อมทุกระบบ",
    headlineB: "ให้ทำงานร่วมกัน",
    subhead:
      "SAM Bridge เชื่อมข้อมูล ระบบองค์กร AI และช่องทางการสื่อสารเข้าด้วยกัน เพื่อให้ข้อมูลจากระบบหนึ่งสามารถทำงานต่อในอีกระบบได้โดยอัตโนมัติ",
    ctaPrimary: "เข้าสู่ระบบ",
    ctaSecondary: "ดูการทำงาน",
  },
  en: {
    brand: "SAM Bridge",
    login: "Login",
    logout: "Log out",
    headlineA: "Connect every system",
    headlineB: "so they work together",
    subhead:
      "SAM Bridge connects your systems, data, automation, and communication channels in one workflow — so information from one system can continue working in another automatically.",
    ctaPrimary: "Login",
    ctaSecondary: "See how it works",
  },
  ja: {
    brand: "SAM Bridge",
    login: "ログイン",
    logout: "ログアウト",
    headlineA: "すべてのシステムを",
    headlineB: "つなぎ、連携させる",
    subhead:
      "SAM Bridgeは、システム・データ・自動化・コミュニケーションチャネルを一つのワークフローでつなぎ、あるシステムの情報を別のシステムでも自動的に活用できるようにします。",
    ctaPrimary: "ログイン",
    ctaSecondary: "動作を見る",
  },
} as const;

type LandingCopy = (typeof COPY)[keyof typeof COPY];

function LandingNav({ copy }: { copy: LandingCopy }) {
  const router = useRouter();
  const [authenticated, setAuthenticated] = useState(false);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/session", { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : null))
      .then((value) => {
        if (!cancelled) setAuthenticated(Boolean(value?.authenticated));
      })
      .catch(() => {
        if (!cancelled) setAuthenticated(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function logout() {
    if (pending) return;
    setPending(true);
    try {
      await fetch("/api/logout", { method: "POST" });
      setAuthenticated(false);
      router.replace("/");
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <header className="lp-nav">
      <div className="lp-nav-inner">
        <Link href="/" className="lp-brand">
          {copy.brand}
        </Link>
        <div className="lp-nav-actions">
          <AppToolbar showDocs={authenticated} />
          {authenticated ? (
            <button
              type="button"
              className="lp-nav-auth"
              aria-label={copy.logout}
              title={copy.logout}
              disabled={pending}
              onClick={() => void logout()}
            >
              <FiLogOut size={16} aria-hidden />
            </button>
          ) : (
            <Link
              href="/login"
              className="lp-nav-auth"
              aria-label={copy.login}
              title={copy.login}
            >
              <FiLogIn size={16} aria-hidden />
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}

function Hero({
  copy,
  preview,
}: {
  copy: LandingCopy;
  preview: LinePreviewModel;
}) {
  return (
    <section className="lp-hero">
      <div className="lp-hero-copy">
        <IxacsLogo width={148} className="lp-hero-ixacs" />
        <TypewriterHeadline lineA={copy.headlineA} lineB={copy.headlineB} />
        <p className="lp-subhead">{copy.subhead}</p>
        <div className="lp-hero-actions">
          <Link href="/login" className="btn btn-primary lp-cta">
            {copy.ctaPrimary}
          </Link>
          <a href="#demo" className="btn btn-secondary lp-cta">
            {copy.ctaSecondary}
          </a>
        </div>
      </div>
      <div className="lp-hero-visual">
        <LinePhonePreview model={preview} />
      </div>
    </section>
  );
}

/** Public marketing landing — available at `/`. */
export function LandingPage({ preview }: { preview: LinePreviewModel }) {
  const { locale } = useLocale();
  const copy = COPY[locale];
  const model = preview.source === "demo" ? demoLinePreview(locale) : preview;

  return (
    <div className="lp-page">
      <LandingNav copy={copy} />
      <main className="lp-main">
        <Hero copy={copy} preview={model} />
      </main>
    </div>
  );
}
