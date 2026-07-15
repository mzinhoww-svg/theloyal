# Plano de implementação do backlog — The Loyal

**Versão 1.0 · Status: Draft (roadmap de execução)**

> Plano faseado do backlog **restante**, ancorado no diagnóstico
> (`docs/ANALISE-SISTEMA.md`, `docs/AUDITORIA-PREDICT-FORECAST.md`,
> `PROJECT_INTELLIGENCE_REPORT.md`, `docs/BACKLOG-*`, `docs/DECISOES-PRODUTO-RADAR.md`)
> e no que já foi entregue na consolidação Weekly (PRs #75 e #78).
> Serve como **tracker único**: cada item traz origem no diagnóstico, tamanho,
> dependência e critério de aceite.
> Regra-mãe: **"gêmeos" e resíduos baratos primeiro; núcleo pesado depois;
> nada que dependa de decisão humana/migration entra no caminho crítico sem estar
> sinalizado.**

Convenção de tamanho: **P** (≤1 PR contido) · **M** (1 PR maior) · **G** (multi-PR/épico).
Convenção de bloqueio: 🔒 exige **decisão humana** ou **acesso** (Supabase/edge/secret) antes de codar.

---

## 0. Estado atual (o que já saiu — não replanejar)

| Entregue | PR |
|---|---|
| Weekly consolida a Daily por Fio, com lineage, dedup de saída, ranking, Radar rebaixado a "O que vem", export de sinais de acurácia | #75 |
| Regras invioláveis numa fonte única (`assertEditorialRules`); publisher Beehiiv da Weekly sobre núcleo compartilhado; continuidade de Fio entre semanas; sanity-check de data | #78 |

Premissas do diagnóstico: **(5) Weekly consolida a Daily → resolvida.** As demais
(2 TL Score calculado, 3 nota de corte, 4 motor de acurácia, 6 comunicação
honesta) seguem abertas e são o núcleo das Ondas B–C.

---

## 1. Princípios de sequenciamento

1. **Fechar "gêmeos" antes de crescer** — o maior risco estrutural é a divergência
   silenciosa (duas implementações da mesma função). Toda onda prefere *unificar*
   a *duplicar*.
2. **Honestidade de dado destrava produto** — sem freshness/identidade do ledger,
   scoring e acurácia medem lixo. Onda B precede a Onda C.
3. **Decisão humana e migration ficam explícitas** — itens 🔒 não entram no caminho
   crítico; o plano entrega o que é codável hoje e para no ponto de decisão.
4. **Cada PR sai verde e reversível** — mesmo modelo das #75/#78: testes + gates +
   merge, faseado.

---

## 2. Onda A — Resíduos baratos e "gêmeos" restantes

Fecha o tema que estávamos atacando (marca + duplicação). Tudo **P**, baixo risco,
independente entre si.

| ID | O que | Por quê (diagnóstico) | Tam | Aceite |
|---|---|---|---|---|
| **A1** | Corrigir marca **"The Loyalty" → "The Loyal"** nos renderizadores do Daily (`scripts/render-system.mjs`, `scripts/render-web.mjs`) + asserção no QA | ANALISE-SISTEMA §2 gap (a); P1 #8 | P | Nenhuma ocorrência de "The Loyalty" no e-mail/web; teste no `qa.mjs` que falha se voltar |
| **A2** | **Verdict do social derivado da taxonomia** — `lib/social-brand.ts`/`scripts/social-render.mjs` passam a ler `CANONICAL_VERDICTS` (paleta+rótulos), não cópia | DEBT-004/BKL-13; irmão do que #78 unificou | P | Zero rótulo/paleta de veredito hardcoded no social; teste de paridade taxonomia↔social |
| **A3** | **Radar do Daily auto-injetado do forecast** (como o Weekly), com o mesmo gate C0 de frescor (`forecast-freshness.mjs`) | INCONS-9; ANALISE-SISTEMA §2 gap (f) | P | Daily sem `radar` puxa `digest.radarDaily` fresco; stale ⇒ omite (nunca número velho) |
| **A4** | **Teste de paridade** `lib/forecast.ts` × `scripts/forecast-engine.mjs` (falha na 1ª divergência) | CODE-007/DEBT-003; P1 #7 | P | Teste em `tests/` compara as duas saídas sobre fixture; CI bloqueia divergência |
| **A5** | **Unificar coletor VPM na Gen-2** headless; migrar `pro:vpm` para `shopping_*`; marcar Gen-1 como legado | CODE-005/DEBT-002; P1 #5 | M | `pro:vpm` lê a mesma fonte do admin; um catálogo; Gen-1 sem novos consumidores |

> Recomendação: **A1–A4 num ciclo** (todos P, alto retorno simbólico e de
> consistência). A5 logo em seguida.

---

## 3. Onda B — Honestidade de dado (destrava o núcleo)

Sem isto, scoring e acurácia medem dado errado. Alguns itens são 🔒 (edge/Supabase).

| ID | O que | Por quê | Tam | Bloqueio |
|---|---|---|---|---|
| **B1** | **Forecast do ledger completo** — remover `limit=2000`/sem `order`; gerar sobre as 2.438 linhas; expor frescor/contagem no artefato | INCONS-5/8; forecast.json stale (119 vs 2.438) | M | 🔒 acesso Supabase |
| **B2** | **Anti-contradição Daily×Weekly como gate visível** — `validateRadarConsistency` deixa de ser só QA e vira bloqueio de publicação com mensagem ao editor | INCONS/§12; PRODUCT-DESIGN-REVIEW §2 | P | — |
| **B3** | **Validação temporal na origem** — conter o erro de ano (~77%) na edge fn `campaigns`/ingestão, sem autocorreção (marca `suspect_year`) | edge-function-campaigns.md; ADR-RADAR-010; S1/E1-4 | M | 🔒 edge function + migration |
| **B4** | **`checkCalculo` sem falso-verde** — CPM que não casa o regex vira erro, não `ok:null` | CODE-014/BKL-15 | P | — |

---

## 4. Onda C — Núcleo de produto (premissas 2/3/4)

Épico. Multi-PR e **decisões de produto**. Consome os sinais de acurácia que a #75
já exporta e depende da Onda B para medir dado limpo.

| ID | O que | Premissa | Tam | Bloqueio |
|---|---|---|---|---|
| **C1** | **Editorial Score calculado e versionado** — motor que produz o TL Score a partir dos 8 critérios, persistido com versão; o breakdown deixa de ser digitado | 2 | G | 🔒 pesos/curva (decisão), migration (E6-1) |
| **C2** | **Nota de corte de publicação** — bandas de confiança + estados de aprovação editorial persistidos (`draft→review→approved…`) como gate real | 3 | G | 🔒 bandas + TTL (D16/D17); E4-1 |
| **C3** | **Predict v2 nos digests** — publicar o motor forte (hazard+backtest) no radar do Daily/Weekly, aposentando o Forecast como fonte pública | 4 (parcial) | M | 🔒 quando aposentar o Forecast (CONFLICT-009) |
| **C4** | **Motor de acurácia** — `prediction_outcome` (previsto×real) + Brier por horizonte, consumindo `out/weekly-signals/*` já emitido | 4 | G | E5-1/E5-2; depende de C3 + snapshots (Onda D) |

> C é onde o produto "promete o que entrega" (premissa 6): com score calculado,
> corte real e acurácia medida, a comunicação deixa de ir além do sistema.

---

## 5. Onda D — Estrutural (migrations, S1–S7)

Base persistida do Radar/Predict. **Toda a onda é 🔒** (decisões humanas H1–H12 +
ADRs `proposed` + migrations). É pré-requisito do C4 persistido.

- **D1** `campaign_identity` — chave natural sem `vigencia_fim` (ADR-009); cura a fragmentação e o caso 943. **G** 🔒
- **D2** `source_observation` + `campaign_version` (E1-3); `vigencia_type`/`data_evento` (E1-4). **G** 🔒
- **D3** `duplicate_link` persistido + merge/unmerge auditável (E2-1..3, ADR-009). **G** 🔒
- **D4** `prediction_snapshots` — sucede forecast_/predict_; `dataset_hash`/reprodutibilidade (E3-1). **G** 🔒
- **D5** Reconciliador persistido + divergência (E3-2, ADR-008). **M** 🔒
- **D6** "O que mudou" real por diff de snapshots (E4-2). **M** 🔒
- **D7** Estados de aprovação persistidos (E4-1) — compõe C2. **M** 🔒

> Gate para começar D: **ratificar ADRs 009/010 e congelar H1–H12**
> (`docs/PLANO-FASE-ESTRUTURAL-RADAR.md §7`, `docs/MATRIZ-ADRS-FASE-ESTRUTURAL.md`).

---

## 6. Onda E — P0 infra / segurança (paralelizável)

Não bloqueiam as ondas de produto; alguns são **ops, não código**.

- **E1** Confirmar `BEEHIIV_API_KEY`/`PUBLICATION_ID` na Vercel (subscribe + `/edicao`). **P** 🔒 ops
- **E2** Régua de e-mail no Beehiiv (boas-vindas→D3→D7→Pro). **M** 🔒 ops
- **E3** Unificar publicação Beehiiv **CLI × MCP** (uma trilha de escrita do `beehiiv-status.json`; reconhecer `provenance`). **M**
- **E4** **Schema do banco versionado** (migrations em repo; hoje só no banco vivo). **M** 🔒
- **E5** Unificar os dois **troncos git** (default × main) num superconjunto. **M** 🔒
- **E6** Edge functions com `verify_jwt` ligado; remover hardcodes (URL/anon Supabase → env; `GH_COLLECT_REF` → produção). **M** 🔒
- **E7** Login admin: rate-limit + lockout + constant-time + trilha de auditoria em veredito/TL Score. **M**
- **E8** `qa.mjs` audita as superfícies **web** + validação de schema em runtime (`ajv`). **P**

---

## 7. Onda F — Crescimento (P3)

- **F1** Pro pago: preço, gateway, beta da waitlist segmentada. **G** 🔒 decisão
- **F2** Ampliar cobertura do Radar (categorias além de áudio) — fecha as bandas. **M**
- **F3** Aposentar formalmente o pipeline **legado** (`renderer/*`, `daily:*` no `package.json`). **P**
- **F4** Landing: prova social, analytics, sticky CTA mobile, edição real linkada. **M**

---

## 8. Grafo de dependências (resumo)

```
Onda A (baratos)  ── independente ──────────────────────────►
Onda B (dado)  ──► destrava ──► Onda C (núcleo)
Onda D (migrations, 🔒 ADRs) ──► base persistida de C4 e C2
Onda E (infra) ── paralela ──────────────────────────────────►
Onda F (growth) ── depende de C (Pro real) e E1/E2 (receita) ►
```

- **C não começa "de verdade" sem B** (medir dado limpo) e **sem decisão de pesos/corte**.
- **C4 persistido depende de D4** (snapshots).
- **E é paralela** e destrava receita (E1/E2) independentemente.

---

## 9. Riscos e trade-offs

| Risco | Mitigação |
|---|---|
| Começar o núcleo (C) sobre dado sujo | Onda B primeiro; C só mede depois de B1/B3 |
| Migrations (D) sem ADRs ratificados | D fica 🔒 até congelar H1–H12 / ADR-009/010 |
| Publicar Predict v2 e quebrar consistência com o Forecast | C3 atrás de reconciliador (D5) + gate B2 |
| Score calculado mudar vereditos históricos | C1 versionado; recomputar em snapshot, não retroativo silencioso |
| Duplicar de novo ao crescer | Onda A padroniza a regra: unificar > duplicar (já aplicado em #78/beehiiv-core) |

---

## 10. Recomendação de execução

1. **Agora (sem bloqueio):** Onda **A1–A4** num ciclo (P, alto retorno), depois **A5**, **B2**, **B4**, **E8**. Tudo codável hoje, mesmo modelo faseado+merge das #75/#78.
2. **Destravar dado:** **B1**/**B3** assim que houver acesso Supabase/edge (🔒).
3. **Decisão de produto:** antes de **C**, fechar pesos do TL Score, bandas de corte e "quando o Predict aposenta o Forecast". Aí abrir C como épico faseado (um plano próprio por sub-item, como fizemos para a Weekly).
4. **Estrutural (D):** só após ratificar ADRs 009/010 e congelar H1–H12.
5. **Infra (E)** e **growth (F):** em paralelo, conforme prioridade de receita.

> Cada item deste plano pode virar um pedido isolado. Para os itens **G/🔒**,
> o próximo passo é um **design doc** dedicado (como `weekly-daily-consolidation.md`),
> não código direto.
