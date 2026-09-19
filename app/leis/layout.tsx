import type { Metadata } from "next";
import "./leis.css";
import "./status.css";
import "./study.css";

const siteBasePath = process.env.GITHUB_PAGES === "1"
  ? process.env.GITHUB_PAGES_BASE_PATH ?? ""
  : "";

export const metadata: Metadata = {
  title: "Leis Primeiro | TJDFT",
  description: "Trilha operacional do TJDFT: leitura oficial, questões, flashcards e revisões D0, D7 e D20.",
};

export default function LeisLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <>
      <link rel="stylesheet" href={`${siteBasePath}/leis-enhanced.css`} />
      {children}
    </>
  );
}