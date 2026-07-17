# Auditoria de consistência — Radar, Estrutural, Post-Merge, A1, Landing e Motion

> Documento de coordenação, **doc-only**. Não altera código de produção, não cria
> migrations, não promove ADRs, não toca banco, não altera bases de PR e não abre PR de
> implementação. Serve como fonte histórica para auditoria futura de consistência.
>
> **Regra deste documento:** evidência e raciocínio ficam **separados**. O que não pôde
> ser confirmado está marcado como **não confirmado** ou **bloqueado**. Nada aqui reescreve
> o passado para parecer mais conclusivo do que foi.

- **Data do registro:** 2026-07-15
- **Autor do registro:** chat de coordenação (Radar Program Coordinator)
- **Base canônica de integração do Radar:** `claude/loyalty-landing-page-v1-7vbjq7` (`4a8f013`)
- **Base da landing/motion:** `main`

---

## 1. Contexto geral

Esta auditoria cobre um período em que correram **frentes paralelas distintas** no
repositório `mzinhoww-svg/theloyal`, algumas coordenadas por este chat e outras não:

- **Landing (redesign mobile-first)** — PR #66, base `main`. **Não** coordenada por este chat.
- **Motion (auditoria)** — PR #67, base `main`. **Não** coordenada por este chat.
- **Motion (implementação)** — PR #69, base `main`. **Não** coordenada por este chat.
- **Radar P1** — PR #54, base de integração. Entrega funcional já mergeada (marco anterior).
- **Radar P1 Closure** — PR #62. Documentação de encerramento.
- **Post-Merge Validation** — PR #63. Validação pós-merge (rodada 1 e tentativa de rodada 2).
- **A1 Forecast Parity** — PR #64. Correção de proveniência/paridade no Forecast legado.
- **Structural Architecture** — PR #65. Plano/ADRs/backlog da fase estrutural.
- **Decisões H1–H12** — PR #68. Registro versionado das decisões humanas.
- **Structural Implementation** — sem PR. Permaneceu **bloqueada**.

**Perímetro:** este documento registra estados **verificados por API** (GitHub) e
**raciocínio de coordenação**. O conteúdo interno das frentes de landing e motion é
**atribuído às descrições dos respectivos PRs** (evidência documental de autor), pois
não houve handoff dessas frentes a este chat nem verificação independente do diff.

**Observação de consistência (importante):** existem **duas linhagens de base**. Landing
e motion partem de `main`; Radar/A1/estrutural partem de `claude/loyalty-landing-page-v1-7vbjq7`.
As duas **não foram reconciliadas** numa única linha. `main` **não** contém o Radar P1
(`0c0cc23`/`854137a`) — confirmado por `git merge-base --is-ancestor`.

---

## 2. Linha do tempo resumida

Ordem cronológica por horário de evento (UTC, 2026-07-15), conforme metadados de PR:

| Hora | Marco | Evidência |
|---|---|---|
| 17:37:45 | **PR #54** (Radar P1) **merged** na base de integração; head `0c0cc23`, merge `854137a` | handoff P1 Closure + git |
| (rodada 1) | **PR #63** Post-Merge Validation — validação reproduzível aprovada; findings F1–F5 | PR #63 |
| 18:24:00 | **PR #66** (landing redesign) **merged** em `main`; head `66f65d6`, base `a0eda8ca` | API |
| 18:26:51 | **PR #64** (A1 Forecast Parity) **merged** na integração; head `0ce35cb`; base → `e7c98ba` | API + git |
| 18:35:22 | **PR #65** (Structural Architecture) **merged** na integração; head `c610078`; base → `4a8f013` | API + git |
| 18:43:51 | **PR #67** (motion audit, draft) criado em `main`; head `9b4603a` | API |
| (sessão) | **H1–H12** versionadas no **PR #68** (draft); head `ff2ee86` | API + git |
| (sessão) | **ADRs promovidos:** 010, 009, 002, 001, 006, 008, 004 → `accepted` (decisão humana) | sessão de coordenação |
| (sessão) | **ADRs mantidos `proposed`:** 003, 005, 007 (por decisão, promovem em suas ondas) | sessão de coordenação |
| (sessão) | **Gate 4** (migrations conceituais) fechado **no nível conceitual** (sem SQL, sem execução) | sessão de coordenação |
| (sessão) | **Gate 5** (F4/F5) **aberto** — rodada 2 não executável por falta de ambiente lawful | sessão de coordenação |
| 19:07:14 | **PR #69** (motion impl, Ready, não mergeado) criado em `main`; head `27e1361` | API |
| — | **Structural Implementation** permaneceu **blocked** (gate 5 aberto) | sessão de coordenação |

> As horas marcadas "(sessão)" ocorreram durante a coordenação e não têm carimbo de commit
> associado neste documento; registradas como não-cronometradas para evitar precisão falsa.

---

## 3. O que foi feito

### 3.1 Landing redesign — PR #66 (merged em `main`) — *evidência: descrição do PR*
Redesign mobile-first da landing, transplantado para base limpa a partir de `main`.
Conforme a descrição do PR: header 56px, hero com Ponto pequeno como narrador, ordem
narrativa reordenada (prova sobe para após o problema), bandas visuais alternadas,
Sticky CTA por geometria (rAF + scroll/resize passivos), acessibilidade (uma `h1`, skip
link, `aria-live`, 1 mascote por breakpoint). Diff de **5 arquivos** (+207/-66). Tracking
de atribuição **não** transplantado (infra inexistente na base) — decisão de escopo.
**Fora de escopo declarado:** analytics/tracking, motion, admin, área do cliente.

### 3.2 Motion audit — PR #67 (draft em `main`) — *evidência: descrição do PR*
Auditoria read-only de motion (fase 1). Conforme a descrição: nenhum código de produção
alterado; diff de documentação (`MOTION-AUDIT.md`, `MOTION-MATRIX.md`,
`MOTION-IMPLEMENTATION-PLAN.md`) + skills locais. Achado central: o projeto já é contido
(sem lib de animação, sem `transition:all`, `prefers-reduced-motion` global). Recomenda
**calibrar o que existe** (P1 reveal por card na landing; P2 toast do admin; P2
press-feedback; P3 tokens), rejeitando scroll-reveal geral, parallax, contadores, CTA
pulsando, etc. Diff de **13 arquivos** (+2349).

### 3.3 Motion implementation — PR #69 (Ready, não mergeado, `main`) — *evidência: descrição do PR (truncada)*
Implementação dos lotes 1–7 aprovados na auditoria #67. Conforme a descrição: só
`transform`/`opacity`, UI < 300ms, sem `transition:all`, sem `scale(0)`, sem nova
dependência, tudo sob `prefers-reduced-motion`. Lotes citados: tokens de motion (1),
press-feedback `.tl-press scale(0.97)` (2), confirmação `.tl-fade-in` no form (3),
**remoção do Reveal por card** mantendo só reveal de âncora de seção na landing (4).
Diff de **8 arquivos** (+125/-69). **O que permaneceu estático:** a descrição indica
rejeição de scroll-reveal/stagger geral, parallax, CTA pulsando e animação de tabela/KPI
no admin (detalhe integral **não confirmado** aqui — corpo do PR truncado na leitura).

### 3.4 Post-Merge Validation — PR #63 — *evidência: handoffs + repositório*
- **Validado por repositório (rodada 1):** build, typecheck, 225/225 testes, 9 rotas do
  Radar; caso 943 contido nas fixtures; auth de token único; resolução de view pt-BR.
- **Não validável ao vivo (rodada 2):** dados reais, completude, frescor, KPIs, filas
  populadas, 943 no ledger real, tempos/leituras/timeouts — **F4 `blocked`**; link de
  placeholders (M2) — **F5 `not_confirmed`**. Rodada 2 **não executável** por ausência de
  ambiente lawful (ver §8).

### 3.5 A1 Forecast Parity — PR #64 (merged na integração) — *evidência: PR + git*
Loader do Forecast legado passou a ler proveniência via **fonte única** `lib/ledger-select.ts`
(`LEDGER_QUALITY_SELECT`), compartilhada com o Radar. Efeito: `suspect_year` exclui o
registro suspeito; caso `livelo → connectmiles` deixa de exibir o intervalo de 943 dias e
a janela em 2029. Diff de **5 arquivos** (+501/-4), 236/236 testes. **Sem** alteração de
motor, Predict, banco ou migrations. Integrado à base (`e7c98ba`).

### 3.6 Structural Architecture — PR #65 (merged na integração) — *evidência: PR + git*
Plano da fase estrutural (`PLANO`, `MATRIZ-ADRS`, `BACKLOG`): 10 princípios, 7 blocos
arquiteturais (17 objetivos), migrations **conceituais sem SQL**, roadmap S0–S7, 12
decisões humanas (H1–H12) e a matriz de ADRs. Reconciliado depois para incorporar o
relatório #63 (F1–F5) e o baseline integrado do A1 (#64). Publicado na base (`4a8f013`).

---

## 4. Como foi feito

- **Branches separadas por frente.** Nenhuma frente reutilizou a branch encerrada do #54
  (`claude/forecast-predict-audit-nyswiw`, congelada). Cada frente abriu branch própria.
- **Doc-only quando aplicável.** P1 Closure (#62), Post-Merge (#63), Structural (#65),
  Motion audit (#67), registro H1–H12 (#68) e esta auditoria são documentação; não
  alteram código de produção.
- **Validação em camadas:** validações locais (`npm test`/`lint`/`typecheck`/`build`),
  CI (`test`, `lint`, `typecheck`, `editorial-gate`, `build`), Vercel Preview e checks de
  repositório (`git merge-base --is-ancestor`, presença de arquivos na base).
- **Distinção de evidência:**
  - **Código** — testes de fixture, presença de arquivos/colunas, compilação.
  - **Documental** — descrições de PR, docs publicados, handoffs.
  - **Operacional** — dados vivos, KPIs, filas populadas (**indisponível** neste ambiente).
- **Separação de camadas de decisão:** decisão humana (H1–H12) ≠ promoção de ADR ≠
  aprovação de migration ≠ implementação estrutural. Cada uma foi tratada como passo
  distinto e explícito.

---

## 5. Critérios e regras aplicadas

- **Não fabricar resultado.** Faltando dado → "Não confirmado" (nunca chute).
- **Não consultar produção** quando proibido; nenhuma query a produção foi feita.
- **Não escrever SQL** quando a etapa era conceitual; migrations ficaram no nível conceitual.
- **Não promover ADR automaticamente** — promoção só por decisão humana explícita.
- **Não tratar PR verde como merge** — CI verde e merge são estados distintos, verificados
  separadamente (`merged: true` só após merge humano).
- **Não iniciar S1–S7** antes dos gates necessários.
- **Manter Structural Implementation bloqueada** até os gates humanos e técnicos corretos.
- **Merge sempre humano** — os merges de #54, #64, #65, #66 foram por `mzinhoww-svg`.

---

## 6. Estado final por frente

*(estados verificados por API GitHub nesta sessão; branches conforme metadados de PR)*

| Frente | PR | Branch | Estado final | Merged | Base | Próximos passos / bloqueios |
|---|---|---|---|---|---|---|
| Landing redesign | #66 | `claude/theloyal-mobile-redesign-clean` | closed | **sim** | `main` | Em produção (`main`). Validação AT real (VoiceOver/TalkBack/iOS) pendente — declarada no PR |
| Motion audit | #67 | `claude/theloyal-motion-audit` | open, **draft** | não | `main` | Revisão humana dos 3 docs; decisões de marca (reveal P1, idle do mascote, tokens) |
| Motion implementation | #69 | `claude/theloyal-motion-impl` | open, **Ready** | não | `main` | Revisão/merge humano; depende da aprovação da auditoria #67 |
| Post-Merge Validation | #63 | `claude/radar-post-merge-validation-mdd4ou` | review_required (draft) | não | integração | **Rodada 2 bloqueada por ambiente** (F4/F5) |
| A1 Forecast Parity | #64 | `claude/radar-a1-forecast-provenance-ybmgmi` | closed | **sim** | integração | Concluído e integrado (`e7c98ba`) |
| Structural Architecture | #65 | `docs/radar-structural-architecture` | closed | **sim** | integração | Plano publicado (`4a8f013`); H aprovadas; ADRs promovidos |
| P1 Closure | #62 | `claude/radar-p1-closure-ekqqee` | review_required (draft) | não | integração | Revisão humana do doc de encerramento |
| Decisões H1–H12 | #68 | `claude/radar-program-coordinator-j65act` | draft | não | integração | Revisão humana |
| Structural Implementation | — | — | **blocked** | — | — | Aguarda gate 5 fechar + confirmação humana |
| Radar P1 (marco) | #54 | `claude/forecast-predict-audit-nyswiw` (congelada) | closed | **sim** | integração | Congelado (`854137a`) |

---

## 7. Decisões humanas

- **H1–H12:** todas **aprovadas** conforme a recomendação (opção A), versionadas no PR #68
  (`docs/DECISOES-H1-H12-FASE-ESTRUTURAL.md`).
- **ADRs promovidos → `accepted`:** ADR-010, ADR-009, ADR-002, ADR-001, ADR-006, ADR-008,
  ADR-004 (010 e 009 primeiro, regra-mãe §27f).
- **ADRs ainda `proposed` (por decisão):** ADR-003 (S6/S7), ADR-005 (S3 secundária),
  ADR-007 (S5/S6) — promovem em suas ondas; não bloqueiam S1.
- **Migrations conceituais:** aprovadas **apenas no nível conceitual** (aditivas, RLS
  service_role, rollback por drop, backfill idempotente **sem autocorreção**). **Sem SQL,
  sem execução.**
- **Gate 4:** fechado **no nível conceitual**.
- **Gate 5:** **aberto** por limitação de ambiente (ver §8).
- **Decisão explícita:** manter **Structural Implementation bloqueada** enquanto o gate 5
  não fechar.

---

## 8. Evidências e limitações

**Confirmado por código:** caso 943 e paridade Forecast×Radar (testes de fixture do A1,
#64, 236/236); presença de `lib/ledger-select.ts`/`LEDGER_QUALITY_SELECT` na base de
integração; 9 rotas do Radar compilam; auth de token único (rodada 1).

**Confirmado por CI / Vercel / checks:** #64, #65 e #66 com CI verde e Vercel Ready; #65
com 11/11 check-runs `success` no head `c610078`; #67 e #69 com `mergeable_state: clean`.

**Confirmado por documentação/handoff:** findings F1–F5 (rodada 1 do #63); plano estrutural
e matriz de ADRs (#65); registro H1–H12 (#68); descrições das frentes de landing (#66) e
motion (#67/#69).

**Não confirmado:** conteúdo integral do diff de landing/motion (baseado só em descrição de
PR, não verificado linha a linha por este chat); F5 (link de placeholders/M2); detalhes de
lotes de motion (corpo do #69 truncado na leitura).

**Bloqueado por ambiente:** F4 — validação ao vivo (dados reais, completude, frescor, KPIs,
filas populadas, 943 no ledger real, tempos/leituras/timeouts, consistência do Radar com
dados reais). **Não existe path lawful:** sem `.env` funcional, sem credenciais de staging
read-only com dados vivos.

**Não consultado por restrição:** produção (proibida). Nenhuma query a produção foi
executada; nenhum SQL; nenhuma migration executada; nenhum código de produção alterado.

---

## 9. Riscos e lições aprendidas

- **Duas linhagens de base não reconciliadas.** Landing/motion em `main`; Radar/estrutural
  em `claude/loyalty-landing-page-v1-7vbjq7`. `main` **não** contém o Radar P1. Risco de
  confusão sobre "o que está onde" e de merge futuro conflitante se não reconciliadas.
- **Depender de ambiente sem staging read-only com dados vivos** trava a validação
  operacional (gate 5) — bloqueio estrutural, não de esforço.
- **Confundir PR verde com integração real** — mitigado tratando `merged` e CI como
  estados distintos e verificando por API/git.
- **Misturar validação conceitual com execução** — mitigado mantendo migrations no nível
  conceitual, sem SQL.
- **Reabrir escopo de implementação cedo demais** — mitigado mantendo S1–S7 bloqueados até
  os gates.
- **Motion em áreas de alta frequência** — a própria auditoria #67 rejeitou scroll-reveal
  geral, parallax e animação de tabela/KPI no admin (área de alta frequência).
- **Branch antiga como fonte de confusão** — mitigado congelando `claude/forecast-predict-audit-nyswiw`
  (#54) e nunca reutilizando-a.
- **Não separar documentação, auditoria e implementação** — mitigado por PRs distintos e
  doc-only quando aplicável.

---

## 10. Conclusão executiva

- **Entregue e em produção (`main`):** redesign mobile-first da landing (#66, merged).
- **Entregue e integrado (base do Radar):** correção A1 de proveniência/paridade (#64,
  merged) e o plano da fase estrutural (#65, merged), com H1–H12 aprovadas e 7 ADRs
  promovidos.
- **Pronto mas não mergeado:** implementação de motion (#69, Ready, `main`), pendente de
  revisão e da aprovação da auditoria de motion (#67, draft).
- **Bloqueado:** validação pós-merge ao vivo (gate 5, F4/F5) e, por consequência, a
  **Structural Implementation** (S1–S7 não iniciados).
- **Próxima dependência real para continuar:** um **ambiente de staging somente-leitura,
  não-produção, com dados vivos** para a rodada 2 fechar F4/F5 — **ou** uma decisão humana
  explícita de tratar F4/F5 como limitação documentada. Sem uma das duas, o gate 5
  permanece aberto e S1 não inicia.

---

## Apêndice A — Pull requests

| PR | Título | Estado | Base |
|---|---|---|---|
| #54 | Radar P1 | merged | integração |
| #62 | P1 Closure (doc) | review_required (draft) | integração |
| #63 | Post-Merge Validation (doc) | review_required (draft) | integração |
| #64 | A1 Forecast Parity | merged | integração |
| #65 | Structural Architecture (doc) | merged | integração |
| #66 | Landing redesign | merged | `main` |
| #67 | Motion audit (doc) | open (draft) | `main` |
| #68 | Decisões H1–H12 (doc) | draft | integração |
| #69 | Motion implementation | open (Ready) | `main` |

## Apêndice B — Branches canônicos

- **Integração do Radar:** `claude/loyalty-landing-page-v1-7vbjq7` (`4a8f013`; contém P1 + A1 + plano estrutural).
- **Landing/motion:** `main` (não contém o Radar P1).
- **Congelada (não reutilizar):** `claude/forecast-predict-audit-nyswiw` (branch de origem do #54).

## Apêndice C — Gates

| Gate | Descrição | Estado |
|---|---|---|
| 1 | PR #65 revisado/aprovado | fechado |
| 2 | H1–H12 decididas e versionadas | fechado |
| 3 | ADRs promovidos (010/009 primeiro) | fechado para S1–S5 (003/005/007 `proposed`) |
| 4 | Migrations conceituais aprovadas | fechado **conceitualmente** |
| 5 | F4/F5 (rodada 2, dados vivos) | **aberto** |
| 6 | A1 integrado | fechado |
| 7 | Sem edição concorrente em S1–S7 | fechado |

## Apêndice D — Documentos gerados (fase Radar/estrutural)

- `docs/ENCERRAMENTO-RADAR-P1.md` (#62)
- `docs/VALIDACAO-POS-MERGE-RADAR.md` (#63)
- `docs/CORRECAO-A1-FORECAST-PARITY.md` (#64)
- `docs/PLANO-FASE-ESTRUTURAL-RADAR.md` · `docs/MATRIZ-ADRS-FASE-ESTRUTURAL.md` · `docs/BACKLOG-FASE-ESTRUTURAL-RADAR.md` (#65)
- `docs/DECISOES-H1-H12-FASE-ESTRUTURAL.md` (#68)
- `docs/MOTION-AUDIT.md` · `docs/MOTION-MATRIX.md` · `docs/MOTION-IMPLEMENTATION-PLAN.md` (#67) — *base `main`*
- `docs/AUDITORIA-CONSISTENCIA-RADAR-E-MOTION.md` (este documento)

## Apêndice E — Decisões e ADRs

- **H1–H12:** aprovadas (opção A), versionadas no #68.
- **ADRs `accepted`:** 010, 009, 002, 001, 006, 008, 004.
- **ADRs `proposed`:** 003, 005, 007.
- **Migrations:** conceituais, aprovadas só conceitualmente, sem SQL, sem execução.
