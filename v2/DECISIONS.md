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

## Regra de execução
Aplicar GSD2 (Milestone > Slice > Task) e structured-dev-workflow. Cada slice fecha com resumo `gsd-output-formatter`. **M1 fechado e aprovado (D-013).** Backup `campaigns_bkp_prev2_20260716` retido **até o M2 confirmar que a canonicalização não precisa de rollback**.
