# The Loyal - Landing Page v1

Landing de conversão para o The Loyal Daily. Mídia editorial independente sobre loyalty,
pontos, milhas, cartões, bancos, varejo e cashback.

Stack: **Next.js 14 App Router · TypeScript strict · Tailwind**. Sem outras dependências
(sem framer-motion, shadcn, lucide, styled-components). Identidade conforme
THE-LOYALTY-LLM-SYSTEM.md > DESIGN.md > PONTO-MASCOTE-GUIA.md > TL-GRAPHICS.md.

## Rodar

```bash
npm install
npm run dev        # http://localhost:3000
npm run build      # build de produção
npm run start
npm run lint       # ESLint (next/core-web-vitals)
npm run typecheck  # tsc --noEmit
```

Pipeline editorial (validate → render → qa → publish → beehiiv): ver
`content/README.md`. Produção e go-live: ver `docs/GO-LIVE.md`.

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
