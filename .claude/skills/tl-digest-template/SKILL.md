---
name: tl-digest-template
description: Gera as três saídas de uma edição do The Loyalty Daily — e-mail HTML email-safe, plain text e página web — a partir de UM único JSON conforme content/edition.schema.json. Use ao montar, revisar ou publicar uma edição, ou quando precisar do HTML de e-mail, do texto puro ou da versão web de uma edição.
---

# tl-digest-template

Uma edição = **um JSON**, três renderizações. O modelo é `content/edition.schema.json`;
o exemplo canônico é `content/editions/0027.json`.

## Fonte única de verdade

`content/editions/NNNN.json` (NNNN = número zero-padded). Alimenta:

| Saída | Como | Onde |
|---|---|---|
| **E-mail (HTML email-safe)** | `npm run render` | `out/email/NNNN.html` |
| **Plain text** | `npm run render` | `out/plain/NNNN.txt` |
| **Página web** | `next build` (SSG) | rota `/edicao/[numero]` |

O e-mail usa tabela de coluna única 600px, estilos inline, fallbacks Georgia/Arial/
Consolas e **zero request externo** (`scripts/render.mjs`). A web usa os componentes
canônicos da marca — `SectionLabel`, `ContaBlock`, `TLBadge` — via `components/EditionArticle.tsx`
(nada de hex em componente).

## Passos para publicar uma edição

1. Escreva/atualize `content/editions/NNNN.json` conforme o schema.
2. `npm run validate` — o QA gate precisa passar (0 erros). Corrija o que apontar.
3. `npm run render` — gera e-mail e plain. Confira `out/email/NNNN.html` no preview mobile.
4. `npm run publish` — atualiza `content/latest.json` e `content/index.json`. **Não envia e-mail.**
5. `next build` publica a página web em `/edicao/NNNN` (e o índice em `/edicao`).
6. Envio pelo Beehiiv é **manual**, após revisão e aprovação do PR.

`npm run edition` roda validate → render → publish de uma vez.

## Invariantes de marca (o render já respeita; não quebrar)

- Todo número de análise (CPM, VPM, R$, %, TL Score) em **JetBrains Mono** (web) / Consolas (e-mail).
- **Conta Block** com fundo Ink fixo, resultado em verde. É a assinatura "conta feita".
- **TL Score** com cor semântica correta e vocabulário oficial. `score` obrigatório, exceto `nao-confirmado`.
- Amarelo só como fill com texto Ink. Fundo Paper, cards Surface.
- Disclaimer oficial íntegro no rodapé. Sem emoji, sem urgência artificial.
- Edição de exemplo carrega `"illustrative": true` (mostra "Edição ilustrativa. Números de exemplo.").

## Nunca

- Não gerar HTML de e-mail com `<style>`/classes (clientes de e-mail removem) — usar inline.
- Não inserir o mascote Ponto dentro do Deal Desk.
- Não editar `out/`, `content/latest.json` ou `content/index.json` à mão — são gerados.
