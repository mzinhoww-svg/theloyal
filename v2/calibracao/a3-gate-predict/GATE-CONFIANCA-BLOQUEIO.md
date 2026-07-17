# Gate de confiança TIER 1 — por que a calibração do LIMIAR está BLOQUEADA hoje

> **Agente 3, fase CALIBRAÇÃO (D-051).** Documento da metade **não** mensurável:
> o auto-ajuste do limiar do gate de confiança (D-048) **não pode ser calibrado agora**.
> Não há número a propor. Isto documenta com precisão *por quê*, *o que precisa acumular*
> para o loop ligar, e enquadra o **0,75** como partida conservadora já existente (D-050).
>
> **INVIOLÁVEL (D-051):** mede-e-propõe; determinismo primeiro; a LLM narra por que a
> confiança ficou baixa, **nunca** decide a nota. Nenhum ML. **Nada é gravado no banco.**

---

## 1. O bloqueio, em uma frase

O gate de confiança tem duas partes distintas: **(a)** a função de confiança determinística
— *existe, é definida por D-048 §3.1* — e **(b)** o **limiar** que separa auto-publica de
revisão, e seu **auto-ajuste** por taxa-de-acerto. **É o (b) que está bloqueado**, e por um
motivo estrutural, não por falta de trabalho: **não há ledger de desfechos**. Mover um limiar
por taxa-de-acerto exige uma taxa-de-acerto observada; para observá-la é preciso registrar,
por confirmação, se o automático **acertou** ou se foi **corrigido depois por humano**. Esse
registro não existe:

| Insumo do auto-ajuste | Estado hoje (banco `qjqnqcsdnpvvmyzkavoq`, 2026-07-17) |
|---|---|
| Confirmações TIER 1 (`campanha_fontes`) | **1 linha.** Uma única confirmação (`livelo→hilton`, lote-1). |
| Desfechos conhecidos (acertou/corrigido) | **0.** A tabela sequer tem coluna de desfecho. |
| Vivas passíveis de confirmação | 56 (`estado ∈ {ativa, detectada, ultimos_dias}`) |

Sem hit-rate observado, **não há base para mover o limiar** — nem para cima, nem para baixo.
O 0,75 de partida (D-050) já existe e é conservador de propósito. **Não estou propondo mudá-lo.
Não invento hit-rate. Não fabrico calibração.** Nada a propor numericamente hoje.

---

## 2. O que o LEDGER DE DESFECHOS precisa registrar para o loop (b) ligar

O auto-ajuste (D-048 §3.3) compara a decisão automática com o que a revisão humana **depois
corrige**. Para isso, cada confirmação precisa gravar, **no momento da confirmação**, os
**sinais determinísticos** que produziram a confiança e, **no fechamento**, o **desfecho**.

### 2.1 Sinais determinísticos da confiança (D-048 §3.1) — gravados na confirmação
Fatos objetivos sim/não da própria verificação, cada um versionado como peso (nunca nota de LLM):

1. **Janela de vigência clara** no regulamento? (D-047) — sim eleva, ausente derruba.
2. **Termos corroboram sem divergência?** O % oficial bate com o ingerido? Gravado como o
   **resultado de três níveis** (D-049 §2): `corrobora_limpo` | `corrobora_com_ajuste` | `refuta`.
3. **Fonte é regulamento oficial** vs página secundária/redirect?
4. **Público inequívoco** na escala? (escala clara eleva; ambígua derruba)
5. **Estado vivo confirmado** — 200, não 3xx→/promocao?

→ A confiança ∈ [0,1] é função pura desses sinais. **Confiança (qualidade) é ORTOGONAL ao
resultado (corrobora/refuta)** (D-049 §1): grava-se os **dois eixos separados**. Um refutado
de alta confiança (o caso azul: 115% × escala oficial 50/100/105/110/120) sai do Deal Desk
com a mesma certeza que um corroborado entra — e o ledger tem que distinguir "confiança alta"
de "aprovado".

### 2.2 O desfecho (o que HOJE não existe) — gravado no fechamento da janela
Por confirmação, o par **(decisão automática, correção humana posterior)**:

- **`decisao_automatica`** — o gate teria auto-publicado (confiança ≥ limiar) ou mandado à
  revisão (< limiar)? E com que confiança/resultado.
- **`desfecho`** ∈ **{automatico_acertou, correcao_humana_posterior}** — o núcleo que falta:
  a decisão automática se sustentou, ou um humano depois teve que corrigir (o % estava errado,
  a vigência não era aquela, a fonte não sustentava)? **É o rótulo de acerto que alimenta o loop.**
- **`delta_vs_limiar`** — onde a confiança caiu em relação ao limiar vigente (para saber se os
  erros se concentram perto do limiar → sobe; ou se o automático quase nunca é corrigido → desce).
- **`limiar_vigente_no_momento`** + **`versao_pesos_confianca`** — para reconstruir a decisão.

Análogo estrito ao **Predict Ledger** (REQ-24: alvo, janela, prob/rótulo, `base_n`, `emitida_em`,
resolvido no fechamento) — a mesma fronteira estrutural. Ver §5.

> **`campanha_fontes` hoje** tem `id, identidade_id, campaign_id, noticia_url, tier, papel,
> verificado_em, criado_em, payload` — trilha de confirmação, **sem eixo de desfecho**. O
> ledger de desfechos é aditivo a construir (fora do escopo desta fase de medição; aqui só se
> documenta *o que ele precisa capturar*).

---

## 3. As 4 TRAVAS invioláveis do auto-ajuste (D-048 §3.4) — valem quando o loop ligar

O limiar não pode driftar em silêncio. Quando houver volume para movê-lo, o movimento obedece:

1. **Piso gated.** Subir o limiar (mais cauteloso → menos publicação automática) é **livre**.
   **Baixá-lo abaixo do PISO** (mais risco de publicar erro) **exige o operador**. Cautela é
   livre; risco é gated. (Espelha D-051 §2: movimento que aumenta risco de publicação é gated;
   movimento que aumenta cautela é livre.)
2. **A auditoria de publicação fica ACIMA.** Confiança alta pula a revisão humana da **FONTE**,
   **não** a auditoria da **PUBLICAÇÃO**: mesmo a confirmação auto-aprovada refaz contas, checa
   vigência e passa no lint do digest antes de publicar. Duas camadas — a confiança não vaza
   para a régua de publicação.
3. **Volume mínimo antes de mover o limiar.** Não ajusta com 5 confirmações (ruído). `n` mínimo
   de confirmações **com desfecho conhecido** antes de qualquer movimento — **exatamente o
   princípio do predict** (não calibra com base insuficiente, como `base_n≥3`). **É a trava que
   morde hoje: `n` de desfechos = 0.**
4. **Todo movimento de limiar é LOGADO** com o motivo + a taxa de acerto que o justificou.
   Auditável ao longo do tempo, como os pesos do score. Se um dia publicar erro, dá para
   rastrear se o limiar estava baixo demais e por quê.

---

## 4. O 0,75 como PARTIDA conservadora (D-050) — não é o que se calibra

O limiar de **partida 0,75** foi **aprovado pelo operador** (D-050 §3; D-048 trava 3; D-049
"lançamento"), não pelo sistema. Enquadramento correto:

- É **ponto de partida documentado, conservador por desenho** — "quase tudo à revisão", baixa
  até o piso só **conforme prova acerto** (human-in-the-loop faseado).
- O gate opera em **"confirma-e-mostra"** (D-049): gera confirmações com **confiança + resultado**,
  mas **NÃO publica automático** — o auto-publish está desligado até a calibração dos vetores de
  score fechar (D-050 §3). O operador vê o primeiro lote real e crava o limiar.
- **Portanto o 0,75 NÃO é objeto de calibração agora.** Ele já é a decisão conservadora de
  partida. O que estaria bloqueado é o **auto-ajuste** que o moveria a partir de desfechos — e
  esse não tem insumo. **Mexer no 0,75 hoje seria fabricar calibração sem base.** Não se faz.

---

## 5. Fronteira comum: o mesmo bloqueio do predict frequencial

O bloqueio do limiar do gate e o do predict frequencial (REQ-24/25) são **o mesmo bloqueio
estrutural**, por isso ficam neste mesmo escopo de agente:

| | Limiar do gate (D-048) | Predict frequencial (REQ-24/25) |
|---|---|---|
| O que roda hoje | função de confiança determinística; 0,75 de partida | foto de cobertura de base (163 pares aptos) — ver `PREDICT-COBERTURA-BASE.md` |
| O que falta | **ledger de desfechos** (automático acertou × correção humana) | **Predict Ledger** (predição emitida → resolvida no fechamento) |
| Métrica travada | taxa-de-acerto → move o limiar | **Brier** por segmento → calibra a probabilidade |
| Por que não dá hoje | `campanha_fontes`=1, 0 desfecho | 49 `predict_snapshots` são estados, não predições resolvidas; 0 desfecho |
| Quando liga | quando o produto operar e acumular desfechos (trava 3: volume mínimo) | idem — produto operando gera histórico |

**Não é bug — é a ordem natural.** Mede-se contra o corpus o que dá agora (distribuição:
pesos, quartis, buckets, cobertura de base); os **loops de acerto** só ligam **quando houver
acerto para medir**. Calibrar limiar/Brier sem desfecho observado violaria a própria disciplina
de "não calibra com base insuficiente" (D-048 trava 3; INV-03 / regra inviolável nº 9: faltou
dado → classifica, nunca chuta).

---

## 6. Declaração final (o veredito honesto desta frente)

- **A calibração do limiar do gate de confiança está BLOQUEADA** até o ledger de desfechos
  acumular volume. **Nada a propor numericamente hoje.**
- **O 0,75 permanece** como partida conservadora aprovada (D-050); não é objeto de mudança
  nesta fase, e não foi tocado.
- **O que destrava:** o produto operando em "confirma-e-mostra", gerando confirmações com
  desfecho conhecido (automático acertou × correção humana), até o **volume mínimo** (trava 3).
  Só então o auto-ajuste liga — subindo o limiar livremente, baixando-o só com o operador
  (trava 1), sempre com a auditoria de publicação acima (trava 2) e todo movimento logado
  (trava 4).
- **Nenhuma escrita no banco. Somente leitura.** Consistente com mede-e-propõe (D-051).

*Promoções podem mudar sem aviso. Confira sempre as regras no site oficial antes de comprar,
transferir ou resgatar.*
