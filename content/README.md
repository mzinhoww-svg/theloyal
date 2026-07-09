# Conteúdo editorial — The Loyalty

Pipeline de validação, renderização e publicação das edições do Daily.
Segue a estrutura e os checklists do Operating Manual v1. **Sem dependências**
(scripts ESM Node puros).

## Pauta (intake de noticias)

Etapa **anterior** ao JSON da edicao: capta candidatos das fontes publicas para
uma pessoa selecionar e apurar.

```bash
npm run pauta                 # le content/sources.json e gera content/pauta/AAAA-MM-DD.{md,json}
npm run pauta -- --days 3     # janela de dias (default: lookbackDays do sources.json)
npm run pauta -- --date 2026-07-09
```

O catalogo de fontes (`content/sources.json`) segue os niveis de prioridade oficiais:
**P0** fonte oficial (prevalece; e onde se APURA), **P1** blog especializado (descoberta),
**P2** comunidade (rumor/tendencia). O script coleta dos feeds RSS habilitados (P1 blogs,
P2 e o RSS do Banco Central); as paginas P0 sem feed entram no apendice de apuracao.

1. Configure `content/sources.json`: cada fonte tem `tier`, `category`, `url`, `feed` (RSS)
   e `enabled`. O script coleta dos que tem `feed` + `enabled:true`; tolera feeds inacessiveis.
2. `npm run pauta` coleta itens recentes (titulo, link, data, fonte), remove duplicados
   (inclusive contra a pauta anterior) e escreve:
   - `content/pauta/AAAA-MM-DD.md` — **checklist** por secao: `[ ]` para marcar o que entra,
     com os campos da regra 5 por item (Secao, Vigencia, Nivel de confianca, Fonte apurada P0,
     Nota propria) e a data/hora da consulta; itens P1/P2 vem com aviso da regra 6.
   - `content/pauta/AAAA-MM-DD.json` — espelho estruturado.
   - Apendice **Fontes oficiais (P0) para apuracao** com os links oficiais por categoria.
3. Uma pessoa edita o `.md`: marca `[x]`, confirma a secao e **apura em fonte oficial P0**
   (regra 6: item P1/P2 nao vira "Vale Agir" sem confirmacao oficial).
4. Com a pauta apurada, monte `content/editions/NNNN.json` e siga o fluxo abaixo.

A pauta capta apenas **link + manchete da fonte como referencia** (marcada "nao copiar"):
o texto publicado e sempre proprio (regra de marca 2). Ver `content/pauta/EXEMPLO.md`.

## Fluxo

```bash
npm run validate    # QA editorial de cada edição → out/qa/NNNN.md (bloqueia em erro)
npm run render      # gera out/email/NNNN.html e out/plain/NNNN.txt
npm run qa          # QA global: landing + JSON + e-mail gerado (rode após o render)
npm run publish     # valida + escreve content/latest.json e content/index.json
npm run edition     # validate → render → publish
npm run beehiiv     # publica no Beehiiv o conteúdo já renderizado (draft por padrão)
npm run pro         # valida e renderiza o relatório The Loyalty Pro
```

> Fluxo único e oficial. O antigo protótipo em `renderer/` e os scripts `*-daily.mjs`
> foram removidos por duplicidade; não use mais esses caminhos.

O `publish` **não envia e-mail** — apenas escreve os índices locais. O envio ao
Beehiiv é o passo `beehiiv`, e por padrão cria só um **rascunho**.

### Publisher Beehiiv (`npm run beehiiv`)

Publica a peça **já renderizada** (`out/email/NNNN.html`) sem reescrever nada.
Roda o QA gate antes; é idempotente (o mesmo conteúdo nunca dispara duas vezes);
registra tudo em `content/beehiiv-status.json` e em `out/beehiiv/NNNN.*`.

```bash
npm run beehiiv                                   # última edição, rascunho
npm run beehiiv content/editions/0028.json        # edição específica
npm run beehiiv -- --schedule 2026-07-09T08:00:00-03:00   # agenda o envio
npm run beehiiv -- --publish                      # confirma e envia agora
npm run beehiiv -- --test voce@exemplo.com        # registra pedido de teste
npm run beehiiv -- --force                        # re-dispara conscientemente
```

Sem `BEEHIIV_API_KEY`/`BEEHIIV_PUBLICATION_ID` (ou com `--dry-run`) roda em
**modo mock**: valida e grava o payload em `out/beehiiv/NNNN.request.json` sem
tocar na API. Endpoint real: `POST /v2/publications/{pub_id}/posts` (escopo
`posts:write`, beta/Enterprise). Campos do post derivados da edição:
`subject → title` + `email_settings.subject_line`, `preheader →
email_settings.preview_text`, `slug → web_settings.slug` (default
`daily-NNNN`), `tags → content_tags`, `scheduledAt → scheduled_at`.

## Modelo da edição (`content/editions/NNNN.json`)

| Campo | Obrigatório | Nota |
|---|---|---|
| `number`, `date`, `weekday`, `publishTime`, `readingMinutes` | sim | cabeçalho |
| `subject`, `preheader` | não | assunto/preheader do e-mail |
| `slug`, `tags`, `productType`, `scheduledAt` | não | metadados do post no Beehiiv (Publisher) |
| `signal` | sim | O sinal do dia |
| `deals[]` | sim | Deal Desk (ver abaixo) |
| `fechaLogo[]` | não | itens que vencem em ≤72h |
| `sources[]` | sim | `{ label, url }` — URL http obrigatória |
| `disclaimer` | sim | frase oficial completa |
| `illustrative` | não | marca a edição como exemplo |

### Deal
`category`, `title`, `context`, `conta { rows: [chave, valor][], result: [chave, valor] }`,
`verdict`, `verdictNote`, `source`, `sourceUrl`, `vigencia` (ISO), `tlScore`,
`scoreBreakdown?` (os 8 critérios do Operating Manual 5.2).

## Regras que o validador aplica (gate de publicação)

- Disclaimer oficial presente e íntegro.
- Zero emoji; zero urgência artificial (imperdível/corra/última chance…).
- Cada deal com **fonte**; Conta Block com resultado.
- **Sem vigência confirmada → veredito obrigatoriamente `nao-confirmado`** (overrule 5.4).
- TL Score coerente com a faixa do veredito (85–100 Vale agir … 0–39 Evitaria).
- Se houver `scoreBreakdown`, a soma ponderada fecha com o `tlScore`.
- Toda fonte com URL válida.
