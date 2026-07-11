# Conteúdo editorial — The Loyal

Pipeline de validação, renderização e publicação das edições do Daily.
Segue a estrutura e os checklists do Operating Manual v1. **Sem dependências**
(scripts ESM Node puros).

## Fluxo

```bash
npm run validate    # QA de cada edição → out/qa/NNNN.md (bloqueia em erro)
npm run render      # gera out/email/NNNN.html e out/plain/NNNN.txt
npm run publish     # valida + escreve content/latest.json e content/index.json
npm run edition     # validate → render → publish
npm run beehiiv     # publica no Beehiiv o conteúdo já renderizado (draft por padrão)
```

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
