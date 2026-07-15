# Régua Real de Publicação das Digests — Política Híbrida de Decisão

> **Etapa de decisão de produto e operação.** Desenha a régua de publicação das
> digests **Daily**, **Weekly** e **Predict/Radar** como um *sistema de decisão*
> — critérios objetivos, faixas, gatilhos de auto-publicação, revisão humana,
> retenção e bloqueio — não como opinião editorial. Não implementa código, não
> altera motores nem publica nada. É o insumo para o backlog da §12.
>
> **Premissas herdadas (não reabertas):** produto pré-operação em partes; TL
> Score hoje é **digitado, não calculado**; não existe nota de corte madura; o
> motor que publica **não é** o que mede acurácia; a Weekly ainda não consolida a
> Daily de forma automática e rastreável; a comunicação promete mais do que o
> produto entrega em alguns pontos.
>
> **Convenção:** cada decisão traz **Recomendação**, **Alternativas** e o selo
> **[APROVAÇÃO HUMANA]** quando depende de você. Referências a código são ao
> estado atual do repositório.

---

## 0. Resumo executivo

A régua **já existe pela metade e nos lugares errados**. O que existe hoje é uma
soma de gates desconexos:

- `scripts/validate.mjs` — gate que o **publisher** (`beehiiv-publish.mjs`)
  respeita: valida coerência `tlScore ↔ verdict` (via `verdictForScore`),
  reconcilia `scoreBreakdown` contra `TL_WEIGHTS` (25/15/15/10/10/10/10/5),
  bloqueia vigência vencida e força `nao-confirmado` quando falta vigência.
- `renderer/audit.mjs` + `renderer/validate.mjs` — gate de **QA** que audita
  campos com **outros nomes** (`deal_desk`/`veredito`), confere CPM, contraste,
  emoji, CMI, urgência. **Não é o gate que publica.** (premissa 4, materializada.)
- `scripts/forecast-engine.mjs` — o **único** motor com régua estatística real:
  `classify()` deriva `alta|media|baixa|em-formacao` de nº de amostras e
  coeficiente de variação, tem `editorialEligible`, `minConfidence` e a regra
  dura *"em-formacao nunca vira linha de radar"*.

Ou seja: **o Predict já tem régua; a Daily não tem** — a nota dela é digitada e o
único "corte" é o mapa semântico `verdictForScore`. E o gate que efetivamente
libera o envio não é o mesmo que faz a auditoria mais dura.

**Tese central deste documento:** o corte **não é** um número no TL Score. É uma
**matriz de risco assimétrica**, cujo eixo determinante é a *intensidade de ação*
que a peça pede ao leitor, não a altura da nota. Um `vale-agir` (85–100) é a
célula de **maior** risco do sistema — é onde o produto manda o leitor gastar
dinheiro — e por isso recebe **mais** escrutínio, não menos. Um `evitaria` ou um
`monitoramento` não carrega risco de ação e pode auto-publicar com folga.

A decisão-âncora: **enquanto o TL Score for digitado e não calculado, nenhuma
peça que carregue verdicto de ação (`vale-agir`, `vale-olhar`) é auto-publicada.
O piso humano é duro.** A automação entra por baixo (bloqueio, rebaixe,
monitoramento) e sobe conforme a nota vira calculada e o motor de acurácia
existir — não antes.

---

## 1. Natureza da decisão

### 1.1. O que exatamente está sendo decidido

Há **dois níveis** de decisão, e confundi-los é a origem do risco atual:

1. **Disposição do item** (por deal, janela de radar, leitura de VPM, sinal): em
   que estado ele entra na edição — **publica com verdicto**, **publica rebaixado
   (monitoramento / não confirmado)**, **retém**, ou **bloqueia**.
2. **Liberação da edição** (por peça: Daily nº N, Weekly W-NN, Predict): a edição
   só sai se passar nos gates estruturais **E** todo item tiver disposição válida.
   Uma edição não "herda coragem" de um item forte nem publica apesar de um item
   bloqueado — o item bloqueado sai da edição ou a edição não sai.

O que se decide, portanto, é **a disposição de cada unidade editorial e a
liberação do conjunto** — com base em critérios objetivos, não em confiança
editorial difusa.

### 1.2. O que pode ser automatizado

Tudo que é **determinístico e verificável** — e boa parte já está implementada:

- Validade de schema (`edition.schema.json`, `weekly.schema.json`).
- Vigência: expirada → bloqueio (já em `validate.mjs`).
- Coerência `tlScore ↔ verdict` via `verdictForScore` (já).
- Reconciliação `scoreBreakdown` × `TL_WEIGHTS` (já).
- Conta feita: `CPM = custo / (milhas/1000)` com tolerância 2% (já em `audit.mjs`).
- Varreduras de emoji, CMI/dado interno, urgência artificial (já).
- Liveness de URL de fonte, contraste AA, tokens de marca (já parcialmente).
- Idempotência de disparo (hash de conteúdo, já em `beehiiv-publish.mjs`).
- Frescor/proveniência do número automático (`generatedAt`, `forecast-freshness`).
- **Classificação de confiança do Radar** (`classify()` — já).

### 1.3. O que precisa continuar humano

Enquanto valerem as premissas:

- **A pontuação dos 8 critérios do TL Score.** Hoje é digitada (premissa 2). Quem
  digita o número **assina** o número. Isso não se automatiza até a nota ser
  calculada por motor auditável.
- **O verdicto de ação em faixa ambígua** (55–84: `casos-especificos`,
  `vale-olhar`).
- **Julgamento de autoridade de fonte** para a afirmação específica ("esta fonte
  é confiável *para este dado*") em fontes fora do registro conhecido.
- **Qualquer exceção a regra inviolável** e **conteúdo patrocinado**.
- **A tese do dia / sinal** e a redação (regra inviolável 2: redação própria).

### 1.4. O que deve ser híbrido

- **Classificação de fonte:** um registro de fontes auto-classifica as conhecidas
  (T1/T2/T3); fonte fora do registro cai para humano.
- **Faixas médias (55–84):** máquina calcula elegibilidade e prepara o item;
  humano assina o verdicto.
- **Radar de confiança baixa:** o motor produz; humano decide se entra como linha
  ou vira apenas "o que monitorar".

### 1.5. O que não deve, em hipótese alguma, ser automatizado

1. Publicar peça com **verdicto de ação** (`vale-agir`/`vale-olhar`) **sem
   assinatura humana do score**, enquanto o score for digitado.
2. **Sobrepor uma regra inviolável** (1–10 do CLAUDE.md) por qualquer score.
3. Emitir `vale-agir` a partir de **fonte fraca ou não verificada**.
4. **Prometer ganho** (regra 3) ou transformar bônus alto em valor automático.
5. **Primeiro disparo `--publish` ao vivo** de uma superfície enquanto o motor de
   acurácia ≠ motor de publicação (premissa 4): o *go-live* de cada superfície é
   um ato humano deliberado, não um default.

---

## 2. Estrutura de faixas

### 2.1. Quais faixas de decisão devem existir

Cinco dispositions de item, do mais liberado ao mais restritivo:

| Faixa | Nome | Efeito |
|---|---|---|
| **A** | **Auto-publica** | Entra na edição sem toque humano item-a-item. |
| **B** | **Revisão leve** | Um revisor, checklist curto; aprova ou rebaixa. |
| **C** | **Revisão obrigatória (assinatura de score)** | Revisor assina os 8 critérios; sem assinatura, não sai como recomendação. |
| **D** | **Rebaixa / monitora** | Publica **sem verdicto de ação** — `monitoramento` ou `nao-confirmado`. |
| **E** | **Bloqueia** | Sai da edição; vai para fila/backlog ou correção. |

### 2.2. Simétricas ou assimétricas

**Assimétricas — decisão fechada.** O custo de um falso `vale-agir` (mandar o
leitor comprar/transferir num deal ruim) é **estruturalmente maior** que o custo
de reter um bom deal por um ciclo. A régua é conservadora na *ponta de cima*
(nota alta que pede ação → mais escrutínio) e tolerante na *ponta de baixo*
(`evitaria`, `esperaria`, `monitoramento` → auto-publica). Simetria aqui seria um
erro de desenho: trataria "errar recomendando" e "errar sendo cauteloso" como
equivalentes, quando o primeiro destrói confiança de marca e o segundo não.

### 2.3. Corte único, corte por faixa ou matriz por risco

**Matriz por risco — recomendação explícita.** Um corte único no TL Score
(ex.: "≥70 publica") é o desenho errado porque ignora que a *mesma nota* tem
riscos opostos conforme a ação pedida e a força da fonte. O corte real é a função:

```
disposição = f(intensidade_de_ação, tier_da_fonte, confiança/vigência, integridade)
```

O TL Score entra **dentro** dessa função (define a intensidade de ação via
`verdictForScore`), não **como** a função.

### 2.4. Variação por tipo, fonte, tema ou superfície

- **Por superfície: sim, com piso comum.** Daily, Weekly e Predict compartilham a
  matriz e as regras invioláveis, mas têm pisos próprios (§8.1).
- **Por fonte: sim** — é o segundo eixo da matriz (tier).
- **Por tipo de conteúdo: sim** — deal (verdicto de ação) ≠ shopping VPM
  (observação) ≠ radar (projeção). Cada um tem intensidade de ação diferente.
- **Por tema: não** como eixo formal. Tema entra só via tier de fonte e vigência.
  Criar régua por tema multiplicaria exceções sem ganho de controle.

---

## 3. Critérios de publicação

### 3.1. Como o TL Score entra

**Não como corte, como classificador de intensidade de ação.** O score já mapeia
para verdicto por `verdictForScore` (faixas do CLAUDE.md):

```
85–100 vale-agir            → AÇÃO ALTA   → Faixa C (sempre revisão + assinatura)
70–84  vale-olhar           → AÇÃO MÉDIA  → Faixa C hoje / B quando calculado
55–69  casos-especificos    → AÇÃO BAIXA  → Faixa B
40–54  esperaria            → NÃO-AÇÃO    → Faixa A (auto)
0–39   evitaria             → NÃO-AÇÃO    → Faixa A (auto)
s/dado nao-confirmado       → NÃO-AÇÃO    → Faixa A/D (auto como monitoramento)
```

Note a assimetria: **quanto mais alta a nota, mais para cima na régua de
escrutínio** — o oposto de um corte ingênuo.

### 3.2. Como o `scoreBreakdown` entra

É o **antídoto contra score opaco** (premissas 2 e 3). Decisão:

- **`scoreBreakdown` passa a ser obrigatório para qualquer verdicto de ação**
  (`vale-agir`, `vale-olhar`). Sem os 8 critérios explícitos e reconciliados, o
  item não pode sair como recomendação — cai para Faixa D (rebaixe).
- A reconciliação `Σ(critério × peso) == tlScore` já é validada; passa a ser
  **bloqueante** para ação (hoje é `err` no `validate.mjs` — manter e elevar).
- **Leitura de sub-critérios como sinal de risco:**
  - `fontes` (peso 5) baixo + score geral alto → "conteúdo forte, fonte fraca"
    (§3.6): rebaixa.
  - `vigencia` (peso 15) alto sem campo `vigencia` no item → contradição → bloqueia.
  - `valor` (peso 25) dominando sozinho um score alto → flag de revisão (o valor
    pode estar mascarando fricção/liquidez ruins).

### 3.3. Como a qualidade da fonte entra

Segundo eixo da matriz. Registro de tiers (§ backlog):

| Tier | Definição | Efeito no teto |
|---|---|---|
| **T1** | Fonte primária oficial (programa, banco, regulador, T&C oficial) | Sem teto — permite `vale-agir`. |
| **T2** | Secundária estabelecida (mídia especializada com histórico, release oficial citado) | Permite até `vale-olhar`; `vale-agir` exige corroboração T1. |
| **T3** | Agregador / fórum / social / captura sem T&C | **Teto = monitoramento.** Nunca vira verdicto de ação. |
| **T0** | Não classificada / desconhecida | **Teto = nao-confirmado.** Vai para humano classificar. |

O `sourceUrl` e o status de vigência declarado na `source` alimentam a
classificação; liveness morta → bloqueio (é dado não confirmável).

### 3.4. Como vigência, frescor e confiabilidade entram

- **Vigência** é gate duro: ausente → força `nao-confirmado` (já); vencida na data
  da edição → bloqueio (já). Isso é inegociável e não se rebaixa, se bloqueia.
- **Frescor** (número automático): `generatedAt`/`forecast-freshness` fora da
  janela → o número vira "referência", não base de verdicto; radar rebaixa a
  confiança.
- **Confiabilidade** (Radar): a régua estatística já existe — `alta|media|baixa`;
  `em-formacao` **nunca** vira linha (é a versão-radar do piso duro).

### 3.5. Sem score, score opaco, score inconsistente

- **Sem score:** só pode existir como `nao-confirmado`/`monitoramento` (Faixa D).
  Nunca como ação. (Alinha com regra inviolável 9.)
- **Score opaco** (sem `scoreBreakdown`): não pode ser verdicto de ação → Faixa D.
- **Score inconsistente** (breakdown não reconcilia, ou score↔verdict divergem):
  **bloqueio** — é erro de integridade, não de julgamento. Já detectado; elevar a
  bloqueante universal.

### 3.6. Conteúdo forte, fonte fraca

**Teto pela fonte.** Nota alta com fonte T3/T0 **não** vira `vale-agir`. Rebaixa
para `monitoramento` ("estamos de olho, ainda não confirmamos") ou
`nao-confirmado`. A força do conteúdo não compra confiabilidade de fonte — é
exatamente o erro que a premissa 6 aponta (prometer mais do que se entrega).

### 3.7. Conteúdo fraco, fonte excelente

**Publica pelo verdicto baixo.** Fonte T1 relatando um deal ruim continua sendo um
deal ruim. `evitaria`/`esperaria` de fonte excelente é conteúdo **valioso** (é a
prova do método Sage) e **auto-publica** (Faixa A). Excelência de fonte não
resgata nota baixa — nem precisa.

### 3.8. Alta urgência, baixa confiança

**Urgência nunca compra confiança.** Espelha `em-formacao`: entra como **sinal /
monitoramento**, com rótulo explícito de não confirmado, e **jamais** como
verdicto de ação. Se vence em 48h mas a confiança é baixa, o texto honesto é
"pode fechar antes de confirmarmos" — não um `vale-agir` apressado. Isso protege
diretamente contra a regra inviolável 4 (urgência artificial).

---

## 4. Regras de auto-publicação (Faixa A)

### 4.1. O que precisa ser verdadeiro para auto-publicar

Um item auto-publica **somente se todas forem verdadeiras**:

1. Schema válido (`edition.schema.json` / `weekly.schema.json`).
2. **Não carrega verdicto de ação** — verdicto ∈ {`esperaria`, `evitaria`,
   `nao-confirmado`} **ou** é item observacional (shopping VPM, movimento de
   ledger, radar com confiança já classificada pelo motor).
3. Vigência coerente (presente e não vencida, ou legitimamente ausente com
   `nao-confirmado`).
4. Coerência `tlScore ↔ verdict` e reconciliação de `scoreBreakdown` (quando há
   score) — **passam sem erro**.
5. Zero acionamento de varredura inviolável (emoji, CMI, urgência, Ponto em bloco
   analítico, promessa de ganho).
6. Fonte ≥ T2 **ou** item observacional com fonte pública válida.
7. CPM (quando há conta) reconcilia dentro de 2%, ou é legitimamente `n/c`.

### 4.2. Campos obrigatórios

Herda `required` dos schemas **mais** os campos que a régua exige por disposição:

- Todo item com score que pretenda ação: `tlScore` **e** `scoreBreakdown` completos.
- Todo deal: `vigencia` (ou `nao-confirmado` explícito), `source` + `sourceUrl`.
- Toda edição: `disclaimer` íntegro, `sources` (≥1), `unsubscribe_url` (e-mail).

### 4.3. Validações que precisam passar

**As duas engines precisam concordar** (fim da premissa 4 na prática): a régua só
libera auto-publicação quando `scripts/validate.mjs` **e** `renderer/audit.mjs`
(reconciliados sobre o mesmo modelo de dados — §12) retornam sem bloqueio. Hoje
elas olham nomes de campo diferentes; enquanto forem duas, auto-publicação exige
**ambas verdes**.

### 4.4. Erros que impedem auto-publicação (bloqueio)

Integridade e regra inviolável: schema inválido, vigência vencida, score
inconsistente, CMI/dado interno, emoji, urgência, promessa de ganho, Ponto em
bloco analítico, disclaimer ausente/adulterado, URL de fonte morta, CPM
inconsistente.

### 4.5. Erros que apenas rebaixam a confiança

- `scoreBreakdown` ausente num item de ação → rebaixa para `monitoramento` (não bloqueia a edição, tira o item da ação).
- CPM `n/c` (não verificável) → mantém, mas não pode ser `vale-agir` sem revisão.
- Fonte T3/T0 → teto de disposição (§3.3), não bloqueio.
- Frescor fora de janela no número automático → vira "referência".

---

## 5. Regras de revisão humana (Faixas B e C)

### 5.1. Quando a revisão é obrigatória

- **Faixa C (sempre):** qualquer `vale-agir`; qualquer `vale-olhar` enquanto o
  score for digitado; qualquer exceção proposta a regra inviolável; conteúdo
  patrocinado; primeiro go-live ao vivo de uma superfície.
- **Faixa B (revisão leve):** `casos-especificos`; item de ação com fonte T2 sem
  corroboração T1; CPM `n/c`; conflito/duplicata detectada (§7.4).

### 5.2. O que o revisor humano olha

Checklist de **assinatura de score** (Faixa C):

1. Os 8 critérios do `scoreBreakdown` refletem a realidade do deal? (não só somam)
2. `valor` não está mascarando `friccao`/`liquidez`/`estoque` ruins?
3. A fonte sustenta *este* dado específico? Tier correto?
4. Vigência confere com o T&C oficial?
5. A conta feita bate e usa dado público (não CMI)?
6. O verdicto é o que o leitor faria — ou o que gostaríamos que fizesse?
7. Disclaimer presente; redação própria.

### 5.3. O que o revisor pode aprovar

Promover um item de Faixa B/C para publicação **com verdicto de ação**, assinando
o score. Rebaixar qualquer item. Aprovar exceção documentada a uma regra
**não-inviolável** (ex.: limite de 3 deals) com justificativa registrada.

### 5.4. O que o revisor não pode aprovar (mesmo querendo)

Espelha o CLAUDE.md — **regras invioláveis não têm override humano**:

- Publicar com dado interno/CMI (regra 1).
- Copiar texto/estrutura de fonte (regra 2).
- Prometer ganho / tratar bônus como valor (regra 3).
- Urgência artificial (regra 4).
- `vale-agir` sem vigência confirmada (regra 9/10 + overrule 5.4 do schema).
- Publicar recomendação sem disclaimer (regra 10).
- Ponto ao lado de veredito real / em bloco analítico.

Se o pedido exige quebrar uma dessas, o revisor **sinaliza o conflito** e propõe
alternativa dentro do sistema — não aprova.

### 5.5. Como registrar exceções

**Ledger de exceções** (arquivo versionado, append-only): `{ edição, item, regra,
revisor, timestamp, justificativa, disposição_final }`. Toda exceção a regra
não-inviolável passa por aqui. Esse ledger é **insumo direto do motor de
acurácia** (premissa 4): onde humanos discordam da régua é onde a régua aprende.

---

## 6. Regras de bloqueio (Faixa E) e retenção (Faixa D)

### 6.1. O que bloqueia publicação (total)

Toda falha de integridade ou regra inviolável da §4.4. Bloqueio remove o item da
edição; se o item for estrutural (ex.: Deal Desk vazio viola bloco obrigatório), a
**edição inteira** é retida até correção.

### 6.2. O que bloqueia destaque, mas não publicação

- Fonte T3/T0 num conteúdo forte → **não pode ser hero do Deal Desk nem
  `vale-agir`**, mas pode entrar como `monitoramento`.
- Score sem `scoreBreakdown` → publica rebaixado, nunca em destaque de ação.
- CPM `n/c` → entra sem selo de ação forte.

### 6.3. O que publica apenas como monitoramento

Conteúdo forte / fonte fraca (§3.6); alta urgência / baixa confiança (§3.8); score
opaco (§3.5). Rótulo honesto ("estamos acompanhando; ainda não confirmamos"),
sem verdicto de ação, sem conta apresentada como recomendação.

### 6.4. O que vai para fila de revisão ou backlog

- Faixas B/C aguardando revisor.
- Fonte T0 aguardando classificação.
- Duplicata/conflito aguardando desempate (§7.4).
- Item bloqueado por integridade **corrigível** (volta ao autor, não descarta).

---

## 7. Casos-limite

| # | Caso | Tratamento |
|---|---|---|
| 7.1 | **Nota alta, fonte fraca** | Teto pela fonte (§3.6). Rebaixa para `monitoramento`/`nao-confirmado`. Nunca `vale-agir`. Faixa D. |
| 7.2 | **Nota média, fonte excelente** | Publica pelo verdicto que a nota mapeia. Fonte T1 permite revisão leve (Faixa B) e, se assinado, `vale-olhar`. Excelência não infla a nota. |
| 7.3 | **Conteúdo novo sem histórico** | Sem histórico, sem confiança calculável → Radar: `em-formacao`, não entra. Deal: máximo `nao-confirmado`/`monitoramento` até corroboração. Fonte nova = T0 → humano. |
| 7.4 | **Repetido / duplicado / conflitante** | Dedupe por chave (`seriesKey`/rota/programa+vigência). Duplicata idêntica: idempotência já barra o disparo. **Conflito** (dois dados divergentes): bloqueia destaque, vai para fila de desempate (§6.4); publica o de maior tier ou nenhum. |
| 7.5 | **Séries anômalas** | O motor já sinaliza via CV alto → confiança baixa/`em-formacao`. Anomalia estatística **rebaixa**, não publica como ação. Outliers de VPM: `sampleN` insuficiente → `vpmObservado = "n/c"`. |
| 7.6 | **Dado incompleto** | Campo obrigatório faltando → bloqueio (integridade). Dado *analítico* faltando (ex.: sem base de cálculo) → `nao-confirmado` (regra 9: nunca chutar). |

---

## 8. Produto e governança

### 8.1. Global ou por superfície

**Núcleo global, piso por superfície.** A matriz de risco e as regras invioláveis
são as mesmas. Os pisos diferem:

- **Daily:** piso duro humano para verdicto de ação (score digitado). Auto só em
  não-ação.
- **Weekly:** **consolida a Daily e não pode subir a régua** — um item que na
  Daily saiu como `monitoramento` não vira `vale-agir` na Weekly. A Weekly herda a
  disposição mais restritiva dos itens que agrega. (Ataca a premissa 5: a
  consolidação precisa ser automática **e rastreável** — cada linha da Weekly
  aponta para as edições Daily de origem.)
- **Predict/Radar:** já opera por régua estatística (`classify`, `editorialEligible`,
  `em-formacao`). É a superfície mais madura; serve de **modelo** para as demais.

### 8.2. Fixa ou adaptativa

**Estrutura fixa, limiares adaptativos.** As faixas, a assimetria e o piso duro
são fixos (mudá-los é decisão humana explícita). Os *limiares numéricos* (tier
mínimo por faixa, janela de frescor, CV de corte do radar) são **adaptativos**,
calibrados pelo motor de acurácia via ledger de exceções (§5.5) — **depois** que
ele existir. Antes disso, limiares são conservadores e fixos.

### 8.3. Visível ao leitor ou interna

**Mecânica interna; resultado visível.** O leitor não vê a matriz, mas vê a saída
dela: o verdicto, a pílula de confiança, o rótulo `nao-confirmado`/`monitoramento`
e o disclaimer. Esses rótulos **são** a face pública da régua — é assim que a
política vira confiança de marca em vez de promessa vazia.

### 8.4. Como preserva confiança de marca

A régua força o produto a **rotular a própria incerteza** em vez de mascará-la —
que é exatamente o gap da premissa 6 (comunicação promete mais do que entrega). Um
`monitoramento` honesto vale mais, no arquétipo Sage, que um `vale-agir` que não
se sustenta. A assimetria garante que o erro que o sistema comete por default é o
erro **barato** (reter demais), nunca o **caro** (recomendar errado).

### 8.5. Como permite escala sem perder controle

A automação cresce **por baixo**: hoje libera não-ação e bloqueio (o volume
grande, baixo risco); o humano se concentra no que importa (verdicto de ação, o
volume pequeno, alto risco). Conforme a nota vira calculada e o motor de acurácia
prova a régua, a fronteira A/B sobe — sem nunca automatizar a célula de maior
risco antes de ter evidência. Escala é consequência de mover o piso com dados, não
de remover o piso.

---

## 9. Proposta de régua — faixas claras

```
                    INTENSIDADE DE AÇÃO (via verdictForScore)
                 NÃO-AÇÃO        AÇÃO BAIXA      AÇÃO MÉDIA/ALTA
              (evitaria,        (casos-         (vale-olhar,
               esperaria,        especificos)    vale-agir)
               nao-confirmado)
  T1  ┌──────────────────────┬───────────────┬──────────────────┐
FONTE │  A auto              │  B revisão    │  C assinatura    │
  T2  │  A auto              │  B revisão    │  C assinatura    │
  T3  │  A auto (rebaixado)  │  D monitora   │  D monitora      │
  T0  │  D nao-confirmado    │  D nao-conf.  │  D nao-conf.     │
      └──────────────────────┴───────────────┴──────────────────┘
   Sobre toda a matriz: E (bloqueio) vence tudo se houver falha de
   integridade ou acionamento de regra inviolável.
```

---

## 10. Matriz de critérios por faixa

| Critério | A — Auto | B — Rev. leve | C — Assinatura | D — Monitora | E — Bloqueia |
|---|---|---|---|---|---|
| Verdicto | não-ação | ação baixa | ação média/alta | rebaixado | — |
| TL Score | qualquer | 55–69 | 70–100 | qualquer | — |
| `scoreBreakdown` | se houver, reconcilia | reconcilia | **obrigatório + assinado** | dispensado | inconsistente → aqui |
| Fonte (tier) | ≥T2 (T3 rebaixa) | ≥T2 | T1 (T2 c/ corrobor.) | T3/T0 | morta/inválida |
| Vigência | ok ou n/c legítimo | ok | **confirmada** | qualquer | vencida → aqui |
| CPM/conta | reconcilia ou n/c | n/c permitido | reconcilia | — | inconsistente → aqui |
| Regra inviolável | zero hit | zero hit | zero hit | zero hit | **qualquer hit** |
| Toque humano | nenhum | 1 revisor | 1 revisor assina | nenhum | autor corrige |

---

## 11. Recomendação de corte

**Não há corte único no TL Score.** Recomendação explícita: **rejeitar o corte
numérico simples** e adotar a **matriz de risco assimétrica** das §9–§10, cujo
"corte" real é composto por três gates duros já suportados pelo código:

1. **Gate semântico** — `verdictForScore` define a intensidade de ação (já existe).
2. **Gate de fonte** — tier mínimo por faixa (a construir, §12).
3. **Piso duro humano** — nenhum verdicto de ação sem assinatura, enquanto o score
   for digitado.

O único "número" fixo hoje é o mapa `verdictForScore` (85/70/55/40), que **já é** a
escada oficial — a régua não inventa outro. Quando o TL Score passar a ser
calculado e o motor de acurácia existir, o corte que pode *baixar* é a fronteira
A/B (permitir auto em `casos-especificos`/`vale-olhar` de fonte T1), **nunca** o
piso de `vale-agir`.

**[APROVAÇÃO HUMANA]** — confirmar a assimetria e o piso duro como decisão fechada.

---

## 12. Backlog de implementação

Ordenado por dependência. Cada item aponta o arquivo real.

**Fase 0 — Unificar o gate (fecha premissa 4):**
1. Reconciliar `scripts/validate.mjs` e `renderer/validate.mjs` sobre **um único
   modelo** (`deals`/`verdict`/`tlScore`); o publisher e o QA passam a chamar o
   mesmo gate. Enquanto não, auto-publicação exige **ambos verdes**.
2. Elevar a bloqueantes universais: score↔verdict incoerente, `scoreBreakdown` não
   reconciliado (hoje `err` só num dos caminhos).

**Fase 1 — Régua mínima viável (automação por baixo):**
3. Tornar `scoreBreakdown` **obrigatório para verdicto de ação** (`validate.mjs`).
4. Introduzir o **registro de fontes** com tiers T0–T3 e o gate de teto por tier.
5. Implementar as **dispositions** (A–E) como saída explícita do gate, e o rótulo
   `monitoramento` no schema/render.
6. Auto-publicar (`--publish`) **somente** dispositions A de não-ação;
   tudo com ação exige assinatura (fila de revisão).

**Fase 2 — Rastreabilidade e consolidação (fecha premissa 5):**
7. **Weekly consolida Daily automaticamente e rastreável**: cada linha da Weekly
   referencia as edições Daily de origem; herda a disposição mais restritiva
   (`render-weekly.mjs`, `weekly.schema.json`).
8. **Ledger de exceções** append-only (§5.5).

**Fase 3 — Score calculado e acurácia (fecha premissas 2 e 3):**
9. Motor que **calcula** o TL Score dos 8 critérios (hoje digitado) — reusando
   `TL_WEIGHTS`; a assinatura humana passa a ser *revisão do cálculo*, não digitação.
10. **Motor de acurácia** separado do publisher, alimentado pelo ledger de
    exceções e pela vigência real dos deals, que calibra os limiares adaptativos
    (§8.2) — e só então a fronteira A/B pode subir.

---

## 13. Recomendação final única

**Adotar uma régua de risco assimétrica com piso duro humano para verdicto de
ação, automação crescente por baixo, e a matriz fonte × intensidade-de-ação como
mecanismo de corte — nunca um corte numérico simples no TL Score.**

Em uma frase operacional: **o sistema deve, por default, cometer o erro barato
(reter/rotular como não confirmado) e jamais o erro caro (recomendar ação sem
score assinado e fonte confiável).** O Predict já prova que a régua estatística
funciona; o trabalho é estender esse rigor à Daily e à Weekly, unificar os dois
gates, e só afrouxar o piso quando o TL Score for calculado e a acurácia, medida —
não antes.
