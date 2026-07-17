# Lineage — rastreio campanha por campanha (evidência do banco vivo)

Projeto Supabase `qjqnqcsdnpvvmyzkavoq` (the-loyalty), 2026-07-15. Dados reais.

## L1 — O caso dos 943 dias: `livelo→connectmiles`

A série tem **exatamente 2 registros**, que são **a mesma campanha real** (Livelo →
ConnectMiles, 40% de bônus, julho/2026), duplicada por um **erro de data na extração**.

| Campo | Campanha A | Campanha B |
|---|---|---|
| id | `livelo-connectmiles-transferencia-2023-12-12` | `livelo-connectmiles-transferencia-2026-07-12` |
| origem→destino | livelo → connectmiles | livelo → connectmiles |
| percentual | 40 | 40 |
| vigencia_inicio | null | null |
| **vigencia_fim** | **2023-12-12** | **2026-07-12** |
| **window_date (usada pelos motores)** | **2023-12-12** | **2026-07-12** |
| observed_at | 2026-07-13 | 2026-07-12 |
| first_seen | **2026-07-12** | 2026-07-10 |
| created_at | 2026-07-13 | 2026-07-11 |
| origin | auto (backfill/coleta) | daily |
| source_name | passageirodeprimeira | Passageiro de Primeira |
| source_url | `.../ultimo-dia-livelo-oferece-40-de-bonus-nas-transferencias-para-o-connectmiles/` | `.../prorrogado-livelo-oferece-40-de-bonus-nas-transferencias-para-o-connectmiles/` |
| notes | "Livelo oferece 40% de bônus … para o ConnectMiles **até hoje (12)**" | "**Prorrogado**; 40% bonus, paridade 3:1 …" |

**Prova do erro:** a campanha A foi vista (`first_seen`) em **2026-07-12**, a partir de
um artigo cujo título é "*último dia … até hoje (12)*". O extrator interpretou "(12)"
como **2023-12-12** — fabricou o ano (2023) e o mês (12). A campanha B é a mesma oferta
"prorrogada", corretamente datada 2026-07-12.

**Intermediárias?** Não há campanha intermediária real — é a mesma campanha. A "lacuna"
de 943 dias é **artificial**. Nenhuma dedup ocorreu porque o `id` embute `vigencia_fim`
(`…-2023-12-12` ≠ `…-2026-07-12`), e o upsert é por `id`.

**Efeito nos motores:** Forecast (minSamples 2) forma a série, intervalo único = 943 d,
`cadence=esparsa`, `confidence=baixa`, e projeta janela ≈ **fev/2029** (`last`+943 d,
rolada). Predict (minSamples 3) **bloqueia** (`insufficient_history`, 2<3).

## L2 — Erro de ano sistemático: `esfera→connectmiles` (cluster →connectmiles)

| id | percentual | vigencia_fim (→window_date) | first_seen | source_url (contém a data real) |
|---|---|---|---|---|
| `esfera-connectmiles-transferencia-2024-02-22` | 45 | **2024-02-22** | 2025-02-20 | `…esfera-connectmiles-**fev25**.html` |
| `esfera-connectmiles-transferencia-2024-09-20` | 75 | **2024-09-20** | 2025-09-18 | `…esfera-copa-bonus-75-**set25**.html` |

**Prova:** as URLs das fontes dizem **fev25** e **set25** (fevereiro e setembro de
**2025**), e o `first_seen` confirma 2025-02-20 / 2025-09-18. Mas `vigencia_fim` foi
extraída como **2024**-02-22 / **2024**-09-20 — erro de ano de exatamente ~1 ano. Como
`window_date` usa `vigencia_fim` (via id) e **ignora `first_seen`**, o cluster
→connectmiles recebe eventos falsos em 2024.

## L3 — Padrão agregado (todas as transferências)

- 369 pares (`window_date`, `first_seen`): **média(`first_seen` − `window_date`) = 310
  dias**; **156 linhas com gap 300–430 d (~1 ano)**; **283/369 (77%)** com `first_seen`
  mais de 180 dias após a `window_date`.
- Distribuição de `window_date` (364 com data): **276 em 2024**, 53 em 2025, 30 em 2026,
  5 em 2023 — pilha de campanhas 2025 rebaixadas para 2024 pelo erro de ano.

**Conclusão de lineage:** a série temporal dos dois motores é construída sobre
`vigencia_fim` extraída por LLM, que é **sistematicamente ~1 ano anterior** (erro de ano)
à ocorrência real observada (`first_seen`). O motor **descarta de propósito** o campo
mais confiável (`first_seen`), então erros de ano viram intervalos falsos e pilhas em
2024.
