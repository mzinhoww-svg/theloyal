# M2 · Slice — Coleta TIER 1 (SPEC, antes de código)

> **Por que agora.** O pipeline está provado ponta a ponta (canonicalização →
> engine → CPM → ratio → override → veredito), validado pelo caso `livelo→azul`
> (CASO-LIVELO-AZUL-DIVERGENCIA.md). O **Deal Desk vivo está vazio-honesto**: das
> 54 vivas, só **1** tem TIER 1 confirmado. O gargalo **não é score, é fonte**. Esta
> slice enche o Deal Desk confirmando TIER 1 nas vivas — sem publicar número de blog.
>
> **Regra herdada (D-045):** TIER 1 **corrobora os TERMOS** (%, público, vigência),
> não só a existência da página. Toda confirmação aqui — automática ou manual —
> corrige divergência blog×oficial e, se a oferta for **escala por público**
> (como o azul: 50/100/105/110/120), separa em identidades por público (D-047 /
> público-na-tupla), nunca colapsa num número médio.

---

## 0. Estado atual (a fila viva, o gargalo)

54 vivas (`ativa`/`detectada`/`ultimos_dias`), 1 com TIER 1, 1 publicável (fraca).
A fila viva tem **dois tipos com caminhos de TIER 1 completamente diferentes** — é
o eixo que organiza a slice:

- **Origem crawleável** pelos 4 sitemaps (Livelo/Smiles/Esfera/TAP): TIER 1
  **automático**, carga operacional ~zero (a "estrada curta" da Trilha B). Ex. da
  fila: `livelo→hilton`, `esfera compra`, `livelo→aliexpress`.
- **Origem não-crawleável** (compra de um lado só, `sem_destino`, cartões,
  cruzeiros): TIER 1 **manual** (D-003), carga do operador. Ex.: `costa_cruzeiros`,
  `caixa cartão`, `shell→shell`, `latampass compra`.

**Achado que muda a priorização:** a maioria das vivas de score alto é
`sem_destino` (acúmulo/compra lado-único). O score 65–70 delas é **meio artificial**
— banda neutra + bônus, sem CPM nem percentil-de-rota real (a **dívida D-042**).
Confirmar TIER 1 manual de um `sem_destino` de 65 que a derivação vai virar 45 é
**desperdício de confirmação**. Logo: **para item lado-único, corrigir a derivação
(D-042) ANTES de gastar confirmação manual.** Para item de rota real (origem
crawleável), o score é confiável e a coleta pode ir já.

---

## 1. Parte A — Coleta automática (prioridade 1) · zero carga do operador

**Alvo:** vivas com `origem_code ∈ {livelo, smiles, esfera, tap}`.
**Reusa:** `v2/lib/adapters/*` (sitemap+fetch, D-009), `matcher-url.mjs` (URL↔campanha,
reusa `identidade.mjs`), `run.mjs` (`confirmarUrl` → `confirmar_tier1`).

**Fluxo por programa crawleável:**
1. Adapter busca o sitemap oficial → URLs de campanha (filtro `incluir`/`excluir`).
2. `matcher-url` mapeia cada URL oficial → identidade canônica; casa com as vivas.
3. Fetch da URL (redirect manual): 200 = viva; 3xx→/promocao = encerrada (não confirma).
4. **Detecção campanha vs evergreen (D-047):** só confirma se o regulamento tem
   **janela de vigência** ("das 10h de X às 23h59 de Y"). Página só com paridade
   institucional (1:1, sem janela) = evergreen sem bônus → **não confirma**.
5. **Corroboração de termos (D-045):** extrai %, público, vigência do oficial.
   - Bate com o ingerido → `confirmar_tier1` (URL, verificado_em) + evidência jsonb.
   - **Diverge** (como azul) → corrige o dado (percentual/vigência), trilha em
     `campanha_versoes`, re-scora. Se for **escala por público** → separa em
     identidades por público (uma por faixa), cada uma com seu score.
6. Item confirmado + vivo + computável atravessa os **três portões** → publicável.

**Mede:** quantas vivas crawleáveis viram TIER 1; quantas divergiram do ingerido;
quantas eram evergreen (falso-positivo do blog); quantas encerradas (3xx).

**Nada de crédito de fonte sem os 200+janela.** Encerrada/evergreen/redirect →
reporta, nunca força TIER 1 (INV-01/INV-03).

---

## 2. Parte B — Derivação lado-único (prioridade 2, PARALELA à A) · resolve D-042

**Problema:** os 1.220 `sem_destino` (`lado_unico`) pontuam pela banda neutra +
bônus, sem rota nem CPM. Score semi-artificial. Antes de qualquer confirmação
manual deles, o score tem que ser real.

**Escopo:** definir como **acúmulo/compra/shopping de um lado só** pontua **sem
rota** — um sub-vetor de derivação próprio, versionado, análogo aos demais
(PROPOSTA a aprovar, mesma disciplina). Frente proposta (a fechar no vetor):
- **percentil:** não há "rota" (destino único). Ranquear o bônus contra a
  população de ofertas **do mesmo tipo/merchant** (ex.: todos os acúmulos de
  shopping), não contra uma rota inexistente. Sem população defensável → neutro
  sinalizado (não fabrica).
- **eficiência:** em geral sem CPM (acúmulo não tem custo de milheiro de origem);
  ausente → redistribui (D-024), **não** zero.
- **raridade / abrangência:** por frequência e público, como hoje.
- **Regra-mãe:** não inventar percentil-de-rota onde não há rota (é o mesmo erro
  do bônus-absoluto que rejeitamos em D-042/c2). Faltou referência → classifica.

**Entrega:** vetor lado-único v1 (PROPOSTA) → re-scora os `sem_destino` → o score
deles deixa de ser artificial. **É pré-requisito da Parte C para itens lado-único.**

---

## 3. Parte C — Gate de CONFIANÇA TIER 1, limiar auto-ajustável (prioridade 3, DEPOIS da B)

> **Mudança de natureza (diretriz do operador):** a Parte C NÃO é "curadoria manual
> permanente". É um **gate de confiança**: a confirmação automática (Parte A) sempre
> roda; a revisão humana é a **exceção calibrada** que só acontece quando a confiança
> da confirmação fica abaixo de um limiar. O sistema **aprende a subir a barra de
> automação** conforme prova que acerta. É o **accuracy loop** (brief §13) operando
> pela primeira vez de verdade, aplicado à confirmação de fonte.

### 3.1 A confirmação produz um SCORE DE CONFIANÇA (determinístico), não um booleano

Toda confirmação da Parte A calcula uma **confiança ∈ [0,1]** a partir de **sinais
objetivos e verificáveis** da própria confirmação — nunca de um julgamento de LLM
(determinismo-primeiro, INV-12; o LLM pode **narrar** por que a confiança ficou
baixa, jamais **decidir** que ficou). Sinais (fatos sim/não da confirmação):

- **Janela de vigência clara** no regulamento? (D-047) — sim eleva, ausente derruba.
- **Termos corroboram sem divergência?** O % oficial bate com o ingerido? *(o azul
  teria confiança BAIXA: blog 115% × oficial escala — divergência forte.)*
- **Fonte é regulamento oficial** vs página secundária/redirect?
- **Público inequívoco** na escala? (escala clara por público eleva; ambígua derruba)
- **Estado vivo confirmado** (200, não 3xx→/promocao)?

A confiança é uma função pura desses sinais (pesos versionados, como `score_pesos`).
Recalibrar = nova versão + changelog.

### 3.1b Confiança (qualidade) é ORTOGONAL ao RESULTADO (corrobora/refuta) — D-049 ref.1

A confiança mede **quão bem verificamos**; o **resultado** da verificação é um eixo
**separado**. O azul verificou com **alta confiança** E **refutou** o item. Nunca
colapsar confiança com aprovação.

Resultado ∈ **{corrobora_limpo, corrobora_com_ajuste, refuta}** — os **três níveis de
divergência de termos** (D-049 ref.2), porque "termos corroboram" não é binário:

| resultado | critério | exemplo | efeito |
|---|---|---|---|
| **corrobora_limpo** | número bate com a fonte dentro de tolerância de arredondamento/fraseio | blog "100%" vs oficial "até 100%" | confiança alta; publica se ≥ limiar |
| **corrobora_com_ajuste** | número **existe** na fonte mas o **público/faixa** precisa correção | blog pegou 110% do tier clube; oficial tem a escala inteira | confiança **média**; separa por público (D-047) e/ou revisão |
| **refuta** | número **não existe em NENHUMA faixa** da escala oficial | azul 115% vs 50/100/105/110/120 | remove/rebaixa com firmeza |

### 3.2 O limiar × o resultado decidem o caminho (matriz, D-049)

- **alta confiança + corrobora →** confirma e **atravessa os 3 portões sem revisão**.
- **alta confiança + refuta →** **remove/rebaixa com firmeza** (não publica; corrige
  com certeza — o azul: 115→50, Evitaria, histórica). Um refutado de alta confiança
  sai do Deal Desk com a mesma convicção que um corroborado entra.
- **confiança < limiar (qualquer resultado) →** **fila de revisão humana** (o antigo
  "manual"). Não é bloqueio permanente: é "este caso ainda não é confiável o bastante
  para automatizar". O desfecho **alimenta o auto-ajuste**.

A fila de revisão herda o **corte de valor** (§5): só entra item vivo + computável +
`tl_score_bruto` ≥ piso (70 inicial). Para item **lado-único, só depois da Parte B**.

### 3.3 O limiar se AUTO-AJUSTA (mede o próprio acerto)

O sistema compara as confirmações automáticas com o que a revisão humana **depois
corrige**. Alta concordância (humano quase nunca discorda do automático) → o limiar
pode **baixar** (mais coisa passa sozinha). Erro perto do limiar (humano corrige com
frequência) → o limiar **sobe** (mais vai para revisão). Auto-calibra para manter a
qualidade de publicação.

### 3.4 As 4 TRAVAS do auto-ajuste (INVARIANTES da C — auto-ajuste sem trava degrada silenciosamente)

1. **Piso gated.** O sistema **sobe** o limiar sozinho (mais cauteloso, livre), mas
   **baixá-lo abaixo de um PISO exige autorização do operador** (baixar limiar =
   aumentar risco de publicar erro → nunca automático). Cautela é livre; risco é gated.
2. **A auditoria pré-publicação fica ACIMA de tudo.** Confiança alta pula a revisão
   humana da **FONTE**, não a **auditoria da PUBLICAÇÃO**: mesmo a confirmação
   auto-aprovada enfrenta o gate de auditoria do digest (refaz contas, checa vigência,
   lint) antes de publicar. Duas camadas distintas — a confiança não vaza para a régua.
3. **Volume mínimo antes de mover o limiar.** Não ajusta com 5 confirmações (ruído).
   `n` mínimo de confirmações com **desfecho conhecido** antes de qualquer movimento —
   mesmo princípio do predict (base_n≥3, série≥12m): não calibra com base insuficiente.
4. **Todo movimento de limiar é LOGADO** com o motivo + a taxa de acerto que o
   justificou. Auditável ao longo do tempo, como os pesos do score. Se um dia publicar
   erro, dá para rastrear se o limiar estava baixo demais e por quê.

### 3.5 Lançamento faseado — modo "confirma-e-mostra" no dia 1 (D-049; trava 3)

**No dia 1 o limiar de partida é aprovado pelo OPERADOR, não pelo sistema.** O
auto-ajuste (§3.3) só liga depois do **volume mínimo** de desfechos conhecidos (trava
3). Até lá:

- A Parte A roda em modo **"confirma-e-mostra"**: gera confirmações **com score de
  confiança + resultado (corrobora/refuta)**, mas **NÃO publica automático**.
- O operador vê o **primeiro lote real** (cada confirmação: confiança, corrobora/refuta,
  onde caiu vs o limiar conservador inicial) e **crava o limiar de partida**.
- Só então a publicação automática liga. O auto-ajuste assume depois do volume mínimo.

Conforme acumula desfechos, o limiar baixa até o piso — o sistema **tira o operador do
caminho onde já provou que acerta**. Aprovação humana no começo, automação plena no fim.

---

## 4. Dependências e paralelização (explícito, antes de disparar agente)

```
Parte A (automática)  ─┐
                       ├─ rodam JUNTAS (independentes)
Parte B (derivação)   ─┘
                          │
                          ▼  (B corrige o score dos lado-único)
Parte C (manual)  ── espera B ──> fila só com score corrigido + ≥70 + não-crawleável
```

- **A ∥ B:** A confirma fonte (não toca score); B corrige score (não toca fonte).
  Ortogonais → paralelas. Merge serial dos resultados.
- **C depende de B** para itens lado-único (a maioria da fila): não confirmar TIER 1
  manual de score que ainda vai mudar. Item de **rota real** não-crawleável (raro)
  poderia ir a C antes de B, mas na prática C abre após B fechar.
- **A não depende de B:** os crawleáveis são majoritariamente rota real (score
  confiável) → coleta automática vai já.

---

## 5. Dois parâmetros distintos do sistema (não confundir)

A Parte C tem **dois eixos**, ambos parâmetros versionados/auditáveis (não hardcoded),
que respondem a perguntas diferentes:

- **Corte de VALOR — `tl_score_bruto ≥ 70` (piso "Vale olhar", inicial).** Responde
  "*este item merece a atenção do pipeline?*". Abaixo de 70 (55–69 "Só casos") não
  entra na fila de revisão nem consome confirmação — fica no ranking sem publicar,
  esperando a coleta automática ou a derivação (B) empurrá-lo acima. Valor inicial 70,
  ajustável conforme a fila real.
- **Limiar de CONFIANÇA (§3.2, auto-ajustável com piso gated).** Responde "*esta
  confirmação é confiável o bastante para automatizar, ou vai para revisão humana?*".
  É o eixo que aprende e se calibra (§3.3–3.4).

Um item só é candidato quando passa o corte de valor; **entre os candidatos**, o
limiar de confiança decide auto-publica vs revisão. Os dois são ortogonais: valor =
"vale a pena?", confiança = "posso confiar na confirmação automática?".

---

## 6. Fora de escopo

- Não publica edição/Deal Desk (é do digest/M3); esta slice só faz item **atravessar
  os três portões** e ganhar veredito público. A seleção do que aparece é do digest.
- Não constrói o gate de auditoria pré-publicação (M3).
- Parte B não redesenha o engine — só adiciona o sub-vetor lado-único (versionado).

---

## 7. Definição de pronto (por parte)

- **A:** adapters rodam sobre as vivas crawleáveis; mede confirmadas/divergentes/
  evergreen/encerradas; itens confirmados atravessam os 3 portões; dry-run + trilha.
- **B:** vetor lado-único v1 aprovado + `sem_destino` re-scorados; golden do sub-vetor.
- **C:** fila de curadoria ranqueada no admin, com corte 70 + link candidato;
  `confirmar_tier1` manual funcionando com corroboração de termos.

---

## 8. Decisões do operador — RESOLVIDAS (D-048)

1. **Ordem A∥B→C:** ✅ confirmada. A e B ortogonais rodam juntas; C depois da B.
2. **Corte de valor = 70:** ✅ confirmado como valor inicial; vira **parâmetro** do
   sistema (§5), não número fixo.
3. **Parte B como PROPOSTA de vetor:** ✅ obrigatório — o vetor lado-único v1 vem para
   aprovação com racional antes de re-scorar os 1.220 (derivação errada envenena 1.220).
4. **Escala por público na coleta:** ✅ a Parte A **separa em N identidades automático**
   (regra de identidade M1 / D-047; o azul provou que colapsar destrói informação), com
   trilha. Só marca para revisão se a separação for **ambígua** (regulamento não deixa
   claro qual público tem qual %).

**Redesenho da Parte C (D-048):** de "curadoria manual permanente" para **gate de
confiança com limiar auto-ajustável** — confiança determinística por sinais objetivos,
piso gated, 4 travas, ligado ao accuracy loop, human-in-the-loop faseado (§3). A
confiança **não** é nota de LLM: é calculada de fatos verificáveis; o LLM narra, não decide.

**Estado:** Partes A e B **aprovadas** (podem ir para spec detalhada). Parte C
reescrita (§3) **aguarda aprovação do operador** — o gate de confiança rege toda
publicação futura, então o operador vê o desenho antes do código. **Nenhum agente de
implementação disparado.**

*Promoções podem mudar sem aviso. Confira sempre as regras no site oficial antes
de comprar, transferir ou resgatar.*
