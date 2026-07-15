# Reconciliação das Auditorias — Radar Preditivo (Forecast/Predict)

> Reconcilia as duas auditorias do Radar Preditivo e fixa a **evidência canônica**.
> Evidência primária: **`docs/AUDITORIA-FORENSE-PREDICT-FORECAST.md`** (consultas com
> dados reais do Supabase `qjqnqcsdnpvvmyzkavoq`) + `docs/auditoria/` (CSVs, lineage e
> transcrição da edge function). Auditoria secundária reconciliada:
> `docs/AUDITORIA-PREDICT-FORECAST.md`.
>
> **Etapa documental:** nenhum código, banco, migration, campanha, backfill, snapshot ou
> Digest foi alterado. Só `docs/`.

## 1. Métricas canônicas e horário das consultas

Fonte canônica: consultas via MCP `execute_sql` (read-only) em
`qjqnqcsdnpvvmyzkavoq`, **2026-07-15** (auditoria forense). O banco estava **ativo e
mutável** (crons rodando).

| Métrica | Auditoria forense (canônica, 2026-07-15) | Auditoria secundária (`AUDITORIA-PREDICT-FORECAST.md`) |
|---|---|---|
| Campanhas no ledger | **2.543** | 2.438 |
| Transferências | **504–507** (variou entre consultas) | 488 |
| Sem data resolvível | **144** | 140 (29%) |
| `vigencia_inicio` nulo (transf.) | **451/507 (~89%)** | ~90% |
| Séries (Forecast/Predict) | **120** (97 rotas + 23 clusters) | mesmas 120 |
| Elegíveis Forecast (≥2) / Predict (≥3) | **59 / 38** | — |
| Intervalos > 365 d (rotas) | **7** | — |
| Intervalo > 900 d | **1** (`livelo→connectmiles`, 943) | 1 (943) |
| Previsão do 943d (Forecast) | **~Fev/2029** (last 2026-07-12 + 943 d) | ~Fev/2028 |
| `news_raw` | **40.080** (24.765 proc., 1 erro, 16.365 sem campanha) | — |
| Permanentes ativas (`vigencia_fim='na'`) | (não quantificado na forense) | **142** (`status=continua`) |

**Números canônicos = auditoria forense** (consulta datada e reproduzível, §24 da
forense). Onde a secundária diverge, é variação do banco vivo (parte 2), **não**
contradição de método.

## 2. Variações causadas pelo banco vivo

O banco recebe inserções por cron ao longo do dia; `created_at` de todas as campanhas
está entre **2026-07-11 e 2026-07-15** (carga em lote). Duas consultas da auditoria
forense, com minutos de diferença, retornaram **504 e 507** transferências. Logo:

- 2.543 vs 2.438 campanhas, 504–507 vs 488 transf., 144 vs 140 sem data → **mesma ordem
  de grandeza, horários de consulta diferentes**. Não há discrepância metodológica.
- A previsão do 943d (Fev/2029 vs Fev/2028) depende da data-âncora `last` e do `now` da
  execução; ambas derivam do **mesmo** intervalo de 943 dias. A divergência de ~1 ano no
  alvo é irrelevante: a previsão é **inválida por construção** (duplicata).
- **Regra de citação:** ao citar números, referencie a auditoria forense e a data
  2026-07-15; trate os números da secundária como um retrato anterior do mesmo banco.

## 3. Causa confirmada do intervalo de 943 dias

```
erro de extração temporal
+ ausência de validação de plausibilidade
+ identidade/deduplicação baseada em ID que incorpora vigencia_fim
+ ausência de bloqueio no Forecast
```

`livelo→connectmiles` foi formado por **dois registros da mesma campanha real de
julho/2026**: um coerente em 2026 e um com `vigencia_fim=2023-12-12` derivado
incorretamente de "hoje (12)". Como `vigencia_fim` participa do `id`, os dois **não
deduplicaram**. O Forecast aceitou o intervalo de 943 dias e projetou uma janela ao
futuro; o Predict bloqueou a série **apenas** por ter menos de 3 amostras (bloqueio por
acaso, não por detectar o erro).

**Correções canônicas de atribuição:**
- **Rota versus cluster NÃO é a causa raiz.**
- **Pooling/fallback para cluster NÃO corrige** dado temporal corrompido.
- **A correção precisa começar antes dos motores.**
- A não-detecção/não-bloqueio do intervalo pelo modelo é **falha secundária**.

## 4. Evidência da duplicidade

Fonte: `docs/auditoria/predict-forecast-lineage.md` (L1) e a edge function
(`docs/auditoria/edge-function-campaigns.md`). Os 2 registros da rota:

| Campo | Registro A | Registro B |
|---|---|---|
| id | `livelo-connectmiles-transferencia-2023-12-12` | `livelo-connectmiles-transferencia-2026-07-12` |
| percentual | 40 | 40 |
| vigencia_fim (→id, →série) | **2023-12-12** | 2026-07-12 |
| first_seen (=`published_at`) | 2026-07-12 | 2026-07-10 |
| origin | auto | daily |
| source_url | `…/ultimo-dia-livelo-oferece-40-de-bonus…connectmiles/` | `…/prorrogado-livelo-oferece-40-de-bonus…connectmiles/` |

Mesma origem, destino, tipo, bônus (40%) e fonte (mesmo blog, artigos "último dia" e
"prorrogado" da mesma promoção). `makeId = origem-destino-tipo-vigencia_fim` (confirmado
no código implantado) → ids diferentes → sem dedup. **Prova de que são a mesma campanha:
identidade comercial idêntica + relação textual "último dia"/"prorrogação".**

## 5. Evidência do erro temporal

- **Agregado:** 369 pares (`window_date`, `first_seen`): média `first_seen − window_date`
  = **+310 dias**; **156** com gap ~1 ano; **283/369 (77%)** com `first_seen` >180 d após
  a data usada; **276 das 364** datas resolvidas caem em 2024 (apesar de `observed_at`
  começar em 2025-12).
- **Casos:** `esfera→connectmiles` com `vigencia_fim` 2024-02-22 / 2024-09-20, enquanto as
  URLs dizem "fev**25**" / "set**25**" e `first_seen` = 2025-02-20 / 2025-09-18 → **erro de
  ano de ~1 ano**.
- **Mecanismo (edge function `campaigns` v13):** o prompt pede `vigencia_fim` e a função
  **não valida** a data; grava o que o LLM (`llama-4-maverick`) devolve, inclusive
  fabricada. `first_seen = news_raw.published_at` (proveniência), mas nenhum código a usa
  para validar, e os motores a **ignoram** de propósito.

## 6. Papel de `first_seen`, `observed_at` e publicação

Confirmado no código: `first_seen = it.published_at || today` (data de publicação da
notícia); `observed_at = today`; `created_at = now()`. **Todas são datas de proveniência.**

- **Datas de evento** (comerciais, podem ancorar a série): `vigencia_inicio`,
  `vigencia_fim`, `data_anuncio`.
- **Datas de proveniência** (nunca ancoram): `data_publicacao`(=`first_seen`),
  `observed_at`, `created_at`.
- Proveniência **valida plausibilidade** (evento << publicação → `suspect_year`) e
  aciona **bloqueio / reprocessamento / revisão** — **nunca substitui** a data do evento
  nem entra na série; **não** transforma campanha antiga em recente sem evidência
  textual.

## 7. Conclusões anteriores corrigidas

| # | Conclusão anterior | Onde | Correção canônica |
|---|---|---|---|
| C-1 | "Usar `first_seen`/data da notícia como data de ocorrência" | `AUDITORIA-FORENSE` §26 | **Corrigida:** `first_seen` é proveniência; valida, não substitui (ADR-010; forense §26 revisado). |
| C-2 | "O 943d existe por fragmentação de rota; o cluster tinha cadência real" | ADR-003, ARQUITETURA §11/§27d.6 | **Refutada:** rota = mesma campanha duplicada; cluster também mal-datado. Rota/cluster não é a causa. |
| C-3 | "Fallback para cluster resolve o 943d" | ARQUITETURA §11 | **Refutada:** pooling não corrige cronologia; resolve-se com ADR-009/010 antes dos motores. |
| C-4 | "O 943d pode ser lacuna de backfill" | ADR-007 | **Corrigida:** é duplicidade por data fabricada, não lacuna. |
| C-5 | "Campos editoriais podem não sobreviver ao upsert (não confirmado)" | `AUDITORIA-FORENSE` §4.9/4.10 | **Confirmado:** sobrevivem (não estão no payload do upsert). |
| C-6 | "Tratar o 943d como outlier (rebaixar confiança)" | ADR-005 | **Reordenada:** outlier é rede secundária sobre série já válida; primeiro bloquear por data/duplicidade. |

## 8. Impacto na arquitetura

- **Nova ordem do pipeline** (ARQUITETURA §27f.4): Fontes → Notícias → Extração →
  **Validação temporal (ADR-010)** → **Identidade/deduplicação (ADR-009)** → Normalização
  → Qualidade → Séries → Modelos → Reconciliação → Aprovação → Snapshot → Distribuição.
- **Regra-mãe:** *nenhum modelo compensa uma cronologia corrompida.*
- **ADRs:** revisados 002, 003, 004, 005, 007, 008; **novos** 009 (identidade/dedup) e
  010 (validação temporal). Todos `proposed`.

**Diagnóstico de normalização (item de arquitetura §9) — classificação canônica.** Não
fazer união automática de aliases ambíguos.

| Valor | Contagem (transf.) | Classificação | Ação |
|---|---|---|---|
| `azul` | 139 | programa canônico | — |
| `azul fidelidade` | 1 | alias confirmado → azul | unir (já ocorre) |
| `azulfidelidade` | 3 | **alias possível** → azul | revisar (sem espaço; hoje NÃO une) |
| `allaccor` | 29 | programa canônico (ALL Accor) | — |
| `all` | 17 | **alias possível** de allaccor **ou** "todos" | **ambíguo — não unir automático** |
| `accor` | 1 | alias possível → allaccor | revisar |
| `interloop` | 13 | programa canônico (Inter Loop) | — |
| `inter-loop` / `loop` | 1 / 2 | alias possível → interloop | revisar |
| `inter` | 10 | **programa distinto** (banco Inter) vs interloop | **não unir** |
| `smiles` / `miles&smiles` | 81 / 1 | programas **distintos** (Gol × Turkish) | manter separados |
| `bb` / `bancodobrasil` | 1 / 1 | alias possível entre si | revisar |
| `desconhecido` | 10 (orig) + 4 (dest) | **placeholder** | excluir da série (série-lixo) |
| `null` (string) | 6 (orig) | **valor inválido** | excluir |
| `cartao` / `cartoes` / `cartoes de credito` | 5/3/1 | **categoria genérica** | excluir (não é programa) |
| `parceiros` / `bancos` / `vantagens` | 4/2/3 | categoria genérica | excluir |
| `passageiro de primeira` (dest) | 1 | **fonte extraída como programa** | inválido — corrigir extração |

**Séries fragmentadas** (mesmo programa em variantes): azul (`azul`/`azulfidelidade`),
Inter Loop (`interloop`/`inter-loop`/`loop`), ALL Accor (`all`/`allaccor`/`accor`).
**Séries-lixo** (não são programa): `desconhecido→*`, `null→*`, `cartao/cartoes→*`,
`parceiros/bancos/vantagens→*`, `*→passageiro de primeira`.

## 9. Nova Fase C0

Substitui a Fase C0 anterior (ARQUITETURA §27c) — detalhe completo em **§27f.5**. Resumo,
tudo **em runtime, sem migration**:

- **C0.1** Baseline e testes (fixture Livelo→ConnectMiles; `windowDate`; id; duplicidade;
  ondas; gate; **paridade TS/MJS**).
- **C0.2** Validação temporal em runtime (flags ADR-010; bloqueia data suspeita; **não
  autocorrige**).
- **C0.3** Duplicidade provável em runtime (bloqueia intervalo; sem merge; sem persistir).
- **C0.4** Dataset completo (remover limite 2.000; paginação; ordenação; bloquear
  publicação se incompleto).
- **C0.5** Gates estatísticos e editoriais (ondas mínimas; data suspeita; duplicidade;
  intervalo extremo; horizonte excessivo; dataset incompleto; forecast stale).
- **C0.6** Distribuição e interface (bloquear `forecast.json` antigo; exibir idade;
  bloquear Daily contraditório; mostrar motivo de exclusão, intervalo anômalo, registros
  suspeitos).

## 10. Backlog reordenado

Detalhe em ARQUITETURA §27f.7.

```
P0 validação temporal e duplicidade
P1 testes, dataset completo e frescor
P2 gates editoriais
P3 novo modelo de identidade, vigência e normalização
P4 motores, reconciliação e snapshots
P5 experiência, outcomes e automação
```

**`data_evento` isolada não é o primeiro item** — antes existem proveniência,
plausibilidade e validação (ADR-010/009).

## 11. Decisões ainda pendentes (exigem o usuário)

1. **Motor canônico** (Predict × Forecast) e papel do Forecast (ADR-008).
2. **Prioridade das datas de evento** e pesos por fonte (ADR-002).
3. **Limiares de plausibilidade** (`suspect_year` 548 d, `event_far_before_source` 365 d,
   k·MAD) (ADR-010).
4. **Pesos/limiar de duplicidade** (`possible`/`probable`) e composição da
   `campaign_identity` (ADR-009).
5. **Gates de amostra** por finalidade (ADR-004).
6. **Uniões de alias ambíguas** (`all`/`allaccor`, `azulfidelidade`, `inter`×`interloop`).
7. **TTL de expiração do snapshot** e modelo snapshot × uso editorial (ADR-006).
8. Reprocessar o ledger para corrigir datas **persistidas** (fase estrutural) — quando e
   como.

## 12. Limitações e pontos não confirmados

- **Banco vivo/mutável:** números são retrato de 2026-07-15; variam por horário.
- **Reprodução por SQL** (não pelo motor TS, sem service key no ambiente): a
  reconstrução replica `windowDate`/`normProgram`/aproximação de `collapseWaves` (o
  colapso ≤3 dias não afeta intervalos > 180 d).
- **Snapshots não guardam IDs/hash** → snapshots antigos não são reproduzíveis a partir
  do input (só a saída preservada).
- **Config do backfill** (janela de descoberta / "18 meses"): **não foi possível
  confirmar com os dados disponíveis** (não versionada de forma legível).
- **Não confirmado:** a existência de uma notícia intermediária específica de
  livelo→connectmiles entre 2023-12 e 2026-07 (irrelevante — as pontas são a mesma
  campanha). Corpo de outras edge functions (ingest/backfill) não auditado nesta etapa.

---

*Documento de reconciliação. Só documentação foi alterada.*
