# Política Canônica do Radar

> **Status:** proposta de política (insumo para promover ADR-RADAR-008 a `accepted`).
> **Data:** 2026-07-15.
> **Escopo:** define, para o longo prazo, qual motor é a **fonte canônica** do Radar,
> como o **fallback** opera, quando o Radar **não publica**, e como isso se traduz em
> regra operacional, de governança e de comunicação ao leitor.
> **Precede:** decisões de UI e de copy do bloco Radar em qualquer superfície.
> **Reusa, não reabre:** `ADR-RADAR-004` (gates de amostra), `ADR-RADAR-008`
> (papéis Forecast/Predict), `DECISOES-PRODUTO-RADAR.md` (D1–D18),
> `APROVACAO-MVP-RADAR.md` (9 decisões fechadas), `lib/radar-view-model.ts`
> (reconciliação em runtime), `lib/predict-engine.ts`, `lib/forecast.ts`.
>
> Esta política **não cria motor novo, não altera matemática, não cria segunda fonte
> de verdade.** É a camada de decisão de produto sobre saídas que já existem.

## Premissas assumidas (não reabertas)

1. O produto ainda está **pré-operação** em partes relevantes do fluxo ao leitor.
2. O **TL Score hoje é digitado**, não calculado — logo, o Radar **não** produz TL
   Score automaticamente; ele produz uma **previsão calibrada** que a inteligência
   editorial pode (ou não) traduzir em veredito.
3. Não existe ainda **nota de corte de publicação madura** — **esta política a define**.
4. O **motor que publica hoje** (Forecast, via `digest.radarWeekly`) **não é o que
   mede a própria acurácia** (só o Predict tem backtest walk-forward). Essa é a
   incoerência central que a política resolve.
5. A **Weekly ainda não consolida a Daily** de forma automática e rastreável.
6. A **comunicação promete mais do que o produto entrega** em alguns pontos — a
   política corrige isso pelo lado do gate, não do marketing.

---

## 1. Arquitetura de decisão

### 1.1 O que o Radar é

O Radar é, **por padrão, uma camada de monitoramento que expõe previsões
calibradas** — e **só se torna recomendação após um ato editorial explícito**.

- **Monitoramento** é o estado-base: "estas séries existem, esta é a cadência, este
  é o nível de confiança, isto é o que mudou". Sempre disponível quando há dado.
- **Previsão** é o conteúdo do monitoramento quando o motor canônico atinge o gate:
  janela + probabilidade por horizonte + bônus provável, com faixa e frescor.
- **Recomendação** (Vale agir / Vale olhar / Esperaria / Evitaria) **não é produzida
  pelo Radar**. É um ato da inteligência editorial sobre a previsão, sujeito ao TL
  Score e às regras invioláveis (regra 3: nunca prometer ganho). O Radar **alimenta**
  a recomendação; não **é** a recomendação.

Consequência: o Radar pode publicar "monitoramento" sem publicar "previsão", e pode
publicar "previsão" sem que ela vire "recomendação". São três degraus, não um.

### 1.2 Fonte única vs múltiplas fontes por confiança

**Fonte de verdade única por série, com proveniência explícita.** Nunca duas janelas
concorrentes na mesma superfície. A reconciliação (`lib/radar-view-model.ts`,
`composeRadarViewModel`) escolhe **um** resultado; o motor selecionado vira **metadado
de proveniência** (`motorSelecionado`), não uma segunda verdade paralela.

Rejeitado: "aceitar múltiplas fontes por nível de confiança". Múltiplas fontes
simultâneas ao leitor reintroduzem exatamente a divergência de três telas que o
projeto já decidiu eliminar (D1). A **diversidade de motores é insumo interno**
(comparação na aba Análise, sinal de divergência), **nunca saída ao leitor**.

### 1.3 Papel de `forecast` e papel de `predict`

Os dois motores respondem a **perguntas diferentes** e por isso coexistem sem competir:

| | **Forecast** (`lib/forecast.ts`) | **Predict** (`lib/predict-engine.ts`) |
|---|---|---|
| Pergunta | "Qual é a **cadência típica** desta série?" | "Qual a **probabilidade** de uma janela no horizonte H, e **quão bem** eu previ no passado?" |
| Natureza | Descritiva (recorrência, intervalos, janela ±) | Probabilística (hazard empírico ponderado por recência) |
| Saída-chave | `windowStart..End`, `typicalPercent`, `confidence` | `probabilities` P7–P180, `centralDate`, faixa por quantis, `bonusCandidates`, `backtest` |
| **Auto-mede acurácia?** | **Não** | **Sim** (`backtest` walk-forward, `windowHitRate`, `medianDateErrorDays`) |
| Papel canônico | **Baseline + fallback rotulado + comparação** | **Motor canônico quando pronto** |

Princípio-mãe desta política: **canonicidade se ganha por auto-medição.** Um motor que
não consegue medir o próprio erro não pode ser a manchete sozinho — no máximo é
baseline. Isso, por si só, resolve a premissa 4: o Forecast **descreve** a cadência; o
Predict **prevê e se mede**. Publicar Forecast como se fosse previsão calibrada é
prometer precisão que o motor não sabe verificar.

### 1.4 Quando cada motor entra como fonte principal

- **Predict é principal** quando `readiness ∈ {ready, ready_with_warnings}`.
- **Forecast é principal (fallback rotulado)** apenas quando o Predict está bloqueado
  **e** o Forecast é `editorialEligible` — e nunca como manchete "previsão", sempre
  rotulado **"cadência aproximada"**.
- **Nenhum é principal** quando ambos bloqueiam, ou quando um bloqueio duro precede a
  reconciliação (completude, frescor, qualidade temporal).

### 1.5 Quando um motor serve só como fallback

O **Forecast** serve de fallback quando, e só quando:

1. o Predict retorna `insufficient_history` / `backfill_incomplete` /
   `data_quality_blocked`, **e**
2. o Forecast é `editorialEligible` (≥5 ondas, sem bloqueio duro), **e**
3. não há bloqueio de completude/frescor/qualidade a montante.

Nesse caso o resultado sai como Forecast, **rotulado "cadência aproximada"**, com
`fallback_used=true` no metadado. O Predict nunca é fallback do Forecast — se o
Predict está pronto, ele é a fonte; o Forecast fica guardado só para comparação.

### 1.6 Quando nenhum motor deve publicar

O Radar **não publica previsão** (degrada para monitoramento ou corta) quando:

- `datasetComplete = false` (base incompleta) — precede tudo;
- artefato `stale` (cálculo > 24h) — precede tudo;
- qualidade temporal crítica (`suspect_year`) ou duplicidade provável remove a série;
- Predict bloqueado **e** Forecast não elegível → **Não confirmado**;
- divergência entre motores em faixa **revisão/bloqueio** sem decisão humana;
- confiança do modelo `baixa`/`insuficiente` sem aprovação editorial explícita.

Regra dura: **na dúvida, degrade para monitoramento honesto; nunca preencha silêncio
com número** (regra inviolável 9 + princípio 13 do PDR).

---

## 2. Critérios canônicos

### 2.1 O que define canonicidade

Um resultado é **canônico** para uma série quando satisfaz, em ordem de precedência:

1. **Integridade a montante** — série existe sobre ondas reais (pós ADR-009/010): sem
   `suspect_year`, sem duplicata provável crítica, sem placeholder, `datasetComplete`.
2. **Frescor** — artefato `fresh` (≤24h).
3. **Prontidão do motor** — Predict `ready`/`ready_with_warnings` (ou Forecast
   elegível em fallback).
4. **Auto-medição defensável** — backtest com `observations ≥ 3` e `windowHitRate ≥
   0,5` (quando aplicável ao Predict).
5. **Explicabilidade** — há `explanation` legível e "o que pode invalidar".
6. **Não-divergência crítica** — divergência Forecast×Predict fora das faixas
   revisão/bloqueio, ou revisão já resolvida por humano.

Canonicidade **não** é "o maior score". É a série que **passa por todos os portões
duros e traz consigo a própria evidência de acerto**.

### 2.2 Como pesar frescor, densidade histórica, acurácia, estabilidade, explicabilidade e risco

Estes seis não entram numa média ponderada única — isso esconderia trade-offs. Eles
operam em **camadas com precedência**, das mais duras (gates binários) às mais suaves
(rebaixamento de confiança):

| Dimensão | Fonte no código | Tipo | Efeito |
|---|---|---|---|
| **Frescor** | `assessForecastArtifact` | **Gate binário** | `stale` → não publica. Nunca ponderável. |
| **Densidade histórica** | `recordsTotal` / `samples` | **Gate + escala** | `<3` bloqueia Predict; `<5` bloqueia Forecast editorial; `≥6` média; `≥10` alta. |
| **Acurácia** | `backtest.windowHitRate` | **Gate + rebaixa** | `<0,5` rebaixa confiança; sem obs. suficientes proíbe "alta". |
| **Estabilidade** | `coefVar(intervals)` | **Rebaixa** | CV alto rebaixa confiança e emite warning. |
| **Explicabilidade** | `explanation`, `warnings` | **Gate suave** | Sem explicação legível → não vai ao leitor (só ao analista). |
| **Risco** | bloqueios D16 + divergência | **Gate binário** | Bloqueio crítico ou divergência revisão/bloqueio → não publica sem humano. |

Regra de composição: **um gate binário reprovado encerra a decisão** — nenhuma outra
dimensão o compensa. Só depois de todos os gates binários passarem é que estabilidade
e acurácia **modulam a confiança** (o Editorial Score, interno, ordena; nunca promove).

### 2.3 O que é "dado suficiente" para o Radar

"Suficiente" é **por finalidade** (ADR-004), não um número único:

| Finalidade | Mínimo (ondas reais) |
|---|---|
| Existir/inspecionar no admin | ≥ 1 |
| Análise exploratória | ≥ 3 |
| Forecast publicável (baseline/fallback) | ≥ 5 |
| Predict publicável (canônico ao leitor) | ≥ 6 *(meta estrutural; hoje `ready` c/ ≥3 calcula e é canônico internamente)* |
| Confiança média | ≥ 6 |
| Confiança alta | ≥ 10 |
| Backtest confiável | ≥ 3 observações (`backtestMinObs`) |

"Ondas reais" é literal: contadas **depois** da validação temporal (ADR-010) e da
deduplicação (ADR-009). Contar ondas sobre dado corrompido é contar lixo.

### 2.4 "Dado insuficiente", "instável" e "arriscado"

- **Insuficiente** — abaixo do gate da finalidade. Efeito: `insufficient_history`,
  status de produto "Histórico insuficiente". Aparece como **monitoramento**, nunca
  como janela. Reversível quando acumular ondas.
- **Instável** — amostra suficiente, mas cadência irregular (CV alto) ou backtest
  fraco. Efeito: confiança rebaixada, `ready_with_warnings`. Pode publicar **com
  ressalva e faixa larga**, nunca como "alta confiança".
- **Arriscado** — há sinal de que o dado é **falso ou contraditório**: `suspect_year`,
  duplicata provável, divergência de motores em faixa bloqueio, intervalo extremo
  (≥540d), horizonte excessivo (>365d). Efeito: **bloqueio**; alguns overridáveis com
  nota (intervalo/horizonte), os críticos **nunca**.

### 2.5 Séries novas, curtas, com buracos e sazonais

- **Novas** (0–2 ondas): só existem no admin. Nunca publicam. Rótulo "em formação".
- **Curtas** (3–4 ondas): Predict calcula internamente; **não vira manchete**;
  Forecast não é elegível (<5). Aparecem como monitoramento com confiança baixa.
- **Com buracos** (intervalos faltando / extremos): o `waveEpsilonDays=3` colapsa
  quase-simultâneas; intervalo ≥540d dispara bloqueio revisável. Buraco grande **alarga
  a faixa** (quantis do resíduo) — o produto mostra faixa larga, não ponto falso.
- **Sazonais**: o hazard empírico ponderado por recência **não modela sazonalidade
  explícita**. Enquanto não houver componente sazonal, séries fortemente sazonais
  devem sair com **confiança no máximo média** e warning de "cadência sazonal não
  modelada" — e a inteligência editorial decide. Não fingir precisão sazonal que o
  motor não tem. *(Melhoria estrutural: componente sazonal no Predict v3.)*

### 2.6 Divergência entre motor estatístico e leitura editorial

Duas divergências distintas, tratadas por caminhos distintos:

- **Motor × motor** (Forecast × Predict): regra fixa e determinística
  (`computeDivergence`), faixas sobre a data central com atenuação por sobreposição de
  janela — ver §4 e a matriz. Nunca resolvida "no olho".
- **Motor × editorial** (o editor discorda do motor canônico): **o editor pode
  rebaixar, adiar ou cortar — nunca elevar acima do que o motor sustenta.** O editorial
  é um **freio, não um acelerador**. Se o editor quer publicar algo que o motor bloqueia
  por gate duro, a resposta é "não publica" (o gate duro vence). Se quer publicar
  acima da confiança do motor, não pode — a confiança ao leitor nunca excede a do
  motor canônico. Toda intervenção editorial exige **nota registrada** (auditoria).

---

## 3. Regras por superfície

### 3.1 Daily e Weekly compartilham o **núcleo**, divergem na **janela de admissão**

**Mesma fonte, mesmos bloqueios, mesma proveniência.** Daily e Weekly leem o **mesmo
snapshot reconciliado** — nunca motores diferentes, nunca janelas diferentes para a
mesma série. O que difere é **o recorte de horizonte e a densidade**, não a verdade.

| | **Daily** | **Weekly** |
|---|---|---|
| Horizonte | 7–30 dias (iminente) | ≤ 90 dias |
| Itens | 3–5 oportunidades | 5–10 séries (ranqueadas) |
| Probabilidade exposta | P30 | P30 + P90 |
| Consolida | — | **a semana de Dailies** (§5, premissa 5) |
| Ausência | "sem janelas relevantes hoje" | "sem janelas relevantes esta semana" + observação |

### 3.2 Weekly é **igual ou mais conservadora** — nunca menos

A Weekly é a **consolidação rastreável** da Daily. Por construção ela **só pode ser
igual ou mais conservadora**:

- **Não pode** publicar como previsão uma série que a Daily bloqueou por gate duro na
  janela.
- **Não pode** elevar a confiança de uma série acima do que apareceu na Daily.
- **Pode** incluir como "em observação" séries que a Daily omitiu por não serem
  iminentes (horizonte >30d).
- **Deve** carregar os deltas da semana ("o que mudou") — é o registro rastreável que
  a premissa 5 aponta como ausente.

Garantia técnica: `radar-consistency` valida que Daily e Weekly não se contradizem
sobre a mesma série (mesmo motor, janela compatível, confiança não maior).

### 3.3 Pro é mais **profundo**, não mais **denso** nem mais **otimista**

Pro **não muda a verdade** — mostra mais **evidência** da mesma verdade:

- **Adiciona:** curva completa P7–P180, campanhas usadas e excluídas (com motivo),
  backtest por série, metodologia, histórico.
- **Nunca adiciona:** um veredito diferente, uma confiança maior, uma janela diferente
  ou uma série que a superfície gratuita bloqueou por gate duro.
- Profundidade = mais provas do mesmo número. "Mais denso" (empilhar mais itens) ou
  "mais otimista" (afrouxar gate para justificar o preço) são **proibidos**.

### 3.4 Diferenças aceitáveis entre superfícies

Janela de horizonte; número de itens; quantidade de horizontes de probabilidade
expostos; presença de backtest/metodologia/histórico; densidade de explicação.
**Tudo o que é "quanto da mesma evidência mostrar".**

### 3.5 Diferenças proibidas (inconsistentes)

Motor selecionado diferente para a mesma série; janela diferente para a mesma série;
confiança/veredito diferente; uma série publicada numa superfície e **duramente
bloqueada** em outra; confiança **maior** no Pro que na superfície gratuita; Weekly
**menos** conservadora que a Daily. **Tudo o que faria a mesma série ter duas
verdades.**

---

## 4. Condições de bloqueio

Organizadas por **efeito**, mapeando a hierarquia de 11 níveis (D16) e a reconciliação
já implementada (`deriveStatus`).

### 4.1 Bloqueiam publicação automática (o motor não sobe sozinho)

Dataset incompleto; artefato stale; `suspect_year` crítico; duplicata provável
crítica; placeholder; amostra insuficiente (< gate da finalidade); readiness do
Predict `insufficient_history`/`backfill_incomplete`/`data_quality_blocked` **sem**
Forecast elegível; divergência revisão/bloqueio; confiança `baixa`/`insuficiente`;
expiração da aprovação. **Qualquer um** basta.

### 4.2 Bloqueiam até a publicação humana assistida (nem override resolve)

O subconjunto **duro** — o editor **não pode** liberar mesmo com nota:

- Dataset incompleto (nível 1);
- Qualidade temporal crítica `suspect_year` (nível 2);
- Duplicidade provável crítica (nível 3);
- Programa inválido/placeholder (nível 4);
- Artefato stale (nível 9);
- Expiração (nível 11).

Estes precedem motor, score e reconciliação. Nenhum pin/mute/nota os desarma. O
caminho é **corrigir o dado ou recalcular**, nunca liberar.

### 4.3 Obrigam o Radar a aparecer só como "monitoramento"

Série real, mas sem previsão defensável: readiness `insufficient_history` com série
legítima; janela iminente mas confiança baixa; divergência em **revisão** (não
bloqueio); amostra entre o gate de exibição e o de publicação (3–4 ondas). Aparece
como "em observação" / "monitorando" — **cadência e amostra visíveis, sem janela nem
probabilidade como manchete**.

### 4.4 Exigem corte total do bloco Radar

O bloco inteiro só é **cortado** (não aparece) quando **nem o monitoramento é
confiável**:

- artefato **ausente ou corrompido** (não dá para afirmar nem "estamos monitorando");
- falha de carga do ledger / dataset não avaliável.

Enquanto houver base avaliável, **degrade para texto honesto** ("sem janelas
relevantes hoje" / "monitorando N séries") — **nunca** corte silencioso que o leitor
leia como "nada acontece". O comportamento atual da Weekly já faz isto: sem radar
fresco e completo, `resolveRadar` omite os números e não publica stale em silêncio.
Esta política **generaliza** essa regra para todas as superfícies.

### 4.5 Handling específico

| Situação | Ação |
|---|---|
| **Artefato velho** (stale) | Bloqueio duro (nível 9). Degrada para monitoramento com "atualizado há X"; nunca publica o número velho. Aciona recálculo. |
| **Baixa confiança** | Não é manchete. Publica só com aprovação editorial + rótulo, faixa larga, sem "alta". |
| **Amostra pequena** | Se < gate de publicação: monitoramento. Se < gate de exibição (≥1): só admin. Nunca janela. |
| **Dados conflitantes** (divergência) | Faixa **warning** publica com ressalva; **revisão/bloqueio** exige humano; guarda o resultado perdedor para auditoria. |
| **Motor degradado** (backtest fraco / CV alto) | Rebaixa confiança (`ready_with_warnings`); publica com faixa larga e warning; nunca "alta". Se degradar abaixo do gate, cai para monitoramento. |

---

## 5. Explicação ao leitor

### 5.1 Explicitar a fonte

Toda previsão publicada carrega **proveniência legível**, sem jargão de motor:
- Predict canônico → "estimativa a partir do histórico de campanhas" (sem citar
  "Predict"/"hazard").
- Forecast fallback → rótulo explícito **"cadência aproximada"**.
- O leitor **nunca** vê os nomes internos dos motores; o operador vê `motorSelecionado`
  como metadado.

### 5.2 Mostrar que é previsão, não promessa

- **Faixa de datas, nunca ponto** ("entre X e Y", não "dia Z").
- **Faixa de bônus, nunca o máximo** (regra inviolável 3: bônus alto não é valor).
- Verbo de probabilidade, não de certeza ("costuma", "há ~X% de chance em 30 dias").
- **Disclaimer obrigatório** (regra inviolável 10) sempre que houver recomendação.

### 5.3 Confiança sem caixa-preta

Mostrar os **insumos observáveis** da confiança, não o número interno:
- **tamanho da amostra** ("com base em N campanhas");
- **frescor** ("atualizado há X");
- **faixa** (largura da janela comunica incerteza visualmente);
- **rótulo qualitativo** de confiança (alta/média/baixa) alinhado ao vocabulário TL.
- **Nunca** expor ao leitor: CV bruto, hazard, `duplicate score`, quantis crus.

### 5.4 Explicar por que foi publicado ou omitido

- Publicado: "por quê" curto (`explanation`) + "o que pode invalidar".
- Omitido: texto honesto ("sem janelas relevantes hoje"; "monitorando N séries, sem
  confiança suficiente para uma janela"). A omissão é **informação**, não ausência.

### 5.5 Reduzir leitura errada

Sem urgência artificial (regra 4); sem emoji (regra 5); faixa em vez de precisão
falsa; bônus como faixa; disclaimer presente; "previsão" e "monitoramento"
visualmente distintos de "recomendação"/veredito. O leitor nunca deve confundir "há
chance de janela" com "vale a pena agir".

---

## 6. Operação e governança

### 6.1 Da decisão canônica à regra operacional

Esta política vira código em **um único caminho**: a reconciliação em runtime
(`composeRadarViewModel` → `deriveStatus` / `computeDivergence` /
`selectPrimaryProbability`). Toda superfície (admin, Daily, Weekly, Pro) consome o
**mesmo** `Radar Result`. Os limiares (d_max, gates, TTLs, horizontes) vivem em
**config versionada**, não espalhados em componentes. Mudar a política = mudar config
+ a função de reconciliação, num lugar, com teste de paridade.

### 6.2 Quem pode sobrepor a decisão automática

Apenas o **editor**, e apenas **para baixo** (rebaixar/adiar/cortar) ou nos bloqueios
**suaves** (amostra/intervalo/horizonte) **com nota registrada**. O mecanismo é o de
overrides já existente (`forecast_overrides` pin/mute/confidence + `editorialOverridden`)
— nenhum sistema novo.

### 6.3 Quando a sobreposição é permitida

Bloqueios **suaves** (D16 níveis 5, 7, 8): amostra insuficiente, intervalo extremo,
horizonte excessivo — liberáveis **com nota**. Rebaixar confiança, adiar publicação ou
cortar uma série: sempre permitido (é freio).

### 6.4 Quando a sobreposição é bloqueada

Bloqueios **duros** (D16 níveis 1, 2, 3, 4, 9, 11): dataset incompleto, `suspect_year`,
duplicata provável, placeholder, stale, expiração. **Nunca** overridáveis. Também
bloqueado: **elevar** confiança acima do motor, ou publicar previsão sobre série que o
gate duro reprovou. Automação de qualquer override é proibida no MVP (Decisão 8).

### 6.5 Auditar a decisão ao longo do tempo

- **Reprodutibilidade:** todo `Radar Result` reconstruível dos ids de campanha + config
  + versão de motor (`modelVersion`, `backtestVersion`).
- **Log de override:** autor, timestamp, motivo (nota), estado anterior/novo.
- **"O que mudou":** diff de snapshots (13 eventos) — motor canônico alterado, janela
  alterada, confiança alterada, aprovação alterada, publicação realizada, previsão
  expirada.
- **Métricas de calibração (Ev.4):** previsto × realizado (`prediction_outcome`),
  `windowHitRate` real, Brier. É o que fecha a premissa 4 de forma definitiva: o motor
  canônico passa a ser auditado contra a realidade, não só contra backtest.

---

## 7. Saída final

### 7.1 Recomendação — motor canônico

**Predict é o motor canônico do Radar** quando `readiness ∈ {ready,
ready_with_warnings}`. **Forecast é baseline obrigatório + fallback rotulado
("cadência aproximada") + instrumento de comparação — nunca manchete sozinho.**
Ambos bloqueados ou bloqueio duro a montante → **Não confirmado / monitoramento**.

Razão decisiva: **canonicidade se ganha por auto-medição**. Só o Predict mede o
próprio erro (backtest walk-forward). Manter o Forecast como fonte de previsão ao
leitor é publicar precisão que o motor não sabe verificar — exatamente a incoerência
da premissa 4.

### 7.2 Política de fallback

```
Predict ready / ready_with_warnings ............ Predict (canônico)
Predict bloqueado + Forecast editorialEligible . Forecast (fallback "cadência aproximada")
Ambos bloqueados ............................... Não confirmado (não publica)
Bloqueio duro a montante (completude/frescor/
  qualidade temporal) .......................... precede tudo → não publica
```
Fallback é sempre **rotulado** e **rebaixado** (nunca "alta confiança"), com
`fallback_used=true` no metadado. O Predict nunca é fallback do Forecast.

### 7.3 Política de bloqueio

- **Duro (nunca override, nunca automação):** dataset incompleto, `suspect_year`,
  duplicata provável crítica, placeholder, stale, expiração.
- **Suave (override com nota):** amostra insuficiente, intervalo extremo (≥540d),
  horizonte excessivo (>180d; >365 crítico).
- **Degradação (não corta, monitora):** insuficiência legítima, baixa confiança,
  divergência em revisão, amostra 3–4 ondas.
- **Corte total do bloco:** só quando nem o monitoramento é confiável (artefato
  ausente/corrompido). Caso contrário, **texto honesto**.

### 7.4 Matriz de decisão (critérios e faixas)

| Condição da série | Frescor | Amostra (ondas reais) | Confiança do motor | Divergência F×P (centro, c/ atenuação por janela) | **Decisão** | Como aparece |
|---|---|---|---|---|---|---|
| Base incompleta | qualquer | qualquer | qualquer | qualquer | **Bloqueia** (duro) | nada / alerta operador |
| Stale (>24h) | stale | qualquer | qualquer | qualquer | **Bloqueia** (duro) | "atualizado há X"; recálculo |
| `suspect_year` / dup. provável | qualquer | — (sai da série) | — | — | **Bloqueia** (duro) | nada; fila de dado |
| Predict ready, alta | fresh | ≥10 | alta | ≤14 compatível | **Publica** | previsão, faixa estreita |
| Predict ready, média | fresh | ≥6 | média | ≤14 / 15–30 | **Publica** (P30) | previsão, faixa média |
| Predict ready_with_warnings | fresh | ≥3 | baixa/média | ≤30 | **Publica c/ ressalva** ou monitoramento | previsão faixa larga + warning |
| Predict bloqueado, Forecast elegível | fresh | ≥5 (Forecast) | ≤ média | — | **Fallback** "cadência aproximada" | previsão rotulada, rebaixada |
| Insuficiente legítima | fresh | 3–4 | baixa | — | **Monitoramento** | "em observação", sem janela |
| Nova | fresh | 0–2 | insuficiente | — | **Só admin** | não aparece ao leitor |
| Divergência 15–30d | fresh | ok | ok | **warning** | **Publica c/ ressalva** | mostra ambos internamente; leitor vê faixa |
| Divergência >30d | fresh | ok | ok | **revisão** | **Humano decide** | monitoramento até revisão |
| Divergência >60d (janelas disjuntas) | fresh | ok | ok | **bloqueio** | **Bloqueia** até humano | nada |
| Ambos bloqueados | fresh | qualquer | insuficiente | — | **Não confirmado** | "sem janela; monitorando" |

**Nota de corte de publicação madura (composição — a peça que faltava):** uma série só
vira **previsão ao leitor** quando **todos** verdadeiros:
`datasetComplete ∧ fresh ∧ readiness∈{ready,ready_with_warnings} ∧ confiança≥média ∧
(backtest.observations≥3 → windowHitRate≥0,5) ∧ divergência∉{revisão,bloqueio} ∧
aprovação_editorial_vigente`. Abaixo disso: monitoramento ou corte honesto. Nunca previsão.

### 7.5 Texto curto de produto (uso interno)

> **Radar — política canônica em uma frase:** o Radar monitora sempre e prevê só
> quando pode medir. O motor canônico é o **Predict**, porque é o único que verifica
> a própria acurácia; o **Forecast** vira baseline e fallback rotulado ("cadência
> aproximada"), nunca manchete sozinho. Uma série só chega ao leitor como **previsão**
> quando passa por todos os portões duros — base completa, dado fresco, motor pronto,
> confiança ao menos média, acerto de backtest ≥50%, sem divergência crítica e com
> aprovação editorial vigente. Fora disso, o Radar diz a verdade menor: "estamos
> monitorando, ainda sem confiança para cravar uma janela". Nunca preenchemos silêncio
> com número, nunca prometemos ganho, e nunca mostramos a mesma série com duas
> verdades. Confiança se comunica pela faixa, pela amostra e pelo frescor — não por um
> número mágico. A recomendação (Vale agir / Esperaria / Evitaria) é sempre um ato
> editorial sobre a previsão, nunca uma saída automática do motor.

### 7.6 Riscos da escolha recomendada

1. **Erro de calibração do Predict amplificado ao leitor** — mitigado por gate humano
   (Decisão 8), nota de corte (backtest ≥0,5) e publicação só sobre série válida.
2. **Cobertura menor no curto prazo** — Predict é mais exigente que o Forecast atual;
   menos manchetes até o backfill melhorar. Aceito: menos e verdadeiro > mais e frágil.
3. **Fallback frequente ao Forecast mal lido** — mitigado pelo rótulo obrigatório
   "cadência aproximada" e rebaixamento de confiança.
4. **Sazonalidade não modelada** — o hazard não capta sazonal; risco de errar séries
   sazonais. Mitigado por confiança ≤ média + warning; curado no Predict v3.
5. **`d_max` mal calibrado** — faixas 14/30/60 podem gerar revisões demais/de menos.
   Reversível por config; monitorar taxa de divergência > d_max.
6. **Percepção de "menos preciso"** — faixa honesta pode parecer menos vendável que o
   ponto falso de hoje. Aceito: é o preço da confiança do leitor (premissa 6).
7. **Backtest ainda não é outcome real** — `windowHitRate` mede o passado, não o
   futuro publicado. Risco residual até a Ev.4 (outcomes). Mitigado por manter a
   automação desligada até calibração provada.

### 7.7 O que precisa existir tecnicamente

**Já existe (reusar):** `buildForecast`, `buildPredict`, `assessCampaignQuality`,
`editorialGate`, `assessForecastArtifact` (frescor), `composeRadarViewModel`
(reconciliação, divergência, primary probability), `radar-consistency`, overrides.

**Falta para a política operar por completo:**

| Item | Para quê | Fase |
|---|---|---|
| **Config canônica versionada** (d_max, gates por finalidade, TTLs, horizontes por superfície) | Um lugar só para a política; teste de paridade | Sem migration |
| **Rótulo `motorSelecionado` + `fallback_used` no artefato ao leitor** | Proveniência honesta; fallback visível | Sem migration |
| **Bloco do leitor honesto** (faixa, chance, bônus-faixa, amostra, frescor, invalidadores, disclaimer) | Fechar a premissa 6 | Sem migration (Ev.3) |
| **Generalizar `resolveRadar`** (degrade→monitoramento / corte honesto) para todas as superfícies | Nunca corte silencioso | Sem migration |
| **Snapshot canônico + aprovação persistida com TTL** | Daily/Weekly do mesmo snapshot; nota de corte com aprovação vigente | Migration (Ev.2, ADR-006) |
| **Consolidação rastreável Weekly←Daily** (diff de snapshots, "o que mudou") | Fechar a premissa 5 | Migration (Ev.2/3) |
| **`prediction_outcome`** (previsto × realizado, Brier) | Auditar o motor canônico contra a realidade; fechar a premissa 4 | Migration (Ev.4) |
| **Componente sazonal no Predict** | Séries sazonais sem fingir precisão | Estrutural (v3) |
| **Identidade/dedup persistidas** (ADR-009/010) | Curar a raiz; "ondas reais" no banco, não só runtime | Migration (P0 estrutural) |

Sequência: config + proveniência + bloco do leitor + degrade honesto (sem migration) →
snapshot/aprovação + consolidação Weekly (migration) → outcomes/calibração → sazonal.

---

## Anexo — rastreabilidade

- Motor canônico e fallback: `ADR-RADAR-008`, `DECISOES-PRODUTO-RADAR.md` D2/D4/D5,
  `APROVACAO-MVP-RADAR.md` Decisão 1.
- Faixas de divergência: `APROVACAO-MVP-RADAR.md` Decisão 2, `computeDivergence`.
- Gates de amostra: `ADR-RADAR-004`, `APROVACAO-MVP-RADAR.md` Decisão 5.
- Hierarquia de bloqueios (11 níveis): `DECISOES-PRODUTO-RADAR.md` §8.3 (D16).
- Reconciliação em runtime: `lib/radar-view-model.ts`.
- Comportamento honesto da Weekly (base do §4.4): `scripts/render-weekly.mjs`
  (`resolveRadar`).
