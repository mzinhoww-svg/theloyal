# M2 · Slice — Recanonicalização de identidade (SPEC, antes de código)

> Precede o **re-score-1 limpo**. NÃO é o re-score-2. É correção de **identidade**
> que a trava de anomalia (D-038) pegou no dry-run, feita ANTES de gravar
> `tl_score_bruto`. Disciplina: dry-run + trava de anomalia; backup preso; **paro
> para aprovação do operador antes de qualquer código ou mutação de produção**.
>
> **Regra do operador (recebida):** os três sintomas são investigações separadas,
> com causas distintas. Quero a **regra de triagem**, não correção cega. E: não
> tratar como bug de identidade até **provar** que é.

---

## 0. Estado atual e o achado da investigação (read-only, jul/2026)

O dry-run do re-score-1 (D-038, PR #103) acendeu três flags. Investiguei as três
no banco vivo **antes de escrever regra**. O achado inverte duas delas:

| sintoma | investigação | veredito |
|---|---|---|
| **1. self-loops de transferência** | 13 linhas `tipo='transferencia' AND origem_code=destino_code` | **É identidade.** Bug real. Escopo desta slice. |
| **2. `sem_destino` dominante** | 1.220 linhas `destino_code='sem_destino'` → **1.220 são `lado_unico=true`**, `transf_destino_perdido=0` | **NÃO é identidade.** M1 já separou. Vira decisão de derivação. |
| **3. score uniforme 65** | rodei o engine na assinatura real: bônus 7/30/40/52/115% + `cpm=null` + rota curta → **todos 65** | **NÃO é identidade.** Artefato de derivação. Vira decisão de vetor. |

**Consequência de escopo:** esta slice mexe **só no sintoma 1**. Os sintomas 2 e
3 são reclassificados com prova (§3, §4) e viram **decisão de vetor de derivação**
separada (§6) — não se enfia um fix cego de score dentro da slice de identidade.

---

## 1. Sintoma 1 — self-loops de transferência (o único bug de identidade)

**Fato:** 13 campanhas com `tipo='transferencia'` e `origem_code = destino_code`.
Uma transferência de um programa para ele mesmo não existe — ou a identidade está
torta, ou o `tipo` está errado, ou é lixo. Os dados crus (`origem_bruto`,
`destino_bruto`, `percentual`, `paridade`, `cpm_value`) dizem qual é qual:

| # | origem_bruto → destino_bruto | code | % | sinal | classe |
|---|---|---|--:|---|---|
| 1 | `loop` → `loop` | outro→outro | — | sem % / paridade / cpm | **placeholder** |
| 2 | `livelo` → `livelo` | livelo→livelo | — | sem % / paridade / cpm | **casca sem sinal** |
| 3–5 | `smiles` → `smiles` | smiles→smiles | 90/80/305 | tem bônus | **origem perdida** |
| 6 | `azul` → `azul` | azul→azul | 90 | tem bônus | **origem perdida** |
| 7 | `all` → `accor` / `all` → `allaccor` | accor→accor | 25/15 | mesmo programa (AllAccor = Accor) | **mapa colapsou** |
| 8 | `mundoavios` → `avios` | avios→avios | 40 | portal do mesmo programa | **mapa colapsou** |
| 9 | `smiles` → `pagol` | smiles→smiles | 13 | destino ≠ programa (merchant?) | **mapa colapsou** |
| 10 | `azul` → `azulviagens` | azul→azul | **1500** | agência de viagem; 1500% = multiplicador de compra | **tipo errado** |

(As contagens somam 13 com as multiplicidades `n` do agrupamento.)

### 1.1 A regra de triagem (decisão, não lista cega)

Árvore aplicada a toda linha `transferencia` com `origem_code = destino_code`
(genérica — pega os 13 de hoje e qualquer novo que a coleta gerar):

```
R1  origem_bruto ∈ PLACEHOLDERS {loop, teste, exemplo, null, ''}  → DESCARTA
        estado='descartada', discard_reason='self_loop_placeholder'
R2  percentual IS NULL AND paridade IS NULL AND cpm_value IS NULL  → REVISÃO
        (casca sem sinal — não há o que pontuar; volta para curadoria)
        estado='revisao', motivo='self_loop_sem_sinal'
R3  origem_bruto = destino_bruto (mesma string) AND tem bônus      → REVISÃO
        (origem real se perdeu na extração; "transfira PARA X" com X repetido)
        estado='revisao', motivo='origem_perdida'
R4  origem_bruto ≠ destino_bruto mas colapsam no MESMO code         → REVISÃO
        (mapa canônico juntou portal/sub-marca com o programa: all↔accor,
         mundoavios↔avios, azulviagens↔azul, pagol↔smiles) — corrige o MAPA,
         não a linha; estado='revisao', motivo='mapa_colapsou'
R5  percentual absurdo p/ transferência (> LIM_MULT, ex. 500) OR
    destino_bruto é agência/merchant conhecido                      → RECLASSIFICA
        (é compra/acúmulo, não transferência) tipo→'compra', re-identifica
        estado='recanonicalizada', motivo='tipo_corrigido_selfloop'
```

**Nada é apagado no banco por regra automática que não seja R1 (placeholder
inequívoco).** R2–R5 mandam para `revisao` (fila de curadoria) ou reclassificam
`tipo` e re-rodam o matcher M1 (`identidade.mjs`) para gerar a identidade certa.
A recanonicalização **reusa o M1**, não reimplementa (INV-12).

### 1.2 Correção do mapa (R4) — a causa-raiz de 4 dos 13

R4 não é sobre as linhas; é sobre o **mapa de canonicalização** (M1) que colapsou
sub-marca/portal no programa: `all`/`allaccor`→`accor`, `mundoavios`→`avios`,
`azulviagens`→`azul_fidelidade`, `pagol`→`smiles`. Onde a sub-marca é o **mesmo
programa** (AllAccor É o Accor; MundoAvios É Avios), a linha não é transferência —
é ruído de fonte → descarta/revisão. Onde é **entidade diferente** (Azul Viagens ≠
Azul Fidelidade; PagoL ≠ Smiles), o mapa está **errado** e precisa de entrada
específica — vira item de curadoria do mapa, registrado como dívida se não
resolver nesta slice.

---

## 2. Disciplina de execução (D-038, mesma dos vetores)

1. **Dry-run primeiro.** A slice computa a triagem em memória e **reporta** (quantos
   caem em cada R1–R5, com os ids), sem gravar.
2. **Trava de anomalia.** Depois da correção proposta, re-conta self-loops
   (`origem_code=destino_code`) — deve ir a **0** para transferência legítima — e
   varre novas anomalias antes de qualquer gravação.
3. **Backup preso.** Continua preso até o re-score-1 limpo (decisão do operador).
4. **Paro para aprovação** da regra §1.1 + do mapa §1.2 antes de código/mutação.

---

## 3. Sintoma 2 — `sem_destino` dominante NÃO é bug de identidade (prova)

Contagem rodada (read-only):

```
GLOBAL destino_code='sem_destino':  total=1.220 · lado_unico=1.220 · transf_destino_perdido=0
  outro         141/141 lado_unico   mercado_livre 117/117   azul 90/90   latam 87/87
  livelo 67/67  smiles 60/60  amazon 44/44  shell 38/38  itau 33/33  nike 10/10 …
```

**Todos os 1.220 são `lado_unico=true`. Zero transferência com destino perdido.**
Isso é acúmulo de um lado só — shopping/merchant (Mercado Livre, Amazon, Shell,
Nike): não têm destino porque **não são transferência**, e o M1 já os marcou
corretamente. O "sem_destino saturando percentil" que o dry-run viu **não é
identidade torta** — é a derivação jogando 1.220 itens num pseudo-`sem_destino` e
deixando o percentil saturar. Correção (se houver) é **de derivação**, não de
canonicalização: ver §6, decisão B.

---

## 4. Sintoma 3 — score uniforme 65 NÃO é bug de identidade (prova)

Rodei o engine importado (mesmo do runner, zero fork) na assinatura real dos itens
"computáveis 65", com os pesos do banco (`score_pesos.v1`: percentil 0.45,
eficiência 0.30, raridade 0.15, abrangência 0.10):

```
bônus=  7%  n=1  → 65      bônus= 52%  n=1  → 65
bônus= 30%  n=1  → 65      bônus=115%  n=1  → 65
bônus= 40%  n=1  → 65      bônus= 10%  n=2  → 65
```

**Todo bônus dá 65.** É um **ponto fixo de derivação**, não identidade:
- `cpm_value = null` → **eficiência ausente** → o engine redistribui o peso 0.30
  (D-024, correto: não afunda item legítimo).
- rota com 1 observação → **percentil base-curta** → amortece para 0,5 neutro (um
  item é sempre a própria mediana; não há distribuição para ranquear).
- sobra raridade (0,85 para n=1, D-037) + abrangência (1,0 geral) constantes.

Resultado: `0.643·0.5 + 0.214·0.85 + 0.143·1.0 ≈ 0.646 → 65`, **independente do
bônus**. Um 115% e um 7% empatam porque, sem CPM e sem histórico de rota, o engine
**honestamente não tem como discriminá-los** (INV-03: não fabrica sinal). Não é
identidade nem bug — é o engine dizendo "sinal insuficiente". O que fazer com essa
banda é **decisão de produto/derivação**: ver §6, decisão C.

---

## 5. Fora de escopo desta slice

- **Não** mexe em `sem_destino` (não é bug — §3).
- **Não** mexe em `score.mjs`/`derivacao.mjs` nem no vetor de pesos (sintomas 2 e
  3 são decisão de vetor separada — §6).
- **Não** grava `tl_score_bruto` (é o re-score-1, passo seguinte).
- **Não** roda o re-score-2 com CPM vivo (posterior, depende de identidade limpa).

---

## 6. Decisões que aguardam o operador (paro aqui)

**A — Regra de triagem dos self-loops (§1.1).** Aprova a árvore R1–R5? Em
especial: (a) R1 descarta só placeholder inequívoco (`loop`) — ok? (b) R5
reclassifica `azul→azulviagens 1500%` como compra em vez de descartar — concorda
que 1500% é multiplicador de compra, não bônus de transferência?

**B — `sem_destino` (sintoma 2).** Confirmado que NÃO é identidade. Abrir slice de
vetor de derivação para decidir como os 1.220 `lado_unico` entram no score
(percentil próprio? não competem em percentil? banda editorial de acúmulo?), ou
deixar como está por ora e só documentar a dívida?

**C — Banda 65 (sintoma 3).** Confirmado artefato de derivação. Opções (decisão de
vetor, não desta slice): (c1) aceitar 65 como banda **"sinal insuficiente"**
explícita (asterisco CPM-cego, D-035); (c2) fallback de percentil para escala de
bônus **absoluta** quando a rota é curta demais para ranquear; (c3) manter e
resolver quando o CPM vivo (ratios 012/013) cobrir mais rotas — muitos desses
`avios/disney/airbnb` viram computáveis de verdade quando a eficiência acender.
Recomendo **(c3) + (c1)**: não inventar percentil onde não há rota; deixar o CPM
vivo discriminar e rotular o resto como CPM-cego. Sua chamada.

**Enquanto A–C não forem respondidas, PARO.** Nada de código nem mutação de
produção. A slice só executa a triagem §1 depois do seu OK em A (e do rumo em B/C).

*Promoções podem mudar sem aviso. Confira sempre as regras no site oficial antes
de comprar, transferir ou resgatar.*
