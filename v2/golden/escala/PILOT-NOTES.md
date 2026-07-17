# PILOT — ambiguidades encontradas, clarificações de regra e plano de re-medição

> Frente CALIBRAÇÃO / D-051. Notas da rotulação do PILOT (`PILOT-BATCH.json`, 20 itens).
> Objetivo do PILOT: **provar o critério e expor ambiguidade de rótulo ANTES da rotulação
> em massa** (mesma disciplina do golden M1). **STOP aqui** — a rotulação das 400 e a
> re-medição dos gates esperam a aprovação do operador.

## Cobertura do PILOT (verificada por script)
- 20 itens: **13 campanha / 7 nao_campanha**.
- 9 tipos canônicos cobertos: transferencia_bonificada (4), promocao_emissao (2),
  compra_pontos (1), clube (1), status_match (1), bonus_acumulo (1), shopping (1),
  pontos_mais_dinheiro (1), outro (1).
- 5 padrões de negativo tocados: cupom (1), produto_blog (3), perk (2), resgate (1).
  *(stunt puro não caiu no draw seed; o item editorial "ponte na Itália" cobre a família
  produto_blog/editorial. stunt fica com quota própria na massa — §Plano.)*
- 4 candidatos de divergência (livelo/esfera→azul/smiles, o caso-guia D-051).
- IDs únicos: sim.

---

## Ambiguidades de rótulo encontradas (o valor do PILOT)

### R1 — "até X%" no título = escala oculta. **A regra mais importante e mais frequente.**
**14 de 20 títulos** com número traziam "**até** X%" (livelo→azul 120%, smiles→livelo 80%,
compra Azul 320%, shopping 5.000 pts, clube 54 mil pts). O extrator grava esse teto como
`percentual`. Mas "até 120%" é o **teto de uma escala** — por público (transferência) ou por
volume (compra) — e **quase nunca** é a taxa que o público geral recebe. Gravar o teto como
`percentual` do público geral é exatamente o erro do caso `livelo→azul` (D-048): blog 115/120%
→ oficial escala 50–120%, público geral 50%.

**Proposta de regra (clarifica CRITERIO-ROTULACAO §1, precisa de aprovação):**
> Quando o percentual vem de headline de blog com "**até**/**up to**", o `gabarito.percentual`
> do público **geral** é **`null`** (o teto vira `proveniencia`, não valor), a menos que a
> própria notícia declare a **taxa-base por público** (então grava a base — ver item 3 do PILOT,
> esfera→azul, que diz "70% + até 30% extra por Clube" → base geral **70**). `divergencia.candidato=true`
> nesses itens. Isto **abaixa a precision aparente do % agora**, mas é a leitura honesta e o que
> a fonte oficial confirmaria; é movimento que **aumenta cautela** → livre sob D-051, mas muda a
> convenção do golden, então: **aprovar antes da massa.**

### R2 — cashback de cartão fechado: dentro ou fora do universo? (BORDERLINE, precisa ruling)
Item 18 (Crypto.com "$75 cashback"): D-018 diz "cashback **transferível** está dentro". Cashback
de cartão fechado (crédito na fatura / saldo do app, não conversível a moeda de fidelidade) é
**perk**, não unidade The Loyal. Rotulei `nao_campanha/perk` (leitura conservadora). Mas a fronteira
"transferível vs fechado" não está escrita em lugar nenhum como teste operável.
**Precisa de ruling:** cashback é in-universo **só** quando conversível a ponto/milha/dinheiro
sacável? (proposta: sim; senão é perk).

### R3 — o `tipo` do extrator é ruído sistemático para gap-types (confirma a §0 do critério)
Colisões medidas no PILOT, todas de rótulo canônico **diferente** do balde bruto:
| balde bruto do extrator | rótulo canônico correto | itens |
|---|---|---|
| `compra` | `shopping` | 9 |
| `compra` | `bonus_acumulo` | 10 |
| `compra` | `compra_pontos` | 5 |
| `compra` | `nao_campanha` (cupom/produto/resgate) | 15, 16, 20 |
| `transferencia` | `pontos_mais_dinheiro` | 6 |
| `cartao` | `promocao_emissao` | 7, 8 |
| `cartao` | `nao_campanha` (perk) | 18 |
| `hotelaria` | `status_match` | 13 |
| `hotelaria` | `nao_campanha` (diária cash) | 19 |
| `clube` | `nao_campanha` (assinatura-perk) | 17 |
→ Confirma: **não estratificar por `extraction_json.tipo`**. Os predicados de conteúdo do PILOT
(busca por "shopping/status match/pontos + dinheiro/pontos de boas-vindas") funcionaram e viram a
lista de partida dos predicados de massa.

### R4 — `outro` vs `nao_campanha` na fronteira "gasto-meta" (item 12, Bateu-Ganhou Santander)
Programa de meta de gasto: rotulei `outro` (estrutural, %null) porque o prêmio costuma ser
ponto/milha, mas o **trecho** não confirma que o prêmio é transferível. Se o prêmio for cashback
fechado/desconto, vira `nao_campanha` (R2). **Regra proposta:** na dúvida sobre a natureza do
prêmio, o rótulo exige ler o **conteúdo completo** (não só titulo+trecho) — e se ainda indeterminado,
`outro` com nota, nunca inventar tipo (alinha D-016 abstenção).

### R5 — `shopping` vs `bonus_acumulo` (itens 9 vs 10)
Ambos são "pontue ao comprar". Distinção que apliquei: **shopping** = portal de compras da própria
moeda ("Shopping Livelo", clique-e-pontue) → item 9; **bonus_acumulo** = parceria com merchant
específico para acumular ("Esfera × Shopee") → item 10. É defensável mas **não está congelado**.
**Precisa de definição** de fronteira no CRITERIO antes da massa (senão os dois estratos vazam
um no outro e a precision do tipo fica ruído).

### R6 — vigência: "prorrogado"/"lançamento" sem data ⇒ `indeterminada` (aplicado, alinhado D-021)
Vários itens ("Prorrogado!", "Novidade! lança") não trazem data-fim. Marquei `indeterminada` — não
fabriquei data (INV-16/D-021 overprecision é bloqueante). Onde o título dá "último dia (18/06)" ou
"válida até 09/02", gravei a data com proveniência. Consistente com o parser atual; sem surpresa.

---

## Plano de re-medição em escala (roda DEPOIS da aprovação do critério)

Aprovado o critério e rotuladas as ~400, re-medir **os três motores determinísticos** contra o
golden grande, cada um com antes/depois vs. o golden atual de 86 (D-051 disciplina: versão,
golden-lock, antes/depois, changelog, rollback):

1. **Gate de rejeição** (`gate-run.mjs` / camada A `gate.mjs`): re-medir precision de campanha e,
   **destacada, a precision de `nao_campanha` por padrão** (cupom/resgate/stunt/produto_blog/perk —
   o número público, CRITERIO §4). Alvo: sair do 1,0 **in-sample** (D-019) para número **fora da
   amostra** com IC. Regras da camada A que hoje vêm das 86 passam a ser testadas contra itens que
   **não** as geraram — é o teste que retira o asterisco.
2. **Parser de vigência** (`vigencia-run.mjs`): re-medir overprecision (deve seguir 0, INV-16),
   parsing precision/recall e a taxa de `indeterminada` correta, agora sobre ~400 datas reais
   espalhadas nos 18 meses (o PILOT sugere muita `indeterminada` legítima — prorrogado/lançamento).
3. **Matcher de identidade** (`identidade.mjs` via `score.mjs`/reconciliação): re-medir se
   origem/destino/publico canônicos batem, com foco no **público** — o achado de que a base tem
   **zero `selecionados`** (§1.6) e a regra R1 do "até X%" testam diretamente se o matcher/derivação
   tratam o teto de escala como geral (o bug do caso-guia).

Além disso, com os gap-types agora **reais** (não sintéticos), substituir os 4 sintéticos do PMD
(D-030) e reportar o número **sem o asterisco de sintético** para `pontos_mais_dinheiro`,
`shopping` e `status_match`.

---

## A PERGUNTA que o operador precisa aprovar antes da rotulação em massa

**Aprovar o critério de amostragem (`CRITERIO-AMOSTRAGEM.md`): N=400, a divisão 280 positivos /
120 negativos, as quotas por tipo (com boost declarado dos 3 gap-types e do estrato de divergência),
e o método determinístico `md5(estrato||id)` — E, junto, as 3 clarificações de regra que o PILOT
exigiu:**

1. **R1 — "até X%":** grava-se `percentual=null` para o público geral quando o número é teto de
   escala de blog (mantendo o teto na proveniência)? *(muda a convenção do golden; aumenta cautela)*
2. **R2 — cashback fechado:** é `nao_campanha/perk` sempre que não for conversível a ponto/milha/
   dinheiro sacável?
3. **R5 — shopping vs bonus_acumulo:** congelar a fronteira "portal da própria moeda = shopping /
   parceria com merchant = bonus_acumulo"?

Sem esse aval, a rotulação das 400 fica parada (GATE D-051). Nada foi gravado no banco; nenhum
arquivo do golden atual ou runner foi tocado.
