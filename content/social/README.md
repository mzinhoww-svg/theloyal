# Conteúdo social — sistema de imagem + roteiros

Biblioteca de conteúdo para X e LinkedIn. Os **textos** (Método, Mito, Ponto,
Perguntas, Enquetes, Ensaios, Recaps, calendário de 30 dias) estão em
[`docs/GTM-CONTENT-30D.md`](../../docs/GTM-CONTENT-30D.md) e a estratégia em
[`docs/GTM-SOCIAL-PLAN.md`](../../docs/GTM-SOCIAL-PLAN.md). Aqui ficam os
**roteiros** e o **sistema de imagem**.

## Arquivos

- [`threads.md`](./threads.md) — roteiros de thread do X, tweet a tweet (hook →
  conta → CTA), com link sempre no primeiro comentário.
- [`carrosseis.md`](./carrosseis.md) — carrosséis do LinkedIn, painel a painel,
  cada painel com a rota de imagem correspondente.

## Sistema de imagem (rotas next/og)

Cards gerados on-the-fly, 100% nos tokens da marca (mesmo padrão do
`app/opengraph-image.tsx`; hex documentados permitidos como em `graphics.tsx`).
Código em `app/social/*` e `lib/social-brand.ts` / `lib/social-parts.tsx`.

| Rota | Para que serve | Params principais |
|---|---|---|
| `/social/quote` | Frase forte (Mito/Método) | `text`, `kicker`, `size=square\|wide` |
| `/social/tlscore` | Nota + veredito + 8 barras | `score`, `verdict`, `title`, `bars=92,90,...` |
| `/social/conta` | Deal Desk "conta feita" (Ink) | `title`, `rows=k:v\|k:v`, `result=k:v` |
| `/social/carrossel` | Painel de carrossel (portrait) | `i`, `n`, `kind=capa\|texto\|veredito\|cta`, `title`, `body` |

`verdict` aceita: `vale-agir`, `vale-olhar`, `casos-especificos`, `esperaria`,
`evitaria`, `nao-confirmado` (mesmo mapa semântico do `TLBadge`).

Exemplos:

```
/social/quote?kicker=Mito+vs.+conta&text=Milha+nunca+desvaloriza.
/social/tlscore?score=88&verdict=vale-agir&title=Transferência+bonificada&bars=92,90,100,80,85,80,75,90
/social/conta?title=Esfera+→+Latam&rows=custo:R$+1.200|pontos:50.000|bônus:100%|milhas:100.000&result=CPM:R$+12/milheiro
/social/carrossel?i=1&n=6&kind=capa&title=Como+decidimos+se+vale
```

## Exportar os PNGs

```bash
npm run build && npm run start        # sobe o app em :3000
BASE=http://localhost:3000 node scripts/social-export.mjs
# PNGs em out/social/
```

Em CI ou sem rodar local, aponte `BASE` para a URL de preview da Vercel.

## Guardrails (valem para toda peça)

Sem emoji, sem urgência artificial, sem promessa de ganho, disclaimer quando há
recomendação, "Não confirmado" sem regra/vigência, deals `illustrative` nunca
publicados como reais, Ponto em 3ª pessoa. No X, link só no primeiro comentário
(alcance primeiro).
