# The Loyal v2 — HANDOFF-CHAT

> **O que é este arquivo.** Documento de transferência de contexto entre chats.
> Um chat novo (contexto zerado) deve conseguir, lendo só este arquivo + os
> ponteiros do §5, retomar o trabalho sem re-descobrir nada. NÃO é spec, NÃO é
> ADR — é o mapa de "onde estamos, o que falta, o que está travado e como se
> trabalha aqui". **Esqueleto vivo:** atualizar ao fim de cada slice.
>
> **Tese-mãe (não negociável):** *determinismo primeiro, LLM depois.* Todo número
> (score, probabilidade, conta, percentil, CPM) sai de SQL/função pura testada.
> A LLM escreve, explica, audita — **nunca calcula**. Quebrou isso, quebrou o v2.
>
> **Última atualização:** 2026-07-17 (v2 — MARCO: pipeline M2 provado ponta a ponta.
> Re-score-1 e re-score-2 (CPM vivo) gravados e verificados. Primeiro item real
> (`livelo→azul`) atravessou a máquina inteira e validou a tese. Deal Desk vivo
> hoje = vazio-honesto por falta de TIER 1. Próxima slice: coleta TIER 1 (3 partes).

---

## 1. Estado atual

**Metodologia:** GSD2 (Milestone > Slice > Task; spec antes de código;
must-haves verificáveis). Trabalho isolado em `v2/`. Branch de trabalho:
`claude/loyal-v2-architecture-nfvoh1`. Repo: `mzinhoww-svg/theloyal`. Base de
integração: `claude/loyalty-landing-page-v1-7vbjq7`.

**Banco:** Supabase, projeto `qjqnqcsdnpvvmyzkavoq` ("the-loyalty"), Postgres 17.
3.621 campanhas na `campaigns`.

### M1 — canonicalização de identidade → **FECHADO** (portão aprovado)
- Identidade canônica = (tipo, origem, destino, publico). Event sourcing em
  `campanha_versoes`. FSM de vigência. Sentinelas `sem_destino`,
  `multiplos_cartoes`. Código puro e testado: `identidade.mjs`, `vigencia.mjs`,
  `matcher-url.mjs`. Migrations 001–008, 010 aplicadas.

### M2 — engine + derivação + CPM → **EM PROGRESSO**
| Peça | Estado | Onde |
|---|---|---|
| Gate de rejeição (slice 1) | ✅ merged | `gate.mjs`, `gate-llm.mjs`, migration 004 |
| Engine `calcularScore` (slice 4) | ✅ merged, 6/6 golden | `lib/score.mjs`, `score_pesos` (migration 006) |
| Camada de derivação (D-032) | ✅ merged, vetor v1 aprovado (D-037) | `lib/derivacao.mjs`, `derivacao_config` (migration 009) |
| Custo-base moeda (011) | ✅ merged + aplicado | `custo_base_moeda`, `PROPOSTA-CUSTO-BASE.md` |
| Extrator de preço (compra_pontos) | ✅ merged | `lib/cpm/extrator-preco.mjs` |
| Tabela de ratios (012 DDL + 013 seed) | ✅ **merged (#102) + aplicado neste turno** | `custo_base_ratio`, `PROPOSTA-RATIOS.md` |
| Helper `cpmDeCustoBase` | ✅ **fix do default aplicado neste turno** | `lib/cpm/custo-base.mjs` |
| Re-score-1 (dry-run, D-038) | ✅ rodado na base suja (draft PR #103) | `M2/rescore/`, `M2/RESCORE-1-DRYRUN.md` |
| Guard de self-loop no matcher | ✅ **permanente (D-041 R4 rev.)** | `identidade.mjs` `resolverCampanha` |
| Recanonicalização dos 13 self-loops | ✅ **gravada + limpa (self-loops→0)** | `SPEC-SLICE-RECANONICALIZACAO.md`, trilha `campanha_versoes` |
| Re-score-1 sobre base sã (grava) | ✅ **gravado + verificado** (B4=102) | `M2/RESCORE-1-BASE-SA.md` |
| Re-score-2 CPM vivo (grava) | ✅ **gravado + verificado** (B4=101; 28 conta R$) | `M2/RESCORE-2-CPM-VIVO.md` |
| Primeiro item real `livelo→azul` | ✅ **TIER 1 manual (D-003); corrigido 115→50, Evitaria** | `M2/CASO-LIVELO-AZUL-DIVERGENCIA.md` |
| Coleta TIER 1 (próxima slice) | 📋 **SPEC escrita, aguarda aprovação** | `M2/SPEC-SLICE-COLETA-TIER1.md` |

### 🏁 MARCO (2026-07-17): pipeline M2 provado ponta a ponta
O primeiro item real atravessou a **máquina inteira** (canonicalização → engine →
CPM → ratio → TIER 1 → vigência → override → veredito). O caso `livelo→azul` é a
**validação da tese**: o blog dizia 115% ("Vale olhar" 76); a fonte oficial (regulamento)
mostrou escala por público (50/100/105/110/120), encerrada 17/04/2025 → o público
geral (50%) vira **"Evitaria" 25**. "Parece bom" → "evite", porque conta+fonte não
sustentam. **Deal Desk vivo hoje = vazio-honesto:** das 54 vivas, 1 com TIER 1. O
gargalo **não é score, é coleta de fonte oficial** → próxima slice (coleta TIER 1).

**O que foi feito neste turno (2026-07-17):**
1. Ratios: `custo_base_ratio` (012 DDL) + seed **8 ratios aprovados** (013) no banco.
2. `cpmDeCustoBase`: `ratio` agora **obrigatório** (sem default 1); omitido/NULL ⇒ `null` (D-039). Trava em teste.
3. **Recanonicalização (slice fechada):** guard de self-loop permanente no matcher
   (`transferencia` com origem_code=destino_code → revisão, seed INTACTO — D-041 R4
   revisado: PagoGol É Smiles, de-aliasar corromperia o mapa). Os 13 self-loops →
   `identidade_id=NULL` (revisão, convenção M1) + trilha; `loop→loop` descartado.
   **Base sã = 3.330 resolvidos** (era 3.343); em revisão 291. Self-loops→0. Suíte 111 verde.

**Ratios populados (`custo_base_ratio`):**
```
alta : livelo→azul_fidelidade 1 · livelo→latam_pass 1 · livelo→connectmiles 0.3333
media: livelo→smiles 1 · esfera→latam_pass 1 · esfera→smiles 1 · esfera→azul_fidelidade 1 · esfera→connectmiles 0.3333
```

### Re-score-1 dry-run na base SUJA (superado pela recanon; referência histórica)
> Este dry-run rodou ANTES da recanonicalização. O balde 4=103 e as anomalias
> abaixo eram sobre a base suja. O re-score-1 sobre a base SÃ (em execução) traz o
> balde 4 recalculado — é ele que vale. Mantido aqui como baseline de comparação.
- **Fidelidade 6/6 golden** com o engine **importado** (zero fork): A=77 B=59
  C=79 D=37 E=44 F=27. 32 testes verdes.
- **Balde 4 (chave) = 103** (base suja): candidatos alto-valor + conta fechável +
  alcançáveis pelos 4 crawlers (Smiles/Livelo/Esfera/TAP). Por programa: smiles
  42, livelo 15, esfera 14, azul_fidelidade 13, latam_pass 10, accor 3, amazon 3,
  outro 2, connectmiles 1. Outros baldes: B1=293, B2=1.445 (beco), B3=1.857,
  publicável-hoje=0 (`campanha_fontes` vazia).
- **Anomalias (D-038):** 13 self-loops de transferência (ex.:
  `livelo-livelo-transferencia`, `loop-loop-transferencia`, ambos bruto 91 —
  canonicalização torta / placeholder); `sem_destino` saturando percentil;
  21 flags por programa (score uniforme avios/disney/airbnb=65; becos totais
  btg/elo/emirates; `sem_destino` dominante mercado_livre 117/137, outro 141/167).
- **Recomendação do runner:** NÃO gravar `tl_score_bruto` ainda — corrigir a
  canonicalização torta primeiro, re-rodar o dry-run, e só então habilitar o 2º
  passo (gravação). **Bate exatamente com o stop-condition do operador.**

---

## 2. Blockers abertos (o que trava o próximo passo)

1. **[OPERADOR] Aprovar a SPEC da coleta TIER 1** (`SPEC-SLICE-COLETA-TIER1.md`).
   Três partes: **A** automática (adapters nas vivas crawleáveis, zero carga) ∥ **B**
   derivação lado-único (resolve D-042, corrige score dos `sem_destino`) → **C** manual
   (fila de curadoria, corte score ≥70, depois de B). 4 decisões abertas no §8 da spec
   (ordem/paralelização, corte, vetor-B como PROPOSTA, escala-por-público na coleta).
2. **[DÍVIDA → vira Parte B] Derivação de lado-único (D-042).** 1.220 `sem_destino`
   pontuam sem rota (score semi-artificial). Vira a **Parte B** da slice de coleta —
   pré-requisito da confirmação manual (não confirmar fonte de score que vai mudar).
3. **[DÍVIDA] `tem_tier1` vem de `campaigns.tier===1`** no runner (default de
   `montarEntradas`) porque `campanha_fontes` estava vazia. A coleta TIER 1 vai
   enchê-la → quando encher, `tem_tier1` deve vir de lá (INV-02).
4. **[DÍVIDA — D-046] Track record** dos históricos de alto valor (arquivo/prova de
   metodologia) → superfície M3, não Deal Desk vivo.

**Já resolvidos neste turno (não são mais blockers):** re-score-1 (B4=102) e re-score-2
(CPM vivo, B4=101, 28 conta R$) gravados+verificados; D-014 encerrado (backup trava
solta, arquivo frio até fecho do M2); primeiro item `livelo→azul` corrigido via TIER 1
manual (115→50, Evitaria, histórica).

---

## 3. Decisões travadas (fonte de verdade: `v2/DECISIONS.md`)

**Não re-litigar.** ADRs **D-001..D-047** em `v2/DECISIONS.md`; invariantes
**INV-01..INV-16** em `v2/REQUIREMENTS.md`. Recentes (D-040..047): recanon = só
self-loops + guard permanente; banda neutra CPM-cego é correta; **D-043** modo de
operação (autonomia dentro de slice aprovada; **dado vence instrução quando
contradiz** — precedente PagoGol=Smiles); **D-044** Deal Desk = TRÊS portões (vivo
+ TIER 1 + computável); **D-045** TIER 1 corrobora os TERMOS (%), não só a página —
blog é candidato; **D-046** track record (dívida M3); **D-047** adapter detecta
campanha pela janela de vigência no regulamento, não pela URL + público-na-tupla
validado. Os que mais pegam no dia a dia:

- **INV-12** — determinismo: número vem de código puro testado; nada de SQL que
  re-implementa e diverge do JS (o dry-run mostrou ~2pt de gap SQL×JS → o runner
  **importa** o `.mjs`, não copia).
- **INV-03 / D-039** — faltou dado defensável → classifica ("Não confirmado" /
  `null`), **nunca chuta**. Em especial: **ratio ausente NUNCA vira 1:1**
  (contrato travado: par ausente OU `ratio IS NULL` ⇒ CPM null).
- **INV-16** — nenhuma data de vigência afirmada sem evidência por componente;
  overprecision bloqueia.
- **D-024 / §2.1** — sub-métrica ausente ⇒ componente **redistribui** peso (não
  vira zero que afunda item legítimo). Conta só é "não calculável" quando não há
  percentil **E** não há eficiência.
- **D-035** — CPM asterisco **tipado**: `nao_calculado_ainda` (transferência de
  moeda comprável esperando ratio / compra não extraída) vs
  `nao_calculavel_por_natureza` (origem de banco, sem mercado de compra).
- **D-037** — vetor de derivação v1: raridade n=1 tetada em **0,85** (não premiar
  ruído). D-038 — **dois** re-scores; runner importa JS testado; dry-run +
  varredura de anomalia obrigatórios antes de gravar.
- **Estrada de dois portões** — TIER 1 **E** valor computável. O engine computa
  `tl_score_bruto` mesmo sem TIER 1 → fila de confirmação ranqueada (é o balde 4).
- **CPM de transferência** = `custo_milheiro(origem) / ((1 + bônus/100) × ratio)`.

---

## 4. Modo de trabalho estabelecido (como se opera aqui)

- **O operador é o portão de toda decisão de produto/métrica.** Cada vetor
  (pesos, derivação, custo-base, ratios) é **PROPOSTA**: o agente para no vetor,
  o operador aprova ANTES de popular/gravar. "PARO no vetor" é a regra.
- **Spec antes de código.** Slice abre com SPEC aprovada; fecha com resumo
  gsd-output-formatter. ADRs mostrados ao operador antes de escrever.
- **Golden discipline.** Todo número tem golden file; recalibrar = nova versão +
  novo golden. Vetores versionados em tabela (`score_pesos`, `derivacao_config`,
  `custo_base_moeda`, `custo_base_ratio`).
- **Dry-run antes de gravar** (D-038): computa em memória, reporta baldes +
  anomalias; só grava após o operador ler. Achou canonicalização torta → para.
- **Paralelização:** trabalho independente vai para **agents em git worktrees
  isolados**, mergeados em série. O runner de re-score e o de ratios rodaram
  assim.
- **Git:** commits em `noreply@anthropic.com`; nunca reescrever história já
  mergeada (merges do GitHub são compartilhados). PRs draft por padrão.
- **Marca:** identidade editorial (Sage, premium, sem urgência artificial) em
  `CLAUDE.md` + docs `THE-LOYALTY-*`. Regras invioláveis lá precedem estética.

---

## 5. Ponteiros de artefato (onde está cada coisa)

```
v2/
  DECISIONS.md            ADRs D-001..D-043 (fonte de verdade das decisões)
  REQUIREMENTS.md         INV-01..INV-16 (invariantes)
  HANDOFF-CHAT.md         este arquivo
  lib/
    identidade.mjs        identidade canônica M1 (tipo/origem/destino/publico)
    vigencia.mjs          FSM de vigência + parser (INV-16, overprecision)
    matcher-url.mjs       URL → campanha (reusa identidade)
    gate.mjs, gate-llm.mjs   gate de rejeição (M2 slice 1)
    score.mjs             engine puro calcularScore(entradas, pesos)
    derivacao.mjs         dado bruto → [0,1] por componente (D-032, vetor v1)
    cpm/
      extrator-preco.mjs  preço de milheiro (compra_pontos)
      custo-base.mjs      cpmDeCustoBase (ratio OBRIGATÓRIO, D-039) + .test.mjs
  db/migrations/          001..013 (013 = seed de ratios aprovado)
  golden/                 AMOSTRA-100-ROTULADA, score.mjs (labeler), METRICAS 9/9
  M2/
    SPEC-SLICE-4-TLSCORE-ENGINE.md
    SPEC-SLICE-RECANONICALIZACAO.md  triagem R1–R5 + guard (D-040/041/042)
    PROPOSTA-VETOR-DERIVACAO.md   6 golden (A..F)
    PROPOSTA-CUSTO-BASE.md        custo-base por moeda
    PROPOSTA-RATIOS.md            vetor de ratios (aprovado, populado em 013)
    SPEC-SLICE-COLETA-TIER1.md    próxima slice (3 partes: A auto ∥ B deriv → C manual)
    RESCORE-1-BASE-SA.md          re-score-1 base sã (B4=102, gravado)
    RESCORE-2-CPM-VIVO.md         re-score-2 CPM vivo (B4=101, 28 conta R$, gravado)
    CASO-LIVELO-AZUL-DIVERGENCIA.md  primeiro item real; blog 115% × oficial (caso-fundador)
    rescore/                      runner (importa engine), golden-replay, rescore-2.mjs, out/
```

**PRs relevantes:** #102 ratios (merged), #103 re-score dry-run base suja (draft),
#104 ratios+recanon+handoff (draft, watched). Re-score-1 base sã: worktree do agente.

---

## 6. Próximo passo imediato (para o chat que retomar)

1. **Operador aprova a SPEC da coleta TIER 1** (`SPEC-SLICE-COLETA-TIER1.md`) —
   responder as 4 decisões do §8. Não disparar agente antes disso.
2. **Parte A (automática) ∥ Parte B (derivação lado-único)** rodam juntas: adapters
   confirmam TIER 1 das vivas crawleáveis (corroborando termos, D-045); vetor
   lado-único v1 (PROPOSTA) corrige o score dos `sem_destino`.
3. **Parte C (manual)** depois da B: fila de curadoria no admin, corte ≥70, o
   operador confirma as fontes que valem.
4. Itens que atravessam os 3 portões → o **digest/M3** monta o Deal Desk publicável.
5. Atualizar este arquivo ao fechar cada slice.

*Promoções podem mudar sem aviso. Confira sempre as regras no site oficial antes
de comprar, transferir ou resgatar.*
