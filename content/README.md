# Conteúdo editorial — The Loyalty

Pipeline de validação, renderização e publicação das edições do Daily.
Segue a estrutura e os checklists do Operating Manual v1. **Sem dependências**
(scripts ESM Node puros).

## Fluxo

```bash
npm run render:system   # UM JSON → 5 saídas: e-mail, plain, web archive, QA, manifest
npm run validate        # só a validação editorial → out/qa/NNNN.md
npm run render          # só e-mail + plain
npm run render:web      # só o web archive (React) → out/web/NNNN.html
npm run publish         # valida + escreve content/latest.json e content/index.json
npm run edition         # render:system → publish
```

`render:system` é o **sistema de renderização** completo: a partir de um único
JSON gera e-mail (email-safe), plain text, web archive, relatório de QA e o
manifest (lista de arquivos gerados), reauditando os artefatos. Detalhes e o
checklist de QA em [`docs/RENDER-SYSTEM.md`](../docs/RENDER-SYSTEM.md).

O `publish` **não envia e-mail**. O envio pelo Beehiiv é um passo manual, após
revisão do `out/email` e aprovação do PR.

## Modelo da edição (`content/editions/NNNN.json`)

| Campo | Obrigatório | Nota |
|---|---|---|
| `number`, `date`, `weekday`, `publishTime`, `readingMinutes` | sim | cabeçalho |
| `subject`, `preheader` | não | assunto/preheader do e-mail |
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
