import { loadPredict, type PredictView } from "@/lib/admin-forecast";
import { formatWindow, type Confidence } from "@/lib/forecast";
import {
  PageHeader,
  StatCard,
  Pill,
  Table,
  Th,
  Td,
  EmptyRow,
  Sparkline,
  fmtDate,
  type Tone,
} from "@/components/admin/ui";
import { SubmitButton } from "@/components/admin/SubmitButton";
import { ActionForm } from "@/components/admin/toast";
import { DistributionBar, WindowTimeline, Field } from "@/components/admin/forecast-charts";
import {
  saveConfigAction,
  setOverrideAction,
  removeOverrideAction,
  recalcSnapshotAction,
} from "./actions";

const CONF_TONE: Record<Confidence, Tone> = {
  alta: "green",
  media: "blue",
  baixa: "gray",
  "em-formacao": "gray",
};
const CONF_LABEL: Record<Confidence, string> = {
  alta: "alta",
  media: "média",
  baixa: "baixa",
  "em-formacao": "em formação",
};

const INPUT = "rounded border border-line bg-surface px-2 py-1 text-sm text-ink";

function ConfCell({ v }: { v: PredictView }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <Pill tone={CONF_TONE[v.confidence]}>{CONF_LABEL[v.confidence]}</Pill>
      {v.overriddenConfidence && (
        <span className="text-[11px] text-gray-400" title="confiança sobrescrita pelo operador">
          override
        </span>
      )}
    </span>
  );
}

function QuickOverride({ v, action, label }: { v: PredictView; action: "pin" | "mute"; label: string }) {
  return (
    <ActionForm action={setOverrideAction}>
      <input type="hidden" name="scope" value={v.scope} />
      <input type="hidden" name="route" value={v.route} />
      <input type="hidden" name="action" value={action} />
      <SubmitButton variant="ghost" pendingLabel="…">
        {label}
      </SubmitButton>
    </ActionForm>
  );
}

function PredictTable({ title, sub, rows }: { title: string; sub: string; rows: PredictView[] }) {
  return (
    <section className="mb-8">
      <h2 className="mb-1 font-display text-lg font-semibold">{title}</h2>
      <p className="mb-3 text-sm text-gray-500">{sub}</p>
      <Table>
        <thead>
          <tr>
            <Th>{title.includes("programa") ? "Programa" : "Rota"}</Th>
            <Th>Confiança</Th>
            <Th>Janela prevista</Th>
            <Th className="text-right">Cadência</Th>
            <Th>Base</Th>
            <Th>Ações</Th>
          </tr>
        </thead>
        <tbody>
          {rows.length ? (
            rows.map((v) => (
              <tr key={v.key} className={v.muted ? "opacity-50" : undefined}>
                <Td className="font-medium">
                  <span className="inline-flex items-center gap-1.5">
                    {v.pinned && <Pill tone="blue">fixado</Pill>}
                    {v.muted && <Pill tone="gray">silenciado</Pill>}
                    {v.route}
                    {v.typicalPercent ? (
                      <span className="font-mono text-xs text-gray-400">{v.typicalPercent}%</span>
                    ) : null}
                  </span>
                </Td>
                <Td>
                  <ConfCell v={v} />
                </Td>
                <Td className="font-mono tabular-nums">
                  {v.windowStart ? formatWindow(v.windowStart, v.windowEnd) : "—"}
                </Td>
                <Td className="w-24 text-right">
                  {v.intervals.length >= 2 ? (
                    <Sparkline data={v.intervals} tone={CONF_TONE[v.confidence]} height={22} />
                  ) : (
                    <span className="text-xs text-gray-400">—</span>
                  )}
                </Td>
                <Td className="text-xs text-gray-500">{v.basis}</Td>
                <Td>
                  <div className="flex items-center gap-1">
                    <QuickOverride v={v} action="pin" label={v.pinned ? "—" : "fixar"} />
                    <QuickOverride v={v} action="mute" label={v.muted ? "—" : "silenciar"} />
                  </div>
                </Td>
              </tr>
            ))
          ) : (
            <EmptyRow cols={6} label="sem séries" />
          )}
        </tbody>
      </Table>
    </section>
  );
}

export default async function PredictPage() {
  const data = await loadPredict();
  const { config, configRow, overrides, result } = data;

  // Timeline: janelas dos programas dentro do horizonte semanal, não silenciadas.
  const timeline = data.clusters
    .filter((c) => !c.muted && c.windowStart)
    .slice(0, 12)
    .map((c) => ({
      label: c.route,
      start: c.windowStart as string,
      end: c.windowEnd as string,
      tone: CONF_TONE[c.confidence],
    }));

  // Autocomplete do override: todas as rotas e programas conhecidos.
  const routeOptions = Array.from(new Set([...data.clusters, ...data.routes].map((f) => f.route)));

  // Tendência de "com previsão" ao longo dos snapshots (cronológico).
  const snapTrend = [...data.snapshots].reverse().map((s) => s.with_prediction ?? 0);

  const cfgField = (
    key: string,
    label: string,
    hint: string,
    val: number,
    step = "1",
  ) => (
    <Field label={label} hint={hint}>
      <input type="number" name={key} defaultValue={val} step={step} className={INPUT} />
    </Field>
  );

  return (
    <>
      <PageHeader
        title="Área de previsão"
        sub="Motor de recorrência de janelas — ajuste, override e snapshots. Projeção estatística, nunca veredito nem garantia."
        actions={
          <ActionForm action={recalcSnapshotAction}>
            <SubmitButton variant="primary" pendingLabel="Recalculando…">
              Recalcular + snapshot
            </SubmitButton>
          </ActionForm>
        }
      />

      {!data.datasetComplete && (
        <div className="mb-4 rounded border border-red-600 bg-red-100 px-3 py-2 text-sm text-red-700">
          <strong>Dataset incompleto</strong> ({data.pagesRead} páginas lidas) — distribuição bloqueada.
          Nenhum número deve ser publicado até o carregamento completo. (Fase C0)
        </div>
      )}

      <section className="mb-4 grid gap-3 [grid-template-columns:repeat(auto-fill,minmax(160px,1fr))]">
        <StatCard label="Dataset" value={data.datasetComplete ? "completo" : "incompleto"} sub={`${data.ledgerRows} linhas · ${data.pagesRead} págs`} tone={data.datasetComplete ? "green" : "red"} />
        <StatCard label="Bloqueio temporal" value={data.containment.temporalBlocked ?? 0} sub="data suspeita/crítica" tone={(data.containment.temporalBlocked ?? 0) > 0 ? "yellow" : "green"} />
        <StatCard label="Placeholders" value={data.containment.placeholders ?? 0} sub="origem/destino inválido" tone={(data.containment.placeholders ?? 0) > 0 ? "yellow" : "green"} />
        <StatCard label="Dup. prováveis" value={data.containment.probableDuplicates ?? 0} sub={`${data.containment.possibleDuplicates ?? 0} possíveis`} tone={(data.containment.probableDuplicates ?? 0) > 0 ? "yellow" : "green"} />
        <StatCard label="Sem data" value={data.containment.missingDate ?? 0} sub="fora dos motores" tone="gray" />
      </section>

      <section className="mb-6 grid gap-3 [grid-template-columns:repeat(auto-fill,minmax(180px,1fr))]">
        <StatCard label="Séries rastreadas" value={result.routesTracked + result.clustersTracked} sub={`${result.routesTracked} rotas · ${result.clustersTracked} programas`} tone="blue" />
        <StatCard label="Com previsão" value={result.withPrediction} sub="base suficiente" tone="green" />
        <StatCard label="Ledger" value={data.ledgerRows} sub="linhas (dataset completo)" />
        <StatCard label="Gerado para" value={<span className="text-lg">{data.generatedFor}</span>} sub="data de referência" />
      </section>

      <section className="mb-8 grid gap-3 md:grid-cols-2">
        <DistributionBar title="Confiança · por rota" dist={data.distributionRoutes} />
        <DistributionBar title="Confiança · por programa" dist={data.distributionClusters} />
      </section>

      <section className="mb-8">
        <h2 className="mb-1 font-display text-lg font-semibold">Timeline de janelas previstas</h2>
        <p className="mb-3 text-sm text-gray-500">
          Programas dentro do horizonte semanal ({config.horizonWeekly}d). A linha vermelha marca hoje.
        </p>
        <WindowTimeline from={data.generatedFor} horizon={config.horizonWeekly} items={timeline} />
      </section>

      <section className="mb-8">
        <h2 className="mb-1 font-display text-lg font-semibold">Parâmetros do motor</h2>
        <p className="mb-3 text-sm text-gray-500">
          Ajusta como a recorrência vira confiança e janela. Vale para o admin, o daily e o weekly.
          {configRow?.updated_at && (
            <span className="text-gray-400"> · última alteração {fmtDate(configRow.updated_at)} por {configRow.updated_by ?? "—"}</span>
          )}
        </p>
        <ActionForm action={saveConfigAction} className="rounded-lg border border-line bg-surface p-4">
          <div className="grid gap-4 [grid-template-columns:repeat(auto-fill,minmax(180px,1fr))]">
            {cfgField("wave_epsilon_days", "Janela de onda (dias)", "Janelas ≤ N dias contam como a mesma campanha.", config.waveEpsilonDays)}
            {cfgField("min_samples", "Mínimo de janelas", "Abaixo disso, fica em formação (sem previsão).", config.minSamples)}
            {cfgField("samples_media", "Amostras p/ média", "Mín. de janelas para confiança média.", config.samplesMedia)}
            {cfgField("samples_alta", "Amostras p/ alta", "Mín. de janelas para confiança alta.", config.samplesAlta)}
            {cfgField("cv_media", "CV máx. média", "Coef. de variação máx. para média (menor = mais regular).", config.cvMedia, "0.05")}
            {cfgField("cv_alta", "CV máx. alta", "Coef. de variação máx. para alta.", config.cvAlta, "0.05")}
            {cfgField("horizon_daily", "Horizonte daily (dias)", "Janela do radar do daily.", config.horizonDaily)}
            {cfgField("horizon_weekly", "Horizonte weekly (dias)", "Janela do radar do weekly.", config.horizonWeekly)}
          </div>
          <div className="mt-4">
            <SubmitButton variant="primary" pendingLabel="Salvando…">
              Salvar parâmetros
            </SubmitButton>
          </div>
        </ActionForm>
      </section>

      <section className="mb-8">
        <h2 className="mb-1 font-display text-lg font-semibold">Overrides</h2>
        <p className="mb-3 text-sm text-gray-500">
          Fixar (destaca), silenciar (retira dos digests) ou sobrescrever a confiança de uma série.
        </p>
        <ActionForm action={setOverrideAction} className="mb-4 rounded-lg border border-line bg-surface p-4">
          <div className="flex flex-wrap items-end gap-3">
            <Field label="Escopo">
              <select name="scope" className={INPUT} defaultValue="cluster">
                <option value="cluster">programa</option>
                <option value="route">rota</option>
              </select>
            </Field>
            <Field label="Rota / programa" hint="Ex.: →latampass ou itau→latampass">
              <input name="route" list="routeOptions" className={`${INPUT} min-w-[220px]`} placeholder="→latampass" autoComplete="off" />
              <datalist id="routeOptions">
                {routeOptions.map((r) => (
                  <option key={r} value={r} />
                ))}
              </datalist>
            </Field>
            <Field label="Ação">
              <select name="action" className={INPUT} defaultValue="pin">
                <option value="pin">fixar</option>
                <option value="mute">silenciar</option>
                <option value="confidence">sobrescrever confiança</option>
              </select>
            </Field>
            <Field label="Confiança" hint="só p/ sobrescrever">
              <select name="confidence" className={INPUT} defaultValue="baixa">
                <option value="alta">alta</option>
                <option value="media">média</option>
                <option value="baixa">baixa</option>
              </select>
            </Field>
            <Field label="Nota">
              <input name="note" className={`${INPUT} min-w-[180px]`} placeholder="motivo (opcional)" />
            </Field>
            <SubmitButton variant="primary" pendingLabel="Salvando…">
              Aplicar
            </SubmitButton>
          </div>
        </ActionForm>

        <Table>
          <thead>
            <tr>
              <Th>Escopo</Th>
              <Th>Rota / programa</Th>
              <Th>Ação</Th>
              <Th>Nota</Th>
              <Th>Quando</Th>
              <Th></Th>
            </tr>
          </thead>
          <tbody>
            {overrides.length ? (
              overrides.map((o) => (
                <tr key={o.id}>
                  <Td className="text-gray-500">{o.scope === "cluster" ? "programa" : "rota"}</Td>
                  <Td className="font-medium">{o.route}</Td>
                  <Td>
                    {o.action === "confidence" ? (
                      <span>confiança → <Pill tone={CONF_TONE[(o.confidence ?? "baixa") as Confidence]}>{o.confidence}</Pill></span>
                    ) : o.action === "pin" ? (
                      <Pill tone="blue">fixado</Pill>
                    ) : (
                      <Pill tone="gray">silenciado</Pill>
                    )}
                  </Td>
                  <Td className="text-gray-500">{o.note ?? "—"}</Td>
                  <Td className="font-mono text-xs text-gray-500">{fmtDate(o.created_at)}</Td>
                  <Td>
                    <ActionForm action={removeOverrideAction}>
                      <input type="hidden" name="id" value={o.id} />
                      <SubmitButton variant="danger" pendingLabel="…">
                        remover
                      </SubmitButton>
                    </ActionForm>
                  </Td>
                </tr>
              ))
            ) : (
              <EmptyRow cols={6} label="nenhum override — a previsão sai direto do motor" />
            )}
          </tbody>
        </Table>
      </section>

      <section className="mb-8">
        <div className="mb-1 flex items-center justify-between gap-3">
          <h2 className="font-display text-lg font-semibold">Histórico de snapshots</h2>
          {snapTrend.length >= 2 && (
            <div className="w-40">
              <Sparkline data={snapTrend} tone="blue" height={26} />
            </div>
          )}
        </div>
        <p className="mb-3 text-sm text-gray-500">
          Cada &ldquo;Recalcular + snapshot&rdquo; grava um ponto. Acompanhe como a base de previsão evolui com o backfill.
        </p>
        <Table>
          <thead>
            <tr>
              <Th>Gerado para</Th>
              <Th className="text-right">Rotas</Th>
              <Th className="text-right">Programas</Th>
              <Th className="text-right">Com previsão</Th>
              <Th>Quando</Th>
              <Th>Por</Th>
            </tr>
          </thead>
          <tbody>
            {data.snapshots.length ? (
              data.snapshots.map((s) => (
                <tr key={s.id}>
                  <Td className="font-mono tabular-nums">{s.generated_for}</Td>
                  <Td className="text-right font-mono tabular-nums">{s.routes_tracked ?? "—"}</Td>
                  <Td className="text-right font-mono tabular-nums">{s.clusters_tracked ?? "—"}</Td>
                  <Td className="text-right font-mono tabular-nums">{s.with_prediction ?? "—"}</Td>
                  <Td className="font-mono text-xs text-gray-500">{fmtDate(s.created_at)}</Td>
                  <Td className="text-gray-500">{s.created_by ?? "—"}</Td>
                </tr>
              ))
            ) : (
              <EmptyRow cols={6} label="nenhum snapshot ainda — clique em “Recalcular + snapshot”" />
            )}
          </tbody>
        </Table>
      </section>

      <PredictTable
        title="Previsão por programa"
        sub="Cluster do destino — consolida campanhas program-wide de várias origens."
        rows={data.clusters}
      />
      <PredictTable
        title="Previsão por rota"
        sub="Origem → destino. Cadência = série de intervalos entre janelas."
        rows={data.routes}
      />

      <p className="mt-8 border-t border-line pt-4 text-xs text-gray-400">
        Projeção por recorrência do histórico do ledger. Sem base suficiente → em formação; nunca chuta uma data.
        Os radares daily/weekly usam estes mesmos números (média+ / baixa+), excluindo o que está silenciado.
      </p>
    </>
  );
}
