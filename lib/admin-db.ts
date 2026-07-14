// Camada de acesso ao Supabase para a Central de Controle (/admin).
// Fetch puro contra a API REST — sem supabase-js, para manter a regra
// "Next.js e mais nada" do CLAUDE.md. Usa a SERVICE_ROLE_KEY, que bypassa
// RLS e habilita as RPCs admin_*; por isso este modulo e server-only e nunca
// pode ser importado por um Client Component.

const SUPABASE_URL =
  process.env.SUPABASE_URL?.trim() || "https://qjqnqcsdnpvvmyzkavoq.supabase.co";
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

export function adminConfigured(): boolean {
  return !!SERVICE_KEY;
}

function headers(extra?: Record<string, string>): Record<string, string> {
  return {
    apikey: SERVICE_KEY ?? "",
    authorization: `Bearer ${SERVICE_KEY ?? ""}`,
    "content-type": "application/json",
    ...extra,
  };
}

// Leitura direta de tabela via PostgREST. Retorna [] em qualquer falha para
// nunca derrubar a pagina — a UI trata lista vazia como estado valido.
export async function rest<T = Record<string, unknown>>(
  path: string,
): Promise<T[]> {
  if (!SERVICE_KEY) return [];
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
      headers: headers(),
      cache: "no-store",
    });
    if (!res.ok) return [];
    return (await res.json()) as T[];
  } catch {
    return [];
  }
}

// Chamada de RPC (funcoes admin_*). Retorna o JSON cru; o chamador tipa.
export async function rpc<T = unknown>(
  fn: string,
  args: Record<string, unknown> = {},
): Promise<T | null> {
  if (!SERVICE_KEY) return null;
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify(args),
      cache: "no-store",
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

// Escrita (PATCH). Usada na edicao inline de campanhas e no reprocessar do
// backfill. Lanca em erro para a Server Action reportar falha ao operador.
export async function patch(
  table: string,
  filter: string,
  body: Record<string, unknown>,
): Promise<void> {
  if (!SERVICE_KEY) throw new Error("SUPABASE_SERVICE_ROLE_KEY ausente");
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${filter}`, {
    method: "PATCH",
    headers: headers({ prefer: "return=minimal" }),
    body: JSON.stringify(body),
    cache: "no-store",
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`PATCH ${table} falhou (${res.status}) ${detail.slice(0, 200)}`);
  }
}

// ---- Tipos das RPCs (espelham o retorno real verificado no banco) ----

export type Metrics = {
  news_hoje: number;
  news_total: number;
  news_pendentes: number;
  campanhas_total: number;
  campanhas_ativas: number;
  campanhas_hoje: number;
  backfill_queue_pendente: number;
  backfill_tracker_pendente: number;
  jobs_ativos: number;
  jobs_total: number;
};

export type Job = {
  jobid: number;
  jobname: string;
  grupo: string;
  fn_target: string;
  schedule: string;
  active: boolean;
  last_status: string | null;
  last_start: string | null;
  last_msg: string | null;
};

export type Run = {
  jobname: string;
  status: string | null;
  start_time: string | null;
  end_time: string | null;
  return_message: string | null;
};

export type BackfillProgress = {
  tracker: { done?: number; pending?: number; error?: number };
  queue: { done?: number; pending?: number; error?: number };
};

export type Campaign = {
  id: string;
  origem: string;
  destino: string;
  tipo: string;
  percentual: number | null;
  cpm: string | null;
  tl_score: number | null;
  verdict: string | null;
  status: string;
  origin: string | null;
  vigencia_fim: string | null;
  last_seen: string | null;
  observed_at: string | null;
  notes: string | null;
};

export type PipelineRun = {
  id: string;
  product: string;
  kind: string | null;
  status: string | null;
  started_at: string | null;
  finished_at: string | null;
  campaigns_found: number | null;
  gate_validate: boolean | null;
  gate_audit: boolean | null;
  human_note: string | null;
};

export type BackfillQueueRow = {
  id: string;
  source: string;
  url: string;
  status: string | null;
  title: string | null;
  error_msg: string | null;
  processed_at: string | null;
};

export type NewsRow = {
  id: string;
  source: string;
  title: string | null;
  url: string;
  published_at: string | null;
  fetched_at: string | null;
  processed: boolean | null;
  campaigns_extracted: number | null;
  model_used: string | null;
  error: string | null;
};

export type BackfillTrackerRow = {
  id: number;
  source: string;
  sitemap_url: string;
  status: string | null;
  urls_found: number | null;
  urls_inserted: number | null;
  error_msg: string | null;
};

// ---- Wrappers tipados ----

export const getMetrics = () => rpc<Metrics>("admin_metrics");
export const getJobs = () => rpc<Job[]>("admin_list_jobs");
export const getBackfillProgress = () =>
  rpc<BackfillProgress>("admin_backfill_progress");
export const getRecentRuns = (limit: number) =>
  rpc<Run[]>("admin_recent_runs", { p_limit: limit });

// Alvos validos para admin_run_now — trava contra input arbitrario.
export const RUN_TARGETS = [
  "ingest",
  "campaigns",
  "backfill",
  "backfill-daily",
  "backfill-simple",
] as const;
export type RunTarget = (typeof RUN_TARGETS)[number];

export function toggleJob(jobname: string, active: boolean) {
  return rpc<string>("admin_toggle_job", {
    p_jobname: jobname,
    p_active: active,
  });
}

export function runNow(fn: RunTarget) {
  return rpc<string>("admin_run_now", { p_fn: fn });
}

export const getNews = (limit = 500) =>
  rest<NewsRow>(
    `news_raw?select=id,source,title,url,published_at,fetched_at,processed,campaigns_extracted,model_used,error&order=fetched_at.desc.nullslast&limit=${limit}`,
  );
