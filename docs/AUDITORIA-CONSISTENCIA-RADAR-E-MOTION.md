# Auditoria de Consistência — Radar & Motion (fonte histórica)

> **Modo:** documentação apenas. Nenhum código de produção, migration, banco, base de PR ou ADR foi alterado ao gerar este documento.
> **Propósito:** servir de fonte histórica para uma auditoria futura de consistência — reconstruir sequência de eventos, critérios, decisões, limitações e estado final de cada frente **sem reescrever o passado para parecer mais conclusivo do que foi.**
> **Data de compilação:** 2026-07-15.
> **Branch deste doc:** `docs/consistency-audit-radar-motion` (criada de `origin/main` @ `e487d93`).

## Aviso de autoria e perímetro de evidência (ler primeiro)

Este documento é compilado pelo agente que executou **firsthand** apenas as frentes de **landing (PR #66)** e **motion (PR #67 auditoria, PR #69 implementação)**. As frentes de **Radar / A1 Forecast Parity / Structural Architecture / Post-Merge Validation / H1–H12 (PRs #63, #64, #65, #68)** foram executadas em **outras sessões** (IDs de sessão distintos nos corpos dos PRs) e **não foram feitas nem revisadas firsthand por este agente**.

Por isso, o que consta sobre as frentes de Radar é registrado **a partir dos metadados e descrições reais dos respectivos PRs no GitHub**, verificados via API nesta sessão — **não** a partir de execução ou revisão direta. Onde um fato não pôde ser confirmado independentemente, está marcado como **NÃO CONFIRMADO** ou **REPORTADO (não verificado)**. Nenhuma validação ao vivo foi inventada.

**Convenção de evidência usada abaixo:**
- **[CÓDIGO]** — confirmado por leitura de código nesta ou em sessão anterior deste agente.
- **[CI/DEPLOY]** — confirmado por CI (GitHub Actions `build`) / Vercel Preview / checks.
- **[DOC/PR]** — confirmado pela descrição ou metadados do PR/documento (texto primário citado).
- **[NÃO CONFIRMADO]** — não verificável com a evidência disponível a este agente.
- **[REPORTADO]** — afirmado pelo solicitante/coordenador; não verificado independentemente aqui.

---

## 1. Contexto geral

O The Loyal é uma mídia vertical de loyalty/pontos/milhas com um app Next.js (landing + edições/Pro + painel admin/cockpit) e uma frente de dados chamada **Radar** (predição/forecast/ledger com proveniência). No período coberto, correram **frentes paralelas distintas**, com times/sessões e bases diferentes:

- **Landing** — redesign mobile-first da página principal.
- **Motion** — auditoria e implementação de animação, sobre a landing/admin já em produção.
- **Radar / estrutural** — plano da fase estrutural, matriz de ADRs e backlog.
- **A1 Forecast Parity** — correção de dívida de proveniência entre Forecast legado e Radar.
- **Post-Merge Validation** — validação pós-merge do Radar (P1), read-only.
- **Decisões humanas H1–H12** — registro versionado das decisões da fase estrutural.
- **Documentação de consistência** — este documento.

**Achado estrutural central (perímetro):** as frentes **não compartilham uma única base**. Existem **duas linhas de integração distintas e divergentes** [DOC/PR]:
- **`main`** — recebe **landing/motion** (PR #66 mergeado; #67/#69 abertos com base `main`).
- **`claude/loyalty-landing-page-v1-7vbjq7`** — descrita como **"canônica de integração"** no corpo do PR #68; recebe **Radar/A1/structural** (#64, #65 mergeados nela; #63, #68 baseados nela).

Ou seja: **a correção A1 (#64) e o plano estrutural (#65) NÃO estão em `main`**; o redesign/motion (#66/#67/#69) **não estão** na linha canônica do Radar. Isto é a principal fonte de risco de consistência (§9).

---

## 2. Linha do tempo resumida (ordem cronológica, por evidência)

Marcadores de tempo de `created_at`/`merged_at` dos PRs [DOC/PR]. Todos em 2026-07-15 (UTC).

| Hora (UTC) | Evento | Evidência |
|---|---|---|
| 17:57 | **#63** criado — post-merge validation do Radar (round 1, read-only), **draft** | [DOC/PR] |
| 18:01 | **#64** criado — A1 Forecast Parity | [DOC/PR] |
| 18:02 | **#65** criado — plano/ADRs/backlog da fase estrutural | [DOC/PR] |
| ~18:14 | **#66** criado — redesign mobile-first (landing), base `main` | [DOC/PR] |
| 18:26:51 | **#64 MERGED** em `claude/loyalty-landing-page-v1-7vbjq7` (A1 corrigido) | [DOC/PR] |
| 18:35:22 | **#65 MERGED** em `claude/loyalty-landing-page-v1-7vbjq7` (arquitetura estrutural) | [DOC/PR] |
| <18:43 | **#66 MERGED** em `main` (`e487d93`) — landing em produção (é a base de #67/#69) | [DOC/PR][CÓDIGO] |
| ~18:43 | **#67** criado — auditoria de motion (fase 1, read-only), base `main`, **draft** | [DOC/PR] |
| ~18:45 | **#68** criado — registro H1–H12, base `loyalty-landing-page-v1`, **draft** | [DOC/PR] |
| ~19:07 | **#69** criado — implementação de motion (fase 2), base `main` | [DOC/PR] |
| ~19:27 | **#69** re-deploy do polish (`27e1361`), Vercel Preview **Ready** | [CI/DEPLOY] |
| ~19:30 | **#69** marcado **ready for review** (deixou de ser draft) pelo autor | webhook + [DOC/PR] |
| 19:37 | **#69 MERGED** em `main` (`a673f0b`) — implementação de motion em produção | [DOC/PR][CÓDIGO] |
| ~19:38 | **#67 MERGED** em `main` (`7e035cb`) — docs de auditoria de motion em produção | [DOC/PR][CÓDIGO] |

**Ordem lógica das frentes de Radar (por dependência, conforme corpos dos PRs):** Post-Merge Validation (#63, diagnóstico) → A1 Forecast Parity (#64, correção) → Structural Architecture (#65, plano+ADRs+backlog, S0–S7) → Decisões H1–H12 (#68, gate 2). **Structural Implementation permanece bloqueada** [DOC/PR §7].

**Gates e ADRs (conforme corpo do #68) [DOC/PR]:**
- **Gate 2 (aprovação H1–H12): FECHADO.**
- **ADRs 001–010: ainda `proposed`** — **nenhum promovido**.
- **Gate 3 (promoção de ADR proposed→accepted): passo humano separado, ainda não feito.**
- **Structural Implementation: `blocked` até os gates 3, 4 e 5 fecharem.**
- Migrations: **conceituais**, ainda não aprovadas, **sem SQL**.

> **Divergência a reconciliar (não resolvida aqui):** o solicitante caracteriza **"gate 4 fechado conceitualmente"** e **"gate 5 aberto por limitação de ambiente"** [REPORTADO]. O corpo do #68 afirma que **gates 3, 4 e 5 ainda não fecharam** [DOC/PR]. A definição precisa de cada gate está nos docs estruturais do Radar (`PLANO-FASE-ESTRUTURAL-RADAR.md` / `MATRIZ-ADRS-FASE-ESTRUTURAL.md`), **não verificados firsthand por este agente**. Ver §7 e §8.

---

## 3. O que foi feito (por frente)

### 3.1 Landing redesign — PR #66 [CÓDIGO][CI/DEPLOY] (firsthand)
Redesign mobile-first da landing. Entregue e **mergeado em `main`**. Escopo: header mais leve; hero recomposto (headline como primeiro peso; Ponto cético como narrador; microcopy do form agrupada); nova ordem narrativa (prova antes do método); bandas de fundo paper/paper-dark/ink; cards editoriais unificados; CTA final em banda Ink; **StickyCTA** por geometria (rAF + scroll/resize passivos), robusto a scroll lento/rápido/salto/resize e safe-area. Diff restrito a 5 arquivos da landing; adaptações de analytics porque `main` não tinha `lib/track.ts`/prop `source` (removidos, não portados).

### 3.2 Auditoria de motion — PR #67 [DOC/PR] (firsthand, read-only)
Fase 1, **somente auditoria**: `MOTION-AUDIT.md`, `MOTION-MATRIX.md`, `MOTION-IMPLEMENTATION-PLAN.md` + 6 skills locais (`emilkowalski/skills`) + `skills-lock.json`. Observado: projeto já contido (sem lib de animação, sem `transition:all`, `prefers-reduced-motion` global). Alavancagem = calibrar o existente. Rotas citadas inexistentes registradas (Anuncie 404, área do cliente, Radar/Forecast/Predict como rotas, modais/drawers). **Nenhum código de produção alterado.**

### 3.3 Implementação de motion — PR #69 [CÓDIGO][CI/DEPLOY] (firsthand)
Fase 2, lotes 1–7 + polish. **Animado:** tokens de motion; press-feedback `.tl-press` (`scale(0.97)`); crossfade de confirmação do form (`@starting-style`); entrada/saída do toast do admin (transition interrompível); redução do Reveal (removido **por card**, mantidas 11 âncoras de seção). **Estático (por decisão):** CompareBanner/data-art, edições/Pro/daily, tabelas/KPIs/busca do admin, StickyCTA (intocado), idle do mascote (não introduzido). Só `transform`/`opacity`, UI < 300ms, reduced-motion respeitado, sem nova dependência. Revisão contra STANDARDS: sem achados bloqueantes.

### 3.4 Post-Merge Validation (Radar) — PR #63 [DOC/PR] (não firsthand)
Relatório read-only (round 1). HEAD validado `854137a`. Camada reproduzível verde: `build`, `typecheck`, **225/225 testes**, caso `livelo→connectmiles` (943 dias) **contido**. Findings: **F1** A1 persiste (Alto), **F2** sem RBAC (Médio), **F3** params de view em inglês (info), **F4** ambiente sem credenciais Supabase → dado vivo/filas/KPIs/desempenho **não confirmados** (bloqueador de validação), **F5** resíduo M2 (baixo, a reverificar). **Não pôde ser validado ao vivo** por F4.

### 3.5 A1 Forecast Parity — PR #64 [DOC/PR] (não firsthand) — **MERGED**
Correção da dívida A1: o loader `loadPredict` (`lib/admin-forecast.ts`) lia 7 colunas sem proveniência, então `suspect_year` nunca disparava (943 dias / janela 2029 escapavam no Forecast). Correção: **fonte única** `lib/ledger-select.ts` reusada por Forecast e Radar → mesma amostra elegível, `suspect_year` exclui o registro. Novos: `lib/ledger-select.ts`, `tests/forecast-provenance-parity.test.mjs` (11 testes), `docs/CORRECAO-A1-FORECAST-PARITY.md`. **236 testes ok.** Sem alterar matemática/gates/migration/banco/Radar UI; **nenhuma escrita no banco**.

### 3.6 Structural Architecture — PR #65 [DOC/PR] (não firsthand) — **MERGED**
Reconciliação documental do baseline e dos gates. Docs: `PLANO-FASE-ESTRUTURAL-RADAR.md` (10 princípios, 7 blocos, migrations conceituais **sem SQL**, roadmap **S0–S7**, decisões **H1–H12**, handoff para o Radar Program Coordinator), `MATRIZ-ADRS-FASE-ESTRUTURAL.md` (ADRs 001–010; **nenhum promovido automaticamente**; ordem 010/009 primeiro), `BACKLOG-FASE-ESTRUTURAL-RADAR.md` (S0–S7 item a item). Registra que relatório pós-merge e fechamento do A1 **"não disponíveis nesta data"** como dependências da onda S0.

### 3.7 Decisões H1–H12 — PR #68 [DOC/PR] (não firsthand) — **draft**
`docs/DECISOES-H1-H12-FASE-ESTRUTURAL.md`: 12 decisões aprovadas em sessão de coordenação (2026-07-15, por `mzinhoww-svg`, opção A/recomendação em cada). Regra registrada: aprovar H é **insumo** para promover o ADR correspondente — **não** promove ADR automaticamente (gate 3 é passo humano separado). Estado pós-sessão: **gate 2 fechado**; ADRs `proposed`; migrations conceituais; F4 `blocked`, F5 `not_confirmed`; **Structural Implementation `blocked`**.

---

## 4. Como foi feito (abordagem por frente)

- **Branches separadas por frente** [DOC/PR]: `claude/theloyal-mobile-redesign-clean` (#66), `claude/theloyal-motion-audit` (#67), `claude/theloyal-motion-impl` (#69), `claude/radar-post-merge-validation-mdd4ou` (#63), `claude/radar-a1-forecast-provenance-ybmgmi` (#64), `docs/radar-structural-architecture` (#65), `claude/radar-program-coordinator-j65act` (#68). Nenhuma reutilizou branch encerrada (ex.: PR #54).
- **Doc-only respeitado** onde aplicável [DOC/PR]: #63, #65, #67, #68 e este documento não alteram código de produção; #64 (fix) e #66/#69 (impl) alteram código com validação.
- **Validações locais + CI + Vercel + checks de repositório** [CÓDIGO][CI/DEPLOY]: motion/landing rodaram lint/typecheck/build/validate/qa localmente e tiveram CI `build` + Vercel Preview verdes; Radar (#63/#64) reporta `build`/`typecheck`/testes (225→236) na camada reproduzível.
- **Distinção de evidências** mantida: código (reproduzível) × documental (PR/doc) × operacional (dado vivo). A camada **operacional do Radar ficou NÃO CONFIRMADA** por ambiente (F4).
- **Separação entre decisão humana, promoção de ADR, aprovação de migration e implementação estrutural** [DOC/PR §7]: são passos distintos e sequenciais; aprovar decisão H ≠ promover ADR ≠ aprovar migration ≠ implementar.

---

## 5. Critérios e regras aplicadas

Regras observadas ao longo do fluxo (evidência em corpos de PR e nesta sessão):
- **Não fabricar resultado**; marcar o não confirmável explicitamente (F4/F5; este doc).
- **Não consultar produção quando proibido** (sem credenciais Supabase → sem dado vivo).
- **Não escrever SQL quando a etapa é conceitual** (migrations conceituais, sem SQL — #65/#68).
- **Não promover ADR automaticamente** (aprovar H é só insumo; gate 3 é separado — #68).
- **Não tratar PR verde como merge** (CI verde ≠ integração; #69 verde mas **não** mergeado).
- **Não iniciar implementação estrutural (S1–S7) antes dos gates necessários** (blocked — #65/#68).
- **Manter Structural Implementation bloqueada** até os gates humanos e técnicos corretos.
- **Motion:** só onde melhora feedback/continuidade/confirmação; estático em alta frequência; sem `transition:all`/`scale(0)`/`ease-in`; reduced-motion preservando informação; sem nova dependência.
- **Bases de PR inalteradas**; branches novas por frente; sem reutilização de branch encerrada.

---

## 6. Estado final por frente

Estados **verificados via GitHub API nesta sessão** (2026-07-15) [DOC/PR].

| Frente | PR | Branch (head) | Base | Estado | Merged? | Próximos passos / bloqueios |
|---|---|---|---|---|---|---|
| Landing redesign | **#66** | `claude/theloyal-mobile-redesign-clean` | `main` | fechado | **SIM** (`e487d93`) | — (em produção na linha `main`) |
| Motion audit (fase 1) | **#67** | `claude/theloyal-motion-audit` | `main` | **fechado** | **SIM** (`7e035cb`) | — (docs de auditoria de motion em `main`) |
| Motion implementation | **#69** | `claude/theloyal-motion-impl` (`27e1361`) | `main` | **fechado** | **SIM** (`a673f0b`, 19:37 UTC) | — (**motion em produção** na linha `main`) |
| Post-Merge Validation | **#63** | `claude/radar-post-merge-validation-mdd4ou` | `loyalty-landing-page-v1` | aberto, **draft** | não | **Rodada 2 bloqueada por ambiente (F4)**; decisão do coordenador sobre versionar |
| A1 Forecast Parity | **#64** | `claude/radar-a1-forecast-provenance-ybmgmi` | `loyalty-landing-page-v1` | fechado | **SIM** (18:26 UTC) | — (A1 corrigido na linha canônica; **não** em `main`) |
| Structural Architecture | **#65** | `docs/radar-structural-architecture` | `loyalty-landing-page-v1` | fechado | **SIM** (18:35 UTC) | Insumo para gates 3/4/5 |
| Decisões H1–H12 | **#68** | `claude/radar-program-coordinator-j65act` | `loyalty-landing-page-v1` | aberto, **draft** | não | Merge do registro; promoção de ADRs (gate 3) |
| Structural Implementation | — | — | — | **BLOCKED** | não | Depende de gates 3, 4 e 5 (§7) |
| Consistency audit (este doc) | — | `docs/consistency-audit-radar-motion` | `main` | doc-only | — | — |

> **NOTA DE DIVERGÊNCIA (#69) — RESOLVIDA:** houve uma janela nesta sessão em que o #69 foi comunicado como "merged" enquanto o fetch via API ainda retornava `open`/não-mergeado (defasagem temporal, verificação **antes** do merge). O **#69 foi efetivamente mergeado às 19:37 UTC** (`merged_at`, `merged_by: mzinhoww-svg`), confirmado por API e por `origin/main` contê-lo (`a673f0b`; HEAD subsequente `7e035cb` após #67). Era divergência de **timing**, não de fato — **resolvida**. Lição (§9): verificar sempre com fetch fresco antes de concluir.

---

## 7. Decisões humanas

Registrado a partir do corpo do PR #68 e #65 [DOC/PR]:
- **H1–H12: aprovadas e versionadas** em sessão de coordenação (2026-07-15, `mzinhoww-svg`), todas na opção A/recomendação. **Gate 2: fechado.** Observação: o **registro está em PR draft (#68)**, ainda **não mergeado** na linha canônica.
- **ADRs promovidos: NENHUM.** ADRs 001–010 permanecem **`proposed`**. A promoção (proposed→accepted) é o **gate 3**, passo humano separado, ainda não realizado.
- **ADRs ainda `proposed`:** 001–010 (todos). Ordem de promoção recomendada: 010 e 009 primeiro (regra-mãe §27f, conforme #65) — [NÃO CONFIRMADO em detalhe por este agente].
- **Migrations conceituais:** aprovadas **apenas no nível conceitual**; **sem SQL**; não aprovadas para execução.
- **Gate 4:** o corpo do #68 lista gate 4 entre os que **ainda não fecharam**; o solicitante caracteriza como **"fechado conceitualmente"** [REPORTADO]. **Divergência a reconciliar** (§2, §8). A definição precisa do gate 4 está nos docs estruturais **não verificados aqui**.
- **Gate 5:** **aberto por limitação de ambiente** — coerente com **F4** (sem Supabase → validação ao vivo/round 2 impossível) [DOC/PR para F4; REPORTADO para o rótulo "gate 5"].
- **Decisão explícita de manter a Structural Implementation `blocked`** enquanto os gates (3, 4, 5) não fecharem [DOC/PR #68].

---

## 8. Evidências e limitações

**Confirmado por código [CÓDIGO]:**
- Landing/motion: conteúdo dos 8 arquivos de #69, StickyCTA por geometria, tokens/`.tl-press`/`.tl-fade-in`/`.tl-toast`, remoção do Reveal por card, fallback `<noscript>`.
- `main` @ `e487d93` contém o merge de #66; **não** contém #64/#65 (linha divergente).

**Confirmado por CI / Vercel / checks [CI/DEPLOY]:**
- #69: CI `build` **success** e Vercel Preview **Ready** (commits `a0c3ec3` e `27e1361`).
- #67: lint/typecheck/validate/qa/build verdes (reportado no corpo).

**Confirmado por documentação/PR [DOC/PR]:**
- Estados, bases, merges e descrições de #63–#69 (metadados via API nesta sessão).
- Findings F1–F5 (#63); correção A1 e 236 testes (#64); plano/ADRs/backlog e S0–S7 (#65); H1–H12 e gates (#68).

**NÃO CONFIRMADO [NÃO CONFIRMADO]:**
- Camada **operacional/ao vivo** do Radar: dado vivo, filas, KPIs, desempenho, caso 943 **em produção** (F4).
- Definição exata e estado independente dos **gates 4 e 5** (docs estruturais não lidos firsthand).
- Conteúdo interno detalhado de ADR-RADAR-001…010 e das migrations conceituais.

**Bloqueado por ambiente [NÃO CONFIRMADO/BLOCKED]:**
- Rodada 2 de validação do Radar (#63, F4) — sem credenciais Supabase; **produção proibida**.

**Não consultado por restrição:**
- Produção/banco vivo (regra explícita de não usar produção).

**Divergências (para o auditor futuro):**
1. ~~#69 "merged" × open~~ — **RESOLVIDA:** #69 mergeado às 19:37 UTC (confirmado por API e por `origin/main`); era defasagem de timing. #67 também mergeado logo depois (`7e035cb`).
2. **[ABERTA] Gate 4** "fechado conceitualmente" (reportado) × "ainda não fechado" (corpo do #68).
3. **[ABERTA] Duas linhas de integração** (`main` × `loyalty-landing-page-v1`) — A1/estrutural fora de `main`.

---

## 9. Riscos e lições aprendidas

- **Duas linhas de integração divergentes** (`main` × `loyalty-landing-page-v1`): a correção A1 (#64) e o plano estrutural (#65) **não estão em `main`**; landing/motion não estão na linha do Radar. **Maior risco de consistência.** Sem uma reconciliação de baseline, "produção" significa coisas diferentes por frente.
- **Depender de ambiente sem staging read-only com dados vivos:** F4 travou toda a validação operacional do Radar; findings ficam "reproduzíveis-verde" mas **não confirmados ao vivo**.
- **Confundir PR verde com integração real:** #69 está verde e ready-for-review, mas **não mergeado**; tratar como "em produção" seria erro (ver nota de divergência).
- **Misturar validação conceitual com execução:** migrations conceituais/ADRs `proposed` não podem ser lidos como "prontos"; gates 3/4/5 existem para impedir isso.
- **Reabrir escopo de implementação cedo demais:** Structural Implementation mantida `blocked` foi a decisão correta; iniciar S1–S7 antes dos gates seria inconsistente.
- **Motion em áreas de alta frequência:** risco explicitamente evitado (admin/tabelas/KPIs estáticos; só feedback/continuidade animados).
- **Branch antigo como fonte de confusão:** houve cuidado documentado de **não reutilizar** branches encerradas (ex.: #54); manter uma branch antiga viva confunde o baseline.
- **Não separar documentação, auditoria e implementação:** o fluxo separou bem (docs #63/#65/#67/#68; fix #64; impl #66/#69), o que este documento preserva; misturá-las teria minado a rastreabilidade.

---

## 10. Conclusão executiva

- **Entregue (verificado):** landing redesign (**#66, em `main`**); auditoria de motion (**#67, em `main`**); implementação de motion (**#69, em `main`**); correção **A1 Forecast Parity (#64)** e arquitetura estrutural documental (**#65**), ambas mergeadas na linha `loyalty-landing-page-v1` (**não em `main`**).
- **Em produção (linha `main`, HEAD `7e035cb`):** **landing redesign (#66) + motion completo (#67 docs de auditoria + #69 implementação)**. A1/estrutural (#64/#65) estão na **outra** linha, **não em `main`**.
- **Ainda bloqueado:** **Structural Implementation** (`blocked` até gates 3, 4 e 5); **rodada 2 de validação do Radar** (F4, ambiente); **promoção de ADRs** (gate 3, nenhum promovido).
- **Próxima dependência real para continuar:**
  1. **Reconciliar as duas linhas de integração** (`main` × `loyalty-landing-page-v1`) — decidir o baseline canônico e portar A1/estrutural ou o motion conforme.
  2. **Fechar o gate 3** (promover ADRs) e, para o Radar operacional, **um ambiente de staging com dados vivos** para a rodada 2 (destravar F4/gate 5).
  3. **Reconciliar as divergências** de §8 (estado real de #69; definição de gate 4).

---

## Apêndice A — PRs

| PR | Título | Estado | Base |
|---|---|---|---|
| #63 | docs(radar): post-merge validation report (round 1, read-only) | draft/open | loyalty-landing-page-v1 |
| #64 | fix(forecast): paridade A1 — Forecast legado consome proveniência | **merged** | loyalty-landing-page-v1 |
| #65 | docs(radar): plano, matriz de ADRs e backlog da fase estrutural | **merged** | loyalty-landing-page-v1 |
| #66 | (landing) redesign mobile-first | **merged** | main |
| #67 | docs(motion): auditoria de motion — fase 1 (read-only) | **merged** | main |
| #68 | docs(radar): registro das decisões H1–H12 da fase estrutural | draft/open | loyalty-landing-page-v1 |
| #69 | feat(motion): implementação de motion (lotes 1–7) | **merged** | main |

## Apêndice B — Branches canônicos e por frente

- **Linhas de integração:** `main` (landing/motion) · `claude/loyalty-landing-page-v1-7vbjq7` (Radar/A1/structural, dita "canônica de integração" no #68).
- **Por frente:** `claude/theloyal-mobile-redesign-clean` · `claude/theloyal-motion-audit` · `claude/theloyal-motion-impl` · `claude/radar-post-merge-validation-mdd4ou` · `claude/radar-a1-forecast-provenance-ybmgmi` · `docs/radar-structural-architecture` · `claude/radar-program-coordinator-j65act` · `docs/consistency-audit-radar-motion` (este doc).

## Apêndice C — Gates

| Gate | Significado (conforme #68/§7) | Estado |
|---|---|---|
| Gate 2 | Aprovação das decisões H1–H12 | **FECHADO** [DOC/PR] |
| Gate 3 | Promoção de ADR (`proposed`→`accepted`) | **ABERTO** (nenhum promovido) [DOC/PR] |
| Gate 4 | (def. nos docs estruturais) | **Divergente:** #68 = não fechado; solicitante = "fechado conceitualmente" [REPORTADO] |
| Gate 5 | Validação ao vivo / ambiente (liga-se a F4) | **ABERTO** por limitação de ambiente [DOC/PR F4; REPORTADO rótulo] |

## Apêndice D — Docs gerados (por frente)

- **Motion (main line):** `docs/MOTION-AUDIT.md`, `docs/MOTION-MATRIX.md`, `docs/MOTION-IMPLEMENTATION-PLAN.md` (no PR #67).
- **Radar (loyalty-landing-page-v1 line) [DOC/PR, não verificados firsthand]:** `docs/VALIDACAO-POS-MERGE-RADAR.md` (#63), `docs/CORRECAO-A1-FORECAST-PARITY.md` (#64), `docs/PLANO-FASE-ESTRUTURAL-RADAR.md` · `docs/MATRIZ-ADRS-FASE-ESTRUTURAL.md` · `docs/BACKLOG-FASE-ESTRUTURAL-RADAR.md` (#65), `docs/DECISOES-H1-H12-FASE-ESTRUTURAL.md` (#68).
- **Consistência:** este documento.

## Apêndice E — Decisões e ADRs

- **Decisões humanas:** H1–H12 aprovadas (opção A), gate 2 fechado (#68).
- **ADRs:** 001–010, todos **`proposed`** — nenhum promovido; promoção é o gate 3 (passo humano separado).
- **Migrations:** conceituais, sem SQL, não aprovadas para execução.

---

_Fim. Documento factual e read-only. Onde algo não pôde ser confirmado, está marcado como NÃO CONFIRMADO/BLOCKED/REPORTADO. Nenhuma validação ao vivo foi inventada; nenhum estado foi arredondado para parecer mais conclusivo do que a evidência permite._
