// Componentes do Radar unificado (Fase P1-A). Apresentação apenas — todos os
// dados vêm do Radar View Model (lib/radar-view-model.ts). Server components;
// os filtros são um <form method="get"> (sem JS de cliente).
import {
  Pill,
  StatCard,
  Table,
  Th,
  Td,
  EmptyRow,
} from "./ui";
import {
  productStatusLabel,
  type RadarSeries,
  type RadarViewModel,
} from "@/lib/radar-view-model";
import { deriveFilterFacets, CAUSE_LABEL, CLUSTER_ORIGIN } from "@/lib/radar-filters";
import { PRODUCT_STATUS_TONE, freshnessTone } from "./radar-vocab";
import { RADAR_H } from "@/lib/radar-headings";
import { RADAR_EMPTY } from "@/lib/radar-empty";

const STATUS_TONE = PRODUCT_STATUS_TONE;

const pct = (n: number | null): string => (n == null ? "—" : `${Math.round(n * 100)}%`);
const bonusLabel = (n: number | null): string => (n == null ? "—" : `~${n}%`);

// Semáforo de saúde: alertas e frescor ACIMA de qualquer número (§6.1).
export function RadarHealthSummary({ vm }: { vm: RadarViewModel }) {
  const { metadata: m, health: h } = vm;
  const alerting = !m.datasetComplete || m.freshnessStatus !== "fresh" || h.alertCount > 0;
  return (
    <section
      className={`mb-5 rounded-lg border p-4 ${
        alerting ? "border-yellow-500 bg-yellow-100" : "border-line bg-surface"
      }`}
      aria-labelledby="radar-saude"
    >
      <h2 id="radar-saude" className="sr-only">{RADAR_H.saude}</h2>
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
        <span className="inline-flex items-center gap-2">
          <Pill tone={m.datasetComplete ? "green" : "red"}>
            {m.datasetComplete ? "base completa" : "base incompleta"}
          </Pill>
          <span className="text-gray-500">
            {m.rowsRead} linhas · {m.pagesRead} páginas
          </span>
        </span>
        <span className="inline-flex items-center gap-2">
          <Pill tone={freshnessTone(m.freshnessStatus)}>{m.freshnessStatus}</Pill>
          <span className="text-gray-500">
            {m.generatedAt ? `artefato de ${m.generatedAt.slice(0, 10)}` : "sem artefato"}
          </span>
        </span>
        <span className="text-gray-700">
          <strong className="font-mono tabular-nums">{h.campaignsEligible}</strong>
          <span className="text-gray-500"> / {h.campaignsTotal} campanhas elegíveis</span>
        </span>
        <span className="text-gray-700">
          <strong className="font-mono tabular-nums">{h.seriesEditoriallyEligible}</strong>
          <span className="text-gray-500"> / {h.seriesTotal} séries elegíveis</span>
        </span>
        {h.alertCount > 0 && (
          <span className="inline-flex items-center gap-2">
            <Pill tone="yellow">{h.alertCount} alertas</Pill>
          </span>
        )}
      </div>
      {!m.datasetComplete && (
        <p className="mt-3 text-sm text-red-700">
          Base incompleta — números suspensos. Nenhum override ignora este bloqueio.
        </p>
      )}
      {m.datasetComplete && m.freshnessStatus !== "fresh" && (
        <p className="mt-3 text-sm text-gray-700">
          Artefato {m.freshnessStatus} — o Weekly não publica números até atualizar
          ({h.staleCount} séries com números suspensos).
        </p>
      )}
    </section>
  );
}

// KPIs (§6.2, máx. 8) — todos derivados de health; nenhum expõe CV/hazard/desvio.
export function RadarKpis({ vm }: { vm: RadarViewModel }) {
  const h = vm.health;
  return (
    <section aria-labelledby="radar-indicadores" className="mb-6 grid gap-3 [grid-template-columns:repeat(auto-fill,minmax(170px,1fr))]">
      <h2 id="radar-indicadores" className="sr-only">{RADAR_H.indicadores}</h2>
      <StatCard label="Base" value={vm.metadata.datasetComplete ? "completa" : "parcial"} sub={`${vm.metadata.rowsRead} linhas`} tone={vm.metadata.datasetComplete ? undefined : "red"} />
      <StatCard label="Frescor" value={vm.metadata.freshnessStatus} sub={vm.metadata.generatedAt ? vm.metadata.generatedAt.slice(0, 10) : "sem artefato"} tone={vm.metadata.freshnessStatus === "fresh" ? "green" : "yellow"} />
      <StatCard label="Elegíveis p/ pauta" value={h.seriesEditoriallyEligible} sub="gate editorial ≥5 ondas" tone={h.seriesEditoriallyEligible > 0 ? "green" : "gray"} />
      <StatCard label="Bloqueadas" value={h.seriesBlocked} sub="trabalho travado" tone={h.seriesBlocked > 0 ? "yellow" : "gray"} />
      <StatCard label="Suspeitas (temporais)" value={h.temporalCriticalCount} sub="cronologia corrompida" tone={h.temporalCriticalCount > 0 ? "red" : "gray"} />
      <StatCard label="Duplicidades prováveis" value={h.probableDuplicateCount} sub="intervalos falsos evitados" tone={h.probableDuplicateCount > 0 ? "yellow" : "gray"} />
      <StatCard label="Placeholders" value={h.placeholderCount} sub="não-programas excluídos" tone={h.placeholderCount > 0 ? "yellow" : "gray"} />
      <StatCard label="Alertas" value={h.alertCount} sub="dataset · frescor · dado · divergência" tone={h.alertCount > 0 ? "yellow" : "gray"} />
    </section>
  );
}

// Select rotulado reutilizável (novos filtros). Todo campo tem label e opção "Todos".
function Sel({
  name,
  label,
  value,
  children,
}: {
  name: string;
  label: string;
  value: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs text-gray-500">{label}</span>
      <select
        name={name}
        defaultValue={value ?? ""}
        className="min-h-[36px] rounded border border-line bg-paper px-2 py-1 text-ink"
      >
        {children}
      </select>
    </label>
  );
}

// Filtros e busca (§6.5) — GET form; sem estado de cliente. Opções derivadas do
// View Model; combinação por AND; estado refletido nos query params.
export function RadarFilters({ vm, current }: { vm: RadarViewModel; current: Record<string, string> }) {
  const opt = (v: string) => <option key={v} value={v}>{v}</option>;
  const facets = deriveFilterFacets(vm.series);
  return (
    <form method="get" aria-labelledby="radar-filtros" className="mb-4 flex flex-wrap items-end gap-2 rounded-lg border border-line bg-surface p-3 text-sm">
      <h2 id="radar-filtros" className="sr-only">{RADAR_H.filtros}</h2>
      <label className="flex flex-col gap-1">
        <span className="text-xs text-gray-500">Busca (rota/programa)</span>
        <input
          type="search"
          name="q"
          defaultValue={current.q ?? ""}
          placeholder="ex.: livelo→smiles"
          className="min-h-[36px] rounded border border-line bg-paper px-2 py-1 text-ink"
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-xs text-gray-500">Estado</span>
        <select name="status" defaultValue={current.status ?? ""} className="min-h-[36px] rounded border border-line bg-paper px-2 py-1 text-ink">
          <option value="">todos</option>
          {vm.filters.productStatuses.map((s) => (
            <option key={s} value={s}>{productStatusLabel(s)}</option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-xs text-gray-500">Confiança</span>
        <select name="confidence" defaultValue={current.confidence ?? ""} className="min-h-[36px] rounded border border-line bg-paper px-2 py-1 text-ink">
          <option value="">todas</option>
          {vm.filters.confidences.map(opt)}
        </select>
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-xs text-gray-500">Escopo</span>
        <select name="scope" defaultValue={current.scope ?? ""} className="min-h-[36px] rounded border border-line bg-paper px-2 py-1 text-ink">
          <option value="">rota + cluster</option>
          <option value="route">rota</option>
          <option value="cluster">cluster (agregado)</option>
        </select>
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-xs text-gray-500">Destino</span>
        <select name="destination" defaultValue={current.destination ?? ""} className="min-h-[36px] rounded border border-line bg-paper px-2 py-1 text-ink">
          <option value="">todos</option>
          {vm.filters.destinations.map(opt)}
        </select>
      </label>
      <Sel name="origin" label="Origem" value={current.origin}>
        <option value="">todas</option>
        <option value={CLUSTER_ORIGIN}>cluster (agregado)</option>
        {vm.filters.origins.map(opt)}
      </Sel>
      <Sel name="eligible" label="Elegibilidade" value={current.eligible}>
        <option value="">todas</option>
        <option value="yes">apta</option>
        <option value="no">bloqueada</option>
      </Sel>
      <Sel name="cause" label="Motivo de bloqueio" value={current.cause}>
        <option value="">todos</option>
        {facets.causes.map((c) => (
          <option key={c} value={c}>{CAUSE_LABEL[c] ?? c}</option>
        ))}
      </Sel>
      <Sel name="freshness" label="Frescor" value={current.freshness}>
        <option value="">todos</option>
        <option value="fresh">atual</option>
        <option value="stale">desatualizado</option>
        <option value="incomplete">incompleto</option>
        <option value="invalid">inválido</option>
        <option value="missing">indisponível</option>
      </Sel>
      <Sel name="duplicate" label="Duplicidade" value={current.duplicate}>
        <option value="">todas</option>
        <option value="none">sem duplicidade</option>
        <option value="possible">possível</option>
        <option value="probable">provável</option>
      </Sel>
      <Sel name="quality" label="Qualidade" value={current.quality}>
        <option value="">todas</option>
        <option value="valida">válida</option>
        <option value="atencao">atenção</option>
        <option value="bloqueada">bloqueada</option>
      </Sel>
      <Sel name="engine" label="Motor principal" value={current.engine}>
        <option value="">todos</option>
        <option value="predict">Predict</option>
        <option value="forecast">Forecast (fallback)</option>
        <option value="none">nenhum</option>
      </Sel>
      <Sel name="predict" label="Predict disp." value={current.predict}>
        <option value="">todos</option>
        <option value="yes">disponível</option>
        <option value="no">indisponível</option>
      </Sel>
      <Sel name="forecast" label="Forecast disp." value={current.forecast}>
        <option value="">todos</option>
        <option value="yes">disponível</option>
        <option value="no">indisponível</option>
      </Sel>
      <button type="submit" className="min-h-[36px] rounded bg-ink px-3 py-1 font-semibold text-paper">
        Filtrar
      </button>
      <a href="/admin/radar" className="min-h-[36px] rounded border border-line px-3 py-1 font-semibold text-gray-700 hover:bg-paper-dark">
        Limpar
      </a>
    </form>
  );
}

// Tabela unificada de séries (§6.4) — linguagem de produto; sem CV/hazard/desvio.
export function RadarSeriesTable({ series }: { series: RadarSeries[] }) {
  return (
    <section aria-labelledby="radar-series">
      <h2 id="radar-series" className="mb-2 font-display text-lg font-semibold text-ink">{RADAR_H.series}</h2>
      <Table>
      <thead>
        <tr>
          <Th>Rota</Th>
          <Th>Estado</Th>
          <Th>Janela</Th>
          <Th className="text-right">Chance</Th>
          <Th className="text-right">Bônus</Th>
          <Th>Confiança</Th>
          <Th>Elegível</Th>
          <Th className="text-right">Ondas</Th>
          <Th className="text-right">Válidas</Th>
          <Th className="text-right">Excl.</Th>
          <Th className="text-right">Warnings</Th>
        </tr>
      </thead>
      <tbody>
        {series.length === 0 ? (
          <EmptyRow cols={11} label={RADAR_EMPTY.no_filter_results.title} hint={`${RADAR_EMPTY.no_filter_results.description} ${RADAR_EMPTY.no_filter_results.action}`} />
        ) : (
          series.map((s) => (
            <tr key={`${s.scope}:${s.seriesKey}`}>
              <Td className="font-medium">
                <a href={`/admin/radar/${encodeURIComponent(s.seriesKey)}`} className="text-blue-600 hover:underline">
                  {s.seriesKey}
                </a>
                {s.scope === "cluster" && <span className="ml-1 text-xs text-gray-500">(agregado)</span>}
              </Td>
              <Td><Pill tone={STATUS_TONE[s.productStatus]}>{productStatusLabel(s.productStatus)}</Pill></Td>
              <Td className="text-gray-700">{s.window ?? "—"}</Td>
              <Td className="text-right font-mono tabular-nums">
                {s.primaryProbability ? (
                  <span>
                    {pct(s.primaryProbability.value)}
                    <span className="ml-1 text-xs text-gray-500">/ {s.primaryProbability.horizonDays}d</span>
                  </span>
                ) : (
                  "—"
                )}
              </Td>
              <Td className="text-right font-mono tabular-nums">{bonusLabel(s.bonus)}</Td>
              <Td>{s.modelConfidence}</Td>
              <Td>
                {s.editorialEligible ? (
                  <Pill tone="green">elegível</Pill>
                ) : (
                  <Pill tone="gray">{s.editorialBlockReasons[0] ?? "não"}</Pill>
                )}
              </Td>
              <Td className="text-right font-mono tabular-nums">{s.waves}</Td>
              <Td className="text-right font-mono tabular-nums">{s.campaignsValid}</Td>
              <Td className="text-right font-mono tabular-nums">{s.campaignsExcluded || "—"}</Td>
              <Td className="text-right font-mono tabular-nums">{s.warnings.length || "—"}</Td>
            </tr>
          ))
        )}
      </tbody>
    </Table>
    </section>
  );
}
