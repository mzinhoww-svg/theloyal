# Aprovação do MVP — Radar Preditivo de Campanhas

> Fecha as **9 decisões que dependiam de aprovação humana** (§25 de
> `DECISOES-PRODUTO-RADAR.md`) e produz a versão final do escopo do **MVP Radar**.
> **Não implementa código, não altera banco/migration/dados/motores/ADRs, não
> publica, não gera artefatos, não abre PR.** Trabalha sobre o estado atual do
> PR #54.
>
> **Regra de preservação:** toda a fundação C0/C0.2 permanece e é **usada**, nunca
> duplicada. Fonte única (`RECONCILIACAO-FASE-C0.md`): `campaign-quality` →
> `buildForecast`/`buildPredict` (só `eligibleRows`) → `editorialGate` →
> `forecast-freshness` → `radar-consistency`. Nenhuma decisão cria segunda fonte.
>
> **Relação com os outros docs:** `PRODUCT-DESIGN-REVIEW-RADAR.md` (diagnóstico e
> visão) → `DECISOES-PRODUTO-RADAR.md` (D1–D18 + as 9 pendentes) → **este documento**
> (aprovação das 9 + escopo final do MVP) → `BACKLOG-P1-RADAR-UNIFICADO.md`
> (detalhamento executável do P1-A). ADRs citados seguem `proposed` — este doc é o
> insumo para promovê-los, não os altera.

---

## 1. Resumo executivo

As 9 decisões pendentes estão **fechadas com recomendação objetiva** — nenhuma
fica só como pergunta. O MVP aprovado é a **visão unificada `/admin/radar`** com o
`Radar Result` derivado **em runtime** (sem persistência), reusando 100% do
patrimônio C0/C0.2: Forecast como baseline, Predict como motor principal quando
`ready`, comparação dos motores, qualidade, frescor, bloqueios, campanhas
usadas/excluídas e explicabilidade. **Fora do MVP:** aprovação persistida, Daily,
Weekly, Pro, snapshot canônico, outcomes e identidade/dedup persistidas — todos
dependem de migration e das ADRs `proposed`.

Regra que atravessa tudo: **completude, qualidade temporal e frescor bloqueiam
antes de qualquer motor, score ou reconciliação** — e esses bloqueios **nunca**
recebem override nem automação.

---

## 2. As nove decisões aprovadas (formato completo)

### Decisão 1 — Motor canônico apresentado ao leitor

- **Contexto:** dois motores calculam a mesma série; o Predict (hazard+backtest) é
  o mais defensável mas não chega ao leitor; o Forecast (recorrência) chega
  desidratado. É preciso uma escolha única, sem duas verdades.
- **Decisão recomendada:** **Predict é o motor principal quando `readiness ∈
  {ready, ready_with_warnings}`.** Forecast é **baseline obrigatório** (sempre
  calculado, para comparação) e **fallback controlado** (rotulado "cadência
  aproximada") quando o Predict está bloqueado e o Forecast é `editorialEligible`.
  **Nada publica** quando qualidade, completude ou frescor estão bloqueados. O
  consumidor vê **um único `Radar Result`**, com o motor como metadado de
  proveniência.
- **Alternativa A:** como recomendado (Predict > Forecast > Não confirmado).
- **Alternativa B:** manter só o Forecast ao leitor por ora (Predict segue
  interno).
- **Ganhos:** leva o motor mais forte ao produto; elimina a divergência de telas.
- **Riscos:** erro de calibração do Predict amplificado — mitigado por gate humano
  (Decisão 8) e por publicar só sobre série válida.
- **Impacto no MVP:** o `/admin/radar` já mostra o motor selecionado; **não**
  publica ao leitor no MVP (reader vem na Ev.3).
- **Impacto estrutural:** exige snapshot canônico para o leitor (Ev.2/3).
- **Reversibilidade:** alta (é regra de seleção, não código de motor).
- **Sugerida para aprovação:** **Alternativa A.**

### Decisão 2 — Limite de divergência `d_max`

- **Contexto:** Forecast e Predict podem prever datas diferentes para a mesma
  série; sem limiar, uma divergência grande passa silenciosa.
- **Decisão recomendada:** limiar **em faixas, sobre a data central, com
  sobreposição de janela como atenuante:**
  - Δcentro **≤ 14 dias** → **compatível** (concordância vira sinal de confiança);
  - **15–30 dias** → **warning** (mostra ambos, publica com ressalva);
  - **> 30 dias** → **revisão obrigatória**;
  - **> 60 dias** → **bloqueio editorial** (não publica sem decisão humana).
  - **Atenuante:** se as **janelas se sobrepõem** (não só os centros), rebaixa uma
    faixa de severidade — divergência de centro com janelas sobrepostas é menos
    grave que janelas disjuntas.
- **Alternativa A:** as faixas acima (14/30/60) com centro + sobreposição.
- **Alternativa B:** limiar único de 30 dias sobre o centro (mais simples, menos
  nuance).
- **Ganhos:** explicável, gradual, e evita bloquear divergências que na prática se
  sobrepõem.
- **Riscos:** faixas mal calibradas geram ruído — reversível por config.
- **Impacto no MVP:** a aba de comparação mostra a faixa de divergência e o selo.
- **Impacto estrutural:** nenhum (regra em runtime).
- **Reversibilidade:** alta.
- **Sugerida para aprovação:** **Alternativa A** (centro como primário, janela como
  atenuante).

### Decisão 3 — Uso e visibilidade do Editorial Score

- **Contexto:** o editor precisa priorizar a fila; sem ordenação, decide no olho.
- **Decisão recomendada:** **score interno**, **não exposto ao leitor**, **não
  substitui probabilidade**, **não vence bloqueios críticos** e **não promove
  conteúdo automaticamente no MVP**. Dimensões: iminência da janela, confiança do
  modelo, magnitude do bônus vs típico, relevância do programa, "o que mudou".
- **Alternativa A:** implementar o score interno (ordena a fila).
- **Alternativa B:** não ter score; ordenar por iminência + confiança apenas.
- **Ganhos:** priorização coerente sem virar "chance".
- **Riscos:** confundir score com probabilidade — mitigado por rótulo e por nunca
  ir ao leitor.
- **Impacto no MVP:** entra como **ordenação simples da fila** (sem persistência).
- **Impacto estrutural:** nenhum no MVP; pesos versionados vêm depois.
- **Reversibilidade:** alta.
- **Sugerida para aprovação:** **Alternativa A** (interno, simples).

### Decisão 4 — TTL do cálculo, da aprovação e da publicação

- **Contexto:** resultado velho não pode aparecer como atual (princípio 13).
- **Decisão recomendada:**
  - **cálculo: 24h** (reusa `maxForecastAgeHours` já existente);
  - **aprovação para Daily: 24h**; **aprovação para Weekly: 7 dias**;
  - **expiração imediata** quando houver nova campanha válida, mudança de qualidade,
    `datasetComplete=false` ou artefato `stale`.
- **Alternativa A:** 24h/24h/7d + expiração por evento (como acima).
- **Alternativa B:** aprovação de 3 dias para tudo (mais conservador).
- **Ganhos:** frescor honesto; Daily nunca usa aprovação de ontem.
- **Riscos:** TTL curto = recalcular/reaprovar mais vezes — aceitável.
- **Impacto no MVP:** o **TTL de cálculo (24h) já vale** (frescor). O TTL de
  **aprovação é conceitual** no MVP (aprovação ainda não é persistida — Ev.2).
- **Impacto estrutural:** aprovação persistida com TTL exige snapshot (Ev.2).
- **Reversibilidade:** alta (parâmetros).
- **Sugerida para aprovação:** **Alternativa A.**

### Decisão 5 — Gates mínimos de amostra

- **Contexto:** série curta não pode virar previsão publicável; mas pode existir
  para análise.
- **Decisão recomendada:** **manter o mínimo editorial de 5 ondas no MVP**
  (`minEditorialWaves=5`, já em código); **o Predict mantém seu gate estatístico
  interno** (`minSamples=3` para calcular; readiness `ready` para ser canônico).
  **Uma série pode existir para análise sem ser publicável.** A elevação para
  Predict-publicável ≥6 / confiança alta ≥10 (ADR-004) fica para a fase estrutural.
- **Alternativa A:** manter 5 (Forecast editorial) + gate interno do Predict, como
  hoje.
- **Alternativa B:** já subir Predict-publicável para 6 e alta para 10.
- **Ganhos:** zero mudança de motor; consistente com o C0.
- **Riscos:** publicar (na Ev.3) com 5 ondas é menos robusto que 6 — decidir no
  momento da publicação ao leitor.
- **Impacto no MVP:** nenhuma mudança — usa os defaults atuais.
- **Impacto estrutural:** rever gates ao ligar o leitor (Ev.3).
- **Reversibilidade:** alta.
- **Sugerida para aprovação:** **Alternativa A** (manter atual no MVP; revisitar na Ev.3).

### Decisão 6 — Regra `k` (rota versus cluster)

- **Contexto:** rotas esparsas têm pouca cadência; o cluster (destino) tem mais
  amostra, mas não é específico da rota.
- **Decisão recomendada:** **rota é a unidade principal.** Cluster **nunca
  substitui silenciosamente** uma rota; pode ser **exibido como análise agregada**;
  **fallback para cluster é claramente identificado** ("previsão do programa, não
  específica de {origem}"). **No MVP: fallback rotulado apenas, sem shrinkage.**
  Valor inicial proposto de **`k = 4`** para quando o pooling `w = n_rota/(n_rota+k)`
  for implementado (estrutural) — rota precisa de ~4 ondas para pesar 50%.
- **Alternativa A:** fallback rotulado no MVP; `k=4` reservado para o pooling estrutural.
- **Alternativa B:** só rota ao leitor (sem cluster), até o pooling existir.
- **Ganhos:** cobertura sem esconder falta de dado da rota.
- **Riscos:** cluster mascarar rota — evitado pelo rótulo obrigatório.
- **Impacto no MVP:** o `/admin/radar` mostra "rota" ou "cluster (agregado)" com selo.
- **Impacto estrutural:** shrinkage com `k` calibrável (ADR-003).
- **Reversibilidade:** alta.
- **Sugerida para aprovação:** **Alternativa A** (`k=4` provisório, revisável).

### Decisão 7 — Exposição de probabilidades ao leitor

- **Contexto:** o motor produz P7–P180; mostrar tudo gera falsa precisão.
- **Decisão recomendada:** **expor faixas arredondadas e horizontes claros**,
  **um a dois horizontes por produto**: **Daily → P30** (uma faixa/label);
  **Weekly → P30 e P90**; **Pro → curva completa**. Arredondar (ex.: múltiplos de
  10%) com rótulo qualitativo; sempre com **metodologia** e **disclaimer**. Nunca
  P7/P15/P30/P60/P90/P180 simultâneos em superfície editorial.
- **Alternativa A:** P30 (Daily), P30+P90 (Weekly), curva (Pro) — arredondado.
- **Alternativa B:** só faixa qualitativa (sem número) nas superfícies editoriais.
- **Ganhos:** honestidade calibrada; sem falsa precisão.
- **Riscos:** número pode ser lido como garantia — mitigado por faixa+disclaimer.
- **Impacto no MVP:** o `/admin/radar` (interno) pode mostrar a curva ao analista;
  a exposição **ao leitor** é Ev.3.
- **Impacto estrutural:** nenhum.
- **Reversibilidade:** alta.
- **Sugerida para aprovação:** **Alternativa A.**

### Decisão 8 — Nível inicial de automação editorial

- **Contexto:** automatizar publicação cedo demais é arriscado sem calibração.
- **Decisão recomendada:** **MVP assistido, não autônomo.** Motores calculam e
  **recomendam**; **humano aprova** a publicação; **bloqueios críticos nunca**
  recebem automação nem override; automação futura depende de **outcomes e
  calibração**.
- **Alternativa A:** assistido (sempre humano).
- **Alternativa B:** automático após calibração provada.
- **Ganhos:** segurança; nada frágil chega ao leitor sem gate.
- **Riscos:** mais lento — aceitável no início.
- **Impacto no MVP:** o Radar **recomenda**; publicar segue manual.
- **Impacto estrutural:** automação assistida só na Ev.5.
- **Reversibilidade:** alta.
- **Sugerida para aprovação:** **Alternativa A.**

### Decisão 9 — Persistência de identidade e deduplicação (fase estrutural)

- **Contexto:** a **causa raiz** do 943 é o `id` embutir `vigencia_fim` → a mesma
  campanha vira dois registros. O C0.2 **contém** em runtime; a **cura** é persistir
  identidade estável e deduplicar.
- **Decisão recomendada:** **aprovar como prioridade estrutural P0.** Persistir
  `campaign_identity`, `campaign_version` e `source_observation`. **Não iniciar
  merge automático.** Toda decisão de merge deve ser **auditável e reversível**.
- **Alternativa A:** persistir identidade/versão/observação; merge só manual/auditável.
- **Alternativa B:** manter só a contenção em runtime (não curar no banco).
- **Ganhos:** cura a raiz; dedup correta e reprodutível.
- **Riscos:** migration e reprocessamento — por isso fora do MVP.
- **Impacto no MVP:** **nenhum** (o C0.2 já contém o sintoma).
- **Impacto estrutural:** primeira grande entrega da fase estrutural (ADR-009/010).
- **Reversibilidade:** média (é persistência, mas o merge é reversível por design).
- **Sugerida para aprovação:** **Alternativa A** (P0 estrutural, sem merge automático).

---

## 3. Defaults escolhidos (consolidado)

| Item | Default aprovado |
|---|---|
| Motor canônico | Predict quando `ready`/`ready_with_warnings`; Forecast baseline+fallback rotulado; senão Não confirmado |
| `d_max` | ≤14 compatível · 15–30 warning · >30 revisão · >60 bloqueio; centro primário, sobreposição de janela atenua uma faixa |
| Editorial Score | interno, não-leitor, não-probabilidade, não vence bloqueio, sem auto-promoção no MVP |
| TTL cálculo | 24h (já existente) |
| TTL aprovação | Daily 24h · Weekly 7d · expiração imediata por evento (conceitual no MVP) |
| Gates | Forecast editorial ≥5 (mantido); Predict gate interno (3 calcula / ready canônico); série pode existir só para análise |
| Rota × cluster | rota principal; cluster fallback **rotulado**, nunca silencioso; `k=4` reservado para pooling estrutural |
| Probabilidades | Daily P30 · Weekly P30+P90 · Pro curva; arredondado + metodologia + disclaimer |
| Automação | assistida (humano aprova); crítico nunca automatizável |
| Identidade/dedup | P0 estrutural; persistir identity/version/observation; merge só auditável/reversível |

---

## 4. Comportamento por superfície (MVP)

### 4.1 Admin Radar (`/admin/radar`) — **o MVP**
Resultado **único** por série (`Radar Result` em runtime); detalhes **Forecast e
Predict** lado a lado com a divergência (Decisão 2); **qualidade** (C0.2);
**bloqueios** (hierarquia de 11 níveis); **campanhas utilizadas e excluídas** (com
motivo, link ao ledger); **recomendação editorial** (estado + Editorial Score
interno); **aprovação manual apenas conceitual** enquanto não houver persistência
(nenhum estado gravado no MVP). Detalhamento executável em
`BACKLOG-P1-RADAR-UNIFICADO.md`.

### 4.2 Daily — **fora do MVP** (Ev.3)
Quando entrar: horizonte curto (7–30d); **1 a 3 oportunidades**; **só resultado
fresco, elegível e aprovado**; **uma probabilidade/faixa principal** (P30);
ausência explícita ("sem janelas relevantes hoje").

### 4.3 Weekly — **fora do MVP** (Ev.3)
Quando entrar: horizonte mais longo (≤90d); **ranking** por Editorial Score;
**mudanças da semana**; oportunidades e **bloqueios relevantes**; **resultado
canônico único**; consistente com o Daily (`radar-consistency`).

### 4.4 Pro — **visão futura** (Ev.4)
Probabilidades completas; backtest; timeline; metodologia; histórico; outcomes.

---

## 5. Escopo final do MVP

| Capacidade | Entra no MVP | Não entra | Motivo | Dependência |
|---|:---:|:---:|---|---|
| `/admin/radar` (visão unificada) | ✅ | | Consolida 3 telas numa fonte | D1, P1-A |
| Visão unificada (Séries/Qualidade/Motores) | ✅ | | Núcleo do produto | — |
| Forecast como baseline | ✅ | | Já existe; comparação/fallback | — |
| Predict como motor principal | ✅ | | Já existe; motor canônico quando ready | Decisão 1 |
| `Radar Result` derivado em **runtime** | ✅ | | Sem persistência = sem migration | — |
| Comparação dos motores + divergência | ✅ | | Analista vê Forecast×Predict | Decisão 2 |
| Qualidade C0/C0.2 | ✅ | | Já existe (`.quality`, `QualityPanel`) | — |
| Frescor | ✅ | | Já existe (`assessForecastArtifact`) | — |
| Bloqueios (hierarquia) | ✅ | | Já calculados; só exibir | — |
| Campanhas utilizadas e excluídas | ✅ | | Rastreabilidade (`.quality.excluded`) | — |
| Explicabilidade (`explanation`, warnings, backtest) | ✅ | | Já calculada; expor por série | — |
| Editorial Score (interno, ordenação) | ✅ | | Versão simples, sem persistência | Decisão 3 |
| Aprovação **persistida** | | 🚫 | Exige migration | Ev.2 / ADR-006 |
| Daily | | 🚫 | Exige aprovação persistida + snapshot | Ev.3 |
| Weekly | | 🚫 | Idem | Ev.3 |
| Pro | | 🚫 | Visão futura | Ev.4 |
| Snapshot canônico | | 🚫 | Exige migration | Ev.2 / ADR-006 |
| Outcomes | | 🚫 | Exige `prediction_outcome` (migration) | Ev.4 |
| Identidade persistida | | 🚫 | Fase estrutural P0 (migration) | ADR-009 |
| Deduplicação persistida | | 🚫 | Fase estrutural; merge auditável | ADR-009 |

---

## 6. Itens fora do MVP (resumo)

Aprovação persistida, Daily, Weekly, Pro, snapshot canônico, outcomes,
identidade e deduplicação persistidas. Todos dependem de **migration** e das ADRs
`proposed` — e nenhum é urgente porque o **C0.2 já contém** o sintoma que eles
curam.

---

## 7. Sequência de implementação recomendada

1. **P1-A — Visão unificada `/admin/radar`** (sem persistência; runtime).
2. **P1-B — Detalhe da série** (Forecast×Predict, qualidade, usadas/excluídas, backtest).
3. **P1-C — Consolidação operacional** (painel de saúde; migração incremental das 3 telas).
4. **`Radar Result` derivado em runtime** (contrato de leitura único, sem gravar).
5. **Integração editorial controlada** (Editorial Intelligence + recomendação; sem publicar).
6. **Fundação estrutural persistida** (identidade/dedup/vigência — ADR-009/010, P0 estrutural).
7. **Snapshot canônico e aprovação** (ADR-006; estados persistidos; TTLs reais).
8. **Outcomes e calibração** (previsto × realizado; Brier).
9. **Pro e automação assistida** (curva completa; promoção sugerida, sempre humana).

Passos 1–5 são **sem migration**; 6–9 são estruturais e dependem das ADRs e das
decisões acima.

---

## 8. Riscos

- **Enriquecer sem regenerar o artefato** deixaria o leitor no pré-C0 — mas o MVP é
  interno (`/admin/radar`), então isso só importa ao ligar o leitor (Ev.3).
- **Editorial Score confundido com probabilidade** — mitigado: interno, rotulado,
  nunca ao leitor.
- **Cluster mascarar rota** — mitigado: fallback sempre rotulado.
- **Divergência mal calibrada (`d_max`)** — reversível por config; começa em faixas
  explicáveis.
- **Publicar com 5 ondas na Ev.3** — decisão de gate revisitada ao ligar o leitor.
- **Corrida de sessões paralelas no PR #54** — risco de processo, não de produto;
  mantido em fonte única por reconciliação.

---

## 9. Critérios de aceite do MVP

- `/admin/radar` mostra **um** `Radar Result` por série; a mesma rota **nunca**
  aparece com duas janelas concorrentes.
- Divergência Forecast×Predict exibida com faixa e selo (Decisão 2).
- Bloqueios (dataset/temporal/duplicidade/placeholder/amostra/motor/intervalo/
  horizonte/stale) aparecem **acima** do número, com motivo.
- Campanhas usadas e excluídas visíveis, com motivo e link ao ledger.
- Editorial Score ordena a fila, **nunca** aparece ao leitor, **nunca** vence
  bloqueio.
- Frescor sempre visível; artefato stale nunca publica (mesmo interno, sinaliza).
- **Zero** capacidade C0/C0.2 removida; **zero** segunda fonte de verdade.
- 943 permanece contido (sem série, sem 2029) — garantido pelos testes atuais.

---

## 10. Recomendação final

**Aprovar as 9 decisões nas alternativas A e iniciar pela sequência P1-A → P1-B →
P1-C → Radar Result runtime**, tudo **sem migration**. O produto passa a existir no
admin, com uma fonte única e o risco à vista, reusando integralmente o patrimônio
C0/C0.2. A fase estrutural (identidade/dedup persistidas, snapshot canônico,
aprovação, outcomes) começa **depois**, com as ADRs promovidas de `proposed` a
`accepted` a partir destas decisões — sem pressa, porque o C0.2 já contém o
sintoma. Com isto, o **prompt técnico do P1-A pode ser gerado sem novas
ambiguidades**.
