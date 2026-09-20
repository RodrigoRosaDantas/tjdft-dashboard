# TJDFT Dashboard PRO

Painel público e independente para organizar a preparação pré-edital do TJDFT.

## Escopo atual

- Leis Primeiro — biblioteca legislativa L01–L26, com uma página interna por lei/norma.
- 23 unidades ativas: núcleo comum, Técnico, Analista e normas institucionais.
- L23 permanece como apoio de requisito; L22 e L24 permanecem no arquivo histórico e fora da fila de estudo.
- O legado CTJ-002/D01–D14 é preservado separadamente e não recria a biblioteca legislativa atual.
- Cargos-meta: Técnico Judiciário — Área Administrativa — sem especialidade; Analista Judiciário — Apoio Especializado — Administração.

## Fonte e publicação

O Notion é a fonte operacional: conteúdo, recortes, questões, flashcards, vigência, auditoria e execução. O GitHub mantém o snapshot versionado e publica a camada web pelo GitHub Pages. O Supabase consome o snapshot publicado quando necessário.

O sincronismo usa:

\`\`\`
Notion → GitHub (snapshot legislativo) → GitHub Pages
\`\`\`

A fonte oficial vigente prevalece sobre resumo, questão antiga e material arquivado.

## Desenvolvimento

\`\`\`bash
npm install
npm run dev
\`\`\`

O deploy é feito pelo GitHub Actions para o GitHub Pages.
