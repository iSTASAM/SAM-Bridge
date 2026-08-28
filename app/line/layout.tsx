import type { Metadata, Viewport } from "next";

export const metadata: Metadata = {
  title: "SAM Bridge · LINE",
  description: "Link your SAM Bridge account with LINE for machine status notifications.",
  applicationName: "SAM Bridge",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0b0b0b" },
  ],
};

export default function LineLayout({ children }: LayoutProps<"/line">) {
  return children;
}
