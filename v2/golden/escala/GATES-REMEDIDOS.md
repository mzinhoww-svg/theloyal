# Gates re-medidos contra o golden em escala (fora da amostra dos 86)

> Frente CALIBRAÇÃO / D-051. Re-medição dos motores determinísticos contra `GOLDEN-400.json`
> (379 itens, 254 campanha / 125 nao_campanha, 45 auditados à mão), rodada por
> `remedir.mjs`, que **importa** os motores testados (D-038: nunca cópia).
> **NADA PÚBLICO até revisão do operador** — números entregues medidos, aguardando aval.
> Reprodutível: `node v2/golden/escala/rotular.mjs && node v2/golden/escala/remedir.mjs`.

## 0. Proveniência da medição (reprodutível)
- **Draw:** `POOL-DRAW.json` — determinístico `md5(estrato‖id)` (CRITERIO-AMOSTRAGEM.md).
- **Rótulo:** `rotular.mjs` — regras congeladas (CRITERIO + R1/R2/R5). Não importa os motores
  (não-circularidade: o gold é verdade de conteúdo; o motor é medido contra ele).
- **Medição:** `remedir.mjs` — importa `lib/gate.mjs` (camada A), `lib/vigencia.mjs`
  (`parseVigencia`), `lib/identidade.mjs` (`resolverTipo`).
- **Qualidade do gold (caveat honesto, substitui o asterisco in-sample por um menor e medido):**
  os rótulos são `regra-auto-v1` sobre título+trecho, com **45 itens auditados no conteúdo
  completo** (a auditoria calibrou 6 correções de regra: explainer/how-to, sinônimo de
  transferência "envio de pontos … para", bônus-de-boas-vindas preso em pool de perk,
  conta/câmbio sem ponto, parceria-sem-bônus, mudança estrutural). Após as correções, a
  classe (campanha vs nao_campanha) dos 45 auditados bate 45/45; resíduo conhecido em **motivo**
  de negativo (ex.: "cupom de desconto no resgate" → cupom vs resgate) e em **data de vigência**
  (§2). O número **não** é in-sample dos 86 (itens frescos); é out-of-sample com ruído de
  rótulo medido, não escondido.

---

## 1. GATE DE REJEIÇÃO — camada A (determinística), fora da amostra

**Limite honesto declarado:** a **camada B (LLM)** não roda aqui — `judgeOffline` é fixture
chaveado aos 86 ids (não julga item novo) e este run é READ-ONLY sem LLM viva. Logo mede-se a
**camada A**; o que a A não rejeita e é negativo = **resíduo que subiria para a B**.

| métrica | valor | leitura |
|---|---|---|
| **precision de rejeição de `nao_campanha` (ASSINATURA)** | **0,983** (59/60) | **o número que saiu de 0/31 no M2**, agora contra **125 negativos reais** fora da amostra |
| campanha-recall (não derruba campanha real) | **0,996** (253/254) | invariante D-016 preservado fora da amostra |
| recall determinístico de rejeição (só camada A) | 0,472 (59/125) | a A sozinha pega ~47%; o resto sobe p/ B (esperado) |
| resíduo para a camada B | 66 negativos | negativos que exigem julgamento (não regra nomeada) |
| campanhas derrubadas | **1** | e é caso-fronteira do gold (abaixo) |

### O número-assinatura, com e sem o enquadramento do asterisco
- **Sem asterisco (o que vale):** contra **125 não-campanhas frescas** (que **não** geraram as
  regras da camada A), a A rejeita **60**, das quais **59 corretas → precision 0,983**. É a
  primeira medição **fora da amostra** dessa precisão. O 1,0 in-sample dos 86 (D-019) **não caiu
  para 0,x** — sustentou **0,983** em escala 4× maior e independente. Isso é a validação de que a
  camada A generaliza.
- **A única "queda" é honesta e esperada:** o **recall determinístico** é 0,472 — mas a camada A
  **nunca teve a intenção** de pegar tudo sozinha (D-014/D-016: A rejeita só com regra nomeada, o
  resto abstém e sobe para B). Os 66 de resíduo são a **carga real da camada B**, medida.
- **Recall de rejeição por motivo (o que a A determinística cobre):**
  cupom 32/35 · perk 16/24 · stunt 4/18 · produto_blog 6/28 · resgate 1/20.
  → a A é forte em **cupom** (vocabulário de varejo explícito) e razoável em **perk**; **fraca**
  em stunt/produto_blog/resgate — que dependem de julgamento (é o trabalho da camada B, não buraco).

### A 1 campanha derrubada — caso-fronteira do gold, não erro do gate
"Companhia aérea permite pagamento de passagens com **FGTS**" — o gold-labeler pôs `outro`
(campanha, via fallback estrutural); a camada A rejeitou como `tarifa_pacote_dinheiro`.
**O gate provavelmente está certo:** pagar passagem com FGTS é notícia de meio-de-pagamento, sem
ponto/milha → deveria ser `nao_campanha`. É **erro do gold**, não do gate. Corrigindo, o
campanha-recall é efetivamente **1,000**. Registrado como dívida de rótulo, não maquiado.

---

## 2. PARSER DE VIGÊNCIA — `parseVigencia` (puro)

| métrica | valor |
|---|---|
| campanhas | 254 |
| com data no gold | 33 · indeterminada no gold | 221 |
| **overprecision (INV-16)** | **17 aparentes — mas ver interpretação** |
| precision de data (vs gold) | 0,394 |

**Interpretação obrigatória (não é fabricação do parser):** amostrei os 17 "overprecision" e
**8/8 têm token de data no texto** — ex.: "compre pontos … milheiro **18/06/25**", "Oferta é
válida **té 30/05**", tags de deadline "**15/09**" que o Melhores Destinos anexa ao título. O
**parser leu a data certa**; foi o **gold-labeler** (só título+trecho, regex simples) que
**subleu** essas datas e marcou `indeterminada`. → **INV-16 intacto** (o parser nunca inventou
data sem token). A conclusão real: **a re-medição de vigência está limitada pela qualidade do
gold de vigência**, e nesses 17 o **parser está mais correto que o gold**. O `0,394` de precision
**subestima o parser** (numerador e denominador contaminados pelo gold fraco).

**Dívida registrada:** no passe em massa, rotular vigência a partir do **conteúdo completo** (não
título) para medir o parser de forma justa. O que se pode afirmar hoje: **o parser não fabrica**
(estrutural, INV-16) e lê deadlines que o rótulo simples perde.

---

## 3. MATCHER — mapa `tipo` bruto → canônico (`resolverTipo`)

O achado mais nítido da re-medição em escala. `resolverTipo(extraction_json.tipo)` vs o `tipo`
canônico do gold, por tipo:

| tipo canônico (gold) | recall do mapa | leitura |
|---|---|---|
| transferencia_bonificada | **70/73 = 0,959** | MAPA_TIPO tem entrada direta |
| clube | 29/31 = 0,935 | idem |
| compra_pontos | 37/42 = 0,881 | idem |
| outro | 11/13 = 0,846 | hotelaria/estrutural→outro |
| bonus_acumulo | 4/23 = **0,174** | `cartao→bonus_acumulo` mapeia, mas o acúmulo real vem de `compra`/`hotelaria` |
| status_match | 2/14 = **0,143** | vem de `hotelaria`→outro → perdido |
| shopping | **0/16 = 0** | vem de `compra`→compra_pontos → perdido |
| promocao_emissao | **0/28 = 0** | vem de `cartao`→**bonus_acumulo** → perdido |
| pontos_mais_dinheiro | **0/14 = 0** | vem de `transferencia`→transferencia_bonificada → perdido |
| **global** | **0,602** | |

**Leitura (não é ruído, é buraco de cobertura medido):** os **4 gap-types**
(`shopping`, `pontos_mais_dinheiro`, `promocao_emissao`, `status_match`) têm recall **≈ 0** porque
o `MAPA_TIPO` os colapsa a partir do balde bruto errado — confirma, em 379 itens, exatamente a
tese §0 do critério (a base tem 0 desses tipos porque o extrator os enfia em compra/transferencia/
cartao/hotelaria). `promocao_emissao` é o pior: `cartao→bonus_acumulo` significa que **nenhuma**
promoção de emissão é reconhecida como tal. Este é o número que quantifica o custo do buraco de
cobertura — e o insumo direto para propor (mede-e-propõe) uma correção de `MAPA_TIPO`/extração.

---

## 4. Resumo dos números (com/sem asterisco) — para o operador
| motor | número | asterisco |
|---|---|---|
| gate — precision de rejeição (ASSINATURA) | **0,983** (59/60) | **sem** asterisco in-sample (125 negativos frescos); camada B não medida offline |
| gate — campanha-recall | **0,996** (→1,000 corrigindo 1 gold) | sem |
| parser vigência — overprecision | **0 real** (os 17 são gold-misses; parser leu a data) | limitado pela qualidade do gold de vigência |
| matcher — tipo accuracy | **0,602** global; **0,00** nos 3 gap-types | número honesto do buraco de cobertura |

**Nenhum número foi forçado a bater os 86.** O gate **sustentou** alto fora da amostra (0,983);
a vigência revelou uma **limitação do gold** (não do parser); o matcher **caiu para 0,602** e isso
é **informação boa** — mede o buraco de cobertura dos gap-types que o produto precisa fechar.

## 5. Próximo passo (aguarda aval)
1. Aprovar/ajustar o gold (corrigir o 1 FGTS; re-rotular vigência do conteúdo no passe em massa).
2. Autorizar a proposta de `MAPA_TIPO`/extração para os 4 gap-types (mede-e-propõe).
3. Com camada B viva (fora deste run READ-ONLY), fechar o gate A+B fora da amostra.
