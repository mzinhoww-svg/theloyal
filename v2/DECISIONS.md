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

## D-040 — Predict é frequencial calibrado e validado (não ML opaco); e não se calibra contra datas corrompidas
**Data:** 2026-07-17 · **Status:** Aprovada · **Milestone:** Predict (chat dedicado) · Origem: chat de predict

Trava de natureza do `campaign_predict_v2` (`lib/predict-engine.ts`, RFC-009). **Duas partes na mesma ADR** — juntas dizem *o que o predict é* e *sob que condição ele pode ser calibrado*. Uma sem a outra deixa brecha.

**Parte A — trava de natureza (auditabilidade).** "Treinar o predict" = **calibrar parâmetros determinísticos e validar por backtesting walk-forward**. Nunca modelo de pesos aprendidos inexplicáveis. Cada previsão carrega `base_n`, features explícitas e é reproduzível ("este par apareceu N vezes, intervalo mediano X, última há Y, âncora Z → P na janela W"). O corpus **calibra e valida**, não substitui a heurística transparente por predição aprendida. **Regra de honestidade (lei):** probabilidade numérica só onde `base_n ≥ 3` e série ≥ 12 meses; abaixo disso, **rótulo qualitativo** ("padrão recorrente, base insuficiente"), nunca percentual. Mesma espinha do TL Score: conta aberta, não caixa-preta. *(Já é verdade em `predict-engine.ts` — determinístico, puro, sem LLM. Esta ADR trava contra regressão.)*

**Parte B — precondição de integridade temporal (bloqueante).** **Nenhum parâmetro do predict é calibrado contra backtest enquanto a camada temporal não for confiável.** O walk-forward já previne vazamento de futuro; o problema é outro: a `AUDITORIA-FORENSE-PREDICT-FORECAST.md` confirma erro de ano sistemático (77% das transferências com evento >180 d antes do `first_seen`, média +310 d) e proveniência confiável só desde 2025-12. Calibrar sobre essas datas é **otimizar para ruído** — proibido pela mesma lógica da D-014 ("score sobre base suja é lixo com casas decimais") e pela regra do próprio operador: **"backtest mal desenhado mente pior que não ter backtest".** `suspect_year` bloqueia **sem autocorrigir** (INV-16 aplicado ao tempo; a data pode legitimamente ser de campanha antiga — proveniência valida, não substitui). A calibração de params do predict fica **travada** até a slice de plausibilidade temporal (ADR-RADAR-010) fechar e as datas serem confiáveis.

## D-041 — Correção temporal em duas fases: origem (edge fn) ANTES do histórico; duas aprovações antes de qualquer escrita
**Data:** 2026-07-17 · **Status:** Aprovada · **Milestone:** Predict (chat dedicado) · Origem: diagnóstico do Agente 1

O bug de ano está **vivo na extração** (edge fn `campaigns` v13; +246 transferências novas corrompidas desde a auditoria, a mais recente ainda errada). Reconstruir ~24 meses de histórico enquanto a origem corrompe é **enxugar gelo**. Ordem de execução travada:

1. **Prioridade 1 — corrigir a origem (edge fn):** validar data na extração; passar `published_at` ao prompt; `id` **sem data embutida**; dedup por **identidade estável** (não `id`-com-data). Estanca o sangramento. **Restrição:** não pode regredir a coleta que já funciona — o caminho `daily` está limpo hoje; a correção é testada contra os casos que **funcionam** (daily limpo) **e** os que falham (`auto`), e verificada numa **amostra pós-deploy** (notícias novas nascem com data válida).
2. **Prioridade 2 — reconstruir o histórico** só depois de a origem estar estancada.

**Duas paradas de aprovação do operador antes de escrever na camada temporal:** (a) a correção da edge fn (propõe → revisa → dry-run/teste → deploy → verifica amostra); (b) a regra de reconstrução (§D abaixo). Nenhuma escrita na fundação sem essas duas aprovações. Mesma disciplina da canonicalização do M1: dry-run → amostra → aprovação → grava.

## D-042 — `suspect_year`/`sem_data` = exclusão da série temporal, NÃO deleção do corpus
**Data:** 2026-07-17 · **Status:** Aprovada · **Milestone:** Predict · Origem: diagnóstico do Agente 1

Os ~202 corrompidos sem evidência de ano + os 191 sem data **não são apagados**. Ficam **marcados** (`suspect_year`/`sem_data`) e **saem da série temporal confiável**, mas **permanecem no corpus** para usos que não dependem de data precisa (matcher de identidade, contagem grosseira de ocorrências) e para reprocessamento futuro (se surgir outra evidência de ano). Drop físico perde informação recuperável. Mesma filosofia do backup e da fila de revisão: **marca e exclui do uso sensível, não deleta.**

## D-043 — Fronteira do predict v1: número só onde há base; datada e auto-expansível
**Data:** 2026-07-17 · **Status:** Aprovada · **Milestone:** Predict · Origem: diagnóstico do Agente 1

Pós-reconstrução, o predict v1 fala com **probabilidade numérica** só para as **~17 rotas** com `base_n≥3` e série ≥12m dentro da janela confiável (**~24 meses**, 2024-07 → 2026-07). Todo o resto é **rótulo qualitativo** ("padrão recorrente, base insuficiente") — a regra de honestidade do D-040/brief. Vai ao público com essa moldura: o Pro **não promete previsão de tudo**; promete previsão honesta onde há base e **diz onde não há**. A fronteira é **datada** e **se expande sozinha** conforme a série confiável cresce (com a origem já corrigida), sem mexer no código. É a decisão de produto mais importante do predict v1.

## Regra de execução
Aplicar GSD2 (Milestone > Slice > Task) e structured-dev-workflow. Cada slice fecha com resumo `gsd-output-formatter`. **M1 fechado e aprovado (D-013).** Backup `campaigns_bkp_prev2_20260716` retido **até o re-score (R1) confirmar em escala que a canonicalização não precisa de rollback**.
