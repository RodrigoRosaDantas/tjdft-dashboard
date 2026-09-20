import type { Metadata } from "next";
import "../leis/leis.css";
import "../leis/status.css";
import "../leis/study.css";
import "./portugues-rlm.css";

const siteBasePath = process.env.GITHUB_PAGES === "1"
  ? process.env.GITHUB_PAGES_BASE_PATH ?? ""
  : "";

export const metadata: Metadata = {
  title: "Português Primeiro + RLM Preventivo | TJDFT",
  description: "Trilha de estudo do TJDFT com Português, Raciocínio Lógico-Matemático e revisões integradas.",
};

export default function PortuguesRlmLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <>
      <link rel="stylesheet" href={`${siteBasePath}/leis-enhanced.css`} />
      {children}
    </>
  );
}
