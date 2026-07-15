# Validação Pós-Merge — Radar (P1)

> Rodada **somente leitura e diagnóstico**. Nenhuma correção foi implementada.
> Código não alterado · banco não alterado · nenhuma migration · nenhum deploy manual.
> A branch do PR #54 não foi reutilizada.

## 1. Ambiente

| Item | Valor |
|---|---|
| Tipo | Container efêmero de execução remota (Next.js 14.2.15 · Node · TypeScript strict) |
| Data da validação | 2026-07-15 |
| Supabase | **Sem `SUPABASE_SERVICE_ROLE_KEY` no ambiente** → painel opera em *modo mock / leitura vazia* |
| Beehiiv / demais chaves | Ausentes (modo mock) |
| Servidor HTTP ao vivo com dados reais | **Indisponível** (sem credenciais de serviço + sem `ADMIN_TOKEN`) |

**Consequência metodológica.** Não foi possível exercer as rotas contra o ledger real. Toda
verificação que depende de dado vivo (completude, frescor, KPIs reais, população de filas,
o registro 943 na base de produção, tempos de resposta, número de leituras, timeouts) está
classificada como **"Não confirmado"** — nunca chutada (regra inviolável 9). O que foi validado
é a camada **integrada e reproduzível**: build de produção, tipos, suíte de testes (que codifica
os invariantes de produto, inclusive o caso 943) e a lógica/rotas/estados no código mergeado.

## 2. Commit validado

| | |
|---|---|
| Alvo do briefing | `0c0cc23` — *docs(radar): complete final p1 verification* (último commit da branch do PR #54) |
| **HEAD íntegro validado** | **`854137a`** — *Merge pull request #54* (árvore integrada; contém `0c0cc23`) |
| Branch de trabalho | `claude/radar-post-merge-validation-mdd4ou` (branch designada; **não** é a branch do PR #54) |

Observação: o produto integrado vive no **merge commit `854137a`**, não em `0c0cc23` (que é a
ponta da feature branch). A validação foi feita sobre a árvore integrada.

## 3. Rotas

Todas as 9 rotas compilam no build de produção como dinâmicas (`ƒ`, server-rendered on demand):

| Rota (briefing) | Resolve? | Nota |
|---|---|---|
| `/admin/radar` | Sim | Visão geral |
| `/admin/radar?view=opportunities` | **Cai em "geral"** | Param canônico é `oportunidades` (pt-BR); EN não mapeia — exibe aviso "aba não encontrada" |
| `/admin/radar?view=reviews` | **Cai em "geral"** | Param canônico: `revisoes` |
| `/admin/radar?view=blocked` | **Cai em "geral"** | Param canônico: `bloqueios` |
| `/admin/radar?view=operations` | **Cai em "geral"** | Param canônico: `operacao` |
| `/admin/radar/[seriesKey]` | Sim | Detalhe de série |
| `/admin/forecast` | Sim | Motor legado (ver A1) |
| `/admin/predict` | Sim | Motor principal |
| `/admin/observability` | Sim | Calendário, previsão, valuations, edições |

Views canônicas (fonte única `resolveRadarView`, `lib/radar-operations.ts:13`):
`geral · oportunidades · revisoes · bloqueios · operacao`. View desconhecida → `geral` + banner
`role="status"` "Aba não encontrada" (`app/admin/(panel)/radar/page.tsx:53`). As URLs em inglês do
briefing **não** são canônicas (ver Finding F3).

## 4. Perfis (editor · analista · operador)

**Não há modelo de papéis no build.** `middleware.ts` protege `/admin/*` por um **único cookie de
sessão** (`tl_admin`), que é o hash SHA-256 de um **único `ADMIN_TOKEN`** (`lib/admin-auth.ts`).
Não existe `editor`, `analista` nem `operador` como identidades distintas: qualquer sessão
autenticada tem **acesso idêntico e total** a todas as telas. A validação "por perfil" pedida no
briefing **não é diferenciável** neste build (ver Finding F2). Os endpoints `/admin/sku` e
`/admin/collect` têm Basic Auth própria (`ADMIN_USER`/`ADMIN_PASSWORD`), fora do gate de cookie.

## 5. Resultados (checklist funcional)

Legenda: ✅ validado (código/build/testes) · ⚠️ ressalva · ⛔ Não confirmado (depende de dado vivo).

| # | Item | Estado | Evidência |
|---|---|---|---|
| 1 | Autenticação/autorização | ⚠️ | Cookie único; **sem autorização por papel** (F2). `middleware.ts` |
| 2 | Carregamento da visão geral | ✅ código / ⛔ dados | Branch `view==="geral"` compõe summary+kpis+filtros+tabela; população real não confirmada |
| 3 | Completude do dataset | ⛔ | `loaded.complete` vem do ledger vivo; aviso "leitura incompleta" existe (`observability`, `radar`) |
| 4 | Frescor | ⛔ | `assessForecastFile` sobre `content/forecast.json`; status real depende do artefato/deploy |
| 5 | KPIs | ✅ estrutura / ⛔ valores | `RadarKpis`; valores dependem do ledger |
| 6 | Filtros combinados | ✅ | `applyRadarFilters` coberto por `tests/radar-filters.test.mjs` |
| 7 | Query parameters | ✅ | `RADAR_FILTER_KEYS` + `resolveRadarView`; EN não mapeia (F3) |
| 8 | Filas | ✅ lógica / ⛔ conteúdo | `opportunities/review/blocked/…` puras e testadas (`radar-operations.test.mjs`) |
| 9 | Alertas | ✅ lógica | `RadarAlertsPanel`; ver M2 residual (F5, não confirmado) |
| 10 | Detalhe | ✅ | `tests/radar-detail.test.mjs` (12+ asserts, inclui 943) |
| 11 | Campanhas utilizadas | ✅ | `quality.used` auditável no detalhe |
| 12 | Campanhas excluídas | ✅ | `quality.excluded`; 943 → "possível erro de ano" |
| 13 | Duplicidades | ✅ | Par CONNECT_A/CONNECT_B marcado "provável duplicidade" (teste 13) |
| 14 | Erros temporais | ✅ | `suspect_year` / `dayDifference: 943` (teste 11/12) |
| 15 | Forecast fallback | ✅ | Fallback rotulado; sem probabilidade inventada quando só há Forecast (`selectPrimaryProbability → null`) |
| 16 | Predict principal | ✅ | Predict é motor principal quando `probabilities != null`; UMA probabilidade (P30/P60) |
| 17 | Estados vazios | ✅ | `RADAR_EMPTY` + `EmptyState`/`EmptyRow` |
| 18 | Estados de erro | ✅ | `app/admin/(panel)/radar/error.tsx` — estado padronizado, sem stack trace, `reset` |
| 19 | Links técnicos | ⚠️ | Diagnóstico → logs; ressalva M2 sobre `?cause=qualidade_temporal` (F5) |
| 20 | Responsividade | ✅ código | Sidebar `hidden md:flex` + `MobileNav`; alvos `min-h-[44px]`. Real não medida |
| 21 | Acessibilidade básica | ✅ código | `role="alert"`/`role="status"`, headers de tabela, `<details>` nativo, foco visível |

## 6. Caso crítico — `livelo → connectmiles` (943 dias)

Codificado e coberto por teste (`tests/forecast-engine.test.mjs`, `tests/radar-detail.test.mjs`).
Duas ondas: `2023-12-12` e `2026-07-12`.

| Sub-item | Estado | Evidência |
|---|---|---|
| Ano suspeito | ✅ | `temporal.status === "suspect_year"` → "possível erro de ano" |
| Duplicidade | ✅ | Par A/B marcado "provável duplicidade" no par |
| Ausência do intervalo 943 no Radar (como janela publicável) | ✅ | Intervalo **preservado** no histórico (`intervals: [943]`), mas **não vira manchete** (`editorialEligible === false`); não aparece em `radarItems` nem em `upcomingWindows` |
| Ausência de previsão futura (janela ~2028+/2029) | ✅ | `windowStart` cai anos à frente (`≥ 2028`) e é **suprimido** — não publicável |
| Status bloqueado | ✅ | Série bloqueada; `editorialBlockReasons > 0` e/ou `predict.blockReason` (1<3 amostras → Predict bloqueado, sem backtest confiável) |
| Localização via filtros e filas | ✅ | Aparece em fila `blocked` / revisão; excluída das oportunidades |

⛔ **Presença do registro 943 no ledger de produção** (e não só nas fixtures) → **Não confirmado**
(sem acesso ao banco vivo).

## 7. A1 — divergência do Forecast legado

**Persiste no commit `854137a`.** O caso 943 aparece de forma diferente entre `/admin/forecast`
e o Radar. Causa raiz confirmada por leitura direta:

- `/admin/forecast` lê **7 colunas** sem proveniência — `lib/admin-forecast.ts:180`
  (`id,tipo,origem,destino,percentual,vigencia_inicio,vigencia_fim`).
- `/admin/predict` idem — `lib/admin-predict.ts:38`.
- **Radar** lê **13 colunas** incluindo proveniência (`first_seen,last_seen,observed_at,created_at,source_url,origin`)
  — `lib/admin-radar.ts:25`. Só assim a contenção temporal C0.2 (`suspect_year` do 943) dispara.

**Avaliação de risco:** a série 943 é **bloqueada em ambas as telas** (não vira previsão publicável
em nenhuma). A divergência é de *apresentação/diagnóstico*, não de veredito. Já é **dívida
formalmente aceita pós-P1** (`docs/REVISAO-HUMANA-P1-RADAR.md` §8, id A1). O Radar é a superfície
correta; a paridade de colunas / unificação das telas é trabalho da fase estrutural.

## 8. Desempenho

Sem instância viva com dados, os tempos de runtime (carregamento inicial, filtros, detalhe,
tamanho de resposta, número de leituras, timeouts, erros intermitentes) são **Não confirmados**.
O único sinal mensurável é o custo estático do bundle (build de produção):

| Superfície | Página | First Load JS |
|---|---|---|
| `/admin/radar` | 159 B | 87.3 kB |
| `/admin/radar/[seriesKey]` | 159 B | 87.3 kB |
| `/admin/observability` | 159 B | 87.3 kB |
| `/admin/predict` | 1.3 kB | 88.4 kB |
| Shared chunks (todas) | — | 87.1 kB |
| Middleware | — | 27 kB |

Arquitetura favorável a desempenho: `loadRadar` faz **uma** leitura do ledger e deriva tudo em
runtime (sem segunda leitura/persistência) — `lib/admin-radar.ts`. Nenhuma otimização foi feita
nesta rodada (fora de escopo).

## 9. Acessibilidade (avaliação de código)

- Estado de erro do Radar: `role="alert"`, sem stack trace na UI, botão `Tentar novamente`, alvos `min-h-[44px]`.
- View inválida: aviso `role="status"`.
- Tabelas com `<Th>`/`<Td>`; `<details>` nativo; foco visível herdado do tema (anel blue-600).
- Ressalva histórica M3 (headings de seção) marcada como aplicada na onda P1-E (`docs/IMPLEMENTACAO-P1E-POLISH-RADAR.md`).
- Validação real com leitor de tela + dados populados: **não executada** (sem instância viva).

## 10. Responsividade (avaliação de código)

- Sidebar desktop `hidden md:flex` + `MobileNav` para telas pequenas.
- Larguras truncadas (`truncate`, `w-48 flex-none`) e barras fluidas por `%` no observability.
- Medição real em breakpoints: **não executada**.

## 11. Findings

| ID | Tela | Perfil | Evidência | Severidade | Impacto | Recomendação |
|---|---|---|---|---|---|---|
| F1 | `/admin/forecast` vs `/admin/radar` | (n/a — sem papéis) | `admin-forecast.ts:180` / `admin-predict.ts:38` (7 col) vs `admin-radar.ts:25` (13 col) | **Alto** | Caso 943 aparece diferente entre telas; diagnóstico temporal só no Radar | Assumir A1 como dívida (Radar é correto) e planejar paridade de colunas / unificação na fase estrutural. Não é bloqueador: 943 é bloqueada em ambas |
| F2 | `/admin/*` (auth) | todos | `middleware.ts` + `lib/admin-auth.ts` (token único) | **Médio** | Não há `editor/analista/operador`; toda sessão tem acesso total; validação por perfil não é diferenciável | Decidir se RBAC entra na fase estrutural; enquanto não, documentar que o painel é single-role |
| F3 | `/admin/radar?view=` | todos | `lib/radar-operations.ts:13`; banner em `radar/page.tsx:53` | **Informativo** | URLs EN do briefing (`opportunities/reviews/blocked/operations`) caem em "geral" com aviso | Usar params canônicos pt-BR **ou** aceitar aliases EN. M1 (aviso) já resolvido em P1-E |
| F4 | Ambiente de validação | — | `.env` sem `SUPABASE_SERVICE_ROLE_KEY`/`ADMIN_TOKEN` | **Bloqueador (de validação)** | Impossível validar dado vivo, filas populadas, KPIs reais, desempenho e o 943 em produção | Prover ambiente integrado com credenciais de leitura (staging) para a rodada 2 |
| F5 | `/admin/radar?view=operacao` | (operador) | `radar-operations.ts` (link `?cause=qualidade_temporal`) — M2 do review anterior | **Baixo (a verificar)** | Link de diagnóstico de placeholders pode não isolar placeholders | Reverificar em ambiente vivo; marcada como aplicada em P1-E mas não confirmada aqui |

## 12. Bloqueadores

- **Produto:** nenhum bloqueador de produto encontrado na validação estática/integrada
  (build ✅, typecheck ✅, 225/225 testes ✅, caso 943 contido, A1 é dívida aceita).
- **Validação:** **F4** é bloqueador *da própria rodada de validação* — a verificação funcional
  ao vivo (dados, filas, desempenho, 943 em produção) não pôde ser executada por falta de
  ambiente integrado com credenciais.

## 13. Recomendação

O produto integrado (`854137a`) está **coeso e verde** na camada reproduzível: compila, tipa,
passa toda a suíte e honra os invariantes de produto (943 contido, fallback rotulado, Predict
principal, estados vazios/erro padronizados). **Nenhuma correção de código é necessária nesta
rodada.**

Porém a validação **funcional ao vivo permanece incompleta** por F4. Recomenda-se **uma segunda
rodada em ambiente integrado com credenciais de leitura (staging)** para fechar os itens ⛔ antes
de declarar o P1 validado ponta a ponta. A1 e F2 são **decisões de produto** para a fase estrutural,
não defeitos a corrigir agora.

## 14. Critérios para iniciar a fase estrutural

1. Segunda rodada de validação executada em ambiente com dados vivos, fechando todos os itens ⛔
   (dataset, frescor, KPIs, filas, 943 em produção, desempenho).
2. Decisão do coordenador sobre **A1** (assumir dívida + agendar paridade de colunas / unificação).
3. Decisão sobre **F2/RBAC** (o painel entra na fase estrutural como single-role ou ganha papéis?).
4. Confirmação de que `content/forecast.json` está fresco no ambiente-alvo (evita fallback silencioso).
5. Nenhum bloqueador de produto aberto (mantido: hoje, zero).

---

## Handoff obrigatório

```
HANDOFF PARA RADAR PROGRAM COORDINATOR

- Chat: Radar Post-Merge Validation
- Estado: Rodada 1 concluída (somente leitura/diagnóstico). Validação funcional ao vivo INCOMPLETA (bloqueada por ambiente).
- Ambiente: Container efêmero, sem credenciais Supabase de serviço → painel em modo mock/leitura vazia.
- Commit validado: 854137a (merge do PR #54; contém o alvo 0c0cc23).
- Branch: claude/radar-post-merge-validation-mdd4ou (branch designada; PR #54 não reutilizado).
- PR: documental (draft) — ver link no chat.
- Rotas validadas: 9/9 compilam e resolvem (código). Params de view EN caem em "geral" c/ aviso (canônico = pt-BR).
- Findings bloqueadores: nenhum de PRODUTO. F4 é bloqueador da VALIDAÇÃO (falta ambiente c/ dados).
- Findings altos: F1 (A1 — divergência de colunas forecast/predict vs radar; dívida aceita).
- Findings médios: F2 (sem RBAC; painel single-role; perfis não diferenciáveis).
- Findings baixos: F5 (M2 residual — link de diagnóstico de placeholders; a reverificar ao vivo).
- Caso 943: CONTIDO — suspect_year, duplicidade marcada, bloqueado, janela futura suprimida, localizável em filas. Presença no ledger de produção: NÃO CONFIRMADO.
- A1: PERSISTE em 854137a (forecast/predict leem 7 col sem proveniência; radar lê 13). Risco baixo — 943 bloqueada em ambas as telas. Dívida pós-P1 aceita.
- Desempenho: tempos de runtime NÃO CONFIRMADOS (sem instância viva). Bundle: radar 159 B + ~87.3 kB First Load.
- Código alterado: NÃO.
- Banco alterado: NÃO.
- Recomendação: rodar 2ª validação em staging com dados vivos; decidir A1 e RBAC; sem correção de código nesta rodada.
- Bloqueios para fase estrutural: (1) fechar itens ao vivo; (2) decisão sobre A1; (3) decisão sobre RBAC/F2; (4) frescor do forecast.json.
```

> Não implementar correções até autorização explícita do coordenador.

---

# Rodada 2 — tentativa de fechar F4 e F5 (2026-07-15)

> Somente leitura. Não produção. Sem SQL. Sem alteração de código, migration, ADR.
> S1–S7 não iniciados. Base do PR inalterada. Produção não consultada.
> A Rodada 1 (acima) permanece como referência.

## R2.1 — Disponibilidade do ambiente com dados vivos

Objetivo: rodar a validação funcional em ambiente **somente leitura, não produção, com dados
vivos**, para fechar F4 (dado vivo) e F5 (resíduo M2 ao vivo).

Sondagem executada (sem tocar produção, sem SQL):

| Verificação | Resultado |
|---|---|
| Arquivos `.env` / `.env.local` / `.env.staging` no container | **Ausentes** |
| `SUPABASE_URL` / `SUPABASE_ANON_KEY` no processo | Vazias |
| `SUPABASE_SERVICE_KEY` / `SUPABASE_SERVICE_ROLE_KEY` | Vazias |
| `ADMIN_TOKEN` / `ADMIN_USER` / `ADMIN_PASSWORD` | Vazias |
| Qualquer var `supabase|staging|service_role` | Nenhuma |

**Conclusão.** Não há credenciais de um ambiente não-produção com dados vivos neste container.
Sem `SERVICE_ROLE_KEY`, o painel só roda em *modo mock / leitura vazia* — nenhuma fila é populada,
nenhum KPI real, nenhum detalhe ao vivo, nenhum tempo de resposta mensurável contra o ledger.

Caminhos alternativos foram **descartados por violarem as restrições da tarefa**, não por
indisponibilidade técnica:
- Supabase MCP `execute_sql` (mesmo `SELECT`) → proibido por **"não escrever SQL"**.
- Consultar o projeto `qjqnqcsdnpvvmyzkavoq` (produção) → proibido por **"não consultar produção"**.
- `create_branch` (preview DB) → mutação de infraestrutura + custo; fora de "somente leitura" e não
  carregaria o dado vivo de produção mesmo assim.

Portanto **nenhum caminho lícito** dentro das restrições permite a validação funcional ao vivo aqui.

## R2.2 — Validações esperadas (estado nesta rodada)

| Validação | Estado | Motivo |
|---|---|---|
| Completude | ⛔ Não confirmado | Sem ledger vivo |
| Frescor | ⛔ Não confirmado | Sem artefato/ambiente-alvo |
| KPIs | ⛔ Não confirmado | Sem dados |
| Filas populadas | ⛔ Não confirmado | Modo mock = filas vazias |
| Detalhe ao vivo | ⛔ Não confirmado | Sem série real |
| Comportamento do ledger real | ⛔ Não confirmado | Sem acesso lícito |
| Tempos de resposta | ⛔ Não confirmado | Sem instância viva |
| Número de leituras | ⛔ Não confirmado | Sem instância viva |
| Timeouts | ⛔ Não confirmado | Sem instância viva |
| Consistência com o Radar em dado vivo | ⛔ Não confirmado | Sem dados |
| Reprodução do resíduo M2 (ao vivo) | ⛔ Não confirmado | Sem dados (ver R2.3 para leitura de código) |

## R2.3 — F5 / M2: determinação em código (evidência complementar, não é a confirmação ao vivo)

Como a repro ao vivo é impossível aqui, foi feita uma leitura direta do código mergeado (`854137a`)
— pura, sem violar restrições — para caracterizar o resíduo M2:

- Alerta de placeholders aponta o diagnóstico para **`?cause=placeholder`** — `lib/radar-operations.ts:140`
  (o M2 relatava `?cause=qualidade_temporal`, que isolava a coisa errada).
- `seriesCauses(s)` inclui `"placeholder"` sse `s.quality.placeholder > 0` — `lib/radar-filters.ts:84`.
- Filtro: `if (f.cause && !seriesCauses(s).includes(f.cause)) return false` — `lib/radar-filters.ts:152`.
  Logo `?cause=placeholder` **isola corretamente** as séries com placeholder. `qualidade_temporal`
  é uma causa **separada** (linha 83), e o alerta temporal aponta para `?quality=bloqueada` (`:134`).
- Comportamento coberto por `tests/radar-filters.test.mjs` (suíte 225/225 verde).

**Leitura de código: M2 aparenta estar resolvido** no merge — o link do alerta de placeholders isola
placeholders. Isso **reduz o risco** de F5, mas **não é** a confirmação ao vivo que o gate 5 exige.
Por instrução da tarefa, sem ambiente vivo, F5 permanece formalmente **not_confirmed**.

## R2.4 — Estados finais

| Item | Estado final (Rodada 2) |
|---|---|
| **F4** | **blocked** — sem ambiente não-produção com dados vivos; validação funcional ao vivo não executável dentro das restrições |
| **F5** | **not_confirmed** — repro ao vivo impossível; leitura de código sugere M2 resolvido (evidência complementar, não confirmatória) |
| **Gate 4** | **fechado no nível conceitual** (inalterado; sem SQL, sem execução) |
| **Gate 5** | **permanece aberto** — exige confirmação ao vivo, não obtida |
| **Structural Implementation (S1–S7)** | **blocked** — depende de gates 3, 4 e 5; gate 5 aberto |

## R2.5 — Evidência de que nada foi alterado em produção

- Produção **não consultada**: nenhuma chamada a banco de produção, nenhum `execute_sql`, nenhum
  acesso ao projeto `qjqnqcsdnpvvmyzkavoq`. Ações desta rodada: `ls`/`printenv` locais e leitura de
  arquivos do repositório.
- **Sem SQL** executado. **Sem migration.** **Sem código alterado.** **Sem ADR promovido.**
- **S1–S7 não iniciados.** **Base do PR inalterada** (head recebe apenas este adendo documental).
- Único efeito no repositório: este adendo em `docs/VALIDACAO-POS-MERGE-RADAR.md`.

## R2.6 — Para efetivamente fechar F4/F5 e o gate 5 (pré-requisito da próxima tentativa)

Prover um ambiente **staging read-only com dados vivos** e injetar no container, como variáveis de
ambiente (nunca produção):
`SUPABASE_URL` (staging) · `SUPABASE_SERVICE_ROLE_KEY` (staging, leitura) · `ADMIN_TOKEN`.
Com isso o painel sai do modo mock e a Rodada 3 pode medir completude, frescor, KPIs, filas,
detalhe, tempos/leituras/timeouts e reproduzir M2 ao vivo — fechando F4, F5 e o gate 5.
