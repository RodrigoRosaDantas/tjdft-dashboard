# TJDFT Dashboard PRO

Painel público para organizar a preparação pré-edital do TJDFT, mantendo trilhas próprias para Técnico e Analista e uma camada de diagnóstico alimentada por registros operacionais.

## Escopo atual

- **Português Primeiro + RLM Preventivo:** sequência canônica de 37 posições, incluindo P01–P18, RL01–RL13 e REV01–REV06.
- **Leis Primeiro:** 26 registros legislativos; 23 normas na fila ativa, uma norma de apoio e duas entradas históricas fora da fila. L22 e L24 permanecem históricas; L23 permanece como apoio.
- **Cargos de referência:** Técnico Judiciário — Área Administrativa — sem especialidade; Analista Judiciário — Apoio Especializado — Administração.
- **Referência editalícia:** pré-edital. O Edital nº 01/2022 é base histórica, não edital vigente; alterações legais e um edital futuro publicado prevalecem sem apagar o histórico.
- O antigo ciclo CTJ-002/D01–D14 permanece acessível em **Painel detalhado** e não substitui a sequência 1–37.

## Fonte de dados

**Notion é a fonte operacional canônica.** Os workflows leem os registros autorizados e publicam snapshots sanitizados no GitHub. O Study OS importa esses snapshots na compilação do GitHub Pages e calcula progresso, ação seguinte, evidência, tendência, riscos e cobertura. O site não grava alterações no Notion.

Notion → sincronização validada → snapshots públicos no GitHub → inteligência TJDFT → GitHub Pages

O Supabase permanece como camada técnica auxiliar do painel detalhado: a Edge Function pode consultar o Notion e manter cache/persistência técnica; o snapshot do GitHub é a contingência. Essa leitura ao vivo não substitui o Notion como fonte definida pelo projeto nem muda a base estática do Study OS.

## Rotas principais

- / e /hoje/: ação operacional e execução diária.
- /mentor/, /desempenho/, /riscos/, /erros/, /revisoes/ e /agenda/: diagnóstico e continuidade.
- /trilha/, /portugues-rlm/ e /leis/: sequência pedagógica e biblioteca de estudo.
- /tecnico/ e /analista/: cobertura separada por cargo.
- /qualidade-dados/ e /sincronizacao/: integridade, origem e estado dos dados.
- /painel-legado/: interface detalhada do ciclo histórico.

## Sincronização, validação e publicação

O workflow **Sincronizar snapshot TJDFT** roda a cada 15 minutos e também pode ser acionado manualmente. Ele consulta o Notion, sanitiza os dados, valida a sequência e a integridade antes de publicar apenas quando há mudança. Uma falha parcial agora permanece identificada no snapshot; componentes reaproveitados não são apresentados como dados integralmente atualizados.

O GitHub Pages publica o site. Quality executa lint, type-check, auditoria de dependências, verificações Deno, validação dos snapshots e testes. Visual QA percorre rotas estratégicas em seis resoluções; E2E percorre os fluxos de estudo e legislação; smoke valida a publicação.

## Desenvolvimento

~~~bash
npm ci
npm run dev
npm run lint
npm run typecheck
npm test
npm run qa:visual
npm run qa:e2e
~~~

O build estático para GitHub Pages usa GITHUB_PAGES=1 e GITHUB_PAGES_BASE_PATH=/tjdft-dashboard.
