import DashboardClient from "./dashboard-client";

export const dynamic = "force-static";

export default function Page() {
  return (
    <>
      <DashboardClient />
      <a
        className="law-fab"
        href="./leis/"
        aria-label="Abrir trilha Leis Primeiro"
        title="Abrir trilha Leis Primeiro"
      >
        <span aria-hidden="true">⚖️</span>
        <span>Leis Primeiro</span>
      </a>
      <a
        className="law-fab study-fab"
        href="./portugues-rlm/"
        aria-label="Abrir Português Primeiro e RLM Preventivo"
        title="Abrir Português Primeiro e RLM Preventivo"
      >
        <span aria-hidden="true">🧠</span>
        <span>Português + RLM</span>
      </a>
    </>
  );
}
