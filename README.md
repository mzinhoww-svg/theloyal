# The Loyal - Landing Page v1

Landing de conversão para o The Loyal Daily. Mídia editorial independente sobre loyalty,
pontos, milhas, cartões, bancos, varejo e cashback.

Stack: **Next.js 14 App Router · TypeScript strict · Tailwind**. Sem outras dependências
(sem framer-motion, shadcn, lucide, styled-components). Identidade conforme
THE-LOYALTY-LLM-SYSTEM.md > DESIGN.md > PONTO-MASCOTE-GUIA.md > TL-GRAPHICS.md.

## Rodar

```bash
npm install
npm run dev      # http://localhost:3000
npm run build    # build de produção
npm run start
```

## Estrutura

```
app/
  layout.tsx        Fontes (Fraunces/Inter/JetBrains Mono), metadata, skip link
  page.tsx          Montagem das seções
  globals.css       Tokens utilitários, foco custom, keyframes do Ponto, reduced motion
components/
  ui.tsx            Reveal, SectionLabel, TLBadge, ContaBlock
  PontoMascot.tsx   Mascote SVG com poses (padrão/lupa), tilt e celebrate
  SubscribeForm.tsx Form mock com honeypot, validação e aria-live
  shell.tsx         Nav sticky, Hero interativo, Footer
  EdicaoMock.tsx    Edição exemplo: Sinal do dia, Deal Desk, Conta Block, TL Score
  graphics.tsx      TL Graphics: data-art, cena do Ponto, sparklines, textura ledger
  sections.tsx      Problema, Método, Recebe, ParaQuem, ComoAnalisamos, CTAFinal
tailwind.config.ts  Tokens da marca (nunca hardcodar hex em componente)
```

## Regras de marca aplicadas

- Fundo de página Paper `#FAF7F0`, nunca branco puro. Cards em Surface `#FFFFFF`.
- Verde de texto `#00A878` (green-600); `#00C48C` (green-500) só em fills e no SVG.
- Amarelo `#F2C94C` só como fill com texto Ink por cima.
- Todo número de análise (CPM, VPM, R$, %, TL Score) em JetBrains Mono.
- Serif (Fraunces) só em títulos; corpo em Inter, mínimo 16px.
- Única exceção ao "sem hex em componente": geometria SVG do mascote e dos gráficos,
  que usa as constantes documentadas.
- Ponto fora do Deal Desk (regra do guia): no mock da edição ele não aparece.
- Sem emoji, stock photo, avião, cartão 3D, gradiente decorativo, countdown ou urgência.

## Acessibilidade (gates)

- Landmarks (`header`/`main`/`nav`/`footer`), uma única `h1`, skip link.
- Foco visível custom, alvos de toque ≥ 44px, contraste AA nos tokens.
- `prefers-reduced-motion` desliga idle do mascote, reveals e smooth scroll.

## Central de Controle (`/admin`)

Painel operacional do motor editorial, servido pelo mesmo app. Lê e opera o Supabase
ao vivo pelas RPCs `admin_*` (não cria tabelas de controle — usa `cron.job` /
`cron.job_run_details` do pg_cron). Segue os tokens da marca, sem shadcn e sem
dependência nova (acesso ao Supabase por `fetch` puro, não `supabase-js`).

Páginas: `/admin` (cockpit: faixa "Atenção agora", stat tiles com sparklines de tendência,
gates da última rodada), `/admin/jobs` (crons: pausar/ativar/rodar com toast de retorno),
`/admin/backfill` (progresso + fila/tracker + reprocessar), `/admin/noticias`
(pipeline ingest→extract: news_raw com status/erro, campanhas extraídas, reprocessar),
`/admin/campanhas` (ledger com filtros, revisão-primeiro e edição inline de veredito/TL Score),
`/admin/logs` (pg_cron + pipeline unificados) e `/admin/observability` (calendário com
marcador de hoje, previsão de janelas, valuations, edições).

O topo tem **cockpit ao vivo**: carimbo "atualizado às HH:MM", auto-refresh (30s, pausável)
e botão manual. As ações mostram o retorno real da RPC num toast.

Toda escrita/RPC acontece em Server Actions/Server Components com a `SERVICE_ROLE_KEY`
(nunca no browser). Acesso protegido por login (`middleware.ts` + `/admin/login`), que
valida a senha contra `ADMIN_TOKEN` e grava um cookie httpOnly (hash SHA-256):

```bash
ADMIN_TOKEN=...           # senha única do painel (login /admin/login)
SUPABASE_URL=...          # default: projeto atual
SUPABASE_SERVICE_ROLE_KEY=...  # server-only; sem ela o painel carrega vazio
```

Sem cookie de sessão válido, `/admin/*` redireciona para `/admin/login`. Sem
`SUPABASE_SERVICE_ROLE_KEY`, as páginas renderizam mas mostram um aviso e dados vazios.

> Nota: o bug dos 20 crons de backfill (URL sem `/functions/v1/`) já está corrigido no
> banco — os comandos em `cron.job` já apontam para `/functions/v1/backfill-daily`.

## Integração Beehiiv (próximo passo)

O formulário é mock. Para conectar:

1. Criar a publicação no Beehiiv e obter o endpoint de subscribe
   (API v2: `POST /publications/{id}/subscriptions`) ou o embed.
2. Em `components/SubscribeForm.tsx`, substituir o bloco marcado "Mock de integração"
   por um `fetch` para uma route handler (`app/api/subscribe/route.ts`) que chama a API do
   Beehiiv com a chave em variável de ambiente (`BEEHIIV_API_KEY`). Nunca expor a chave no client.
3. Manter o honeypot e adicionar rate limit simples na route.
