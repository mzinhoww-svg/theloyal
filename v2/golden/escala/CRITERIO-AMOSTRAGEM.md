# Critério de amostragem — golden set em escala real (remove o asterisco in-sample)

> **Frente CALIBRAÇÃO / D-051 · mede-e-propõe · STOP no critério.**
> Este doc é a PROPOSTA de amostragem do golden grande. Ele **não** rotula em massa.
> Entrega desta run: este critério + um PILOT pequeno (`PILOT-BATCH.json`, 20 itens)
> que prova o critério e expõe ambiguidade de rótulo ANTES da rotulação em massa.
> **Nada aqui vira produção sem aprovação do operador** (D-051 portão 2/3).
>
> Por que existir: o golden atual (~86 rótulos, `v2/golden/AMOSTRA-100-ROTULADA.json`)
> carrega o **asterisco in-sample** (D-019): as regras da camada A do gate nasceram
> dessas 86 linhas, então precision/recall medidos contra elas são internos. Um golden
> maior, estratificado por frequência real e **desenhado antes de olhar o gate**, é o
> que permite reportar número **fora da amostra** sem o asterisco.

---

## 0. Fonte da verdade da amostragem: `news_raw`, não `campaigns`

O golden é rotulado a partir da **notícia** (input = `titulo`+`trecho`), não da linha de
`campaigns`. Dois motivos medidos:

1. **`campaigns.published_at` está todo em 2026-07** (carga em bloco): não serve para
   estratificar por tempo. O sinal temporal real vive em **`news_raw.published_at`**
   (span 2025-01 → 2026-07, medido abaixo).
2. **Os tipos que faltam estão escondidos dentro de outros baldes do extrator.** A
   `campaigns.tipo` bruta tem `compra/transferencia/clube/cartao/hotelaria/estrutural`
   — mas `shopping`, `pontos_mais_dinheiro` e boa parte de `promocao_emissao`/
   `status_match`/`bonus_acumulo` **não têm balde próprio**: o extrator os enfia em
   `compra`/`transferencia`/`cartao`/`hotelaria`. Estratificar só por `extraction_json.tipo`
   reproduziria o buraco de cobertura (é por isso que a base tem **0** dos 3 gap-types).
   → O critério estratifica **por assinatura de conteúdo** para gap-types e negativos.

Prova disso está no PILOT: `shopping` veio rotulado `compra` pelo extrator, `status_match`
veio `hotelaria`, `pontos_mais_dinheiro` veio `transferencia`, `promocao_emissao` veio
`cartao` (ver `PILOT-NOTES.md` §Ambiguidades).

---

## 1. Distribuições medidas no corpus (live, `qjqnqcsdnpvvmyzkavoq`, 2026-07-17)

Todas as contagens abaixo saíram de `SELECT` read-only. São a **base das quotas** —
quota não é chute, é frequência real com sobre-amostragem declarada dos estratos
raros-mas-críticos.

### 1.1 `news_raw` — 40.327 notícias, por fonte
| fonte | notícias | processadas c/ 0 campanha | c/ ≥1 campanha |
|---|---|---|---|
| passageirodeprimeira | 12.837 | 6.478 | 6.359 |
| melhoresdestinos | 10.781 | 7.705 | 3.076 |
| pontospravoar | 10.056 | 10.017 | **39** |
| melhorescartoes | 6.378 | 2.234 | 4.144 |
| tavily | 275 | 264 | 11 |

Leitura: **`pontospravoar` é quase 100% editorial** (10.017 de 10.056 sem campanha) →
poço rico de **negativos genuínos** (produto do blog / notícia de viagem). `melhorescartoes`
é o mais denso em campanha real (65% das notícias geram ≥1).

### 1.2 `news_raw` por mês de publicação (span 18,0 meses)
2025-01 … 2026-07, 19 buckets YM. Volume por mês razoavelmente plano (1.409–2.476/mês;
único pico em **2026-05 = 3.951**). Com campanha por mês: 433–1.063. **Nenhum mês domina**
— a estratificação temporal evita enviesar a um burst.

### 1.3 `campaigns` — 3.621 linhas, por `tipo` bruto
| tipo bruto | n | lado_único | → canônico (destino provável do rótulo) |
|---|---|---|---|
| compra | 1.845 | 818 | `compra_pontos` **OU** `shopping` **OU** `nao_campanha` (cupom/produto) |
| transferencia | 753 | 0 | `transferencia_bonificada` **OU** `pontos_mais_dinheiro` **OU** `outro` (s/ bônus) |
| clube | 345 | 85 | `clube` **OU** `nao_campanha` (assinatura-perk) |
| cartao | 295 | 100 | `promocao_emissao` **OU** `nao_campanha` (anuidade/perk, D-018) |
| hotelaria | 183 | 111 | `bonus_acumulo` **OU** `status_match` **OU** `nao_campanha` (diária cash) |
| estrutural | 162 | 85 | `outro` |
| cauda (assinatura 9, sorteio 8, resgate 7, cashback 2, status match 2, …) | ~40 | — | vário / `nao_campanha` |

**A coluna da direita é o achado central:** cada balde bruto colapsa 2–3 rótulos canônicos.
A precisão do golden **é** desfazer esse colapso.

### 1.4 Balanço lado-único e vigência
- `lado_unico = true`: **1.220 / 3.621** (34%). Concentrado em `compra` (818), `hotelaria`
  (111), `cartao` (100). `transferencia` é **0** lado-único (transferência sempre tem 2 lados).
- `destino_code = sem_destino`: 1.220 (bate com lado-único).
- `estado` (FSM vigência): historica 2.000 · indeterminada 1.459 · encerrada 90 ·
  detectada 39 · ultimos_dias 16 · vencida 5 · ativa 1 · null 11.
  → **95% do corpus é histórico/indeterminado**; o golden precisa de vigência de todas as
  faixas do FSM, não só das poucas vivas.
- `regulamento_url` presente: **79** · `tier=1`: **43** · `percentual` presente: 2.175.
  → fonte oficial (TIER 1) é rara na base; o golden é rotulado do **blog** (titulo/trecho),
  e é aí que mora a divergência §1.6.

### 1.5 Programas (cabeça da distribuição)
- **Origem** top: livelo 472 · smiles 279 · esfera 249 · azul_fidelidade 239 · itau 184 ·
  outro 167 · latam_pass 154 · mercado_livre 137 · inter 117 · c6 101 · shell 66 · amazon 60.
- **Destino** top: sem_destino 1.220 · smiles 350 · azul_fidelidade 341 · latam_pass 257 ·
  livelo 254 · esfera 118 · accor 85 · amazon 52 · uber 42.
- **Concentração:** livelo+smiles+esfera+azul respondem por ~1.240 origens (34%). O critério
  impõe **quota de cauda** (§3) para o golden não virar "the livelo show".

### 1.6 Candidatos de divergência (o caso-guia livelo→azul, medido)
Família `{livelo,esfera} → {azul_fidelidade,smiles,latam_pass}`, `tipo=transferencia`:
| origem→destino | n | nº de %s distintos | min% | max% |
|---|---|---|---|---|
| livelo→azul_fidelidade | 44 | 8 | 50 | 130 |
| esfera→azul_fidelidade | 30 | 6 | 80 | 130 |
| livelo→latam_pass | 25 | 10 | 25 | 130 |
| livelo→smiles | 23 | 6 | 60 | 133 |
| esfera→smiles | 19 | 5 | 70 | 100 |
| esfera→latam_pass | 18 | 4 | 25 | 120 |
| **total** | **159** | — | 25 | 133 |

**`publico` de TODA transferência na base:** geral 714 · cartao 36 · clube 3 — **zero
`selecionados`**. Este é o núcleo da divergência **medido**: o blog reporta um número único
(quase sempre com "**até** X%") e marca `publico=geral`; a fonte oficial mostra **escala por
público** (geral < selecionados < clube-topo). O corpus **não** carrega a escala — ele carrega
o teto do blog. **159 candidatos** é poço mais que suficiente para uma estrato de divergência.

---

## 2. Alvo N e composição

**N-alvo proposto = 400 itens rotulados** (≈4,6× o golden atual de 86). Justificativa:
para reportar precision/recall dos campos críticos (programa, %, vigência) **fora da amostra**
com intervalo de confiança estreito o suficiente para retirar o asterisco, e ainda medir a
**precision de `nao_campanha` por padrão** (o número público, CRITERIO §4), 86 é pequeno demais
por célula. 400 dá ≥15 por célula nos estratos críticos sem virar projeto de rotulação infinito.

Divisão macro: **~280 positivos (campanha) · ~120 negativos (`nao_campanha`, 30%)**. Os 30% de
negativo espelham o falso-positivo agregado medido no M1 (36%, D-013) e o risco de produto real
(publicar não-campanha como campanha).

### 2.1 Quotas de positivos (~280) — alocação desproporcional declarada
Proporcional à frequência real, **com piso** para tipos raros e **boost** para gap-types
(que a base sub-representa por defeito de extração, não por raridade real):

| tipo canônico | base bruta (aprox) | quota | nota de alocação |
|---|---|---|---|
| `transferencia_bonificada` | 753 | **70** | inclui sub-estrato **divergência = 30** (§1.6) |
| `compra_pontos` | subset de compra | **45** | só compra **genuína de ponto** (não cupom/produto) |
| `clube` | 345 | **30** | só clube com mecânica de ponto (não assinatura-perk) |
| `promocao_emissao` | escondido em cartao | **25** | boost: gap-type, "pontos de boas-vindas" |
| `bonus_acumulo` | escondido em hotelaria/compra | **25** | boost: gap-type |
| `shopping` | escondido em compra (base ~0) | **20** | boost forte: cobertura do zero |
| `status_match` | base ~3–6 | **15** | boost forte: cobertura do zero |
| `pontos_mais_dinheiro` | escondido em transferencia (base 0) | **15** | boost forte: **substitui os 4 sintéticos D-030** |
| `outro` (parceria/prorrogação s/ bônus) | estrutural 162 | **15** | percentual=null (CRITERIO §5) |
| **subtotal positivos** | | **~260** | folga de 20 p/ tipos escassos que aparecerem |

### 2.2 Quotas de negativos (~120) — os 5 padrões `nao_campanha` (D-018)
| padrão | quota | assinatura de busca (poço) |
|---|---|---|
| cupom de varejo | 30 | título com "cupom/OFF/%desconto" em produto (extrator→compra) |
| exemplo de resgate | 20 | "desconto no resgate", "resgates de…" (% ≠ bônus) |
| produto do blog / editorial | 25 | notícia de viagem/produto sem mecânica (poço: `pontospravoar`) |
| perk de cartão/assinatura | 30 | anuidade grátis, Disney+/sala VIP/cashback fechado sem ponto transferível |
| stunt de RP | 15 | "recorde", "primeiro bebê", marketing sem oferta |
| **subtotal** | **120** | precision destas 5 = **número público** (CRITERIO §4) |

### 2.3 Estratos transversais (aplicados sobre TODAS as células)
- **Lado-único:** ≥ 30% dos positivos elegíveis com `lado_unico=true` (bate os 34% da base).
  `compra_pontos`, `hotelaria/bonus_acumulo`, `pontos_mais_dinheiro`, `promocao_emissao` são as
  fontes naturais; `transferencia_bonificada` é sempre 2-lados (0 lado-único, por definição).
- **Tempo:** cada estrato distribuído pelos **6 trimestres** (2025-Q1 … 2026-Q3). Regra dura:
  nenhum trimestre > 25% de uma célula; cada trimestre com ≥1 item onde houver oferta. Impede
  viés a um burst (ex.: pico 2026-05).
- **Programa:** garantir cobertura dos 8 de cabeça (livelo, smiles, esfera, azul_fidelidade,
  itau, latam_pass, inter, c6) **e quota de cauda ≥15% dos positivos** de programas fora do top-8.
- **Fonte:** cada uma das 4 fontes densas (passageirodeprimeira, melhoresdestinos, melhorescartoes,
  pontospravoar) presente; negativos editoriais puxam de `pontospravoar`.

---

## 3. Método de amostragem — determinístico e reprodutível (D-051 determinismo-primeiro)

**Sem `random()`.** Seleção por hash estável, re-executável byte-a-byte:

1. Para cada estrato S, define-se um **predicado SQL de candidatura** (assinatura de conteúdo
   + filtros de tipo/lado/tempo/programa). Os predicados do PILOT já estão exercitados e ficam
   registrados como ponto de partida (ver `PILOT-NOTES.md`).
2. Ordena-se o pool candidato por **`md5(S || id)`** (seed = nome do estrato concatenado ao id da
   notícia) e toma-se os primeiros K = quota do estrato. Determinístico: mesmo corpus → mesma amostra.
3. Dedup por `news_raw.id` **e** por `dedup_key` (a mesma oferta aparece em várias fontes — ex.:
   o livelo→azul 120% saiu em melhorescartoes E melhoresdestinos no PILOT). Cross-source duplicado
   é mantido **no máximo 1×** por oferta, salvo quando a divergência entre fontes **é** o objeto
   (estrato divergência pode reter o par para medir consistência).
4. As quotas transversais (§2.3) são satisfeitas por **amostragem estratificada aninhada**: o pool
   do estrato é particionado por (trimestre × faixa-de-programa × lado-único) e o `md5`-take corre
   dentro de cada partição com piso 1.

Reprodutibilidade: o conjunto de predicados + seeds + quotas é o artefato versionado; rodar de novo
sobre o mesmo snapshot do corpus regenera a mesma `AMOSTRA`. (Snapshot = corpus na data de draw;
registrar `drawn_at` no manifesto.)

---

## 4. Esquema de proveniência (por item) — sem isto não arbitra (D-051, CRITERIO §1)

Herda o esquema congelado (`v2/golden/CRITERIO-ROTULACAO.md` §1), com campos aditivos para a escala:

```json
{
  "id": "<news_raw.id>[#<n>]",          // sufixo quando a notícia gera N campanhas
  "estrato": "<nome do estrato §2>",     // rastreia a quota
  "seed": "md5('<estrato>'||id)",        // torna o draw auditável
  "drawn_at": "<YYYY-MM-DD>",            // snapshot do corpus no draw
  "fonte": "<news_raw.source>",
  "url": "<news_raw.url>",
  "publicado_em": "<news_raw.published_at|null>",
  "input": { "titulo": "...", "trecho": "..." },
  "extracao_snapshot": { ... },          // extraction_json->campaigns no momento do draw (mostra o erro)
  "classe": "campanha | nao_campanha",
  "gabarito": {                          // só quando classe=campanha
    "tipo": "<um dos 9>",
    "origem_programa": "<code | multiplos_cartoes | sem_destino | null>",
    "destino_programa": "<code | sem_destino | null>",
    "publico": "geral|selecionados|clube|cartao",
    "percentual": "<num|null>",          // ver regra do 'até X%' em PILOT-NOTES §R1
    "vigencia_fim": "<YYYY-MM-DD|indeterminada>",
    "lado_unico": true
  },
  "proveniencia": {                      // OBRIGATÓRIA nos 3 campos críticos
    "origem_programa": "<trecho que justifica>",
    "percentual": "<trecho>",
    "vigencia_fim": "<trecho>"
  },
  "motivo_nao_campanha": "cupom|resgate|stunt|produto_blog|perk|null",  // D-018/D-014
  "divergencia": { "candidato": false, "nota": null },  // §1.6: blog% vs oficial escala
  "sintetico": false,                    // D-030: número com sintético carrega asterisco
  "rotulador": "<agente/humano>",
  "rotulado_em": "<YYYY-MM-DD>"
}
```

**Campos críticos do portão** (programa, %, vigência): meta **precision ≥95%, recall ≥90%**;
proveniência obrigatória neles. **Regra de honestidade** (CRITERIO §7): se não bater de primeira,
reportar o mapa de erros por tipo — não forçar. **Regra do sintético** (D-030): qualquer item
`sintetico=true` marca o número público com asterisco até ser substituído por real.

---

## 5. O que NÃO é feito nesta run (GATE D-051)

- **Não** rotula em massa. O PILOT (20) prova o critério; a rotulação das 400 espera aprovação.
- **Não** re-mede os gates em escala. A re-medição (rejeição, vigência, matcher) roda **depois**
  que o operador aprovar este critério (plano em `PILOT-NOTES.md` §Plano).
- **Não** grava nada no banco (READ ONLY) nem toca em `v2/golden/*.json` ou nos runners atuais.

A pergunta que o operador precisa aprovar está no fim de `PILOT-NOTES.md`.
