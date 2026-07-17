# M2 · Slice — Digest Engine (SPEC, antes de código) — v3 (revisão estrutural do operador)

> **Gate de entrada:** vetores fechados (P1 aplicada e revisada). **Modo: spec primeiro, não
> código.** Esta rodada **reabre o contrato** (`SPEC-SLICE-DIGEST-ENGINE.md` +
> `content/edition.schema.json`) — não é ajuste incremental sobre a v2. **Zero escrita em
> produção nesta entrega.** O rascunho já criado no Beehiiv (`post_f7b2c959-...`, D-056)
> **fica parado** até esta spec fechar e o Digest Engine ser reconstruído sobre ela — não
> republicar/reenviar nada enquanto isto está aberto.
>
> **Histórico:** v1 (`9c39ffc`) → v2 (`4762eb8`, emenda 1: scoreBreakdown, Clipping+Resumo do
> dia, Loyalty Lab por score, TIER2 narrativo — formalizada em D-052/D-053/D-054, **código já
> construído e commitado** sobre a v2). **v3 (esta revisão) muda a estrutura visível da
> edição inteira** — a referência colada pelo operador é **especificação de estrutura, não
> de conteúdo literal** (aviso explícito do operador, respeitado aqui: nenhum texto de
> exemplo do prompt vira conteúdo publicável).

---

## 0. O que já existe e continua valendo (não reabre)

Princípios que não mudam nesta revisão — só a estrutura de blocos muda:

- **INV-12 (determinismo primeiro):** o engine nunca calcula; lê `campaigns`/`news_raw` já
  processados. LLM redige, nunca decide número.
- **D-044 (3 portões):** estado vivo + TIER 1 confirmado + conta computável = elegível à
  listagem geral. **Continua sendo o filtro-base de tudo que não é puramente evergreen.**
- **D-050 decisão 1:** corte de veredito (`Vale agir`/`Vale olhar`) é o que separa
  "recomendação" de "informação" — nenhum item mais fraco vira card de recomendação ativa,
  mesmo em formato novo.
- **D-045/D-049:** TIER 1 corrobora os TERMOS, não só a existência. Vocabulário de veredito
  (`Vale agir`, `Vale olhar`, `Só para casos específicos`, `Esperaria`, `Evitaria`, `Não
  confirmado`) é **grafia fixa** (CLAUDE.md) — fonte única em `veredito_bruto`/
  `mapear-contrato.mjs`.
- **Regra-mãe (regra 5 / §2.1 da v2):** seção sem dado real é **omitida**, nunca vazia nem
  parcial. Aplica-se a **cada bloco novo** desta revisão, sem exceção.
- **Módulos puros já construídos e testados** (`v2/lib/digest/`): `selecionar.mjs`
  (`passaTresPortoes`, `elegivelDealDesk`, `selecionarDealDesk`, `selecionarFechaLogo`),
  `mapear-contrato.mjs` (veredito + scoreBreakdown), `dia-fraco.mjs` (Clipping, Radar, Radar
  VPM, Sinais rápidos, score de automação do Loyalty Lab), `gate-5-5.mjs`. **Reaproveitados
  nesta revisão sempre que o contrato novo permitir** — mapa exato no §6.

---

## 1. Estrutura nova (ordem da referência do operador — estrutural, não literal)

### 1.0 Sinal do dia (prosa, veredito do dia) — **sem mudança**

Continua exatamente como na v2 (§2.2): obrigatório sempre, prosa com número real, nunca
genérico. `mapear-contrato.mjs` e o gate 5.5 já cobrem isto.

### 1.1 Ofertas ativas (NOVA — tabela, todas as ofertas vivas) — **reaproveita `passaTresPortoes`, zero query nova**

**Achado central desta seção: não precisa de seletor novo.** "Todo item vivo com conta
computável" é literalmente a definição de `passaTresPortoes` (D-044) **sem** o corte de
veredito (§1.2 da v2) aplicado por cima. Hoje isso é **1 linha** (o mesmo item de
`smiles-desconhecido-compra-2026-07-17`, bruto 55) — porque hoje só 1 candidato passa os 3
portões. A tabela é estruturalmente `passaTresPortoes(c) === true` para todo `c` em
`campaigns` vivo, **sem filtrar por `elegivelDealDesk`**.

**Colunas propostas:** Programa/rota (`origem_code`→`destino_code` ou só `origem_code` para
`lado_unico`), Tipo (`tipo`, taxonomia D-001), Bônus/preço (`percentual` formatado), Prazo
(`vigencia_fim` ou "sem data" se vigência indeterminada), Leitura (ver decisão de rótulo
abaixo).

**Decisão nomeada — rótulo da coluna "Leitura":** a referência do operador usa
`Barato/Vale-olhar/Caro/Observar` (4 termos) — **diferente** do vocabulário canônico de
`veredito_bruto` (5 termos: `Vale agir/Vale olhar/Só para casos específicos/Esperaria/
Evitaria`), que é **grafia fixa** travada em CLAUDE.md e em `mapear-contrato.mjs`
(D-045/D-049). Proposta: **reusar o vocabulário canônico direto na tabela** (`Vale agir`,
`Vale olhar`, `Só para casos específicos`, `Esperaria`, `Evitaria` — mesmos rótulos que
aparecem em Deals do dia), em vez de criar um segundo vocabulário paralelo para a mesma
informação. Dois vocabulários para o mesmo dado (`veredito_bruto`) convidam divergência
("por que a tabela diz Caro e o Deal diz Evitaria pro mesmo item?") e diluem o ativo de
marca que é esse vocabulário. **Ratificar reuso do vocabulário canônico, ou confirmar os 4
termos novos da referência como rótulo compacto oficial de tabela** (nesse caso preciso do
mapa exato veredito→rótulo compacto, incluindo o que "Não confirmado" vira numa tabela).

**Cruzamento com D-045:** só entra na tabela o que já é TIER 1 confirmado (é isso que
`passaTresPortoes` já garante) — **não** relaxa para TIER 2. Mostrar termo não corroborado
numa tabela pública repetiria exatamente o caso `livelo→azul` (115% que a fonte oficial não
sustentava) que D-045 existe para prevenir. TIER 2 continua reservado aos blocos
evergreen/narrativos (Cartões & bancos, Clipping, O que fechou nesta semana), nunca a uma
tabela de "ofertas vivas com número".

### 1.2 Deals do dia (numerado) — **mesma seleção, novo formato de render + 2 campos aditivos no schema**

`selecionarDealDesk` **não muda** (3 portões + corte de veredito + cap 3 + tie-break por
`vigencia_fim`, D-044/D-050/D-052). O que muda é só a **densidade do render**: numerado
("1. Programa — headline"), com "A conta" em prosa (não só a tabela `conta.rows`/`result`)
e "Leitura" como parágrafo de interpretação — mais denso que o `ContaBlock` atual.

**Proposta de schema (aditivo, não quebra edições existentes):**
- `deal.contaProsa` (string, opcional) — paráfrase em prosa dos mesmos números de
  `deal.conta` (não recalcula; é redação sobre o dado que já existe). Gate 5.5 verifica que
  todo número citado em `contaProsa` também aparece em `conta.rows`/`result` (nunca um
  número novo introduzido só na prosa).
- `deal.leitura` (string, opcional) — parágrafo de interpretação/uso. Distinto de
  `verdictNote` (que continua existindo, curto, usado em Fecha Logo/tags). Ausência de
  `leitura` ⇒ render cai para `verdictNote` (fallback, mesmo padrão de `contaFeita`/D-052).

Cap 3, TIER 1 confirmado, corte de veredito: **inalterados**.

### 1.3 Vence em até 72h (lista) — **renomeação de Fecha Logo, zero mudança de seletor**

**Achado:** `estado = 'ultimos_dias'` **já é**, por construção da FSM
(`derivar_estado_vigencia`, migration 001), exatamente `vigencia_fim <= ref + 3 dias` — ou
seja, "vence em até 72h" **é** a definição existente de `ultimos_dias`, não um filtro novo.
`selecionarFechaLogo` (`v2/lib/digest/selecionar.mjs`) já implementa isso.

**Proposta:** **renomear** a seção (rótulo "Vence em até 72h" no lugar de "Fecha Logo"),
reformatar o render de cards-com-tag para **lista simples** (formato da referência), **sem
tocar no seletor**. Não faz sentido as duas seções conviverem — mostrariam exatamente o
mesmo conjunto de itens duas vezes com formatos diferentes. `selecionarFechaLogo` fica
como está (nome da função interna pode continuar `selecionarFechaLogo` — é implementação,
não rótulo visível).

### 1.4 Cartões & bancos (NOVA — parágrafo editorial evergreen) — **fonte de dado proposta, decisão nomeada**

**Achado por SQL direto:** `campaigns.tipo='cartao'` já existe como valor real e populado
(296 linhas totais, **5 vivas hoje**) — apesar de D-001 descrever isso como tipo sem enum
próprio (mapeia para `bonus_acumulo`/`outro` na canonicalização); o valor **bruto**
`'cartao'` continua presente na coluna e é diretamente consultável, sem precisar da
canonicalização completa. Para o lado "bancos" (transferência bancária), não há tipo de
entidade "banco" em `content/entities` (só `programa-origem`/`programa-cia`, 5 entradas) —
proponho uma **lista curada de `origem_code`** de bancos observados no dado real hoje
(`itau` 184, `inter` 117, `c6` 101, `bradesco` 37, `banco_do_brasil` 31, `nubank` 30,
`caixa` 28, `brb` 25, `santander` 24, `btg` 23, `xp` 16, `picpay` 14 — todos com volume
real), no mesmo padrão de `CRAWLAVEIS`/`ESTADOS_VIVO` (constante nomeada, versionada,
extensível, não fechada). Hoje: **5 cartão vivas + 2 transferência-banco vivas = 7 itens**
reais para o bloco.

**Decisão nomeada:** (a) fonte = `campaigns` filtrado por `tipo='cartao' OR (tipo=
'transferencia' AND origem_code IN <lista de bancos>)`, estado vivo, **sem** exigir TIER 1
nem corte de veredito (é panorama editorial, não recomendação — mesmo tratamento TIER 2 dos
blocos narrativos, D-053); (b) a prosa (parágrafo, não lista) é redigida a jusante a partir
desses itens, com o mesmo lint de rastreabilidade número↔banco do Resumo do dia (§3). Peço
confirmação da lista de bancos (extensível) e do critério "sem TIER 1" — alternativa mais
conservadora seria exigir TIER 1 aqui também, ao custo de esvaziar o bloco em mais dias
(hoje só 0 dos 7 é TIER 1 confirmado).

### 1.5 Clipping (bullets) — **sem mudança**

Já construído (`selecionarClipping`, piso rígido de 5, `v2/lib/digest/dia-fraco.mjs`).
Formato "bullets, título + fonte entre parênteses, com link" é compatível com o que já
existe — é ajuste de render, não de seleção.

### 1.6 O que fechou nesta semana (NOVA — bullets, recap de janelas encerradas) — **fonte de dado proposta**

**Medido por SQL direto:** `estado='encerrada'` com `vigencia_fim` nos últimos 7 dias = 54
linhas totais; **filtrando TIER 1 confirmado + conta computável (mesmos 2 dos 3 portões,
trocando "vivo" por "encerrada")** = **7 itens reais** — pool saudável, não vazio, não
esparso.

**Proposta de seletor** (golden-testável, **sem cálculo**, só leitura — mesmo padrão de
`selecionarFechaLogo`): `estado='encerrada' AND tier=1 AND tl_score_bruto IS NOT NULL AND
vigencia_fim BETWEEN (ref - 7 dias) AND ref`. Cada item: "Programa — o que foi (bônus/%),
encerrou em [data]" — sem reabrir cálculo de score (é recap, não novo veredito). **Por que
exigir TIER 1 aqui:** um recap com número não confirmado repete o risco do §1.1 — mesmo
princípio, mesma resposta.

### 1.7 Predict (NOVA — teaser, aparece em alguns dias) — **território M4, decisão nomeada explícita**

**Acho relevante sinalizar antes de propor:** isto cruza para M4 (Predict Ledger, REQ-24) —
cobrança desligada conforme o brief, e o M4 é milestone **posterior** ao M2 no `ROADMAP.md`.
Sigo por instrução do operador (autorizado no dispatch), mas registro o cruzamento
explicitamente — mesma disciplina do §2.4.1 da v2 para o Loyalty Lab.

**Medido:** `content/forecast.json` tem 8 rotas/clusters com `withPrediction`, mas
`digest.radarDaily` (o subconjunto já curado para publicação, mesmo dado que alimenta o
Radar da v2) está **vazio hoje** — nenhuma janela com confiança suficiente para valer a
pena mostrar um recorte. Isso é evidência de que o critério de cadência **deve ser
orientado a dado, não a calendário fixo** (não "aparece 2x/semana", mas "aparece quando há
sinal").

**Proposta de cadência:** Predict aparece quando `digest.radarDaily` tem **≥1 janela com
`confidence='alta'`** — mesma barra que já existe para o Radar da v2 (§2.3 item 2),
reaproveitada sem inventar critério novo. Hoje: 0 janelas 'alta' → **omitido**, exatamente
como qualquer outro bloco sem dado real (regra-mãe).

**Proposta de conteúdo (sem entregar o forecast completo, regra-mãe 3/4 — convite, não
pressão):** "N previsão(ões) ativa(s) esta semana no radar — veja o recorte completo no
Digest Pro." **Nunca** mostra o valor/janela prevista, nunca usa termo de urgência
(`URGENCY_RE` já bloqueia "última chance"/"corra"/etc.), nunca promete ganho ("acerte a
próxima campanha" é promessa — não usar). Peço ratificação do critério de cadência
(`confidence='alta'` em `radarDaily`) e da moldura de texto acima.

---

## 2. O que acontece com os blocos já ratificados na v2 (D-053/D-054) — pergunta explícita, não decidido sozinho

A referência do operador **não cita por nome** Resumo do dia, Radar (janelas), Radar VPM,
Sinais rápidos nem Loyalty Lab. Como o próprio operador marcou a referência como
"estrutura, não conteúdo literal", **não assumo silenciosamente que sumiram** — trago
proposta de destino para cada um, para ratificar ou corrigir:

| Bloco (v2/D-053) | Proposta nesta v3 | Reuso de código |
|---|---|---|
| **Resumo do dia** | Funde com Sinal do dia (2 parágrafos numa seção só: veredito + contexto) — a referência só lista "Sinal do dia" no topo, sem item separado. | Nenhuma mudança de dado; é fusão de render. |
| **Radar (janelas)** | Migra para dentro do teaser **Predict** (§1.7) — é literalmente o mesmo dado (`content/forecast.json`/`digest.radarDaily`), não sentido em duas seções mostrando a mesma fonte. | `selecionarRadar` (dia-fraco.mjs) reaproveitado como filtro de entrada do Predict. |
| **Radar VPM (`shoppingWatch`)** | **Ausente da referência — não tenho proposta de fusão óbvia** (não é sobre timing de campanha como o Radar, é preço de catálogo). Pergunto direto: corta, mantém como bloco à parte fora da lista nova, ou entra em Cartões & bancos? | `selecionarRadarVpm` intacto até a decisão. |
| **Sinais rápidos** | Absorvido pela tabela **Ofertas ativas** (§1.1) — ela já mostra todo item que passa os 3 portões sem cortar por veredito, o que inclui exatamente o que Sinais rápidos mostrava. Proponho aposentar o bloco de bullets próprio. | Lógica de filtro (`passaTresPortoes && !elegivelDealDesk`) sobrevive dentro da tabela; `selecionarSinaisRapidos` como função de bullets isolada fica obsoleta. |
| **Loyalty Lab** | **Ausente da referência — não tenho proposta de fusão óbvia** (é o único bloco puramente narrativo/analítico; Cartões & bancos também é editorial mas tem fonte de dado estruturado por trás). Pergunto direto: funde em Cartões & bancos, mantém separado, ou corta desta rodada? Se mantido, o score de automação (corte 0,85, D-053) e a dívida do Ledger (§2.4.1 da v2) **continuam válidos sem mudança**. | `scoreAutomacaoLoyaltyLab`/`precisaRevisaoHumana` intactos até a decisão. |

---

## 3. Dia fraco dentro da estrutura nova (decisão 6 do dispatch)

- **Deals do dia** some quando zero elegíveis (regra-mãe intacta, sem mudança de D-050).
- **Ofertas ativas** continua aparecendo mesmo com Deals do dia vazio — é estruturalmente o
  que sustenta o dia fraco ser útil de ler (mostra o que existe e por que não passou o
  corte, mesmo texto de intenção que já estava no Sinal do Dia da v2, agora também
  tabulado). Só some se **zero** itens passam os 3 portões (cenário mais raro que "zero Deal
  Desk" — hoje não é o caso: há 1 linha).
- **Cartões & bancos, Clipping, O que fechou nesta semana** são evergreen — aparecem sempre
  que houver dado real, independente do estado do Deal Desk. Mesma regra-mãe aplicada bloco
  a bloco (Cartões & bancos com 0 itens vivos = omitido; Clipping <5 = omitido; O que
  fechou nesta semana com 0 = omitido).
- **Predict** aparece só quando há sinal de confiança alta (§1.7) — independente do estado
  do Deal Desk, mas tipicamente mais raro que os outros evergreens.

---

## 4. Gate 5.5 — o que muda com a estrutura nova

**Continua igual (checks §3.1–§3.3 da v2, sem mudança):** schema válido, disclaimer literal,
lint de linguagem, rastreabilidade número↔banco em `signal`, links 200,
`entityKey`/`routeKey` conhecidos; para Deals do dia — 3 portões recomputados, veredito ∈
{vale-agir, vale-olhar}, cap 3, vigência não vencida.

**Novos checks propostos para os blocos desta v3:**

- **Ofertas ativas (tabela):** cada linha recomputa `passaTresPortoes` direto no banco
  (mesmo padrão de `checkComDealDesk`, sem o filtro de veredito); a "Leitura" de cada linha
  bate com o `veredito_bruto` real daquele item (não pode divergir — mesmo risco do
  `contaFeita` desalinhado, D-055).
- **Vence em até 72h:** idêntico ao check de Fecha Logo já existente (vigência não vencida)
  — só muda o nome do bloco no relatório do gate.
- **Cartões & bancos:** cada afirmação da prosa rastreável em `campaigns` (mesmo padrão do
  Resumo do dia/INV-03 aplicado à prosa); itens citados batem com o filtro
  `tipo='cartao' OR origem_code IN <lista>` recomputado no banco.
- **O que fechou nesta semana:** cada item recomputa `estado='encerrada' AND tier=1 AND
  tl_score_bruto IS NOT NULL AND vigencia_fim` na janela dos 7 dias direto no banco — sem
  cálculo novo, só leitura conferida.
- **Predict:** quando presente, recomputa `digest.radarDaily` tem ≥1 janela `confidence=
  'alta'` (mesmo padrão de negação de "projeção sem lastro" já usado no Radar da v2); lint
  reforçado para garantir que o texto **nunca** cita valor/janela específica (só a
  contagem) e nunca usa termo de `URGENCY_RE`.
- **`deal.contaProsa`** (quando presente): todo número citado tem correspondente literal em
  `deal.conta.rows`/`result` — não pode introduzir número que não esteja na tabela
  estruturada (mesmo espírito do check de `contaFeita`).

**Sem mudança:** a garantia estrutural central do §3.3 da v2 (seção Deal Desk ausente do
HTML, não vazia — via `DEAL_DESK_SECTION_MARKER`) continua igual; só passa a se chamar
"Deals do dia" no relatório.

---

## 5. Decisões nomeadas em aberto (resumo — nenhuma bloqueia as outras)

| # | Decisão | Proposta default (se não houver resposta) |
|---|---|---|
| 1 | Rótulo da coluna "Leitura" em Ofertas ativas: vocabulário canônico (`Vale agir`…) ou os 4 termos novos da referência (`Barato/Caro`…)? | Vocabulário canônico (evita 2º vocabulário paralelo para o mesmo dado) |
| 2 | Cartões & bancos: TIER 1 obrigatório ou aceita TIER 2 (mesmo tratamento de Clipping/Resumo)? | TIER 2 aceito (evergreen, sem corte de veredito) |
| 3 | Lista curada de `origem_code` de bancos — confirma a lista observada (itau/inter/c6/bradesco/bb/nubank/caixa/brb/santander/btg/xp/picpay)? | Lista acima, extensível sem re-trabalho |
| 4 | Cadência do Predict: `confidence='alta'` em `digest.radarDaily` é a barra certa? | Sim, reaproveita a barra já existente do Radar |
| 5 | Resumo do dia funde com Sinal do dia, ou continua seção própria? | Funde (2 parágrafos numa seção) |
| 6 | Radar (janelas) migra para dentro do Predict? | Sim |
| 7 | Radar VPM (`shoppingWatch`): corta, mantém à parte, ou funde em Cartões & bancos? | **Sem proposta default — decisão genuinamente aberta, preciso da sua resposta** |
| 8 | Loyalty Lab: funde em Cartões & bancos, mantém separado, ou corta desta rodada? | **Sem proposta default — decisão genuinamente aberta, preciso da sua resposta** |

As decisões 7 e 8 são as únicas sem proposta default segura — todas as outras têm caminho
reversível se eu construir com a proposta e você preferir outra depois.

---

## 6. Mapa de reuso — o que já construído continua servindo

| Módulo já testado | Continua servindo em v3? |
|---|---|
| `selecionar.mjs` (`passaTresPortoes`, `elegivelDealDesk`, `selecionarDealDesk`, `selecionarFechaLogo`) | **Sim, 100%** — Ofertas ativas usa `passaTresPortoes` cru; Deals do dia usa `selecionarDealDesk` sem mudança; Vence em até 72h usa `selecionarFechaLogo` sem mudança. |
| `mapear-contrato.mjs` (`mapVeredito`, `mapScoreBreakdown`) | **Sim, 100%** — vocabulário e breakdown não mudam. |
| `dia-fraco.mjs` — `selecionarClipping` | **Sim, 100%** — Clipping sem mudança. |
| `dia-fraco.mjs` — `selecionarRadar`, `selecionarRadarVpm` | Reaproveitados **se** as decisões 6/7 confirmarem onde eles migram. |
| `dia-fraco.mjs` — `selecionarSinaisRapidos` | Lógica de filtro sobrevive dentro de Ofertas ativas; a função como bloco de bullets isolado fica obsoleta (decisão 8 da tabela §5 do dispatch original, já proposta no §2). |
| `dia-fraco.mjs` — `scoreAutomacaoLoyaltyLab`, `precisaRevisaoHumana` | Reaproveitados **se** a decisão 8 mantiver Loyalty Lab (fundido ou separado). |
| `gate-5-5.mjs` (`checkComuns`, `checkComDealDesk`, `checkSemDealDesk`) | Estrutura reaproveitada; ganha os checks novos do §4 desta spec, nomes internos podem mudar (Deal Desk→Deals do dia) sem mudar a lógica. |
| `render-beehiiv.mjs`, `renderer/email.mjs` | **Reconstrução de render necessária** — é onde a mudança de estrutura realmente aparece; a lógica de seleção por trás é o que se preserva. |

---

## 7. Fora de escopo desta entrega

- Código do engine (esta é a spec revisada; código só depois da ratificação do §5).
- Qualquer escrita em produção, publicação ou reenvio do rascunho já criado no Beehiiv
  (fica parado, D-056 registrado, sem tocar).
- Construir o Predict Ledger (M4.3) — o teaser do §1.7 usa `content/forecast.json` já
  existente, não depende do Ledger (isso é dependência do Loyalty Lab automatizado, §2.4.1
  da v2, continua dívida separada).
- Ligar auto-publish ou estrear o Daily (D-050 decisão 3 continua em vigor).

## 8. Definição de pronto desta rodada (é spec — "pronto" = decisões suficientes para codar)

1. Decisões 1–6 da tabela §5 ratificadas ou aceitas por proposta default.
2. Decisões 7–8 (Radar VPM, Loyalty Lab) respondidas — são as únicas sem default seguro.
3. Confirmação de que o rascunho parado no Beehiiv continua parado até o código desta v3
   fechar (sem ambiguidade sobre reenviar o que já existe).

*Promoções podem mudar sem aviso. Confira sempre as regras no site oficial antes de
comprar, transferir ou resgatar.*
