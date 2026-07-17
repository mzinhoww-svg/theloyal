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

## 3. Parte C — Confirmação manual (prioridade 3, DEPOIS da B) · carga escopada do operador

**Fila de curadoria no admin**, ranqueada por `tl_score_bruto` **corrigido**, só:
- **vivas** (3 portões menos o TIER 1),
- **score bruto ≥ 70** (corte, §5),
- **computável** (não `conta_nao_calculavel`),
- **não-crawleável** (as crawleáveis já foram pela Parte A),
- para item **lado-único: só depois da Parte B** ter corrigido o score.

Cada linha traz: identidade, %/vigência ingeridos, **link candidato da fonte
oficial** (heurística: site oficial do programa), score + breakdown. O operador
abre, confirma os termos, e roda `confirmar_tier1` (URL oficial, %, público,
vigência, evidência jsonb) — mesma mecânica manual do caso azul. Divergência →
corrige + re-scora antes de publicar.

**Abaixo do corte** (55–69, "Só casos"): não entra na fila manual. Espera a coleta
automática alcançar, ou fica no ranking **sem publicar**. Não se gasta confirmação
manual em item que ninguém vai agir.

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

## 5. Corte de score da fila manual — piso "Vale olhar" (70)

Proposto: **`tl_score_bruto ≥ 70`** para entrar na fila de confirmação manual.
Razão: abaixo de 70 é "Só para casos específicos" (55–69) ou pior — confirmar fonte
na mão de item que poucos vão agir é custo sem retorno. O corte é **configurável**
(não hardcoded), revisável conforme a fila real. Itens 55–69 vivos ficam no ranking
e sobem à fila manual se a derivação (B) os empurrar acima de 70.

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

## 8. Decisões que aguardam o operador (paro aqui — não disparo agente)

1. **Ordem/paralelização (§4):** A ∥ B primeiro, C depois de B — confirma? Ou quer
   A sozinha primeiro (encher o que der de graça) e B+C numa segunda leva?
2. **Corte da fila manual = 70 (§5)** — aceita o piso "Vale olhar", ou outro?
3. **Parte B é PROPOSTA de vetor** (como os outros): quer ver o vetor lado-único
   antes de re-scorar, mesma disciplina? (Minha recomendação: sim.)
4. **Escala por público na coleta (D-045/D-047):** quando o oficial revelar escala
   (N %s por público), a Parte A **separa em N identidades** automaticamente, ou
   marca para tua revisão (pode ser decisão de produto qual público vira Deal Desk)?

*Promoções podem mudar sem aviso. Confira sempre as regras no site oficial antes
de comprar, transferir ou resgatar.*
