import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "WORK NOTE",
  description: "仕事のメモ・写真・図形・寸法を一つのページで扱えるオフライン対応ノート",
  other: {
    "codex-preview": "development",
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
    apple: "/favicon.svg",
  },
  manifest: "/manifest.webmanifest",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}
