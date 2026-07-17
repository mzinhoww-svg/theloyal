# The Loyal v2 — DECISIONS.md

> Log de decisões do operador (ADR-style). Fonte de verdade das decisões que destravam milestones.
> Precede o PROJECT.md §5 (que passa a apontar para cá).

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

## D-051 — TRAVA DA FASE DE CALIBRAÇÃO: o corpus calibra os motores, nunca os substitui
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

## D-052 — Operação da calibração: guarda de base de worktree · ledger antes de auto-publish · um número de cobertura entre chats
**Data:** 2026-07-17 · **Status:** Aprovada · **Milestone:** Calibração · **Origem:** aceite de A3 + higienes do operador · filho de D-051

Três decisões operacionais da fase, aprovadas ao aceitar a metade honesta do Agente 3.

**1. Guarda de base no disparo de todo agente paralelo (mata a classe, não a ocorrência).** Worktree de agente **sempre ancorado por instrução explícita no base real vigente** (`origin/claude/loyal-v2-corpus-calibration-9z2utl`, hoje `5827616`), **nunca** por herança do commit em que o worktree calhou de nascer. Sintoma observado: worktrees nasceram em `d931f1b` (pré-`v2/`); A3 e A2 **recuperaram** ramificando explicitamente do base real, mas recuperação caso-a-caso é frágil. A guarda é no **prompt de disparo** (checkout explícito do base + verificação de que `v2/` existe antes de medir), parte permanente do modo de operação de agentes paralelos.

**2. Outcomes-ledger = slice futura E pré-requisito de ligar auto-publish (ordem travada).** Especificar o ledger agora, porque ele precisa **existir antes de o produto operar** para capturar desfecho desde o dia 1 — construí-lo depois perde o histórico dos primeiros dias, justo quando o limiar mais precisa aprender. **Ordem inviolável:** ledger existe e captura → produto opera gerando desfecho → ledger acumula → auto-ajuste do gate de confiança (D-048) liga. **Nunca ligar auto-publish sem o ledger capturando.** O ledger registra os sinais determinísticos de D-048 (janela de vigência, corroboração/refutação de termos em 3 níveis, oficial vs secundária, público inequívoco, estado vivo 200) **+** o desfecho `automatico_acertou × correcao_humana_posterior`, sob as 4 travas de D-048. `0,75` segue como start conservador (D-050), não calibrado até o ledger acumular.

**3. Cobertura de predict = UM número oficial entre chats, conservador, sobre a janela confiável.** A foto do A3 tem dois números com definição explícita: **119** (série medida só por `first_seen`, conservador) e **163** (`first_seen→last_seen`, teto otimista). Inclinação de produto credibility-first: **o conservador (119) é o número público**, 163 como teto. **Porém a foto do A3 foi calculada sobre a série como-está**, que inclui a **corrupção temporal sistemática** que o chat de predict acabou de diagnosticar (`v2/predict/DIAGNOSTICO-CAUSA-RAIZ-TEMPORAL.md`, branch `predict-engine-backtesting-six5pq`: **75,6% dos transfer datados com ano atrasado 1–6 anos**; janela confiável **~24m, não 36**). Logo: **os 163/119 são PROVISÓRIOS** e devem ser **recalculados sobre a janela temporal confiável definida pelo chat de predict** antes de virarem número público. **Não cravar a fronteira aqui isolado; alinhar com o chat de predict** — os dois chats não podem afirmar cobertura divergente. Os 163 podem encolher quando filtrados por data confiável.

## D-053 — Resolução dos gates de calibração (A1/A2/A3)
**Data:** 2026-07-17 · **Status:** Aprovada (com 2 pendências nomeadas) · **Milestone:** Calibração · **Origem:** ruling do operador sobre os três PRs

**A1 — score (#107): MANTER v1; `shrink_k` pendente de aval explícito.**
- **`score_pesos.v1` (pesos): MANTIDO.** A medição confirmou que nenhum movimento de peso ganha discriminação honesta — só realoca o ponto fixo da banda 65 (D-042). O gargalo é **cobertura de CPM/ratio** (frente de fontes + janela confiável do predict), não o vetor.
- **`derivacao.v1`: MANTIDO.** Buckets batem com o corpus.
- **`shrink_k` 5→3: NÃO versionar sem aval explícito — o movimento AFROUXA.** Formula `score.mjs:46`: `pct_efetivo = (pct_bruto·base_n + 0,5·shrink_k)/(base_n+shrink_k)`. Baixar `shrink_k` **reduz** o puxão à neutra 0,5 → rota de base curta com percentil bruto alto sobe (banda neutra 44,6→40,4%). Isso **aumenta risco de publicação** em rota mal-suportada → gated (D-051). Recomendação registrada: **manter `shrink_k=5`** (ganho modesto, v1 saudável, credibility-first). Só versiona se o operador aprovar explicitamente o afrouxamento.
- **Registro:** a calibração de A1 é um **resultado negativo bom** — mediu e não precisou mexer no vetor.

**A2 — golden em escala (#108): critério N=400 APROVADO; R1/R2 decididos; R5 pendente de critério.**
- **Critério APROVADO:** N=400 (280 pos / 120 neg), estratos por **tipo canônico** (não pelo tipo bruto do extrator — R3), lado-único, tempo (18m), programa, divergência; método determinístico `md5(estrato‖id)`; proveniência por item.
- **R1 APROVADO — "até X%" = teto de escala oculta; percentual do público geral = `null`.** Generalização corpus-wide do D-051/caso azul: o teto do blog ("até 120%") **não** é a taxa do público geral; tratá-lo como taxa geral foi a raiz do 115% fantasma. `geral` fica `null` até a fonte oficial dar a escala. Aumenta cautela (livre), mas é convenção de rótulo → aprovada explicitamente. Afeta ~159 candidatos; **maior impacto da calibração.**
- **R2 DECIDIDO — cashback de cartão fechado = `nao_campanha/perk` (D-018), COM teste de fronteira.** Regra-mãe: vantagem de cartão que não é ponto/milha/**cashback transferível** fica fora. **Teste (aplica o teste, não a palavra "cashback"):** o cashback é **transferível/sacável** (vira ponto transferível ou saldo resgatável → **entra**, é valor) ou fica **preso como desconto no próprio cartão** (→ **fora**, é perk)? Sem o teste o rotulador barraria cashback legítimo junto com perk.
- **R5 PENDENTE — fronteira shopping vs bonus_acumulo.** Precisa congelar antes da massa; critério proposto trazido ao operador (ver relato do turno), aguarda ratificação. Sem R5 ratificado, a rotulação das 400 **não dispara** (GATE D-051).
- **PMD real:** o primeiro `pontos_mais_dinheiro` real do corpus entra no escopo da massa para **aposentar os 4 sintéticos e o asterisco D-030** — mas o asterisco só sai quando o tipo tiver **base real suficiente**; até lá, sintéticos ficam marcados.

**A3 — gate + predict (#106): metade aceita; cobertura PROVISÓRIA até a janela confiável.**
- Foto de cobertura (163/119 aptos) **provisória, marcada "sobre série não-corrigida"**. O chat de predict fechou o diagnóstico temporal (janela confiável **~24 meses**, bug vivo na extração, Fase 1a aprovada para estancar). A cobertura **recalcula sobre a janela confiável** definida pelo predict antes de virar número público — **um só número oficial entre os dois chats** (D-052.3). Os 163 podem encolher filtrados por data confiável.

**Gate de execução:** versiona só o aprovado; a massa do golden só roda após (1) direção do `shrink_k` confirmada [trazida: afrouxa → gated] e (2) critério de R5 ratificado. Nada versiona sem aval por parâmetro.

**Fecho (2026-07-17) — as duas pendências resolvidas, massa liberada:**
- **`shrink_k` MANTIDO em 5 por decisão do operador.** Avaliado, direção confirmada **afrouxante** (baixar reduz o puxão à neutra → base curta confia mais no bruto → item mal-suportado mais perto de acionável = risco de publicação ↑). O **gated NÃO foi destravado**: não se troca robustez por ganho modesto num produto cuja moeda é credibilidade. v1 inteiro, nada versionado.
- **R5 RATIFICADO — mecanismo, não dono da vitrine.** **Regra de ouro:** *shopping = canal (ganho É o portal, cotado em pontos-por-real); bonus_acumulo = janela sobre acúmulo que já aconteceria (multiplicador "+X%"/"em dobro" por janela).* Superior à linha "dono da vitrine" (portais são catálogos de parcerias → vaza). **4 edge rulings** ratificados, incluindo "pontos em dobro em restaurantes" como benefício estrutural sem janela → **perk/`nao_campanha`** (D-018), não bonus_acumulo.
- **R1 ESTENDIDO A SHOPPING.** "Até X pontos por real no Shopping" é **teto de catálogo** (poucas lojas dão X, a maioria 1–2), **não** a taxa geral do portal. Mesma convenção do R1: taxa de shopping cotada "até X" = teto → taxa geral **indeterminada**; a acionável é a da loja específica. O rotulador não crava "10 pts/real" como taxa do portal inteiro.
- **Massa liberada:** rotulação N=400 com critério + R1(+shopping) + R2 + R5; inclui o PMD real; depois re-mede os gates (rejeição, vigência, matcher) contra o golden grande (tira o asterisco in-sample dos 86). **Números da massa/gates só ficam PÚBLICOS após revisão do operador** (número público passa pelo operador). Retorno exigido: gates re-medidos + **amostra dos 159 candidatos de divergência sob R1 (antes→depois)** — o teste real da convenção-guia em escala.

## D-060 — Gate ativo: recall da verificação pré-publicação vs. histórico conhecido (BNB→Azul, Flying Blue); P1 de A1 já aplicado upstream
**Data:** 2026-07-17 · **Status:** Registrada (gate em espera; achado de reconciliação aplicado) · **Milestone:** Calibração · **Origem:** instrução do operador + achado ao sincronizar com `loyal-v2-architecture-nfvoh1`

**(1) Gate ativo (standing task, não bloqueia nada agora).** Quando o PRINCIPAL entregar o desenho da verificação pré-publicação (checks de vigência/tipo/confiança), a CALIBRAÇÃO mede recall dela contra o histórico conhecido antes de qualquer threshold ser aprovado. Objetivo do operador, explícito: **assertividade sem sumir com oferta real** — prefere guardrail com mais revisão manual a um com itens desaparecendo silenciosamente. Se recall ruim (esconde mais do que pega), reporta ANTES da aprovação.

**Fixture de teste já grounded (D-059, benchmark milhasbot):** duas ofertas genuinamente vivas que JÁ ESTAVAM no banco mas sumiram do radar por bug de dado — o teste mínimo que qualquer verificação nova tem que passar:
- **BNB→Azul (até 110%):** vigência parseada como **2024**-07-17 quando a matéria é de 2026 (classe de bug D-021, inferência de ano em extração LLM antiga) → FSM derivou `historica` → sumiu do vivo. Vence de verdade **17/07/2026**.
- **Flying Blue (45% OFF):** vigência não extraída (`na`) → `indeterminada` → fora do filtro vivo. Vence de verdade **28/07/2026**.
- *(terceiro caso do benchmark, `livelo-hilton`, era visível — falha editorial, não de gate; não entra no fixture de recall.)*

Quando o desenho da verificação chegar: medir se ela teria flagado/escondido esses dois (deveria PASSAR os dois, com confiança correta), quantificar falso-negativo (esconde oferta viva) vs. falso-positivo (deixa passar erro real) num corpus mais amplo de casos históricos, e reportar antes de qualquer threshold entrar em produção.

**(2) Achado de reconciliação — P1 de A1 (#107) JÁ FOI aplicado, independentemente, pelo principal.** Ao sincronizar contra `loyal-v2-architecture-nfvoh1` (23 commits à frente), o commit `1fdc1fc` já corrige o mesmo bug `null→0` em `finite()` (rescore-1/2.mjs) que A1 mediu e propôs como P1, com números quase idênticos (mediana 60→58, ≥70 12,6%→8,9% vs. os 12,7%→8,9% do A1). **Regravação em produção já feita**, escopo restrito aos 1.996 ids que já tinham `tl_score_bruto` (não toca os 1.334 `conta_nao_calculavel`/D-050.1). **P1 fica RESOLVIDO — não pedir aprovação de novo, já aconteceu.** **P2 (teto de sanidade 200/300 para ghosts de percentual) segue ABERTO**, não foi tocado upstream.

**Achado colateral registrado pelo principal, não corrigido ainda (fora do escopo daquele commit):** `rescore-2.mjs` nunca chamou `marcarNaoValorLadoUnico` no próprio pipeline de output — rodar o runner sobre a base inteira (em vez do escopo restrito) ressuscitaria os 1.334 brutos que D-050.1 zerou (619 deles ≥70). Relevante para a calibração: os vetores só ficam genuinamente fechados quando esse gap for reconciliado — fica registrado, não é decisão da calibração resolver.

**(3) Estado de sincronização — flag honesto, sem ação unilateral.** `loyal-v2-architecture-nfvoh1` está **23 commits à frente** do base da calibração (inclui v15 deployada, coleta TIER1 em produção, Digest Engine v3, primeiro rascunho do Daily). Não fiz rebase — três PRs abertos (#106/#107/#108) apontam para o base atual e um rebase agora exige coordenação (branches dos agentes, PRs). Sincronizar é decisão do operador/principal, registrada aqui para visibilidade, não ação silenciosa.

## Regra de execução
Aplicar GSD2 (Milestone > Slice > Task) e structured-dev-workflow. Cada slice fecha com resumo `gsd-output-formatter`. **M1 fechado e aprovado (D-013).** **D-014 ENCERRADO como bloqueio (2026-07-17):** re-score-1 (base sã) e re-score-2 (CPM vivo) gravaram e fecharam **verificados** (checksum byte-a-byte, agregados, self-loops=0, golden verde, anomalias idênticas). O backup cumpriu a função — a trava lógica sai. `campaigns_bkp_prev2_20260716` **retido como ARQUIVO FRIO** (rollback da cadeia M2 inteira, 3.610 linhas, schema legado) **até o fecho do M2**; `DROP` é irreversível → decisão consciente do operador ao fechar M2, nunca no meio. Não descartar agora.
