"use client";

import { useTheme } from "@/app/theme-context";

type IxacsLogoProps = {
  width?: number;
  className?: string;
  alt?: string;
  variant?: "auto" | "dark-text" | "light-text";
};

const NATIVE_WIDTH = 541;
const NATIVE_HEIGHT = 132;
const LIGHT_SRC = "/ixacs_logo-light.png";
const DARK_SRC = "/ixacs-logo.png";

export function IxacsLogo({
  width = 140,
  className = "",
  alt = "iXacs",
  variant = "auto",
}: IxacsLogoProps) {
  const { resolvedTheme } = useTheme();
  const height = Math.max(1, Math.round((width * NATIVE_HEIGHT) / NATIVE_WIDTH));
  const src =
    variant === "dark-text"
      ? LIGHT_SRC
      : variant === "light-text"
        ? DARK_SRC
        : resolvedTheme === "light"
          ? LIGHT_SRC
          : DARK_SRC;

  return (
    // Plain img keeps the wide iXacs mark crisp without next/image square crop.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      width={width}
      height={height}
      className={className}
      decoding="async"
    />
  );
}
