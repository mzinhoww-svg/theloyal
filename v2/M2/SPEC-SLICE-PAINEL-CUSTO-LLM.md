# M2 · Slice — Painel de custo LLM por dia e por estágio (SPEC, antes de código)

> **Por que agora.** Não toca score nem produção de dado — é observabilidade sobre
> chamadas de LLM que **já acontecem hoje**, independente de calibração ou vetores. Cobre
> REQ-34/35 e o slice `M2.5 model_registry + custo` do `ROADMAP.md`. Confirmado agora via
> `information_schema`: **`llm_jobs` e `model_registry` não existem no banco** — o M0 já
> tinha registrado isso como "Ausente"; continua ausente.

---

## 0. Quem gasta hoje — os emissores reais (não hipotéticos)

Auditoria do repo encontrou **dois** pontos que chamam LLM em produção hoje, e um
terceiro que vai entrar no ar em breve — a spec cobre os três para não precisar de
retrabalho quando o terceiro ligar:

| Estágio | Onde | Modelo hoje | Instrumentação hoje |
|---|---|---|---|
| `extracao_campanhas` | `supabase/functions/campaigns/index.ts` (edge fn `campaigns`, v15) | `meta-llama/llama-4-maverick:17b` via OpenRouter | Grava `tokens_in`/`tokens_out` **por notícia**, em `news_raw` — não em ledger dedicado, sem custo em R$/USD calculado. |
| `radar_vpm_match` / `radar_vpm_promo` / `radar_vpm_extracao` | `scripts/collect/llm.mjs` (`sameProduct`, `classifyPromo`, extração de payload) | Configurável via `OPENROUTER_MODEL` (default `openai/gpt-4o-mini`), ou Ollama local em dev | **Nenhuma instrumentação de custo hoje** — zero tokens gravados em qualquer lugar. Achado desta auditoria: é o ponto mais cego dos dois. |
| `gate_rejeicao_b` | `v2/lib/gate-llm.mjs` (camada B do gate de rejeição, `SPEC-SLICE-1-GATE-REJEICAO.md`) | Ainda **não chama LLM em produção** — hoje só `judgeOffline()`, um passe de referência offline. Vira 3º emissor real quando a edge function de produção ligar a chamada viva. | N/A ainda — a interface desta spec já deve caber esse estágio sem redesenho quando ele ligar. |

## 1. Schema proposto — `llm_jobs` (ledger, aditivo)

Migration nova `v2/db/migrations/015_llm_jobs.sql` (estilo das migrations 004/011: aditiva,
idempotente, sem seed de valor que precise aprovação — aqui não há valor a aprovar, é
telemetria).

```sql
create table if not exists public.llm_jobs (
  id            bigint generated always as identity primary key,
  estagio       text not null check (estagio in (
                  'extracao_campanhas', 'radar_vpm_match', 'radar_vpm_promo',
                  'radar_vpm_extracao', 'gate_rejeicao_b'
                )),
  provider      text not null check (provider in ('openrouter', 'ollama', 'mock')),
  modelo        text not null,
  tokens_in     integer,
  tokens_out    integer,
  custo_usd     numeric(10,6),         -- calculado de tokens x preco do model_registry
  latencia_ms   integer,
  status        text not null check (status in ('ok', 'erro', 'fallback')),
  fallback_de   text,                  -- modelo original, quando status='fallback'
  erro          text,
  job_ref       text,                  -- correlação opcional (ex.: runs.id, news_raw.id)
  criado_em     timestamptz not null default now()
);
create index if not exists llm_jobs_estagio_dia_idx
  on public.llm_jobs (estagio, (criado_em::date));
```

`estagio` como `CHECK` fechado (não domínio-como-tabela tipo `motivos_rejeicao`): estágios
são **arquitetura** (cada um corresponde a um ponto de código específico), não dado de
negócio que cresce por INSERT do operador. Novo estágio = nova migration pequena, mesmo
padrão de qualquer mudança de código.

## 2. Schema proposto — `model_registry` (REQ-35)

```sql
create table if not exists public.model_registry (
  estagio               text primary key references public.llm_jobs(estagio) on delete restrict
                         deferrable initially deferred, -- ver nota abaixo
  modelo_principal       text not null,
  modelos_fallback       text[] not null default '{}',
  preco_input_por_1k_usd  numeric(10,6),
  preco_output_por_1k_usd numeric(10,6),
  teto_tokens_por_chamada integer,
  ativo                  boolean not null default true,
  atualizado_em          timestamptz not null default now()
);
```

**Nota:** a FK para `llm_jobs.estagio` exige que `estagio` seja `UNIQUE`/chave em algum
lugar — na prática mais simples é **não** referenciar `llm_jobs` (evita acoplar DDL de
telemetria a config) e manter os dois com o **mesmo `CHECK`** de valores válidos,
duplicado propositalmente (o padrão já usado no projeto entre tabelas relacionadas).
Troca de modelo = `UPDATE model_registry SET modelo_principal=... WHERE estagio=...`
— sem deploy (REQ-35, satisfeito por desenho).

**Preço por modelo:** não vai chutado nesta spec. `preco_input_por_1k_usd`/
`preco_output_por_1k_usd` precisam do preço publicado real do OpenRouter por modelo no
momento do seed — **isto é um INSERT a aprovar depois** (mesmo padrão de
`custo_base_moeda`/migration 011: a migration só cria a tabela vazia; o seed com valor
real é uma proposta separada, com fonte e data, antes de aplicar).

## 3. `LLM_DAILY_BUDGET_USD` — o que esta slice cobre e o que não cobre

REQ-35 pede um guardrail que "manda itens à fila, não quebra" quando o orçamento diário
estoura. **Isto é comportamento de runtime dos emissores** (decidir o que fazer quando o
teto bate) — fora do escopo de um *painel*. Esta slice entrega a **visibilidade**: o
painel mostra o consumo do dia contra o teto configurado (env var ou linha de config),
para o operador ver o quanto falta antes de estourar. **O enforcement (degradação
graciosa) é uma tarefa separada**, que consome os mesmos dados mas vive nos três
emissores do §0, não aqui — registrado como próximo passo, não construído nesta slice.

## 4. A consulta do painel

Agregação por dia × estágio sobre `llm_jobs`, pronta pra virar tela em `/admin` (que já
existe no v1 — `app/admin`, `components/admin`):

```sql
select
  criado_em::date as dia,
  estagio,
  count(*)                                   as chamadas,
  sum(tokens_in)                             as tokens_in_total,
  sum(tokens_out)                            as tokens_out_total,
  sum(custo_usd)                             as custo_usd_total,
  percentile_cont(0.5) within group (order by latencia_ms) as latencia_p50_ms,
  percentile_cont(0.95) within group (order by latencia_ms) as latencia_p95_ms,
  count(*) filter (where status = 'erro')     as erros,
  count(*) filter (where status = 'fallback') as fallbacks
from public.llm_jobs
group by 1, 2
order by 1 desc, 2;
```

Mais uma visão "custo por edição Daily publicada" (junta com `editions`): soma dos
estágios cujo `job_ref` cai dentro da janela de uma edição específica, dividida pelo
número de edições publicadas naquele dia. Ver §5 sobre por que a meta associada a essa
visão ainda não é definível com precisão.

## 5. Achado — "meta de custo por edição" ainda não tem um número real para medir contra

NFR-01 trava custo como requisito de arquitetura ("caixa R$0"). Mas hoje **nenhum dos três
estágios roda por causa de uma edição existir** — extração e Radar VPM rodam
independentemente (coleta contínua), e o Digest Engine (a peça que redigiria o texto da
edição, o único lugar onde uma chamada de LLM aconteceria *porque* uma edição está sendo
montada) **ainda não existe** (depende dos vetores fecharem, fora desta slice). Ou seja:
o **custo marginal real de uma edição Daily, hoje, é ~R$0** — não porque o sistema é
barato, mas porque nada ainda gasta *por causa* da edição.

**Proposta:** esta slice mede e expõe o custo **agregado por estágio/dia** dos emissores
que já existem (útil desde já, com ou sem edição publicada) e deixa a **meta de custo por
edição** como **pendente**, a definir quando o Digest Engine especificar quais chamadas de
LLM (se houver — redação pode ser 100% template + dado, sem LLM nenhuma, dependendo do
desenho) rodam por edição. Não travo um número aqui para não fabricar meta sem base — é
exatamente o tipo de "chutar" que o projeto proíbe para dado editorial (INV-07), e o
mesmo princípio vale para meta de custo.

## 6. Entregas desta slice

- Migration `015_llm_jobs.sql`: cria `llm_jobs` + `model_registry` (vazias, sem seed de
  preço).
- Consulta de painel (§4) documentada e testável contra dados sintéticos (fixture de
  `INSERT`s de exemplo, não dado real).
- Plano de instrumentação dos dois emissores reais (`campaigns/index.ts`, `llm.mjs`) —
  **documentado aqui, não implementado nesta slice**: tocar a edge fn de novo é outro
  deploy (regra de escrita única, já em vigor nesta sessão) e fica para depois da
  aprovação deste schema, como incremento próprio (mesma disciplina usada para a v15).
- Interface do estágio `gate_rejeicao_b` já prevista no `CHECK` de `llm_jobs.estagio`,
  para não exigir migration nova quando a camada B ligar de verdade.

## 7. Fora de escopo

- Instrumentar de fato os emissores (fica para depois da aprovação do schema).
- Enforcement do `LLM_DAILY_BUDGET_USD` (degradação graciosa em runtime) — §3.
- Seed de preço real por modelo — precisa de fonte (tabela de preços do OpenRouter na
  data do seed), proposta separada com proveniência, mesmo padrão de `custo_base_moeda`.
- UI definitiva do painel em React — esta spec define schema + consulta; uma tabela HTML
  simples em `/admin` já cobre a Definição de Pronto abaixo.

## 8. Definição de pronto

1. Migration `015_llm_jobs.sql` aprovada e aplicada (tabelas vazias).
2. Consulta do §4 rodando contra dados sintéticos sem erro.
3. Plano de instrumentação dos 2 emissores reais documentado como próxima tarefa
   (não implementado aqui).
4. Decisão registrada sobre a meta de custo por edição: **pendente**, não fabricada,
   revisitada quando o Digest Engine especificar suas chamadas de LLM (se houver).

*Promoções podem mudar sem aviso. Confira sempre as regras no site oficial antes de
comprar, transferir ou resgatar.*
