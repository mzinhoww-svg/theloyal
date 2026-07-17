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
> **Última atualização:** 2026-07-17 (v1 — após recanonicalização dos 13 self-loops
> gravada; re-score-1 sobre base sã EM EXECUÇÃO). Ratios 012/013 + fix do helper já feitos.

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
| Re-score-1 sobre base sã (grava) | 🔄 **EM EXECUÇÃO** (agente worktree) | `M2/RESCORE-1-BASE-SA.md` (a sair) |

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

1. **[EM EXECUÇÃO] Re-score-1 sobre a base sã.** Agente delegado pontuando os 3.330
   resolvidos; grava `tl_score_bruto` se o dry-run passar limpo. Próximo ponto de
   parada real → operador lê o **balde 4 recalculado** + a **recomendação de backup**.
2. **[OPERADOR, após (1)] Balde 4 recalculado + release do backup.** Decisão de
   produto que libera B3 (confirmar TIER 1 nos alcançáveis) e a soltura do backup
   `campaigns_bkp_prev2_20260716` (preso até re-score verde).
3. **[SEQUÊNCIA] Re-score-2 com CPM vivo.** Ratios (012/013) + custo-base (011)
   aplicados → CPM de `transferencia` reconstruível nos 8 pares. O re-score-2 tira
   metade da base da banda neutra 65 (D-042). Depende de (1) gravado.
4. **[DÍVIDA nomeada — D-042] Derivação de lado-único.** Os 1.220 `sem_destino`
   `lado_unico` (merchant/shopping) — como pontuam sem rota, resolver no re-score-2
   dentro do vetor de derivação existente. Não abre slice nova.
5. **[DÍVIDA] `tem_tier1` vem de `campaigns.tier===1`** no runner (default de
   `montarEntradas`) porque `campanha_fontes` está vazia. Quando encher, vem de lá (INV-02).

---

## 3. Decisões travadas (fonte de verdade: `v2/DECISIONS.md`)

**Não re-litigar.** ADRs **D-001..D-043** em `v2/DECISIONS.md`; invariantes
**INV-01..INV-16** em `v2/REQUIREMENTS.md`. Recentes (D-040..043): recanon = só
self-loops (sem_destino/banda-65 são derivação, não identidade); triagem R1–R5 +
guard permanente de self-loop; banda neutra CPM-cego é correta; **modo de operação
D-043** (autonomia dentro de slice aprovada; **dado vence instrução do operador
quando contradiz** — precedente PagoGol=Smiles). Os que mais pegam no dia a dia:

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
    RESCORE-1-DRYRUN.md           re-score-1 na base SUJA (superado)
    RESCORE-1-BASE-SA.md          re-score-1 na base SÃ (a sair do agente)
    rescore/                      runner (importa engine), golden-replay, out/
```

**PRs relevantes:** #102 ratios (merged), #103 re-score dry-run base suja (draft),
#104 ratios+recanon+handoff (draft, watched). Re-score-1 base sã: worktree do agente.

---

## 6. Próximo passo imediato (para o chat que retomar)

1. Re-score-1 sobre base sã (EM EXECUÇÃO) fecha → operador lê **balde 4 recalculado
   por programa** + **read do backup** (liberar/segurar). Este é o ponto de parada real.
2. Se gravou limpo: libera B3 (confirmar TIER 1 nos alcançáveis) + decide backup.
3. Re-score-2 com CPM vivo (ratios 012/013 já aplicados) → tira base da banda 65 → dry-run → gravar.
4. B3 nos alcançáveis → **primeiro Deal Desk**.
5. Atualizar este arquivo ao fechar cada slice.

*Promoções podem mudar sem aviso. Confira sempre as regras no site oficial antes
de comprar, transferir ou resgatar.*
