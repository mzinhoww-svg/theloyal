# Decisões de Produto e Roadmap — Radar Preditivo de Campanhas

> Etapa de **decisão e priorização**. Fecha o Product Design Review
> (`PRODUCT-DESIGN-REVIEW-RADAR.md`) em decisões de produto e num plano
> executável. **Não implementa código, não altera banco/migration/dados/motores,
> não roda backfill, não gera snapshot de produção, não publica Digest/Beehiiv,
> não altera ADRs, não abre PR.** Trabalha sobre o estado atual do PR #54.
>
> **Regra de preservação (briefing §2):** toda a fundação C0/C0.2 permanece e é
> **usada**, nunca duplicada. Fonte única já estabelecida
> (`RECONCILIACAO-FASE-C0.md`): `campaign-quality` → `buildForecast`/`buildPredict`
> (só `eligibleRows`) → `editorialGate` → `forecast-freshness` → `radar-consistency`.
> Nenhuma decisão aqui cria segunda fonte de verdade.
>
> **Convenção:** cada decisão traz **Recomendação**, **Alternativas** e o selo
> **[APROVAÇÃO HUMANA]** quando depende de você (consolidado em §25). ADRs citados
> são `proposed` — as decisões abaixo são o insumo para promovê-los, não os alteram.

---

## 1. Resumo executivo

O Radar já tem a fundação: dois motores, camada de qualidade a montante, gates
editoriais, frescor, dataset completo, rastreabilidade e testes. O que falta é
**decisão fechada e experiência**. Este documento fecha 18 decisões de produto,
quase todas com recomendação direta e apenas **9** exigindo sua aprovação.

Decisões-âncora:
- **Radar é o produto**; Forecast e Predict são **motores internos** (abas
  técnicas), nunca produtos concorrentes.
- **Predict é o motor canônico** quando `ready`/`ready_with_warnings`; **Forecast**
  é baseline sempre calculado + **fallback rotulado**; ambos bloqueados → **Não
  confirmado**.
- **Um único `Radar Result`** por série alimenta editor, analista, operador e
  leitor — consolidando o que os motores já produzem.
- **Nada vai do motor ao Digest sem Editorial Intelligence** (qualidade →
  reconciliação → decisão editorial); **bloqueios críticos vencem qualquer score**.
- O **MVP não exige migration**: enriquecer a saída, consolidar a interface, levar
  o Predict ao leitor via reconciliação e ativar o que já é calculado.

---

## 2. Decisões recomendadas — matriz (briefing §4)

| # | Decisão | Alternativas | Recomendação | Justificativa | Impacto | Risco | Reversibilidade | Aprovação humana |
|---|---|---|---|---|---|---|---|---|
| D1 | Produto canônico | (a) Radar único; (b) manter Forecast/Predict separados | **Radar único, motores internos** | Fim da divergência de 3 telas; decisão editorial passa a existir | Alto | Re-IA confunde quem conhece as telas | Alta (só navegação) | Não (recomendado) |
| D2 | Motor canônico | (a) Predict>Forecast; (b) Forecast; (c) só um | **Predict canônico quando ready; Forecast baseline+fallback** | Predict é o mais defensável (hazard+backtest); Forecast cobre lacuna | Alto | Erro de calibração amplificado no leitor | Média | **Sim** (ADR-008) |
| D3 | Resultado canônico | (a) 1 objeto Radar Result; (b) saídas separadas | **1 `Radar Result` por série** | Uma verdade por rota; base de toda superfície | Alto | Payload maior | Alta | Não |
| D4 | Papel do Forecast | baseline / fallback / comparação / concorrente | **baseline + fallback rotulado + comparação; nunca concorrente** | Preserva o motor sem duplicar verdade | Médio | — | Alta | Não |
| D5 | Papel do Predict | principal / auxiliar | **principal quando ready; motor do leitor quando aprovado** | Leva o valor pronto ao leitor | Alto | Exige gate humano até calibrar | Média | **Sim** (expor ao leitor) |
| D6 | Reconciliação | regra fixa / caso a caso | **regra fixa Predict>Forecast>Não confirmado + flag de divergência** | Determinística e auditável; sem fundir motor | Alto | `d_max` mal calibrado | Média | **Sim** (`d_max`) |
| D7 | Confiança | 1 escala / 3 escalas | **3 escalas separadas (modelo, editorial, dado)** | Não misturar CV com aprovação nem com qualidade | Médio | Complexidade de rótulo | Alta | Não |
| D8 | Editorial Intelligence | opcional / obrigatória | **obrigatória; bloqueio crítico vence score** | Nada cru do motor ao Digest | Alto | Passo a mais no fluxo | Média | Não |
| D9 | Editorial Score | não / interno / ao leitor | **interno (editor/analista), nunca ao leitor, nunca auto-promove** | Prioriza pauta sem virar "probabilidade" | Médio | Confundir com chance | Alta | **Sim** (existência) |
| D10 | Aprovação editorial | estados mínimos / completos | **7 estados; overrides atuais reaproveitados** | Governança sem sistema novo | Alto | TTL mal definido | Média | **Sim** (TTLs) |
| D11 | Daily | critérios abertos / fechados | **fechados: fresco+aprovado+P30≥media+horizonte 7–30d, máx 3–5** | Alerta curto e honesto | Médio | Falso silêncio | Alta | Parcial (limiares) |
| D12 | Weekly | idem | **horizonte ≤90d, ranking por score, 5–10 séries, consistente c/ Daily** | Radar de médio prazo | Médio | Divergir do Daily | Alta | Parcial |
| D13 | Pro | MVP / completo | **MVP: P completa+usadas/excluídas+backtest+metodologia; resto depois** | Valor imediato sem outcomes | Médio | Escopo inflar | Alta | Não |
| D14 | Leitor | muito / pouco | **chance+faixa+bônus+confiança+frescor+amostra+explicação+disclaimer+invalidadores** | Honestidade calibrada (regras 3/9/10) | Alto | Parecer "menos preciso" | Alta | Não |
| D15 | Rota × cluster | rota só / cluster fallback | **rota quando suficiente; cluster fallback rotulado; nunca silencioso** | Não esconder falta de dado (ADR-003) | Médio | Cluster mascarar rota | Média | **Sim** (`k`/limiar) |
| D16 | Hierarquia de bloqueios | ad hoc / fixa | **11 níveis fixos; críticos nunca overridáveis** | Precedência determinística | Alto | — | Alta | Não |
| D17 | Frescor/expiração | sem TTL / TTLs | **cálculo 24h; aprovação ~7d; Daily=dia; Weekly=semana** | Nunca stale silencioso (princípio 13) | Médio | TTL curto = recalcular muito | Alta | **Sim** (TTL aprovação) |
| D18 | "O que mudou" | ausente / diff de snapshot | **13 eventos por diff de snapshots** | Editor vê o delta sem infra nova | Médio | Ruído se granular demais | Alta | Não |

---

## 3. Produto canônico (D1)

**Recomendação:** o produto final é **Radar**, uma área única. **Forecast e
Predict são motores internos**, acessíveis em **abas técnicas** (Análise), nunca
apresentados como produtos concorrentes. O leitor nunca vê os nomes dos motores;
o operador os vê apenas como metadado de proveniência ("motor selecionado").

**Alternativas:** (a) manter Forecast e Predict como telas independentes — rejeitada:
gera as três verdades divergentes de hoje; (b) fundir os motores em código —
**proibido** nesta fase e desnecessário (a unificação é de produto/superfície, não
de motor). **Sem aprovação humana** — é a recomendação central do PDR.

---

## 4. Papel final do Forecast (D4)

**Recomendação — quatro papéis, nenhum editorial concorrente:**
- **Baseline obrigatório:** sempre calculado, para comparação com o Predict.
- **Fallback rotulado:** quando Predict está bloqueado mas o Forecast é
  `editorialEligible`, o resultado sai como Forecast com rótulo **"cadência
  aproximada"** (nunca manchete sozinho — ADR-008).
- **Explicação de cadência:** a série de ondas/intervalos do Forecast é a base do
  "quantas campanhas sustentam" e do histórico exibido ao analista.
- **Instrumento de comparação:** lado a lado com o Predict na aba Análise.
- **Nunca** fonte editorial concorrente: não publica por conta própria quando o
  Predict está apto. Sem aprovação humana (deriva de D2).

---

## 5. Papel final do Predict (D5)

**Recomendação:** **motor principal quando `readiness ∈ {ready, ready_with_warnings}`**.
Entrega ao produto: **probabilidade por horizonte** (P7–P180), **janela**
(central + faixa por quantis), **bônus provável** (candidatos ponderados por
recência), **backtest** (`windowHitRate`, `medianDateErrorDays`, `bonusAccuracy5pp`),
**explicabilidade** (`explanation` em linguagem de negócio) e é **o motor que o
leitor vê quando aprovado**. Não alterar a matemática. **[APROVAÇÃO HUMANA]** só
para a decisão de expor o Predict ao leitor (ADR-008).

---

## 6. Resultado canônico — contrato de produto do `Radar Result` (D3)

Um único objeto conceitual por série, consumido por todas as superfícies. **Não é
schema técnico** — é o contrato de produto; cada campo já tem origem no código.

| Campo do `Radar Result` | Significado (produto) | Origem já existente |
|---|---|---|
| `serie` | rota ou cluster identificado | `seriesKey` / `route` |
| `tipoSerie` | `rota` \| `cluster` | `scope` + `resolved_from` (novo rótulo) |
| `dataReferencia` | "as of" do cálculo | `asOf` / `generatedFor` |
| `motorSelecionado` | Predict \| Forecast \| nenhum | reconciliação (regra, D6) |
| `motivoSelecao` | por que este motor | readiness + gate |
| `janela` | início / centro / fim (faixa) | Predict `windowStart..End` / Forecast |
| `probabilidades` | P7…P180 (null = não exposto) | Predict `probabilities` |
| `bonus` | esperado (nullable) + faixa + candidatos | Predict `bonusCandidates` / `typicalPercent` |
| `confiancaModelo` | alta/média/baixa/insuficiente | `confidence` (motor) |
| `elegibilidadeEditorial` | publicável? | `editorialEligible` |
| `qualidadeDados` | totais/elegíveis/excluídas/outliers | `.quality.counters` |
| `frescor` | fresh/stale/… + idade | `assessForecastArtifact` |
| `warnings` | anomalias legíveis | `warnings` + `maxIntervalDays` |
| `bloqueios` | motivos de bloqueio | `editorialBlockReason` + `.quality` |
| `campanhasUsadas` | ondas que formaram a série | `windows`/`intervals` + `eligibleRows` |
| `campanhasExcluidas` | quais e por quê | `.quality.excluded[]` |
| `mudancaDesdeAnterior` | delta vs execução anterior | diff de snapshots (D18) |
| `estadoEditorial` | draft…blocked | aprovação (D10) |
| `expiracao` | quando deixa de valer | TTL (D17) |

Regra: o `Radar Result` **enriquece** o contrato editorial atual (campos aditivos),
não cria artefato paralelo — é a Substituição A do PDR (justificada em 7 pontos).

---

## 7. Reconciliação (D2, D6)

**Motor canônico e regra fixa, determinística, auditável** — escolhe *qual
resultado* a superfície mostra; **não funde código de motor**.

| Situação | Decisão |
|---|---|
| Predict `ready` + Forecast disponível | **Predict**; Forecast guardado para comparação (`fallback_used=false`) |
| Predict `ready_with_warnings` | **Predict + revisão editorial** obrigatória |
| Predict bloqueado + Forecast `editorialEligible` | **Forecast (fallback rotulado "cadência aproximada")** |
| Ambos bloqueados | **Não confirmado** (nada publica) |
| Resultados semelhantes (Δcentro ≤ `d_max`) | Predict; concordância vira sinal de confiança |
| Resultados divergentes (Δcentro > `d_max` **ou** salto de confiança alta↔baixa) | **flag `divergence` + revisão obrigatória**; guarda o resultado perdedor |
| Confiança do modelo baixa | publica só com aprovação + rótulo; nunca manchete "alta" |
| `datasetComplete=false` | **bloqueia distribuição** (nem pin ignora) — precede a reconciliação |
| Dado stale | **bloqueia** — precede a reconciliação |
| Qualidade temporal crítica (`suspect_year`) | registro já **fora da série** (C0.2); se some a série, → Não confirmado |

`d_max` recomendado inicial: **30 dias** **[APROVAÇÃO HUMANA]** (ADR-008). O usuário
entende a escolha por **um** resultado + o rótulo "motor: Predict/Forecast" como
metadado de proveniência — nunca duas janelas concorrentes.

---

## 8. Qualidade e bloqueios (D7, D15, D16)

### 8.1 Três escalas de confiança (D7) — nunca misturadas
- **Confiança do modelo:** `alta/média/baixa/insuficiente`, de amostra+CV+backtest
  (já calculada nos motores). Uso: analista e cálculo interno.
- **Confiança editorial:** estado de **aprovação humana** (D10). Uso: editor e a
  síntese ao leitor (Vale agir / Vale olhar / Só casos específicos / Não confirmado).
- **Qualidade dos dados:** de `.quality` (elegíveis, excluídas por classe, outliers,
  completude). Uso: operador e o selo "dado verificado".

O **leitor vê uma síntese editorial**; o **analista vê as três**. Rótulos ao leitor
usam o vocabulário TL Score já canônico; rótulos internos usam os estados dos motores.

### 8.2 Rota × cluster (D15)
- **Rota** exibida quando tem ondas/cobertura suficientes.
- **Cluster** usado como **fallback rotulado** ("previsão do programa, não
  específica de {origem}") quando a rota é esparsa mas o cluster tem amostra.
- Cluster **nunca substitui silenciosamente** a rota; a agregação é sempre
  comunicada. `k`/limiar de shrinkage **[APROVAÇÃO HUMANA]** (ADR-003).

### 8.3 Hierarquia final de bloqueios (D16)
Precedência (o primeiro que dispara vence) e classe de efeito:

| # | Bloqueio | Impede cálculo? | Cálculo interno? | Impede publicação? | Exige revisão? | Override? |
|---|---|---|---|---|---|---|
| 1 | Dataset incompleto | não | sim | **sim** | sim | **nunca** |
| 2 | Qualidade temporal crítica (`suspect_year`) | **sim** (sai da série) | — | sim | sim | **nunca** |
| 3 | Duplicidade provável crítica | **sim** (intervalo não forma) | — | sim | sim | **nunca** |
| 4 | Programa inválido (placeholder) | **sim** | — | sim | não | **nunca** |
| 5 | Amostra insuficiente (<5 ondas edit.) | não | sim | sim | não | **sim** (nota) |
| 6 | Motor não pronto (Predict <6 / readiness) | não | sim | sim (usa fallback) | não | não |
| 7 | Intervalo extremo (≥540d) | não | sim | sim | sim | **sim** (nota) |
| 8 | Horizonte excessivo (>180d; >365 crítico) | não | sim | sim | sim | **sim** (nota) |
| 9 | Artefato stale | não | sim | **sim** | sim | **nunca** |
| 10 | Revisão editorial pendente | não | sim | sim | sim | n/a (é a revisão) |
| 11 | Expiração | não | sim | **sim** | sim | **nunca** (recalcular) |

Overrides **existentes** (pin/mute/confidence **com nota**) cobrem 5, 7 e 8. Os
níveis 1, 2, 3, 4, 9, 11 **nunca** aceitam override — regra dura preservada do C0.

---

## 9. Editorial Intelligence (D8) e "o que mudou" (D18)

**Camada obrigatória.** Nenhum resultado vai do motor direto ao Digest. Todo
resultado passa por: **qualidade** (C0.2) → **reconciliação** (D6) → **decisão
editorial** (D10). **Bloqueios críticos (§8.3 níveis 1–4, 9, 11) vencem qualquer
score.** A "inteligência" **não é IA nova** — é a composição de sinais já
calculados (`warnings`, `editorialBlockReason`, deltas, contadores).

**"O que mudou desde a execução anterior"** — 13 eventos mínimos, todos derivados
do **diff de dois snapshots** (que já guardam o necessário): campanha válida
adicionada; campanha excluída; duplicidade detectada; qualidade alterada; Forecast
alterado; Predict alterado; motor canônico alterado; probabilidade alterada;
janela alterada; confiança alterada; aprovação alterada; publicação realizada;
previsão expirada. Uso: coluna "o que mudou" na fila do editor e no Weekly.

---

## 10. Editorial Score (D9)

**Recomendação: implementar como auxílio interno de priorização — não é
probabilidade, não vai ao leitor, não promove pauta automaticamente.**
- **Finalidade:** ordenar a fila do editor ("o que merece atenção hoje").
- **Dimensões que compõem:** iminência da janela, confiança do modelo, magnitude
  do bônus vs típico, relevância editorial do programa, "o que mudou".
- **Dimensões que bloqueiam (não entram no score — gatam antes):** os bloqueios
  críticos de §8.3. Um score alto **nunca** supera um bloqueio.
- **Quem vê:** editor e analista. **Leitor: não.**
- **Promoção automática:** **não** — pode marcar uma pauta como "sugerida", a
  decisão é sempre humana (semi-automático).
**[APROVAÇÃO HUMANA]** para existência e pesos (não confundir com probabilidade).

---

## 11. Aprovação editorial (D10)

**Estados:** `draft` → `review_required` → `approved` / `rejected`; `approved` →
`expired` / `superseded`; qualquer → `blocked` (por bloqueio crítico).

- **Quem aprova:** editor.
- **Expiração da aprovação:** TTL recomendado **~7 dias** e **re-expira** se o dado
  subjacente mudar materialmente (nova onda, exclusão, troca de motor). **[APROVAÇÃO HUMANA]** (ADR-006).
- **Exige justificativa (nota):** override de amostra/intervalo/horizonte/duplicidade
  possível; promover uma série `review_required`.
- **Nunca sobrescrevível:** dataset incompleto, stale, `suspect_year` crítico,
  duplicidade provável crítica, dataset inválido, expiração.
- **Overrides existentes reaproveitados:** o mecanismo atual (`forecast_overrides`
  pin/mute/confidence com nota, e `editorialOverridden`) **é** a base da aprovação —
  nenhum sistema novo, nenhuma segunda fonte.

---

## 12. Daily (D11) — critérios fechados de entrada

Fresco (artefato `fresh`); **horizonte 7–30 dias** (base `horizonDaily`);
**probabilidade** P30 ≥ limiar de confiança **média**; **elegibilidade** editorial;
**confiança** ≥ média; **mudança relevante** desde ontem (destaca, não obriga);
**aprovado**; **máximo 3–5 itens**; **linguagem** curta de leitor; **ausência de
oportunidades** → texto honesto **"sem janelas relevantes hoje"** (nunca inventar).
Limiares exatos **[APROVAÇÃO HUMANA parcial]**.

---

## 13. Weekly (D12) — critérios fechados

**Horizonte ≤90 dias**; **ranking por Editorial Score**; **5–10 séries**;
**mudanças da semana** (deltas de §9); **melhora/queda de confiança** sinalizada;
**consistência com o Daily** garantida por `radar-consistency` (mesma fonte
reconciliada — não pode contradizer); **explicação** por série; **aprovação**
obrigatória; **expiração** ao fim da semana. Séries bloqueadas relevantes aparecem
como "em observação", não como previsão.

---

## 14. Pro (D13) — escopo

**MVP:** probabilidades completas (P7–P180), campanhas **usadas** e **excluídas**
(com motivo), **backtest** por série, **metodologia**. **Visão futura (não MVP):**
comparativos entre programas, timeline, **histórico de previsões** e **outcomes**
(previsto × realizado — exige `prediction_outcome`, estrutural). Sem aprovação
humana para o MVP.

---

## 15. Admin

Consolidar `/admin/forecast` + `/admin/predict` + a metade de previsão de
`/admin/observability` em **um Radar** com abas: **Editorial** (fila de aprovação),
**Análise** (ficha da série, comparação de motores, backtest), **Qualidade**
(evolução do `QualityPanel`), **Operação** (saúde), **Configuração** (parâmetros,
leitura). `campanhas`, `digests`, `backfill`, `jobs`, `logs`, `noticias`,
`shopping-vpm` e o calendário/VPM da Observabilidade permanecem. É a Substituição B
do PDR (justificada em 7 pontos). Nenhuma capacidade removida.

---

## 16. Leitor (D14)

**Vê:** probabilidade (chance em 30d; P60/P90 no Pro), **faixa de datas** (nunca
ponto), **bônus provável** (faixa, não o máximo), **confiança editorial**,
**frescor** ("atualizado há X"), **tamanho da amostra** ("baseado em N campanhas"),
**explicação** curta, **disclaimer** obrigatório (CLAUDE.md regra 10) e **o que
pode invalidar**. **Não vê:** CV bruto, hazard, `duplicate score`, termos internos,
detalhes de implementação. Sem aprovação humana (segue as regras invioláveis).

---

## 17. Jornadas alvo (briefing §5)

- **Editor:** abre o Radar → vê mudanças e oportunidades (fila por Editorial Score,
  com "o que mudou" e risco) → abre a série → entende previsão/qualidade/risco →
  compara motores só se preciso → aprova/rejeita/pede revisão → promove a
  Daily/Weekly → acompanha expiração.
- **Analista:** abre a série → audita campanhas usadas × excluídas (motivo, data
  candidata, proveniência, flags, duplicidade) → verifica Forecast, Predict e a
  reconciliação → analisa backtest → explica a mudança → registra conclusão (nota).
- **Operador:** abre a saúde do Radar → identifica dataset incompleto/stale/bloqueios
  → localiza séries afetadas → aciona reprocessamento/revisão (fila
  `requiresHumanReview`/`requiresReprocessing`) → confirma recuperação.
- **Leitor:** vê uma previsão **aprovada** → entende janela/chance/bônus/confiança →
  entende atualização e limites → acompanha mudanças futuras (Weekly).

---

## 18. MVP versus visão futura (briefing §6)

### MVP Radar (sem migration)
- **Valor:** o produto passa a existir e o Predict chega ao leitor.
- **Funcionalidades:** `Radar Result` enriquecido no artefato; bloco do leitor
  honesto (chance/faixa/bônus/confiança/frescor/amostra/invalidadores/disclaimer);
  admin consolidado em abas; motivos de exclusão e "o que mudou" visíveis.
- **Reusa:** Forecast, Predict, `campaign-quality`, `editorialGate`, freshness,
  `datasetComplete`, `radar-consistency`, `QualityPanel`, overrides, snapshots.
- **Dependências:** regenerar o artefato pelo pipeline (não à mão); reconciliação
  como regra.
- **Decisões fechadas:** D1, D3, D4, D5, D7, D8, D14, D16, D18.
- **Decisões abertas:** D2/D6 (motor canônico + `d_max`), D9 (score), D17 (TTLs).
- **Aceite:** o 943 não aparece; o leitor vê faixa+chance+"N campanhas"+frescor;
  nenhuma série stale/incompleta publica; admin não mostra a mesma rota divergente.
- **Risco:** enriquecer sem regenerar o artefato = leitor segue vendo pré-C0.

### Evolução 1 — Unificação da experiência e resultado canônico
Fila do editor, ficha do analista, painel do operador; `Radar Result` como única
saída. Reusa tudo do MVP. Decisão aberta: D9, D15. Aceite: as quatro jornadas
executáveis. Risco: re-IA.

### Evolução 2 — Editorial Intelligence e aprovação (**estrutural**)
Estados de aprovação persistidos, "o que mudou" por diff de snapshot. Depende de
D10 e do snapshot canônico (ADR-006). Aceite: nada publica sem aprovação; bloqueio
vence score. Risco: TTL.

### Evolução 3 — Integração Daily e Weekly
Ambos leem o **mesmo** snapshot aprovado; critérios D11/D12; consistência por
`radar-consistency`. Depende da Evolução 2. Aceite: Daily=Weekly sem contradição;
"Não confirmado" honesto. Risco: falso silêncio.

### Evolução 4 — Pro, outcomes e calibração (**estrutural**)
`prediction_outcome`, backtest/Brier, histórico. Depende de snapshot + outcomes.
Aceite: acerto medido (não só backtest). Risco: expor acurácia baixa cedo demais.

### Evolução 5 — Automação assistida
Promoção sugerida por Editorial Score, **sempre com humano**; auto só após
calibração provada. Depende das Evoluções 2–4. Aceite: zero publicação automática
sem gate. Risco: excesso de confiança no score.

---

## 19. Roadmap (síntese)

`MVP (sem migration) → Ev.1 experiência → Ev.2 aprovação (migration) → Ev.3
Daily/Weekly → Ev.4 Pro/outcomes (migration) → Ev.5 automação`. MVP e Ev.1 são
**puro produto**; Ev.2–4 dependem das ADRs `proposed` e das decisões §25.

---

## 20. Backlog de produto priorizado (briefing §7)

| ID | Iniciativa | Problema resolvido | Persona | Valor | Dependência | Risco | Aceite | Prio | Fase | Capacidade reusada |
|---|---|---|---|---|---|---|---|---|---|---|
| P-01 | Regenerar artefato com campos C0 | Leitor recebe pré-C0/stale | Operador/Leitor | Alto | pipeline atual | baixo | artefato tem `.quality`/`datasetComplete`/frescor | P0 | MVP | forecast.mjs, freshness |
| P-02 | Bloco do leitor honesto | Leitor não vê chance/faixa/limites | Leitor | Alto | P-01, D14 | médio | faixa+chance+amostra+disclaimer no Digest | P0 | MVP | Predict, radarItems (enriquecido) |
| P-03 | Predict ao leitor via reconciliação | Motor mais forte invisível | Leitor | Alto | D2/D6 | médio | motor selecionado alimenta o bloco | P0 | MVP | reconciliação (regra) |
| P-04 | Motivos de exclusão + "o que mudou" na UI | Editor/analista sem contexto | Editor/Analista | Alto | snapshots | baixo | série mostra excluídas e delta | P1 | MVP | `.quality`, snapshots |
| P-05 | Radar admin em abas | 3 telas divergentes | Editor/Operador | Alto | D1 | médio | 1 fonte, 0 divergência | P1 | Ev.1 | forecast/predict/observability |
| P-06 | Comparação Forecast×Predict + divergência | Analista não vê divergência | Analista | Médio | D6 | baixo | lado a lado + flag | P1 | Ev.1 | ambos os motores |
| P-07 | Painel de saúde do operador | Sem monitor único | Operador | Alto | `.quality`, freshness | baixo | alertas antes do número | P1 | Ev.1 | datasetComplete, counters |
| P-08 | Fila de revisão de dado | Flags não viram trabalho | Operador | Médio | temporal flags | baixo | `requiresHumanReview` roteado | P2 | Ev.1 | quality |
| P-09 | Editorial Score interno | Priorização manual | Editor | Médio | D9 | médio | fila ordenada, nunca ao leitor | P2 | Ev.1 | gates+quality+deltas |
| P-10 | Aprovação editorial (estados) | Publica sem gate humano | Editor | Alto | D10, snapshot | alto | 7 estados; crítico não overridável | P2 | Ev.2 | overrides atuais |
| P-11 | Daily do snapshot aprovado | Daily manual/divergente | Editor/Leitor | Alto | P-10, D11 | alto | critérios fechados; consistência | P3 | Ev.3 | radar-consistency |
| P-12 | Weekly do snapshot aprovado | Weekly stale | Editor/Leitor | Alto | P-10, D12 | alto | ranking+deltas+expiração | P3 | Ev.3 | freshness, score |
| P-13 | Pro MVP | Analista/leitor pro sem profundidade | Leitor Pro | Médio | P-01 | médio | P completa+usadas/excluídas+backtest | P3 | Ev.4 | Predict, backtest |
| P-14 | Outcomes + calibração | Acurácia não medida | Analista | Médio | snapshot+outcome | alto | previsto×realizado | P4 | Ev.4 | snapshots |
| P-15 | Automação assistida | Promoção manual | Editor | Baixo | P-09..P-12 | alto | sugestão, nunca auto | P5 | Ev.5 | score+aprovação |

---

## 21. Backlog técnico derivado (briefing §8) — alto nível, **não implementar**

**Sem migration:** payload enriquecido (`Radar Result` no artefato); consolidação
da interface (abas); explicabilidade (expor `explanation`/`warnings`/backtest por
série); comparativo Forecast/Predict; apresentação de qualidade (evoluir
`QualityPanel`); "o que mudou" por diff de snapshot; gates de uso editorial na UI;
integração progressiva Daily/Weekly lendo o artefato reconciliado.

**Com migration (estrutural, exige ADR aprovado):** resultado canônico persistido;
aprovação editorial + histórico de decisões; identidade persistida
(`campaign_identity`); observações por fonte (`source_observation`); novo modelo de
vigência (`vigencia_type`/`data_evento`); snapshots promovíveis
(`prediction_snapshot_usages`); outcomes (`prediction_outcome`); catálogo de
programas/aliases; merge auditável de duplicatas.

---

## 22. Dependências estruturais (briefing §9)

| Estrutura futura | Decisão de produto suportada | Por que é necessária | Pode esperar? |
|---|---|---|---|
| `campaign_identity` + `dedup_key` | Reconciliação/qualidade corretas na origem | **Cura** o 943 (dedup real, não runtime) | Sim — C0.2 contém em runtime |
| `data_evento`/`vigencia_type` persistidos | Resultado canônico e datas corretas | Corrige a data no banco, não só contém | Sim — não bloqueia MVP |
| Snapshot canônico + `usages` | Aprovação, Daily/Weekly do mesmo snapshot | Reprodutibilidade + fim do stale persistido | Não para Ev.2/3 |
| Aprovação persistida | Estados de aprovação (D10) | Governança auditável | Não para Ev.2 |
| `prediction_outcome` | Métricas do modelo reais (D14 Pro) | Previsto × realizado | Sim — Ev.4 |
| Catálogo `programs`/`aliases` | Séries não fragmentadas | Une aliases ambíguos com curadoria | Sim — normalização atual cobre o essencial |
| Merge auditável | Duplicidade `confirmed` (não só `probable`) | Corrige duplicata no banco | Sim — runtime contém |

Regra: **não criar estrutura sem uso de produto definido** — cada linha acima
aponta a decisão que a justifica.

---

## 23. Critérios de aceite do produto (briefing §10)

- **Radar principal:** uma fonte; a mesma rota nunca aparece com duas janelas.
- **Detalhe da série:** lista campanhas usadas e excluídas (com motivo) e linka ao
  ledger.
- **Qualidade:** contadores de elegíveis/excluídas por classe visíveis; 943 ausente.
- **Reconciliação:** todo resultado registra `motorSelecionado` e, se houver,
  `divergence`.
- **Aprovação:** nada publica sem `approved`; bloqueio crítico nunca overridável.
- **Daily:** só fresco+aprovado; ≤5 itens; ausência → texto honesto.
- **Weekly:** ranking por score; consistente com o Daily (QA verde).
- **Pro:** P completa, usadas/excluídas, backtest, metodologia.
- **Observabilidade:** dataset completo? fresco? bloqueios por classe — num só lugar.
- **Explicabilidade:** toda previsão traz "por quê" e "o que pode invalidar".
- **Frescor:** idade sempre visível; stale nunca publica.
- **Auditoria:** todo resultado reconstruível dos campos usados (ids + config).

---

## 24. Métricas (briefing §11)

### Norte (≤3)
| Métrica | Fórmula conceitual | Fonte | Frequência | Meta inicial |
|---|---|---|---|---|
| Previsões aprovadas publicadas | nº séries `approved` usadas em Daily/Weekly | aprovação+usages | semanal | crescente, >0 estável |
| Acerto de janela (window-hit) | % previsões em que a campanha caiu na janela | backtest→outcome | semanal | ≥0,5 (backtest); medir real na Ev.4 |
| Zero publicação inválida | nº de publicações stale/contraditórias/suspeitas | QA+freshness | contínua | **0** |

### Uso (≤5)
Engajamento do bloco Radar (Beehiiv); séries abertas no admin; comparações de motor
abertas; itens promovidos a Daily/Weekly; "Não confirmado" exibidos ao leitor.

### Qualidade (≤5)
% elegíveis; % excluídas por classe (temporal/duplicidade/placeholder/sem data);
Δ elegíveis após C0.2; séries que perderam amostra por exclusão; artefatos stale em
uso (meta 0).

### Editorial (≤5)
Previsões usadas vs disponíveis; tempo médio até aprovação; overrides com nota;
contradições barradas pelo QA; expirações não renovadas.

### Modelo (≤5)
window-hit e erro mediano de data (backtest); `bonusAccuracy5pp`; concordância
Forecast×Predict; taxa de divergência > `d_max`; (Ev.4) Brier/calibração.

---

## 25. Decisões que ainda dependem do usuário (≤10) (briefing §12)

1. **Motor canônico ao leitor (D2/D5).** Rec.: Predict quando `ready`, Forecast
   fallback. A: como recomendado. B: manter só Forecast no leitor por ora.
   Impacto: valor ao leitor. Não decidir → Predict segue invisível.
2. **Divergência máxima `d_max` (D6).** Rec.: 30 dias. A: 30d. B: 45d.
   Impacto: quanto exige revisão. Não decidir → reconciliação sem limiar.
3. **Existência e pesos do Editorial Score (D9).** Rec.: interno, sim.
   A: implementar interno. B: não ter score, ordenar por iminência+confiança.
   Impacto: priorização do editor. Não decidir → fila sem ordem clara.
4. **TTL de aprovação e de snapshot (D10/D17).** Rec.: ~7 dias + re-expira por
   mudança. A: 7d. B: 3d. Impacto: frequência de recalcular/reaprovar. Não decidir
   → risco de publicar aprovação velha.
5. **Gates de amostra definitivos (ADR-004).** Rec.: Forecast pub. ≥5, Predict pub.
   ≥6, alta ≥10. A: como proposto. B: mais conservador. Impacto: quanto publica.
   Não decidir → gate fica no default do código.
6. **`k`/limiar rota↔cluster (D15/ADR-003).** Rec.: fallback rotulado + shrinkage
   simples. A: fallback rotulado. B: só rota (sem cluster ao leitor). Impacto:
   cobertura vs especificidade. Não decidir → cluster não é usado.
7. **Exposição de probabilidade ao leitor (D14).** Rec.: P30 no Daily, P30/60/90 no
   Pro. A: como recomendado. B: só faixa qualitativa. Impacto: honestidade vs
   simplicidade. Não decidir → leitor sem chance.
8. **Nível de automação editorial (D9/Ev.5).** Rec.: semi (sempre humano).
   A: semi. B: auto após calibração. Impacto: velocidade vs risco. Não decidir →
   promoção manual (seguro, porém lento).
9. **Persistir identidade/dedup e correção de data (ADR-009/010).** Rec.: sim, na
   fase estrutural (Ev.2+), após aprovar limiares. A: persistir. B: manter só
   runtime. Impacto: cura vs contenção. Não decidir → causa raiz não é curada.

---

## 26. Recomendação final

**Aprovar o MVP sem migration e as decisões fechadas (D1, D3, D4, D7, D8, D14,
D16, D18), decidir os 9 itens de §25, e só então iniciar a fase estrutural.** O
maior ganho — Predict no leitor, saída honesta, admin unificado — está a uma onda
de produto de distância e **não toca banco**. A cura da causa raiz (dedup e
correção de data) é estrutural, depende dos ADRs e vem depois, sem pressa, porque
o C0.2 já **contém** o sintoma. Nada aqui remove capacidade ou cria segunda fonte:
o Radar é a fundação atual, finalmente entregue como produto.
