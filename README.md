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
npm run build    # build de produção (estático)
npm run start
npm run lint       # ESLint (next/core-web-vitals)
npm run typecheck  # tsc --noEmit
```

### Qualidade

```bash
npm run lint       # next lint (eslint-config-next)
npm run typecheck  # tsc --noEmit (TypeScript strict)
```

### Pipeline editorial (Daily)

Fonte única: `content/editions/NNNN.json` (contrato em `content/edition.schema.json`).

```bash
npm run validate   # QA editorial de cada edição → out/qa/NNNN.md (bloqueia em erro)
npm run render     # e-mail HTML + plain text + web archive + QA + manifest → out/*
npm run qa         # QA global (landing + JSON + e-mail + web); bloqueia regra inviolável
npm run publish    # valida + escreve content/latest.json e content/index.json (NÃO envia)
npm run beehiiv    # publica no Beehiiv o conteúdo já renderizado (rascunho por padrão)
npm run edition    # validate → render → publish
npm run pro        # valida o relatório Pro e gera o resumo de e-mail
```

O CI (`.github/workflows/ci.yml`) roda lint → typecheck → validate → render → qa →
build. O workflow `publish.yml` regenera artefatos e prepara PR/rascunho — **nunca**
dispara envio de e-mail automaticamente.

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

### Radar / coletor de SKUs

O backend do Radar (coletor `scripts/collect/*`, workflow `collect.yml`, migração
`supabase/migrations/0001_retail_vpm.sql`) segue ativo e roda pelo GitHub Actions,
independente da UI. Os endpoints `POST /admin/sku` (aprovar/rejeitar SKU) e
`POST /admin/collect` (disparar rodada) mantêm a Basic Auth própria (`ADMIN_USER`/
`ADMIN_PASSWORD`) e ficam fora do gate de cookie do painel.

## Integração Beehiiv

Já implementada. O formulário faz `POST /api/subscribe` (route handler server-only,
`app/api/subscribe/route.ts`) com honeypot e rate limit. A chave fica só no servidor
(`process.env`), nunca no client. Sem `BEEHIIV_API_KEY`/`BEEHIIV_PUBLICATION_ID` a
inscrição e o Publisher operam em **modo mock** (sucesso/dry-run simulado).

O envio das edições é feito pelo Publisher (`npm run beehiiv`, ver `content/README.md`):
publica a peça já renderizada no Beehiiv, por padrão só como **rascunho**, com QA gate,
idempotência e ledger em `content/beehiiv-status.json`.

## Produção / go-live

Passo a passo de ativação (GitHub Actions, secrets, publicação assistida, checklist
de virada) em **`docs/GO-LIVE.md`**. CI em `.github/workflows/ci.yml`; publicação
manual no Beehiiv em `.github/workflows/beehiiv.yml`.
