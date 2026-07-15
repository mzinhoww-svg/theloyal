// Detalhe da série do Radar (Fase P1-B). Apresentação apenas — todos os dados
// vêm do RadarViewModel/RadarSeries do P1-A. Server components; camadas técnicas
// em <details> nativo (acessível, sem JS de cliente). Reusa QualityPanel.
import { Pill, Table, Th, Td, EmptyRow, EmptyState, StatCard, fmtDate } from "./ui";
import { QualityPanel } from "./QualityPanel";
import { PRODUCT_STATUS_TONE, DIVERGENCE_TONE, TEMPORAL_SEVERITY_TONE } from "./radar-vocab";
import type { RadarSeries, RadarViewModel } from "@/lib/radar-view-model";
import { productStatusLabel } from "@/lib/radar-view-model";
import {
  enginePrincipal,
  engineRoleLabel,
  readinessLabel,
  cadenceLabel,
  temporalStatusLabel,
  duplicateStatusLabel,
  exclusionReasonLabel,
  recommendedAction,
  divergenceLabel,
  divergenceExplain,
  waveIndexOf,
  eventDateOfRow,
  backtestAvailable,
  bonusAvailable,
  productExplanation,
  type EnginePrincipal,
} from "@/lib/radar-detail";

const NA = "Não disponível";
const STATUS_TONE = PRODUCT_STATUS_TONE;
const DIV_TONE = DIVERGENCE_TONE;
const SEV_TONE = TEMPORAL_SEVERITY_TONE;

const pctR = (p: number | null, step = 5): string => (p == null ? "—" : `${Math.round((p * 100) / step) * step}%`);
const bonus = (n: number | null): string => (n == null ? "—" : `~${n}%`);
const domainOf = (url: unknown): string => (typeof url === "string" && url ? url.replace(/^https?:\/\//i, "").split("/")[0] : NA);

function H({ children }: { children: React.ReactNode }) {
  return <h2 className="mb-2 mt-8 font-display text-lg font-semibold text-ink">{children}</h2>;
}

// § 7 — Cabeçalho da série.
export function RadarSeriesDetailHeader({ series, vm }: { series: RadarSeries; vm: RadarViewModel }) {
  const principal = enginePrincipal(series);
  return (
    <header className="mb-4 rounded-lg border border-line bg-surface p-4">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="font-display text-2xl font-semibold text-ink">{series.seriesKey}</h1>
        {series.scope === "cluster" && <Pill tone="blue">agregado por destino</Pill>}
        <Pill tone={STATUS_TONE[series.productStatus]}>{productStatusLabel(series.productStatus)}</Pill>
        <Pill tone={principal === "predict" ? "green" : principal === "forecast" ? "yellow" : "gray"}>
          {engineRoleLabel(principal)}
        </Pill>
      </div>
      <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-sm text-gray-700">
        <span>Origem: <strong>{series.origin ?? "— (cluster)"}</strong></span>
        <span>Destino: <strong>{series.destination}</strong></span>
        <span>Elegível p/ publicação: <strong>{series.editorialEligible ? "sim" : "não"}</strong></span>
        <span className="font-mono tabular-nums">Ondas: <strong>{series.waves}</strong></span>
        <span className="font-mono tabular-nums">Válidas: <strong>{series.campaignsValid}</strong></span>
        <span className="font-mono tabular-nums">Excluídas: <strong>{series.campaignsExcluded}</strong></span>
        <span>Frescor: <Pill tone={series.freshnessStatus === "fresh" ? "green" : "yellow"}>{series.freshnessStatus}</Pill></span>
        <span className="text-gray-500">Atualização: {vm.metadata.generatedAt ? fmtDate(vm.metadata.generatedAt) : NA} · asOf {vm.metadata.asOf}</span>
      </div>
    </header>
  );
}

// § 8 — Resumo executivo.
export function RadarSeriesSummary({ series }: { series: RadarSeries }) {
  const principal = enginePrincipal(series);
  const usable = principal !== "none";
  return (
    <section className="mb-2 rounded-lg border border-line bg-paper p-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Situação" value={<span className="text-lg">{productStatusLabel(series.productStatus)}</span>} sub={`Ação: ${recommendedAction(series)}`} tone={STATUS_TONE[series.productStatus]} />
        <StatCard label="Previsão utilizável" value={usable ? "sim" : "não"} sub={engineRoleLabel(principal)} tone={usable ? "green" : "gray"} />
        <StatCard label="Janela provável" value={<span className="text-base">{series.window ?? NA}</span>} sub="faixa, não data exata" />
        <StatCard label="Confiança (modelo)" value={series.modelConfidence} sub={`bônus provável ${bonus(series.bonus)}`} />
      </div>
      <p className="mt-3 text-sm text-gray-700">{productExplanation(series)}</p>
      {(series.editorialBlockReasons.length > 0 || series.warnings.length > 0) && (
        <p className="mt-2 text-sm text-gray-500">
          {series.editorialBlockReasons.length > 0 && <>Bloqueios: {series.editorialBlockReasons.join(", ")}. </>}
          {series.warnings.length > 0 && <>Warnings: {series.warnings.length}.</>}
        </p>
      )}
    </section>
  );
}

// § 9 / § 10 — Previsão principal (Predict pronto · Forecast fallback · nenhum).
export function RadarPredictionMain({ series }: { series: RadarSeries }) {
  const principal: EnginePrincipal = enginePrincipal(series);
  const p = series.predict;
  const f = series.forecast;
  return (
    <>
      <H>Previsão principal</H>
      {principal === "predict" && p && p.probabilities && (
        <div className="rounded-lg border border-line bg-surface p-4">
          <div className="mb-3 flex flex-wrap gap-2">
            <Pill tone="green">Predict — principal</Pill>
            <Pill tone="gray">prontidão: {readinessLabel(p.readiness)}</Pill>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <StatCard label="Chance em 30 dias" value={pctR(p.probabilities.p30)} sub="horizonte 30d" tone="blue" />
            <StatCard label="Chance em 60 dias" value={pctR(p.probabilities.p60)} sub="horizonte 60d" />
            <StatCard label="Chance em 90 dias" value={pctR(p.probabilities.p90)} sub="horizonte 90d" />
          </div>
          <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-sm text-gray-700">
            <span>Janela: <strong>{series.window ?? NA}</strong></span>
            <span>Data central: <strong>{p.centralDate ? fmtDate(p.centralDate) : NA}</strong></span>
            <span>Bônus provável: <strong className="font-mono">{bonus(series.bonus)}</strong></span>
            <span>Confiança: <strong>{series.modelConfidence}</strong></span>
          </div>
          <details className="mt-3">
            <summary className="cursor-pointer text-sm font-medium text-blue-600">Horizontes adicionais (P7 · P15 · P180)</summary>
            <div className="mt-2 flex flex-wrap gap-4 text-sm font-mono tabular-nums text-gray-700">
              <span>P7 {pctR(p.probabilities.p7)}</span>
              <span>P15 {pctR(p.probabilities.p15)}</span>
              <span>P180 {pctR(p.probabilities.p180)}</span>
            </div>
          </details>
          {p.explanation && <p className="mt-3 text-sm text-gray-500">{p.explanation}</p>}
        </div>
      )}
      {principal === "forecast" && f && (
        <div className="rounded-lg border border-yellow-500 bg-yellow-100 p-4">
          <div className="mb-3 flex flex-wrap gap-2">
            <Pill tone="yellow">Forecast — fallback (cadência aproximada)</Pill>
          </div>
          <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-ink">
            <span>Janela: <strong>{series.window ?? NA}</strong></span>
            <span>Cadência: <strong>{cadenceLabel(f.cadence)}</strong></span>
            <span className="font-mono tabular-nums">Histórico válido: <strong>{f.samples} ondas</strong></span>
            <span>Confiança: <strong>{series.modelConfidence}</strong></span>
            <span>Bônus típico: <strong className="font-mono">{bonus(f.typicalPercent)}</strong></span>
          </div>
          <p className="mt-3 text-sm text-gray-700">
            Motivo do fallback: {p?.blockReason ?? "Predict sem prontidão suficiente"}. Sem probabilidade por horizonte (não inventada).
          </p>
        </div>
      )}
      {principal === "none" && (
        <div className="rounded-lg border border-line bg-surface p-4">
          <p className="text-sm font-medium text-gray-700">Sem previsão utilizável.</p>
          <p className="mt-1 text-sm text-gray-500">
            Motivos: {[...series.editorialBlockReasons, p?.blockReason].filter(Boolean).join(", ") || "histórico/prontidão insuficiente"}.
            {" "}Ação: {recommendedAction(series)}.
          </p>
        </div>
      )}
    </>
  );
}

// § 11 — Forecast (baseline/fallback).
export function RadarForecastSection({ series }: { series: RadarSeries }) {
  const f = series.forecast;
  return (
    <>
      <H>Forecast (motor de recorrência · baseline/fallback)</H>
      {!f ? (
        <EmptyState label="Forecast indisponível." hint="Sem recorrência suficiente para esta série." />
      ) : (
        <div className="rounded-lg border border-line bg-surface p-4 text-sm text-gray-700">
          <div className="flex flex-wrap gap-x-6 gap-y-1">
            <span>Janela: <strong>{series.window ?? NA}</strong></span>
            <span>Ritmo: <strong>{cadenceLabel(f.cadence)}</strong></span>
            <span className="font-mono tabular-nums">Histórico válido: <strong>{f.samples} ondas</strong></span>
            <span className="font-mono tabular-nums">Maior intervalo histórico: <strong>{f.maxIntervalDays ?? "—"}{f.maxIntervalDays != null ? " dias" : ""}</strong></span>
            <span>Bônus típico: <strong className="font-mono">{bonus(f.typicalPercent)}</strong></span>
            <span>Apta para publicação: <strong>{f.editorialEligible ? "sim" : "não"}</strong></span>
          </div>
          {f.editorialBlockReason && <p className="mt-2 text-gray-500">Motivo do bloqueio: {f.editorialBlockReason}</p>}
          {f.warnings.length > 0 && <p className="mt-2 text-gray-500">Warnings: {f.warnings.join("; ")}</p>}
          <details className="mt-3">
            <summary className="cursor-pointer font-medium text-blue-600">Métricas técnicas</summary>
            <div className="mt-2 flex flex-wrap gap-4 font-mono tabular-nums text-gray-500">
              <span>medianDays {f.medianDays ?? "—"}</span>
              <span>meanDays {f.meanDays ?? "—"}</span>
              <span>stdevDays {f.stdevDays ?? "—"}</span>
              <span>última {f.lastWindow ?? "—"}</span>
              <span>basis: {f.basis}</span>
            </div>
          </details>
        </div>
      )}
    </>
  );
}

// § 12 / § 18 — Predict (motor principal quando pronto) + backtest.
export function RadarPredictSection({ series }: { series: RadarSeries }) {
  const p = series.predict;
  return (
    <>
      <H>Predict (preditivo v2 · hazard/backtest)</H>
      {!p ? (
        <EmptyState label="Predict indisponível." hint="Sem prontidão do modelo para esta série." />
      ) : (
        <div className="rounded-lg border border-line bg-surface p-4 text-sm text-gray-700">
          <div className="mb-2 flex flex-wrap gap-2">
            <Pill tone={p.readiness === "ready" ? "green" : p.readiness === "ready_with_warnings" ? "yellow" : "gray"}>
              {readinessLabel(p.readiness)}
            </Pill>
            <Pill tone="gray">confiança: {series.modelConfidence}</Pill>
          </div>
          <div className="flex flex-wrap gap-x-6 gap-y-1">
            <span>Janela: <strong>{series.window ?? NA}</strong></span>
            <span>Data central: <strong>{p.centralDate ? fmtDate(p.centralDate) : NA}</strong></span>
            {p.probabilities && (
              <span className="font-mono tabular-nums">P30 {pctR(p.probabilities.p30)} · P60 {pctR(p.probabilities.p60)} · P90 {pctR(p.probabilities.p90)}</span>
            )}
          </div>
          <div className="mt-2">
            Bônus provável:{" "}
            {p.bonusCandidates.length === 0 ? NA : p.bonusCandidates.map((c) => (
              <span key={c.value} className="mr-2 font-mono">{c.value}% ({pctR(c.probability)})</span>
            ))}
            {p.bonusOutros > 0 && <span className="text-gray-500 font-mono">outros {pctR(p.bonusOutros)}</span>}
          </div>
          {p.blockReason && <p className="mt-2 text-gray-500">Bloqueio: {p.blockReason}</p>}
          {p.warnings.length > 0 && <p className="mt-2 text-gray-500">Warnings: {p.warnings.join("; ")}</p>}
          {/* § 18 — backtest (validação histórica) */}
          <div className="mt-3 rounded border border-line bg-paper p-3">
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">Validação histórica (backtest)</p>
            {!backtestAvailable(series) ? (
              <p className="text-gray-700">Backtest insuficiente — sem observações suficientes para validar.</p>
            ) : (
              <div className="flex flex-wrap gap-4 font-mono tabular-nums text-gray-700">
                <span>Acerto de janela: {p.backtest!.windowHitRate == null ? "—" : pctR(p.backtest!.windowHitRate)}</span>
                <span>Erro mediano de data: {p.backtest!.medianDateErrorDays ?? "—"} dias</span>
                <span>Acurácia do bônus (±5pp): {p.backtest!.bonusAccuracy5pp == null ? "—" : pctR(p.backtest!.bonusAccuracy5pp)}</span>
                <span>Base de validação: {p.backtest!.observations} obs.</span>
              </div>
            )}
          </div>
          {p.explanation && <p className="mt-3 text-gray-500">{p.explanation}</p>}
        </div>
      )}
    </>
  );
}

// § 13 — Comparação Forecast × Predict (divergência, sem reconciliador novo).
export function RadarEngineComparison({ series }: { series: RadarSeries }) {
  const f = series.forecast;
  const p = series.predict;
  const rows: { k: string; forecast: string; predict: string }[] = [
    { k: "Disponibilidade", forecast: f ? (f.editorialEligible ? "apta" : "não apta") : "indisponível", predict: p ? readinessLabel(p.readiness) : "indisponível" },
    { k: "Janela", forecast: f ? (f.windowStart ? series.window ?? "—" : "—") : "—", predict: p?.probabilities ? series.window ?? "—" : "—" },
    { k: "Centro", forecast: f?.windowStart ? fmtDate(f.windowStart) : "—", predict: p?.centralDate ? fmtDate(p.centralDate) : "—" },
    { k: "Confiança", forecast: f?.confidence ?? "—", predict: p?.confidence ?? "—" },
    { k: "Histórico", forecast: f ? `${f.samples} ondas` : "—", predict: p ? `${p.recordsTotal} campanhas` : "—" },
    { k: "Warnings", forecast: String(f?.warnings.length ?? 0), predict: String(p?.warnings.length ?? 0) },
    { k: "Papel no Radar", forecast: "baseline/fallback", predict: "principal quando pronto" },
  ];
  return (
    <>
      <H>Comparação Forecast × Predict</H>
      <div className="mb-2 flex flex-wrap items-center gap-2 text-sm">
        <Pill tone={DIV_TONE[series.divergenceLevel]}>divergência: {divergenceLabel(series.divergenceLevel)}</Pill>
        {series.divergenceDays != null && <span className="font-mono tabular-nums text-gray-500">Δ centros {series.divergenceDays} dias</span>}
      </div>
      <p className="mb-2 text-sm text-gray-700">{divergenceExplain(series)}</p>
      <Table>
        <thead><tr><Th>Dimensão</Th><Th>Forecast</Th><Th>Predict</Th></tr></thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.k}><Td label="Dimensão" className="font-medium">{r.k}</Td><Td label="Forecast">{r.forecast}</Td><Td label="Predict">{r.predict}</Td></tr>
          ))}
        </tbody>
      </Table>
      <p className="mt-2 text-xs text-gray-500">
        Recomendação de motor exibida em runtime (Predict &gt; Forecast &gt; Não confirmado) — não persistida; a reconciliação canônica é fase futura.
      </p>
    </>
  );
}

// § 14 — Qualidade (reusa QualityPanel + síntese da série).
export function RadarQualitySummary({ series, vm }: { series: RadarSeries; vm: RadarViewModel }) {
  const q = series.quality;
  return (
    <>
      <H>Qualidade dos dados</H>
      <div className="mb-3 grid gap-3 [grid-template-columns:repeat(auto-fill,minmax(150px,1fr))]">
        <StatCard label="Válidas (série)" value={q.campaignsValid} tone={q.campaignsValid > 0 ? "green" : "gray"} />
        <StatCard label="Excluídas (série)" value={q.campaignsExcluded || "—"} tone={q.campaignsExcluded > 0 ? "yellow" : "gray"} />
        <StatCard label="Temporais críticas" value={q.temporalCritical || "—"} tone={q.temporalCritical > 0 ? "red" : "gray"} />
        <StatCard label="Duplicidade provável" value={q.probableDuplicate || "—"} tone={q.probableDuplicate > 0 ? "yellow" : "gray"} />
        <StatCard label="Placeholders" value={q.placeholder || "—"} tone={q.placeholder > 0 ? "yellow" : "gray"} />
      </div>
      <p className="mb-2 text-xs text-gray-500">Contexto global do ledger (mesma avaliação C0.2 dos motores):</p>
      <QualityPanel quality={{
        // Reaproveita o QualityPanel com o assessment global do view model.
        perId: {}, eligibleRows: [], duplicateGroups: [],
        counters: {
          totalReceived: vm.health.campaignsTotal, totalEligible: vm.health.campaignsEligible,
          blockedMissingDate: 0, blockedTemporal: vm.health.temporalCriticalCount, blockedDuplicate: vm.health.probableDuplicateCount,
          blockedPlaceholder: vm.health.placeholderCount,
          possibleDuplicateGroups: vm.health.possibleDuplicateCount, probableDuplicateGroups: vm.health.probableDuplicateCount,
        },
        excluded: series.quality.excluded,
      }} />
    </>
  );
}

// § 15 — Campanhas utilizadas.
export function RadarCampaignsUsed({ series }: { series: RadarSeries }) {
  const used = [...series.quality.used].sort((a, b) => (eventDateOfRow(a) ?? "").localeCompare(eventDateOfRow(b) ?? ""));
  return (
    <>
      <H>Campanhas utilizadas ({used.length})</H>
      <Table>
        <thead>
          <tr><Th>ID</Th><Th>Data do evento</Th><Th>Origem</Th><Th>Destino</Th><Th className="text-right">Bônus</Th><Th>Fonte</Th><Th>Registro</Th><Th className="text-right">Onda</Th><Th>Inclusão</Th></tr>
        </thead>
        <tbody>
          {used.length === 0 ? (
            <EmptyRow cols={9} label="Nenhuma campanha elegível nesta série." hint="Veja as excluídas abaixo para o motivo." />
          ) : (
            used.map((r) => (
              <tr key={String(r.id)}>
                <Td label="ID" className="font-mono text-xs">{r.id ?? NA}</Td>
                <Td label="Data do evento" className="font-mono tabular-nums">{eventDateOfRow(r) ?? NA}</Td>
                <Td label="Origem">{r.origem ?? NA}</Td>
                <Td label="Destino">{r.destino ?? NA}</Td>
                <Td label="Bônus" className="text-right font-mono tabular-nums">{r.percentual != null ? `${r.percentual}%` : NA}</Td>
                <Td label="Fonte" className="text-xs">{domainOf(r.source_url)}</Td>
                <Td label="Registro">{r.origin ?? NA}</Td>
                <Td label="Onda" className="text-right font-mono tabular-nums">{waveIndexOf(series, r) ?? "—"}</Td>
                <Td label="Inclusão" className="text-xs text-gray-500">elegível: temporal ok, sem duplicidade</Td>
              </tr>
            ))
          )}
        </tbody>
      </Table>
    </>
  );
}

// § 16 — Campanhas excluídas.
export function RadarCampaignsExcluded({ series }: { series: RadarSeries }) {
  const ex = series.quality.excluded;
  const action = (reason: string, sev: string): string =>
    reason.includes("placeholder") ? "Ignorar (não é programa)" : sev === "critical" ? "Revisar dados" : reason.includes("duplicate") ? "Auditar duplicidade" : "Revisar";
  return (
    <>
      <H>Campanhas excluídas ({ex.length})</H>
      {ex.length === 0 ? (
        <EmptyState label="Nenhuma campanha excluída por qualidade nesta série." />
      ) : (
        <Table>
          <thead>
            <tr><Th>ID</Th><Th>Data candidata</Th><Th>Proveniência</Th><Th className="text-right">Δ dias</Th><Th>Status temporal</Th><Th>Severidade</Th><Th>Duplicidade</Th><Th>Motivo</Th><Th>Ação</Th></tr>
          </thead>
          <tbody>
            {ex.map((e) => (
              <tr key={e.id}>
                <Td label="ID" className="font-mono text-xs">{e.id}</Td>
                <Td label="Data candidata" className="font-mono tabular-nums">{e.temporal.eventDate ?? NA}</Td>
                <Td label="Proveniência" className="font-mono tabular-nums">{e.temporal.provenanceDate ?? NA}</Td>
                <Td label="Δ dias" className="text-right font-mono tabular-nums">{e.temporal.dayDifference ?? "—"}</Td>
                <Td label="Status temporal">{temporalStatusLabel(e.temporal.status)}{e.temporal.flags.length > 1 && <span className="ml-1 text-xs text-gray-500">({e.temporal.flags.map(temporalStatusLabel).join(", ")})</span>}</Td>
                <Td label="Severidade"><Pill tone={SEV_TONE[e.temporal.severity]}>{e.temporal.severity}</Pill></Td>
                <Td label="Duplicidade">
                  {duplicateStatusLabel(e.duplicate.status)}
                  {e.duplicate.relatedCampaignIds.length > 0 && <span className="ml-1 text-xs text-gray-500">rel.: {e.duplicate.relatedCampaignIds.length}</span>}
                </Td>
                <Td label="Motivo" className="text-xs">{exclusionReasonLabel(e.reason)}</Td>
                <Td label="Ação" className="text-xs text-gray-500">{action(e.reason, e.temporal.severity)}</Td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
      {ex.some((e) => e.duplicate.score > 0) && (
        <details className="mt-2">
          <summary className="cursor-pointer text-sm font-medium text-blue-600">Scores de duplicidade (analítico)</summary>
          <div className="mt-2 flex flex-wrap gap-3 font-mono text-xs text-gray-500">
            {ex.filter((e) => e.duplicate.score > 0).map((e) => (
              <span key={e.id}>{e.id}: {e.duplicate.score}</span>
            ))}
          </div>
        </details>
      )}
    </>
  );
}

// § 17 — Warnings e bloqueios (separados).
export function RadarWarningsBlocks({ series }: { series: RadarSeries }) {
  const blocks = series.editorialBlockReasons;
  const warns = series.warnings;
  return (
    <>
      <H>Warnings e limitações</H>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-lg border border-red-600 bg-red-100 p-3">
          <p className="mb-1 text-sm font-semibold text-red-700">Bloqueios (impedem uso editorial)</p>
          {blocks.length === 0 ? (
            <p className="text-sm text-gray-700">Nenhum bloqueio ativo.</p>
          ) : (
            <ul className="list-disc pl-5 text-sm text-ink">
              {blocks.map((b) => <li key={b}>{b} — origem: gate editorial / qualidade C0.2</li>)}
            </ul>
          )}
        </div>
        <div className="rounded-lg border border-yellow-500 bg-yellow-100 p-3">
          <p className="mb-1 text-sm font-semibold text-ink">Warnings (exigem atenção)</p>
          {warns.length === 0 ? (
            <p className="text-sm text-gray-700">Sem warnings.</p>
          ) : (
            <ul className="list-disc pl-5 text-sm text-ink">
              {warns.map((w) => <li key={w}>{w}</li>)}
            </ul>
          )}
        </div>
      </div>
    </>
  );
}

// § 20 — Timeline (retrato do agora; sem histórico persistido).
export function RadarTimeline({ series }: { series: RadarSeries }) {
  const waves = series.forecast?.windows ?? [];
  return (
    <>
      <H>Linha do tempo (estado atual)</H>
      <div className="rounded-lg border border-line bg-surface p-4 text-sm text-gray-700">
        <div className="flex flex-wrap gap-x-6 gap-y-1">
          <span className="font-mono tabular-nums">Ondas válidas: {waves.length ? waves.join(" · ") : "—"}</span>
          <span className="font-mono tabular-nums">Última campanha: {series.lastCampaignDate ?? "—"}</span>
          <span className="font-mono tabular-nums">Excluídas: {series.campaignsExcluded}</span>
          <span className="font-mono tabular-nums">Duplicidades prováveis: {series.quality.probableDuplicate}</span>
          <span>Janela atual: {series.window ?? NA}</span>
        </div>
        <p className="mt-3 text-xs text-gray-500">
          Histórico de mudanças estará disponível após a implementação de snapshots canônicos.
        </p>
      </div>
    </>
  );
}

// § 21 — Links técnicos.
export function RadarTechLinks() {
  const link = "text-blue-600 hover:underline";
  return (
    <>
      <H>Links técnicos</H>
      <div className="flex flex-wrap gap-4 text-sm">
        <a className={link} href="/admin/radar">← Voltar ao Radar</a>
        <a className={link} href="/admin/forecast">Abrir Forecast</a>
        <a className={link} href="/admin/predict">Abrir Predict</a>
        <a className={link} href="/admin/observability">Abrir Observabilidade</a>
      </div>
    </>
  );
}
