# COWORK CONTRACT PACK v1

> Contrato de saída para o projeto **Claude Cowork** gerar JSONs editoriais do The Loyalty Daily válidos.
>
> **Fonte de verdade deste documento:** o *código* — `content/edition.schema.json` (canônico),
> `scripts/validate.mjs`, `scripts/qa.mjs` e `scripts/lib.mjs`. Onde a documentação
> (`CLAUDE.md`, `content/README.md`) diverge do código, o código vence e a divergência está
> registrada na Seção **G**.
>
> **Escopo:** este contrato descreve o pipeline `content/` (schema `content/edition.schema.json`,
> validado por `scripts/validate.mjs`). Existe um segundo pipeline paralelo (`renderer/` +
> `scripts/*-daily.mjs`) com schema e estrutura completamente diferentes — ver Seção **G.2**.
> **Um JSON escrito para este contrato NÃO passa no pipeline `renderer/`, e vice-versa.**

Nada que não pôde ser confirmado no código está afirmado aqui. Itens não confirmáveis vêm
marcados **"Não confirmado"**.

---

## A. Schema completo, campo a campo

Canônico: `content/edition.schema.json` (`$id: https://theloyalty/edition.schema.json`,
draft 2020-12, `additionalProperties: false` no objeto raiz).

> ⚠️ **Importante:** o arquivo `content/edition.schema.json` **não é carregado por nenhum
> código de runtime** (confirmado: nenhum `import`/`readFile` o referencia). Quem *bloqueia* de
> fato é `scripts/validate.mjs`, que tem suas próprias regras hardcoded. O schema e o validador
> **não são idênticos** — as diferenças estão marcadas com **[schema-only]** (só no schema, não
> checado pelo validador) e **[validate-only]** (checado pelo validador, não expresso no schema).
> Para passar no gate real, obedeça **os dois**.

### A.1 Raiz da edição

`required` (schema): `number`, `date`, `weekday`, `publishTime`, `readingMinutes`, `signal`,
`deals`, `sources`, `disclaimer`.

`REQUIRED` (validate.mjs, linha 10 — mesmo conjunto): idem. O validador falha se qualquer um for
`undefined`, `null` **ou** string vazia `""`.

| Campo | Tipo | Obrig.? | Formato exato | Exemplo válido | Falha o validate se… |
|---|---|---|---|---|---|
| `number` | integer ≥ 1 | **sim** | inteiro positivo | `28` | ausente/null/"" → "Campos obrigatórios ausentes". (Range `minimum:1` é [schema-only].) |
| `date` | string | **sim** | `format: date` → ISO `AAAA-MM-DD` | `"2026-07-08"` | ausente/null/"". Formato ISO é [schema-only] — validate.mjs não checa o formato. |
| `weekday` | string | **sim** | CAPS, ex. `TERÇA-FEIRA` | `"QUARTA-FEIRA"` | ausente/null/"". CAPS não é imposto por código. |
| `publishTime` | string | **sim** | livre, ex. `8H00` | `"8H00"` | ausente/null/"". |
| `readingMinutes` | integer | **sim** | 1–15 | `5` | ausente/null/"". Range `1..15` é [schema-only]. |
| `illustrative` | boolean | não | `true`/`false` | `true` | — (só marca a edição como exemplo; muda o cabeçalho do QA report). |
| `subject` | string | não | livre | `"Bônus casado abre janela"` | — (vira `title` no Beehiiv). |
| `preheader` | string | não | livre | `"A conta fecha para quem já é do clube."` | — (vira `email_settings.preview_text`). |
| `slug` | string | não | **[schema-only]** `^[a-z0-9]+(?:-[a-z0-9]+)*$` | `"daily-0028"` | pattern só no schema. Ausente ⇒ derivado de productType+número. |
| `tags` | string[] | não | array de strings | `["transferencia","livelo"]` | — (vira `content_tags`). |
| `productType` | string | não | **[schema-only]** enum `daily`\|`pro` | `"daily"` | enum só no schema. Default: `daily`. |
| `scheduledAt` | string | não | **[schema-only]** `format: date-time` | `"2026-07-09T08:00:00-03:00"` | — (vira `scheduled_at` no Beehiiv). |
| `signal` | string (minLength 1) | **sim** | texto do "Sinal do dia" | `"Dois programas abriram bônus…"` | ausente/null/"". |
| `deals` | Deal[] | **sim** (chave) | array (ver A.2) | `[ {…} ]` | a **chave** é obrigatória; array **vazio** gera só **aviso** (`warn`), não erro. Ver B. |
| `fechaLogo` | Fecha[] | não | array (ver A.4) | `[ {…} ]` | — |
| `sources` | Source[] | **sim** | `minItems: 1`, ver A.5 | `[ {label,url} ]` | ausente/null/"" → obrigatório; **sem nenhuma fonte** → erro "Nenhuma fonte listada". |
| `disclaimer` | string | **sim** | ver Seção **C** | frase oficial íntegra | ausente **ou** não contém a frase oficial → erro. |

Campos **não** listados acima são rejeitados pelo schema (`additionalProperties: false`)
**[schema-only]** — o validador não checa propriedades extras, mas mantenha o JSON limpo.

### A.2 `deals[]` → objeto **Deal** (`$defs/deal`)

`additionalProperties: false`. `required`: `category`, `title`, `context`, `conta`, `verdict`, `source`.

| Campo | Tipo | Obrig.? | Formato / regra | Exemplo | Falha o validate se… |
|---|---|---|---|---|---|
| `category` | string | **sim** (schema) | livre, ex. `Transferência bonificada · Livelo → Smiles` | `"Transferência bonificada · Esfera → Latam Pass"` | schema exige; validate não checa isoladamente. |
| `title` | string | **sim** (schema) | livre | `"100% de bônus com compra em desconto"` | schema exige. |
| `context` | string | **sim** (schema) | livre | `"Origem em promoção e transferência ativas…"` | schema exige. |
| `conta` | objeto | **sim** | ver A.3 | `{ "rows":[…], "result":[…] }` | **[validate-only]** se faltar `conta.result[1]` → "Conta Block incompleto". |
| `verdict` | string enum | **sim** | um de: `vale-agir`, `vale-olhar`, `casos-especificos`, `esperaria`, `evitaria`, `nao-confirmado` | `"vale-agir"` | valor fora do vocabulário → "veredito … fora do vocabulário oficial". |
| `verdictNote` | string | não | nota curta | `"Vale agir para quem já é do clube."` | — |
| `source` | string | **sim** | fonte + status de vigência (texto) | `"Regulamento oficial · vigência confirmada 08/07"` | ausente/vazio → "sem fonte … não entra no Deal Desk". |
| `sourceUrl` | string | não | **[schema-only]** `format: uri` | `"https://www.latampass.latam.com"` | — |
| `vigencia` | string | **condicional** | **[schema-only]** `format: date-time` (ISO c/ offset) | `"2026-07-10T23:59:00-03:00"` | **[validate-only]** ausente **e** `verdict !== nao-confirmado` → erro "sem vigência confirmada … deve ser nao-confirmado". Ver B.4. |
| `tlScore` | integer 0–100 | **condicional** | inteiro | `88` | **[validate-only]** obrigatório quando `verdict !== nao-confirmado`; ausente/fora de 0–100 → erro. Ver B.5. |
| `scoreBreakdown` | objeto | não | ver A.6 | `{ "valor":92, … }` | **[validate-only]** se presente, a soma ponderada tem de fechar com `tlScore`. Ver B.6. |

### A.3 `conta` (`$defs/conta`) — a "conta feita"

`additionalProperties: false`. `required`: `rows`, `result`.

| Campo | Tipo | Obrig.? | Formato | Exemplo | Falha se… |
|---|---|---|---|---|---|
| `rows` | array de pares | **sim** | `minItems: 1`; cada item é `[string, string]` (exatamente 2 strings) | `[["custo origem","R$ 1.200,00"],["milhas finais","100.000"]]` | schema: `<1` linha ou par ≠ 2 strings. |
| `result` | par | **sim** | `[string, string]` (exatamente 2 strings) | `["CPM final","R$ 12,00 /milheiro"]` | **[validate-only]** falta `result[1]` (o valor) → "Conta Block incompleto". |

> Todo número de análise (R$, %, CPM, TL Score) é renderizado em **JetBrains Mono** — mas isso é
> responsabilidade do render, não valor de dado. O JSON carrega os números como **string** já
> formatada em pt-BR (`R$ 1.200,00`, `100.000`).

### A.4 `fechaLogo[]` → objeto **Fecha** (`$defs/fecha`)

`additionalProperties: false`. `required`: `tag`, `text`. Opcional na edição.

| Campo | Tipo | Obrig.? | Formato | Exemplo |
|---|---|---|---|---|
| `tag` | string | **sim** | ex. `VENCE EM 48H` | `"VENCE EM 72H"` |
| `text` | string | **sim** | descrição | `"Compra de pontos Esfera com 30% de desconto encerra sexta."` |
| `cpm` | string | não | CPM em texto/mono | `"CPM R$ 19,80"` |
| `note` | string | não | ressalva | `"para o público do clube"` |
| `vigencia` | string | não | **[schema-only]** `format: date-time` | `"2026-07-11T23:59:00-03:00"` |

> `validate.mjs` **não** aplica nenhuma regra a `fechaLogo` além do schema. Sem checagem de
> vigência ou de "≤72h" no código.

### A.5 `sources[]` → objeto **Source** (`$defs/source`)

`additionalProperties: false`. `required`: `label`, `url`. Array com `minItems: 1`.

| Campo | Tipo | Obrig.? | Formato | Exemplo | Falha se… |
|---|---|---|---|---|---|
| `label` | string | **sim** (schema) | livre | `"Regulamento oficial Latam Pass"` | **[validate-only]** ausente → só **aviso** (`warn`), não bloqueia. |
| `url` | string | **sim** | **[schema-only]** `format: uri` + `pattern: ^https?://`; **[validate-only]** validado por `^https?:\/\//` | `"https://www.latampass.latam.com"` | não casa `^https?://` → erro "URL inválida ou ausente". |

### A.6 `scoreBreakdown` (`$defs/scoreBreakdown`) — os 8 critérios do TL Score

`additionalProperties: false`. Todas as chaves são **opcionais no schema** (número 0–100 cada), mas
se o objeto existir o validador exige que a soma ponderada feche (B.6). Pesos em `TL_WEIGHTS`
(`scripts/lib.mjs`), soma = 100:

| Critério | Peso |
|---|---|
| `valor` | 25 |
| `regra` | 15 |
| `vigencia` | 15 |
| `friccao` | 10 |
| `aplicabilidade` | 10 |
| `liquidez` | 10 |
| `estoque` | 10 |
| `fontes` | 5 |

Fórmula (validate.mjs): `sum = Σ (breakdown[k] / 100) * peso[k]`; passa se `Math.round(sum) === tlScore`.

---

## B. Regras de QA que bloqueiam a publicação (transcritas do código)

Fonte: `scripts/validate.mjs` (`validateEdition`) — invocado por `scripts/qa.mjs` (`auditEditions`),
por `scripts/publish.mjs` (gate) e por `scripts/beehiiv-publish.mjs`. Uma edição só **passa** se
`errors.length === 0`. **Avisos (`warnings`) não bloqueiam.**

**B.1 — Campos obrigatórios (validate.mjs:20-23).**
`REQUIRED = ["number","date","weekday","publishTime","readingMinutes","signal","deals","sources","disclaimer"]`.
Qualquer um `=== undefined || === null || === ""` → **erro** `Campos obrigatórios ausentes: …`.

**B.2 — Disclaimer íntegro (validate.mjs:26-27) — regra inviolável 10.**
Passa se `typeof ed.disclaimer === "string" && ed.disclaimer.includes(DISCLAIMER)`.
Note: é `.includes()` (substring), não igualdade exata. Texto extra ao redor **não** bloqueia,
mas a frase oficial (Seção C) tem de aparecer **íntegra**. Ausente/alterada → **erro**.

**B.3 — Sem emoji no corpo (validate.mjs:30-33) — regra inviolável 5.**
Varre **todas** as strings da edição (`collectStrings`, recursivo) contra
`EMOJI_RE = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{1F1E6}-\u{1F1FF}️]/u`.
Qualquer emoji/pictográfico → **erro**. Setas (`→`), travessões e reticências são permitidos.

**B.4 — Sem urgência artificial (validate.mjs:36-38) — regra inviolável 4.**
Varre todas as strings contra
`URGENCY_RE = /\b(imperd[ií]vel|corra|corre|garanta j[áa]|[úu]ltima chance|milhas gr[áa]tis)\b/iu`.
Qualquer ocorrência → **erro**. (Termos banidos: *imperdível, corra, corre, garanta já, última chance, milhas grátis*.)

**B.5 — Deal Desk (validate.mjs:41-76).** Para cada deal:
- `!d.source` → **erro** "sem fonte — sem fonte confiável não entra no Deal Desk".
- `!d.conta || !d.conta.result || !d.conta.result[1]` → **erro** "Conta Block incompleto (falta o resultado)".
- `verdict` fora de `VERDICTS` → **erro** "veredito … fora do vocabulário oficial" (e pula o resto desse deal).
- **Overrule 5.4:** `!vigencia && verdict !== "nao-confirmado"` → **erro** "sem vigência confirmada … deve ser nao-confirmado".
- Se `verdict === "nao-confirmado"`: consistente, **não** exige tlScore/vigência; encerra o deal.
- Senão: `tlScore` tem de ser number em 0–100 (senão **erro**) **e** `verdictForScore(tlScore) === verdict` (senão **erro** "TL Score X mapeia para Y, mas o veredito é Z").
- Se houver `scoreBreakdown`: **B.6**.
- `deals` **vazio** → apenas **aviso** "Deal Desk vazio" (não bloqueia).

**Mapa TL Score → veredito** (`verdictForScore` / `VERDICTS` em `lib.mjs`; faixas contíguas cobrindo 0–100):

| Faixa | `verdict` | Label |
|---|---|---|
| 85–100 | `vale-agir` | VALE AGIR |
| 70–84 | `vale-olhar` | VALE OLHAR |
| 55–69 | `casos-especificos` | SÓ PARA CASOS ESPECÍFICOS |
| 40–54 | `esperaria` | ESPERARIA |
| 0–39 | `evitaria` | EVITARIA |
| s/ score | `nao-confirmado` | NÃO CONFIRMADO |

**B.6 — Soma do breakdown fecha (validate.mjs:71-75).**
`sum = Σ (scoreBreakdown[k] ?? 0)/100 * TL_WEIGHTS[k]`; se `Math.round(sum) !== tlScore` → **erro**
"soma ponderada do breakdown (X) ≠ TL Score declarado (Y)".

**B.7 — Fontes com URL (validate.mjs:79-85).**
Sem nenhuma fonte → **erro** "Nenhuma fonte listada". Fonte sem `label` → **aviso**. Fonte cuja
`url` não casa `^https?:\/\//` → **erro** "URL inválida ou ausente".

### B.8 — QA global adicional (`scripts/qa.mjs`)

`scripts/qa.mjs` roda `validateEdition` em **todas** as edições (repropaga os erros acima como
bloqueios) **e** audita superfícies extra que a Cowork geralmente **não** gera, mas que podem
bloquear a publicação da peça inteira:

- **Código-fonte** (`app/`, `components/`): sem hex hardcoded fora de `PontoMascot.tsx`/`graphics.tsx`;
  sem cor default do Tailwind (`bg-white`, `slate`, `indigo`, `emerald`…); disclaimer presente em
  `components/shell.tsx` (footer) e `components/sections.tsx` (metodologia); fundo `bg-paper`.
- **E-mail HTML gerado** (`out/email/*.html`, `out/pro-email/*.html`, só se `npm run render` já rodou):
  sem emoji, sem urgência, sem `color:#F2C94C` como texto, sem `<script>`, sem recurso externo
  (`src=`/`background=`/`url(http…)`), e **precisa conter o disclaimer**. `out/email` ausente → só aviso.

Para o JSON que a Cowork produz, o gate relevante é **B.1–B.7** (o mesmo `validateEdition`).

---

## C. Texto EXATO do disclaimer oficial

Transcrito de `scripts/lib.mjs` (`DISCLAIMER`), idêntico ao `const` em `content/edition.schema.json`:

```
Promoções podem mudar sem aviso. Confira sempre as regras no site oficial antes de comprar, transferir ou resgatar.
```

- O schema exige igualdade exata (`const`). O validador exige que a string **contenha** essa frase
  íntegra (`.includes`). Para satisfazer os dois, use **exatamente** essa string, sem texto extra.
- Acentuação e pontuação são parte da frase. Não abreviar, não reordenar.

---

## D. Template JSON mínimo válido (com placeholders)

Preenchendo todos os `{{…}}` com valores reais **que respeitem B.1–B.7**, este JSON passa no
`validate`. O deal do template é `nao-confirmado` — o caso mínimo, que **não** exige `tlScore` nem
`vigencia`. Para um deal com veredito real, ver Seção E.

```json
{
  "number": {{NUMERO_INTEIRO}},
  "date": "{{AAAA-MM-DD}}",
  "weekday": "{{DIA-DA-SEMANA-EM-CAPS}}",
  "publishTime": "{{8H00}}",
  "readingMinutes": {{1_A_15}},
  "illustrative": true,
  "subject": "{{ASSUNTO_DO_EMAIL}}",
  "preheader": "{{PREHEADER_DO_EMAIL}}",
  "signal": "{{TEXTO_DO_SINAL_DO_DIA}}",
  "deals": [
    {
      "category": "{{CATEGORIA · ORIGEM → DESTINO}}",
      "title": "{{TITULO_DO_DEAL}}",
      "context": "{{CONTEXTO_CURTO}}",
      "conta": {
        "rows": [
          ["{{CHAVE_1}}", "{{VALOR_1}}"],
          ["{{CHAVE_2}}", "{{VALOR_2}}"]
        ],
        "result": ["{{ROTULO_RESULTADO}}", "{{VALOR_RESULTADO}}"]
      },
      "verdict": "nao-confirmado",
      "verdictNote": "{{RESSALVA_OPCIONAL}}",
      "source": "{{FONTE + STATUS DE VIGENCIA}}",
      "sourceUrl": "https://{{DOMINIO_OFICIAL}}"
    }
  ],
  "sources": [
    { "label": "{{ROTULO_DA_FONTE}}", "url": "https://{{DOMINIO_OFICIAL}}" }
  ],
  "disclaimer": "Promoções podem mudar sem aviso. Confira sempre as regras no site oficial antes de comprar, transferir ou resgatar."
}
```

**Absoluto mínimo** para *passar* (APROVADA): os 9 obrigatórios de B.1 + disclaimer íntegro (B.2) +
≥1 fonte com URL http(s) (B.7). `deals: []` é aceito (gera só **aviso** "Deal Desk vazio"). Mas uma
edição editorialmente completa traz ao menos um deal — use o bloco acima.

---

## E. Exemplo de item de Deal Desk completo e correto (estrutura)

Deal com veredito **real** (`vale-agir`), incluindo `vigencia`, `tlScore` coerente com a faixa
(85–100) e `scoreBreakdown` cuja soma ponderada fecha em 88. Estrutura extraída de
`content/editions/0028.json` (conteúdo ilustrativo):

```json
{
  "category": "Transferência bonificada · Esfera → Latam Pass",
  "title": "100% de bônus com compra de origem em desconto",
  "context": "Origem em promoção e transferência bonificada ativas ao mesmo tempo. VPM de resgate em torno de R$ 33/milheiro dá spread positivo para quem já é do clube. Vigência confirmada até sexta.",
  "conta": {
    "rows": [
      ["custo origem", "R$ 1.200,00"],
      ["pontos origem", "50.000"],
      ["bônus", "100%"],
      ["milhas finais", "100.000"]
    ],
    "result": ["CPM final", "R$ 12,00 /milheiro"]
  },
  "tlScore": 88,
  "scoreBreakdown": {
    "valor": 92,
    "regra": 90,
    "vigencia": 100,
    "friccao": 80,
    "aplicabilidade": 85,
    "liquidez": 80,
    "estoque": 75,
    "fontes": 90
  },
  "verdict": "vale-agir",
  "verdictNote": "Vale agir para quem já é do clube e tem emissão planejada.",
  "vigencia": "2026-07-10T23:59:00-03:00",
  "source": "Regulamento oficial · vigência confirmada 08/07, 6h30",
  "sourceUrl": "https://www.latampass.latam.com"
}
```

**Por que passa (checagem por B.5/B.6):**
`source` presente ✓ · `conta.result[1]="R$ 12,00 /milheiro"` presente ✓ · `verdict` no vocabulário ✓ ·
`vigencia` presente → overrule 5.4 satisfeito ✓ · `tlScore=88` ∈ [85,100] → `verdictForScore(88)="vale-agir"`
== verdict ✓ · breakdown: `92·.25 + 90·.15 + 100·.15 + 80·.10 + 85·.10 + 80·.10 + 75·.10 + 90·.05 = 88,5 → round 88 = tlScore` ✓.

**Variante mínima de deal (radar, sem dado confirmado):** ver o segundo deal de `0028.json` —
`verdict: "nao-confirmado"`, **sem** `tlScore`/`vigencia`/`scoreBreakdown`, `conta.result` pode ser
`["CPM final","aguardando confirmação"]`. É o único caminho válido quando falta vigência ou cálculo.

---

## F. Comandos do pipeline, na ordem oficial (confirmados contra o package.json)

> ⚠️ Divergência crítica (ver G.1): os comandos `npm run validate / render / qa / publish /
> edition / beehiiv` **documentados** em `content/README.md` e `CLAUDE.md` **NÃO EXISTEM** no
> `package.json`. Os arquivos existem em `scripts/`, mas **sem aliases npm**. Rode-os direto com `node`.

### F.1 Scripts que EXISTEM de fato no `package.json`

```json
"scripts": {
  "dev": "next dev",
  "build": "next build",
  "start": "next start",
  "lint": "next lint",
  "daily:validate": "node scripts/validate-daily.mjs",
  "daily:render": "node scripts/render-daily.mjs",
  "daily:qa": "node scripts/qa-daily.mjs"
}
```

- Existem `validate`, `render`, `qa`, `publish`, `edition`, `beehiiv` como `npm run`? **Não.** Nenhum.
- Os aliases `daily:*` ainda existem? **Sim** — `daily:validate`, `daily:render`, `daily:qa`.
  **Atenção:** eles apontam para `scripts/*-daily.mjs`, que usam o pipeline **`renderer/`** e o
  schema `renderer/edition.schema.json` (estrutura diferente — ver G.2), **não** o schema deste
  contrato.

### F.2 Pipeline do contrato (`content/` + `content/edition.schema.json`) — invocação real

Como não há aliases npm, a ordem oficial (deduzida de `content/README.md` + do que cada script faz)
roda via `node`. Ordem: **validate → render → qa → publish → beehiiv**.

```bash
node scripts/validate.mjs [content/editions/NNNN.json]   # gate B.1–B.7 → out/qa/NNNN.md (exit 1 em erro)
node scripts/render.mjs   [content/editions/NNNN.json]   # → out/email/NNNN.html + out/plain/NNNN.txt
node scripts/qa.mjs                                      # QA global (rode render antes, p/ auditar e-mail)
node scripts/publish.mjs                                 # valida + escreve content/latest.json e index.json (NÃO envia e-mail)
node scripts/beehiiv-publish.mjs [content/editions/NNNN.json] [--draft|--publish|--schedule <ISO>|--test <email>|--force|--dry-run]
```

- Sem argumento, `validate.mjs`/`render.mjs`/`publish.mjs` processam **todas** as edições de `content/editions/`.
- `publish.mjs` é um **gate**: bloqueia (exit 1) se qualquer edição tiver erro; não dispara e-mail.
- `beehiiv-publish.mjs`: QA gate → payload Create Post; sem `BEEHIIV_API_KEY`/`BEEHIIV_PUBLICATION_ID`
  (ou `--dry-run`) roda em **modo mock**; default cria só **rascunho**; idempotente.
- O composto **`edition`** (validate → render → publish) descrito no `README`: **não existe** como
  script nem como arquivo. Rode os três `node …` em sequência manualmente. → **Não confirmado como comando único.**

### F.3 Pipeline `renderer/` (o que o `npm run daily:*` realmente executa)

Opera sobre o **outro** schema (G.2). Cada script exige o caminho do JSON como argumento:

```bash
npm run daily:validate -- <edition.json> [--now ISO] [--lenient]   # → renderer/validate.mjs
npm run daily:render   -- <edition.json> [outdir] [--now ISO]      # → renderer/email.mjs + plaintext.mjs
npm run daily:qa       -- <edition.json> [--now ISO] [--out qa.md]  # → renderer/audit.mjs
```

**Um JSON escrito para este contrato não é aceito pelo `daily:*`** e vice-versa. Ver G.2.

---

## G. Divergências entre documentação e código (explícitas)

**G.1 — Comandos documentados que não existem no `package.json`.**
`CLAUDE.md` ("Comandos") e `content/README.md` ("Fluxo") descrevem `npm run validate`, `render`,
`qa`, `publish`, `edition`, `beehiiv`. **Nenhum existe** em `package.json` (confirmado: os únicos
scripts editoriais são `daily:validate|render|qa`). Os arquivos `scripts/validate.mjs`,
`render.mjs`, `qa.mjs`, `publish.mjs`, `beehiiv-publish.mjs` existem, mas só rodam via `node …`.
O composto `edition` **não existe nem como arquivo**.

**G.2 — Dois pipelines e dois schemas paralelos e incompatíveis.**
- **Pipeline A — `content/` (deste contrato):** schema `content/edition.schema.json`; validador
  `scripts/validate.mjs`; chaves em inglês camelCase (`number`, `signal`, `deals`, `fechaLogo`,
  `sources`, `disclaimer`). Fixtures: `content/editions/0027.json`, `0028.json`.
- **Pipeline B — `renderer/` (o que o `npm run daily:*` executa):** schema
  `renderer/edition.schema.json`; validador `renderer/validate.mjs` + auditor `renderer/audit.mjs`;
  **estrutura totalmente diferente** — `required: ["sinal_do_dia","deal_desk","conta_feita",
  "o_que_evitaria","fecha_logo"]`, com blocos `meta`, `program_watch`, `bank_cards_watch`,
  `retail_coalition`, `sinais_rapidos`, etc. (chaves em português snake_case).

  Os dois schemas **não são intercambiáveis**. A Cowork deve gerar **Pipeline A** (este contrato).
  Se a saída for consumida pelo `npm run daily:*`, ela falha.

**G.3 — O schema canônico não é aplicado por runtime.**
`content/edition.schema.json` **não é importado/lido por nenhum código** (confirmado por busca). O
gate real é `scripts/validate.mjs`, com regras hardcoded. Consequências práticas:
- `additionalProperties:false`, `format:date`/`date-time`, `pattern` do `slug`, ranges
  (`readingMinutes` 1–15, `number ≥ 1`), enum de `productType` → **[schema-only]**, não bloqueiam no validador.
- Disclaimer: schema exige igualdade (`const`); validador aceita **substring** (`.includes`).
- `vigencia→nao-confirmado` (overrule 5.4), `tlScore↔verdict`, soma do `scoreBreakdown`,
  "Conta Block com resultado" → **[validate-only]**, existem só no validador, não no schema.
- Para máxima segurança, **satisfaça schema E validador simultaneamente**.

**G.4 — Rebrand "The Loyalty" vs "The Loyal".**
`CLAUDE.md` e o título do schema dizem **"The Loyalty"**; `package.json` (`"name":
"the-loyal-landing"`), os cabeçalhos de `scripts/*-daily.mjs` e o comentário de `scripts/qa.mjs`
("redação reescrita no rebrand 'The Loyal'") usam **"The Loyal"**. Nomenclatura inconsistente no
repositório. Sem impacto no gate do JSON, mas relevante para copy/branding.

**G.5 — `content/README.md` descreve `daily:*` como inexistentes e omite os reais.**
O `README` de `content/` lista o Pipeline A como se tivesse aliases npm (não tem) e não menciona os
`daily:*` que existem. A tabela "Modelo da edição" do `README` está correta quanto aos campos do
Pipeline A, mas o "Fluxo" (comandos) está desatualizado — ver G.1.

**G.6 — Regras editoriais do `CLAUDE.md` não checadas pelo código (Pipeline A).**
Regras invioláveis 1 (dado interno/CMI), 2 (anti-cópia), 3 (nunca prometer ganho), 6–8 (cor/imagem)
e 9 ("Não confirmado" por falta de dado) **não têm checagem automatizada** em `scripts/validate.mjs`
para o JSON. O código só automatiza: disclaimer (10), emoji (5), urgência (4), fonte/vigência/
cálculo/TL Score. As demais dependem de revisão humana / das skills `tl-qa` e `tl-source-audit`.
→ A Cowork deve tratá-las como requisito editorial mesmo sem gate automático.

---

### Resumo operacional para a Cowork

1. Gere JSON no formato do **Pipeline A** (Seção A), preenchendo o template da Seção D.
2. Garanta **B.1–B.7**: 9 campos obrigatórios, disclaimer exato (C), zero emoji/urgência, cada deal
   com fonte + `conta.result`, regra da vigência (sem vigência ⇒ `nao-confirmado`), `tlScore` na
   faixa do veredito, breakdown que fecha, fontes com URL `https?://`.
3. Valide com `node scripts/validate.mjs <arquivo.json>` (exit 0 = APROVADA).
4. Não confie no `npm run daily:*` para validar este JSON — é outro schema (G.2).
