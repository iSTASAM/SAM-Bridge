"use client";

import { useEffect, useState } from "react";

const STORAGE_KEY = "sam-lp-typewriter-at";
const REPLAY_AFTER_MS = 30 * 60 * 1000;
const FULL_MS_PER_CHAR = 95;
const SHORT_MS_PER_CHAR = 28;

function prefersReducedMotion() {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function readLastPlayed() {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const value = Number(raw);
    return Number.isFinite(value) ? value : null;
  } catch {
    return null;
  }
}

function markPlayed() {
  try {
    sessionStorage.setItem(STORAGE_KEY, String(Date.now()));
  } catch {
    /* ignore */
  }
}

type Mode = "full" | "short" | "instant";

function resolveMode(): Mode {
  if (prefersReducedMotion()) return "instant";
  const last = readLastPlayed();
  if (last == null) return "full";
  if (Date.now() - last > REPLAY_AFTER_MS) return "full";
  return "short";
}

export function TypewriterHeadline({
  lineA,
  lineB,
}: {
  lineA: string;
  lineB: string;
}) {
  const full = `${lineA}\n${lineB}`;
  const [text, setText] = useState("");
  const [done, setDone] = useState(false);

  useEffect(() => {
    const mode = resolveMode();
    let timer: number | undefined;
    const frame = window.requestAnimationFrame(() => {
      if (mode === "instant") {
        setText(full);
        setDone(true);
        return;
      }

      const ms = mode === "full" ? FULL_MS_PER_CHAR : SHORT_MS_PER_CHAR;
      setText("");
      setDone(false);
      let index = 0;
      timer = window.setInterval(() => {
        index += 1;
        setText(full.slice(0, index));
        if (index >= full.length) {
          window.clearInterval(timer);
          setDone(true);
          if (mode === "full") markPlayed();
        }
      }, ms);
    });

    return () => {
      window.cancelAnimationFrame(frame);
      if (timer !== undefined) window.clearInterval(timer);
    };
  }, [full]);

  const newline = text.indexOf("\n");
  const visibleA = newline === -1 ? text : text.slice(0, newline);
  const visibleB = newline === -1 ? "" : text.slice(newline + 1);
  const showSecond = newline !== -1;

  return (
    <h1 className={`lp-headline${done ? " is-done" : " is-typing"}`} aria-label={`${lineA} ${lineB}`}>
      <span aria-hidden>{visibleA}</span>
      {showSecond ? (
        <>
          <br aria-hidden />
          <span aria-hidden>{visibleB}</span>
        </>
      ) : null}
    </h1>
  );
}
