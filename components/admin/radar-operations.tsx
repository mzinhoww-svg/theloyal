// Operação do Radar (Fase P1-C) — abas, resumo, alertas, filas e "o que mudou".
// Apresentação apenas; dados de lib/radar-operations (puro) sobre o RadarViewModel.
// Server components. Nenhuma leitura/ cálculo novo.
import { Pill, Table, Th, Td, EmptyRow, EmptyState, StatCard } from "./ui";
import { productStatusLabel, type RadarSeries, type RadarViewModel } from "@/lib/radar-view-model";
import { mainEngine } from "@/lib/radar-filters";
import {
  buildRadarQueues,
  buildOperationalAlerts,
  operationalSummary,
  radarChangeEvents,
  NO_SNAPSHOT_MESSAGE,
  type RadarQueue,
  type RadarQueueKey,
  type RadarView,
} from "@/lib/radar-operations";
import { ALERT_SEVERITY_TONE, PRODUCT_STATUS_TONE } from "./radar-vocab";

export type { RadarView };

const SEV_TONE = ALERT_SEVERITY_TONE;
const pct = (n: number | null, step = 5): string => (n == null ? "—" : `${Math.round((n * 100) / step) * step}%`);
const bonus = (n: number | null): string => (n == null ? "—" : `~${n}%`);
const engineLabel = (s: RadarSeries): string => {
  const e = mainEngine(s);
  return e === "predict" ? "Predict" : e === "forecast" ? "Forecast (fallback)" : "—";
};
const href = (s: RadarSeries) => `/admin/radar/${encodeURIComponent(s.seriesKey)}`;

const TABS: { view: RadarView; label: string }[] = [
  { view: "geral", label: "Visão geral" },
  { view: "oportunidades", label: "Oportunidades" },
  { view: "revisoes", label: "Revisões" },
  { view: "bloqueios", label: "Bloqueios" },
  { view: "operacao", label: "Operação" },
];

export function RadarTabs({ current }: { current: RadarView }) {
  return (
    <nav aria-label="Seções do Radar" className="mb-5 flex flex-wrap gap-1 border-b border-line">
      {TABS.map((t) => {
        const active = t.view === current;
        return (
          <a
            key={t.view}
            href={t.view === "geral" ? "/admin/radar" : `/admin/radar?view=${t.view}`}
            aria-current={active ? "page" : undefined}
            className={`rounded-t px-3 py-2 text-sm font-semibold ${active ? "border-b-2 border-ink text-ink" : "text-gray-500 hover:text-ink"}`}
          >
            {t.label}
          </a>
        );
      })}
    </nav>
  );
}

// § 12 — Resumo operacional (recomendação textual por regras explícitas).
// B3: `compact` (visão geral) mostra risco + contagens + link p/ operação; a
// versão completa (view=operacao) acrescenta ação prioritária e a frase-resumo.
export function RadarOperationalSummary({ vm, compact = false }: { vm: RadarViewModel; compact?: boolean }) {
  const s = operationalSummary(vm);
  return (
    <section className="mb-5 rounded-lg border border-line bg-surface p-4" aria-labelledby="radar-resumo-op">
      <h2 id="radar-resumo-op" className="mb-2 font-display text-lg font-semibold text-ink">Resumo operacional</h2>
      <div className="mb-3 flex items-center gap-2">
        <Pill tone={s.healthy ? "green" : "yellow"}>{s.healthy ? "Radar saudável" : "Requer atenção"}</Pill>
        <span className="text-sm text-gray-500">Risco principal: <strong className="text-gray-700">{s.mainRisk}</strong></span>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard label="Prontas para análise" value={s.ready} tone={s.ready > 0 ? "green" : "gray"} />
        <StatCard label="Exigem atenção" value={s.needAttention} tone={s.needAttention > 0 ? "yellow" : "gray"} />
        <StatCard label="Bloqueadas" value={s.blocked} tone={s.blocked > 0 ? "red" : "gray"} />
      </div>
      {compact ? (
        <p className="mt-3 text-sm text-blue-600">
          <a href="/admin/radar?view=operacao" className="hover:underline">Ver operação (ação prioritária e alertas) →</a>
        </p>
      ) : (
        <>
          <p className="mt-3 text-sm text-gray-700">{s.text}</p>
          <p className="mt-1 text-sm text-blue-600">Ação prioritária: {s.priorityAction}.</p>
        </>
      )}
    </section>
  );
}

// § 9 — Painel de alertas operacionais.
export function RadarAlertsPanel({ vm }: { vm: RadarViewModel }) {
  const alerts = buildOperationalAlerts(vm);
  return (
    <section className="mb-6">
      <h2 className="mb-2 font-display text-lg font-semibold text-ink">Alertas operacionais</h2>
      {alerts.length === 0 ? (
        <EmptyState label="Nenhum alerta ativo." hint="Base completa, artefato fresco e sem dados críticos." />
      ) : (
        <Table>
          <thead>
            <tr><Th>Severidade</Th><Th>Alerta</Th><Th>Escopo</Th><Th className="text-right">Afetadas</Th><Th>Impacto</Th><Th>Ação</Th><Th>Diagnóstico</Th></tr>
          </thead>
          <tbody>
            {alerts.map((a) => (
              <tr key={a.id}>
                <Td><Pill tone={SEV_TONE[a.severity]}>{a.severity}</Pill></Td>
                <Td className="font-medium">{a.title}</Td>
                <Td>{a.scope === "global" ? "global" : "por série"}</Td>
                <Td className="text-right font-mono tabular-nums">{a.affected}</Td>
                <Td className="text-xs text-gray-500">{a.impact}</Td>
                <Td className="text-xs">{a.action}</Td>
                <Td><a href={a.diagnosticHref} className="text-blue-600 hover:underline">abrir →</a></Td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </section>
  );
}

// Uma fila (§5). `membership` mostra sobreposição (série em mais de uma fila).
export function RadarQueueList({ queue, membership }: { queue: RadarQueue; membership: Map<string, number> }) {
  return (
    <section className="mb-6">
      <h2 className="font-display text-lg font-semibold text-ink">{queue.title} <span className="font-mono text-sm text-gray-400">({queue.items.length})</span></h2>
      <p className="mb-2 text-xs text-gray-500">Entrada: {queue.criterion}. Ação: {queue.action}.</p>
      <Table>
        <thead>
          <tr><Th>Série</Th><Th>Motor</Th><Th>Estado</Th><Th>Janela</Th><Th className="text-right">Chance</Th><Th className="text-right">Bônus</Th><Th>Confiança</Th><Th className="text-right">Última</Th><Th></Th></tr>
        </thead>
        <tbody>
          {queue.items.length === 0 ? (
            <EmptyRow cols={9} label={queue.emptyMessage} />
          ) : (
            queue.items.map((s) => {
              const m = membership.get(`${s.scope}:${s.seriesKey}`) ?? 1;
              return (
                <tr key={`${s.scope}:${s.seriesKey}`}>
                  <Td className="font-medium">
                    <a href={href(s)} className="text-blue-600 hover:underline">{s.seriesKey}</a>
                    {s.scope === "cluster" && <span className="ml-1 text-xs text-gray-500">(agregado)</span>}
                    {m > 1 && <span className="ml-1 text-xs text-gray-400">+{m - 1} fila{m - 1 > 1 ? "s" : ""}</span>}
                  </Td>
                  <Td>{engineLabel(s)}</Td>
                  <Td><Pill tone={PRODUCT_STATUS_TONE[s.productStatus]}>{productStatusLabel(s.productStatus)}</Pill></Td>
                  <Td className="text-gray-700">{s.window ?? "—"}</Td>
                  <Td className="text-right font-mono tabular-nums">
                    {s.primaryProbability ? `${pct(s.primaryProbability.value)} / ${s.primaryProbability.horizonDays}d` : "—"}
                  </Td>
                  <Td className="text-right font-mono tabular-nums">{bonus(s.bonus)}</Td>
                  <Td>{s.modelConfidence}</Td>
                  <Td className="text-right font-mono tabular-nums">{s.lastCampaignDate ?? "—"}</Td>
                  <Td><a href={href(s)} className="text-blue-600 hover:underline">{queue.action} →</a></Td>
                </tr>
              );
            })
          )}
        </tbody>
      </Table>
    </section>
  );
}

// Renderiza um conjunto de filas (constrói uma vez; membership para sobreposição).
export function RadarQueuesView({ vm, keys }: { vm: RadarViewModel; keys: RadarQueueKey[] }) {
  const queues = buildRadarQueues(vm);
  const membership = new Map<string, number>();
  for (const q of queues) for (const s of q.items) {
    const k = `${s.scope}:${s.seriesKey}`;
    membership.set(k, (membership.get(k) ?? 0) + 1);
  }
  const selected = queues.filter((q) => keys.includes(q.key));
  return <>{selected.map((q) => <RadarQueueList key={q.key} queue={q} membership={membership} />)}</>;
}

// § 8 — Bloqueios separados em globais × por série.
export function RadarBlocksView({ vm }: { vm: RadarViewModel }) {
  const globals: { title: string; impact: string; href: string }[] = [];
  if (!vm.metadata.datasetComplete) globals.push({ title: "Base incompleta", impact: "Números suspensos em todo o Radar.", href: "/admin/radar?freshness=incomplete" });
  if (vm.metadata.freshnessStatus !== "fresh") globals.push({ title: `Artefato ${vm.metadata.freshnessStatus}`, impact: "Weekly não publica até atualizar.", href: "/admin/radar?freshness=stale" });
  return (
    <>
      <section className="mb-6">
        <h2 className="mb-2 font-display text-lg font-semibold text-ink">Bloqueios globais</h2>
        {globals.length === 0 ? (
          <EmptyState label="Nenhum bloqueio global." hint="Base completa e artefato fresco." />
        ) : (
          <ul className="space-y-2">
            {globals.map((g) => (
              <li key={g.title} className="rounded-lg border border-red-600 bg-red-100 p-3 text-sm">
                <strong className="text-red-700">{g.title}</strong> — {g.impact}{" "}
                <a href={g.href} className="text-blue-600 hover:underline">diagnosticar →</a>
              </li>
            ))}
          </ul>
        )}
      </section>
      <RadarQueuesView vm={vm} keys={["blocked"]} />
    </>
  );
}

// § 10 / § 11 — "O que mudou" (só o observável agora; resto exige snapshot).
export function RadarChanges({ vm }: { vm: RadarViewModel }) {
  const { available, unavailable } = radarChangeEvents(vm);
  return (
    <section className="mb-6">
      <h2 className="mb-2 font-display text-lg font-semibold text-ink">O que mudou</h2>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-lg border border-line bg-surface p-3">
          <p className="mb-2 text-sm font-semibold text-gray-700">Disponível agora (estado atual)</p>
          {available.length === 0 ? (
            <p className="text-sm text-gray-500">Nada observável nesta leitura.</p>
          ) : (
            <ul className="space-y-1 text-sm text-ink">
              {available.map((e) => (
                <li key={e.type} className="flex items-center gap-2">
                  <span className="font-mono tabular-nums text-gray-700">{e.count}</span>
                  <span>{e.label}</span>
                  <span className="text-xs text-gray-400">({e.scope === "global" ? "global" : "por série"})</span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="rounded-lg border border-dashed border-line bg-paper p-3">
          <p className="mb-2 text-sm font-semibold text-gray-700">Depende de snapshot histórico</p>
          <p className="mb-1 text-sm text-gray-500">{NO_SNAPSHOT_MESSAGE}</p>
          <ul className="list-disc pl-5 text-sm text-gray-500">
            {unavailable.map((u) => <li key={u}>{u}</li>)}
          </ul>
        </div>
      </div>
    </section>
  );
}
