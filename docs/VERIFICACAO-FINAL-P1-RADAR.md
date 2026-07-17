# Verificação final pós-polish — P1 do Radar (PR #54)

## 1. Resumo executivo

Verificação de fechamento após a onda de polish P1-E. Os seis achados da revisão
humana (**M1, M2, M3, B1, B2, B3**) estão **resolvidos** — cada um evidenciado no
código, na suíte determinística (225/225) e no build/preview verdes. **A1
permanece** dívida pós-P1 documentada (o Radar é a superfície correta; não é
bloqueador). Sem alteração de código de motor/loader/qualidade/banco/conteúdo/ADR.

**Decisão: APTO PARA READY FOR REVIEW.** (ver §16 e o checklist §17.)

## 2. Ambiente revisado

- **PR #54**, branch `claude/forecast-predict-audit-nyswiw`, head `9c9fa7c`.
- **Preview Vercel:** deploy **success** (CI) sobre `9c9fa7c`.
- **Método:** verificação fundamentada em (a) presença das seis correções no
  código, (b) a suíte de testes que **encoda o comportamento** de cada correção
  (`tests/radar-polish.test.mjs` + regressões), (c) `typecheck`/`lint`/`build`
  verdes e o deploy do preview verde. Limitação declarada (igual à revisão
  humana): o `/admin/*` exige cookie de sessão + `SUPABASE_SERVICE_ROLE_KEY`; não
  houve clique-a-clique autenticado com dados de produção — os comportamentos
  foram confirmados por testes de fixtures e inspeção de código. Nenhuma leitura
  do banco de produção nesta etapa.
- **Rotas verificadas (por código/teste):** `/admin/radar`, `?view=invalid`/
  `?view=operations` (inválidos), `?view=operacao`, `?cause=placeholder`, combinação
  sem resultados, séries válida/bloqueada/fallback/erro temporal, detalhe,
  `/admin/forecast`, `/admin/predict`, `/admin/observability`.

## 3. Resultado de M1–M3

| Achado | Estado | Evidência |
|---|---|---|
| **M1** view inválido | **RESOLVIDO** | `resolveRadarView(raw)` normaliza para `geral` e retorna `invalid=true`; a página (`page.tsx:37,55`) exibe aviso **"Aba não encontrada — exibindo a Visão geral. Verifique o link."**; links válidos preservados (a view pt-BR `?view=operacao` abre a operação; `?view=operations`/`invalid` mostram a geral **com aviso**, não falham em silêncio). Filtros lidos por separado (independentes da view). Teste: `radar-polish` M1 (válido/inválido/ausente/vazio + independência dos filtros). |
| **M2** link de placeholders | **RESOLVIDO** | novo `cause=placeholder` (`radar-filters.ts`: `seriesCauses`/`CAUSE_ORDER`/`CAUSE_LABEL`); o alerta aponta `/admin/radar?cause=placeholder`; `applyRadarFilters` retorna **só** séries com `quality.placeholder>0`; faceta e rótulo presentes; contagem do alerta = `placeholderCount`. Limpar filtros = link "Limpar" (form GET). Teste: `radar-polish` M2. |
| **M3** headings | **RESOLVIDO** | um `h1` por página (PageHeader `ui.tsx:339`); `h2` por seção: Resumo operacional (visível), Saúde/Indicadores/Filtros (`sr-only`), Séries (visível), Alertas (visível); outline puro `RADAR_OVERVIEW_OUTLINE`. Teste: `radar-polish` M3 (um h1, resto h2, textos únicos, todas as seções). |

## 4. Resultado de B1–B3

| Achado | Estado | Evidência |
|---|---|---|
| **B1** `load_error` acionável | **RESOLVIDO** | `app/admin/(panel)/radar/error.tsx` (boundary do segmento; cobre lista e detalhe) renderiza estado padronizado via `resolveRadarLoadError()` — título/descrição/impacto/ação, **sem stack**, botão "Tentar novamente" (`reset`) e link "Diagnosticar nos logs" (`/admin/logs`); título fala em **falha** (não mascara como "sem dados"). Teste: `radar-polish` B1. |
| **B2** nenhum resultado | **RESOLVIDO** | a tabela consome `RADAR_EMPTY.no_filter_results` (`radar.tsx:261`); o contexto (contagem "X de N séries", "0") vem da página; ação = "Ajustar ou limpar os filtros". Teste: `radar-polish` B2. |
| **B3** resumo duplicado | **RESOLVIDO** | `RadarOperationalSummary` ganha `compact`; **visão geral** usa `compact` (risco + contagens + link "Ver operação"); **operação** (`view=operacao`) usa a versão completa (ação prioritária + frase). Sem texto/cards duplicados. Teste: `radar-polish` B3 (núcleo compacto + extras completos). |

## 5. Regressões

Nenhuma. Suíte total **225/225** (inclui P1-A/B/C/D + polish); `typecheck`, `lint`,
`build` verdes; `/admin/radar`, `/admin/radar/[seriesKey]` e o boundary de erro
compilam. Filtros combinados, filas e detalhe seguem cobertos por
`radar-parity`/`radar-operations`/`radar-detail`/`radar-filters` e o novo
`radar-polish` (regressão de filtros/filas).

## 6. Caso 943

**Contido** (inalterado pelo polish; A1 não tocado). `livelo→connectmiles`:
registro A → `suspect_year` ("possível erro de ano", `dayDifference=943`) excluído;
par → duplicidade provável; **sem** intervalo 943, **sem** janela 2029; série
`data_quality_blocked` (não é oportunidade); localizável por filas
(suspeitos/duplicidades/bloqueadas) e filtros (`quality=bloqueada`,
`duplicate=probable`). Testes: `radar-detail`, `radar-parity`, `campaign-quality`.

## 7. Filtros

15 filtros por AND (incl. o novo `cause=placeholder`); query params preservados;
cada filtro recorta pelo campo existente (`radar-parity` caso 8); "nenhum
resultado" via catálogo; cluster não aparece como rota. **OK.**

## 8. Filas

8 filas; oportunidades sem bloqueadas; bloqueios globais × por série; sobreposição
explícita; ações levam ao detalhe/diagnóstico; link de placeholders agora correto.
**OK.**

## 9. Detalhe

Auditável e inalterado: resumo antes dos detalhes; uma previsão principal; Predict
principal quando pronto; Forecast fallback rotulado ("cadência aproximada"); sem
probabilidade inventada (fallback → sem P); usadas/excluídas auditáveis; backtest
insuficiente exibido; timeline sem histórico inventado; links técnicos. **OK.**

## 10. Acessibilidade

Um `h1` + `h2` por seção (M3); badges sempre com texto (P1-D); tabelas com `<Th>`;
`<details>` nativo; abas com `aria-current`; filtros com `<label>` e nome acessível
(`aria-labelledby`); aviso de view inválida com `role="status"`; erro com
`role="alert"`; foco visível/alvos ≥44px herdados do layout. Navegação por teclado
básica preservada (links/botões nativos). **OK** (verificado por estrutura, sem AT
real).

## 11. Responsividade

Tabelas em `overflow-x-auto`; filtros/abas `flex-wrap`; cards em grid `auto-fill`;
detalhe legível; botões do erro ≥44px. Comportamento previsível em
desktop/tablet/estreito. **OK** (verificado por estrutura CSS).

## 12. Telas técnicas

`/admin/forecast`, `/admin/predict`, `/admin/observability` **intactas** (fora do
diff do polish); links cruzados no detalhe do Radar preservados. **OK.**

## 13. CI

**success** — deploy Vercel concluído sobre `9c9fa7c`. Local: `npm test` **225/225**,
`typecheck`, `lint`, `build` verdes.

## 14. Mergeability

`mergeable_state: clean`; PR **aberto e em draft**; head `9c9fa7c`.

## 15. Dívida A1

**Registrada e mantida.** `/admin/forecast` legado seleciona 7 colunas (sem
proveniência) e ainda pode exibir o intervalo de 943 dias em `livelo→connectmiles`;
o **Radar continua a superfície correta** (lê proveniência, contém o caso). A
correção (paridade de colunas / unificação das telas) é **pós-P1** e **não** foi
feita nesta etapa. Não é bloqueador deste PR. Ref.: HANDOFF §7, IMPLEMENTACAO-P1A
§4, REVISAO-HUMANA §8/A1, IMPLEMENTACAO-P1E §1.

## 16. Decisão final

**APTO PARA READY FOR REVIEW.**

Contra os critérios: (1) sem bloqueadores; (2) M1–M3 e B1–B3 resolvidos; (3) CI
verde; (4) mergeability clean; (5) preview estável (deploy success); (6) P1
completo (A→E); (7) documentação completa; (8) A1 registrado como dívida; (9)
nenhum banco/migration/motor/conteúdo alterado. A retirada de draft é **decisão
humana** — este documento não a executa.

## 17. Checklist para Ready for review

- [x] Sem bloqueadores.
- [x] M1 (view inválido com aviso) resolvido.
- [x] M2 (link de placeholders isola o dado) resolvido.
- [x] M3 (um h1 + h2 por seção) resolvido.
- [x] B1 (`load_error` acionável, sem stack, com retry + diagnóstico) resolvido.
- [x] B2 (nenhum resultado via catálogo) resolvido.
- [x] B3 (resumo compacto na geral, completo na operação) resolvido.
- [x] Caso 943 contido; Predict principal correto; Forecast fallback rotulado; sem probabilidade inventada.
- [x] Filtros, filas e detalhe corretos; telas técnicas intactas.
- [x] Acessibilidade e responsividade básicas aceitáveis.
- [x] CI verde; `mergeable_state` clean; preview estável.
- [x] Documentação P1 completa (A/B/C/D + handoff + revisão + polish + esta verificação).
- [x] A1 registrado como dívida pós-P1.
- [x] Banco, migrations, motores e conteúdo não alterados.
- [ ] **Ação humana:** mudar o PR #54 para **Ready for review** (manual).
- [ ] **Opcional:** planejar a paridade de colunas / unificação das telas (A1) na fase estrutural.
