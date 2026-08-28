"use client";

import { useEffect, useRef } from "react";

export function DataPacket({
  path,
  label,
  active,
  duration,
  reverse = false,
  tone = "in",
}: {
  path: string;
  label: string;
  active: boolean;
  duration: number;
  reverse?: boolean;
  tone?: "in" | "out" | "ai";
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const node = ref.current;
    if (!node || !active || !path) {
      if (node) node.style.opacity = "0";
      return;
    }

    const svgPath = document.createElementNS("http://www.w3.org/2000/svg", "path");
    svgPath.setAttribute("d", path);
    const length = svgPath.getTotalLength();
    if (!length) return;

    let start = 0;
    let frame = 0;

    const tick = (now: number) => {
      if (!start) start = now;
      const t = Math.min(1, (now - start) / duration);
      const point = svgPath.getPointAtLength((reverse ? 1 - t : t) * length);
      const fade = t < 0.1 ? t / 0.1 : t > 0.9 ? (1 - t) / 0.1 : 1;
      node.style.opacity = String(fade);
      node.style.transform = `translate(${point.x}px, ${point.y}px) translate(-50%, -50%)`;
      if (t < 1) frame = requestAnimationFrame(tick);
    };

    node.style.opacity = "0";
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [path, active, duration, reverse]);

  if (!active || !path) return null;

  return (
    <div ref={ref} className={`flow-packet is-${tone}`} aria-hidden>
      {label}
    </div>
  );
}
