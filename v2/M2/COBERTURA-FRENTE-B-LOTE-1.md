# COBERTURA — FRENTE B — LOTE 1 (reverse-lookup por sitemap oficial, dry-run)

> **Modo:** confirma-e-mostra (D-050). Este lote **COMPUTA e REPORTA** — não grava
> `tier=1`, não corrige dado, não publica. Auto-publish DESLIGADO (D-050).
> Ref: **2026-07-17**. Projeto Supabase `qjqnqcsdnpvvmyzkavoq` (somente leitura).
>
> Código: `v2/lib/coleta/reverse-lookup.mjs` (núcleo puro + fetch injetável),
> tests `reverse-lookup.test.mjs` (13 verdes; suíte v2 **188/188**). Saída crua:
> `COBERTURA-FRENTE-B-LOTE-1.json`. Fixture: `fixtures/vivas-frente-b.json`.

---

## 0. O que a Frente B faz (e como difere do forward pass do lote-1)

O forward pass (`coleta-tier1.mjs`) parte do `regulamento_url` de terceiro OU de um
match de slug estreito (transferencia/hotelaria). Sobraram **15 vivas "sem_url_oficial"**.

A **Frente B** faz o **inverso e exaustivo** (SPEC §2): para cada viva **sem** fonte
oficial cujo `origem_code` OU `destino_code` tem adapter, **varre o sitemap OFICIAL**
daquele programa e casa **cada URL de campanha** com a identidade M1 da viva
(`matcher-url.casarUrlCampanha`), no **nível do PAR** (origem+destino; público fica
para o gate, D-047). As candidatas — **só do domínio oficial** — passam pelo **gate**
(`avaliarViva` → `confianca()`/`classificarResultado()`, D-048/D-049).

**Os 4 travamentos + a extensão do operador, no código:**
1. **Alimenta o gate, não o pula.** Toda candidata roda `avaliarViva` (o gate inteiro):
   corrobora_limpo / corrobora_com_ajuste / refuta / não_verificável. Achar a página
   **não** confirma.
2. **Motor de busca = sitemap oficial**, nunca web search geral. Sem candidata no
   sitemap → **FILA MANUAL (D-003)**, jamais web search. (`candidatosSitemap` só lê
   `discovered[programa]`, que vem de `adapter.descobrirUrls(sitemap)`.)
3. **Domínio oficial só** — a candidata nasce do host do adapter; blog não entra.
4. **Campanha vs evergreen pela JANELA de vigência** (D-047), herdado de `avaliarViva`.

**Alvo (puxado do banco):** **21 vivas** (`estado ∈ {ativa,detectada,ultimos_dias}`,
`identidade_id NOT NULL`, sem `campanha_fontes` tier=1) com origem/destino ∈
{livelo, smiles, esfera, tap}. Inclui os 15 do lote-1 sem URL + pares **banco→programa**
que agora entram no corte por terem o destino coberto (bradesco→livelo, bb→smiles,
bradesco→smiles) — o alvo cresceu desde o lote-1 (18 → 21).

**Varredura real de sitemap:** livelo **19**, esfera **32**, smiles **346** URLs de
campanha. (TAP não tem viva no alvo.)

---

## 1. O corte que o operador quer: RESOLVEU vs FILA MANUAL

Medido pelo **RESULTADO do gate** (oferta que ganhou TIER 1 **confirmável**, não por
página encontrada):

| desfecho | n | o que significa |
|---|--:|---|
| **resolvido — TIER 1 confirmável** (gate corrobora) | **1** | achou página datada oficial que o gate **corrobora_limpo** |
| candidata NÃO confirma (sitemap expôs, gate barrou) | 1 | páginas oficiais existem, mas nenhuma é a campanha do termo → gate recusou |
| **fila manual** (sitemap **não** expôs o par) | **19** | domínio oficial não tem página de campanha do par → D-003 |
| **total** | **21** | |

**A leitura honesta (o que importa):** a Frente B **resolveu 1 de 21** — e esse 1 é o
**livelo→hilton**, que o forward pass **já** tinha via `regulamento_url`. Ou seja, a
Frente B **re-encontrou-o de forma independente pelo sitemap** (validação ponta a
ponta do reverse-lookup: sitemap → matcher → gate → `corrobora_limpo` conf **1,00**),
mas **não adicionou nenhuma cobertura NOVA**. As 20 vivas que o forward pass não
resolvia **continuam sem fonte oficial automática**. Nenhuma passou pelo corte de
valor (`tl_score_bruto ≥ 70`): o único resolvido marca **65**.

> **Sinal para o roadmap (o que a própria SPEC antecipou):** *"Se nada resolver
> (tudo cai na fila manual), reporte isso — é sinal de que a Frente A (adapters)
> precisa vir mais cedo."* É exatamente o caso. O reverse-lookup **funciona**, mas
> os 4 adapters atuais (livelo/smiles/esfera/tap) não cobrem os **lados** onde as
> ofertas vivas moram (bancos emissores como origem; merchants de compra). **A
> Frente A (mais adapters) é o desbloqueio real, não a Frente B.**

---

## 2. Dados crus — por item

| viva | score | sitemaps varridos | candidata (URL do domínio oficial) | janela? | resultado gate | conf | desfecho |
|---|--:|---|---|---|---|--:|---|
| **bradesco→livelo transferência** | **91** | livelo=19 | — | — | — | 0,00 | **fila manual** |
| esfera→sem_destino compra (0730) | 67 | esfera=32 | — | — | — | 0,00 | fila manual |
| **livelo→hilton hotelaria** | 65 | livelo=19 | `livelo.com.br/.../hilton-honors/HILTransfer` | **2026-07-31 ✓** | **corrobora_limpo** | **1,00** | **RESOLVIDO (TIER 1)** |
| smiles→sem_destino compra 375% | 64 | smiles=346 | 17 páginas `clube-smiles*` | 2024 (velha) | nao_verificavel | 0,70 | candidata não confirma |
| bb→smiles cartão | 63 | smiles=346 | — | — | — | 0,00 | fila manual |
| bradesco→smiles clube | 63 | smiles=346 | — | — | — | 0,00 | fila manual |
| livelo→aliexpress compra (0723) | 60 | livelo=19 | — | — | — | 0,00 | fila manual |
| livelo→aliexpress compra (0721) | 60 | livelo=19 | — | — | — | 0,00 | fila manual |
| livelo→livelo compra 55% | 51 | livelo=19 | — | — | — | 0,00 | fila manual |
| pagol→smiles compra 80% | 51 | smiles=346 | — | — | — | 0,00 | fila manual |
| esfera→esfera compra (0722) | 49 | esfera=32 | — | — | — | 0,00 | fila manual |
| esfera→accor transferência 20% | 41 | esfera=32 | — | — | — | 0,00 | fila manual |
| livelo→livelo compra 12% | 41 | livelo=19 | — | — | — | 0,00 | fila manual |
| esfera→esfera compra clube 50% | 40 | esfera=32 | — | — | — | 0,00 | fila manual |
| esfera→esfera clube | 27 | esfera=32 | — | — | — | 0,00 | fila manual |
| smiles→smiles clube | 27 | smiles=346 | — | — | — | 0,00 | fila manual |
| livelo→livelo clube (1218) | 18 | livelo=19 | — | — | — | 0,00 | fila manual |
| livelo→livelo clube (0808) | 18 | livelo=19 | — | — | — | 0,00 | fila manual |
| livelo→livelo clube (0725) | 18 | livelo=19 | — | — | — | 0,00 | fila manual |
| livelo→livelo clube (0720) | 18 | livelo=19 | — | — | — | 0,00 | fila manual |
| esfera→sem_destino clube | s/dado | esfera=32 | — | — | — | 0,00 | fila manual |

---

## 3. PONTO DE PARADA — a oferta forte viva (o que o operador queria ver)

**A única viva FORTE do alvo é `bradesco→livelo` (tl_score_bruto 91, "Vale agir") — e
ela caiu na FILA MANUAL.** É o achado central para o operador:

- **Por que não resolveu:** origem = **bradesco** (banco emissor, **sem adapter**);
  destino = livelo (com adapter). O reverse-lookup varreu o **sitemap da Livelo (19
  URLs)**, mas a Livelo hospeda páginas **livelo→parceiro** (a Livelo como *origem* que
  transfere para fora), **não** `banco→livelo`. A campanha de transferência bonificada
  **de um banco para a Livelo** mora no site do **banco** — que não tem adapter. Logo
  **nenhuma URL do sitemap Livelo casa o par** → manual. Correto e honesto.
- **Ressalva de conteúdo (não force):** essa viva vem de *"bradesco e amex **sorteiam**
  5 milhões de pontos Livelo"* e tem **`percentual` = null** — é um **sorteio**, não um
  bônus de transferência com %. O score 91 sem % pede diligência humana de qualquer
  forma. **Não é candidata a Deal Desk de estreia** enquanto não confirmada por fonte
  oficial e reclassificada — e o reverse-lookup, corretamente, **não a confirmou**.

**Conclusão do ponto de parada:** **não há, neste alvo, oferta forte viva que o gate
corrobore com TIER 1.** A máquina continua a **recusar honestamente** (D-050): o dia
fraco reportado como dia fraco. A primeira candidata real a Deal Desk ainda não
apareceu — e a Frente B mostra **por quê**: as ofertas fortes vêm de programas **sem
adapter** (bancos), fora do alcance dos 4 sitemaps atuais.

---

## 4. Os dois casos com detalhe

### 4.1 livelo→hilton — RESOLVIDO, corrobora_limpo, confiança 1,00 (o reverse-lookup provado)
- **Como o sitemap achou:** a varredura das 19 URLs de campanha da Livelo casou
  `livelo.com.br/livelo-para-parceiros/hilton-honors/HILTransfer` com a identidade da
  viva **pelo par** (origem livelo + destino hilton), **sem** depender do
  `regulamento_url` de terceiro. Prova que o reverse scan funciona de forma autônoma.
- **Janela (D-047):** *"Válido das 10h do dia 01/07 até as 23h59 do dia 31/07/2026"* →
  campanha datada, bate com a viva (`vigencia_fim 2026-07-31`).
- **Termos:** *"50% de bônus para todos"* → escala de **uma faixa**, público geral,
  bate com o ingerido (50%, geral) → **corrobora_limpo**.
- **Confiança 1,00** (5/5 sinais). Decisão a **qualquer** limiar da grade: auto-publica
  — **mas barrado no corte de valor** (65 < 70). Confiança alta não compra valor.

### 4.2 smiles compra 375% — candidata NÃO confirma (o gate segurou, como deve)
- **O sitemap expôs 17 páginas `clube-smiles*`** que casaram o par (smiles, sem_destino)
  no nível do par — mas **nenhuma é a campanha de compra de milhas com o 375%**. A
  "melhor" candidata (`clube-smiles-day/ofertas-surpresa/25092024`) tem janela de
  **set/2024** (velha) e **sem escala de bônus legível** para o 375%.
- **Gate:** `resultado = nao_verificavel` (`sem_pct_ingerido_ou_escala_vazia`),
  confiança **0,70** (fonte_oficial 0,30 + janela 0,25 + 200 0,15; sem público
  inequívoco, sem termos legíveis). Abaixo do limiar de partida 0,75 **e**
  não_verificável → **revisão**, nunca TIER 1. **A trava 1 funcionou: achou páginas
  oficiais, o gate recusou.**
- **Dívida de precisão anotada (§6):** para viva `lado_unico`/`sem_destino` de
  **compra**, o casamento por par (origem + sem_destino) é **frouxo** — puxa toda
  página `clube-smiles`. Não gerou TIER 1 falso (o gate é o backstop), mas é ruído.
  Endurecer o candidato de compra por **tipo** + slug de "compre/comprar milhas" é
  melhoria da Frente C.

---

## 5. As 19 da fila manual — por que o sitemap não expôs (padrão)

Sempre a mesma causa-raiz, e **não** é o gate: é **alcance da rede de adapters**.

- **Bancos como origem (sem adapter):** `bradesco→livelo` (91), `bb→smiles` (63),
  `bradesco→smiles` (63). A página de campanha mora no **banco**, não no programa de
  pontos coberto. → **Frente A: adapters de banco emissor.**
- **Compra/acúmulo de pontos:** `livelo→livelo 55%/12%`, `aliexpress 25 pts/dólar`,
  `esfera→esfera 50%`. A página oficial é **evergreen institucional** (sem janela
  datada por promo) ou a oferta é cupom de terceiro → não há URL de campanha datada no
  sitemap. → **Frente C** (matcher de compra) ou fila manual.
- **Clube/assinatura:** `livelo clube ×4`, `esfera clube ×2`, `smiles clube`. Landing
  evergreen do clube, sem regulamento datado por promo → manual.
- **Intermediário:** `pagol→smiles 80%` (origem_code colapsa em smiles pelo alias, mas a
  oferta é da **PaGol**, não `smiles.com.br`) → manual.
- **Transferência sem campanha no sitemap:** `esfera→accor 20%` — Esfera não expõe
  página de campanha de transferência no sitemap coberto → manual.

**Nenhuma foi forçada a TIER 1.** Reportadas item a item, como manda a spec.

---

## 6. Conclusão para o operador

1. **O reverse-lookup está pronto e provado** (livelo→hilton re-encontrado pelo sitemap,
   independente do terceiro, `corrobora_limpo` conf 1,00; suíte 188/188). O mecanismo,
   os 4 travamentos e a fila manual funcionam.
2. **Mas o retorno de cobertura NOVA da Frente B, sozinha, é ~zero** neste alvo: 1/21
   resolvido, e esse 1 já era conhecido. **19/21 caem na fila manual por falta de
   adapter no lado certo** (banco/merchant), não por falha do gate.
3. **Recomendação:** priorizar **Frente A (adapters)** — em especial **bancos emissores
   como origem** (Bradesco, BB, Itaú, C6, Inter) e **destinos com campanha própria** —
   guiada pela medição: a oferta forte viva do alvo (bradesco→livelo 91) está
   **exatamente** num par que só um adapter de banco destrava. A Frente B passa a render
   quando esses lados entrarem na rede.
4. **Auto-publish permanece DESLIGADO (D-050).** Nada gravado, nada publicado. Confirma
   -e-mostra cumprido.

**Dependência registrada (SPEC §5):** a vigência confiável das campanhas novas capturadas
pela cobertura depende da correção da edge fn (chat de predict). Não travou a Frente B
(as janelas deste lote vieram do parser determinístico local), mas vale para o pipeline
de extração.

---

*Promoções podem mudar sem aviso. Confira sempre as regras no site oficial antes de
comprar, transferir ou resgatar.*
