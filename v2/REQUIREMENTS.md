# The Loyal v2 — REQUIREMENTS.md

> Catálogo de requisitos verificáveis do ciclo v2. Saída do M0. Cada requisito é **testável** (tem critério objetivo de aceite).
> Fontes: BUILD BRIEF v2.1 §3 (regras inegociáveis), §6/§7 (motores), §8 (pipeline+gate), §13 (qualidade), §16 (DoD global), cruzado com o estado real auditado em `PROJECT.md`.
> Convenção: **INV** = invariante (nunca pode ser violado, nem por pedido direto). **REQ** = requisito funcional. **NFR** = requisito não-funcional.

---

## 1. Invariantes editoriais (INV) — herdados e inegociáveis

Estes não são metas de milestone; são condições que **todo código v2 preserva sempre**. Um teste de regressão guarda cada um.

| ID | Invariante | Verificação |
|---|---|---|
| INV-01 | Toda afirmação de campanha carrega fonte(s), data de publicação e data de verificação. | Schema exige `fontes[]` não-vazio com `tier`, `publicado_em`, `verificado_em`; gate bloqueia ausência. |
| INV-02 | Item de Deal Desk exige ao menos uma fonte **TIER 1**. | Gate rejeita deal cujo `fontes[]` não contém `tier=1`. |
| INV-03 | Nunca publicar número (score, probabilidade, conta, percentil) sem correspondente no banco, com fórmula e entradas. | Todo número no texto tem chave rastreável no `tl_breakdown`/ledger; gate cruza texto×banco. |
| INV-04 | Resumo próprio + link canônico; nunca reproduzir texto integral de terceiros. | Lint anti-cópia (similaridade) + presença de `url_canonica`. |
| INV-05 | Vigência sem fonte = "indeterminada" + flag de revisão; nenhum status herdado sem revalidação. | FSM de vigência exige revalidação; Weekly recheca todo status. |
| INV-06 | Proibições de linguagem: emoji; "imperdível", "corra", "última chance", "aproveite"; promessa de ganho; "grátis" com custo; "player"; "CMI"; comparação 1:1 entre moedas. | Lint automatizado (§REQ-30) bloqueia. |
| INV-07 | Faltou dado para cálculo/veredito → "Não confirmado". Nunca chutar. | Overrides forçam `nao-confirmado`; testado. |
| INV-08 | Toda saída de LLM em qualquer estágio é JSON com schema estrito e validação; falha vai para fila de revisão, nunca para publicação. | Validação de schema em todo job LLM; dead-letter/review. |
| INV-09 | Disclaimer fixo presente em toda edição com recomendação. | Schema `const`; gate exige. |
| INV-10 | Digest reprovado no gate **nunca** é enviado. | `dispatchGuarded` recusa; sem override silencioso. |
| INV-11 | Override humano de veredito é permitido, sempre logado (autor + motivo). | Tabela de override append-only; admin exige motivo. |
| INV-12 | Determinismo: score, probabilidade, conta e percentil nascem de SQL/função pura. LLM nunca calcula. | Motores puros com golden files; LLM só redige/audita. |
| INV-13 | Ledger de predições íntegro: toda predição emitida é resolvida. | Job de resolução fecha toda predição no fim da janela. |
| INV-14 | Nenhum job falho descartado silenciosamente; backfill sempre resumível e idempotente. | Dead-letter visível no admin; checkpoint por fonte/período. |
| INV-15 | Entitlement Pro auditável: toda concessão/revogação logada. | Trilha de auditoria em `entitlements`. |
| INV-16 | **Nenhuma data de vigência afirmada sem evidência de cada componente (dia, mês, ano).** Componente não justificado no texto/slug/publicação → indeterminado; data incompleta → `indeterminada`. Fabricar data é override bloqueante (envenena o FSM a jusante: `ultimos_dias`/`encerrada` falsos). Mesma família do INV-03 (nenhum número sem correspondente). | Parser de vigência bloqueia `overprecision`; golden files exigem os 3 componentes com proveniência; `overprecision=0` no CI. |

---

## 2. Requisitos de dados (M1)

| ID | Requisito | Critério de aceite |
|---|---|---|
| REQ-01 | Extrair e versionar o `schema.sql` canônico do banco vivo (20 migrations, tabelas/RPCs/views/crons hoje sem DDL no repo). | Banco novo reprovisionável **só das migrações**; numeração linear sem duplicatas. |
| REQ-02 | `raw_noticias` a partir de `news_raw` (40.191 linhas) com `hash(url_canonica)` + `simhash(titulo)`. | Dedup de notícia sem duplicata visível em amostra auditada. |
| REQ-03 | Entidade canônica `campanhas` com resolução de identidade `(tipo, origem, destino, publico)` + janelas de vigência sobrepostas. | Amostra auditada de 50: zero duplicata canônica; 458 origens reduzidas ao conjunto real de programas. |
| REQ-04 | `vigencia_fim` migrada de texto (`"na"`) para `date` + `vigencia_confiavel bool`. | Nenhum valor não-data na coluna; overrides aplicados a inconfiáveis. |
| REQ-05 | Máquina de estados de vigência (`prevista→detectada→confirmada→ativa→ultimos_dias→encerrada→historica`) com transições por cron + trigger TIER 1. | Transição testada; recheck ativo de itens `<72h`. |
| REQ-06 | `campanha_versoes` (event sourcing): mudança de % dentro de janela sobreposta é EVENTO, não campanha nova. | Caso "80%→100%" gera 1 campanha + 2 versões. |
| REQ-07 | `job_queue` único (Postgres, SKIP LOCKED) unificando os 3 mecanismos atuais (`news_raw`-polling, `backfill_queue`, `shopping_collection_queue`). | Uma fila; retry com backoff; dead-letter no admin. |
| REQ-08 | Domínios como tabela (`programas`, `fontes`, `pares_transferencia`); novo programa/fonte por INSERT. | Adicionar programa sem migration. |
| REQ-09 | Adapters de 8–12 fontes prioritárias, **incluindo ao menos as páginas TIER 1** dos principais programas. | Detecção `<=60 min` em teste com 10 posts reais; saúde por fonte monitorada. |
| REQ-10 | Golden set de 100 notícias rotuladas à mão. | Portão de extração: precision `>=95%`, recall `>=90%` nos campos críticos (programa, %, vigência). |
| REQ-11 | Backfill resumível e idempotente (já há ~18 meses no banco). | Backfill interrompido e retomado sem duplicação em teste. |

---

## 3. Requisitos de motores (M2/M4)

| ID | Requisito | Critério de aceite |
|---|---|---|
| REQ-20 | `tl-score-engine`: funções puras versionadas com golden files (mesmo input → mesmo output). | Golden files no CI; regressão falha se saída muda sem bump de versão. |
| REQ-21 | Breakdown sempre registra `base_n` e `janela_meses`; `base_n < 10` rebaixa o componente percentil e marca `base_insuficiente:true`. | Texto editorial reflete "histórico curto"; nunca apresenta base curta como consolidada. |
| REQ-22 | Pesos em `score_pesos` versionada; recalibração só via accuracy loop. | Mudança de peso é registro versionado, não edição ad hoc. |
| REQ-23 | Motores `cpm.mjs`/`spread.mjs` puros a partir das 5 fórmulas do `tl-source-audit`. | Golden files; conta reproduzível por função pura. |
| REQ-24 | Predict frequencial calibrado com Predict Ledger (alvo, janela, prob/rotulo, `base_n`, `emitida_em`) resolvido no fechamento da janela. | 100% das predições publicadas no ledger e resolvidas (acerto/erro/parcial); Brier mensal por segmento. |
| REQ-25 | Honestidade do predict: probabilidade numérica exige `>=3` ocorrências E série `>=12 meses` **para aquele par**; abaixo disso, rótulo qualitativo. | Nenhum percentual publicado com `base_n<3` ou série `<12 meses`. |
| REQ-26 | Backfill dirigido de 12–18 meses dos 5 pares mais frequentes (slice do M4). | Top-5 pares com série `>=12 meses` habilitando prob. numérica. |
| REQ-27 | Comparador de transferência: aritmética pura (pontos × bônus × paridade), com duas leituras quando exige clube. | Sem LLM na conta; ranking por rendimento. |
| REQ-28 | Cenários referenciais de emissão com `snapshot_em` + disclaimer de preço dinâmico. | Nunca promete disponibilidade de assento; data do snapshot visível. |

---

## 4. Requisitos de pipeline e gate (M2)

| ID | Requisito | Critério de aceite |
|---|---|---|
| REQ-30 | Compliance de linguagem como lint automatizado (lista INV-06). | Termo proibido bloqueia a edição. |
| REQ-31 | Gate de auditoria bloqueante **único**, em contexto independente do gerador, consolidando as 4 implementações atuais. | Reexecuta: vigência×fonte oficial; toda conta refeita (divergência `>R$0,05`/milheiro = bloqueio); TL Score bate com a régua; overrides; Deal Desk com TIER 1; lint; "O que evitar" + disclaimer; links 200; nenhum número sem correspondente no banco. |
| REQ-32 | Contrato v2 do Daily: `schemaVersion`, `estado`, `tl_breakdown`, `fontes[]` por item, `predicoes[]` **opcional** com fallback editorial. | `predicoes[]` vazio → seção de teaser omitida + item de contexto extra; gate valida ambos os casos. Edições v1 permanecem válidas. |
| REQ-33 | Publicação via Beehiiv MCP com segmentação por perfil e aprovação humana de 1 clique. | 6 segmentos criados; idempotência por hash preservada; draft por default. |
| REQ-34 | Painel de custo LLM por dia e por estágio; meta de custo por edição Daily como must-have. | `llm_jobs` registra tokens/custo/latência/fallback; meta medida. |
| REQ-35 | `model_registry` (estágio, modelo, fallbacks, teto de tokens); troca sem deploy; guardrail `LLM_DAILY_BUDGET_USD` com degradação graciosa. | Trocar modelo por UPDATE; estouro de orçamento manda itens à fila, não quebra. |

---

## 5. Requisitos de produto e acesso (M3/M4)

| ID | Requisito | Critério de aceite |
|---|---|---|
| REQ-40 | Daily gerado até 7h BRT com aprovação de 1 clique, 5 dias úteis consecutivos. | Zero item publicado sem TIER 1; toda conta reproduzível. |
| REQ-41 | Weekly com revalidação obrigatória de status; nenhum status herdado sem recheck. | Amostra auditada: todo status do Weekly foi rechecado hoje. |
| REQ-42 | Páginas públicas de edição indexáveis (SEO) + dashboard filtrável (programa, tipo, estado, veredito) ordenável por TL Score. | Edições indexadas; filtros funcionam sobre dados reais. |
| REQ-43 | Páginas de metodologia (score e predict), `/sobre`, `/anuncie`, `/privacidade`. | Presentes e coerentes com a metodologia publicada. |
| REQ-44 | Schema `usuarios` + `assinaturas` + `entitlements` completo, com gestão **manual** no admin (conceder/revogar/listar, tudo logado). | Acesso Pro concedido e revogado via admin com log; **cobrança DESLIGADA**. |
| REQ-45 | Alertas em tempo real via **Brevo** (score alto ou `ultimos_dias`), templates no brand system. | Alerta entregue em teste ponta a ponta; consumo monitorado (free 300/dia). |
| REQ-46 | Stripe plugável em `entitlements` sem refactor (M5, quando o operador ligar cobrança). | Webhook apenas INSERE em `entitlements`; nenhuma lógica de acesso muda. |

---

## 6. Requisitos não-funcionais (NFR)

| ID | Requisito | Critério de aceite |
|---|---|---|
| NFR-01 | Custo é requisito de arquitetura (caixa R$0). Regex antes de LLM; cache por hash; batch. | Meta de custo por edição definida e medida (M2). |
| NFR-02 | Runtime de jobs "não quebra": melhor tempo disponível, sem SLA rígido de latência interna. | Jobs longos em lotes retomáveis; timeout reprocessa só o lote corrente. |
| NFR-03 | Coleta respeita robots.txt/ToS; backoff exponencial; user-agent identificado; prefere RSS/sitemap/API a scraping. | Sem violação de ToS; saúde de fonte monitorada. |
| NFR-04 | LGPD: mínimo de dado pessoal; saldos opcionais, criptografados, com consentimento e exclusão sob demanda. | Base legal documentada em `/privacidade`. |
| NFR-05 | Regressão: mudança de prompt/modelo/pesos roda contra o golden set e os golden files no CI. | CI bloqueia se golden quebra. |
| NFR-06 | Human-in-the-loop faseado: M2 exige aprovação de 1 clique; automação total só após 30 dias com taxa de bloqueio no gate `<2%`. | Métrica de bloqueio rastreada. |
| NFR-07 | Segurança: sem credenciais no fonte; `verify_jwt`/rede nas edge functions; RLS por acesso. | Grep sem literais; chamada anônima negada. |
| NFR-08 | Stack Next.js 15 + TS strict + Tailwind, sem novas dependências de peso. | Upgrade 14→15 sem quebrar build/typecheck. |

---

## 7. Fora de escopo (neste ciclo) — não são requisitos

Cobrança ativa e paywall; app nativo; login nas contas dos programas para ler saldo; emissão automatizada; ML pesado no predict; programas internacionais além dos do contrato; qualquer garantia de disponibilidade de assento; coleta automatizada de preço de emissão (M5+).

---

## 8. Rastreabilidade requisito → milestone

| Milestone | Requisitos |
|---|---|
| M1 Fundação de dados | REQ-01…11, INV-01/05/08/14 |
| M2 TL Score + Daily | REQ-20/21/22/23, REQ-30…35, REQ-40, INV-02/03/10/12 |
| M3 Weekly + dashboard | REQ-41/42/43, INV-05 |
| M4 Predict + fundação Pro | REQ-24/25/26/44/45, INV-13/15 |
| M5 Escala e receita | REQ-27/28/46, NFR-03/04 |
| Transversal (todo commit) | INV-01…15, NFR-01…08 |
