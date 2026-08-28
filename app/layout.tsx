import type { Metadata } from "next";
import { Chakra_Petch, Noto_Sans_JP, Prompt } from "next/font/google";
import { Providers } from "./providers";
import { THEME_BOOTSTRAP_SCRIPT } from "./theme";
import "./globals.css";

const display = Chakra_Petch({
  variable: "--font-chakra",
  subsets: ["latin", "thai"],
  weight: ["500", "600", "700"],
});

const body = Prompt({
  variable: "--font-prompt",
  subsets: ["latin", "thai"],
  weight: ["300", "400", "500", "600"],
});

const japanese = Noto_Sans_JP({
  variable: "--font-jp",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

export const metadata: Metadata = {
  title: "SAM Bridge",
  description: "Connect iXacs production data to the systems you use.",
  applicationName: "SAM Bridge",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="th"
      suppressHydrationWarning
      className={`${display.variable} ${body.variable} ${japanese.variable} h-full antialiased`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOTSTRAP_SCRIPT }} />
      </head>
      <body className="h-full">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
