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
npm run publish     # valida + escreve content/latest.json e content/index.json (NÃO envia)
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

## Integração Beehiiv

A integração é **real**, com fallback mock quando as variáveis não existem.

- **Inscrição:** `POST /api/subscribe` (`app/api/subscribe/route.ts`, server-only)
  chama `POST /v2/publications/{pub_id}/subscriptions`. Mantém honeypot e rate limit
  simples por IP. Sem `BEEHIIV_API_KEY`/`BEEHIIV_PUBLICATION_ID` → modo mock.
- **Publicação da edição:** `npm run beehiiv` (`scripts/beehiiv-publish.mjs`) publica o
  conteúdo já renderizado via `POST /v2/publications/{pub_id}/posts`. Por padrão cria
  apenas **rascunho** (`--draft`); é idempotente (mesmo conteúdo nunca dispara duas
  vezes) e registra tudo no ledger `content/beehiiv-status.json`.

Configure as chaves em `.env` (ver `.env.example`). O `publication_id` aceita
`pub_<uuid>` ou o UUID cru — o prefixo `pub_` é adicionado quando falta. As chaves
ficam só no servidor, nunca no client.
