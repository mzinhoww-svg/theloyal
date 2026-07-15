# Plano de implementação consolidado — backlog + diagnóstico (2026-07)

> Sucede o `plano-melhorias-forecast-predict.md` (entregue integralmente no
> PR #76). Consolida em UMA sequência executável o que os backlogs e as
> auditorias ainda deixam em aberto:
> `PROJECT_INTELLIGENCE_REPORT.md` (BKL-01..22) ·
> `docs/BACKLOG-FASE-ESTRUTURAL-RADAR.md` (S0–S7, H1–H12) ·
> `docs/AUDITORIA-FORENSE-PREDICT-FORECAST.md` + `docs/AUDITORIA-PREDICT-FORECAST.md` ·
> `docs/auditoria/` (lineage, anomalies, edge-function) ·
> deferidos da régua (PR #74, `docs/PLANO-IMPLEMENTACAO-REGUA-PUBLICACAO.md` §11).
>
> Regras: cada fase é um PR independente e mergeável sozinho; gates de saída
> `typecheck` + `build` + `test` verdes e checklist de marca do CLAUDE.md;
> nenhuma correção de dado sem proveniência (regra-mãe: não chutar).

## O que já está coberto (não reimplementar)

- Dashboards + Fases 0–4 + Trilha D do plano anterior — PR #76.
- Contenção temporal C0.2, paridade de proveniência A1, paridade TS×MJS.
- Radar unificado P1 (A–E encerrados — `ENCERRAMENTO-RADAR-P1.md`).
- Política canônica do Radar (#73) e régua de publicação fases 0–3 (#74).

Vários documentos listam esses itens como abertos por estarem desatualizados —
a Fase 0 abaixo corrige o registro.

---

## Fase 0 — Higiene documental e de copy (S · risco zero · sem decisão)

**Objetivo.** Os documentos de estado voltarem a dizer a verdade; corrigir
textos errados no admin.

1. Marcar entregas: nota de status no topo do `plano-melhorias-forecast-predict.md`
   (fases 0–4 + D entregues, PR #76), do `BACKLOG-P1-RADAR-UNIFICADO.md`
   (P1 encerrado) e das duas auditorias (itens já corrigidos por C0.2/A1/#73/#74/#76,
   sem reescrever a evidência).
2. Copy do admin: `Sidebar.tsx` com hints trocados entre Forecast e Predict;
   `observability/page.tsx` dizendo "menos de 3 janelas" quando o
   `minSamples` do Forecast é 2 (usar o valor da config no texto).

**Aceite.** Nenhum doc de status contradiz o git log; textos batem com a config.

---

## Fase 1 — Quick wins técnicos independentes (M · sem decisão humana)

Itens das auditorias que não dependem de H1–H12 nem de migração estrutural.

1.1 **Detector genérico de outlier de intervalo** (`lib/series-builder.ts`):
    MAD sobre a série de intervalos → flag por intervalo (não apaga, sinaliza).
    Forecast: warning + entra no gate editorial; Predict: warning + rebaixa
    confiança. Fixtures reais do `predict-forecast-anomalies.csv`
    (629d portobank→azul; 5 séries >365d). Hoje só o caso extremo (>900d) tem
    contenção via C0.2 — o outlier "médio" ainda infla mediana/hazard.

1.2 **Readiness declarado e nunca usado no Predict**: `backfill_incomplete` e
    `data_quality_blocked` existem no tipo e nunca são atribuídos
    (`predict-engine.ts`). Ligar: `datasetComplete=false` → `backfill_incomplete`;
    série cujo histórico foi majoritariamente excluído por qualidade →
    `data_quality_blocked`. Teste por estado.

1.3 **Erro ≠ vazio no admin (BKL-07)**: `rest()` devolve `[]` em falha e a UI
    trata como estado válido. Loaders críticos passam a devolver
    `{ rows, error }`; páginas exibem aviso de leitura falha (padrão do banner
    de carga parcial já existente).

1.4 **Disclaimer da regra 10 nos radares dos digests**: garantir que o template
    que consome `radarItems` carrega o disclaimer canônico (auditoria §14);
    teste no QA gate.

1.5 **Chip visível de `monitoramento`** (deferido 1.3 da régua): estado já é
    imposto no gate+log; falta o chip dedicado no render (hoje reusa
    `nao-confirmado`). Tokens: gray-400 + borda tracejada, vocabulário fixo.

1.6 **Bônus provável do Predict — proposta com prova**: hoje usa o *maior* %
    da onda como proxy (tende ao teto). Implementar alternativa (mediana
    ponderada por recência) atrás de comparação de backtest
    (`bonusAccuracy5pp` antes/depois nas fixtures reais); adotar apenas se o
    backtest melhorar — senão registrar e manter.

**Aceite.** Suite verde; nenhuma mudança de número editorial sem teste de
caracterização acompanhando.

---

## Fase 2 — Segurança e infraestrutura (M · BKL-03/04/08)

2.1 **Remover URL/key hardcoded** (`lib/admin-db.ts` tem fallback de
    `SUPABASE_URL` em código): exigir env; sem env → modo mock explícito e
    visível, nunca produção silenciosa.
2.2 **Edge functions**: `verify_jwt`/restrições de rede nas funções `admin_*`
    e `campaigns` (config do Supabase versionada no repo).
2.3 **Auth do admin**: comparação constant-time, cookie assinado com rotação,
    logout server-side. `updated_by`/`created_by` deixam de ser texto livre
    (derivar da sessão).

**Aceite.** Nenhum segredo/URL em código; smoke test de login/logout.

---

## Fase 3 — Origem do dado: edge function `campaigns` v14 (L · maior valor real)

O PR #76 corrige *a jusante* (fila assistida, gates); esta fase estanca a
fonte — os erros de ano nascem na extração (`docs/auditoria/edge-function-campaigns.md`).

3.1 **Proveniência completa no ingest**: persistir `published_at` (lido de
    `news_raw` e hoje descartado) e `origin` real (`backfill` | `daily`) —
    hoje hardcoded `"auto"`. Migração aditiva (colunas nullable).
3.2 **Validação de datas no ingest**: portar `eventDateLooksFabricated`
    (`lib/date-review.ts`) para a edge function. Data implausível → grava com
    flag e SEM data de evento (cai no gate `missing_date`/fila de revisão),
    nunca inventa nem corrige sozinha.
3.3 **`dedup_key` semântico** ao lado do `id` legado: rota + percentual +
    janela±ε. Upsert por `dedup_key` ATUALIZA a campanha reprocessada em vez
    de criar duplicata (o `id` embutindo `vigencia_fim` é a causa direta do
    caso 943). `id` legado intacto — sem reescrita de histórico.
3.4 **Série rica (RFC-009, incremental)**: capturar `data_anuncio`,
    `percentual_base/maximo/clube` e `mecanica` com validação de enum/bounds
    FORA do LLM. Colunas nullable; motores continuam funcionando sem elas.

**Estratégia de risco.** Shadow mode primeiro: v14 roda em paralelo gravando
apenas flags/colunas novas + log de divergência; amostra auditada manualmente
(30 campanhas) antes de ativar o upsert por `dedup_key`.

**Aceite.** Reprocesso do caso `livelo→connectmiles` real produz 1 campanha
atualizada (não 2); nenhuma transferência nova com gap evento↔proveniência
≈ N anos sem flag.

---

## Fase 4 — Pacote de decisões H1–H12 + ADRs (S de engenharia · humano decide)

A fase estrutural inteira (S1–S7) está formalmente bloqueada por decisão
humana. Engenharia prepara; você bate o martelo.

- Documento único `docs/DECISOES-PENDENTES-PACOTE.md`: cada decisão em meia
  página — contexto, opções, recomendação de engenharia e **default proposto**
  se não houver resposta. Cobre: H1 chave natural · H2 pesos de duplicidade ·
  H3 precedência de merge · H4 limiares temporais · H5 TTL de snapshot ·
  H6 granularidade de usages · H7 gates de amostra · H8 shrinkage ·
  H9 reconciliador · H10 Editorial Score · H11 janela de outcome · H12 RLS —
  mais: motor canônico/destino do Forecast (ADR-008/ODEC-011), aliases
  ambíguos (`all`/`allaccor`, `azulfidelidade`, `inter`×`interloop`),
  clube × público, bônus base × máximo.
- Saída: ADR-RADAR-002..010 promovidos a `accepted` (ou rejeitados com
  motivo). Sem isso, Fases 5–6 não começam.

---

## Fase 5 — Estrutural S1–S3 (L · gated pela Fase 4)

Um PR por onda, migração aditiva + backfill **sem autocorreção** + testes:

- **S1 — Identidade e observações**: `temporal_status`/`include_in_prediction`
  persistidos na origem; `campaign_identity` (chave natural sem data);
  `source_observation`/`campaign_version`; `data_evento`/`vigencia_type`.
- **S2 — Deduplicação persistida**: `duplicate_link`, merge manual auditável
  (`merge_audit` append-only) + unmerge; efeito de `superseded_by` nas séries.
- **S3 — Snapshot canônico**: `prediction_snapshots` único (sucede
  `forecast_snapshots`/`predict_snapshots`), reconciliador persistido com
  `reconciler_version`, gates definitivos sobre série válida.

A fila de revisão da Trilha D migra naturalmente para cima de
`campaign_version` (correção vira versão, não update in-place).

---

## Fase 6 — Estrutural S4–S7 + integrações (L · gated pela Fase 5)

- **S4** aprovação editorial persistida + diff "o que mudou".
- **S5** `prediction_outcome` (previsto × real) + calibração Brier por
  horizonte — absorve o deferido 3.2 da régua (integração do outcome tracking
  ao `predict-engine.ts`); o painel "Calibração do motor" do PR #76 passa a
  ler outcomes reais em vez de só backtest.
- **S6** Editorial Score persistido; Daily/Weekly a partir do snapshot
  aprovado; admin consolidado — absorve o deferido 3.1 da régua
  (`/admin/campanhas` por critérios).
- **S7** Pro com curva completa/outcomes; pooling rota↔cluster; automação
  assistida (sempre com humano no circuito).

---

## Trilha paralela N — Negócio (decisões suas, sem código até decidir)

`MONETIZACAO-BACKLOG.md` + BKL-22/ODEC-009: preço/ciclo do Pro, gateway
(Stripe × Beehiiv), corte grátis×Pro, tabela de patrocínio, régua de e-mail
(D0/D3/D7) e configurações externas (secrets Beehiiv em produção, automações,
`/api/contato` → e-mail real). Engenharia só entra depois do preço/gateway.

---

## Sequência recomendada e esforço

| Fase | Esforço | Bloqueio | Valor |
|---|---|---|---|
| 0 — Higiene docs/copy | S | nenhum | registro confiável |
| 1 — Quick wins | M | nenhum | modelo + operação |
| 2 — Segurança/infra | M | nenhum | risco |
| 3 — Edge function v14 | L | nenhum (shadow mode) | **estanca a fonte dos erros** |
| 4 — Pacote de decisões | S | resposta humana | destrava 5–6 |
| 5 — Estrutural S1–S3 | L | Fase 4 | identidade/dedup/snapshot |
| 6 — Estrutural S4–S7 | L | Fase 5 | outcomes/score/consolidação |
| N — Negócio | — | decisão | monetização |

Fases 0–3 são paralelizáveis entre si (nenhuma depende de decisão); a 4 pode
ser preparada junto e enviada para sua aprovação enquanto 1–3 rodam.
