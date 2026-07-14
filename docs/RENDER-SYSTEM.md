# Sistema de renderização — The Loyalty

Uma edição = **um JSON** (`content/editions/NNNN.json`, modelo em
`content/edition.schema.json`). A partir dessa única fonte de verdade, o sistema
gera cinco saídas e bloqueia a publicação se qualquer regra inviolável quebrar.

## Entrada

```
content/editions/NNNN.json   → conforme content/edition.schema.json
```

Exemplos versionados: `content/editions/0027.json`, `0028.json`.

## Saídas

| # | Saída | Arquivo | Como |
|---|---|---|---|
| 1 | E-mail HTML (email-safe) | `out/email/NNNN.html` | `scripts/render.mjs` |
| 2 | Plain text fallback | `out/plain/NNNN.txt` | `scripts/render.mjs` |
| 3 | HTML web archive (React) | `out/web/NNNN.html` | `scripts/render-web.mjs` |
| 4 | Relatório de QA | `out/qa/NNNN.md` | `scripts/render-system.mjs` |
| 5 | Lista de arquivos gerados (manifest) | `out/manifest/NNNN.json` | `scripts/render-system.mjs` |

A rota Next.js `/edicao/[numero]` continua sendo a versão **viva** do site; o
web archive é o **snapshot estático portável** (um único `.html`) do mesmo JSON.

## Comandos

```bash
npm run render:system            # todas as edições → 5 saídas cada + QA + manifest
npm run render:system content/editions/0028.json   # uma edição
npm run render:web               # só o web archive
npm run render                   # só e-mail + plain
npm run edition                  # render:system + publish (latest/index)
```

`render:system` sai com código **1** se alguma edição tiver erro de QA ou falha
de artefato — serve como gate de CI/publicação.

## Contrato das saídas

### E-mail (email-safe)
- Tabela de **coluna única, 600px**, `role="presentation"`.
- **CSS 100% inline** — sem `<style>`, sem `:root`, sem classes.
- Fontes de fallback seguras: Georgia / Arial / Consolas. **Sem Google Fonts.**
- **Zero JavaScript**, zero recurso externo (self-contained), **zero imagem**
  (nada de stock/avião). Preheader oculto. Disclaimer oficial íntegro.

### Web archive (React)
- Renderizado por **componentes React** (`react-dom/server`), um único HTML.
- Fontes da marca no web: **Fraunces, Inter, JetBrains Mono** (Google Fonts é
  permitido na web). Tokens em `:root` (permitido fora do e-mail).
- `html lang="pt-BR"`, `main#conteudo`, **uma única `h1`**, foco visível.
- Sem JavaScript, sem imagem, self-contained (exceto as fontes).

### Plain text
- Cabeçalho, sinal do dia, Deal Desk com a conta alinhada em monoespaço,
  veredito, fontes e disclaimer. Fallback de leitura pura.

## O que o renderer valida (bloqueia em erro)

Editorial (`scripts/validate.mjs`):
- **Estrutura do JSON** — campos e blocos obrigatórios; estrutura de cada deal.
- **Campos obrigatórios** — `number, date, weekday, publishTime, readingMinutes,
  signal, deals, sources, disclaimer`.
- **Blocos obrigatórios** — sinal, Deal Desk, fontes, disclaimer (não-vazios).
- **Vigência** — ausente ⇒ veredito deve ser `nao-confirmado` (overrule 5.4);
  vencida em relação à data da edição ⇒ erro (deal e fecha-logo).
- **Links** — toda URL de fonte http(s) válida; https recomendado (aviso se não).
- **Disclaimer** — frase oficial completa e íntegra.
- **Integridade do conteúdo** — TL Score ↔ veredito coerente, breakdown fecha a
  soma ponderada, Conta Block com linhas e resultado; sem emoji, sem urgência
  artificial, **sem dado interno / CMI**.

Artefatos gerados (`scripts/render-system.mjs`) — reauditados após render:
- E-mail: doctype, 600px, sem `<style>`/`:root`/`<script>`/Google Fonts/`@import`,
  self-contained, sem `<img>`, amarelo nunca como texto, disclaimer íntegro.
- Web: `lang`, `h1` única, landmark, três fontes presentes, sem `<script>`/`<img>`,
  sem emoji/urgência/CMI, disclaimer presente.

## Checklist de QA de saída

Antes de entregar/publicar uma edição, confirme (o `render:system` reprova
automaticamente o que for verificável):

1. [ ] JSON conforme `content/edition.schema.json` (estrutura + campos).
2. [ ] Todos os blocos obrigatórios presentes e não-vazios.
3. [ ] Vigência confirmada em cada deal; nenhuma vencida na data da edição.
4. [ ] TL Score ↔ veredito coerentes; breakdown fecha (quando presente).
5. [ ] Conta Block completo (linhas + resultado).
6. [ ] Links de fonte válidos (https).
7. [ ] Disclaimer oficial íntegro.
8. [ ] Sem emoji, sem urgência artificial, sem dado interno / CMI.
9. [ ] E-mail: 600px, inline, sem `:root`/JS/Google Fonts/recurso externo/imagem.
10. [ ] Web: Fraunces + Inter + JetBrains Mono, `h1` única, landmark, sem imagem.
11. [ ] Sem stock photo, sem avião (nenhum `<img>` nas saídas).
12. [ ] Ponto fora de blocos analíticos (o render não insere mascote no Deal Desk).
13. [ ] `npm run render:system` sai com código 0.
14. [ ] `out/qa/NNNN.md` com status **APROVADA**.
