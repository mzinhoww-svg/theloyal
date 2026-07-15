# Arquitetura de Produto — Radar Preditivo de Campanhas (The Loyal)

> **Etapa de desenho.** Nenhum código, banco, migration, dado, backfill,
> snapshot ou conteúdo foi alterado. Este documento transforma os achados de
> `docs/AUDITORIA-PREDICT-FORECAST.md` no desenho do produto-alvo.
>
> **Evidência base:** auditoria de 2026-07-15 contra o ledger real
> (`campaigns`=2.438; `transferencia`=488; 140 sem data; 142 ativas invisíveis;
> `vigencia_inicio` nulo em 90%; 54% >18m; intervalo 943d em `livelo→connectmiles`;
> `forecast.json` gerado com 119 linhas; Predict não chega ao leitor; Daily radar
> manual; zero teste nos motores). Referência de spec: `docs/architecture/rfc/RFC-009-predict-engine-v2.md`.
>
> **Regra-mãe:** um único produto de inteligência de campanhas — uma fonte de
> verdade, uma camada de qualidade, uma camada de séries, motores internos,
> governança editorial e distribuição consistente. Forecast e Predict deixam de
> ser "duas telas" e viram **componentes internos** de um produto.

---

## 1. Resumo executivo

O The Loyal tem hoje dois motores desalinhados (`forecast` e `predict v2`) que
leem a mesma tabela sem camada de qualidade, sem política de datas, sem janela
histórica real e sem governança. O resultado são previsões que parecem
incoerentes: datas a 2028 tiradas de um único intervalo de 943 dias, campanhas
recentes invisíveis, radar semanal preso a um snapshot de 119 linhas, e um Daily
digitado à mão que contradiz o Weekly.

Este documento propõe o **Radar Preditivo de Campanhas**: um pipeline único
`Fontes → Extração → Campanha normalizada → Qualidade → Série → Modelos →
Reconciliação → Aprovação editorial → Snapshot canônico → Distribuição`, com
Predict como motor canônico, Forecast como fallback interno explícito, chave de
série hierárquica (rota com pooling parcial para o cluster), janela de modelagem
adaptativa com decaimento, tratamento de outlier por rebaixamento (nunca por
exclusão silenciosa), e um contrato de saída único que todos os consumidores
(Daily, Weekly, Pro, Admin) leem. A recomendação final está em §28; as decisões
que exigem o usuário, em §26.

---

## 2. Visão do produto

**Nome funcional:** **Radar Preditivo de Campanhas** (interno: "Radar").

- **Problema que resolve:** o leitor de milhas/pontos precisa saber *quando* a
  próxima campanha de uma rota tende a abrir e *qual* bônus esperar, com honestidade
  sobre a incerteza. Hoje isso é feito por intuição/manual.
- **Quem usa:** leitor (consome o bloco Radar na Digest), editor (seleciona e
  aprova o que publica), analista/operador (audita séries, motores e qualidade).
- **Decisões que suporta:** "esperar ou transferir agora?", "vale segurar pontos
  para a próxima janela?", "qual rota merece manchete esta semana?".
- **Valor ao leitor:** antecipação calibrada — "chance estimada de nova campanha em
  30 dias" com janela, bônus provável e confiança explicada.
- **Valor ao editor:** um radar único, aprovado, carimbado e reproduzível; nunca
  mais Daily e Weekly se contradizendo.
- **Valor ao analista:** rastreabilidade total — quais campanhas, quais datas,
  qual motor venceu, qual backtest, por que a confiança caiu.
- **O que o produto NÃO deve prometer:** data exata, garantia de campanha, bônus
  máximo como esperado, ganho. É projeção estatística, não veredito (alinhado à
  regra inviolável 3 da CLAUDE.md).

**Vocabulário canônico (distinções obrigatórias):**

| Conceito | Definição | Exemplo de UI |
|---|---|---|
| Dado observado | Campanha real registrada no ledger | "Última: Livelo→Smiles, 12/07, 80%" |
| Tendência | Padrão descritivo do histórico (cadência mediana) | "~a cada 30 dias" |
| Previsão | Estimativa de data/janela futura | "janela 8–24 ago" |
| Probabilidade | Chance condicional por horizonte | "42% em 30 dias" |
| Bônus provável | Moda/faixa empírica do percentual, ponderada por recência | "20–30% (mais recorrente 25%)" |
| Confiança | Qualidade da estimativa (amostra+CV+backtest) | "média — intervalos irregulares" |
| Alerta editorial | Estado que exige ação humana | "desatualizado", "Não confirmado" |

**Forecast/Predict visíveis?** **Não para o leitor.** Para o operador, viram
**rótulos de motor interno** dentro de uma única tela ("motor selecionado:
Predict / Forecast (fallback)"). O produto é um só; os nomes técnicos sobrevivem
apenas como metadado de proveniência.

---

## 3. Princípios (contrato inviolável do produto)

1. Não prever sem dados suficientes → `insufficient_history`.
2. Toda campanha sem data válida é **classificada explicitamente** (`data_confidence`), nunca usada silenciosamente.
3. Nunca misturar `data_anuncio` / `vigencia_inicio` / `vigencia_fim` / `data_publicacao` / `data_observacao` — cada uma tem papel próprio (§5).
4. Resultado que é distribuição/janela **nunca** vira data única.
5. Bônus máximo nunca apresentado como esperado.
6. Outliers nunca escondidos — visíveis e rebaixando confiança.
7. Snapshot stale nunca usado sem alerta de idade.
8. Daily e Weekly **nunca** apresentam previsões contraditórias (fonte única).
9. Duas telas nunca usam séries diferentes sem explicação de proveniência.
10. Backfill só é "concluído" com **cobertura mensurável**, não por fila esvaziada.
11. Sem limite arbitrário de 2.000 linhas como janela; janela é definida por política (§6).
12. Override sempre com justificativa e histórico append-only.
13. Previsão só é publicada após **gate editorial**.
14. Sem evidência suficiente → `Não confirmado`.
15. Toda previsão é **reproduzível** a partir dos registros usados (hash do dataset + IDs).

---

## 4. Arquitetura funcional alvo

Pipeline canônico (cada campanha nova percorre só o subconjunto afetado):

```
Fontes → Notícias → Extração → Campanha normalizada → Qualidade do dado
       → Série analítica → Modelos → Reconciliação → Aprovação editorial
       → Snapshot canônico → Daily / Weekly / Pro / Admin
```

| Camada | Objetivo | Entrada | Saída | Fonte de verdade | Regras | Estados | Falhas | Responsável | Indicadores | Critério de aceite |
|---|---|---|---|---|---|---|---|---|---|---|
| **Fontes** | descobrir conteúdo | portais/sitemaps | URLs | catálogo de fontes | fonte confiável, dedup de URL | descoberta/coletada | portal fora do ar | ingest/backfill | URLs/dia, cobertura | URL coletada e datada |
| **Notícias** | armazenar artigo | URL | `news_raw` | `news_raw` | 1 URL = 1 linha; `status` máquina de estados | pending→processed/error | fetch falho | ingest | backlog, taxa de erro | notícia com `published_at` |
| **Extração** | tirar campanhas do texto | `news_raw` | campanhas candidatas | edge fn `campaigns` | prompt versionado, `extraction_confidence`, datas rotuladas | ok/parcial/vazio | LLM alucina/omite | extrator | campanhas/notícia, confiança média | JSON válido + datas classificadas |
| **Campanha normalizada** | canonizar programas/tipos | candidata | linha canônica | catálogo `programs`/`aliases` | normProgram único, `dedup_key`, `wave_key` | novo/atualização/duplicata | alias desconhecido | normalizador | % normalizado, aliases pendentes | programa canônico resolvido |
| **Qualidade do dado** | rotular aptidão | linha canônica | `data_quality_status`, `include_in_prediction` | regras de qualidade | data válida? outlier? permanente? | ok/warning/blocked | data inválida não detectada | motor de qualidade | % válidas, % descartadas | campanha classificada, nunca silenciosa |
| **Série analítica** | montar histórico por chave | campanhas aptas | ondas + intervalos | camada de séries | `series_key` hierárquica, `collapseWaves` | ready/insufficient/incomplete | fragmentação artificial | camada de séries | ondas/série, cobertura | série reproduzível |
| **Modelos** | prever quando/quanto | série | Predict + Forecast | motores | readiness, backtest, outlier rebaixado | ready/warnings/blocked | previsão de 2028 de 2 pontos | Predict/Forecast | window hit, Brier | resultado com confiança justificada |
| **Reconciliação** | escolher motor | 2 resultados | resultado canônico | reconciliador | prioridade Predict>Forecast; divergência máx | selecionado/fallback/conflito | motores divergem sem regra | reconciliador | % fallback, divergência | 1 resultado por série+horizonte |
| **Aprovação editorial** | gate humano | resultado | status editorial | `edition`/gate | ready_with_warnings exige revisão | draft→approved/rejected | publicar sem gate | editor | tempo até aprovação | previsão aprovada e carimbada |
| **Snapshot canônico** | congelar p/ consumo | resultado aprovado | snapshot imutável | `prediction_snapshots` | hash dataset, expiração, superseded_by | generated→published→expired | snapshot stale usado | pipeline | idade média, % expirados | reproduzível a partir do snapshot |
| **Distribuição** | entregar ao consumidor | snapshot | bloco Radar | snapshot único | Daily/Weekly/Pro leem o mesmo | vigente/stale | Daily manual diverge | render | % Digests com Radar fresco | leitor vê resultado consistente |

---

## 5. Modelo de dados alvo (sem migração — só o alvo)

Campos-alvo de `campaigns` (ou tabela sucessora). O = observado, I = inferido,
C = calculado, E = editorial.

| Campo | Definição | Tipo | Obrig. | Origem | Escreve | Edita | Validação | Série | Modelo | UI |
|---|---|---|---|---|---|---|---|---|---|---|
| `programa_origem` | programa que cede pontos | text (FK `programs`) | sim | O | extrator | operador | ∈ catálogo | chave | — | rótulo |
| `programa_destino` | programa que recebe | text (FK) | sim | O | extrator | operador | ∈ catálogo | chave | — | rótulo |
| `tipo_campanha` | transferência/compra/clube/cartão… | enum | sim | O | extrator | operador | enum fechado | filtro/chave | — | filtro |
| `mercado` | BR/PT/US… | enum | sim | I | extrator | operador | enum | chave (opcional) | — | filtro |
| `pais` | país da campanha | enum | não | I | extrator | operador | ISO | chave (opcional) | — | filtro |
| `segmento` | público/segmentado/convite | enum | sim | I/E | extrator | operador | enum | chave (opcional) | separação | badge |
| `mecanica` | bônus %, ponto extra, multiplicador | enum | sim | I | extrator | operador | enum | chave (opcional) | — | badge |
| `bonus_base` | bônus público mínimo | numeric | não | O | extrator | operador | 0–1000 | — | Modelo B | número |
| `bonus_maximo` | teto anunciado | numeric | não | O | extrator | operador | ≥base | — | Modelo B | número (nunca como esperado) |
| `bonus_clube` | bônus para clube | numeric | não | O | extrator | operador | 0–1000 | separação | Modelo B | número |
| `bonus_cartao` | bônus condicionado a cartão | numeric | não | O | extrator | operador | 0–1000 | separação | Modelo B | número |
| `vigencia_inicio` | início da validade | date | não | I | extrator | operador | ≤fim | ordenação (1ª) | data | data |
| `vigencia_fim` | fim da validade | **date** (não text) | não | I | extrator | operador | ≥início | ordenação (fallback) | data | data |
| `data_anuncio` | quando a campanha foi anunciada | date | não | I | extrator | operador | plausível | ordenação (alt.) | data | data |
| `data_publicacao` | data do artigo-fonte | date | não | O | ingest | — | ≤hoje | nunca âncora | proveniência | metadado |
| `data_observacao` | quando o sistema viu | date | sim | C | extrator | — | =hoje da extração | nunca âncora | — | metadado |
| `data_evento` | **data canônica da série** (resolvida) | date | não | C | qualidade | — | derivada | **âncora** | âncora | data principal |
| `data_evento_source` | de onde veio `data_evento` | enum (§5) | sim | C | qualidade | — | enum | qualifica | qualifica | badge |
| `data_confidence` | confiança da data | enum | sim | C | qualidade | operador | enum | gate | gate | badge |
| `series_key` | chave analítica canônica | text | sim | C | séries | — | determinística | identidade | identidade | — |
| `dedup_key` | chave de deduplicação | text | sim | C | normalizador | — | determinística | dedup | — | — |
| `wave_key` | agrupador de onda | text | sim | C | séries | — | determinística | onda | onda | — |
| `source_count` | nº de fontes que confirmam | int | sim | C | normalizador | — | ≥1 | confiança | confiança | número |
| `extraction_confidence` | confiança do LLM | enum | sim | I | extrator | — | enum | qualidade | — | badge |
| `data_quality_status` | estado de qualidade | enum (§12) | sim | C | qualidade | operador | enum | gate | gate | badge |
| `include_in_prediction` | entra no motor? | bool | sim | C | qualidade | operador (com justificativa) | — | filtro | filtro | toggle |
| `prediction_exclusion_reason` | por que fora | text/enum | não | C/E | qualidade | operador | enum+livre | explica | explica | tooltip |
| `origin_pipeline` | backfill/daily/manual | enum | sim | C | ingest | — | enum | proveniência | — | badge |
| `first_seen`/`last_seen` | primeira/última observação | date | sim | C | upsert | — | preservado no upsert | — | atualidade | metadado |

**Preservados no upsert:** `first_seen`, fontes, campos editoriais, valores
observados anteriores (histórico de bônus), `data_quality_status` editado.

---

## 6. Política de datas

Definições canônicas:

- `data_anuncio` — quando o programa anunciou a campanha (pode preceder o início).
- `vigencia_inicio` — início da validade da oferta.
- `vigencia_fim` — fim da validade.
- `data_publicacao` — data do artigo-fonte (proveniência editorial, **nunca âncora**).
- `data_observacao` — quando o sistema extraiu (**nunca âncora**).
- `data_evento` — **data canônica resolvida** que ordena a série (calculada).

Enumeração `data_evento_source`:

```
exact_start            # vigencia_inicio válida  → usa início
exact_end              # só vigencia_fim válida  → usa fim (marcado)
announcement_date      # só data_anuncio válida
source_publication_date# só data_publicacao (último recurso, baixa confiança)
inferred               # LLM inferiu sem texto explícito
permanent              # campanha sem fim ("na") mas ativa e datada
missing                # sem nenhuma data → NÃO entra
invalid                # data implausível/invertida → NÃO entra
```

Respostas:

1. **Qual ordena a série?** `data_evento`, resolvida por prioridade
   `exact_start > announcement_date > exact_end`. **Muda o comportamento atual**,
   que usa o fim em 90% dos casos.
2. **Fallback permitido?** `exact_end` e `announcement_date` (marcados como tais);
   `source_publication_date` só com confiança `baixa` e nunca como manchete.
3. **Quando usar início?** Sempre que `vigencia_inicio` for válida (é o ideal).
4. **Quando usar fim?** Só quando não há início nem anúncio — e sinalizado.
5. **Permanente entra?** Sim, como `permanent`, com `data_evento = data_anuncio`
   ou `first_seen`; conta como estado, não como onda de cadência (§11/§12).
6. **`vigencia_fim='na'`?** Reclassificar: `na` = permanente (não descartar!).
   Hoje as 142 ativas caem justamente aqui — precisam entrar como `permanent`.
7. **Sem início?** Tenta anúncio, depois fim; se nenhum, `missing` → fora do motor,
   **visível no admin** com motivo.
8. **Página recente citando campanha antiga?** `data_publicacao` recente não vira
   `data_evento`; a resolução usa a vigência mencionada. Se só há a data do
   artigo, confiança `baixa` e regra anti-erro-de-ano (item 9).
9. **Erro de ano?** Detectar se `data_evento` diverge do `data_publicacao` por
   >18 meses **e** a fonte é recente → flag `suspect_year`.
10. **Troca dia/mês?** Se `dd`≤12 e `mm`≤12 e a data destoa da vizinhança da série
    → flag `suspect_daymonth` para revisão (não corrige automático).
11. **Confiança da data:** `alta` (exact_start), `media` (announcement/exact_end),
    `baixa` (publication/inferred), `nenhuma` (missing/invalid).
12. **Quando bloquear do motor?** `missing`, `invalid`, e `suspect_*` até revisão.

**Podem entrar em previsão:** `exact_start`, `exact_end`, `announcement_date`,
`permanent` (como estado). **Não entram:** `source_publication_date` como
manchete, `inferred` baixo, `missing`, `invalid`, `suspect_*`.

---

## 7. Janela histórica

| Alternativa | Cobertura | Estabilidade | Sensib. a mudança | Risco de antigo | Impacto backtest | Séries raras |
|---|---|---|---|---|---|---|
| 18 meses fixos | média | alta | média | baixo | ok | perde cauda |
| 24 meses fixos | alta | alta | baixa | médio | ok | melhor |
| Histórico completo | máxima | baixa | baixa | **alto** (o 943d) | ruído | mistura regimes |
| Completo com decaimento | máxima | média | alta | controlado | bom | preserva sinal recente |
| **Adaptativa por série** | ótima | média-alta | alta | controlado | bom | ajusta à cadência |

**Recomendação: janela de modelagem adaptativa com decaimento por recência.**
O Predict já pondera por recência (meia-vida 4 eventos) — a janela deve ser
`max(24 meses, N últimas ondas suficientes para a cadência da série)`, com peso
exponencial. Assim uma rota mensal usa ~24 meses; uma rota esparsa (2–3/ano) pode
olhar mais atrás sem que o intervalo antigo domine, porque o decaimento o rebaixa.

Diferenciação obrigatória de janelas:

```
janela de coleta       → o que o ingest busca (recente, contínuo)
janela de backfill      → o que o crawl histórico cobre (alvo: 24m, mensurável §8)
janela de armazenamento → tudo é guardado (histórico completo, nada apagado)
janela de modelagem     → adaptativa + decaimento (o que o motor pondera)
janela exibida ao operador → configurável, default 24m, com toggle "ver tudo"
```

---

## 8. Backfill e completude

Estados discretos do funil (substituem o "progresso = URLs"):

```
URL descoberta → URL coletada → notícia extraída → campanha encontrada
→ campanha com data válida → campanha normalizada → campanha incluída em série
```

- **Métricas de cobertura:** por programa, por mês (calendário), por par
  origem→destino. `coverage[programa][mês]` = meses com ≥1 campanha datada / meses
  esperados na janela de backfill.
- **`backfill_completeness`** (0–1) por série = fração de meses da janela de
  backfill com cobertura confirmada (ou densidade esperada atingida). Global =
  média ponderada por relevância editorial dos programas.
- **`backfill_incomplete`** na série quando `completeness < limiar` (ex. 0,7) **ou**
  há buraco > 2× a cadência mediana sem evidência de silêncio real.
- **Predict bloqueado** quando `backfill_incomplete` e o buraco afeta o horizonte
  previsto (ex. o 943d: o modelo não pode afirmar que houve silêncio real vs
  lacuna de coleta).
- **Forecast como fallback interno** quando Predict bloqueia por completude mas há
  ≥ amostra mínima de ondas datadas — com rótulo "base incompleta".
- **Apresentação no admin:** heatmap programa × mês (verde=coberto,
  amarelo=esparso, vermelho=vazio), e por série a barra de completude + lista de
  meses ausentes.

"Backfill concluído" = `completeness ≥ alvo` por programa, **não** fila vazia.

---

## 9. Normalização e aliases

Entidades canônicas (catálogo, fonte única para os dois motores):

```
programs        (code PK, display_name, pais, tipo, ativo|extinto, since, until)
program_aliases (alias, program_code FK, origem_do_alias, deprecated, created_by, created_at)
partners        (code, display_name, programs[])           # bancos/varejo
markets         (code, display_name, pais)
segments        (code, display_name)                        # publico|clube|convite…
campaign_mechanics (code, display_name)                     # bonus%|ponto_extra|multiplicador…
```

Definições: `code` canônico (slug), `display_name` editorial, `aliases`
(inclui grafias e nomes antigos), `pais`, `tipo`, `ativo/extinto`, regras de
normalização (trim+lower+colapso de espaço → lookup em `program_aliases` →
`code`), valores desconhecidos → `unknown` **explícito** (nunca `desconhecido`
silencioso) e flag `alias_pending` para revisão.

**Como impedir normalização divergente:** os dois motores **importam a mesma
função `normalize()` do catálogo** (não mais o `PROGRAM_ALIASES` hardcoded em
`lib/forecast.ts`). Qualquer alteração de alias é auditada (`program_aliases`
append-only + `alias_events`).

---

## 10. Deduplicação

A chave atual `origem+destino+tipo+vigencia_fim` é insuficiente (URL fora da
chave; colide waves de mesmo fim; duplica em reprocesso com fim diferente).

`dedup_key` proposta (identidade da **instância** de campanha):

```
dedup_key = hash(programa_origem, programa_destino, tipo_campanha, mercado,
                 segmento, mecanica, vigencia_inicio, vigencia_fim,
                 bonus_base, bonus_maximo)
```

`content_hash = hash(texto normalizado da oferta na fonte)` — auxilia dedup por
conteúdo. `source_id` (portal+URL) fica em `sources[]`, fora da chave.

| Caso | Definição | Ação |
|---|---|---|
| Duplicata exata | mesma `dedup_key` | upsert, incrementa `source_count`, mescla `sources[]` |
| Duplicata provável | mesma origem/destino/tipo/mecânica/segmento + datas ~ (±3d) + bônus igual | mescla como mesma **onda** (§11), mantém ambos os registros ligados |
| Atualização da mesma campanha | mesma `dedup_key` com bônus/fim alterado | versiona: guarda valor anterior em `observed_history[]`, atualiza atual |
| Republicação | nova fonte, mesma oferta | adiciona a `sources[]`, `last_seen`=hoje, `first_seen` preservado |
| Semelhante mas diferente | difere em segmento/mecânica/bônus estrutural | **registros distintos** |
| Segmentada | mesmo par mas `segmento≠publico` | série própria (§7 do segmento) ou tag |
| Permanente | sem fim, contínua | 1 registro `permanent`, atualiza `last_seen` |

**Upsert preserva:** `first_seen`, `sources[]`, campos editoriais
(`verdict`/`tl_score`/notas), `observed_history[]` de bônus, `data_quality_status`
editado, e grava `change_log` append-only.

---

## 11. Chave analítica da série

| Alternativa | Granularidade | Cobertura | Fragmentação | Mistura | Amostras | Explicab. | Interv. artif. | Leitor |
|---|---|---|---|---|---|---|---|---|
| `origem→destino` (rota) | alta | baixa | **alta** (943d) | baixa | poucas | alta | **alto** | preciso mas raro |
| `→destino` (cluster) | baixa | alta | baixa | **alta** (parceiros) | muitas | média | baixo | genérico demais |
| `origem+destino+tipo` | alta | baixa | alta | baixa | poucas | alta | alto | preciso |
| `origem+destino+mercado+segmento+mecânica` | máxima | mínima | máxima | nenhuma | mínimas | alta | máximo | específico demais |
| **rota + cluster hierárquico (pooling parcial)** | ajustável | alta | controlada | controlada | ok | alta | **baixo** | melhor |

**Chave canônica recomendada: `series_key` de rota**
`programa_origem|programa_destino|tipo_campanha|mercado|segmento|mecanica`, **com
pooling parcial hierárquico para o cluster de destino** quando a rota é rala.

Regra de decisão (resolve o caso 943d):

```
se rota tem ondas suficientes e cobertura ok        → série de ROTA
senão, se cluster de destino tem ondas suficientes  → série de DESTINO (rótulo "programa-wide")
                                                       com shrinkage: a rota herda a
                                                       cadência do cluster, ajustada
senão                                                → nenhuma previsão (Não confirmado)
```

No caso `livelo→connectmiles` (2 ondas, 943d), a rota **não** prevê sozinha; o
sistema cai para o cluster `→connectmiles` (4 ondas, incluindo esfera), que
mostra cadência real e evita o intervalo artificial. O leitor vê "ConnectMiles
(via Livelo/Esfera)", não uma data a 2028.

- **Série de rota:** cobertura suficiente na própria rota.
- **Série de destino:** rota rala, cluster rico.
- **Fallback hierárquico:** rota herda cluster com shrinkage.
- **Pooling parcial:** peso entre rota e cluster proporcional à amostra da rota.
- **Nenhuma previsão:** ambos insuficientes.

---

## 12. Ondas de campanha

Onda = uma mesma "movimentação" que aparece em várias origens/fontes quase ao
mesmo tempo. A regra atual (colapso ≤3 dias, data mais antiga) é ponto de partida,
mas precisa de chave explícita.

`wave_key = hash(programa_destino, tipo_campanha, mecanica, janela_temporal(±ε), segmento)`

Critérios de mesma onda: mesmo destino + mesma mecânica + mesmo segmento +
datas dentro de ε (default 3 dias, configurável) — **mesmo com origens/fontes
diferentes**. Permanecem separadas quando: mecânica/segmento diferentes, ou bônus
estruturalmente distinto, ou fora de ε.

Campos da onda: `wave_key`; **data da onda** = menor `data_evento` do grupo;
**bônus da onda** = distribuição dos bônus (base/máx por origem), não um número;
**fontes** = união; **campanha principal** = a de maior `source_count`/confiança;
**relacionadas** = as demais. Republicação e extensão de vigência → mesma onda
(atualiza), não nova onda.

---

## 13. Qualidade da série

Estado `series_quality` (calculado, com override editorial auditado):

```
insufficient_history   # < amostra mínima de ondas datadas
backfill_incomplete    # completeness < alvo ou buraco > 2× cadência sem evidência
data_quality_blocked   # % descartadas alto, datas suspeitas, duplicatas não resolvidas
ready_with_warnings    # ready mas com ressalvas (CV alto, outlier, backtest fraco)
ready                  # apto sem ressalvas
stale                  # snapshot além da expiração
superseded             # substituído por snapshot mais novo
```

| Estado | Condição | Efeito Forecast | Efeito Predict | Interface | Digest | Override |
|---|---|---|---|---|---|---|
| insufficient_history | ondas < mín | em-formacao | bloqueia | "histórico insuficiente" | Não confirmado | não |
| backfill_incomplete | completude baixa | fallback c/ ressalva | bloqueia | banner cobertura | Não confirmado / base incompleta | sim (com justificativa) |
| data_quality_blocked | datas/dupes ruins | bloqueia | bloqueia | lista de problemas | oculto | sim (após correção) |
| ready_with_warnings | ressalvas | ok c/ nota | ok c/ warnings | warnings visíveis | com ressalva + gate | sim |
| ready | ok | ok | ok | verde | elegível | n/a |
| stale | expirado | recomputa | recomputa | alerta idade | recomputa ou some | n/a |
| superseded | novo snapshot | — | — | link p/ novo | usa novo | n/a |

Fatores do score: nº de ondas, cobertura histórica, % datas exatas vs inferidas,
duplicatas, outliers, consistência (CV), atualidade da última campanha,
distribuição de origens, campanhas permanentes, % descartadas,
`backfill_completeness`.

---

## 14. Tratamento de outliers

| Técnica | Prós | Contras |
|---|---|---|
| Cap fixo de intervalo | simples | arbitrário, apaga sinal |
| IQR | robusto | ruim em amostra pequena |
| MAD | robusto, já existe no Shopping | precisa n≥3 |
| Winsorization | preserva massa | ainda distorce |
| Modelos robustos | principiado | complexo |
| **Não remover, rebaixar confiança** | honesto, princípio 6 | menos "limpo" |
| Separação de regime | detecta mudança estrutural | precisa de dados |

**Recomendação: detectar (MAD/IQR) + rebaixar confiança + segregar regime,
nunca excluir silenciosamente.** Um intervalo é marcado `outlier` quando desvia
> k·MAD da mediana da série. Efeitos:

- **Detecção:** MAD sobre intervalos (n≥3); abaixo disso, marca `sparse`.
- **Apresentação:** onda/intervalo destacado no admin ("943d — possível lacuna
  de backfill") e nota na Digest.
- **No modelo:** **mantido no histórico**, mas (a) rebaixa confiança e (b) aciona
  a regra hierárquica (§11) — se o outlier vem de fragmentação de rota, cai para
  cluster. Só é **excluído** por decisão humana com justificativa registrada.
- **Backtest:** o walk-forward considera o outlier como ponto real (não trapaceia
  removendo-o), mas reporta o erro que ele causa.
- **Outlier real vs mudança estrutural:** se os intervalos recentes formam novo
  patamar consistente → `regime_change` (usa só o regime novo); se é ponto
  isolado → `outlier`. O caso 943d é lacuna de cobertura (§16), não regime.

A proposta **não apaga** intervalos longos — ela os explica, rebaixa e reencaminha.

---

## 15. Papel do Forecast

**Decisão: Forecast = baseline/fallback interno, nunca manchete sozinho.**

- **Amostra mínima:** subir para **≥3 ondas** (alinha com Predict; hoje é 2 e gera
  janela de 1 intervalo).
- **Janela histórica:** mesma política adaptativa+decaimento (§6).
- **Outlier:** herda §14 (rebaixa, não exclui).
- **Confiança:** nunca "alta" sem backtest; janela nunca ±3d de 1 intervalo —
  `half` mínimo proporcional à dispersão real ou à incerteza de amostra pequena.
- **Backtest mínimo:** exigir ≥3 observações walk-forward para chegar ao leitor.
- **Chega ao leitor?** Só como fallback rotulado ("base incompleta / cadência
  aproximada") quando Predict bloqueia mas há amostra. Caso contrário, só admin.
- **Como impedir previsão de 2028 de 2 campanhas:** minSamples 3 + regra
  hierárquica (§11) + cap de horizonte editorial (não publicar janela > X meses
  sem revisão) + rebaixamento por outlier.

Forecast vira o **motor barato e explicável** para cobertura ampla no admin e
fallback; deixa de disputar a manchete com o Predict.

---

## 16. Papel do Predict

**Decisão: Predict = motor canônico.**

- **Quando canônico:** sempre que `readiness ∈ {ready, ready_with_warnings}`.
- **Readiness:** implementar de fato `backfill_incomplete` e `data_quality_blocked`
  (hoje declarados e nunca atribuídos).
- **Configuração:** promover `DEFAULT_PREDICT_CONFIG` para `predict_config`
  persistido e editável (hoje é hardcoded).
- **Backtest:** walk-forward obrigatório; expor por série (hoje só na 1ª).
- **Probabilidades:** manter hazard monotônico condicional a `days_since_last`.
- **Bônus:** distribuição top-3 + faixa; separar base/máx/clube/cartão (novos campos §4).
- **Censura/recência:** manter `days_since_last` e meia-vida; recência agora
  interage com janela adaptativa (§6).
- **Outliers:** §14.
- **Brier/calibração:** adicionar Brier por horizonte e curva de calibração ao
  backtest (hoje só window-hit e erro de data).
- **Versionamento:** `model_version` + `config_version` + `dataset_hash` no snapshot.
- **Snapshot/expiração:** §18.
- **Como chega à Digest:** via reconciliador → snapshot aprovado (§16-17-25),
  nunca direto.

**Horizontes:** avaliar. `7,15,30,60,90,180` é técnico. Recomendação editorial:
**expor ao leitor `30`, `60`, `90`** (o que cabe em decisão de transferir/esperar)
e **manter `7,15,180` internos** para o Pro/admin. O Daily usa 7–30; o Weekly,
30–90; o Pro, todos.

---

## 17. Reconciliação entre motores

```
Predict ready                       → usa Predict (canônico)
Predict ready_with_warnings         → usa Predict + ressalvas + gate editorial
Predict blocked + Forecast elegível → usa Forecast (fallback rotulado)
Ambos blocked                       → Não confirmado
```

- **Prioridade:** Predict > Forecast > Não confirmado.
- **Divergência máxima aceitável:** se ambos rodam e a data central diverge >
  `d_max` (ex. 30 dias) ou a confiança diverge de "alta" para "baixa" → **flag de
  divergência** e revisão obrigatória.
- **Quando exigir revisão:** `ready_with_warnings`, divergência acima do limiar,
  outlier ativo, backfill incompleto.
- **Quando bloquear:** ambos blocked, ou `data_quality_blocked`.
- **Registro:** o resultado canônico grava `model.selected`, `model.fallback_used`,
  `model.divergence`, e o resultado do motor perdedor para auditoria.
- **Apresentar fallback:** rótulo explícito ("cadência aproximada — Predict sem
  base suficiente").
- **Impedir Daily×Weekly divergentes:** **os dois leem o mesmo snapshot
  canônico** (§18/§25). Nunca recalculam independentemente.
- **Versionar decisão:** `reconciler_version` no snapshot.

---

## 18. Contrato canônico (saída única)

Todos os consumidores leem este objeto. `null` permitido onde marcado.

```json
{
  "series_key": "livelo|connectmiles|transferencia|BR|publico|bonus_pct",  // obrig.
  "series_type": "route",                     // route|cluster  (obrig.)
  "resolved_from": "cluster_fallback",        // route|cluster_fallback|pooled (obrig.)
  "as_of": "2026-07-15",                       // obrig.
  "dataset_hash": "sha256:…",                  // obrig. (reprodutibilidade)
  "campaign_ids": ["…"],                       // obrig. (registros usados)
  "model": { "selected": "predict", "version": "campaign_predict_v2",
             "config_version": "…", "fallback_used": false, "divergence": null },
  "readiness": "ready_with_warnings",          // obrig.
  "confidence": "media",                        // obrig.
  "confidence_reasons": ["intervalos irregulares (CV=0.98)", "backtest 3 obs"],
  "data_quality": { "campaigns_total": 4, "waves_total": 4, "exact_dates": 0,
                    "inferred_dates": 4, "outliers": 1, "backfill_completeness": 0.6 },
  "last_observed_campaign": { "date": "2026-07-12", "bonus_base": 40, "bonus_max": null },
  "probabilities": { "p7": null, "p15": null, "p30": 0.31, "p60": 0.55,
                     "p90": 0.70, "p180": null },   // null = horizonte não exposto/insuf.
  "window": { "start": "2026-08-08", "center": "2026-08-20", "end": "2026-09-02" },
  "bonus": { "expected": null, "range_low": 40, "range_high": 75,
             "candidates": [ {"value":40,"probability":0.4}, {"value":75,"probability":0.3} ],
             "base_vs_max_note": "faixa observada; máximo não é esperado" },
  "warnings": ["backfill_incomplete", "outlier_943d"],
  "editorial_status": "needs_review",          // obrig.
  "expires_at": "2026-07-22",                   // obrig.
  "superseded_by": null
}
```

**Obrigatórios:** `series_key`, `series_type`, `as_of`, `dataset_hash`,
`campaign_ids`, `model.selected`, `readiness`, `confidence`, `editorial_status`,
`expires_at`. **Nuláveis:** probabilidades por horizonte não exposto, `window`
(quando blocked), `bonus.expected` (quando só há faixa), `superseded_by`.

---

## 19. Snapshot canônico

Tabela `prediction_snapshots` (sucede/unifica `forecast_snapshots` +
`predict_snapshots`). Registra: `dataset` usado, `campaign_ids`, `dataset_hash`,
`series_key`, `config` (+`config_version`), `model`(+`version`),
`reconciler_version`, `as_of`, `result` (o contrato §18), `backtest`,
`data_quality`, `overrides`, `editorial_approval` (quem/quando),
`expires_at`, `superseded_by`, `created_by`, `approved_by`.

Máquina de estados:

```
draft → generated → needs_review → approved → published → expired
                                  ↘ rejected            ↘ superseded
```

**Reprodutibilidade:** dado `dataset_hash` + `campaign_ids` + `config_version` +
`model.version` + `reconciler_version`, qualquer um recomputa o mesmo resultado.
Nada de "reler a tabela de novo" — o snapshot fixa os registros exatos.

---

## 20. Administração unificada

Uma área **Radar** (funde `/admin/forecast` + `/admin/predict` + partes de
`/admin/observability`).

**Visão geral** — objetivo: pulso do produto. Dados: séries ready/blocked/warning/stale,
divergências, cobertura de backfill (heatmap), última atualização, previsões em
uso na Digest. Ações: recalcular tudo, ir para série. Permissões: operador+editor.
Alertas: séries stale, divergências, backfill incompleto. Vazio: "sem séries
prontas". Auditoria: quem recalculou.

**Séries (lista)** — dados: origem, destino, tipo, mercado, segmento, mecânica,
nº campanhas, nº ondas, última campanha, maior intervalo, qualidade, readiness,
motor selecionado, confiança, status editorial. Ações: filtrar/ordenar, abrir.
Alertas: badges de estado. Vazio: por filtro.

**Detalhe da série** — dados: campanhas usadas + **excluídas (com motivo)**, datas
(com `data_evento_source`), fontes, ondas, intervalos (outlier destacado),
Forecast, Predict, backtest, probabilidades, bônus (base/máx/clube separados),
warnings, histórico de snapshots, overrides, auditoria. Ações: §20 abaixo.
Confirmações: em ações destrutivas/publicação. Auditoria: timeline completa.

**Qualidade dos dados** — dados: campanhas sem data, antigas, duplicatas, aliases
pendentes, datas suspeitas, backfill incompleto (por programa/mês), notícias sem
campanha, campanhas descartadas. Ações: corrigir alias, reprocessar notícia,
marcar outlier, restaurar. Alertas: filas de revisão.

**Configuração** — dados: janela histórica, amostra mínima, epsilon de onda,
limiares de CV, tratamento de outlier, horizontes, backtest mínimo, expiração,
regras de fallback. Ações: editar (com justificativa+versão). Permissões: editor.
Auditoria: `config_version` histórico.

---

## 21. Ações administrativas

| Ação | Papel | Pré-condição | Efeito | Reversível | Confirma | Justif. | Auditoria | Falhas |
|---|---|---|---|---|---|---|---|---|
| Recalcular série | operador | série existe | novo resultado draft | sim | não | não | sim | dataset vazio |
| Recalcular todas | operador | — | recomputa afetadas | sim | sim | não | sim | timeout |
| Gerar snapshot | operador | resultado ready | snapshot generated | sim | não | não | sim | qualidade blocked |
| Comparar motores | operador | ambos rodam | view diff | n/a | não | não | log | um bloqueado |
| Aprovar previsão | editor | needs_review | published | sim (expira) | sim | recomendada | sim | expirada |
| Rejeitar previsão | editor | needs_review | rejected | sim | sim | **obrig.** | sim | — |
| Expirar previsão | editor | published | expired | não | sim | sim | sim | em uso na Digest |
| Marcar outlier | operador | ponto existe | rebaixa/segrega | sim | não | **obrig.** | sim | — |
| Restaurar campanha | operador | excluída | reinclui | sim | sim | **obrig.** | sim | — |
| Corrigir alias | editor | alias pendente | recanoniza + recomputa | sim | sim | sim | sim | colisão |
| Reprocessar notícia | operador | notícia existe | re-extrai | sim | não | não | sim | LLM falha |
| Vincular campanha a série | operador | campanha órfã | entra na série | sim | sim | **obrig.** | sim | chave errada |
| Separar campanha da série | operador | na série | sai da série | sim | sim | **obrig.** | sim | — |
| Mesclar ondas | operador | 2 ondas | 1 onda | sim | sim | **obrig.** | sim | — |
| Separar ondas | operador | 1 onda | 2 ondas | sim | sim | **obrig.** | sim | — |
| Aplicar override | editor | série | força motor/confiança | sim | sim | **obrig.** | append-only | — |
| Remover override | editor | override existe | volta ao motor | sim | sim | sim | append-only | — |
| Fixar motor | editor | ambos rodam | trava seleção | sim | sim | **obrig.** | sim | — |
| Silenciar série | editor | série | fora da Digest | sim | não | sim | sim | — |
| Promover p/ Daily/Weekly/Pro | editor | approved+fresh | entra no draft | sim | sim | não | sim | stale |
| Ver uso editorial | todos | — | mostra onde publicado | n/a | não | não | log | — |
| Ver histórico | todos | — | timeline | n/a | não | não | — | — |
| Exportar evidências | todos | snapshot | JSON+IDs+hash | n/a | não | não | log | — |

Override **sempre** com justificativa e histórico append-only (princípio 12).

---

## 22. Experiência no admin (hierarquia de informação)

Ordem visual no **detalhe da série** (o operador responde tudo sem ler código):

1. **Cabeçalho:** série (rótulo legível) · motor selecionado · confiança · status editorial · "atualizado há X / expira em Y".
2. **Veredito do Radar:** janela (start–center–end) · P30/P60/P90 · bônus provável (faixa) — com rótulos.
3. **Por que:** `confidence_reasons` + `warnings` (outlier, backfill incompleto) em destaque.
4. **Base:** nº campanhas usadas · nº ondas · última campanha (data+bônus) · período analisado · % datas exatas vs inferidas.
5. **Cadência:** intervalos (sparkline) com **outlier marcado** · maior intervalo.
6. **Motores lado a lado:** Predict vs Forecast + backtest (window-hit, erro mediano, Brier).
7. **Dados:** campanhas usadas / **excluídas (com motivo)** / fontes / cobertura de backfill (meses ausentes).
8. **Governança:** overrides (quem/por quê) · quem aprovou · onde está publicado · exportar evidências.

Mapa pergunta→onde: 1(4) 2(4) 3(4) 4(7) 5(7) 6(5) 7(5) 8(1/6) 9(3) 10(6) 11(2)
12(2) 13(1) 14(3) 15(1) 16(8) 17(8) 18(8).

---

## 23. Experiência na Digest

| | Daily | Weekly | Pro |
|---|---|---|---|
| Mostrar | 1–3 alertas curtos, janela + bônus provável + confiança | radar 30–90d, deltas vs semana anterior, novos sinais | curva P completa, backtest, histórico, comparação, bônus trend |
| Ocultar | probabilidade fina, backtest, séries baixa confiança | detalhe estatístico bruto | nada (é o produto técnico) |
| Linguagem | "tende a abrir entre X e Y" | "chance estimada … base …" | técnica, com metodologia |
| Janela | faixa | faixa + centro | faixa + distribuição |
| Probabilidade | oculta ou "alta/média chance" | "42% em 30 dias" | P7…P180 |
| Bônus | "mais recorrente 25%" | faixa 20–30% | distribuição + histórico |
| Confiança | badge + 1 motivo | badge + motivo | completa |
| Última campanha | sim | sim | sim |
| Amostra | implícita | "7 campanhas desde jan/2024" | completa |
| Atualização | "atualizado hoje" | carimbo | carimbo + hash |
| Warning | só se relevante | sim | sim |
| Disclaimer | **obrigatório** (regra 10) | obrigatório | obrigatório |
| Link metodologia | sim | sim | sim |

Linguagem-modelo (avaliada e aprovada):

```
Chance estimada de nova campanha nos próximos 30 dias: 42%.
Janela mais provável: 8 a 24 de agosto.
Base: 7 campanhas observadas desde janeiro de 2024.
Confiança: média, devido à irregularidade dos intervalos.
Bônus mais recorrente: entre 20% e 30%.
```

Estados textuais:

```
Não confirmado            → ambos os motores bloqueados
Histórico insuficiente    → < amostra mínima
Base histórica incompleta → backfill_incomplete
Previsão desatualizada    → snapshot além de expires_at
```

---

## 24. Daily, Weekly e Pro (responsabilidades)

- **Daily:** só alertas de **curto prazo (7–30d)**, poucas séries, **apenas
  previsão aprovada e fresca**, linguagem curta, **proibido** resultado de baixa
  confiança sem contexto. Refino: incluir "o que mudou desde ontem" só se houver
  sinal forte.
- **Weekly:** radar **30–90d**, séries que ganharam/perderam confiança, novos
  sinais, séries bloqueadas relevantes ("silêncio incomum"). Refino: seção
  "movimentos da semana" (deltas de confiança/janela).
- **Pro:** histórico, curva de probabilidades, backtest, comparação entre
  programas, explicação do modelo, exportação, tendências de bônus. Refino:
  incluir calibração e concordância Forecast×Predict como diferencial analítico.

Divisão aprovada com esses refinos.

---

## 25. Integração com Digests

**Fonte única:** o bloco Radar de Daily, Weekly e Pro vem **sempre** de
`prediction_snapshots` com `editorial_status=published` e não expirado. Fim do
Daily manual e do Weekly lendo arquivo antigo.

- **Seleção automática:** o pipeline sugere ao `edition_draft` as séries elegíveis
  (aprovadas, frescas, dentro do horizonte do produto).
- **Seleção manual:** editor adiciona/remove do draft, sempre a partir de snapshots
  aprovados (não digita números).
- **Aprovação:** já feita no snapshot; o draft referencia `snapshot_id`.
- **Expiração:** ao renderizar, se o snapshot expirou → recomputa ou marca
  "desatualizado"; nunca publica silenciosamente.
- **Carimbo:** cada bloco carrega `as_of` + "atualizado em".
- **Fallback:** se não há snapshot fresco → "Não confirmado" / omite, nunca inventa.
- **Bloqueio:** série `data_quality_blocked` não entra.
- **Provenance:** o draft grava `snapshot_id` + `dataset_hash`; a edição publicada
  é **reproduzível** a partir dele.

`edition_drafts.deal_ids` ganha um par `radar_snapshot_ids[]`.

---

## 26. Métricas do produto

**Dados** — campanhas com data válida (`válidas/total`, diário, alerta <70%);
exatas vs inferidas (razão, semanal); duplicatas (contagem, diário); cobertura
backfill (§8, semanal, alerta <alvo); descartadas (%, diário); aliases pendentes
(contagem, diário, alerta >0).

**Séries** — bloqueadas/ready/warning (contagens, diário); cobertura por programa
(heatmap, semanal); outliers (contagem, semanal); amostra média (ondas/série,
semanal).

**Modelo** — erro mediano de data (backtest, por release); window hit rate (idem,
alerta <0,5); Brier por horizonte (idem); calibração (curva, mensal); acurácia de
bônus ±5pp; drift (variação do erro no tempo, mensal); concordância
Forecast×Predict (% acordo, semanal).

**Operação** — tempo campanha→previsão (mediana, diário); tempo
previsão→aprovação (mediana, diário); snapshots expirados em uso (contagem,
tempo-real, alerta >0); overrides (contagem+motivos, semanal); publicadas;
rejeitadas.

**Editorial** — previsões no Daily/Weekly (contagem, por edição); taxa de acerto
percebida (previsto×realizado, mensal); correções publicadas (contagem); engajamento
do bloco Radar (cliques/aberturas via Beehiiv, por edição).

Cada métrica: fórmula acima, fonte (`prediction_snapshots`, `campaigns`,
`backtest`, Beehiiv), periodicidade e limiar de alerta indicados.

---

## 27. Migração conceitual (fases, sem código)

| Fase | Objetivo | Entregas | Dependências | Risco | Aceite | Reprocessar | Compat. temporária |
|---|---|---|---|---|---|---|---|
| **0** | corrigir compreensão dos dados | esta spec + queries de diagnóstico contínuo | auditoria | baixo | métricas de §26 medíveis hoje | nenhum | — |
| **1** | normalização, datas, qualidade | catálogo `programs/aliases`, política de datas, `data_evento`, `data_quality_status`, `include_in_prediction` | Fase 0 | **alto** (toca todo o ledger) | 142 ativas deixam de ser invisíveis; `vigencia_fim` vira date | recomputar `data_evento` e qualidade de todo o ledger | motores leem `data_evento` com fallback ao atual |
| **2** | séries, ondas, dedup | `series_key`, `wave_key`, `dedup_key`, hierarquia rota/cluster | Fase 1 | médio | caso 943d cai para cluster; sem intervalos artificiais | recomputar séries | manter chave antiga em paralelo p/ diff |
| **3** | Predict/Forecast reconciliados | reconciliador, readiness completo, config persistida, contrato §18 | Fase 2 | médio | 1 resultado por série; divergências sinalizadas | recomputar previsões | Forecast só fallback |
| **4** | admin unificado | tela Radar única, ações §21, auditoria | Fase 3 | médio | operador responde as 18 perguntas de §22 | — | manter telas antigas read-only 1 ciclo |
| **5** | integração Digests | snapshot canônico, `edition_draft` consome aprovados, fim do Daily manual | Fase 4 | **alto** (editorial) | Daily e Weekly nunca divergem | — | Weekly lê snapshot novo; Daily migra |
| **6** | calibração e monitoramento | Brier, calibração, drift, alertas | Fase 5 | baixo | dashboards de §26 no ar | — | — |

---

## 24b. Operação e cadência

```
ingest → extração → normalização → qualidade → recompute das séries afetadas
→ geração de snapshot → revisão editorial → publicação
```

- **Tempo real:** nada pesado. Só o registro de `news_raw` e o enfileiramento.
- **Por evento (nova campanha upsertada):** recanoniza a linha, recalcula
  **apenas as séries afetadas** (rota + cluster do destino), regenera snapshot
  `draft`. Nunca recomputa tudo.
- **Cron:** extração (drena `news_raw`), backfill, e um **recompute de reconciliação
  + expiração** (marca snapshots vencidos `stale`). Cálculo de cobertura/qualidade
  diário.
- **Antes da Digest:** um passo de "freshness gate" que recomputa séries com
  snapshot expirado e bloqueia publicação com dataset antigo.
- **Exige humano:** aprovação de `ready_with_warnings`, resolução de divergência,
  correção de alias, decisão de outlier.
- **Nova campanha entra:** dispara recompute incremental da(s) série(s) daquele
  destino → novo `draft` → fila de revisão se muda a manchete.
- **Evitar recomputar tudo:** grafo de dependência série↔campanha; só o afetado
  roda. **Evitar snapshot stale:** `expires_at` + freshness gate. **Impedir
  publicação com dataset antigo:** render compara `dataset_hash` do snapshot com o
  ledger atual da série; divergiu → recomputa ou alerta.

## 26b. Decisões que exigem o usuário

| Decisão | Contexto | Alternativas | Prós | Contras | Recomendação | Impacto de adiar |
|---|---|---|---|---|---|---|
| Motor canônico | Predict × Forecast hoje competem | Predict / Forecast / híbrido | Predict é calibrado e honesto | exige backfill bom | **Predict canônico, Forecast fallback** | divergências continuam |
| Amostra mínima | 2 (fc) vs 3 (pred) | 3 / 4 / 5 | 3 já bloqueia 2-pontos | 5 reduz cobertura | **3, subindo p/ leitor só com backtest** | previsões frágeis publicadas |
| Janela histórica | sem filtro hoje | 18/24m/completo+decay/adaptativa | adaptativa preserva raras | mais complexa | **adaptativa+decaimento, piso 24m** | ruído antigo persiste |
| Rota vs cluster | 943d veio da rota | rota/cluster/híbrido | híbrido resolve o 943d | precisa shrinkage | **rota + fallback cluster** | intervalos artificiais |
| Política de outliers | nenhuma hoje | apagar/rebaixar/segregar | rebaixar é honesto | menos "limpo" | **rebaixar+segregar, nunca apagar** | datas a 2028 |
| Campanhas permanentes | 142 invisíveis | descartar/estado próprio | estado recupera dado | exige regra | **estado `permanent`** | dado recente perdido |
| Segmentadas | não distinguidas | ignorar/série própria/tag | série própria é correta | precisa colunas | **tag agora, série própria depois** | mistura pública×segmentada |
| Clube | `tipo=clube` nem entra | juntar/separar bônus | separar é fiel | precisa campos | **`bonus_clube` separado** | bônus enganoso |
| Bônus base × máximo | só `percentual` | um/separar | separar evita "máx=esperado" | schema novo | **separar base/máx/clube/cartão** | princípio 5 violado |
| Nível de automação | manual/auto | manual/semi/auto | semi é seguro | mais trabalho | **semi (gate editorial)** | erro publicado |
| Aprovação editorial | inexistente p/ motor | nenhuma/sempre/por confiança | por confiança equilibra | atrito | **obrigatória p/ warnings+** | previsão crua ao leitor |
| Conteúdo de cada Digest | Daily manual | definir por horizonte | clareza de papel | rigidez | **Daily 7–30, Weekly 30–90, Pro tudo** | contradições |
| Exposição de probabilidade | só admin | leitor sim/não | número engaja | pode virar promessa | **P30/60/90 ao leitor, resto interno** | ou opaco ou exagerado |
| "Não confirmado" | some hoje | só veredito/estender | estender é honesto | menos previsões | **estender ao radar** | previsão sem base |
| Expiração | inexistente | sem/curta/longa | curta evita stale | recomputa mais | **curta (ex. 7d) + freshness gate** | Weekly stale (119 linhas) |
| Overrides | upsert sem trilha | livre/justificado | justificado é auditável | atrito | **sempre justificado, append-only** | mudança sem rastro |
| Publicação automática | n/a | nunca/após calibração | segurança | mais lento | **só após §26 comprovar acurácia** | erro em escala |
| Métricas de sucesso | inexistentes | definir | foco | esforço | **window-hit, Brier, tempo→previsão, engajamento** | sem como medir |

## 27b. Backlog

Prioridades: **P0** integridade · **P1** fundação · **P2** modelo · **P3** operação
· **P4** experiência · **P5** otimização.

| ID | Capacidade | Problema | Resultado | Usuário | Dep. | Impacto | Esforço | Risco | Aceite | Prio | Fase |
|---|---|---|---|---|---|---|---|---|---|---|---|
| R-01 | `data_evento`+`data_confidence` | 90% ancora no fim; 140 sem data | datas canônicas classificadas | analista | — | alto | M | alto | 142 ativas visíveis; `na`→permanent | P0 | 1 |
| R-02 | `vigencia_fim` text→date | aceita lixo | integridade de data | analista | R-01 | alto | S | médio | coluna date validada | P0 | 1 |
| R-03 | Remover limit 2000/order | 438 linhas caídas | janela por política | analista | R-05 | alto | S | médio | motor lê dataset definido | P0 | 1 |
| R-04 | Catálogo `programs/aliases` | alias hardcoded divergente | normalização única | operador | — | alto | M | médio | 2 motores usam `normalize()` | P1 | 1 |
| R-05 | Janela adaptativa+decay | sem janela real | modelagem estável | analista | R-01 | alto | M | médio | rota rara e mensal ok | P1 | 2 |
| R-06 | `series_key` + rota/cluster híbrido | 943d artificial | série coerente | analista | R-04 | alto | M | médio | 943d cai p/ cluster | P2 | 2 |
| R-07 | `wave_key` explícito | colapso frágil | ondas auditáveis | analista | R-06 | médio | M | baixo | ondas reproduzíveis | P2 | 2 |
| R-08 | `dedup_key`+content_hash | dup por vigencia_fim | dedup correto | analista | R-04 | médio | M | médio | reprocesso não duplica | P2 | 2 |
| R-09 | Outlier (MAD)+rebaixa | 943d→2028 | confiança honesta | analista | R-05 | alto | M | médio | outlier visível, não some | P2 | 2 |
| R-10 | readiness completo | estados mortos | gate real | analista | R-06 | alto | S | baixo | backfill/quality blocked atribuídos | P2 | 3 |
| R-11 | `predict_config` persistido | hardcoded | tuning auditável | editor | R-10 | médio | S | baixo | edição versionada | P2 | 3 |
| R-12 | Reconciliador+contrato §18 | 2 saídas soltas | 1 resultado/série | analista | R-10 | alto | M | médio | fallback rotulado; divergência sinalizada | P2 | 3 |
| R-13 | `backfill_completeness` | progresso=URLs | cobertura real | operador | R-01 | alto | M | médio | "concluído"=cobertura | P3 | 3 |
| R-14 | Snapshot canônico+estados | fc.json stale 119 | reprodutível+fresco | operador | R-12 | alto | M | médio | hash+expiração+superseded | P3 | 3 |
| R-15 | Admin Radar unificado | 2 telas cruzadas | operador responde 18Q | operador | R-12 | alto | L | médio | detalhe de série §22 | P4 | 4 |
| R-16 | Ações+override auditado | sem trilha | governança | editor | R-15 | médio | M | baixo | override justificado append-only | P4 | 4 |
| R-17 | Digest lê snapshot único | Daily manual/Weekly stale | consistência | editor | R-14 | alto | M | **alto** | Daily=Weekly; provenance | P4 | 5 |
| R-18 | Freshness gate na render | publica dataset antigo | nunca stale silencioso | editor | R-17 | alto | S | médio | render bloqueia stale | P4 | 5 |
| R-19 | Backtest+Brier+calibração | só window-hit | acurácia medível | analista | R-12 | médio | M | baixo | métricas §26 no ar | P5 | 6 |
| R-20 | Testes dos motores+espelho | zero cobertura | regressão travada | analista | R-06 | alto | M | baixo | windowDate/waves/gate/reconciler testados | P1 | 2 |

## 28. Recomendação final

1. **Motor canônico: Predict v2**, com readiness completo, config persistida e
   backtest exposto.
2. **Forecast: baseline/fallback interno**, minSamples 3, nunca manchete sozinho.
3. **Chave de série: rota** com **pooling parcial hierárquico para o cluster de
   destino** — resolve o 943d sem misturar parceiros indevidamente.
4. **Janela: adaptativa por série com decaimento por recência** (piso 24 meses de
   modelagem; armazenamento completo; backfill com cobertura mensurável).
5. **Datas: `data_evento` resolvida por prioridade início>anúncio>fim**, com
   `data_confidence` e reclassificação de `vigencia_fim='na'` como `permanent`
   (fim das 142 campanhas invisíveis).
6. **Outliers: detectar (MAD/IQR), rebaixar confiança e segregar regime — nunca
   apagar.**
7. **Fonte única de saída (contrato §18) + snapshot canônico + gate editorial**;
   Daily/Weekly/Pro leem o mesmo snapshot aprovado.
8. **Admin unificado** ("Radar"), com detalhe de série que responde às 18 perguntas
   e overrides sempre justificados e auditados.
9. **Distribuição consistente:** Daily (7–30d, aprovado), Weekly (30–90d, deltas),
   Pro (curvas/backtest/exportação); disclaimer e "Não confirmado" onde a evidência
   falta.
10. **Instrumentar tudo** (§26) antes de confiar em automação; publicação
    automática só depois de calibração comprovada.

---

## Anexo — mapeamento achado→solução

| Achado da auditoria | Onde é tratado |
|---|---|
| 142 ativas invisíveis (`vigencia_fim='na'`) | §5 (permanent), §6.6 |
| 54% >18m entram sem filtro | §6, §7 |
| Sem outlier (943d → 2028) | §11, §14, §15 |
| `windowDate`=fim em 90% | §5, §6 |
| limit 2000 sem order | §6 (janela por política), §7 |
| `forecast.json` 119 linhas stale | §18, §19, §25 |
| Chave rota fragmenta destino | §11 |
| minSamples 2 vs 3 | §15, §16, §26 (decisão) |
| Daily manual × Weekly stale | §25 |
| Predict não chega ao leitor | §16, §17, §25 |
| Predict snapshots não lidos | §19, §20 |
| Sem override no predict | §21 |
| readiness morto | §13, §16 |
| dedup por vigencia_fim | §10 |
| zero teste nos motores | §27 (aceite por fase) |
