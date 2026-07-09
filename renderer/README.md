# Sistema de renderizacao — The Loyal Daily

Recebe um JSON editorial e gera e-mail, plain text e web archive, com validacao.

## Estrutura

```
renderer/
  tokens.mjs          tokens oficiais + taxonomia de veredito
  validate.mjs        validacao (estrutura, vigencia, links, disclaimer, campos/blocos, integridade)
  email.mjs           e-mail 600px, uma coluna, CSS inline, fallback seguro
  plaintext.mjs       fallback texto puro
  qa.mjs              relatorio de QA (markdown)
  edition.schema.json JSON Schema draft-07
  examples/
    edition.example.json       entrada de exemplo (No 41)
    expected/                   saida de exemplo (email, plaintext, qa)
scripts/
  render-daily.mjs    CLI: valida e gera os arquivos
  validate-daily.mjs  CLI: so valida
components/daily/
  DailyEdition.tsx    web archive em componentes React (tokens Tailwind + fontes do app)
app/daily/preview/
  page.tsx            renderiza a edicao de exemplo (web archive)
```

## Uso

```bash
# validar
node scripts/validate-daily.mjs renderer/examples/edition.example.json --now 2026-07-08

# renderar (email + plaintext + qa-report)
node scripts/render-daily.mjs renderer/examples/edition.example.json out --now 2026-07-08

# web archive
npm run dev   # abrir /daily/preview
```

Sem dependencias externas: os scripts rodam no Node puro; o web usa o proprio Next/Tailwind do projeto.

`--now ISO` define a data de referencia para checar vigencia. `--lenient` trunca listas acima do limite em vez de abortar.

## Contrato (resumo)

Campos obrigatorios: `sinal_do_dia`, `deal_desk` (1..3), `conta_feita` (com `linhas`/`total`), `fecha_logo`, `o_que_evitaria`, `disclaimer`, `footer.links.unsubscribe_url`.

Veredito: `vale-agir`, `vale-olhar` (verde) · `depende`, `esperaria` (amarelo) · `nao-vale`, `evitaria` (vermelho) · `nao-confirmado` (cinza). O rotulo sempre aparece no chip.

Setas: escreva ` -> ` no JSON. Detalhes de cada campo em `edition.schema.json`.

## O que o sistema garante
- E-mail sem `:root`, sem Google Fonts, sem JavaScript, com fallback web-safe.
- Web com Fraunces / Inter / JetBrains Mono e tokens oficiais.
- Sem emoji, sem CMI/dado interno, mascote Ponto fora de blocos analiticos.
- So texto e SVG proprio: nunca stock photo nem aviao.
