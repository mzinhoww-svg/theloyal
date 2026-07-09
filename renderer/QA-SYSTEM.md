# Sistema de QA — The Loyal Daily

Audita uma edicao (JSON) e o e-mail renderizado, e devolve **aprovado/reprovado**, **bloqueios**, **avisos** e **correcoes sugeridas**.

## Uso

```bash
node scripts/qa-daily.mjs renderer/examples/edition.example.json --now 2026-07-08 --out qa.md
# ou
npm run daily:qa -- renderer/examples/edition.example.json --now 2026-07-08
```

- `--now ISO` data de referencia para a checagem de vigencia.
- `--out arquivo.md` salva o relatorio em markdown.
- Exit code: `0` aprovado, `1` reprovado (bloqueios), `2` uso incorreto.

Aprovado = zero bloqueios. Avisos nao reprovam, mas devem ser revisados.

## Dimensoes verificadas

| Dimensao | Onde | Severidade |
|---|---|---|
| Integridade do JSON | estrutura, tipos, campos e blocos obrigatorios | bloqueio |
| Vigencia | `vigencia`/`vigencia_iso` por deal; expirada vs `--now` | bloqueio |
| Links validos | `footer.links` presentes e com formato de URL/placeholder; unsubscribe obrigatorio | bloqueio/aviso |
| Disclaimer | presenca e tamanho minimo | bloqueio/aviso |
| Ausencia de emoji | varredura em todos os campos (inclui aviao U+2708) | bloqueio |
| Ausencia de CMI / dado interno | marcadores (`cmi`, `uso interno`, `confidencial`, `todo:`...) | bloqueio |
| Ponto em bloco analitico | mascote fora de Deal Desk, contas, vereditos e watches | bloqueio |
| Calculo | recalcula CPM = custo / (milhas/1000) e compara ao total | bloqueio (inconsistente) / aviso (nao verificavel) |
| Fontes | secao Fontes e metodologia presente | aviso |
| E-mail-safe | sem `<script>`, `:root`, `@import`/`<link>`, Google Fonts; 600px | bloqueio/aviso |
| Ausencia de stock photo | sem `<img>` no e-mail (nem stock nem aviao) | bloqueio |
| Tokens de marca | todo hex do e-mail dentro da paleta oficial; sem 'The Loyalty' | aviso |
| Tipografia | so fontes web-safe no e-mail; sem webfont em fallback silencioso | bloqueio (webfont) |
| Contraste | ratios WCAG dos pares usados (min 4.5:1) | aviso |
| Mobile | meta viewport + max-width 600px (uma coluna fluida) | aviso |
| Ausencia de urgencia artificial | lexico de hype (nao marca prazos factuais) | aviso |

O web archive (React) usa os tokens oficiais via Tailwind e as fontes do app, entao tipografia/tokens/contraste dele sao garantidos pelo design system; a auditoria dinamica foca no e-mail e no JSON.

## Saida (exemplo)

```
RESULTADO: REPROVADO
BLOQUEIOS (5)
  [emoji] emoji encontrado em 'sinal_do_dia' (proibido)
  [calculo] CPM inconsistente: informado 9.90, calculado 17.43 ...
  ...
AVISOS (2)
  [contraste] labels/meta pequenos (gray400 sobre Paper): 3.44:1 (< 4.5:1)
  ...
```

## Achado conhecido

O cinza `gray400 #8A8578` sobre Paper rende ~3.44:1 em textos pequenos (labels/meta), abaixo de 4.5:1. O QA marca como aviso; a correcao sugerida e usar `gray500 #555555` nesses rotulos.
