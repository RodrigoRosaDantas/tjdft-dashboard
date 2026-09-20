import type { Metadata } from "next";
import "./globals.css";

const siteBasePath =
  process.env.GITHUB_PAGES === "1"
    ? process.env.GITHUB_PAGES_BASE_PATH ?? ""
    : "";

export const metadata: Metadata = {
  title: "TJDFT Dashboard PRO",
  description: "Central de comando da preparação pré-edital para Técnico Judiciário — Área Administrativa e Analista Judiciário — Administração.",
  other: {
    "codex-preview": "development",
    "theme-color": "#0b1120",
  },
  icons: {
    icon: `${siteBasePath}/favicon.svg`,
    shortcut: `${siteBasePath}/favicon.svg`,
  },
  manifest: `${siteBasePath}/manifest.webmanifest`,
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <head>
        <link rel="stylesheet" href={`${siteBasePath}/reading-preferences.css`} />
        <script src={`${siteBasePath}/reading-preferences.js`} defer />
      </head>
      <body>
        {children}
        <script src={`${siteBasePath}/sw-register.js`} defer />
      </body>
    </html>
  );
}
