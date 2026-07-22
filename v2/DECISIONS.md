# The Loyal v2 — DECISIONS.md

> Log de decisões do operador (ADR-style). Fonte de verdade das decisões que destravam milestones.
> Precede o PROJECT.md §5 (que passa a apontar para cá).

## Índice de alocação de faixas de numeração (C4 — governança de decisões)

> **Por que existe.** As decisões nasceram em três chats paralelos que numeravam a
> partir do mesmo ponto → colisão: predict e principal ambos com D-040..043;
> calibração e principal ambos com D-066..068, **títulos diferentes no mesmo número**.
> Faixas DISJUNTAS por chat matam a classe do problema: dois branches não podem mais
> reivindicar o mesmo D-NNN.
>
> **Regra de governança (inviolável).** Cada chat só cria D-NNN **dentro da sua
> faixa**. Uma decisão fora da faixa do branch é bug de governança — o gate de CI
> `scripts/check-decisions.mjs` reprova (ver §"Gate de colisão de decisões" no fim).

| Faixa | Dono | Escopo |
|---|---|---|
| **D-001 .. D-099** | **Principal** (mainline canônica, branch de arquitetura) | tronco: taxonomia, M1, M2, Digest Engine, Daily, preflight de lançamento |
| **D-100 .. D-199** | **Predict** (chat `predict-engine-backtesting`) | natureza do predict, integridade temporal, fronteira de cobertura |
| **D-200 .. D-299** | **Calibração** (chat `corpus-calibration`) | trava da fase, operação, gates A1/A2/A3, recalls standing |

**Migração aplicada (2026-07-18).** As decisões que já existiam em faixa colidente
foram **importadas ao canônico, renumeradas, sem perda de conteúdo**: predict
D-040..043 → **D-100..103**; calibração D-066..070 → **D-200..204** (inclui a
decisão real do operador `shrink_k` MANTIDO em 5 — D-202). Os D-040..043 e
D-066..068 do **PRINCIPAL** ficam intactos — são decisões distintas que só
colidiram no número. Detalhe e cross-refs reapontados em §"Reconciliação C4".

**Gate de merge (trava).** Os PRs #105 (predict) e #106/#107/#108 (calibração) só
mergeiam **depois** deste deslocamento e **removendo de seus diffs** as entradas já
importadas aqui (rebase que dropa a cópia antiga, não a re-adiciona). O gate de CI
`check-decisions.mjs` bloqueia mecanicamente o merge enquanto um D-NNN colidir com o
canônico por título diferente.

## D-001 — Taxonomia canônica ratificada
**Data:** 2026-07-16 · **Status:** Aprovada · **Milestone:** M1

Os **9 tipos da seção 5.4 do brief** são a taxonomia oficial:
`transferencia_bonificada | promocao_emissao | compra_pontos | clube | status_match | bonus_acumulo | shopping | pontos_mais_dinheiro | outro`.

Duplicatas da base atual (ex.: `statusmatch` vs `status match`, `compra` → `compra_pontos`, `transferencia` → `transferencia_bonificada`) migram via **tabela de aliases**; cada reclassificação é registrada em `campanha_versoes`. `cartao` e `hotelaria` da base atual não têm tipo próprio no enum — mapeiam para `bonus_acumulo`/`outro` conforme o alias definido no matcher (registrado em versão).

## D-002 — Extração do schema.sql real autorizada
**Data:** 2026-07-16 · **Status:** Aprovada · **Milestone:** M1

Extrair o DDL real do banco vivo, commitar em `v2/db/schema-atual.sql`, usar como baseline das migrations. **Antes de qualquer migration destrutiva: snapshot/backup do banco.** Migrations idempotentes e resumíveis (brief 8.1).
**Feito:** `v2/db/schema-atual.sql` (M1.0).

## D-003 — Fontes TIER 1: prioridade máxima + regra interina
**Data:** 2026-07-16 · **Status:** Aprovada · **Milestone:** M1

Primeira slice funcional do M1: adapters das páginas oficiais dos programas seed (Smiles, LATAM Pass, Azul Fidelidade, Livelo, Esfera, TAP Miles&Go).
**Regra interina** (até os adapters existirem): confirmação TIER 1 **manual** no admin conta como TIER 1 — humano valida a página oficial/regulamento e registra `url + data de verificação` em `campanha_fontes`. **A regra do Deal Desk NÃO relaxa**; muda só o mecanismo de confirmação.

## D-004 — Docs fantasma: brief v2.1 é autoridade única
**Data:** 2026-07-16 · **Status:** Aprovada

Não reconstruir documentos que nunca existiram. `METHODOLOGY.md` nasce **novo no M2**, junto com o score engine, como ativo público. Os artefatos reais ficam registrados no `PROJECT.md` como estado de referência.

## D-005 — Coexistência v1/v2 confirmada
**Data:** 2026-07-16 · **Status:** Aprovada

`v2/` isolado; landing atual **intocada até o M3**, quando as páginas públicas passam a consumir o Supabase.

## D-006 — Reuso in-place do banco confirmado (com 3 condições)
**Data:** 2026-07-16 · **Status:** Aprovada · **Milestone:** M1

O v2 evolui o banco `qjqnqcsdnpvvmyzkavoq` in-place. Condições:
1. **Snapshot** antes da primeira migration destrutiva.
2. Canonicalização das 458 variantes de origem **gera eventos em `campanha_versoes`** — nada sobrescrito sem trilha.
3. `vigencia_fim` (texto) migra para a máquina de estados; casos `"na"` viram **vigência indeterminada + flag de revisão**, nunca descartados.

## D-007 — Re-score histórico vira slice do M2
**Data:** 2026-07-16 · **Status:** Aprovada · **Milestone:** M2

Depois do engine puro de pé, **recalcular TL Score, CPM, VPM e spread de todas as campanhas canonicalizadas**. Destrava percentil com base real (achado: só 10 de 3.593 têm score hoje).

## D-008 — Segmentos Beehiiv viram slice do M2
**Data:** 2026-07-16 · **Status:** Aprovada · **Milestone:** M2

Criar os 6 segmentos de perfil (`iniciante | emissao planejada | heavy user | alta renda | completar saldo | cashback first`) é slice do M2, não pendência solta.

## D-009 — Coleta oficial: sitemap + fetch simples é o padrão
**Data:** 2026-07-16 · **Status:** Aprovada · **Milestone:** M1/M2 (slice de adapters)

A coleta de fonte oficial (TIER 1) usa **sitemap + fetch HTML simples** como padrão de arquitetura (Smiles, Livelo, Esfera, TAP — confirmado na `MATRIZ-COLETA.md`, dentro do compliance robots/ToS). **Scraper com navegador headless é exceção justificada**, não escolha caso a caso. Hoje só Azul se qualifica como exceção.

## D-010 — Azul: confirmação manual TIER 1 até segunda ordem
**Data:** 2026-07-16 · **Status:** Aprovada · **Milestone:** M1

Azul tem anti-bot no edge (robots 403). **Não construir scraper contra o anti-bot agora** — a `confirmar_tier1` cobre. Reavaliar só se Azul virar recorrente no Deal Desk.

## D-011 — LATAM: investigar a API interna antes de decidir
**Data:** 2026-07-16 · **Status:** Aprovada (pendente investigação) · **Milestone:** M1/M2

LATAM é SPA JS-rendered. Antes de construir qualquer adapter, um corte rápido: a API interna (`__NEXT_DATA__`/JSON) é **pública/estável o suficiente para ler sem violar ToS**, ou exige **token de sessão**? Se for cinza → confirmação manual como Azul. **Não construir nada ainda; registrar o veredito quando investigar.**

## D-012 — Borderline `perk` de cartão = `nao_campanha` (congelado)
**Data:** 2026-07-16 · **Status:** Aprovada · **Milestone:** M1

Perk de cartão/assinatura **sem mecânica de ponto, milha ou cashback** fica **fora** do universo de campanha (Clube iFood grátis, Disney+ cortesia, sala VIP, Gemini grátis, débito com Uber One). A unidade do The Loyal é o **ponto/milha/valor transferível**: perk sem CPM/VPM não entra na régua do TL Score nem no Deal Desk. É também a leitura **mais conservadora** — o viés certo quando o ativo é credibilidade. Se um dia virar seção ("benefícios de cartão"), é **outro produto com outra régua**. Os 7 itens `borderline_perk` do golden ficam `nao_campanha`; precision de detecção da base = **64,0%**. Política registrada num único lugar (flag em `AMOSTRA-100-ROTULADA.json`). **Não flipa.**

## D-013 — Portão de milestone M1: aprovado com os números como estão
**Data:** 2026-07-16 · **Status:** Aprovada · **Milestone:** M1 (fecho)

O portão de extração **crua não passou 95/90** e isso é **conhecido, não varrido**. Leitura explícita registrada:
1. **Quatro buracos diagnosticados:** (a) `destino` de lado único — corrigível pela **canonicalização já aplicada** (migration `001`); (b) `multiplos_cartoes` — sentinela existe, base não aplica; (c) **gate de rejeição** — não existe ainda; (d) **parser de vigência/ano** — frágil (precision 31%).
2. Dois dos quatro (a, b) já têm **correção estrutural construída**; a **revalidação do golden pós-canonicalização é a 1ª medição do M2**, não do M1.
3. `pontos_mais_dinheiro` com **0 exemplos** é dívida de cobertura registrada para o M2 preencher (caça dirigida no conteúdo).
4. O número de metodologia pública é a **precision de rejeição de `nao_campanha`**, hoje **0/31**. É o **compromisso de melhoria mensurável** do produto.

Números: `programa` 70,4/89,4 · `percentual` 69,2/100 · `vigência` 31,0/42,9. Falso-positivo agregado **36%**. Medição reprodutível em `v2/golden/` (`RUN-DEDICADA.md`, `METRICAS.json`).

## D-014 — M2 reordenado: gate de rejeição antes do TL Score engine
**Data:** 2026-07-16 · **Status:** Aprovada · **Milestone:** M2

Score preciso sobre base com 36% de não-campanha é "lixo com casas decimais". Ordem do M2:
1. **Slice 1 · Gate de rejeição** (classificador campanha vs não-campanha). Meta: precision de rejeição de `nao_campanha` saindo de **0/31** para o alvo defensável, medida contra os **86 rótulos**. Maior ROI do projeto agora.
2. **Slice 2 · Revalidação do golden pós-canonicalização** contra os 86 — captura o ganho estrutural que a migration `001` já destravou em `programa`, sem código novo de extração.
3. **Slice 3 · Parser de vigência/ano** (o pior dos quatro, precision 31%).
4. Depois: **TL Score engine** puro com golden files → re-score da base (D-007) → digest Daily.

**Diretriz da slice 1 (auditabilidade):** o gate usa LLM, mas **cada rejeição registra motivo** (`cupom | resgate | stunt | produto_blog | perk`) **e evidência**, como o gate de auditoria da publicação. **Rejeição silenciosa é tão ruim quanto falso-positivo:** campanha real derrubada vai para a **fila de revisão** com o porquê — não se descobre por ausência. Meta dupla medida contra os 86: **precision de rejeição alta com recall de campanha preservado**.

## D-015 — Reconciliação golden↔canônico: ajuste de convenção aprovado
**Data:** 2026-07-16 · **Status:** Aprovada · **Milestone:** M2

A revalidação pós-canonicalização (`v2/golden/REVALIDACAO-POSCANON.md`) expôs que o gabarito do golden e o modelo canônico divergiam em **representação**, não em verdade. Ajuste de **convenção**, com antes/depois visível (não é número inflado):
- **Single-sided own-program:** golden colapsava Clube/acúmulo próprio em `sem_destino`; adota-se a convenção canônica de **self-loop** (`livelo→livelo`, `lado_unico=false`), reservando `sem_destino` para lado único genuíno (compra de milhas, bônus de emissão).
- **`programa` medido:** cru 0,704/0,894 → pós-canon **0,788/0,830** (convenção) · 0,636/0,797 (strict). A queda de recall é **abstenção correta** (`null → revisão`), não regressão.
- Pendente: convenção do **modelo shopping** (origem = merchant vs programa). Registrada, não resolvida.
Reprodutível em `postcanon.mjs`. Reconciliar o gabarito à convenção canônica é manutenção do golden, separada do gate.

## D-016 — Gate de rejeição: desempate erra a favor de reter (abstenção)
**Data:** 2026-07-16 · **Status:** Aprovada · **Milestone:** M2 (slice 1)

Quando o gate ficar entre **rejeitar e passar**, ele **passa e manda para revisão** — nunca rejeita no escuro. Racional: **falso-positivo de rejeição (derrubar campanha boa) é pior que falso-negativo**, porque a não-campanha ainda é pega depois pela revisão humana e pelo gate de auditoria da publicação, mas **campanha boa derrubada some do produto**. A abstenção erra a favor de reter. Camada A só rejeita com regra nomeada; ambíguo sobe para B; B com confidence abaixo do limiar → revisão.

## D-017 — Golden files da camada determinística (não-regressão)
**Data:** 2026-07-16 · **Status:** Aprovada · **Milestone:** M2 (slice 1)

As rejeições determinísticas (precision ~1,0) viram **teste de não-regressão no CI**, igual ao matcher do M1. Regra que classifica hoje classifica igual amanhã. O **LLM evolui; a camada A não pode driftar**. Se um caso que sobe para o LLM revelar **regra escondida**, ela **desce para a camada A por INSERT em `motivos_rejeicao`** — o LLM julga só o que é julgamento genuíno.

## D-018 — Regra-mãe: vantagem-de-ter-o-cartão sem ponto/milha/cashback = fora
**Data:** 2026-07-16 · **Status:** Aprovada · **Milestone:** M2 (política permanente)

**Tudo que é "vantagem de ter o cartão" mas não é ponto, milha ou cashback transferível fica FORA do universo de campanha.** Anuidade grátis, perk (iFood/Disney/Gemini), sala VIP, seguro viagem, isenção de tarifa → `nao_campanha`. A unidade do The Loyal é o **ponto/milha/valor transferível**, não a economia genérica de ter um cartão. Se um dia virar seção própria ("benefícios de cartão"), é **outro produto com outra régua**. Generaliza e absorve D-012. O gate não decide caso a caso o que já é política:
- **Ruling 1 (aplicado):** cupom forte (palavra "cupom/OFF") **vence o guard de emissor** — programa nunca chama sua promo de "cupom". Desce `livelo-magalu` e `mastercard-azul` para a camada A. Camada B encolhe de 7 → **5 ambíguo real** (patrocínio, IA, ops, tarifa, resgate).
- **Ruling 2 (aplicado):** regra `anuidade_sem_pontos` na camada A (migration `005`), travada em golden.

## D-019 — Caveat permanente do número do gate: público ≠ "precision 1,0"
**Data:** 2026-07-16 · **Status:** Aprovada · **Milestone:** M2

O 1,0 de precision de rejeição é **métrica interna in-sample** (as regras da camada A vieram dos 86). **Nunca vai para fora com esse enquadramento.** O número público defensável é: **"a base saiu de rejeitar 0/34 para 33/34 dos não-campanha sem derrubar nenhuma campanha real, com trilha auditável e 1 caso honestamente em revisão".** Fora da amostra, o que protege o recall é **limiar de confidence + abstenção + fila de revisão**, não a suposição de que a camada A ou o LLM acertam sempre. Essa disciplina de enquadramento é regra fixa de comunicação do produto.

## D-020 — Correção de gabarito: `anuidade grátis` → `nao_campanha` (antes/depois)
**Data:** 2026-07-16 · **Status:** Aprovada · **Milestone:** M2

Aplicação de D-018 ao golden (ajuste de convenção, não maquiagem — com antes/depois visível). **3 itens** viram `nao_campanha`: `bradesco-...-cartao` (anuidade grátis para sempre), `nubank-...-cartao` (Black anuidade grátis, roundup), `santander-aadvantage-...` (anuidade grátis, sem bônus de milha). Fonte da verdade: `score.mjs` (regenerou `AMOSTRA-100-ROTULADA.json`).

| medição | antes (55/31) | depois (52/34) |
|---|---|---|
| campanhas / negativos | 55 / 31 | **52 / 34** |
| rejeição precision | 1,00 (30/30) | **1,00 (33/33)** |
| campanha recall | 1,00 (55/55) | **1,00 (52/52)** |
| rejeição recall | 0,968 (30/31) | **0,971 (33/34)** |
| camada A / B (rejeições) | 24 / 6 | **29 / 4** |

Os 3 flips + os 2 do ruling 1 entram na camada A determinística (lock em `gate.test.mjs`). Os números do M1 (`RUN-DEDICADA.md`) são o snapshot do portão M1 pré-flip; a medição corrente autoritativa é 52/34 (`GATE-METRICAS.json`, `METRICAS.json`).

## D-021 — Vigência: `overprecision` é bloqueio (INV-16), inferência de ano com trava de virada
**Data:** 2026-07-16 · **Status:** Aprovada · **Milestone:** M2 (slice 3, fechada)

Duas falhas de vigência são **naturezas diferentes**: **parsing** ("li a data certa?") é bug; **confiabilidade de fonte** ("confio nessa data?") é estado legítimo (TIER 2 → "Não confirmado" pelo FSM). A slice 3 conserta só o parsing; a confiabilidade já é resolvida pela migration `001`/`003`.
- **`overprecision` = override bloqueante (INV-16), não meta numérica.** Sem evidência de **cada componente** (dia, mês, ano), o componente é indeterminado e a data incompleta vira `indeterminada`. Fabricar data envenena o FSM (`ultimos_dias`/`encerrada` falsos) — pior que não ter data. Mesma família do INV-03.
- **Inferência de ano** (texto → slug `mmmAA`/`publicado_em` proxy → `indeterminada`) com **trava de virada**: alvo antes do mês de publicação → ano seguinte; ambíguo sem proxy → `indeterminada`. Testes sintéticos cobrem a virada.
- **Achado:** o gold estrito pegou **5 overprecisions do próprio gabarito do M1** (datas do `id`/slug-sem-dia) → corrigidas para `indeterminada`. O invariante pega o erro do rotulador.
- **Medido (in-sample):** overprecision 0, parsing precision/recall 1,0; confiabilidade 0/52 TIER 1, reportada à parte. O 1,0 é in-sample; o que vale fora é o **bloqueio estrutural** (INV-16) + a trava de virada, não o número.

## D-022 — TL Score v2: vetor travado, Opção A, Manual público versionado, órfãos como dívida
**Data:** 2026-07-16 · **Status:** Aprovada · **Milestone:** M2 (slice 4)

**Vetor `score_pesos.v1` (travado):** `percentil 0,45 · eficiência 0,30 · raridade 0,15 · abrangência 0,10`; `shrink_k=5`, `min_samples=3`. Pesos **versionados em `score_pesos`**, não hardcoded (accuracy loop recalibra sem deploy; golden ancorados à versão; breakdown grava `versao_pesos`).
- **Vigência fora do score:** urgência não é qualidade; peso positivo em vigência-restante premiaria o afogadilho (viola INV-06). Vira **selo de urgência** (FSM já deriva `ultimos_dias`).
- **Fontes vira override**, não peso de 5 pts (mais forte; INV-02).

**Reconciliação Manual v1 (8) → v2 (5) = Opção A** (`RECONCILIACAO-MANUAL-8-para-5.md`): `valor`→percentil+eficiência, `liquidez`→eficiência, `aplicabilidade`→abrangência, `vigência`→urgência, `fontes`→override, `raridade` nova. **35 pts órfãos** (`regra` 15, `fricção` 10, `estoque` 10) **não pontuam** — exigem dado sem fonte determinística (T&C parsing / modelo de fricção / award search); fabricar violaria INV-12.

**Condição de honestidade (bloqueante):** o v2 se declara **versão nova**, não a mesma metodologia.
- **Manual público atualizado na mesma leva do engine** (Trilha A): "TL Score v2, vigente desde [data]", v1 arquivado com changelog, e diz **explicitamente** que regra/fricção/estoque são avaliadas **editorialmente e não entram na nota** (previsão de reintrodução). Admitir o que não se mede > fingir peso.
- **Narração editorial permitida:** LLM pode citar as 3 dimensões no texto/breakdown do item ("termos exigem clube", "estoque não verificado"), com evidência, **sem alterar `tl_score`**.

**Dívida nomeada (dono de milestone, condição de reintrodução):**
- `regra` (15) — o mais parseável; volta quando houver **T&C parsing** (candidato M3/M5).
- `fricção` (10) — precisa de **modelo próprio** de esforço de execução (sem milestone ainda).
- `estoque` (10) — depende de **award search ao vivo**, fora do escopo do ciclo atual.

## D-023 — Engine: 2 overrides, não 3
**Data:** 2026-07-16 · **Status:** Aprovada · **Milestone:** M2 (slice 4) · Origem: Trilha A
Vigência-não-confirmada saiu do score (D-022) e é derivável do FSM → fica no gate/digest, não é override do engine. Overrides do engine: `sem_tier1`, `conta_nao_calculavel`. Lista extensível por versão.

## D-024 — Prioridade de override: `conta_nao_calculavel` > `sem_tier1`
**Data:** 2026-07-16 · **Status:** Aprovada · **Milestone:** M2 (slice 4) · Origem: Trilha A
Quando os dois disparam, `conta_nao_calculavel` vence em `override_aplicado` (ambos logados em `tl_overrides`). **A prioridade não é arbitrária:** `sem_tier1` sozinho é uma **fila de trabalho útil** (confirme a fonte e vira Deal Desk); `conta_nao_calculavel` é um **beco** (nem confirmando TIER 1 vira publicável, porque não há conta fechável). O beco vence e **tira o item da fila de candidatos a confirmar** — confirmar TIER 1 de algo sem conta é trabalho desperdiçado. Gravar assim para ninguém inverter achando que dá no mesmo.

## D-025 — `tl_breakdown.base_curta`
**Data:** 2026-07-16 · **Status:** Aprovada · **Milestone:** M2 (slice 4) · Origem: Trilha A
Coluna booleana em `tl_breakdown` marca o amortecimento de percentil por base curta (SPEC §2) de forma auditável — `base_n < min_samples`.

## D-026 — Adapter: percentual do slug vence o corpo
**Data:** 2026-07-16 · **Status:** Aprovada · **Milestone:** M2 (slice B) · Origem: Trilha B
Quando o % aparece no slug (`ate-90`→90) e no corpo, o slug vence — mais estável que HTML volátil.

## D-027 — Adapter: 3xx/encerrada = não confirmável
**Data:** 2026-07-16 · **Status:** Aprovada · **Milestone:** M2 (slice B) · Origem: Trilha B
Redirect de campanha (ex.: →`/promocao`) é **recusa de confirmação**, não TIER 1. Guarda o INV-16: não confirma o que morreu.

## D-028 — `coleta_execucoes` = telemetria durável de coleta
**Data:** 2026-07-16 · **Status:** Aprovada · **Milestone:** M2 (slice B) · Origem: Trilha B
`campanha_fontes` é trilha de confirmação (não registra varredura vazia) e `job_queue` é efêmera; a saúde por fonte (REQ-09/NFR-03) precisa de tabela própria. Justifica a migration 007.

## D-029 — Escopo de adapter: Livelo `static-sitemap`, TAP `pt_br`
**Data:** 2026-07-16 · **Status:** Aprovada · **Milestone:** M2 (slice B) · Origem: Trilha B
Livelo: só `static-sitemap`. TAP: só locale `pt_br`. Reduz descoberta ao que é campanha BR relevante.

## D-030 — `pontos_mais_dinheiro`: sintético agora, real depois — número com asterisco
**Data:** 2026-07-16 · **Status:** Aprovada · **Milestone:** M2 (slice C) · Origem: Trilha C
9/9 fechado com 4 sintéticos marcados; a extração nunca produz o tipo hoje. **Regra (não observação): sintético NUNCA entra em número público de precision/recall sem ser declarado como tal.** Qualquer número público que hoje inclua os 4 sintéticos do PMD **carrega essa marca até o 2º passe com reais os substituir** — mesmo rigor do D-019. **Número com sintético é número com asterisco, sempre.** Dívida: substituir por reais no 1º banco vivo que contiver o tipo.

## D-031 — Convenção de campos de `pontos_mais_dinheiro`
**Data:** 2026-07-16 · **Status:** Aprovada · **Milestone:** M2 (slice C) · Origem: Trilha C
`destino=sem_destino`, `publico=geral`, `percentual=null` (split de pagamento pontos+dinheiro não é bônus). *(Dívida registrada, não-ADR: medir o gap do tipo dentro do portão exigiria mudar `gate-run.mjs` — fora do escopo da C.)*

## D-032 — Derivação = slice de re-score, não o engine
**Data:** 2026-07-16 · **Status:** Aprovada · **Milestone:** M2 (slice re-score) · Ratificação do operador
O engine é puro sobre entradas ∈ [0,1]; a **derivação** (CPM/histórico/buckets → [0,1]) roda na **varredura de re-score**, com seus próprios testes contra dados reais e seu **próprio "vetor de derivação" a aprovar** (mesma disciplina do vetor de pesos). Mantém o engine testável com golden sintéticos independentes do banco e concentra o risco de canonicalização no re-score (onde o backup segura).

## D-033 — Matcher URL→campanha reusa `identidade.mjs`; cria campanha se preciso
**Data:** 2026-07-16 · **Status:** Aprovada · **Milestone:** M2 (slice matcher) · Ratificação do operador
A página oficial extrai tipo+origem+destino+público e casa com campanha existente pela **mesma identidade canônica do M1** (`identidade.mjs`), não matcher paralelo novo. Se a campanha **não existe**, nasce **já com fonte TIER 1**. Confirmar fonte = evento em campanha existente **ou** nascimento de campanha nova confirmada; ambos geram evento em `campanha_versoes`.

## D-034 — Evidência TIER 1 em `campanha_fontes` (payload jsonb)
**Data:** 2026-07-16 · **Status:** Aprovada · **Milestone:** M2 (slice matcher) · Ratificação do operador
Coluna `payload jsonb` aditiva guarda o trecho/evidência que justifica a confirmação TIER 1 (mesma disciplina de proveniência de tudo). Migration 008, aditiva.

## D-035 — CPM cego = asterisco TIPADO no breakdown público (dois motivos)
**Data:** 2026-07-17 · **Status:** Aprovada · **Milestone:** M2
Enquanto a eficiência não estiver viva, o breakdown público **mostra explicitamente** que o score se apoia em percentil-de-rota e por que o CPM não entrou — com o mesmo rigor de "Não confirmado". **O asterisco tem DOIS motivos distintos, com textos diferentes:**
- **`nao_calculado_ainda`** — transferência de moeda comprável esperando a tabela de ratios, ou compra ainda não extraída. É temporário; enche quando a slice de CPM avança.
- **`nao_calculavel_por_natureza`** — origem de **ponto de banco** (Itaú, C6…): não há custo de aquisição de mercado (você acumula, não compra). É permanente e honesto ("origem sem custo de aquisição de mercado").
O leitor precisa saber **qual** dos dois. Score com CPM cego é score com asterisco, igual sintético (D-030) e in-sample (D-019).

## D-036 — Diagnóstico do CPM: pipeline nunca automatizou; tabela de custo-base viável agora
**Data:** 2026-07-17 · **Status:** Aprovada · **Milestone:** M2
Os 10 CPMs foram leitura editorial manual (`valor_leitura` é prosa humana). Input por tipo: `compra_pontos` tem o preço no conteúdo (extraível barato — #99, 6→22, 0 falso-positivo); `transferência` precisa de custo-base por moeda (construível agora, **não é M5**); cartão/clube/estrutural/hotelaria = `n/a` legítimo.

## D-037 — Vetor de derivação `DERIVACAO_V1` aprovado
**Data:** 2026-07-17 · **Status:** Aprovada · **Milestone:** M2
percentil rota-total (ECDF midrank), eficiência ECDF-inverso do CPM (ausente→redistribui), **raridade n=1 tetada em 0,85**, abrangência `geral 1,0/cartão 0,6/selecionados 0,45/clube 0,3`, CPM global provisório, `min_samples=3`/`shrink_k=5`. Versionado em `derivacao_config` (migration 009, aplicada).

## D-038 — Dois re-scores; runner importa o JS testado (não cópia)
**Data:** 2026-07-17 · **Status:** Aprovada · **Milestone:** M2
**Re-score-1** roda agora por percentil-de-rota com CPM cego (asterisco D-035); **re-score-2** roda com eficiência viva após a tabela de custo-base+ratios aprovada. A slice de CPM **fura a fila e corre em paralelo**. **O re-score roda via runner (Edge Function) que IMPORTA `derivacao.mjs`+`score.mjs` versionado — nunca uma cópia** (cópia drifta do golden, violaria INV-12). **Dry-run + trava de anomalia (por linha E por programa) obrigatórios antes de gravar.**

## D-039 — CPM v1 tem alcance parcial honesto (não cegueira total)
**Data:** 2026-07-17 · **Status:** Aprovada · **Milestone:** M2
CPM v1 **acende** para `compra_pontos` (extrator) e transferência de **moeda comprável com ratio conhecido** (Livelo, origem #1, cobre muito). Fica **null com asterisco tipado** (D-035) para transferência de **banco** (sem âncora de mercado, permanente) e de moeda comprável **sem ratio ainda** (temporário). **A tabela de ratios por par é PRÉ-REQUISITO do CPM de transferência** — enquanto não existir, transferência = CPM null, **nunca ratio 1:1 inventado** (Livelo→ConnectMiles R$21,43 vs R$60 real = 2,8×: CPM 1:1 mentiria). Compra acende já (não depende de ratio). Custo-base v1: livelo 30 (alta), esfera 35 / smiles 21 / ihg 28 (média, marcadas), versionado com changelog. Piso ("a partir de") usado **como piso, nunca como média**. É CPM parcial honesto com motivo do null explícito por item — mais produto do que se tinha no diagnóstico inicial.

## D-040 — Recanonicalização = SÓ self-loops; `sem_destino` e banda 65 são derivação, não identidade
**Data:** 2026-07-17 · **Status:** Aprovada · **Milestone:** M2
O dry-run do re-score-1 (D-038) acendeu 3 flags; a investigação read-only derrubou 2 como não-identidade **antes de escrever regra** (diagnosticar-antes-de-corrigir). (1) **self-loops de transferência** (13 linhas `origem_code=destino_code`) — bug de identidade real, único escopo da slice de recanonicalização. (2) **`sem_destino` dominante** — dos 1.220 itens, **1.220 são `lado_unico=true`**, zero transferência com destino perdido: o M1 já separou certo (shopping/merchant de um lado só). NÃO é identidade → dívida de derivação (D-042). (3) **score uniforme 65** — rodado o engine na assinatura real, bônus 7/30/40/52/115% com `cpm=null` e rota curta **todos dão 65**: é ponto fixo de derivação (eficiência ausente redistribui, percentil base-curta amortece a 0,5), não identidade. Enfiar correção de score na slice de identidade seria o fix cego vetado. **Escopo travado: 13 self-loops, nada mais.**

## D-041 — Triagem de self-loops R1–R5; R5 reclassifica por CRITÉRIO, nunca automático
**Data:** 2026-07-17 · **Status:** Aprovada · **Milestone:** M2
Árvore de triagem (genérica, não lista cega) para `transferencia` com `origem_code=destino_code`, reusando `identidade.mjs` (INV-12): **R1** origem_bruto ∈ placeholders (`loop`…) → descarta; **R2** sem %/paridade/cpm → revisão (casca); **R5** percentual acima do teto plausível de bônus de transferência **do tipo** → revisão sinalizando "provável compra"; **R4** origem_bruto ≠ destino_bruto colapsando no mesmo code → corrige o **mapa** M1 (não a linha; causa-raiz de 4 dos 13: `all↔accor`, `mundoavios↔avios`, `azulviagens↔azul`, `pagol↔smiles`); **R3** mesma string bruta com bônus → revisão (origem perdida). **Trava do R5 (operador):** número absurdo NÃO vira compra automaticamente — pode ser bônus raro, erro de ordem de magnitude ou outro tipo. R5 manda para **revisão com tipo sugerido**; humano confirma. **Teto de bônus por tipo é configurável, não hardcoded.** Descarte automático só no R1 (placeholder inequívoco). Disciplina D-038: dry-run + trava (self-loops → 0), backup preso, para para aprovação antes de gravar.

**Revisão do R4 (2026-07-17, após leitura do seed):** o R4 original ("corrige o mapa M1") partia de premissa falsa. A inspeção de `seed-aliases.json` provou que os 4 casos são aliases LEGÍTIMOS do mesmo programa: `pagol`/`pagogol`/`madrugol`→smiles (PagoGol/MadruGol SÃO Smiles), `all`/`allaccor`→accor (AllAccor É Accor), `mundoavios`→avios. De-aliasar (sugestão inicial do operador) CORROMPERIA o mapa — separaria toda campanha PagoGol da base por causa de 1 self-loop (o fix cego invertido). **O operador reverteu:** o dado venceu a instrução. R3 e R4 colapsam num único **guard de self-loop no matcher** (`resolverCampanha`): `transferencia_bonificada` com `origem_code===destino_code` → `revisao='transferencia_self_loop'`, **seed intacto**. Guard é regra PERMANENTE (pega self-loop futuro, não patch dos 13). Revisão em M1 = `identidade_id IS NULL` (convenção existente, 278 linhas); os 13 self-loops estavam resolvidos por engano → recanonicalização seta `identidade_id=NULL` + trilha em `campanha_versoes`; `loop→loop` leva `discard_reason='self_loop_placeholder'` (R1). Re-score-1 pontua só a base sã (`identidade_id NOT NULL`), o que tira os 13 do escore E da varredura de anomalia.

## D-042 — Banda neutra por CPM-cego é CORRETA (não defeito); rejeita bônus absoluto; dívida de lado-único
**Data:** 2026-07-17 · **Status:** Aprovada · **Milestone:** M2
A banda 65 (sintoma 3, D-040) resolve-se por **(c3)+(c1)**: não inventar percentil onde não há rota (n=1 → o item é a própria mediana; forçar discriminação fabricaria sinal, viola INV-03); deixar o **CPM vivo** (ratios 012/013) discriminar `avios/disney/airbnb` no re-score-2, e rotular o resto **CPM-cego** com o asterisco tipado (D-035). **Rejeitado o fallback de bônus absoluto (c2):** comparar 40% de uma rota contra 40% de outra reintroduz a comparação entre-rotas que o percentil-por-rota existe para evitar (p50 numa rota, p99 noutra) — 65 honesto vence número inventado que discrimina errado. **Consequência travada:** enquanto o CPM estiver cego para uma rota, itens de rota curta convergem para a banda neutra e **isso é correto** — o produto NÃO os mostra no Deal Desk como pontuados; ficam na fila com CPM-cego explícito até o CPM acender. O re-score-2 é o que tira metade da base da banda neutra (não é refinamento, é destravamento). **Dívida nomeada (não abrir slice agora):** "derivação de lado-único no score — como shopping/acúmulo pontua sem rota, resolver no re-score-2 dentro do vetor de derivação existente".

## D-043 — Modo de operação: spec aprovada = autonomia dentro da slice
**Data:** 2026-07-17 · **Status:** Aprovada · **Milestone:** transversal
Dentro de uma slice já aprovada (spec + ADRs), executar a sequência inteira no automático até o ponto de parada natural — **sem pedir OK por micro-passo** (atrito que não protege nada). O operador é o portão **entre** slices e nas **quatro** condições de parada, não dentro delas: (1) trava de anomalia D-038 acende algo **novo não previsto** na spec; (2) decisão de **produto/métrica** fora de spec/ADR aprovado (peso, régua, política de conteúdo, o que vira público); (3) escrita **destrutiva/irreversível** ou que toque o **backup**; (4) **dado que exige julgamento que só o operador tem** (TIER 1 manual, ambiguidade que o matcher não resolve). Fora dessas quatro, seguir. Slices **encadeiam** sem novo OK quando a próxima é continuação natural da mesma sequência aprovada (ex.: recanonicalização → re-score-1 sobre base sã). Velocidade na execução; OK do operador só onde há decisão real. **Diretriz de correção (o portão nos dois sentidos):** quando uma instrução do operador contradiz o que o dado mostra, **o dado vence** — o agente PARA e mostra a evidência, não executa obedientemente a instrução errada (precedente: D-041 revisão do R4, PagoGol=Smiles). O operador prefere ser corrigido por evidência a ter uma sugestão errada aplicada.

## D-044 — Publicação no Deal Desk = TRÊS portões (vigência é o terceiro, era implícito)
**Data:** 2026-07-17 · **Status:** Aprovada · **Milestone:** M2/M3
O B4 é ranking de **valor** e nunca filtrou **vigência** — a diligência do primeiro Deal Desk revelou que **16 dos 17 azul de alto valor estão ENCERRADOS**. Publicá-los violaria a regra-mãe (oferta **acionável**) e estrearia o The Loyal fazendo o que critica nos agregadores: destacar promo morta. Isso também explica o "publicável agora = 0" dos dois re-scores (zero eram vivas **E** TIER 1 ao mesmo tempo — honestidade estrutural, não bug). **Invariante:** nenhum item entra no **Deal Desk publicável** sem os TRÊS portões: (1) **estado vivo** (`ativa`/`detectada`/`ultimos_dias`), (2) **TIER 1 confirmado**, (3) **conta/valor computável**. A vigência era o portão implícito que faltava nomear. O ranking dos 101 continua sendo a análise/motor; o publicável é só o subconjunto vivo+TIER1. Item encerrado no Deal Desk = **bloqueio categórico** de publicação no gate de auditoria pré-publicação.

## D-045 — TIER 1 corrobora os TERMOS da oferta, não só a existência da página; termo de terceiro é candidato
**Data:** 2026-07-17 · **Status:** Aprovada · **Milestone:** M2
O primeiro item (`livelo→azul`) foi ingerido de **terceiro** (`melhorescartoes`, confiança baixa) como **115%**. A fonte **oficial** da Livelo (`livelo.com.br/transfira-seus-pontos-promo-azulfidelidade`, viva, renderizada pós-JS) mostra **100%/125%, sem 115%** — o 115% está **errado/desatualizado**. Um agregador publicaria os 115%; o The Loyal vai à Livelo e o número não bate. **Regra:** termo ingerido de terceiro é **candidato**; só vira publicável após a fonte **oficial corroborar os TERMOS reais** (o %, a vigência), não apenas que "existe uma promo". TIER 1 = corroboração da OFERTA. Score/CPM/veredito recomputam sobre o número **verificado**, nunca sobre o ingerido. É o portão que separa o produto de um agregador de cupom.

## D-046 — Histórico de alto valor = arquivo "track record" (dívida M3), não Deal Desk
**Data:** 2026-07-17 · **Status:** Aprovada (dívida) · **Milestone:** M3
O ranking dos 101 (incluindo encerrados de alto valor) é conteúdo legítimo — mas como **arquivo / prova de metodologia** ("estas foram as melhores ofertas que já passaram, com nossa conta"), não como Deal Desk vivo. Superfície de M3 (páginas de edição + dashboard público). Vira **ativo de marca**: mostra a régua funcionando ao longo do tempo — base do accuracy loop. Registrada como dívida nomeada.

## D-047 — Adapter distingue campanha de evergreen pela JANELA DE VIGÊNCIA no regulamento, não pela URL; público-na-tupla validado
**Data:** 2026-07-17 · **Status:** Aprovada · **Milestone:** M2
Dois aprendizados do caso `livelo→azul` (v2/M2/CASO-LIVELO-AZUL-DIVERGENCIA.md), o primeiro item real:
(1) **Público-na-tupla (M1) validado por evidência oficial.** O regulamento da Livelo mostra o **mesmo par** `livelo→azul`, na **mesma janela**, com **cinco percentuais** por público (50/100/105/110/120). Tratá-los como um número só (o "115% médio" do blog) **destrói a informação**. Confirma a decisão M1 de pôr `publico` na tupla de identidade: cada faixa de público é uma **identidade distinta** com score/veredito próprios. Decomposição plena por público fica como enriquecimento de track record (não vale a precisão de Deal Desk vivo para item histórico); a escala é guardada no `payload` da fonte para não recolapsar.
(2) **A Livelo usa a MESMA URL para campanha e para evergreen** (institucional, paridade 1:1 sem bônus). Logo o adapter **não** distingue campanha de evergreen pela URL. O sinal é o **conteúdo datado do regulamento**: regulamento com **janela de vigência** ("das 10h de 15/04 às 23h59 de 17/04/25") = campanha; página só com paridade institucional sem janela = evergreen sem bônus. Quando a campanha encerra, a mesma URL **reverte ao evergreen** — por isso o fetch de 2026-07-17 não viu bônus: a de abr/25 já saíra. **Regra do adapter Livelo:** detectar campanha pela presença de janela de vigência no regulamento, não pela URL.

## D-048 — Confirmação TIER 1 = gate de confiança com limiar auto-ajustável (não curadoria manual permanente)
**Data:** 2026-07-17 · **Status:** Aprovada (decisões) · Parte C reescrita aguarda OK final · **Milestone:** M2/M3
A confirmação de fonte TIER 1 (SPEC-SLICE-COLETA-TIER1.md, Parte C) é um **gate de confiança**, não fila manual permanente. Cada confirmação automática (Parte A) calcula uma **confiança ∈ [0,1] DETERMINÍSTICA** a partir de sinais objetivos e verificáveis (janela de vigência clara? termos corroboram sem divergência? fonte oficial vs secundária? público inequívoco? estado vivo 200?) — **nunca nota subjetiva de LLM** (determinismo-primeiro, INV-12; o LLM narra por que a confiança ficou baixa, não decide que ficou). O **limiar** decide o caminho, os dois automáticos: confiança ≥ limiar → publica sem revisão humana; < limiar → fila de revisão (exceção calibrada, não bloqueio). O limiar **auto-ajusta** medindo o próprio acerto (automático vs correção humana posterior) — accuracy loop (brief §13). **4 travas invioláveis:** (1) **piso gated** — subir o limiar (cautela) é livre, baixá-lo abaixo do piso (risco) exige o operador; (2) a **auditoria pré-publicação fica acima** — confiança alta pula a revisão da FONTE, não a auditoria da PUBLICAÇÃO (contas/vigência/lint do digest); (3) **volume mínimo** de confirmações com desfecho conhecido antes de mover o limiar (não calibra com base insuficiente, como predict base_n≥3); (4) **todo movimento de limiar logado** com motivo + taxa de acerto (auditável como os pesos). Lançamento: dia 1 limiar **conservador** (quase tudo à revisão), baixa até o piso conforme prova acerto — human-in-the-loop faseado. **Decisões da slice (todas ✅):** ordem A∥B→C; corte de valor 70 inicial (parâmetro); Parte B como PROPOSTA de vetor antes de re-scorar; escala-por-público separada em N identidades automático (D-047), revisão só se ambígua.

## D-049 — Confiança (qualidade da verificação) é ORTOGONAL ao RESULTADO (corrobora/refuta); três níveis de divergência de termos
**Data:** 2026-07-17 · **Status:** Aprovada · **Milestone:** M2/M3 · filho de D-048
Dois refinamentos do gate de confiança (SPEC-SLICE-COLETA-TIER1 §3):
**(1) Confiança ≠ aprovação.** A confiança mede a **qualidade da verificação**; o **RESULTADO** da verificação (corrobora vs refuta) é um eixo **separado**. O caso azul: a fonte oficial verificou com alta confiança E **refutou** o item (matou o 115%). Matriz:
  - **alta confiança + corrobora →** publica (atravessa os 3 portões);
  - **alta confiança + refuta →** remove/rebaixa **com firmeza** (não publica; corrige com certeza, como o azul → Evitaria/histórica);
  - **baixa confiança (qualquer resultado) →** revisão humana.
  Nunca colapsar "confiança" com "aprovação": um refutado de alta confiança sai do Deal Desk com a mesma certeza que um corroborado entra.
**(2) Três níveis de divergência de termos** (o sinal "termos corroboram" não é binário):
  - **`corrobora_limpo`:** o número bate com a fonte dentro de **tolerância de arredondamento/fraseio** (blog "100%" vs oficial "até 100%" = mesmo teto). Confiança alta.
  - **`corrobora_com_ajuste`:** o número **existe** na fonte mas o **público/faixa** precisa correção (blog pegou 110% do tier clube; oficial tem a escala inteira — número real, mal-atribuído). Confiança **média** → separa por público (D-047) e/ou revisão.
  - **`refuta`:** o número **não existe em NENHUMA faixa** da escala oficial (azul 115% vs 50/100/105/110/120). Resultado negativo → remove/rebaixa.
  Critério: refuta = número ausente de todos os tiers; corrobora_com_ajuste = presente num tier mas atribuído ao público errado; corrobora_limpo = presente no tier do público certo dentro de tolerância. Sem essa graduação o gate fica rígido demais (tudo à revisão) ou frouxo demais (aceita aproximado).
**Lançamento (trava 3 aplicada):** no **dia 1 o limiar de partida é aprovado pelo OPERADOR**, não pelo sistema. A Parte A roda em modo **"confirma-e-mostra"** (gera confirmações com score de confiança + resultado, **não publica automático**) até o operador ver o primeiro lote real e cravar o limiar. O auto-ajuste só liga depois do volume mínimo de desfechos conhecidos.

## D-050 — Lançamento: o The Loyal estreia RECUSANDO, não performando; Deal Desk vivo gatilhado por OFERTA, não por data
**Data:** 2026-07-17 · **Status:** Aprovada · **Milestone:** M2/M3
A máquina está **provada ponta a ponta** (caso `livelo→azul` + `livelo→hilton` confirmado limpo, confiança 1,00, oficial, vivo). O Deal Desk vivo **não está pronto para estrear** — não por falha de motor, mas porque a base hoje **não tem oferta viva + forte + confirmável** (vale de calendário; nenhuma campanha forte ativa nesta janela). **Isso é informação, não fracasso.** Decisões:
1. **Não estreia com item morno.** `livelo→hilton` 50% (oficial, vivo, conf 1,00, mas bruto **65 "Só casos"**) **NÃO é o card de estreia** — fica confirmado, aparece na listagem geral, não no Deal Desk de estreia. O poder do "Só casos" honesto só aparece **depois** que o leitor viu o produto acertar em ofertas fortes e recusar ruins; como estreia, é anticlímax e lê como "produto que recomenda mediano".
2. **O primeiro Deal Desk vivo é gatilhado por OFERTA** — a primeira que seja genuinamente "Vale olhar"/"Vale agir", viva e confirmada. O gate a captura automático no instante em que aparecer. **Não por data.**
3. **Auto-publish fica DESLIGADO até a calibração fechar os vetores de score.** O gate está pronto e calibrado (limiar de partida **0,75** aprovado, confirma-e-mostra); ligar publicação automática sobre régua que a calibração vai mudar seria publicar sobre parâmetro instável. O gate está pronto; a publicação espera a régua calibrada.
4. **Track record (D-046)** = conteúdo de estreia: "estas foram as melhores ofertas que já passaram, com nossa conta e nosso veredito" (a escala azul 120% clube-topo, etc.). Dá substância à estreia sem publicar item morno como recomendação viva.
5. **Cobertura de fontes é a próxima frente** (15/18 vivas crawleáveis sem URL oficial → nem chegam ao gate). Mais adapters + páginas oficiais detectáveis = maior probabilidade de capturar a próxima oferta forte quando surgir.
**Princípio de lançamento (registrado):** *o dia fraco reportado como dia fraco* — "esta semana não há oferta que valha a pena, e aqui está por quê, com as contas" — demonstra mais credibilidade que qualquer card de 65. Nos primeiros dias, o dia fraco honesto é a **melhor propaganda** do produto. **Parâmetros aprovados nesta rodada:** Parte B — fallback cross-merchant OFF; `conta_nao_calculavel` → **não-valor** (bruto null), não desinflado; raridade buckets D-037; `min_merchant=3`/`min_tipo=8`; versionado em `derivacao_config`. Parte A — limiar 0,75, gate em confirma-e-mostra.

## D-050.1 — Não-valor cobre TODOS os `conta_nao_calculavel` (correção de consistência, não regra nova)
**Data:** 2026-07-17 · **Status:** Aplicada · **Milestone:** M2
Correção de consistência do D-050 (decisão 4). A regra "cnc → não-valor (bruto null)" tinha sido aplicada só aos **lado-único** (624, Parte B) — recorte acidental. Mas `conta_nao_calculavel` = "não há valor computável", **independe do tipo de rota**: um sorteio sem % e sem CPM não tem valor computável seja lado-único ou rota real. A Frente B expôs o buraco ao perseguir um **falso-forte** (`bradesco→livelo` bruto **91 "Vale agir"** escondendo `override=conta_nao_calculavel`, sorteio sem %). Havia **710** cnc de rota real com bruto inflado, **375 deles ≥70** (falsos-fortes que envenenam ranking/coleta). **Aplicado:** onde `override=conta_nao_calculavel`, `tl_score_bruto=null` + `veredito_bruto='Não confirmado'`, para os 710 (total cnc não-valor agora = 1.334). Dry-run confirmou **0 mudança de veredito público** (todos já Não confirmado por override; nenhum publicável) — trilha em `campanha_versoes` (evento `correcao_nao_valor_d050_1`). **Achado que decorre:** com os falsos-fortes zerados, o ranking da Frente A (oferta-forte-viva-bloqueada) fica **quase vazio** (1 item fraco `costa_cruzeiros` 70) → **nenhum adapter tem alvo forte hoje**; confirma D-050 no nível mais profundo (a base não tem oferta forte viva, e removê-los provou que a própria justificativa "adapter de banco" era fantasma). **Coordenação (calibração):** a extensão zerou 710 brutos → qualquer medição de distribuição de score anterior precisa ser revalidada contra a base corrigida.

## D-051 — Não se constrói infra de captura sem alvo MEDIDO; espera honesta é estado válido
**Data:** 2026-07-17 · **Status:** Aprovada · **Milestone:** transversal (disciplina de engenharia)
O ranking vazio da Frente A (após D-050.1 zerar os 375 falsos-fortes) provou que **não há alvo forte** para os adapters desbloquearem hoje — o `bradesco→livelo 91` que justificava adapter de banco era fantasma. Princípio consolidado, além deste caso: **não se constrói infra de captura (adapter, coletor, pipeline) sem um alvo MEDIDO para capturar.** Infra especulativa é **dívida disfarçada de progresso**. A Frente A (adapters de banco) vira prioridade **no instante em que o ranking apontar uma oferta forte viva** num programa que a justifique — não antes. **O sistema em espera honesta e produtiva é um ESTADO VÁLIDO**, não um problema a resolver com mais código. Coerente com D-050 (Deal Desk gatilhado por oferta): a próxima oferta forte vem do **calendário**, e o gate provado a captura quando vier. **Frentes que rendem sem alvo novo:** calibração (fecha os vetores → liga o auto-publish, caminho crítico) e track record / M3 (conteúdo de estreia). **Marco:** o projeto saiu da fase de **construir o motor** (provado ponta a ponta) e entra na de **operar e afinar**; vale um **fechamento de M2** quando a calibração fechar.

## D-052 — Contrato do template de e-mail Daily: 4 decisões ratificadas (S1-D1..D4)
**Data:** 2026-07-17 · **Status:** Aprovada · **Milestone:** M2
Ratifica as 4 decisões abertas de `SPEC-SLICE-TEMPLATE-EMAIL-DAILY.md` §3, formalizadas
aqui porque o handoff nunca chegou a registrá-las como ADR (gap corrigido nesta entrada).
**(1) Conta Feita:** campo opcional `contaFeita` no schema (reusa `$defs/conta`); ausente
⇒ fallback automático = `conta` do **primeiro** item de `deals[]`. **(2) O que evitar:**
campo opcional `oQueEvitar` (string), mesma forma de `signal` — aditivo, não quebra
edições existentes. **(3) Cap de Deal Desk:** **3**, sem `maxItems` no schema (decisão
editorial, não de contrato); renderer aplica o corte e **nunca trunca em silêncio** — se
`deals.length > 3`, registra quantos ficaram de fora. **(4) Contrato canônico:**
`content/edition.schema.json` vence — é o único dos dois artefatos versionado com `$id`;
`renderer/email.mjs` (que lia snake_case divergente) é **realinhado** a ele, não o
contrário. Também aprovado nesta rodada: patch aditivo do `scoreBreakdown` (ver D-053) e
`<meta name="color-scheme" content="light">` travado no e-mail (light-locked, já
desenhado na spec do template).

## D-053 — Digest Engine: Clipping + Resumo do dia, Loyalty Lab automatizável por score (Ledger é dívida), TIER 2 alimenta blocos narrativos
**Data:** 2026-07-17 · **Status:** Aprovada · **Milestone:** M2
Emenda do operador sobre `SPEC-SLICE-DIGEST-ENGINE.md` (v1, commit `9c39ffc`) antes do
código. Quatro mudanças: **(1) `scoreBreakdown` do schema corrigido** — o `$defs`
antigo descrevia 8 critérios do modelo pré-`score.mjs` (resíduo do TL Score vindo pronto
do LLM); patch aditivo agora reflete o engine real (4 componentes:
`percentil/eficiencia/raridade/abrangencia`, pesos `.45/.30/.15/.10`, `score_pesos.v1`).
**(2) Dois blocos novos no dia fraco:** **Resumo do dia** (síntese editorial curta do que
aconteceu no mercado, prosa, distinta do Sinal do Dia que é veredito) e **Clipping**
(lista de **≥5** notícias do dia com resumo próprio + link + fonte/tier — piso rígido,
sem preencher com menos). Ordem revisada: Resumo do dia → Clipping → Radar → Radar VPM →
Sinais rápidos → Loyalty Lab. Mesma regra-mãe (seção sem dado real = omitida, nunca
incompleta) aplicada a ambos. **(3) Loyalty Lab deixa de exigir gate humano fixo** —
passa a ter **score de automação determinístico** (`ancoragem` + `track_record`, corte
proposto **0,85**, piso gated, mesmo desenho do D-048). Dependência real mapeada: o
`track_record` vem do **Predict Ledger** (REQ-24/M4.3), que **não existe** (zero tabela,
zero código) e precisaria de extensão própria para claims narrativas (não só
probabilidade numérica). **Registrada como dívida, não bloqueio** — `track_record=0`
sem Ledger é o caso-limite da fórmula, então Loyalty Lab **continua sempre em revisão
humana até M4.3 entregar o Ledger**, sem branch hardcoded separado. **(4) TIER 2 sobe de
importância** para os blocos narrativos (Clipping/Resumo do dia/Loyalty Lab podem puxar
de `news_raw`/`campaigns tier=2`, sem os 3 portões nem o corte de veredito) — Deal Desk
continua **exclusivo de TIER 1**. INV-01 (fonte+data) vale em todos os blocos; a barra
que cai é só a de corroboração TIER 1. **2 decisões nomeadas seguem abertas** (posição
exata do Clipping na ordem; valor final do corte 0,85) — propostas default já registradas
em `SPEC-SLICE-DIGEST-ENGINE.md` §4, não bloqueiam a construção.

## D-054 — Fecha as decisões nomeadas do Digest Engine e da Coleta TIER 1 em Produção; coleta TIER 1 DEPLOYADA
**Data:** 2026-07-17 · **Status:** Aprovada e aplicada · **Milestone:** M2
Ratifica as últimas decisões nomeadas de `SPEC-SLICE-DIGEST-ENGINE.md` §4 e
`SPEC-SLICE-COLETA-TIER1-PRODUCAO.md` §2, e registra o deploy real. **Digest Engine:**
Clipping é seção própria, posicionada logo após Resumo do dia (ordem final: Resumo do
dia → Clipping → Radar → Radar VPM → Sinais rápidos → Loyalty Lab); corte do score de
automação do Loyalty Lab = **0,85** (fecha D-053). **Coleta TIER 1 em Produção:** limiar
de confiança **0,75**; cron a cada **6h**; novo override `refutado_tier1` para
refutação firme (D-049); **TAP fica fora da cobertura desta rodada** (sem adapter de
sitemap fechado — registrado, não bloqueia, cobertura real = 3 de 4 programas listados).
**Deployado e provado ao vivo nesta rodada:** edge function `coleta-tier1` (version 1,
ACTIVE, `verify_jwt=false`), `pg_cron` a cada 6h (`coleta-tier1-6h`, jobid 30). Invoke de
prova: HTTP 200, `candidatos_no_banco:0` — bate exatamente com a medição prévia (zero das
17 vivas crawleáveis cruza o piso de valor 70 hoje); run logado em `runs`. **Achado ao
construir:** o golden já travado de `decisaoNoLimiar` (`coleta-tier1.test.mjs`) mostra que
`corrobora_com_ajuste` vai **sempre** a revisão humana, mesmo com confiança 1,0 — o plano
de gravação (`gravacao-tier1.mjs`) respeita esse comportamento já testado em vez de
reescrevê-lo (D-043, dado/código vence resumo de spec).

## D-055 — Digest Engine construído e integrado; gate 5.5 rodado de verdade nos dois casos (evidência)
**Data:** 2026-07-17 · **Status:** Aprovada e aplicada · **Milestone:** M2 (fecho)
Fecha a construção do Digest Engine (D-052/D-053/D-054) e prova o gate 5.5 contra dados
reais, não só golden sintético. **Construído em `v2/lib/digest/`:** `mapear-contrato.mjs`
(tradução veredito+scoreBreakdown, sem fallback silencioso), `selecionar.mjs` (3 portões +
corte de Deal Desk + cap 3 com `cortados` reportado + Fecha Logo), `dia-fraco.mjs`
(Clipping/Radar/Radar VPM/Sinais rápidos + `scoreAutomacaoLoyaltyLab` corte 0,85),
`gate-5-5.mjs` (`checkComuns`/`checkComDealDesk`/`checkSemDealDesk`). `renderer/email.mjs`
realinhado ao schema patchado (camelCase, 6 seções novas, omissão real de Deal Desk via
marcador HTML `<!--section:deal-desk-->`, não string de prosa). `content/edition.schema.json`
recebeu o patch aditivo (scoreBreakdown 4 componentes + `contaFeita`/`oQueEvitar`/
`resumoDoDia`/`clipping`/`loyaltyLab`/`sinaisRapidos`). 178/178 testes verdes
(`v2/lib/digest/*.test.mjs` + `renderer/email.test.mjs` + `v2/lib/score.test.mjs`/
`derivacao.test.mjs`, sem regressão).

**Gate 5.5 rodado de verdade (não só fixture) — dois casos:**
1. **Sem Deal Desk, dados reais do banco vivo hoje (56 campanhas vivas via SQL direto):**
   `selecionarDealDesk` recomputado ao vivo confirma **0 elegíveis** (único TIER 1 confirmado,
   `smiles-desconhecido-compra-2026-07-17`, bruto 55 "Só para casos específicos", abaixo do
   corte). `runGate55` contra o HTML renderizado de `renderer/examples/dia-fraco.json` (que já
   espelhava esse estado real) → **PASS**, zero erros.
2. **Com Deal Desk, fixture `illustrative:true` (`dia-forte.json`) + campanhas sintéticas
   espelhando os 3 deals** (routeKey/tl_score_bruto/veredito_bruto): primeira rodada
   **achou 3 problemas reais de autoria** na fixture (não do gate) — `oQueEvitar` continha
   "corre risco" (colide com `URGENCY_RE`, falso-positivo textual do termo banido "corre"),
   `signal`/`resumoDoDia` sem dígito (checagem estrutural INV-03). Fixture corrigida
   (reescrita sem o termo, números concretos adicionados) → **PASS**, zero erros. Também
   corrigido nesta rodada: `contaFeita` da fixture não batia literalmente com `deals[0].conta`
   (falha do check de rastreabilidade) e o segundo deal não tinha `routeKey` — ambos
   ajustados para refletir a convenção real de dados (routeKey `origem->destino`, `contaFeita`
   idêntico ao deal de origem).
**Achado do processo:** o gate 5.5 pegou 3 gaps de autoria reais numa fixture marcada
illustrative — evidência de que ele funciona como auditoria independente, não decorativa.

## D-056 — Primeiro rascunho do Daily criado no Beehiiv (draft, sem envio); contagem dos 5 dias NÃO iniciada
**Data:** 2026-07-17 · **Status:** Aplicada · **Milestone:** M2 (fecho)
Fecha o passo serializado 3 do dispatch de fechamento do M2: primeiro post do The Loyal
Daily criado no Beehiiv **como rascunho**, para validação visual da marca antes de
qualquer disparo real (salvaguarda S2-D1). **Conteúdo é dado real, não fixture:**
edição nº 1, 2026-07-17, montada a partir do estado vivo do banco no momento (56
candidatos vivos via SQL direto, 1 TIER 1 confirmado — `smiles-desconhecido-compra-
2026-07-17`, bruto 55, "Só para casos específicos" — recomputado com
`selecionarDealDesk`/`selecionarFechaLogo` reais). Clipping (6 itens) vem de linhas reais de
`news_raw` (fontes `passageirodeprimeira`/`pontospravoar`, tier 2 confirmado em
`news_sources`), com resumo próprio (nunca copiado) e tom neutro (revisado para não colidir
com `URGENCY_RE`). **Resumo do dia e Loyalty Lab foram OMITIDOS de propósito** — não havia
dado real o bastante para uma narrativa sem fabricar tendência (regra-mãe "seção sem dado
real = omitida"); ficam como próxima rodada de curadoria, não bloqueio. Gate 5.5 rodado
contra o HTML renderizado desta edição real → **PASS**, zero erros (`v2/lib/digest/gate-
5-5.mjs`). Artefato salvo em `content/editions/0001.json`.
**Beehiiv:** `save_post` criado — `post_f7b2c959-8dcf-46e0-864d-f26b162a68f7`, status
`draft`, `scheduled_at: null`, audiência default (free, ambos os canais), zero destinatário
notificado. Dialeto Tiptap (`v2/lib/digest/render-beehiiv.mjs`) — sem `<table>`, sem
inline `style` fora de `span`, sem emoji, amarelo só em borda/fill (nunca texto), verde de
texto sempre `#00A878`. **Link do editor:** `https://app.beehiiv.com/posts/f7b2c959-8dcf-
46e0-864d-f26b162a68f7/edit`. **Draft público:** `https://theloyal.beehiiv.com/p/hoje-
nenhuma-oferta-passou-do-corte-e-aqui-esta-a-conta?draft=true`.
**Travas respeitadas:** auto-publish continua DESLIGADO; a contagem dos 5 dias úteis de
aprovação (D-050 decisão 3) **NÃO foi iniciada** — fica para o operador decidir quando o
rascunho estiver aprovado, por instrução explícita do dispatch. Nenhum e-mail foi enviado,
nenhum assinante foi notificado.

## D-057 — Digest Engine v3: revisão estrutural ratificada (Ofertas ativas, Vence 72h, Cartões & bancos, O que fechou, Predict; Radar VPM e Loyalty Lab como blocos próprios)
**Data:** 2026-07-17 · **Status:** Aprovada · **Milestone:** M2 (revisão de contrato)
Ratifica as 8 decisões nomeadas do §5 de `SPEC-SLICE-DIGEST-ENGINE.md` v3 (commit
`500389f`). **Decisões 1–6, propostas default aprovadas como estavam:** (1) rótulo da
coluna "Leitura" em Ofertas ativas = vocabulário canônico de veredito (`Vale agir`/`Vale
olhar`/`Só para casos específicos`/`Esperaria`/`Evitaria`), não um segundo vocabulário
paralelo; (2) Cartões & bancos aceita TIER 2 (evergreen, sem corte de veredito); (3) lista
curada de bancos por `origem_code` (itau/inter/c6/bradesco/banco_do_brasil/nubank/caixa/
brb/santander/btg/xp/picpay); (4) cadência do Predict = `confidence='alta'` em
`digest.radarDaily`, orientada a dado, não calendário fixo; (5) Resumo do dia funde com
Sinal do dia (2 parágrafos, uma seção); (6) Radar (janelas) migra para dentro do teaser
Predict. **Decisões 7–8, sem proposta default, resolvidas agora pelo operador:** (7)
**Radar VPM vira seção própria** (não funde em Cartões & bancos, não corta — mesma fonte
`shopping_metrics`, `selecionarRadarVpm` já existente, sem mudança de lógica); (8)
**Loyalty Lab continua bloco narrativo separado**, corte de automação **0,85** inalterado
(D-053, `scoreAutomacaoLoyaltyLab`/`precisaRevisaoHumana` já existentes, sem mudança).
**Estrutura final da edição (ordem):** Sinal do dia (com Resumo fundido) → Ofertas ativas
(tabela) → Deals do dia (numerado, `contaProsa`/`leitura` aditivos) → Vence em até 72h
(renomeação de Fecha Logo) → Cartões & bancos → Clipping → O que fechou nesta semana →
Radar VPM → Loyalty Lab → Predict. **Ordem de Radar VPM/Loyalty Lab/Predict na cauda é
call editorial dentro do escopo já aprovado** (não redecidida pelo operador nesta
rodada) — mantém a lógica de "observacional/analítico antes do teaser final" do
sequenciamento anterior (D-053/D-054). **Modo: build aprovado — spec fecha aqui, próxima
entrada em DECISIONS.md é o resultado do código.**

## D-058 — Digest Engine v3 construído e integrado; gate 5.5 PASS nos dois casos; rascunho no Beehiiv reconstruído
**Data:** 2026-07-17 · **Status:** Aprovada e aplicada · **Milestone:** M2 (fecho)
Fecha a construção de D-057 em código. **Construído em `v2/lib/digest/`:**
`ofertas-ativas.mjs` (`selecionarOfertasAtivas` reusa `passaTresPortoes` sem corte de
veredito; `selecionarCartoesBancos` + `BANCOS_ORIGEM`), `dia-fraco.mjs` ganha
`selecionarFechouSemana` (encerrada+TIER1+conta computável, janela 7d, sem cálculo) e
`selecionarPredict`/`formatarTeaserPredict` (nunca revela valor/janela, só contagem),
`gate-5-5.mjs` ganha `checkOfertasAtivas`/`checkCartoesBancos`/`checkFechouSemana`/
`checkPredict`/`checkContaProsa` — todos rodando sempre, independente de Deals do dia.
`content/edition.schema.json` recebeu o patch aditivo (`ofertasAtivas`, `cartoesBancos`,
`oQueFechouSemana`, `predict`, `deal.contaProsa`/`deal.leitura`). Renderers (`email.mjs` +
`render-beehiiv.mjs`) restruturados pra ordem D-057; Radar (janelas) e Sinais rápidos
saem do render (absorvidos por Predict/Ofertas ativas — as funções que os geravam
continuam testadas, só não são mais chamadas pelo renderer). 513/515 testes verdes (2
fails pré-existentes, não relacionados).

**Edição nº 1 remontada com dado 100% real** (SQL direto no momento da montagem, não
fixture): Ofertas ativas com o único TIER1 confirmado hoje (`smiles`, bruto 55); Cartões
& bancos com os 7 itens reais vivos (5 cartão + 2 transferência-banco); O que fechou
nesta semana com 6 dos 7 itens reais encerrados nos últimos 7 dias (1 duplicata exata
descartada por curadoria editorial — mesmo par origem/destino/% duas vezes seria ruído,
não erro de dado). Predict, Loyalty Lab e Radar VPM **omitidos** — sem dado real
suficiente hoje para uma narrativa sem fabricar tendência (regra-mãe). Salva em
`content/editions/0001.json`.

**Gate 5.5 rodado de verdade nos dois casos com a estrutura v3:**
1. **Sem Deals do dia, dado real** (63 campanhas — 56 vivas + 7 encerradas via SQL
   direto) → **PASS**, zero erros.
2. **Com Deals do dia, fixture `illustrative:true` + campanhas sintéticas** cobrindo
   todos os blocos novos (ofertasAtivas, deals via routeKey, cartoesBancos,
   oQueFechouSemana) → **PASS**, zero erros, depois de 2 rodadas de correção (uma
   campanha sintética sem `tipo`, um `encerrouEm`/`vigencia_fim` com componente de hora
   que não batia string-a-string).

**Beehiiv:** rascunho existente (`post_f7b2c959-8dcf-46e0-864d-f26b162a68f7`)
**atualizado no lugar** via `edit_post_content` (doc replace) + `edit_post` (subtítulo/
preheader sincronizados com o rename "Deals do dia") — não criado um segundo post.
Continua `status: draft`, `scheduled_at: null`, zero destinatário notificado.
**Editor:** `https://app.beehiiv.com/posts/f7b2c959-8dcf-46e0-864d-f26b162a68f7/edit`.
**Preview:** `https://theloyal.beehiiv.com/p/hoje-nenhuma-oferta-passou-do-corte-e-aqui-esta-a-conta?draft=true`.
Auto-publish continua desligado; contagem dos 5 dias úteis **não iniciada**.

## D-059 — Benchmark milhasbot: análise por promoção vai para M3; diagnóstico de cobertura (3 promoções vivas, 2 enterradas por bug de vigência); Predict com probabilidade sempre visível
**Data:** 2026-07-17 · **Status:** Registrada (correções de dado aguardam aprovação) · **Milestone:** M2 (editorial) / M3 (roadmap)
Rodada de refinamento editorial do rascunho nº 1 guiada por benchmark externo
(milhasbot.com.br) colado pelo operador. Três desdobramentos:

**(1) Roadmap M3 — "Ver análise" por promoção + histórico por programa.** O benchmark
oferece página de análise individual por promoção (com a conta, contexto do regulamento,
limitações — ex.: teto de 300k pontos, crédito em 15 dias úteis) e um placar histórico
por programa (`/promocoes/`). O operador mandou colocar essa construção em M3/M4:
**registrado como slice de M3**, encaixando no que já existe — D-046 (track record como
arquivo público) e as páginas públicas do M3. Cada campanha ganha página própria com a
conta feita, o TL Score explicado e o histórico da rota; o Daily linka "Ver análise" por
item. Não construir agora.

**(2) Diagnóstico de cobertura — o benchmark mostrou 3 ofertas vivas; TODAS já estavam
no nosso banco, mas 2 invisíveis por bug de dado:**
- `bancodobrasilnenhum,banco do nordeste-azul-transferencia-2024-07-17` (BNB→Azul até
  110%): vigência parseada como **2024**-07-17 quando a matéria é de 2026 (classe de bug
  do D-021 — inferência de ano em registro de extração LLM antigo) → FSM derivou
  `historica` e o item sumiu do radar vivo. Identidade também malformada (origem_bruto
  duplo). A oferta REAL vence 17/07/**2026**.
- `flyingblue-*-compra-na` (Flying Blue 45% OFF): vigência não extraída (`na`) → estado
  `indeterminada`, fora do filtro vivo. Matéria indica validade até 28/07/2026.
- `livelo-hilton-hotelaria-2026-07-31` (50%, TL 65): viva e visível — a falha aqui foi
  **editorial** (não citada na primeira versão do rascunho).
**Correções de dado propostas (NÃO aplicadas — regravação em produção espera aprovação
do operador):** (a) 2× livelo-aliexpress: tipo `compra`→acúmulo em parceiro + revisão de
nota (o "25%" é na verdade "25 pontos/dólar"); (b) bradesco-livelo: é sorteio, não
transferência; (c) caixa-cartao: "100%" é cashback de IOF (benefício de tarifa, candidata
a `nao_campanha` via D-018); (d) bb-smiles-cartao: fonte linkada não sustenta o "5,5
milhas/dólar" — item removido do rascunho e campanha para revisão; (e) bnb-azul 2026:
corrigir vigência 2024→2026 + identidade + rescorar; (f) flyingblue compra: vigência
28/07/2026 + dedup dos 2 registros. **Aprendizado de guardrail (aplicado no editorial
imediatamente):** item de confiança baixa/não confirmado nunca é citado com número como
"melhor do dia" sem link da fonte + status explícito — e número que a fonte linkada não
sustenta sai da peça (caso BB Ourocard).

**(1b) Benchmark-alvo detalhado (screencapture completo de /promocoes, colado pelo
operador):** a página combina (i) barra de status viva ("AGORA · N bônus ativos · 1
vence amanhã · Verificado em [data]"); (ii) tabela de ativos com Rota | Bônus (faixa,
não só teto) | Milheiro | Vence | link "Ver análise"; (iii) **Placar histórico por
rota** — por programa-destino, tabela DE | teto histórico (com mês/ano) | mediana |
nº de registros; (iv) **Banco de dados por programa** — chips de média/mediana/teto/
melhor-do-ano/nº de registros + parágrafo-síntese + histórico completo datado com
veredito por linha. **Nosso equivalente:** mesma estrutura alimentada por `campaigns`
(histórico já canonicalizado) + `content/forecast.json` (janelas previstas com
probabilidade baixa/média/alta — nosso diferencial vs. o benchmark, que só olha para
trás). **Adaptações de marca obrigatórias:** zero emoji (o benchmark usa 👍/🏆 — nós
usamos o vocabulário TL com cor semântica), números em JetBrains Mono, veredito pela
régua TL, não "Boa/Fraca" ad-hoc. Página atualizável (dado vivo, não lista manual) —
alvo de M3 junto com o "Ver análise" por promoção.

**(3) Predict — probabilidade sempre visível (venda orgânica).** Refinamento do operador
sobre a proposta anterior: além da linha de cenário quando houver janela prevista, o
editorial cita o Predict **mesmo quando a probabilidade é baixa/indefinida** — ex.: "o
radar acompanha Esfera→Smiles (histórico típico ~70% de bônus), mas ainda não há base
para prever a próxima janela; sem promoção à vista, a compra vale pelo que é hoje (TL
63)". Mostra o poder da ferramenta nos dois sentidos e explica a nota. Rótulos:
probabilidade **baixa/média/alta** por rota. A seção Predict formal (contagem de janelas
alta-confiança) continua como em D-057; esta é a camada narrativa no corpo editorial.
Aplicado no rascunho de hoje com dado real do forecast (`esfera→smiles`, typicalPercent
70, confidence `em-formacao`). TL Score determinístico permanece intocado — a
probabilidade explica a nota, nunca a altera.

## D-060 — 6 correções de dado APLICADAS em produção + verificação pré-publicação construída
**Data:** 2026-07-17 · **Status:** Aplicada · **Milestone:** M2 (fecho)
Gate do operador executado: as 6 correções de D-059 gravadas em produção, com trilha
completa em `campanha_versoes` (9 eventos `correcao_d060_*`, payload antes/depois em cada
um). Antes→depois:
1. **AliExpress ×2** (`livelo-aliexpress-compra-2026-07-{21,23}`): tipo `compra`→
   `shopping`, percentual 25→null (era "25 pontos/dólar", não 25%), bruto 60→null,
   veredito → "Não confirmado" via `conta_nao_calculavel` (D-050.1). Rescore em revisão.
2. **Caixa** (`caixa-desconhecido-cartao-2027-12-31`): percentual 100→null (cashback de
   IOF = tarifa, não bônus de pontos), bruto 50→null, cnc; candidata a `nao_campanha`
   via D-018 — decisão humana pendente.
3. **Bradesco→Livelo**: tipo `transferencia`→`sorteio`.
4. **BB Ourocard** (`bb-smiles-cartao-2026-12-31`): fonte linkada não sustenta o "5,5
   milhas/dólar" → fila de revisão (identidade_id=NULL, convenção D-041; uuid anterior
   preservado em notes/trilha).
5. **BNB→Azul**: vigência **2024-07-17→2026-07-17** (bug de inferência de ano), estado
   `historica`→`ultimos_dias` (vence hoje), codes normalizados `bnb`→`azul_fidelidade`,
   `discard_reason` obsoleto ("vigencia encerrada em 2024") removido. Identidade e
   rescore pendentes de revisão. **A oferta mais quente do dia voltou ao radar.**
6. **Flying Blue**: canônica (`flyingblue-flyingblue-compra-na`) ganhou vigência
   extraída da matéria (28/07/2026), `indeterminada`→`detectada`; duplicata
   (`flyingblue-desconhecido-compra-na`) consolidada (`discard_reason=
   duplicado_consolidado_d060`, identidade→revisão).

**Verificação pré-publicação** (`v2/lib/verificacao/pre-superficie.mjs`, 11/11 testes):
roda antes de QUALQUER superfície editorial (Digest + radar de ativos + M3). Checks —
todos **flag para revisão, nunca descarte** (instrução explícita do operador: melhor
mandar item bom pra revisão que sumir com promoção real): (a) `vigencia_bug_ano`
(vigência >180d antes do first_seen — padrão BNB) e `valor_sem_data` (conta fechada sem
vigência — padrão Flying Blue); (b) tipo suspeito: `acumulo_em_parceiro` (paridade
"por dólar/real" com tipo compra/transferência — AliExpress), `sorteio` (Bradesco),
`beneficio_tarifa` (IOF/anuidade com percentual — Caixa); (c)
`confianca_baixa_para_destaque` (nota ≥60 com `[confianca:baixa]` — bloqueia
headline/"melhor do dia", não remove da listagem). **Caso BB (número ausente da fonte)
documentado como NÃO automatizável por heurística local — dono é a corroboração de
termos TIER 1 (D-045).**

**Medição histórica (volume de revisão):** nas **58 vivas** hoje, pós-correções: **0**
flags estruturais e **2** bloqueios de destaque (`flyingblue-flyingblue` 65 e
`costa_cruzeiros` 60 — ambos confiança baixa; 35/58 vivas são confiança baixa no total,
mas só essas 2 cruzam o limiar de destaque). No backlog histórico completo (3.632, quase
todo ingerido retroativamente nesta semana): ~1,6–1,9k bateriam o check de bug-de-ano
(ingestão retroativa de campanhas já vencidas — sem ação, o FSM já as trata como
históricas), 554 valor-sem-data, 40 tipo-suspeito, 119 confiança-baixa≥70. **Volume
operacional projetado: ~0 a poucas unidades/dia** — administrável. Integração da
passada no pipeline vivo (ingest + montagem) entra junto com o backport v4 em curso.

## D-061 — P2 aplicado (teto de sanidade de percentual por tipo) + Caixa reclassificada para só-Clipping
**Data:** 2026-07-17 · **Status:** Aplicada · **Milestone:** M2
**(1) P2 — teto de sanidade "ghosts" (espelha D-041 R5, teto por tipo):** flag de revisão
em `percentual` acima do teto — **200 para os tipos gerais** (transferência/cartão/
hotelaria..., onde bônus real raramente passa de 130) e **piso 300 para compra/clube**
(onde 300–375% são reais — a própria Smiles 375 TIER1). Aplicado em produção:
**193 campanhas flagadas** (164 compra/clube >300, 29 demais >200; ghosts típicos:
cartões com "120.000%" = pontos de boas-vindas lidos como percentual), trilha 1:1 em
`campanha_versoes` (`flag_p2_teto_sanidade`; um lote de trilha duplicado por engano meu
foi removido — 193 eventos finais). **Nada reclassificado automaticamente**: flag manda
para revisão e tira da ECDF no próximo rescore; item real flagado (ex. Smiles 375)
continua publicável. Check permanente `checkSanidadePercentual` em
`v2/lib/verificacao/pre-superficie.mjs` (12/12 testes). Interpretação registrada do
"percentual>200 (piso 300)": teto por tipo — se o operador quis outra leitura, corrigir
aqui.
**(2) Caixa (D-060) — só Clipping:** `used_in=["clipping_only"]` + nota na campanha
(trilha `d061_caixa_so_clipping`). Efeito no rascunho: a Caixa ESTAVA visível na seção
"Cartões e bancos" — removida de lá e movida para o Clipping com link da fonte e o
enquadramento "benefício de tarifa do cartão (cashback do IOF), não acúmulo de pontos —
fora da régua TL". `content/editions/0001.json` atualizado (JSON canônico → rascunho
regenerado por bloco). Clipping foi de 6 para 7 itens; validate e 191/191 verdes.

## D-062 — Rascunho nº 1 (layout v4.1) aprovado visualmente pelo operador
**Data:** 2026-07-17 · **Status:** Aplicada · **Milestone:** M2
Após a rodada v4.1 (Ofertas ativas em cards empilhados — nunca `columns`, que
quebrava no parse do Beehiiv e vazava o milheiro da margem; itens sem confirmação
na MESMA seção com selo "AGUARDANDO CONFIRMAÇÃO OFICIAL" + fonte linkada; bloco
"No radar" removido do Sinal do dia), o operador respondeu **"aprovado"** — lido
como a **aprovação visual final do rascunho da edição nº 1**
(`post_f7b2c959`, status draft). O que NÃO muda com esta aprovação:
**auto-publish continua desligado** e a **contagem dos 5 dias úteis é decisão
do operador** — não inicia sozinha (regra de sessão reafirmada).
**P2 (D-061):** a evidência da premissa incorreta foi apresentada (a Smiles 375
FOI flagada — 375 > 300; ~164 flags compra/clube incluem compras reais 350–375).
O teto permanece no estado vigente `{compra: 300, clube: 300, padrao: 200}`
(opção A — manter). Se o operador quis a opção B (teto 400 para compra/clube,
banda real passa limpa e ghosts 400+ continuam flagados), corrigir aqui.

## D-063 — M2.5: painel de custo LLM (llm_jobs + model_registry), emissores instrumentados

Slice `SPEC-SLICE-PAINEL-CUSTO-LLM.md` executada. **Schema aditivo** (migration
`015_llm_jobs.sql`, aplicada): `llm_jobs` (ledger de telemetria — tokens/latência/
status por chamada; `custo_usd` fica NULL no insert) e `model_registry` (modelo +
preço por 1k tokens por estágio). **SEM seed de preço** (INV-03): `model_registry`
nasce vazia; preço real é INSERT a aprovar depois com fonte+data (mesmo padrão de
`custo_base_moeda`/011). Índice de dia ancorado em UTC (`(criado_em at time zone
'UTC')::date`) porque `timestamptz::date` não é IMMUTABLE.

**Custo é derivado no painel, não no emissor** (INV-12): `custoUsd(tokens, preço)`
em `v2/lib/painel-custo-llm.mjs`. Preço ausente OU tokens ausentes ⇒ custo **null**,
nunca 0 coagido (0 mentiria "de graça"). Golden `painel-custo-llm.test.mjs` (12
casos) cobre a regra. Painel = `agregarPorDiaEstagio` (espelho da consulta §4) +
relatório de terminal `scripts/painel-custo-llm.mjs` (`npm run painel:custo`); UI
React fica como próximo passo (spec §7).

**Emissores reais instrumentados** (antes: radar tinha ZERO telemetria de custo):
- `scripts/collect/llm.mjs` — `sameProduct`/`classifyPromo`/`extractListing` gravam
  `radar_vpm_match`/`_promo`/`_extracao` via `llm-ledger.mjs` (mock-safe; modo mock
  não gera job — sem token real, INV-03).
- Edge fn `campaigns` (extração) — **deployada v16** (era v15): grava
  `extracao_campanhas` por notícia, aditivo e não-bloqueante (falha no ledger não
  derruba extração). Cron `extract-2h` passa a popular `llm_jobs` a cada rodada.

**Meta de custo por edição = PENDENTE, não fabricada** (spec §5, INV-03): nenhum
dos estágios roda *por causa* de uma edição — extração e Radar VPM são coleta
contínua, e o Digest Engine (única peça que gastaria LLM por edição) não existe.
Custo marginal de uma edição hoje ≈ R$0 (nada gasta por causa dela). Além disso, o
custo em USD dos estágios existentes é hoje **não confirmado** — `model_registry`
sem preço aprovado. Revisitar quando o Digest Engine especificar suas chamadas.

## D-064 — Track A (M2.7 pipeline) + naming: A1–A4 construídos, Track B bloqueado
**Data:** 2026-07-17 · **Status:** Aplicada · **Milestone:** M2 (fechamento)

**A1 — pré-superfície no pipeline vivo.** `v2/lib/verificacao/integrar.mjs`
(`anotarRevisao`) liga a verificação D-060/D-061 ao ingest: cada candidato passa
pelos checks ANTES de qualquer estado publicável; flag nunca descarta nem
reclassifica — grava trilha `campanha_versoes` (`evento='flag_pre_superficie'`,
`payload_antes=null`) e alimenta a fila. Wired em `rodar-producao.mjs` (idempotente
por dia). Prova sobre os 58 vivos reais: **55 limpos, 3 revisão** (Smiles 375 P2 +
flyingblue 65 e costa_cruzeiros 60 confiança-baixa); trilha gravada e idempotente;
os 3 seguem vivos. Golden `integrar.test.mjs` (BNB reintroduzido: marcado, não
enterrado, devolvido byte-a-byte).

**A2 — runner diário `npm run daily`.** `scripts/daily.mjs` ponta a ponta:
resolve edição → verifica (fila de revisão) → render → **gate único** → rascunho
**draft-only idempotente por data** (ledger `content/daily-status.json`), NUNCA
envia. Sem creds Beehiiv/Supabase → mock/`--campaigns` snapshot. Agendamento
`.github/workflows/daily.yml` (`workflow_dispatch` + `schedule` COMENTADO a 09:30
UTC/06:30 BRT seg-sex — só o operador liga, honrando "não inicia a contagem
sozinho"). Execução autônoma provada (edição nº1, snapshot real, gate VERDE,
2ª execução = noop). Achado do próprio runner: `ofertasAtivas` guardava o display
`smiles→smiles`; alinhado ao código canônico `smiles→sem_destino` (rotaDisplay
segue mostrando "Smiles → Smiles").

**A3 — gate único bloqueante (M2.4).** `v2/lib/gate-unico.mjs` `gate(edition,ctx)`
encadeia schema (`scripts/validate`) → dado (`pre-superficie`, NÃO bloqueia — flag
é revisão, D-060) → editorial (`gate-5-5`), DELEGANDO (goldens dos módulos seguem
autoridade). Golden `gate-unico.test.mjs` (7 casos). Suíte não-react **verde**
(428) + painel 12; as 3 falhas remanescentes (`react` ausente no container) são
ambientais, não regressão.

**A4 — aprovação de 1 clique + fila de revisão.** Runner emite
`out/daily/NNNN-revisao.md` (itens flagados, motivo, dados) que o operador vê
ANTES de aprovar. Desenho para ratificação em `v2/M2/DESENHO-APROVACAO-1-CLIQUE.md`:
recomenda o workflow `Beehiiv Publish` (`confirm: PUBLICAR`) como o "1 clique"
oficial — separa rascunho automático (draft-only) do envio humano; auto-publish
impossível por acidente.

**Track B (6 segmentos Beehiiv) — BLOQUEADO, correto (INV-03 / regra 9).** Os 6
nomes existem (`iniciante | emissao planejada | heavy user | alta renda |
completar saldo | cashback first`, D-008), mas o CRITÉRIO (`where` DSL) não existe
e não é construível: sem `custom_field` `perfil` e sem mecanismo de captura. Já
registrado como blocker aberto na spec (SPEC-SLICE-VERIFICACAO-BEEHIIV-MCP §3/§5).
**Sub-decisão de produto do operador**: (a) criar o custom_field `perfil` +
(b) definir a captura (quiz de onboarding). Nada criado (não se chuta segmento).

**Naming (Track D).** "The Loyal" é o nome próprio (CLAUDE.md). Corrigidos os leaks
de "The Loyalty" no wordmark do site (`components/Logo.tsx`), masthead do web
archive (`scripts/render-web.mjs`), media kit (`assets/logo/*`) e artefatos `out/*`;
golden `tests/brand.test.mjs` robusto a tag-split. "loyalty" substantivo comum e
nomes de arquivo de sistema preservados. Título/subject do rascunho Beehiiv
corrigidos via MCP para "The Loyal Daily".

**Estado do M2.** Slices de código do M2.7 (A1–A4) + M2.5 (D-063) fechadas e
verdes; naming alinhado. **Falta para o M2 fechar de fato:** (1) ratificar o
desenho de aprovação (A4); (2) resolver a sub-decisão de produto do Track B
(segmentos); (3) o operador **iniciar a contagem dos 5 dias úteis** (descomentar o
`schedule`) — decisão dele, não automática; (4) `DROP` do backup frio
`campaigns_bkp_prev2_20260716` — decisão consciente do operador no fecho, nunca
antes. Auto-publish permanece OFF.

## D-065 — 4 decisões do operador no fecho do M2 (auto-publish, segmentos, cadência, backup)
**Data:** 2026-07-17 · **Status:** Aplicada · **Milestone:** M2

**(1) Auto-publish com rating mínimo.** O operador liberou o envio automático,
condicionado a um mínimo — abaixo dele, 1 clique. Rating implementado como
**confiança de dado** (não a nota da oferta): edição é auto-elegível quando
**gate VERDE + fila de revisão VAZIA** (zero flags de pré-superfície, D-060).
Qualquer pendência → abaixo do mínimo → rascunho + 1 clique. `avaliarRating` em
`scripts/daily.mjs` (+ golden `daily.test.mjs`, 4 casos). Envio real só quando
`rating.auto && env TL_AUTOPUBLISH=on`, com **trava dura de reenvio** (uma vez
enviado no dia, nunca reenvia). Verificado: a edição nº1 (3 flags) fica em
rascunho mesmo com auto-publish ligado — o mínimo segura o que precisa de olho
humano. Kill-switch: `TL_AUTOPUBLISH=off`.

**(2) 6 segmentos Beehiiv — executado.** Criado o `custom_field` **perfil**
(list, id `3f809670-5eba-4a8b-8722-51d442e43ac4`) e os 6 segmentos dinâmicos
(iniciante / emissao planejada / heavy user / alta renda / completar saldo /
cashback first), cada um `custom_field(perfil)=valor AND status=active`. Existem
e nomeados (M2.7/D-008 satisfeito). Ficam com 0 membros até a **captura** popular
o campo — o mecanismo (quiz de onboarding) segue como peça de produto pendente,
fora deste passo.

**(3) Cadência iniciada, sem travar nada.** `schedule` do `daily.yml` LIGADO
(09:30 UTC / 06:30 BRT, seg-sex) + `TL_AUTOPUBLISH=on`. Edição limpa envia
sozinha; qualquer flag vira rascunho + 1 clique. "Vamos acompanhando" — nada é
bloqueado com base nisso; monitorar e ajustar o rating se necessário.

**(4) Backup frio — RETIDO (melhor decisão).** `campaigns_bkp_prev2_20260716`
**não** é dropado agora: ligar a cadência com auto-publish é justamente quando o
rollback importa. Mantido até a cadência automatizada provar estabilidade; o
`DROP` volta como decisão consciente depois, não neste momento.

## D-066 — M3 build (Trilhas B, W, P) sob permissão total do operador
**Data:** 2026-07-18 · **Status:** Aplicada · **Milestone:** M3

O operador setou goal explícito ("você já tem permissão para executar tudo"),
que **supersede** a trava "não construir W/P antes da ratificação". Adotei os
**defaults reversíveis** que eu mesmo propus nas 6 decisões nomeadas e construí.
Nada irreversível/externo: envio de Weekly permanece gated (como o Daily);
migrations/views são aditivas (DROP desfaz).

**Trilha B (build):** 3.641 campanhas classificadas (`limpo` 981, `revisao`
1.031, `historico_confirmado` 1.629), trilha 1:1 em `campanha_versoes`
(`evento='triagem_backlog_m3'`), SQL validado ≡ JS. Regra do carve-out
`historico_confirmado`: só-vigência-antiga em estado histórico/encerrado/vencido
(estado do FSM desempata o que o `vigencia_bug_ano` não distingue). Idempotente.

**Trilha W (build):** `v2/lib/weekly/revalidacao.mjs` —
`gateRevalidacaoVigencia(itensAtivos, {dataPublicacao, campaignsVivas})` revalida
todo item ativo contra o banco vivo na data de publicação (fecha a lacuna do
`weekly-consolidate.mjs`, que usava vigência congelada do JSON da Daily). Golden
T1–T7 (8 casos). `weekly.schema.json` estendido aditivamente. Decisões adotadas:
schema próprio aditivo (já era o repo); envio/segmentação ficam gated.
**Conflito registrado:** o Weekly já existia (schema+motor+DD-WEEKLY-001) — o
escopo real da M3.1 é o gate de revalidação, não recriar.

**Trilha P (build):** views `vw_placar_rota` (359 rotas) e `vw_banco_programa`
(137 programas) aplicadas (aditivas, consomem a triagem B: historico_confirmado
+ limpo). Página `app/promocoes/page.tsx` (server component lendo via
`lib/admin-db`, degrada para vazio) com 3 seções (ofertas ativas, placar
histórico por rota, banco por programa) nos componentes canônicos + Predict em
degradação graciosa ("sem previsão ainda", INV-03/25). Nav ganha "Promoções"
entre Método e Edições. Decisões adotadas: histórico/ativos públicos, Predict
banda pública (valor fino gated Pro), rota `/promocoes`. **Pendências
registradas (próximo slice):** "Ver análise" por oferta (P4, página de detalhe)
e o contrato de janelas do Predict (dispatch paralelo) — hoje degrada por falta
de janela `alta` no forecast, que é o caminho principal (D-050/D-051).

## D-067 — Ratificação das decisões nomeadas de W e P (M3)
**Data:** 2026-07-18 · **Status:** Aplicada · **Milestone:** M3
O operador **ratificou** as 6 decisões nomeadas das specs W e P (D-066); os
defaults sobre os quais o build foi feito ficam valendo:
- **Weekly (W):** (a) envio **sexta 09:00 BRT** (`America/Sao_Paulo`); (b) **envio
  único** pra base (segmentos com 0 membros até a captura, D-065); (c) **schema
  próprio aditivo** sobre `weekly.schema.json` (não estende o Daily).
- **/promocoes (P):** (a) histórico+ativos **públicos**, Predict em banda pública
  com **data/valor fino gated Pro**; (b) "Ver análise" **profundo** (8 blocos) com
  accordion como faseamento reversível; (c) rota **`/promocoes`** + item
  "Promoções" na Nav entre Método e Edições.
Como o #109 já mergeou o build de W e P sobre esses defaults, a ratificação
apenas trava o que está no ar — sem novo build.

## D-068 — M2.7: montagem de edição fresca do dia + fix de ordem do cron
**Data:** 2026-07-18 · **Status:** ✅ VERIFICADO (cron aplicado; montagem provada ao vivo) · **Milestone:** M2.7

**Evidência de verificação (replay + ao vivo):** replay de 2 dias reais distintos —
**07/14 forte** (Nº0002, 8 ofertas ativas) e **02/25 fraco** (Nº0002, 2 ofertas),
**ambos gate VERDE**, diferentes entre si e **nenhum repete a 0001**. Ao vivo:
runner `--now 2026-07-18` sobre snapshot real → **edição nº29 (≠0001), GATE VERDE**,
vigência-verdadeira; **idempotência confirmada** (2ª execução = 1 arquivo/data).
A verificação contra o banco vivo (não só fixtures) pegou e corrigiu 2 defeitos
reais: (i) `revalidarVigencia(asOf)` no boundary do runner — vencida antes da data
da edição vira 'encerrada' (montagem, pré-superfície e gate na mesma verdade),
mesmo com FSM stale; (ii) lint editorial passou a ignorar URLs (o "corre" de um
slug não é urgência). Suíte 173→verde (202 com validate/renderer).
Diagnóstico do "ingest seco" (leitura primeiro) concluiu **NENHUM (A/B)** — coleta
e extração saudáveis (último fetch 17/07 23:00 UTC, 0 pendentes, 0 erros, yield
~36%); a "seca" era o **backfill retroativo drenado** + madrugada BRT. Mas expôs
dois gargalos reais pro Daily ao vivo, ambos aprovados:
- **Fix de ordem do cron (APLICADO):** `ingest-0710` movido de `0 10 * * *`
  (10:00 UTC / 07:00 BRT, DEPOIS do Daily) para `0 9 * * *` (09:00 UTC / 06:00
  BRT), precedendo o Daily das 09:30 UTC com 30 min de margem. `cron.alter_job`
  no banco vivo + snapshot `v2/db/schema-atual.sql` atualizado. Único job entre
  09:00–09:30 UTC; nada dependia do horário antigo.
- **Montagem DB→edição do dia (BUILD, em verificação):** o runner `daily.mjs`
  renderizava um JSON estático (repetiria a mesma edição todo dia — causa real do
  "estreia repetindo"). Novo passo `montarEdicaoDoDia(asOf)` seleciona do banco
  vivo (reusando selecionar/ofertas-ativas/dia-fraco/editorial), monta uma edição
  NOVA por data (numeração idempotente, nunca reusa a 0001), encaixa ANTES do gate
  único no runner; dia fraco vira edição fraca válida. Provado por **replay** de
  ≥2 dias passados → edições distintas passando o gate. **Verificação contra o
  banco vivo feita por mim antes de tocar produção (ESCRITA UNICA).** Sem migration.
Nota de sequência: a contagem dos 5 dias segue com o operador e **só depois** de a
montagem provar edição fresca — não inicia sozinha.

## D-080 — Preflight de lançamento: kill-switch, triagem pública, boundaries e secrets (M2.7)
> **Numeração (faixa livre C4):** o canônico ia até D-068; a calibração ocupa
> D-066..D-070 (task de reconciliação #25, a aplicar no merge dos PRs #106/#107/#108).
> Para não colidir, o principal ancora em **D-080** — banda livre acima do bloco
> contestado. Uma ADR, partes A–F (estilo D-040).

Aprovada pelo operador (modo goal). Fecha os buracos que impediam o próximo cron
de sair correto: montaria edição estática, exporia dado não confirmado no site,
travaria dia limpo por item morto, montaria a data errada de noite, e não leria os
secrets. **Auto-publish permanece OFF em todo este plano** — a estreia é RECUSANDO
(D-050); tudo aqui gera RASCUNHO.

- **A — Kill-switch do auto-publish (`daily.yml`, step 0).** `TL_AUTOPUBLISH: "off"`.
  Toda rodada (schedule das 09:30 UTC ou manual) monta, passa o gate e para em
  RASCUNHO; o envio é decisão humana de 1 clique. Só o operador liga ("on") quando
  a calibração fechar os vetores (D-050). O cron segue ativo (queremos o rascunho
  diário), o gatilho de envio é que fica desarmado.
- **B — Triagem obrigatória na superfície PÚBLICA (`vw_ofertas_vivas`, migration 017, C3).**
  A `/promocoes` lia `campaigns` direto (estado vivo + percentual) **sem** o filtro
  de triagem da Trilha B — surfacializava, por percentual e no topo, itens `revisao`
  (bônus alto não confirmado) e **não-triados** (INV-03). Nova view expõe só
  `limpo`/`historico_confirmado` (JOIN LATERAL inner sobre `campanha_versoes`
  evento=`triagem_backlog_m3`); não-triado e `revisao` ficam de fora. A página passa
  a ler a view. **Prova:** antes, o top-5 público trazia 2 não-triados (hilton 100%,
  flyingblue 80%); depois, `removidos_nao_confirmados=4` (2 não-triado + 2 revisao),
  top todo `limpo`. Nada é reclassificado no banco — a view só ESCONDE do público o
  não confirmado (D-060: flag é revisão, não some).
- **C — Fila de revisão = só VIVOS, fonte única (`filtrarVivos`, M8).** O fetch do
  runner traz mortas (`encerrada∧tier1`, para o recap "O que fechou"). O gate rodava
  a pré-superfície sobre TODAS as linhas → um flag numa MORTA entrava em
  `veredito.revisao` e **travava o auto-publish de um dia limpo**. `ESTADOS_VIVOS` +
  `filtrarVivos` (exportados de `montar-edicao`) viram a fonte única que o gate (camada
  de dado) e o runner (fila-artefato) partilham. **Prova (teste):** flag numa morta
  não infla a fila nem muda o rating; flag numa VIVA continua entrando (o filtro não
  é cego).
- **D — `hoje` no fuso America/Sao_Paulo em todo boundary (`hojeSaoPaulo`, M9).** O
  runner derivava `hoje` em UTC; rodada 21h–23h59 BRT cairia no DIA SEGUINTE,
  montando edição/ledger/gate da data errada. `hojeSaoPaulo()` (Intl `en-CA`,
  timeZone São Paulo) na origem única do `hoje` do Daily e do passo de síntese;
  montagem/gate/ledger herdam por parâmetro. **Prova (teste):** timestamp
  `2026-07-20T01:00:00Z` (= 22h BRT do dia 19) → `hoje` BRT = **2026-07-19**, não o
  UTC 20.
- **E — Preflight de secrets (`daily.yml`, step 5).** Os secrets Beehiiv/Supabase são
  **environment secrets** (escopo Production); sem `environment: Production` no job,
  ele não os lê e cai em mock. Declarado. E o nome real do secret é
  **`SUPABASE_SERVICE_KEY`** (não `_ROLE_KEY`) — o yml passa esse nome (o runner já
  aceitava os dois). **Prova:** com o environment declarado, o `workflow_dispatch`
  loga "modo real" e gera RASCUNHO (autopublish off → não envia).
- **F — Testes do v2 entram no CI (`test:v2`).** O job `test` do CI rodava só
  `tests/*.test.mjs`; a suíte pura do v2 (engine/gate/montagem/síntese + os boundaries
  M8/M9) ficava fora — provas que não guardavam. Novo `npm run test:v2` no CI. Árvore
  inteira **441/441 verde**. **Prova de fecho (runner default):** `daily.mjs --now
  2026-07-14` (sem `--edition`) montou **edição nº29 nova** (≠ 0001/0028), GATE VERDE,
  única pendência = uma oferta VIVA legítima (revolut 400%), autopublish off → rascunho.

## D-081 — A5: anti-cópia em produção + Clipping ligado com síntese própria
**Data:** 2026-07-18 · **Status:** Aplicada · **Milestone:** M2.7 · **Origem:** auditoria A5 (cópia em resumos LLM)

A regra inviolável 2 (nunca copiar texto/título da fonte) estava sem crivo em
produção: 20,5% (747/3.643) dos `resumos` de extração em `campaigns.notes` eram
**cópia verbatim** da fonte, e o crivo de 4-gramas (0,35) tinha falso-negativo por
DILUIÇÃO (15 palavras copiadas num resumo de 62 → overlap 0,24 → publicava).

- **Migration 016 APLICADA:** `news_raw.summary` + proveniência (`summary_model`,
  `summary_tokens_in/out`, `summary_job_ref`, `summary_review_reason`) + estágio
  `sintese_clipping` no CHECK do ledger. Aditiva, zero regressão (40.865 linhas intactas).
- **Anti-cópia reforçado (2 sinais):** além do overlap de 4-gramas (0,35, PROPORÇÃO),
  agora **maior trecho contíguo** (`maiorRunContiguo` ≥ **8 palavras** idênticas ⇒
  reprova — pega a diluição) + teto de **45 palavras**. Fonte única do crivo espelhada
  em Deno (`supabase/functions/_shared/anticopia.ts`) com **teste de drift** que reprova
  o CI se os limiares divergirem do Node.
- **ONDE a síntese roda (decisão):** a chave do OpenRouter vive **só no ambiente das
  edge functions** (Vault SQL vazio, confirmado) — não em secret do GitHub. Logo a
  síntese REAL roda numa **edge function** (`sintese-clipping`), lendo a key do
  Deno.env, nunca esperando key no Actions. **Provado por lote real:** tokens em
  `llm_jobs` (estágio `sintese_clipping`, 11 jobs, 4.479 in / 452 out), não mock.
- **Clipping ligado:** `sintese-clipping` gera `news_raw.summary` PRÓPRio (passa o
  crivo) só para news de **relevância loyalty** (filtro no candidato — evita gastar LLM
  e surfacializar ruído); reprova → `summary_review_reason`, nunca publica (INV-2). Piso
  rígido 5 mantido; sem key → mock, 0 job (INV-03). `montarClipping` já puxa o summary.
- **Crivo no resumo da EXTRAÇÃO:** a edge fn `campaigns` passou a rodar o anti-cópia
  (só os sinais de cópia, não o tamanho) no `resumo` antes de escrever `notes`: cópia
  vira marcador neutro + `summary_review_reason`. Fail-safe (erro no crivo → comportamento
  antigo, nunca derruba a extração).
- **Backfill:** 747 resumos verbatim FLAGADOS em `campanha_versoes`
  (`evento=flag_anticopia_resumo_backfill`, idempotente) — flag, não descarte (D-060).
  Volume grande reportado ao operador; a reescrita das notes históricas fica como decisão dele.

## D-082 — Integridade do dado que alimenta o Deal Desk: TIER 1 por lastro, views sem furo, clipping-only respeitado
**Data:** 2026-07-22 · **Status:** Aplicada · **Milestone:** M2.7 · **Origem:** auditoria de integridade (C1/A3/A8)

Três furos que deixavam o gate do Deal Desk (D-044) oco ou revertiam decisão do
operador na montagem automática. Os três eram silenciosos — passavam no CI porque
o dado de teste refletia o furo.

- **C1 — TIER 1 vinha do LLM, não de confirmação (D-048/INV-02).** A edge fn
  `campaigns` gravava `tier: c.tier || 2` — o `tier` do extrator é claim do LLM, sem
  lastro em `campanha_fontes`. Auditoria: **49 de 50** `tier=1` **sem nenhuma fonte
  oficial**, então o portão 2 do Deal Desk (`tier===1`) era decorativo.
  - **Ingest nunca mais aceita tier do LLM:** edge fn `campaigns` v18 grava **sempre
    `tier: 2`**; `tier=1` só por `coleta-tier1`/`gravacao-tier1`, que escrevem
    `campanha_fontes` (a confirmação real).
  - **`tem_tier1` é derivado de `campanha_fontes`, não do campo `tier`:** o portão 2
    (`selecionar.mjs` `temTier1Confirmado`) lê `campaign.tem_tier1`, que o runner
    (`daily.mjs`) preenche cruzando `campaigns.id` contra `campanha_fontes`. Sem linha
    de confirmação → não passa, independentemente do que o LLM disse.
  - **Rebaixa dos 49 sem lastro APLICADA:** `tier=2` com trilha em `campanha_versoes`
    (`evento=rebaixa_tier_sem_lastro`). Invariante `tier=1 ⇒ ∃ campanha_fontes` agora
    vale: antes 50 tier=1 (1 com lastro); depois **1 tier=1, 1 com lastro, 0 sem lastro**.
- **A3 — views históricas com INNER JOIN escondiam campanha nova para sempre.**
  `vw_placar_rota`/`vw_banco_programa` faziam INNER JOIN em `triagem_backlog_m3` (evento
  de triagem única) — campanha ainda não triada **nunca aparecia no placar**.
  - **Migration 018 APLICADA:** LEFT JOIN LATERAL + regra explícita
    `coalesce(t.categoria,'sem_triagem') <> 'revisao'` — não-triada **conta**, só
    `revisao` fica de fora. **Provado:** campanha sintética sem triagem (`categoria=null`)
    aparece em `vw_placar_rota` sob LEFT JOIN e era invisível sob o INNER JOIN antigo.
- **A8 — `used_in=['clipping_only']` (D-061.2) não era lido por ninguém.** Decisão
  editorial do operador de que um item só entra no Clipping (ex.: cashback de IOF da
  Caixa — tarifa, não bônus) era ignorada na montagem automática, que ressuscitava o item.
  - **Único leitor determinístico:** `ehClippingOnly` (`ofertas-ativas.mjs`) normaliza a
    forma do campo (array `['clipping_only']` OU objeto `{...,clipping_only}`) e é aplicado
    em `selecionarOfertasAtivas` e `selecionarCartoesBancos`. **Golden:** item Caixa
    vivo+cartão marcado `clipping_only` é cortado de Cartões&bancos; sem a marca, entraria.
  - No banco, a única Caixa viva+cartão (`caixa-desconhecido-cartao-2027-12-31`) está
    marcada `clipping_only`; a outra viva (`...-compra-...`) não é cartão, não vazaria.

# ═══════════════════════════════════════════════════════════════════════════
# Reconciliação C4 — decisões importadas de branches paralelas (2026-07-18)
# ═══════════════════════════════════════════════════════════════════════════

> Aplicação do índice de faixas do topo. As decisões abaixo foram **movidas para a
> faixa do seu chat** e importadas ao canônico com conteúdo preservado; só os
> cross-refs internos foram reapontados para os novos números. Os PRs de origem
> (#105 predict; #106/#107/#108 calibração), no rebase, **removem suas cópias antigas**
> (D-040..043 / D-066..070) — elas já vivem aqui, no número certo.

## Faixa Predict (D-100..D-199) — importado de #105 (`predict-engine-backtesting`)
> Renumeração: predict D-040→**D-100**, D-041→**D-101**, D-042→**D-102**, D-043→**D-103**.
> Colidiam com os D-040..043 do PRINCIPAL (recanonicalização / modo-de-operação), que
> ficam como estão. Conteúdo idêntico ao de #105; único cross-ref reapontado:
> "D-040/brief"→"D-100/brief" (em D-103).

## D-100 — Predict é frequencial calibrado e validado (não ML opaco); e não se calibra contra datas corrompidas
**Data:** 2026-07-17 · **Status:** Aprovada · **Milestone:** Predict (chat dedicado) · Origem: chat de predict

Trava de natureza do `campaign_predict_v2` (`lib/predict-engine.ts`, RFC-009). **Duas partes na mesma ADR** — juntas dizem *o que o predict é* e *sob que condição ele pode ser calibrado*. Uma sem a outra deixa brecha.

**Parte A — trava de natureza (auditabilidade).** "Treinar o predict" = **calibrar parâmetros determinísticos e validar por backtesting walk-forward**. Nunca modelo de pesos aprendidos inexplicáveis. Cada previsão carrega `base_n`, features explícitas e é reproduzível ("este par apareceu N vezes, intervalo mediano X, última há Y, âncora Z → P na janela W"). O corpus **calibra e valida**, não substitui a heurística transparente por predição aprendida. **Regra de honestidade (lei):** probabilidade numérica só onde `base_n ≥ 3` e série ≥ 12 meses; abaixo disso, **rótulo qualitativo** ("padrão recorrente, base insuficiente"), nunca percentual. Mesma espinha do TL Score: conta aberta, não caixa-preta. *(Já é verdade em `predict-engine.ts` — determinístico, puro, sem LLM. Esta ADR trava contra regressão.)*

**Parte B — precondição de integridade temporal (bloqueante).** **Nenhum parâmetro do predict é calibrado contra backtest enquanto a camada temporal não for confiável.** O walk-forward já previne vazamento de futuro; o problema é outro: a `AUDITORIA-FORENSE-PREDICT-FORECAST.md` confirma erro de ano sistemático (77% das transferências com evento >180 d antes do `first_seen`, média +310 d) e proveniência confiável só desde 2025-12. Calibrar sobre essas datas é **otimizar para ruído** — proibido pela mesma lógica da D-014 ("score sobre base suja é lixo com casas decimais") e pela regra do próprio operador: **"backtest mal desenhado mente pior que não ter backtest".** `suspect_year` bloqueia **sem autocorrigir** (INV-16 aplicado ao tempo; a data pode legitimamente ser de campanha antiga — proveniência valida, não substitui). A calibração de params do predict fica **travada** até a slice de plausibilidade temporal (ADR-RADAR-010) fechar e as datas serem confiáveis.

## D-101 — Correção temporal em duas fases: origem (edge fn) ANTES do histórico; duas aprovações antes de qualquer escrita
**Data:** 2026-07-17 · **Status:** Aprovada · **Milestone:** Predict (chat dedicado) · Origem: diagnóstico do Agente 1

O bug de ano está **vivo na extração** (edge fn `campaigns` v13; +246 transferências novas corrompidas desde a auditoria, a mais recente ainda errada). Reconstruir ~24 meses de histórico enquanto a origem corrompe é **enxugar gelo**. Ordem de execução travada:

1. **Prioridade 1 — corrigir a origem (edge fn):** validar data na extração; passar `published_at` ao prompt; `id` **sem data embutida**; dedup por **identidade estável** (não `id`-com-data). Estanca o sangramento. **Restrição:** não pode regredir a coleta que já funciona — o caminho `daily` está limpo hoje; a correção é testada contra os casos que **funcionam** (daily limpo) **e** os que falham (`auto`), e verificada numa **amostra pós-deploy** (notícias novas nascem com data válida).
2. **Prioridade 2 — reconstruir o histórico** só depois de a origem estar estancada.

**Duas paradas de aprovação do operador antes de escrever na camada temporal:** (a) a correção da edge fn (propõe → revisa → dry-run/teste → deploy → verifica amostra); (b) a regra de reconstrução (§D abaixo). Nenhuma escrita na fundação sem essas duas aprovações. Mesma disciplina da canonicalização do M1: dry-run → amostra → aprovação → grava.

## D-102 — `suspect_year`/`sem_data` = exclusão da série temporal, NÃO deleção do corpus
**Data:** 2026-07-17 · **Status:** Aprovada · **Milestone:** Predict · Origem: diagnóstico do Agente 1

Os ~202 corrompidos sem evidência de ano + os 191 sem data **não são apagados**. Ficam **marcados** (`suspect_year`/`sem_data`) e **saem da série temporal confiável**, mas **permanecem no corpus** para usos que não dependem de data precisa (matcher de identidade, contagem grosseira de ocorrências) e para reprocessamento futuro (se surgir outra evidência de ano). Drop físico perde informação recuperável. Mesma filosofia do backup e da fila de revisão: **marca e exclui do uso sensível, não deleta.**

## D-103 — Fronteira do predict v1: número só onde há base; datada e auto-expansível
**Data:** 2026-07-17 · **Status:** Aprovada · **Milestone:** Predict · Origem: diagnóstico do Agente 1

Pós-reconstrução, o predict v1 fala com **probabilidade numérica** só para as **~17 rotas** com `base_n≥3` e série ≥12m dentro da janela confiável (**~24 meses**, 2024-07 → 2026-07). Todo o resto é **rótulo qualitativo** ("padrão recorrente, base insuficiente") — a regra de honestidade do D-100/brief. Vai ao público com essa moldura: o Pro **não promete previsão de tudo**; promete previsão honesta onde há base e **diz onde não há**. A fronteira é **datada** e **se expande sozinha** conforme a série confiável cresce (com a origem já corrigida), sem mexer no código. É a decisão de produto mais importante do predict v1.

## Faixa Calibração (D-200..D-299) — importado do base `corpus-calibration` (#106/#107/#108)
> Renumeração: calibração D-066→**D-200**, D-067→**D-201**, D-068→**D-202**, D-069→**D-203**,
> D-070→**D-204**. D-066..068 colidiam com D-066 (M3 build, #109) / D-067 (ratificação W-P,
> #110) / D-068 (montagem, #110) do PRINCIPAL, que ficam como estão. **Decisões REAIS do
> operador — inclui `shrink_k` MANTIDO em 5 (D-202).** Cross-refs reapontados: "filho de
> D-066"→"filho de D-200"; "(D-066)"/"(GATE D-066)"→D-200; "(D-067.3)" e "D-052.3/D-067.3"
> →"D-201.3"; "D-069"→"D-203".

## D-200 — TRAVA DA FASE DE CALIBRAÇÃO: o corpus calibra os motores, nunca os substitui
**Data:** 2026-07-17 · **Status:** Aprovada (trava inviolável) · **Milestone:** Calibração (accuracy loop, brief §13) · **Origem:** abertura do chat de calibração por corpus

Trava inegociável de toda a fase de calibração, registrada **antes** de qualquer agente. O corpus real (40k+ notícias processadas, ~18 meses, base sã pós-recanonicalização) **calibra os parâmetros dos motores determinísticos** — constantes de funções puras versionadas (`score_pesos`, `derivacao_config`, `custo_base_*`, limiar do gate D-048). **Nunca** substitui os motores por um modelo aprendido/ML.

- **O TL Score continua conta aberta, auditável, com breakdown e fórmula.** Nada de regressor, embedding-como-score ou caixa-preta. A conta aberta **é o produto** (INV-03; tese-mãe do HANDOFF: determinismo primeiro, LLM depois — a LLM narra, nunca calcula).
- "Treinar com o que temos" nesta fase = **medir a distribuição real e mover uma constante versionada**, jamais "trocar o motor por um modelo". Agente que interpretar o contrário **parou errado** e aborta a frente.
- **Determinismo-primeiro vale aqui mais que em qualquer lugar:** mesmo input → mesmo output no CI; golden files ancorados à versão do parâmetro.

**Disciplina de calibração (todo parâmetro):**
1. Parâmetro calibrado vira **nova versão versionada** (`score_pesos.v1`→`.v2`, `derivacao_config` v1→v2), com **golden files travando o comportamento**, **antes/depois medido e visível**, **changelog público**, **rollback possível**. Calibração não drifta silenciosamente.
2. **Portão do operador:** movimento que **aumenta risco de publicação exige aprovação do operador**; movimento que **aumenta cautela é livre**. O operador é o portão de toda decisão de parâmetro que vira público.
3. Todos os agentes operam **mede-e-propõe**: não gravam versão em produção sem aprovação da proposta. Spec/proposta antes de gravar, sempre.
4. **Caso-guia:** `livelo→azul` — blog 115% vs. oficial em escala por público 50–120% (D-048/CASO-LIVELO-AZUL). Parâmetro medido no corpus pega o que a amostra pequena não pega.

**Fronteira estrutural (dois loops que NÃO calibram contra o corpus agora — só o tempo os liga):** a calibração dos motores contra a **distribuição** (pesos, quartis, buckets, golden) roda hoje. Mas os loops que dependem de **desfecho real observado** — o auto-ajuste do **limiar do gate de confiança** (D-048) e o **predict frequencial** (REQ-24/25) — ficam **bloqueados por ausência de ledger de desfechos**. Não é bug: mede-se o que dá contra o corpus agora; os loops de acerto ligam quando houver acerto para medir (produto operando gera histórico). Ver HANDOFF §1.

Generaliza e sela o espírito de D-022/D-032/D-037/D-038 (parâmetro = versão, não hardcode) como **regra permanente da fase**.

## D-201 — Operação da calibração: guarda de base de worktree · ledger antes de auto-publish · um número de cobertura entre chats
**Data:** 2026-07-17 · **Status:** Aprovada · **Milestone:** Calibração · **Origem:** aceite de A3 + higienes do operador · filho de D-200

Três decisões operacionais da fase, aprovadas ao aceitar a metade honesta do Agente 3.

**1. Guarda de base no disparo de todo agente paralelo (mata a classe, não a ocorrência).** Worktree de agente **sempre ancorado por instrução explícita no base real vigente** (`origin/claude/loyal-v2-corpus-calibration-9z2utl`, hoje `5827616`), **nunca** por herança do commit em que o worktree calhou de nascer. Sintoma observado: worktrees nasceram em `d931f1b` (pré-`v2/`); A3 e A2 **recuperaram** ramificando explicitamente do base real, mas recuperação caso-a-caso é frágil. A guarda é no **prompt de disparo** (checkout explícito do base + verificação de que `v2/` existe antes de medir), parte permanente do modo de operação de agentes paralelos.

**2. Outcomes-ledger = slice futura E pré-requisito de ligar auto-publish (ordem travada).** Especificar o ledger agora, porque ele precisa **existir antes de o produto operar** para capturar desfecho desde o dia 1 — construí-lo depois perde o histórico dos primeiros dias, justo quando o limiar mais precisa aprender. **Ordem inviolável:** ledger existe e captura → produto opera gerando desfecho → ledger acumula → auto-ajuste do gate de confiança (D-048) liga. **Nunca ligar auto-publish sem o ledger capturando.** O ledger registra os sinais determinísticos de D-048 (janela de vigência, corroboração/refutação de termos em 3 níveis, oficial vs secundária, público inequívoco, estado vivo 200) **+** o desfecho `automatico_acertou × correcao_humana_posterior`, sob as 4 travas de D-048. `0,75` segue como start conservador (D-050), não calibrado até o ledger acumular.

**3. Cobertura de predict = UM número oficial entre chats, conservador, sobre a janela confiável.** A foto do A3 tem dois números com definição explícita: **119** (série medida só por `first_seen`, conservador) e **163** (`first_seen→last_seen`, teto otimista). Inclinação de produto credibility-first: **o conservador (119) é o número público**, 163 como teto. **Porém a foto do A3 foi calculada sobre a série como-está**, que inclui a **corrupção temporal sistemática** que o chat de predict acabou de diagnosticar (`v2/predict/DIAGNOSTICO-CAUSA-RAIZ-TEMPORAL.md`, branch `predict-engine-backtesting-six5pq`: **75,6% dos transfer datados com ano atrasado 1–6 anos**; janela confiável **~24m, não 36**). Logo: **os 163/119 são PROVISÓRIOS** e devem ser **recalculados sobre a janela temporal confiável definida pelo chat de predict** antes de virarem número público. **Não cravar a fronteira aqui isolado; alinhar com o chat de predict** — os dois chats não podem afirmar cobertura divergente. Os 163 podem encolher quando filtrados por data confiável.

## D-202 — Resolução dos gates de calibração (A1/A2/A3)
**Data:** 2026-07-17 · **Status:** Aprovada (com 2 pendências nomeadas, depois resolvidas) · **Milestone:** Calibração · **Origem:** ruling do operador sobre os três PRs

**A1 — score (#107): MANTER v1; `shrink_k` pendente de aval explícito.**
- **`score_pesos.v1` (pesos): MANTIDO.** A medição confirmou que nenhum movimento de peso ganha discriminação honesta — só realoca o ponto fixo da banda 65 (D-042). O gargalo é **cobertura de CPM/ratio** (frente de fontes + janela confiável do predict), não o vetor.
- **`derivacao.v1`: MANTIDO.** Buckets batem com o corpus.
- **`shrink_k` 5→3: NÃO versionar sem aval explícito — o movimento AFROUXA.** Formula `score.mjs:46`: `pct_efetivo = (pct_bruto·base_n + 0,5·shrink_k)/(base_n+shrink_k)`. Baixar `shrink_k` **reduz** o puxão à neutra 0,5 → rota de base curta com percentil bruto alto sobe (banda neutra 44,6→40,4%). Isso **aumenta risco de publicação** em rota mal-suportada → gated (D-200). Recomendação registrada: **manter `shrink_k=5`** (ganho modesto, v1 saudável, credibility-first). Só versiona se o operador aprovar explicitamente o afrouxamento.
- **Registro:** a calibração de A1 é um **resultado negativo bom** — mediu e não precisou mexer no vetor.

**A2 — golden em escala (#108): critério N=400 APROVADO; R1/R2 decididos; R5 pendente de critério.**
- **Critério APROVADO:** N=400 (280 pos / 120 neg), estratos por **tipo canônico** (não pelo tipo bruto do extrator — R3), lado-único, tempo (18m), programa, divergência; método determinístico `md5(estrato‖id)`; proveniência por item.
- **R1 APROVADO — "até X%" = teto de escala oculta; percentual do público geral = `null`.** Generalização corpus-wide do D-200/caso azul: o teto do blog ("até 120%") **não** é a taxa do público geral; tratá-lo como taxa geral foi a raiz do 115% fantasma. `geral` fica `null` até a fonte oficial dar a escala. Aumenta cautela (livre), mas é convenção de rótulo → aprovada explicitamente. Afeta ~159 candidatos; **maior impacto da calibração.**
- **R2 DECIDIDO — cashback de cartão fechado = `nao_campanha/perk` (D-018), COM teste de fronteira.** Regra-mãe: vantagem de cartão que não é ponto/milha/**cashback transferível** fica fora. **Teste (aplica o teste, não a palavra "cashback"):** o cashback é **transferível/sacável** (vira ponto transferível ou saldo resgatável → **entra**, é valor) ou fica **preso como desconto no próprio cartão** (→ **fora**, é perk)? Sem o teste o rotulador barraria cashback legítimo junto com perk.
- **R5 PENDENTE — fronteira shopping vs bonus_acumulo.** Precisa congelar antes da massa; critério proposto trazido ao operador (ver relato do turno), aguarda ratificação. Sem R5 ratificado, a rotulação das 400 **não dispara** (GATE D-200).
- **PMD real:** o primeiro `pontos_mais_dinheiro` real do corpus entra no escopo da massa para **aposentar os 4 sintéticos e o asterisco D-030** — mas o asterisco só sai quando o tipo tiver **base real suficiente**; até lá, sintéticos ficam marcados.

**A3 — gate + predict (#106): metade aceita; cobertura PROVISÓRIA até a janela confiável.**
- Foto de cobertura (163/119 aptos) **provisória, marcada "sobre série não-corrigida"**. O chat de predict fechou o diagnóstico temporal (janela confiável **~24 meses**, bug vivo na extração, Fase 1a aprovada para estancar). A cobertura **recalcula sobre a janela confiável** definida pelo predict antes de virar número público — **um só número oficial entre os dois chats** (D-201.3). Os 163 podem encolher filtrados por data confiável.

**Gate de execução:** versiona só o aprovado; a massa do golden só roda após (1) direção do `shrink_k` confirmada [trazida: afrouxa → gated] e (2) critério de R5 ratificado. Nada versiona sem aval por parâmetro.

**Fecho (2026-07-17) — as duas pendências resolvidas, massa liberada:**
- **`shrink_k` MANTIDO em 5 por decisão do operador.** Avaliado, direção confirmada **afrouxante** (baixar reduz o puxão à neutra → base curta confia mais no bruto → item mal-suportado mais perto de acionável = risco de publicação ↑). O **gated NÃO foi destravado**: não se troca robustez por ganho modesto num produto cuja moeda é credibilidade. v1 inteiro, nada versionado.
- **R5 RATIFICADO — mecanismo, não dono da vitrine.** **Regra de ouro:** *shopping = canal (ganho É o portal, cotado em pontos-por-real); bonus_acumulo = janela sobre acúmulo que já aconteceria (multiplicador "+X%"/"em dobro" por janela).* Superior à linha "dono da vitrine" (portais são catálogos de parcerias → vaza). **4 edge rulings** ratificados, incluindo "pontos em dobro em restaurantes" como benefício estrutural sem janela → **perk/`nao_campanha`** (D-018), não bonus_acumulo.
- **R1 ESTENDIDO A SHOPPING.** "Até X pontos por real no Shopping" é **teto de catálogo** (poucas lojas dão X, a maioria 1–2), **não** a taxa geral do portal. Mesma convenção do R1: taxa de shopping cotada "até X" = teto → taxa geral **indeterminada**; a acionável é a da loja específica. O rotulador não crava "10 pts/real" como taxa do portal inteiro.
- **Massa liberada:** rotulação N=400 com critério + R1(+shopping) + R2 + R5; inclui o PMD real; depois re-mede os gates (rejeição, vigência, matcher) contra o golden grande (tira o asterisco in-sample dos 86). **Números da massa/gates só ficam PÚBLICOS após revisão do operador** (número público passa pelo operador). Retorno exigido: gates re-medidos + **amostra dos 159 candidatos de divergência sob R1 (antes→depois)** — o teste real da convenção-guia em escala.

## D-203 — Gate ativo: recall da verificação pré-publicação vs. histórico conhecido (BNB→Azul, Flying Blue); P1 de A1 já aplicado upstream
**Data:** 2026-07-17 · **Status:** Registrada (gate em espera; achado de reconciliação aplicado) · **Milestone:** Calibração · **Origem:** instrução do operador + achado ao sincronizar com `loyal-v2-architecture-nfvoh1`

**(1) Gate ativo (standing task, não bloqueia nada agora).** Quando o PRINCIPAL entregar o desenho da verificação pré-publicação (checks de vigência/tipo/confiança), a CALIBRAÇÃO mede recall dela contra o histórico conhecido antes de qualquer threshold ser aprovado. Objetivo do operador, explícito: **assertividade sem sumir com oferta real** — prefere guardrail com mais revisão manual a um com itens desaparecendo silenciosamente. Se recall ruim (esconde mais do que pega), reporta ANTES da aprovação.

**Fixture de teste já grounded (D-059, benchmark milhasbot):** duas ofertas genuinamente vivas que JÁ ESTAVAM no banco mas sumiram do radar por bug de dado — o teste mínimo que qualquer verificação nova tem que passar:
- **BNB→Azul (até 110%):** vigência parseada como **2024**-07-17 quando a matéria é de 2026 (classe de bug D-021, inferência de ano em extração LLM antiga) → FSM derivou `historica` → sumiu do vivo. Vence de verdade **17/07/2026**.
- **Flying Blue (45% OFF):** vigência não extraída (`na`) → `indeterminada` → fora do filtro vivo. Vence de verdade **28/07/2026**.
- *(terceiro caso do benchmark, `livelo-hilton`, era visível — falha editorial, não de gate; não entra no fixture de recall.)*

Quando o desenho da verificação chegar: medir se ela teria flagado/escondido esses dois (deveria PASSAR os dois, com confiança correta), quantificar falso-negativo (esconde oferta viva) vs. falso-positivo (deixa passar erro real) num corpus mais amplo de casos históricos, e reportar antes de qualquer threshold entrar em produção.

**(2) Achado de reconciliação — P1 de A1 (#107) JÁ FOI aplicado, independentemente, pelo principal.** Ao sincronizar contra `loyal-v2-architecture-nfvoh1`, o commit `1fdc1fc` já corrige o mesmo bug `null→0` em `finite()` (rescore-1/2.mjs) que A1 mediu e propôs como P1, com números quase idênticos (mediana 60→58, ≥70 12,6%→8,9% vs. os 12,7%→8,9% do A1). **Regravação em produção já feita**, escopo restrito aos 1.996 ids que já tinham `tl_score_bruto` (não toca os 1.334 `conta_nao_calculavel`/D-050.1). **P1 fica RESOLVIDO — não pedir aprovação de novo, já aconteceu.** **P2 (teto de sanidade 200/300 para ghosts de percentual) segue ABERTO**, não foi tocado upstream.

**Achado colateral registrado pelo principal, não corrigido ainda (fora do escopo daquele commit):** `rescore-2.mjs` nunca chamou `marcarNaoValorLadoUnico` no próprio pipeline de output — rodar o runner sobre a base inteira (em vez do escopo restrito) ressuscitaria os 1.334 brutos que D-050.1 zerou (619 deles ≥70). Relevante para a calibração: os vetores só ficam genuinamente fechados quando esse gap for reconciliado — fica registrado, não é decisão da calibração resolver.

**(3) Atualização pós-sync — o gate deixa de ser "standing" e vira mensurável.** Confirma-se que **a verificação pré-publicação FOI construída** (`v2/lib/verificacao/pre-superficie.mjs`, real D-060 upstream, testes verdes) e já mede exatamente os padrões do fixture acima (`vigencia_bug_ano` = padrão BNB; `valor_sem_data` = padrão Flying Blue). **P2 também está resolvido** (D-061, teto 200/piso 300 por tipo). **Ação da calibração:** medir formalmente o fixture BNB/Flying Blue contra `pre-superficie.mjs` e ampliar a medição de recall para o histórico mais amplo — a registrar quando a medição rodar.

## D-204 — Papel da calibração no M3: recall do placar histórico e das janelas do Predict (gate standing, aguarda dado)
**Data:** 2026-07-17 · **Status:** Registrada (standing, sem dado ainda) · **Milestone:** M3 · **Origem:** instrução do operador

Segundo gate standing da calibração, distinto de D-203 (aquele mede a verificação pré-publicação; este mede as superfícies públicas do M3 — track record + Predict). Mesma disciplina-mãe: **assertividade sem sumir com sinal real** — o bug de vigência que enterrou BNB→Azul e Flying Blue (D-059/D-060) é o exemplo-guia de por que qualquer superfície nova precisa ser medida antes de publicar, não depois.

Quando a trilha do track record (`v2/M3/SPEC-TRACK-RECORD.md`) e a reconstrução temporal do predict entregarem dado, a calibração mede:
- **(a) Precisão do placar histórico por rota.** O track record (§3 da spec) **herda a janela de confiabilidade temporal do predict** — não pode afirmar histórico que o dado não sustenta (mesma disciplina do bug BNB/Flying Blue: data que o sistema sabe suspeita nunca aparece como se fosse confiável). Medir: quantas rotas do placar têm proveniência real vs. quantas estariam afirmando mais do que a janela confiável permite.
- **(b) Recall das janelas do Predict.** Quantas rotas com histórico real (base_n≥3, série≥12m — cobertura já fotografada por A3, D-201.3, hoje provisória) ficam **de fora** por confiança conservadora demais no motor. Objetivo do operador, explícito: nunca sumir com sinal real por excesso de cautela — o mesmo princípio de D-203, aplicado ao lado do Predict em vez do gate de confiança.

**Bloqueado por dado, não por design:** nem o track record (construção SEGURADA, §6.1 do handoff — depende de janela cravada) nem a reconstrução temporal (~24m, em curso no chat de predict) entregaram saída ainda. **Regras:** mede e propõe, nunca grava direto (D-200). Se a medição achar um trade-off ruim (esconde mais sinal real do que pega erro), reporta ANTES de qualquer threshold ser aprovado — mesmo padrão de D-203.

## Gate de colisão de decisões (CI)
`scripts/check-decisions.mjs` (rodado no job `test` do CI, ver `.github/workflows/ci.yml`) faz cumprir o índice de faixas: (1) **zero D-NNN duplicado** no próprio arquivo; (2) todo D-NNN **dentro de uma faixa declarada** no índice do topo; (3) **cross-branch** — compara `v2/DECISIONS.md` deste ref contra o do branch default e **reprova se o mesmo D-NNN existir nos dois com título diferente** (a classe de colisão do C4). É o que trava #105/#106/#107/#108 até renumerarem para sua faixa. Determinístico, sem rede além de um `git show` do default.

## Regra de execução
Aplicar GSD2 (Milestone > Slice > Task) e structured-dev-workflow. Cada slice fecha com resumo `gsd-output-formatter`. **M1 fechado e aprovado (D-013).** **D-014 ENCERRADO como bloqueio (2026-07-17):** re-score-1 (base sã) e re-score-2 (CPM vivo) gravaram e fecharam **verificados** (checksum byte-a-byte, agregados, self-loops=0, golden verde, anomalias idênticas). O backup cumpriu a função — a trava lógica sai. `campaigns_bkp_prev2_20260716` **retido como ARQUIVO FRIO** (rollback da cadeia M2 inteira, 3.610 linhas, schema legado) **até o fecho do M2**; `DROP` é irreversível → decisão consciente do operador ao fechar M2, nunca no meio. Não descartar agora.
