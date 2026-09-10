# Backend TJDFT

O backend do dashboard é um projeto Supabase independente do SEEDF:

- Projeto: `tjdft-dashboard`
- Project ref: `ugxdmvlynyzfmmgshvyq`
- Região: São Paulo (`sa-east-1`)
- Edge Function: `tjdft-notion`
- Tabela: `public.tjdft_dashboard_snapshots`

## Fluxo GitHub → Supabase

O snapshot público versionado em `public/data/tjdft-snapshot.json` é a fonte publicada do conteúdo do dashboard.

1. O frontend tenta chamar a Edge Function do Supabase.
2. Em `?refresh=1`, a função busca primeiro o snapshot publicado no GitHub.
3. O snapshot validado é gravado em `public.tjdft_dashboard_snapshots`.
4. Se o Supabase ou a função estiverem indisponíveis, o frontend usa o mesmo arquivo do GitHub como backup.
5. O conteúdo editorial continua seguindo o fluxo privado Notion → snapshot validado → GitHub. O token do Notion nunca vai para o navegador.

Assim, o GitHub é a origem versionada e o Supabase mantém a cópia de operação/cache e o progresso privado.

## Deploy automático

O workflow `.github/workflows/deploy-supabase.yml` publica a Edge Function no projeto `ugxdmvlynyzfmmgshvyq` quando o código em `supabase/**` muda.

Para ativar o deploy automático no GitHub, crie em **Settings → Secrets and variables → Actions** o secret:

- `SUPABASE_ACCESS_TOKEN`: Personal Access Token da conta Supabase com permissão de Edge Functions no projeto.

Esse token é usado somente pelo GitHub Actions e não deve ser colocado no código, no frontend ou enviado no chat.

A configuração `supabase/config.toml` mantém a verificação JWT da função desativada porque o próprio código valida a chave pública do projeto.

## Notion opcional

O fluxo GitHub → Supabase funciona sem token do Notion. Se for necessário consultar o Notion diretamente em uma operação controlada, configure `TJDFT_NOTION_TOKEN` em **Supabase Dashboard → Edge Functions → Secrets**. Nunca coloque esse segredo no GitHub ou no frontend.

O schema aplicado remotamente está versionado em `supabase/migrations/20260910181308_create_tjdft_dashboard_snapshots.sql`.
