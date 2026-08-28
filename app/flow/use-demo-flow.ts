"use client";

import { useCallback, useEffect, useState } from "react";
import {
  DEMO_FLOWS,
  flowIndexBySource,
  type DemoSourceId,
  type DemoStage,
} from "./demo-data";

const MOTION: Record<DemoStage, number> = {
  idle: 360,
  source: 520,
  ingesting: 1100,
  processing: 2400,
  processed: 1500,
  exporting: 1100,
  complete: 1360,
};

const STILL: Record<DemoStage, number> = {
  idle: 280,
  source: 700,
  ingesting: 0,
  processing: 900,
  processed: 0,
  exporting: 0,
  complete: 1400,
};

function nextStage(stage: DemoStage, motion: boolean): DemoStage {
  switch (stage) {
    case "idle":
      return "source";
    case "source":
      return motion ? "ingesting" : "processing";
    case "ingesting":
      return "processing";
    case "processing":
      return motion ? "processed" : "complete";
    case "processed":
      return "exporting";
    case "exporting":
      return "complete";
    case "complete":
      return "idle";
  }
}

export function useDemoFlow({ hovering, motion }: { hovering: boolean; motion: boolean }) {
  const [index, setIndex] = useState(0);
  const [stage, setStage] = useState<DemoStage>("idle");

  const play = useCallback((source: DemoSourceId) => {
    setIndex((current) => (source === "ixacs" ? current : flowIndexBySource(source)));
    setStage("source");
  }, []);

  useEffect(() => {
    if (hovering && stage === "idle") return;
    const wait = (motion ? MOTION : STILL)[stage];
    const timer = window.setTimeout(() => {
      if (stage === "complete") {
        setIndex((value) => (value + 1) % DEMO_FLOWS.length);
        setStage("idle");
        return;
      }
      setStage(nextStage(stage, motion));
    }, wait);
    return () => window.clearTimeout(timer);
  }, [stage, hovering, motion]);

  return {
    flow: DEMO_FLOWS[index],
    stage,
    play,
  };
}
