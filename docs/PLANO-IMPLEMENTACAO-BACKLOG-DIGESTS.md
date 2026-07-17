# Plano de implementação — backlog de curto prazo das digests

> Plano para executar o [`BACKLOG-CURTO-PRAZO-DIGESTS.md`](./BACKLOG-CURTO-PRAZO-DIGESTS.md)
> (cards CP-1..CP-7), ancorado no
> [`DIAGNOSTICO-DIGESTS-DAILY-WEEKLY.md`](./DIAGNOSTICO-DIGESTS-DAILY-WEEKLY.md).
> Define **base de código**, **agrupamento em PRs**, **sequência**, **abordagem
> técnica por card**, **testes**, **critério de pronto** e **riscos**.

---

## Fase 0 — Pré-requisito bloqueante: reconciliar os troncos (RISK-001)

**Achado que muda tudo.** O diagnóstico e o backlog foram construídos sobre o
**tronco local** (lineage do PR #61, "radar P1 / default-name"), que contém
`scripts/forecast-engine.mjs`, `scripts/forecast-freshness.mjs`, `lib/forecast.ts` e
`lib/predict-engine.ts` (motor predict v2 + backtest + gates C0). O **`origin/main`**
(lineage do PR #60, "production-readiness") **não tem** esses arquivos — usa o pipeline
anterior (`scripts/predictions.mjs` / `lib/predictions.ts`), **sem** o gate de frescor
e **sem** o motor predict. Os dois mergearam com ~2s de diferença em branches distintas.

| Arquivo | `origin/main` | Tronco local (#61) |
|---|---|---|
| `scripts/forecast-engine.mjs` | ✗ | ✓ |
| `scripts/forecast-freshness.mjs` (frescor C0) | ✗ | ✓ |
| `lib/forecast.ts` | ✗ (tem `lib/predictions.ts`) | ✓ |
| `lib/predict-engine.ts` (predict v2 + backtest) | ✗ | ✓ |
| gates C0 (amostra≥5, intervalo, horizonte) | ✗ | ✓ |
| `scripts/validate.mjs` (buraco do CP-2, L104) | ✓ (idêntico) | ✓ |

**Consequência para o backlog:** vários cards pressupõem o tronco local. CP-1 (frescor)
e qualquer evolução do predict **não têm base no `main`**. Implementar o backlog no
`main` significaria **reconstruir a camada C0/predict do zero** — desperdício e
regressão de segurança editorial.

**Decisão necessária (do dono):** qual tronco é canônico?

| Opção | O que fazer | Trade-off |
|---|---|---|
| **A (recomendada)** — tronco local vira `main` | Promover a lineage #61 (C0/predict/freshness) a `main`, reconciliando os 27 commits que o `main` tem a mais (production-readiness) | Preserva a camada C0/predict já paga; exige um merge/reconciliação cuidadoso dos 27 commits do `main` |
| **B** — manter `main` (#60) e reaplicar | Recriar C0/predict/freshness sobre o `main` | Joga fora trabalho pronto e testado (89 testes na suíte do tronco); regressão de segurança |
| **C** — reconciliar por cherry-pick seletivo | Escolher, commit a commit, o que de cada tronco entra num `main` unificado | Mais controle, mais esforço; risco de meio-termo inconsistente |

**Recomendação:** **Opção A** — a lineage local é estritamente mais avançada nas
digests (C0, frescor, predict, +54 testes), e o diagnóstico inteiro se apoia nela.
Reconciliar significa trazer os 27 commits de "production-readiness" do `main` por
cima. **Este é o item P0 e deve ser o primeiro PR** — sem ele, CP-1/CP-3/CP-4 não têm
solo firme. (Este plano assume, a partir daqui, que a **base canônica é o tronco local
reconciliado**; onde um card também roda no `main` atual, está anotado.)

> Nota: o PR #71 (só os 2 docs) já foi rebaseado sobre `origin/main` e está mergeável —
> não depende da Fase 0. A Fase 0 é pré-requisito dos **cards de código**, não dos docs.

---

## Agrupamento em PRs e sequência

Sete cards → **cinco PRs de código** + **duas decisões de produto**. Ordenados para
entregar valor cedo e minimizar retrabalho.

| Ordem | PR / decisão | Cards | Esforço | Gate |
|---|---|---|---|---|
| 0 | **Reconciliação de tronco** | Fase 0 | G | decisão do dono + merge |
| 1 | **PR-A: limpeza segura** | CP-5 + CP-6 | P | mecânico |
| 2 | **PR-B: score auditável** | CP-2 | P | — |
| 3 | **PR-C: forecast automático + frescor** | CP-1 | M | precisa Fase 0 |
| 4 | **PR-D: ponte Daily→Weekly** | CP-3 | M | precisa Fase 0 |
| 5 | **PR-E: ranking na Weekly** | CP-4 | M | após CP-3 |
| — | **Decisão D1** (copy) | CP-6 (confirmar) | — | dono |
| — | **Decisão D2** (landing) | CP-7 | P | dono, depois vira PR |

Racional da ordem: mecânicos e sem dependência primeiro (PR-A, PR-B) — dão vitórias
rápidas e não esperam a Fase 0; depois os que dependem do tronco reconciliado (PR-C/D/E).

---

## Abordagem técnica por card

### PR-A · CP-5 (extrair radar) + CP-6 (nome da marca)

Dois refactors mecânicos, cobertos pela auditoria de artefato (`render-system` compara
sha256). Empacotar juntos porque ambos tocam os renders e são de baixo risco.

- **CP-5:** criar `renderRadarBlock(radar)` em `scripts/lib.mjs`; substituir os blocos
  duplicados em `scripts/render.mjs` (~L76–94) e `scripts/render-weekly.mjs` (~L94–110);
  opcional no `scripts/render-web.mjs`. **Meta:** saída byte-idêntica (o manifest sha256
  do `render-system` é a prova).
- **CP-6:** trocar "THE LOYALTY"/"The Loyalty" por "The Loyal" em `scripts/render.mjs`
  (masthead plain-text) e `scripts/render-web.mjs` (título/subject fallback); varrer as
  superfícies de saída. **Gate:** rodar `npm run render:system` e conferir que só o nome
  mudou.
- **Testes:** snapshot de saída antes/depois (o manifest já dá isso); `npm run qa` verde.
- **Depende de:** nada. **Roda também no `main` atual** (ambos os arquivos existem lá).

### PR-B · CP-2 (`scoreBreakdown` obrigatório quando há `tlScore`)

Fecha o buraco de validação: hoje a checagem da soma ponderada só roda
`if (d.scoreBreakdown)` (`scripts/validate.mjs:104`), e o schema torna o campo opcional.

- **Mudança:** em `scripts/validate.mjs`, antes da linha 104, adicionar: se o deal tem
  `verdict !== "nao-confirmado"` e `tlScore` numérico **mas falta `scoreBreakdown`** →
  `err(...)` com mensagem explícita. Manter a checagem de soma existente.
- **Dado:** a edição `content/editions/0027.json` tem `tlScore: 76` **sem** breakdown —
  precisa receber um `scoreBreakdown` coerente (soma ponderada = 76) para não quebrar o
  gate. (0028 já tem.)
- **Schema:** documentar a condicionalidade no `content/edition.schema.json` (JSON
  Schema puro não expressa "obrigatório se outro campo existe" de forma limpa — a regra
  dura fica no validador; opcionalmente usar `if/then` no schema).
- **Testes:** novo caso em `tests/` cobrindo (a) `tlScore` sem breakdown → erro; (b)
  `nao-confirmado` sem score → passa; (c) breakdown que não fecha → erro (já coberto).
- **Depende de:** nada. **Roda também no `main` atual** (validate.mjs idêntico).
- **Efeito estratégico:** torna o score sempre decomposto — **pré-requisito** para, no
  médio prazo, calcular o TL Score por código.

### PR-C · CP-1 (cron do forecast + frescor visível)

**Requer Fase 0** (usa `forecast-freshness.mjs`, que só existe no tronco local).

- **Automação:** novo `.github/workflows/forecast.yml` — `schedule` diário (sugestão:
  antes da janela editorial, ex. 08:00 UTC ≈ 05:00 BRT, folgado antes da coleta de VPM
  das 06h BRT) + `workflow_dispatch`. Roda `npm run forecast`. Sem credenciais Supabase →
  modo offline (o script já preserva o artefato). Commit do `content/forecast.json`
  atualizado (ou escrita no destino lido pelo render).
- **Frescor visível:** no bloco radar (via `renderRadarBlock` do CP-5 — sinergia),
  acrescentar linha discreta "baseado em N campanhas · atualizado há Xh" derivada de
  `generatedAt`/`ledgerRows` do artefato; helper de idade em `scripts/lib.mjs`. Reusar
  `scripts/forecast-freshness.mjs` para classificar (fresh/stale) e **logar o motivo no
  QA** quando cortar o radar.
- **Testes:** unit do helper de idade (com `now` injetável, como o freshness já faz);
  garantir que artefato não-fresco preserva o comportamento atual (cortar radar) — agora
  com motivo logado.
- **Depende de:** Fase 0; sinergia com CP-5 (bloco de radar já centralizado).
- **Escopo consciente:** resolve **frescor**, não **acurácia** (acurácia é o predict, no
  médio prazo).

### PR-D · CP-3 (derivar `movements` da Weekly do ledger)

**Requer Fase 0** (qualidade do dado do ledger; ver dívidas de dedup/idade no
diagnóstico — por isso a saída é *sugestão ao editor*, não publicação automática).

- **Novo `scripts/weekly-movements.mjs`:** dado um período (`dateStart..dateEnd`), lê o
  ledger de campanhas (status `vencida`/`vence-72h`/`continua`) e/ou as edições da
  semana (`content/editions/*.json` com `date` no intervalo) e monta um rascunho:
  `novas` (vigência inicia na semana), `venceram` (vigência termina na semana), `seguem`
  (atravessa a semana).
- **Integração:** `scripts/render-weekly.mjs` já consome `movements` quando presentes —
  sem mudança de contrato; o JSON manual continua tendo precedência (o script só
  **sugere**). Opcional: botão no `/admin` para revisar a sugestão.
- **Testes:** fixture de ledger/edições → `movements` esperados; precedência do JSON
  manual sobre a sugestão.
- **Depende de:** Fase 0. **Primeira ponte real Daily → Weekly.**

### PR-E · CP-4 (ranking de oportunidades vigentes na Weekly)

Entrega parte concreta da promessa da landing ("ranking de oportunidades ainda
vigentes"), reaproveitando o padrão `derivedFrom` que o **Pro já usa**.

- **Schema:** bloco opcional `ranking[]` em `content/weekly.schema.json`, espelhando
  `derivedFrom` do `content/pro-report.schema.json` (`edition`, `deal`, `verdict`,
  `tlScore`).
- **Render:** `scripts/render-weekly.mjs` renderiza o ranking nas 3 saídas quando o
  bloco existe; ausente → retrocompatível.
- **População:** manual no MVP; automática depois via o `weekly-movements.mjs` do CP-3
  (ordenar vigentes por `tlScore` e, quando houver, confiança/acionabilidade).
- **Testes:** render com/sem `ranking`; ordenação por score.
- **Depende de:** CP-3 (para automação) — dá para começar manual.

### Decisão D2 · CP-7 (alinhar landing à realidade)

**Decisão de produto antes de código.** Três opções (não exclusivas): (1) ajustar a
copy ao estado real; (2) revelar o Pro (pronto) e segurar o Lab (inexistente); (3)
assumir a promessa como roadmap e sequenciar (persona → CP-4; Lab → médio prazo).
Depois da escolha, vira um PR pequeno em `components/sections.tsx` (+ `COPY-LANDING.md`),
sob regras de marca (tokens, sem hex, AA) → passa por `npm run qa`.

---

## Critério de pronto (Definition of Done) — todos os PRs

1. `npm run validate` / `npm run qa` / `npm run test` verdes.
2. Job `editorial-gate` do CI verde (validate→render→qa→publish).
3. `npm run typecheck` e `npm run build` verdes.
4. Nenhuma regra inviolável tocada; fronteira mantida (máquina calcula, humano aprova,
   e-mail só por ação humana).
5. Onde muda saída ao leitor (CP-1/CP-4/CP-6), diff de artefato revisado (manifest
   sha256).
6. Card com teste novo cobrindo o comportamento adicionado.

---

## Sequência sugerida e esforço agregado

```
Fase 0  Reconciliação de tronco (RISK-001)         [ G · decisão + merge ]  ← bloqueia C/D/E
  │
  ├── PR-A  CP-5 + CP-6   limpeza segura            [ P ]  (independe da Fase 0)
  ├── PR-B  CP-2          score auditável           [ P ]  (independe da Fase 0)
  │
  ▼ (após Fase 0)
  PR-C  CP-1  forecast automático + frescor         [ M ]
  PR-D  CP-3  movements Daily→Weekly                [ M ]
  PR-E  CP-4  ranking na Weekly                     [ M ]  (após CP-3)

Decisões de produto (paralelas, do dono):
  D1  CP-6 confirmar intenção de "The Loyalty"      [ trivial ]
  D2  CP-7 direção da landing                        [ P depois de decidir ]
```

Esforço de código somado (fora a Fase 0): ~**2 P + 3 M** ≈ 8–11 dias de dev, paralelizável
em PR-A/PR-B enquanto a Fase 0 é decidida.

---

## Riscos e mitigações

| Risco | Mitigação |
|---|---|
| Fase 0 (reconciliação) é grande e arriscada | Fazê-la como PR isolado e revisável; congelar merges nos dois troncos durante a reconciliação; suíte de testes do tronco (89) como rede |
| CP-1 commita `forecast.json` gerado por CI (ruído de diff) | Avaliar escrever o artefato como release/cache em vez de commit; ou commit dedicado por bot com path restrito |
| CP-3 herda dado sujo do ledger (dedup/idade — dívida do diagnóstico) | Saída é **sugestão ao editor**, nunca publicação automática; o humano cura |
| CP-2 quebra edições ilustrativas existentes | Atualizar `0027.json` no mesmo PR; rodar `editorial-gate` local antes |
| CP-6 troca um "The Loyalty" intencional | Decisão D1 confirma antes; varredura só nas superfícies de saída ao leitor |
| Divergência volta a acontecer | Tratar RISK-001 na Fase 0 com política de branch (um só tronco canônico + proteção) |

---

## O que este plano NÃO cobre (médio prazo, fora do curto)

Promover o `predict` (backtestado) a fonte canônica do Radar; corrigir dado a montante
(dedup com URL, filtro de idade, reconciliação forecast×predict); clusters como unidade
editorial; versão executiva/curta; persona; régua híbrida de publicação por risco. Todos
descritos em §14.3 do diagnóstico e **dependem** da correção de dado e da medição de
acurácia antes de expor previsão ao leitor.
