# Backend TJDFT

O backend do dashboard é um projeto Supabase independente do SEEDF:

- Projeto: `tjdft-dashboard`
- Região: São Paulo (`sa-east-1`)
- Edge Function: `tjdft-notion`
- Tabela: `public.tjdft_dashboard_snapshots`

A função valida a chave pública do projeto, lê o último snapshot válido do banco e, em `?refresh=1`, tenta buscar a versão publicada no GitHub antes de atualizá-la. O token do Notion nunca é enviado ao navegador.

Para habilitar a atualização de metadados do Notion, adicione no Supabase Dashboard, em Edge Functions → Secrets, o segredo `TJDFT_NOTION_TOKEN`. Não coloque esse token no GitHub nem no frontend. A função usa as páginas centrais, de execução, materiais e biblioteca do TJDFT já definidas no código.

O schema aplicado remotamente está versionado em `supabase/migrations/20260910181308_create_tjdft_dashboard_snapshots.sql`.
