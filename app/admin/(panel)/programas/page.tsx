import { loadPrograms, type ProgramView } from "@/lib/admin-programs";
import {
  PageHeader,
  StatCard,
  Pill,
  Sparkline,
  EmptyState,
  type Tone,
} from "@/components/admin/ui";
import { FilterChips, type FilterParams } from "@/components/admin/dashboard";

const PATH = "/admin/programas";
const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

const STATUS_LABEL: Record<string, string> = {
  continua: "ativa",
  "vence-72h": "vence em 72h",
  nova: "nova",
};
const STATUS_TONE: Record<string, Tone> = { continua: "green", "vence-72h": "yellow", nova: "blue" };
const TIPO_LABEL: Record<string, string> = {
  transferencia: "transferência",
  compra: "compra de pontos",
  clube: "clube",
  cartao: "cartão",
  hotelaria: "hotelaria",
  estrutural: "estrutural",
};

const pct = (n: number | null | undefined) => (n == null ? "—" : `${Math.round(n * 100)}%`);
const shortDate = (iso: string | null) => {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y.slice(2)}`;
};

function PromoList({ p }: { p: ProgramView }) {
  if (!p.promos.length) {
    return (
      <p className="text-sm text-gray-500">
        Nenhuma promoção ativa.
        {p.daysSinceLast != null && (
          <span className="font-mono tabular-nums"> Última campanha há {p.daysSinceLast}d.</span>
        )}
      </p>
    );
  }
  return (
    <ul className="divide-y divide-line">
      {p.promos.slice(0, 5).map((promo) => (
        <li key={promo.id} className="flex flex-wrap items-baseline gap-x-3 gap-y-1 py-2">
          <span className="font-mono text-lg font-semibold tabular-nums text-ink">
            {promo.percentual != null ? `${promo.percentual}%` : "—"}
          </span>
          <span className="min-w-0 flex-1 truncate text-sm text-ink">
            {promo.origem ? `${promo.origem} → ${promo.destino}` : promo.destino}
            <span className="ml-2 text-xs text-gray-500">{TIPO_LABEL[promo.tipo] ?? promo.tipo}</span>
          </span>
          <Pill tone={STATUS_TONE[promo.status] ?? "gray"}>{STATUS_LABEL[promo.status] ?? promo.status}</Pill>
          <span className="font-mono text-xs tabular-nums text-gray-500">
            até {shortDate(promo.vigenciaFim)}
          </span>
          {promo.sourceUrl && (
            <a
              href={promo.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs font-semibold text-blue-600 underline hover:text-blue-700"
            >
              {promo.sourceName || "fonte"}
            </a>
          )}
        </li>
      ))}
      {p.promos.length > 5 && (
        <li className="py-2 text-xs text-gray-500">+ {p.promos.length - 5} promoção(ões) ativa(s)</li>
      )}
    </ul>
  );
}

function EngineBoxHeader({ label, confidence }: { label: string; confidence: string | null }) {
  return (
    <div className="mb-1 flex items-center justify-between gap-2">
      <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">{label}</span>
      <span className="font-mono text-xs text-gray-500">
        <span className="sr-only">confiança: </span>
        {confidence ?? "sem série"}
      </span>
    </div>
  );
}

function EngineCell({ p }: { p: ProgramView }) {
  const f = p.forecast;
  const eng = p.predict;
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <div className="rounded border border-line bg-paper p-3">
        <EngineBoxHeader label="Predict" confidence={eng ? eng.confidence : null} />
        {eng && !eng.blockReason ? (
          <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
            <div>
              <dt className="text-gray-500">Prob. 30d</dt>
              <dd className="font-mono text-base font-semibold tabular-nums text-ink">
                {pct(eng.probabilities?.p30)}
              </dd>
            </div>
            <div>
              <dt className="text-gray-500">Prob. 90d</dt>
              <dd className="font-mono text-base font-semibold tabular-nums text-ink">
                {pct(eng.probabilities?.p90)}
              </dd>
            </div>
            <div>
              <dt className="text-gray-500">Backtest (janela)</dt>
              <dd className="font-mono tabular-nums text-ink">
                {eng.backtest && eng.backtest.observations > 0
                  ? `${pct(eng.backtest.windowHitRate)} · ${eng.backtest.observations} obs`
                  : "—"}
              </dd>
            </div>
            <div>
              <dt className="text-gray-500">Cadência</dt>
              <dd className="font-mono tabular-nums text-ink">
                {eng.medianIntervalAll != null ? `~${eng.medianIntervalAll}d` : "—"}
              </dd>
            </div>
          </dl>
        ) : (
          <p className="text-xs text-gray-500">{eng?.blockReason ?? "programa sem série no Predict"}</p>
        )}
        {p.trend && (
          <div className="mt-2">
            <div className="mb-0.5 text-xs text-gray-500">p30 ao longo dos snapshots</div>
            <Sparkline data={p.trend} tone={p.health.tone === "red" ? "red" : "blue"} height={18} />
          </div>
        )}
      </div>
      <div className="rounded border border-line bg-paper p-3">
        <EngineBoxHeader label="Forecast" confidence={f ? f.confidence : null} />
        {f ? (
          <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
            <div>
              <dt className="text-gray-500">Janela prevista</dt>
              <dd className="font-mono tabular-nums text-ink">{p.forecastWindow ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-gray-500">Ondas</dt>
              <dd className="font-mono tabular-nums text-ink">{f.samples}</dd>
            </div>
            <div>
              <dt className="text-gray-500">Editorial</dt>
              <dd>{f.editorialEligible ? <Pill tone="green">elegível</Pill> : <Pill tone="gray">bloqueada</Pill>}</dd>
            </div>
            <div>
              <dt className="text-gray-500">Bônus típico</dt>
              <dd className="font-mono tabular-nums text-ink">
                {f.typicalPercent != null ? `~${f.typicalPercent}%` : "—"}
              </dd>
            </div>
          </dl>
        ) : (
          <p className="text-xs text-gray-500">programa sem série no Forecast</p>
        )}
      </div>
    </div>
  );
}

function ProgramCard({ p }: { p: ProgramView }) {
  return (
    <section className="rounded-lg border border-line bg-surface p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2 border-b border-line pb-3">
        <h2 className="font-display text-lg font-semibold text-ink">{p.label}</h2>
        <span className="flex flex-wrap items-center gap-1.5">
          {p.promos.length > 0 && (
            <span className="font-mono text-xs tabular-nums text-gray-500">
              {p.promos.length} ativa(s)
              {p.bestPercent != null ? ` · melhor ${p.bestPercent}%` : ""}
            </span>
          )}
          <Pill tone={p.health.tone}>{p.health.label}</Pill>
        </span>
      </div>

      <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-gray-500">
        Principais promoções
      </div>
      <PromoList p={p} />

      <div className="mb-1 mt-4 text-xs font-semibold uppercase tracking-wider text-gray-500">
        Saúde dos motores
      </div>
      <EngineCell p={p} />
      {p.health.reasons.length > 0 && (
        <ul className="mt-2 list-disc pl-5 text-xs text-gray-500">
          {p.health.reasons.map((r, i) => (
            <li key={i}>{r}</li>
          ))}
        </ul>
      )}
    </section>
  );
}

export default async function ProgramasPage({
  searchParams,
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const params: FilterParams = {};
  const escopo = first(searchParams?.escopo).trim();
  if (escopo) params.escopo = escopo;
  const showAll = escopo === "todos";

  const data = await loadPrograms();
  const programs = showAll ? data.programs : data.programs.filter((p) => p.airline);
  const hiddenCount = data.programs.length - programs.length;

  return (
    <>
      <PageHeader
        title="Programas"
        sub={`Promoções ativas e saúde dos motores por programa · ${data.ledgerRows} campanhas no ledger · as of ${data.asOf}. Projeção estatística, nunca veredito nem garantia.`}
      />

      {!data.datasetComplete && (
        <div
          role="alert"
          className="mb-4 rounded-lg border border-red-600 bg-red-100 p-3 text-sm text-red-700"
        >
          Leitura do ledger incompleta — promoções e saúde abaixo podem estar parciais.
        </div>
      )}

      <section className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-5">
        <StatCard label="Programas" value={programs.length} sub={showAll ? "todos os destinos" : "cias aéreas"} tone="gray" />
        <StatCard label="Com promo ativa" value={programs.filter((p) => p.promos.length > 0).length} sub="pelo menos 1 campanha viva" tone="green" />
        <StatCard label="Promoções ativas" value={programs.reduce((a, p) => a + p.promos.length, 0)} sub="continua · vence-72h · nova" tone="blue" />
        <StatCard label="Motores saudáveis" value={programs.filter((p) => p.health.tone === "green" || p.health.tone === "blue").length} sub="prontos, confiança média+" tone="green" />
        <StatCard label="Em atenção" value={programs.filter((p) => p.health.tone === "yellow" || p.health.tone === "red").length} sub="alertas, divergência ou dado bloqueado" tone={programs.some((p) => p.health.tone === "red") ? "red" : "gray"} />
      </section>

      <section className="mb-4 flex flex-wrap items-center gap-x-5 gap-y-2">
        <FilterChips
          path={PATH}
          params={params}
          param="escopo"
          label="Escopo"
          options={[{ label: `todos os programas${hiddenCount > 0 && !showAll ? ` (+${hiddenCount})` : ""}`, value: "todos" }]}
        />
      </section>

      {programs.length ? (
        <div className="grid gap-4 xl:grid-cols-2">
          {programs.map((p) => (
            <ProgramCard key={p.program} p={p} />
          ))}
        </div>
      ) : (
        <EmptyState
          label="nenhum programa no recorte"
          hint="Programas aparecem quando têm promoção ativa no ledger ou série em algum motor."
        />
      )}

      <p className="mt-8 max-w-prose border-t border-line pt-4 text-sm text-gray-500">
        Promoções vêm do ledger (status continua/vence-72h/nova). Saúde compõe os sinais reais dos
        motores — readiness, confiança, backtest e divergência; sem base suficiente o programa fica
        &ldquo;sem base&rdquo;, nunca um número chutado. Promoções podem mudar sem aviso. Confira
        sempre as regras no site oficial antes de comprar, transferir ou resgatar.
      </p>
    </>
  );
}
