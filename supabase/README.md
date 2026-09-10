# Backend TJDFT

O backend do dashboard é um projeto Supabase independente do SEEDF:

- Projeto: `tjdft-dashboard`
- Project ref: `ugxdmvlynyzfmmgshvyq`
- Região: São Paulo (`sa-east-1`)
- Edge Function: `tjdft-notion`
- Tabela: `public.tjdft_dashboard_snapshots`

## Fluxo oficial

O Notion permanece privado. O conteúdo percorre esta cadeia:

`Notion privado → GitHub snapshot → GitHub Pages → Supabase → frontend`

1. O workflow `.github/workflows/sync-notion.yml` consulta o Notion a cada 30 minutos ou quando executado manualmente.
2. O script valida e grava o resultado em `public/data/tjdft-snapshot.json`.
3. Só há novo commit quando o conteúdo realmente muda.
4. O GitHub Pages publica a versão do repositório.
5. Em `?refresh=1`, a Edge Function busca primeiro o snapshot publicado no GitHub e grava a cópia atual em `public.tjdft_dashboard_snapshots`.
6. O frontend usa o Supabase como API/cache e mantém o arquivo do GitHub como backup.

O token do Notion nunca é enviado ao navegador nem gravado no snapshot.

## Segredos do GitHub Actions

Em **Settings → Secrets and variables → Actions**, os nomes têm funções diferentes:

- `TJDFT_NOTION_TOKEN`: token privado da integração do Notion. É usado pelo workflow `sync-notion.yml`. Você já cadastrou este.
- `SUPABASE_ACCESS_TOKEN`: Personal Access Token do Supabase. É usado pelo workflow `deploy-supabase.yml` para publicar a Edge Function.

O segundo token ainda precisa ser cadastrado para que alterações em `supabase/**` sejam publicadas automaticamente no Supabase. Não coloque nenhum desses valores no código ou no frontend.

A configuração `supabase/config.toml` mantém a verificação JWT da função desativada porque o próprio código valida a chave pública do projeto.

## Schema

O schema aplicado remotamente está versionado em:

`supabase/migrations/20260910181308_create_tjdft_dashboard_snapshots.sql`
