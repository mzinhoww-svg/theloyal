# Medição de estancamento — edge fn v15 (âncora de ano)

> **Estado da v15:** deployada em prod (2026-07-17 14:30Z, version 15, `verify_jwt=false`),
> testada offline dos dois lados (20/20 golden + 20/20 flag inline, não-regressão bloqueante
> verde), coleta viva (invoke 200, cron a cada 5 min). **PENDENTE: confirmação de estancamento
> em produção** — a prevenção só está *comprovada* quando notícia **nova** nascer com data
> válida e o `yr_off` cair contra o baseline. O teste offline **não** exercita a mudança de
> comportamento do LLM (passar `published_at` ao prompt muda como o modelo responde; só se vê
> em prod real). Enquanto não medido: v15 = *deployada e testada, aguardando confirmação*.

## Por que a medição espera o próximo ciclo

No deploy a fila estava **vazia** (0 notícias novas). "Sem notícia nova para medir" **não é**
"não estancou". A âncora age em notícias extraídas **depois** de 2026-07-17 14:30Z. A medição
roda quando o cron `extract-2h` processar a **primeira leva de notícias novas pós-v15**
(sinal: `runs.human_note LIKE 'extract v15%'` com `campaigns_found > 0`).

## Baseline pré-v15 (a régua do "antes")

Base viva `qjqnqcsdnpvvmyzkavoq`, medido no deploy (2026-07-17). Só origem `daily` tem
`published_at`. De **24 campanhas datadas**, **50% (12/24) com yr_off** (`gap>365d`, evento
mais de 1 ano antes da publicação = ano fabricado). O flag v14 (±65d) marcava 9; o flag
reconciliado da v15 (±65d **OU** gap>365) marca 12 — os 3 extra são os gaps sujos do Patch 2.

## Instrumento — rodar quando houver notícia nova pós-v15

**1) Detectar se já houve ciclo v15 com extração (>0):**

```sql
select human_note, campaigns_found, started_at
from runs
where product = 'extract' and human_note like 'extract v15%' and campaigns_found > 0
order by started_at desc
limit 10;
```

Se vazio → ainda não houve notícia nova pós-v15; a medição continua pendente.

**2) Medir yr_off das campanhas novas pós-v15** (extraídas após o deploy — `observed_at` no
dia do deploy ou depois E `published_at` recente; refinar o corte para dias inteiros
pós-deploy conforme o ciclo real):

```sql
with novas as (
  select
    published_at::date as prov_date,
    date_suspect,
    coalesce(
      vigencia_inicio,
      case when vigencia_fim ~ '^\d{4}-\d{2}-\d{2}$' then vigencia_fim::date else null end
    ) as event_date
  from campaigns
  where origin = 'daily'
    and published_at is not null
    and published_at >= '2026-07-17'        -- notícias publicadas a partir do deploy
    and observed_at   >= date '2026-07-17'  -- observadas no ciclo pós-v15
)
select
  count(*)                                                            as n_novas_datadas,
  count(*) filter (where (prov_date - event_date) > 365)             as yr_off,
  round(100.0 * count(*) filter (where (prov_date - event_date) > 365)
        / nullif(count(*),0), 1)                                     as pct_yr_off,
  count(*) filter (where date_suspect)                              as flag_suspect
from novas
where event_date is not null;
```

## Leitura do resultado

- **`pct_yr_off` cai para perto de 0** (contra o baseline 50%) → **origem comprovadamente
  estancada**. A v15 fecha; o predict tem janela confiável para o futuro. Registrar no handoff.
- **`pct_yr_off` NÃO cai** → a âncora não pegou no LLM. **Ajustar o prompt** (`yearAnchor` /
  `SYSTEM`) antes de seguir — não declarar estancado. A extração viva continua (não regride:
  a v15 só previne + flaga, nunca corrige sozinha).

## Coordenação com a reconstrução do histórico (pergunta ao predict)

A confirmação `yr_off→0` valida o **futuro protegido**; **não** é necessariamente
pré-requisito para consertar o **passado**. Ver §6.3 do HANDOFF: a reconstrução do histórico
pode rodar já (conjuntos disjuntos — v15 protege o novo, reconstrução conserta o velho),
**salvo** se ela reprocessar registros que o cron ainda pode tocar (aí espera a confirmação).
Predict decide: *a reconstrução toca linha que o cron re-extrai?*

*Promoções podem mudar sem aviso. Confira sempre as regras no site oficial antes de comprar,
transferir ou resgatar.*
