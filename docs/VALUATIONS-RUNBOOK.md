# VALUATIONS-RUNBOOK — Ritual mensal da régua (The Loyal)

> **Régua = fonte única de veredito.** Piso/teto de R$/milheiro por programa é a
> régua contra a qual todo CPM/VPM vira veredito. **Regra de ouro: a régua nunca
> muda em silêncio — toda alteração é datada, versionada e justificada.**

## Onde a régua vive (arquitetura real)

A régua **não** é arquivo `.json` nem `engine/score.mjs`. Ela vive no **Supabase**
do projeto `the-loyalty` (`project_id = qjqnqcsdnpvvmyzkavoq`), acessado pelo
**conector Supabase** (persiste entre runs agendados — não precisa de token no ambiente).

Tabelas relevantes (schema `public`):

| Tabela | Papel | Colunas-chave |
|---|---|---|
| `valuations` | A régua, versionada | PK (`period_id`,`program`); `piso`,`teto`,`confidence`,`source`,`is_current`,`updated_at` |
| `campaigns` | Ledger de campanhas (obs. de CPM/transferência) | `origem`,`destino`,`tipo`,`cpm_value`,`tl_score`,`verdict`,`vigencia_*`,`observed_at` |
| `passagens` | Banco D de **resgate** (base do VPM) | `programa`,`origem`,`destino`,`milhas`,`taxas`,`observed_at`,`source_url` |
| `runs` | Log de execuções | `product`,`kind`,`status`,`started_at`,`finished_at`,`human_note` |

- **Vigente** = `valuations WHERE is_current = true`.
- **Versão do mês** = linhas com `period_id = 'AAAA-MM'`.
- **VPM implícito** = `tarifa_cash_da_rota / (milhas / 1000)` — só calculável com
  observação em `passagens` (preço de tarifa em dinheiro verificável). Sem isso,
  **mantém-se piso/teto** e ajusta-se só `confidence`.

## Passo a passo (mensal — fecha-mês do Pro)

Use sempre `execute_sql` do conector Supabase em `project_id=qjqnqcsdnpvvmyzkavoq`.

### 1. Levantar régua vigente + cobertura do banco D
```sql
select period_id, program, piso, teto, confidence, source, updated_at
from valuations where is_current = true order by program;

select count(*) as passagens from passagens;                 -- base do VPM
select destino as program, count(*) n, round(avg(cpm_value),2) avg_cpm,
       min(cpm_value) min_cpm, max(cpm_value) max_cpm, max(observed_at) last_obs
from campaigns where tipo='transferencia' and cpm_value is not null
group by destino order by n desc;
```

### 2. Calcular VPM implícito por programa (quando houver `passagens`)
Para cada programa com observações de resgate:
`VPM = valor_cash_comparavel / (milhas / 1000)`. Compare com piso/teto vigentes.
Para bancos/coalizão sem resgate direto (Livelo, Esfera), reavalie via **VPM de
transferência** para o destino aéreo (paridade + bônus). CPM de compra **não** é
insumo de piso/teto (é custo, não valor).

### 3. Decidir movimento (só drift material)
- Mova piso/teto **apenas** se: variação **≥5%** sustentada **ou** evento estrutural
  (desvalorização, nova tabela de resgate, mudança de paridade/regra).
- Movimento pequeno / ruído → **manter**.
- **Desvalorização detectada** → sinalizar no relatório que um **The Loyal Special**
  deve ser produzido.
- **Sem cash de referência confiável** (`passagens` sem cobertura p/ o programa) →
  **manter piso/teto**; no máximo ajustar `confidence`.

### 4. Escrever a nova versão do mês (só se algo mudou)
Versionamento por `period_id` + flip de `is_current` (nunca apagar versão antiga):
```sql
-- exemplo: nova versão de AGOSTO copiando julho e mexendo só no que tem base
insert into valuations (period_id, program, piso, teto, confidence, source, is_current, updated_at)
select 'AAAA-MM', program, piso, teto, confidence, 'ritual-AAAA-MM', false, current_date
from valuations where is_current = true
on conflict (period_id, program) do nothing;

-- aplicar ajustes datados/justificados nas linhas do novo period_id (piso/teto/confidence) ...

-- promover: desligar a régua antiga e ligar a nova, atômico
begin;
update valuations set is_current = false where is_current = true;
update valuations set is_current = true  where period_id = 'AAAA-MM';
commit;
```
Se **nada** mudou no mês, **não** crie novo `period_id`: a régua vigente continua valendo.

### 5. Changelog datado
Anexe uma entrada em `docs/VALUATIONS-CHANGELOG.md` (programa, de→para, motivo, fonte,
ou "MANTIDO — motivo"). Toda alteração precisa de linha no changelog.

### 6. Logar a execução em `runs`
```sql
insert into runs (product, kind, status, started_at, finished_at, human_note)
values ('valuations','scheduled','ok', now(), now(), '<resumo do run: o que mudou/manteve>');
```

### 7. Entregar o relatório
Salvar `valuations-AAAA-MM-run.md` no outputs com: o que mudou (programa, de→para,
motivo, fonte), o que se manteve, cobertura do banco D, e se algum programa exige
Special por desvalorização. Commit/push do changelog + relatório no repo.

## Regressão / sanidade
```sql
-- exatamente uma régua vigente por programa
select program, count(*) from valuations where is_current=true group by program having count(*)<>1;
-- piso <= teto em toda a régua vigente
select program, piso, teto from valuations where is_current=true and piso > teto;
```
Ambas devem voltar **vazias**.

## Gargalo conhecido
`passagens` está vazia — enquanto não houver observação de resgate, o VPM não é
calculável e a régua só pode ser mantida (nunca movida sem base). Prioridade
operacional: alimentar `passagens` com tarifas cash verificáveis por rota/programa.
