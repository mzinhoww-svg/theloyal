# Encerramento administrativo — Radar P1

> Registro definitivo de encerramento do P1 do Radar Preditivo de Campanhas.
> Este documento é administrativo: **não altera código, banco, migration, dado
> ou conteúdo**. Consolida, num único lugar, os fatos do merge do PR #54 e as
> regras de congelamento. Complementa (não substitui) os documentos pré-merge
> `HANDOFF-P1-RADAR.md`, `VERIFICACAO-FINAL-P1-RADAR.md`,
> `REVISAO-HUMANA-P1-RADAR.md` e `IMPLEMENTACAO-P1E-POLISH-RADAR.md`, que
> descrevem a preparação; aqui fica o encerramento em si.

## 1. Resumo

O P1 do Radar — camada de composição e experiência em runtime sobre C0/C0.2 e
os motores Forecast/Predict — foi **concluído e mergeado** pelo PR #54 em
2026-07-15. CI verde, suíte determinística 225/225, typecheck/lint/build
aprovados. Os seis achados da revisão humana (**M1, M2, M3, B1, B2, B3**) estão
resolvidos. A dívida **A1** permanece registrada como item pós-P1 e **não** é
bloqueadora. A partir deste registro, o P1 está encerrado do ponto de vista
administrativo: a branch de origem está congelada e qualquer trabalho novo exige
branch e PR novos.

## 2. Escopo entregue

- **`/admin/radar`** — entrada única com abas `?view=` (geral, oportunidades,
  revisões, bloqueios, operação): saúde, KPIs, filtros, tabela unificada, resumo
  operacional, alertas, filas e "o que mudou" honesto.
- **`/admin/radar/[seriesKey]`** — detalhe da série: resumo executivo, previsão
  principal (Predict quando pronto, Forecast fallback rotulado, senão Não
  confirmado), comparação Forecast×Predict com divergência, qualidade, campanhas
  usadas e excluídas, warnings×bloqueios, backtest, explicabilidade, timeline e
  links técnicos.
- **Navegação:** grupo *Radar* + grupo *Análise técnica* (Forecast/Predict/VPM/
  Observability preservados e acessíveis).
- **Natureza:** composição pura sobre o `RadarViewModel` — sem segunda leitura do
  ledger, sem segunda fonte de verdade, sem novo cálculo de Forecast/Predict/
  qualidade/frescor/divergência, sem persistência nova, sem alterar motores/gates.

## 3. PR e commit

| Campo | Valor |
|---|---|
| PR | **#54** — *docs: auditoria e arquitetura-alvo do Radar Preditivo (Forecast/Predict)* |
| Estado | **closed / merged** (não-draft no merge) |
| Head mergeado | **`0c0cc23`** (`0c0cc23295089bb3a336b0cf30aa5cd9dbb7c98b`) |
| Branch de origem (congelada) | `claude/forecast-predict-audit-nyswiw` |
| Branch de destino | `claude/loyalty-landing-page-v1-7vbjq7` |
| Merge commit | `854137a` |
| Data do merge | **2026-07-15T17:37:45Z** |
| Autor do merge | `mzinhoww-svg` |
| CI no head mergeado | **success** (Vercel — deployment completed, `0c0cc23`) |
| Commits posteriores relevantes na branch encerrada | **nenhum** (o último commit da branch é o próprio head mergeado `0c0cc23`) |

## 4. Validações

- **Testes:** suíte determinística **225/225** (inclui `radar-parity`,
  `radar-ui-contract`, `radar-operations`, `radar-detail`, `radar-filters` e o
  `radar-polish` do P1-E).
- **Qualidade estática:** `typecheck`, `lint` e `build` verdes; `/admin/radar`,
  `/admin/radar/[seriesKey]` e o boundary de erro compilam.
- **CI/preview:** deploy Vercel **success** sobre o head mergeado `0c0cc23`.
- **Achados da revisão humana:** M1 (view inválido com aviso), M2 (link de
  placeholders isola o dado), M3 (um h1 + h2 por seção), B1 (`load_error`
  acionável, sem stack, com retry e diagnóstico), B2 (nenhum resultado via
  catálogo) e B3 (resumo compacto na geral, completo na operação) — **todos
  resolvidos**, cada um encodado em teste.
- **Limitação declarada (herdada da verificação):** as rotas `/admin/*` exigem
  cookie de sessão e `SUPABASE_SERVICE_ROLE_KEY`; a validação foi por fixtures,
  testes e inspeção de código, sem clique-a-clique autenticado contra produção.
  Nenhuma leitura do banco de produção nesta etapa.

## 5. Documentação produzida

O P1 deixa o seguinte corpo documental (todos versionados no repositório):

- `docs/HANDOFF-P1-RADAR.md` — contrato técnico e de produto do P1.
- `docs/IMPLEMENTACAO-P1A/B/C/D-RADAR.md` — implementação das ondas A→D.
- `docs/IMPLEMENTACAO-P1E-POLISH-RADAR.md` — onda de polish (M1–M3, B1–B3).
- `docs/REVISAO-HUMANA-P1-RADAR.md` — revisão humana e achados.
- `docs/VERIFICACAO-FINAL-P1-RADAR.md` — verificação de fechamento pré-merge.
- `docs/AUDITORIA-PREDICT-FORECAST.md` e
  `docs/ARQUITETURA-PRODUTO-RADAR-PREDITIVO.md` — auditoria e arquitetura-alvo.
- `docs/architecture/adr/` — pacote de ADRs (`proposed`, 001–010).
- **Este documento** — `docs/ENCERRAMENTO-RADAR-P1.md`, o registro de
  encerramento administrativo pós-merge.

## 6. Dívida A1

**A1 permanece dívida pós-P1, registrada e não bloqueadora.** As telas técnicas
legadas `/admin/forecast` e `/admin/predict` selecionam 7 colunas (sem
proveniência) e ainda podem exibir o intervalo de 943 dias em
`livelo→connectmiles`. O **Radar continua a superfície correta** — lê as 12
colunas de proveniência e contém o caso 943 (exclusão por `suspect_year`, sem
janela 2029). A correção (paridade de colunas / unificação das telas) é da fase
estrutural e **não** foi feita no P1. Referências: HANDOFF §7, REVISAO-HUMANA §8,
VERIFICACAO-FINAL §15, IMPLEMENTACAO-P1A §4, IMPLEMENTACAO-P1E §1.

## 7. Itens fora do P1 (fase estrutural — exige migration/ADR aceito)

Aprovação editorial persistida; snapshot canônico + `prediction_snapshot_usages`;
Editorial Score definitivo; `prediction_outcomes`/calibração; identidade
(`campaign_identity`/`campaign_version`/`source_observation`) e merge de
duplicidades; novo modelo de vigência (`data_evento`/`vigencia_type`); catálogo
persistido de `programs`/aliases; reconciliador canônico persistido; integração
Predict→Daily/Weekly/Pro; automação de publicação; correção persistida dos dados.
Cada item depende de uma decisão registrada nos ADRs `proposed` (001–010). **A
fase estrutural não foi iniciada.**

## 8. Regra de não reutilização da branch

- A branch de origem **`claude/forecast-predict-audit-nyswiw` está congelada**.
  Não recebe novos commits, não é reaberta e não é reutilizada.
- O **PR #54 está encerrado**; nenhuma ação adicional deve ocorrer nele (sem
  reabertura, sem novos commits, sem novos comentários operacionais).
- **Qualquer trabalho novo exige branch e PR novos**, partindo do estado mergeado
  atual do destino. Nada é empilhado sobre a história já mergeada.

## 9. Próximos passos

1. Planejar a fase estrutural a partir dos ADRs `proposed` (001–010), promovendo
   as decisões necessárias antes de qualquer migration.
2. Endereçar A1 (paridade de colunas / unificação das telas técnicas) dentro
   dessa fase, sem remover as telas existentes.
3. Abrir branch e PR novos para cada frente estrutural; este encerramento não
   autoriza início de implementação estrutural.

## 10. Responsáveis futuros

- **Radar Program Coordinator** — recebe este handoff, custodia o registro de
  encerramento e prioriza a fase estrutural e a dívida A1.
- **Decisão de merge / retirada de draft e futuras aprovações** — `mzinhoww-svg`
  (autor do merge do PR #54), como responsável humano do repositório.
- **Fase estrutural** — a ser designada pelo coordenador na abertura da fase; não
  atribuída neste encerramento.
