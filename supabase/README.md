# Supabase auxiliar do TJDFT

O Notion continua sendo a fonte operacional canônica. O Study OS publicado no GitHub Pages consome os snapshots versionados no repositório. Supabase é uma camada técnica auxiliar usada pelo painel detalhado e não substitui o Notion nem se torna a fonte de verdade dos registros.

## Fluxo de dados

Notion → sincronização sanitizada → GitHub snapshots → Study OS no GitHub Pages
                    ↘ Edge Function auxiliar → cache técnico no Supabase

- **Sincronizar snapshot TJDFT** consulta o Notion a cada 15 minutos ou sob acionamento manual, valida os dados e publica snapshots somente quando há alteração.
- O Study OS calcula suas recomendações a partir dos snapshots publicados no GitHub.
- /painel-legado/ pode consultar tjdft-notion?refresh=1. A Edge Function lê o Notion no servidor, usa cache de curta duração e mantém uma cópia técnica em public.tjdft_dashboard_snapshots.
- Se uma consulta parcial reutilizar componentes do snapshot do GitHub, a resposta marca o estado partial e identifica quais componentes não vieram de uma leitura íntegra do Notion.
- Em falha de leitura, o GitHub é contingência. A chave do Notion permanece no servidor; o navegador usa apenas uma chave pública do Supabase para acessar a função somente de leitura.

Nenhuma escrita feita pelo site altera os bancos operacionais do Notion. O token do Notion não é publicado nos snapshots.

## Segredos e deploy

Em **Settings → Secrets and variables → Actions**:

- **TJDFT_NOTION_TOKEN:** token privado do Notion, usado por sync-notion.yml e pela Edge Function.
- **SUPABASE:** Personal Access Token do Supabase lido por deploy-supabase.yml.

O workflow de deploy também precisa do secret TJDFT_NOTION_TOKEN para configurar a função. Não coloque tokens privados no código, nos snapshots ou na interface do navegador. A chave sb_publishable_... do frontend é pública e não deve ser confundida com uma service-role/secret key.

deploy-supabase.yml publica somente a Edge Function tjdft-notion quando há alteração em supabase/** ou sob acionamento manual. O Project ref está configurado no workflow.

## Schema

O schema técnico aplicado remotamente está versionado em:

supabase/migrations/20260910181308_create_tjdft_dashboard_snapshots.sql

A tabela guarda uma cópia auxiliar do snapshot para cache/persistência. Ela não é a fonte operacional canônica.
