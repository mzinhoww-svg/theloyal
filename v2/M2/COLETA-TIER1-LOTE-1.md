# COLETA TIER 1 — LOTE 1 (dry-run "confirma-e-mostra", D-049 §3.5)

> **Modo:** confirma-e-mostra. Este lote **COMPUTA e REPORTA** — não grava
> `tier=1`, não corrige dado, não publica. Serve para o operador **cravar o
> limiar de confiança de partida** vendo o primeiro lote real (D-049 §3.5).
> Ref: **2026-07-17**. Projeto Supabase `qjqnqcsdnpvvmyzkavoq` (somente leitura).
>
> Código: `v2/lib/coleta/confianca.mjs` (gate puro), `v2/lib/coleta/coleta-tier1.mjs`
> (runner), tests `*.test.mjs` (36 verdes). Saída crua: `COLETA-TIER1-LOTE-1.json`.

---

## 0. O que rodou (Parte A + Parte C, sem gravar)

**Alvo:** 18 vivas crawleáveis (`estado ∈ {ativa,detectada,ultimos_dias}`,
`identidade_id NOT NULL`, `origem_code ∈ {livelo(9), esfera(6), smiles(3)}`).
TAP não tem vivas no snapshot.

**Fluxo por item** (reuso: `adapters/*` sitemap+fetch, `matcher-url`, `vigencia`,
`score`): sitemap oficial → casa URL com a viva → fetch **redirect-manual**
(200=viva; 3xx→/promocao=encerrada) → **detecta campanha vs evergreen pela JANELA
DE VIGÊNCIA no regulamento** (D-047; sem janela=evergreen, pula) → extrai termos
(%, público) → `classificarResultado()` (corrobora_limpo/ajuste/refuta) +
`confianca()` (função pura de sinais objetivos) → mostra a decisão que o gate
**TOMARIA** a vários limiares.

**Varredura de sitemap (real):** livelo **19**, esfera **32**, smiles **346** URLs
de campanha descobertas e filtradas pelos adapters. A cobertura dos sitemaps de
campanha explica o gargalo (§4): a maioria das vivas é compra/clube/acúmulo cuja
página oficial **não é uma URL de campanha** (é evergreen institucional ou a oferta
mora num terceiro).

---

## 1. A confiança é determinística (INV-12) e ORTOGONAL ao resultado (D-049)

`confianca(sinais)` (`v2/lib/coleta/confianca.mjs`, `CONFIANCA_V1`) é **função pura
de fatos sim/não** — nunca nota de LLM. Pesos versionados (somam 1,0):

| sinal | peso | o que é |
|---|--:|---|
| `fonte_oficial` | 0,30 | regulamento em domínio oficial vs blog/redirect (D-045) — dominante: blog não confirma |
| `janela_vigencia_clara` | 0,25 | regulamento tem janela datada (D-047) — ausente = evergreen/não datável |
| `estado_vivo_200` | 0,15 | fetch 200 (não 3xx→/promocao) |
| `publico_inequivoco` | 0,15 | escala/público sem ambiguidade (cada público → seu %) |
| `termos_legiveis` | 0,15 | conseguimos extrair os termos oficiais (%/público) com proveniência |

**Ortogonalidade (D-049 / INVIOLÁVEL da tarefa):** a confiança mede *quão bem
verificamos*; o **resultado** ∈ {corrobora_limpo, corrobora_com_ajuste, refuta,
nao_verificavel} é eixo **separado** (a comparação dos termos). O caso azul
verificaria com **alta** confiança E **refutaria** — o sinal de "termos" aqui é
`termos_legiveis` (conseguimos ler+comparar), **não** "termos concordam".
Concordância vive no resultado.

> **Nota de contrato:** a SPEC §3.1 fraseava "termos corroboram sem divergência?"
> como se derrubasse a confiança do azul; **D-049** (filho de D-048, e a diretriz
> INVIOLÁVEL desta tarefa) corrige: confiança ⊥ resultado. O código segue D-049.
> Isso é implementação do contrato aprovado — não decisão nova de produto.

**Resultado (tolerância D-049 ref.2):** `refuta` = % ausente de **todas** as faixas
distintas; `corrobora_com_ajuste` = % existe mas há **escala-por-público** (≥2 %
distintos → separar em N identidades, D-047) ou público atribuído errado;
`corrobora_limpo` = % bate na faixa única do público certo dentro de **±2pp**
(e "até X%" ≡ "X%"). O mesmo % citado 2× (ruído de scraping) **não** é escala.

---

## 2. Primeiro lote — dados crus (18 itens)

| viva | tl_score | status coleta | **resultado** | conf. | janela achada | onde cai vs limiar 0,75 |
|---|--:|---|---|--:|---|---|
| **livelo-hilton-hotelaria-2026-07-31** | 65 | campanha | **corrobora_limpo** | **1,00** | 2026-07-31 ✓ | **≥ limiar → auto-publica** |
| smiles-desconhecido-compra-2026-07-17 | 55 | campanha | corrobora_com_ajuste | 0,85 | 2026-07-31 (ruidosa) | revisão (separar público, D-047) |
| esfera-esfera-compra-2026-07-31 | 40 | **evergreen** | nao_verificavel | 0,45 | — (sem janela) | revisão (nada a corroborar) |
| esfera-desconhecido-compra-2026-07-30 | 67 | sem_url_oficial | nao_verificavel | 0,00 | — | revisão |
| esfera-desconhecido-clube-2026-07-17 | 51 | sem_url_oficial | nao_verificavel | 0,00 | — | revisão |
| esfera-esfera-compra-2026-07-22 | 49 | sem_url_oficial | nao_verificavel | 0,00 | — | revisão |
| esfera-all accor-transferencia-2026-07-16 | 41 | sem_url_oficial | nao_verificavel | 0,00 | — | revisão |
| esfera-esfera-clube-2026-07-17 | 27 | sem_url_oficial | nao_verificavel | 0,00 | — | revisão |
| livelo-aliexpress-compra-2026-07-21 | 60 | sem_url_oficial | nao_verificavel | 0,00 | — | revisão |
| livelo-aliexpress-compra-2026-07-23 | 60 | sem_url_oficial | nao_verificavel | 0,00 | — | revisão |
| livelo-livelo-compra-2026-07-24 | 51 | sem_url_oficial | nao_verificavel | 0,00 | — | revisão |
| livelo-livelo-compra-2026-12-31 | 41 | sem_url_oficial | nao_verificavel | 0,00 | — | revisão |
| livelo-livelo-clube-2026-07-20 | 18 | sem_url_oficial | nao_verificavel | 0,00 | — | revisão |
| livelo-livelo-clube-2026-12-18 | 18 | sem_url_oficial | nao_verificavel | 0,00 | — | revisão |
| livelo-livelo-clube-2026-08-08 | 18 | sem_url_oficial | nao_verificavel | 0,00 | — | revisão |
| livelo-livelo-clube-2026-07-25 | 18 | sem_url_oficial | nao_verificavel | 0,00 | — | revisão |
| pagol-smiles-compra-2026-07-23 | 51 | sem_url_oficial | nao_verificavel | 0,00 | — | revisão |
| smiles-smiles-clube-2026-07-20 | 27 | sem_url_oficial | nao_verificavel | 0,00 | — | revisão |

Todos os `tl_score_bruto` **< 70** → **nenhum passa o corte de valor** (§5). Ver §6.

---

## 3. As três confirmações reais (detalhe)

### 3.1 livelo→hilton — CORROBORA LIMPO, confiança 1,00 (a confirmação-modelo)
- **URL oficial casada:** `livelo.com.br/livelo-para-parceiros/hilton-honors/HILTransfer`
  (via `regulamento_url`; **confirmada no sitemap** da varredura — `sitemap_confirma:true`).
- **Janela achada (sim):** *"Válido das 10h do dia 01/07 até as 23h59 do dia
  **31/07/2026**"* → campanha datada (D-047), bate com a viva (`vigencia_fim 2026-07-31`).
- **Termos oficiais:** *"**50% de bônus para todos** os participantes"* → escala de
  **uma faixa**, público **geral**. Bate com o ingerido (50%, geral).
- **Resultado:** `corrobora_limpo` (50%≡50%, faixa única, público certo).
- **Confiança 1,00** — breakdown: fonte_oficial 0,30 · janela 0,25 · 200 0,15 ·
  público_inequívoco 0,15 · termos_legíveis 0,15. Todos os 5 sinais presentes.
- **Decisão a qualquer limiar da grade (0,60–0,90):** *auto-publica* — mas ver §6
  (barrado no corte de valor: score 65 < 70).
- **Score com o termo corroborado:** o termo **não muda** (50%=50%) → o
  `tl_score_bruto` permanece **65** ("Só para casos específicos", 55–69). Coleta
  limpa não move o score aqui; move a **fonte** (TIER 2 → TIER 1).

### 3.2 smiles compra 375% — CORROBORA COM AJUSTE, confiança 0,85 (escala + página compartilhada)
- **URL oficial:** `smiles.com.br/campanhas/cm-400-20260715` (via `regulamento_url`).
- **Janela:** presente, mas o parser pegou *"de 31/07/2026 a 06/08/2026"* — janela de
  **outra** sub-campanha (aluguel de carro) na **mesma página**. A página é um
  regulamento **multi-campanha**.
- **Termos:** escala-por-público real — *"315% de bônus"* base + planos Clube
  1.000…20.000 e Categoria Diamante subindo até *"**até 375%**"*. O 375 da viva
  **existe** (topo Diamante), mas atado a escala.
- **Resultado:** `corrobora_com_ajuste` — número presente em **escala-por-público**
  (9 faixas distintas) → **separar em N identidades (D-047)**, nunca colapsar.
- **Confiança 0,85** — cai porque `publico_inequivoco=0`: a página mistura campanhas
  e planos, o mapeamento público→% sai **ambíguo** no scraping. Correto o gate
  **não** auto-confirmar: manda para revisão (separar por público).
- **Decisão a qualquer limiar:** revisão (ajuste é sempre decomposição humana no dia 1).

### 3.3 esfera compra (PASSAGEIRO50) — EVERGREEN, confiança 0,45
- **URL oficial:** `esfera.com.vc/p/compra-de-pontos/e000100033` (via `regulamento_url`).
- **Janela:** **ausente**. A página é o **evergreen institucional** de compra de
  pontos (campo de cupom dinâmico), **sem janela datada** → evergreen (D-047).
- O cupom *PASSAGEIRO50* (50% off) é oferta de **terceiro** (blog), **não** consta
  na página oficial evergreen. Não há como corroborar o termo pela fonte oficial.
- **Resultado:** `nao_verificavel`. **Confiança 0,45** (fonte oficial + 200, sem
  janela/termos). → revisão. **Não força TIER 1** (INV-01/INV-03).

---

## 4. Contagens

| categoria | n |
|---|--:|
| **corrobora_limpo** | **1** (livelo→hilton) |
| corrobora_com_ajuste | 1 (smiles 375%, escala) |
| refuta | 0 |
| evergreen (falso-positivo de campanha) | 1 (esfera compra) |
| encerrado (3xx) | 0 |
| **sem URL oficial** (bloqueado, nunca força) | **15** |
| **total** | **18** |
| publicariam no limiar de partida 0,75 | **1** (hilton — mas ver corte de valor §6) |

**Os 15 sem URL oficial** — a razão é sempre a mesma: a oferta veio de **terceiro**
(`passageirodeprimeira`, `melhorescartoes`, `tavily`) e **não tem página de campanha
oficial crawleável**:
- **compra/acúmulo de pontos** (livelo compra 55%/12%, aliexpress 25 pts/dólar,
  esfera compra 50%): a página oficial é evergreen ou inexistente no sitemap de campanha;
- **clube/assinatura** (livelo clube 378k/382k/142k, esfera clube, smiles clube):
  landing evergreen do clube, sem regulamento datado por promo;
- **terceiro-intermediário** (pagol→smiles 80%): PaGol não é `smiles.com.br`;
- **esfera→accor 20%**: sem campanha de transferência Esfera no sitemap.

Nenhum foi forçado a TIER 1 — reportados item a item, como manda a spec.

---

## 5. Limiar de partida proposto: **0,75** (com justificativa)

**Proposta ao operador: começar em `limiar_confianca = 0,75`, que é também o PISO
inicial** (trava 1, D-048: subir é livre; baixar do piso exige o operador).

**Por quê 0,75:**
1. **Exige o essencial e nada menos.** 0,75 só é atingível com `fonte_oficial`
   (0,30) **+** `janela_vigencia_clara` (0,25) **+** pelo menos duas das três
   restantes (200/público/termos, 0,45 disponíveis). Ou seja: **fonte oficial +
   campanha datada + leitura limpa dos termos**. Um evergreen (0,45) ou uma página
   ruidosa não passam.
2. **Separa o lote real com folga.** A única confirmação limpa (hilton) marca
   **1,00**; o evergreen marca 0,45; os bloqueados 0,00. Não há item na zona cinza
   0,60–0,80 neste lote — **a qualquer limiar da grade só o hilton auto-publicaria**.
   Logo o operador pode iniciar conservador **sem custo de recall**.
3. **Dia 1 pede quase-certeza (D-049 §3.5).** O auto-ajuste (§3.3 da spec) só liga
   após **volume mínimo** de desfechos conhecidos (trava 3). Até lá, 0,75 mantém a
   automação restrita ao que é inequívoco (fonte+janela+termos), e a barra **sobe
   sozinha** se precisar; **descer** dela é decisão gated do operador.

Grade completa mostrada por item no JSON (`decisoes` em 0,60/0,70/0,75/0,80/0,90).

---

## 6. Os dois eixos não se confundem (§5 da spec) — o achado que importa

**Corte de VALOR (`tl_score_bruto ≥ 70`) ⊥ limiar de CONFIANÇA.** Neste lote os
eixos se cruzam de um jeito instrutivo:

- **A coleta funcionou** (hilton: fonte oficial confirmou os termos com confiança
  máxima), **mas o item não é publicável por VALOR**: 65 < 70 → banda "Só para casos
  específicos". Confiança alta **não** compra valor.
- **Todas as 18 vivas crawleáveis estão < 70** (máx. 67). Ou seja: a fila crawleável
  viva de hoje, mesmo confirmada, **não enche o Deal Desk publicável** — bate no
  corte de valor, não no de fonte. Isso empurra a prioridade para a **Parte B**
  (derivação lado-único, D-042): boa parte desses 55–67 é score semi-artificial que
  a derivação vai reavaliar antes de valer confirmação.
- **Leitura para o operador:** a Parte A está pronta e provada (1 corroboração limpa
  ponta a ponta, fonte oficial → termos → confiança determinística). O gargalo do
  Deal Desk vivo agora é **valor** (Parte B) e **cobertura de fonte oficial** (a
  maioria das vivas vem de terceiro sem página de campanha), não o gate de confiança.

---

## 7. Casos notáveis

- **Nenhuma divergência tipo-azul (refuta) neste lote.** O mecanismo está testado
  (golden `confianca.test.mjs`: 115% × escala 50/100/105/110/120 → `refuta` com alta
  confiança), mas nenhuma viva crawleável atual apresentou % fabricado refutável.
- **smiles: página de regulamento multi-campanha** é o análogo estrutural do azul —
  não por número fabricado, mas por **densidade/ambiguidade**: uma URL concentra
  várias campanhas e a escala Clube. O gate reagiu certo — **não auto-confirmou**,
  marcou `ajuste` + `publico_inequivoco=0` → revisão para separação por público (D-047).
- **Headless bloqueado, SSR aberto.** O Chromium headless recebeu um **interstício
  de consentimento/anti-bot** (~186 KB idêntico) nas três origens; o **fetch HTTP
  simples (SSR)** trouxe o regulamento renderizado (Livelo entrega o texto em JSON no
  HTML; Smiles/Esfera SSR). O runner usa o SSR — mais estável que o headless aqui.

---

*Promoções podem mudar sem aviso. Confira sempre as regras no site oficial antes
de comprar, transferir ou resgatar.*
