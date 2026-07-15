# Revisão humana final — P1 do Radar (PR #54)

## 1. Resumo executivo

O P1 do Radar (ondas A→D) entrega uma entrada única `/admin/radar` com visão
geral, filas operacionais, detalhe de série e paridade comprovada com as telas
técnicas, **sem** alterar motores, gates, qualidade, banco ou conteúdo. A revisão
**não encontrou bloqueadores**. Encontrou **1 problema alto** (discrepância visível
entre `/admin/forecast` e o Radar para o caso 943, por seleção de colunas —
documentado como dívida pós-P1, com o Radar sendo a superfície correta), **3
médios** e **3 baixos**, todos de UX/experiência e nenhum afetando uma previsão
**publicável**. O caso crítico 943 está **contido**. CI verde, `mergeable_state`
clean, documentação completa.

**Decisão: APROVADO COM AJUSTES.** (ver §22)

## 2. Ambiente revisado

- **PR #54**, branch `claude/forecast-predict-audit-nyswiw`, head `0bc5cd4`.
- **Preview Vercel:** deploy com status **success** (CI) sobre `0bc5cd4`.
- **Método:** revisão fundamentada em (a) inspeção do código do P1 (páginas,
  componentes e módulos puros do Radar), (b) a suíte determinística de testes que
  **encoda os comportamentos de produto** (contenção 943, fallback rotulado,
  filtros, filas, divergência, estados vazios) — 216/216 verdes — e (c)
  `typecheck`/`lint`/`build` verdes e o deploy do preview verde.
- **Limitação declarada:** o `/admin/*` exige cookie de sessão e
  `SUPABASE_SERVICE_ROLE_KEY`; não foi feito um clique-a-clique autenticado no
  preview com dados de produção. Os comportamentos foram verificados pelos testes
  de fixtures (que reproduzem o caso 943 e os fluxos) e pela leitura do código —
  não por navegação manual autenticada. Nenhuma leitura do banco de produção foi
  feita nesta revisão.

## 3. Perfis avaliados

Editor ("o que merece atenção / apto / bloqueado / por quê / abrir primeiro"),
Analista ("motor principal / divergência / janela / probabilidade / usadas /
excluídas / motivo / temporal / duplicidade / backtest"), Operador ("base
completa / fresca / falhas / suspeitas / duplicidades / placeholders / risco /
onde diagnosticar").

## 4. Rotas revisadas

`/admin/radar` (views `?view=oportunidades|revisoes|bloqueios|operacao`);
`/admin/radar/[seriesKey]`; `/admin/forecast`; `/admin/predict`;
`/admin/observability`.

## 5. Resultado por etapa

| Etapa | Resultado | Observação |
|---|---|---|
| A. Entrada e orientação | **OK** | Radar como produto; abas; saúde/frescor/completude no topo, acima dos KPIs |
| B. Visão geral | **OK c/ ressalva** | KPIs com contexto; motor principal e fallback rotulados; probabilidade com horizonte; cluster "(agregado)". Ressalva: seções sem heading próprio (M3) |
| C. Filtros | **OK** | 14 filtros por AND, query params preservados, "nenhum resultado" tratado; cluster não aparece como rota |
| D. Filas | **OK** | Oportunidades sem bloqueadas; bloqueios globais × por série; stale como alerta; sobreposição explícita ("+N filas"). Ressalva de nomenclatura de view (M1) |
| E. Detalhe | **OK** | Resumo antes dos detalhes; uma previsão principal; fallback rotulado; sem probabilidade inventada; usadas/excluídas auditáveis; backtest insuficiente não escondido; timeline sem histórico inventado |
| F. Caso 943 | **CONTIDO** | ver §11 |
| G. Telas técnicas | **OK c/ alto** | Funcionais; significado preservado. Alto: discrepância visível 943 entre `/admin/forecast` e Radar (A1) |
| H. Acessibilidade/responsividade | **OK c/ ressalva** | Badges com texto, tabelas com header, `<details>` nativo, foco visível herdado. Ressalva: headings de seção (M3) |

## 6. Achados

| ID | Tela | Perfil | Problema | Evidência | Severidade | Impacto | Correção recomendada |
|---|---|---|---|---|---|---|---|
| A1 | `/admin/forecast` × `/admin/radar` | Analista | Mesma rota `livelo→connectmiles` mostra dados diferentes: Forecast exibe 2 ondas + "Maior interv. 943d" (vermelho); Radar contém A (exclui) e mostra 1 onda, sem 943 | `admin-forecast.ts:180` seleciona 7 colunas (sem proveniência) → `suspect_year` não dispara; `admin-radar.ts` seleciona 12 → contém | **Alta** | Analista comparando as duas telas vê 943 numa e ausente na outra; pode duvidar de qual é correta (o Radar é o correto) | Paridade de colunas em `/admin/forecast`/`/admin/predict` OU unificação/migração das telas (pós-P1; **proibido** nesta etapa). Já registrado em HANDOFF §7 e IMPLEMENTACAO-P1A §4 |
| M1 | `/admin/radar` (views) | Editor/Operador | Parâmetro de view é pt-BR (`oportunidades`…); view inválida (ex.: `?view=opportunities`) cai em "geral" **sem aviso** | `page.tsx:40` (`includes(viewRaw) ? … : "geral"`) | **Média** | Link compartilhado com nome divergente leva à visão geral silenciosamente | Aceitar aliases (en) OU exibir aviso "aba não encontrada" para view desconhecida |
| M2 | `/admin/radar?view=operacao` | Operador | Link de diagnóstico do alerta de placeholders aponta `?cause=qualidade_temporal`, que **não isola** placeholders | `radar-operations.ts:127` | **Média** | Operador clica no diagnóstico e não vê os placeholders afetados | Apontar para um recorte que mostre placeholders (ou remover o link até haver filtro de placeholder) |
| M3 | `/admin/radar` (geral) e detalhe | Todos (a11y) | Seções (resumo operacional, saúde, KPIs, resumo da série) são `<section>` sem heading — navegação por heading pula do h1 para a 1ª `<h2>` | `radar.tsx` `RadarHealthSummary`/`RadarKpis`; `radar-detail.tsx` `RadarSeriesSummary` | **Média** | Leitor de tela não ancora nessas seções | Adicionar headings de seção (visíveis discretos ou `sr-only`) |
| B1 | `/admin/radar` | Operador | Estado `load_error` existe no catálogo mas **não é acionável**: `fetchAllRows` captura tudo e retorna `complete:false` (nunca lança); falha vira "base incompleta" | `admin-db.ts:70-73`; `radar-empty.ts` (`load_error`) | **Baixa** | Nenhum bug real; entrada de catálogo sem caminho | Adicionar `error.tsx` de rota OU remover a entrada até haver caminho de erro |
| B2 | `/admin/radar` (tabela) | Todos | "Nenhum resultado após filtros" é texto inline, não o `RADAR_EMPTY.no_filter_results` do catálogo consolidado | `radar.tsx:254` | **Baixa** | Leve inconsistência de fonte única de mensagens | Consumir o catálogo |
| B3 | `/admin/radar` geral × operação | Todos | Resumo operacional aparece nas duas views | `page.tsx` (geral e operacao renderizam `RadarOperationalSummary`) | **Baixa** | Redundância leve | Manter em uma só, ou variar densidade |

## 7. Bloqueadores

**Nenhum.** Nenhum item impede uso seguro nem gera previsão incorreta publicável.

## 8. Problemas altos

**A1** — discrepância visível do caso 943 entre `/admin/forecast` (mostra 943) e o
Radar (contém). O Radar é a superfície **correta**; a divergência vem de
`/admin/forecast` selecionar 7 colunas (sem proveniência), gap **documentado** como
dívida pós-P1. **Não afeta nenhuma previsão publicável** (a série é bloqueada nas
duas telas) — afeta uma comparação técnica de auditoria. A correção (paridade de
colunas/unificação das telas) é pós-P1 e **proibida** nesta revisão.

## 9. Problemas médios

M1 (fallback silencioso de view), M2 (link de diagnóstico de placeholders), M3
(headings de seção).

## 10. Problemas baixos

B1 (`load_error` não acionável), B2 ("nenhum resultado" inline), B3 (resumo
duplicado).

## 11. Validação do caso 943

**Contido.** Evidência (fixtures `livelo→connectmiles` A/B em `radar-detail.test`,
`radar-parity.test`, `campaign-quality.test`):
- registro A (`vigencia_fim=2023-12-12`, `first_seen=2026-07-12`) → **excluído**,
  `temporal.status=suspect_year` → rótulo "**possível erro de ano**", `dayDifference=943`;
- par A/B → **duplicidade provável** com `relatedCampaignIds`;
- **sem** intervalo de 943 dias; **sem** janela/previsão 2029; série
  `data_quality_blocked` (não aparece como oportunidade);
- localizável via filas (suspeitos, duplicidades, bloqueadas) e filtros
  (`quality=bloqueada`, `duplicate=probable`);
- nenhuma data corrigida automaticamente.

## 12. Validação do Forecast

Paridade **total**: `series.forecast` é o objeto do `buildForecast` (teste
`radar-parity` caso 1). Janela/confiança/amostra/cadência/bônus típico/maior
intervalo/elegibilidade/warnings/bloqueio preservados; traduções no detalhe
("histórico válido", "maior intervalo histórico", "apta para publicação").

## 13. Validação do Predict

Paridade **total**: `series.predict` é o objeto do `buildPredict` (teste
`radar-parity` caso 2). Readiness traduzido; probabilidades P30/P60/P90 no detalhe,
uma principal na listagem; central date, bônus, backtest e explicação preservados;
sem probabilidade inventada em fallback.

## 14. Validação da qualidade

Paridade **total** com `assessCampaignQuality`; contadores da saúde batem com
`quality.counters`; excluídas com motivo/flags/severidade/duplicidade; `QualityPanel`
reutilizado no detalhe.

## 15. Validação dos filtros

14 filtros por AND (busca, origem, destino, escopo, status, elegibilidade,
confiança, causa, frescor, duplicidade, qualidade, motor, disponibilidade
Predict/Forecast); query params preservados; cada filtro recorta pelo campo
existente (teste `radar-parity` caso 8); "nenhum resultado" tratado; cluster não
aparece como rota. **OK.**

## 16. Validação das filas

8 filas; oportunidades **não** contêm bloqueadas; bloqueios globais × por série
separados; duplicidades/histórico insuficiente/sem previsão nas filas corretas;
stale como alerta operacional; sobreposição explícita ("+N filas"); ações levam ao
detalhe/diagnóstico. **OK** (ressalva M2 no link de placeholders).

## 17. Validação do detalhe

Resumo executivo responde a situação antes dos detalhes; uma previsão principal;
Predict principal quando pronto; Forecast como baseline/fallback rotulado;
comparação e divergência explicadas em linguagem de produto; usadas/excluídas
auditáveis; backtest insuficiente não escondido; timeline sem histórico inventado;
links técnicos presentes. **OK.**

## 18. Acessibilidade

Badges sempre com texto (validado por `radar-ui-contract`); tabelas com `<Th>`;
`<details>` nativo; abas com `aria-current`; filtros com `<label>`; foco visível e
landmarks herdados do layout do Admin. **Ressalva M3:** seções da visão geral e do
resumo da série sem heading próprio.

## 19. Responsividade

Tabelas em `overflow-x-auto` (não quebram a página); filtros/abas com `flex-wrap`;
cards em grid `auto-fill`; detalhe legível. Sem redesenho mobile — comportamento
previsível em desktop/tablet/estreito. **OK** (verificação por estrutura CSS, não
por dispositivo real).

## 20. Estado do CI

**success** — deploy Vercel concluído sobre `0bc5cd4`. Localmente: `npm test`
**216/216**, `typecheck`, `lint`, `build` verdes.

## 21. Estado de mergeabilidade

`mergeable_state: clean`; PR **aberto e em draft**; head `0bc5cd4`.

## 22. Decisão final

**APROVADO COM AJUSTES.**

Justificativa contra os critérios do §7: (1) sem bloqueadores; (2) o único ALTO
(A1) **não afeta interpretação de previsão publicável** — a série 943 é bloqueada
em ambas as telas; (3) 943 contido; (4) Predict principal correto; (5) fallback
rotulado; (6) filtros corretos; (7) filas corretas; (8) detalhe auditável; (9)
telas técnicas intactas; (10) acessibilidade básica aceitável (ressalva M3); (11)
preview estável; (12) CI verde; (13) mergeable clean; (14) documentação completa;
(15) banco/motores/conteúdo não alterados. Restam ajustes Médios/Baixos e o ALTO
como dívida rastreada (fix pós-P1).

## 23. Correções obrigatórias (antes de sair de draft)

Nenhuma correção de **código** é obrigatória para o P1 do Radar em si (não há
bloqueador). **Obrigatório apenas** decidir o tratamento de **A1** antes/como parte
da unificação das telas (pós-P1): assumir formalmente a dívida (o Radar é a fonte
correta) e planejar a paridade de colunas / migração — **não** nesta etapa.

## 24. Correções recomendadas (não bloqueiam o merge)

- **M1:** aviso para `?view=` desconhecido (ou aceitar aliases).
- **M2:** corrigir o link de diagnóstico do alerta de placeholders.
- **M3:** adicionar headings de seção (a11y).
- **B1/B2/B3:** wire/remoção do `load_error`; usar o catálogo no "nenhum
  resultado"; remover o resumo duplicado.

Sugestão: agrupar M1–M3 e B1–B3 numa onda **P1-E (polish)**, docs-first, antes ou
logo após sair de draft.

## 25. Checklist para sair de draft

- [x] Sem bloqueadores.
- [x] Caso 943 contido (excluído, "possível erro de ano", sem 943, sem 2029).
- [x] Predict principal correto; Forecast fallback rotulado.
- [x] Filtros e filas corretos; detalhe auditável.
- [x] Telas técnicas intactas.
- [x] CI verde; `mergeable_state` clean.
- [x] Documentação P1 completa (A/B/C/D + handoff + esta revisão).
- [x] Banco, motores e conteúdo não alterados.
- [ ] **Decisão humana:** aceitar A1 como dívida pós-P1 (Radar correto) e agendar
  paridade de colunas/unificação das telas.
- [ ] **Opcional:** aplicar M1–M3 e B1–B3 (polish) antes do merge.
- [ ] Retirar de draft **manualmente** (não automatizado por esta etapa).
