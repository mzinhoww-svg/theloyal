import { getJobs, type Job, type RunTarget } from "@/lib/admin-db";
import {
  PageHeader,
  Pill,
  StatusDot,
  Table,
  Th,
  Td,
  EmptyRow,
  toneForStatus,
  fmtDate,
} from "@/components/admin/ui";
import { SubmitButton } from "@/components/admin/SubmitButton";
import {
  toggleJobAction,
  runNowAction,
  bulkToggleGroupAction,
} from "./actions";

// Ordem e rótulos dos grupos; alvo do "Rodar agora" por grupo.
const GROUPS: { grupo: string; label: string; runTarget: RunTarget | null }[] = [
  { grupo: "coleta", label: "Coleta", runTarget: "ingest" },
  { grupo: "analise", label: "Análise", runTarget: "campaigns" },
  { grupo: "backfill", label: "Backfill", runTarget: "backfill-daily" },
];

function RunNowButton({ fn }: { fn: RunTarget }) {
  return (
    <form action={runNowAction}>
      <input type="hidden" name="fn" value={fn} />
      <SubmitButton variant="primary" pendingLabel="Disparando…">
        Rodar agora
      </SubmitButton>
    </form>
  );
}

function GroupTable({ jobs }: { jobs: Job[] }) {
  return (
    <Table>
      <thead>
        <tr>
          <Th>Job</Th>
          <Th>Schedule</Th>
          <Th>Alvo</Th>
          <Th>Último</Th>
          <Th>Estado</Th>
          <Th className="text-right">Ação</Th>
        </tr>
      </thead>
      <tbody>
        {jobs.length > 0 ? (
          jobs.map((j) => (
            <tr key={j.jobid}>
              <Td className="font-mono">{j.jobname}</Td>
              <Td className="font-mono tabular-nums text-gray-500">
                {j.schedule}
              </Td>
              <Td className="font-mono text-gray-500">{j.fn_target}</Td>
              <Td>
                <span className="inline-flex items-center gap-2">
                  <StatusDot tone={toneForStatus(j.last_status)} />
                  <span className="text-gray-500">
                    {j.last_status ?? "nunca"}
                    {j.last_start ? ` · ${fmtDate(j.last_start)}` : ""}
                  </span>
                </span>
              </Td>
              <Td>
                {j.active ? (
                  <Pill tone="green">ativo</Pill>
                ) : (
                  <Pill tone="gray">pausado</Pill>
                )}
              </Td>
              <Td className="text-right">
                <form action={toggleJobAction} className="flex justify-end">
                  <input type="hidden" name="jobname" value={j.jobname} />
                  <input
                    type="hidden"
                    name="active"
                    value={j.active ? "false" : "true"}
                  />
                  <SubmitButton
                    variant={j.active ? "danger" : "default"}
                    pendingLabel="…"
                  >
                    {j.active ? "Pausar" : "Ativar"}
                  </SubmitButton>
                </form>
              </Td>
            </tr>
          ))
        ) : (
          <EmptyRow cols={6} label="nenhum cron neste grupo" />
        )}
      </tbody>
    </Table>
  );
}

export default async function JobsPage() {
  const jobs = (await getJobs()) ?? [];
  const known = new Set(GROUPS.map((g) => g.grupo));
  const extraGroups = Array.from(
    new Set(jobs.map((j) => j.grupo).filter((g) => !known.has(g))),
  ).map((grupo) => ({ grupo, label: grupo, runTarget: null as RunTarget | null }));

  return (
    <>
      <PageHeader
        title="Crons"
        sub={`${jobs.filter((j) => j.active).length} ativos de ${jobs.length} — pg_cron via RPCs admin_*.`}
      />

      {[...GROUPS, ...extraGroups].map((g) => {
        const groupJobs = jobs
          .filter((j) => j.grupo === g.grupo)
          .sort((a, b) => a.jobname.localeCompare(b.jobname));
        if (groupJobs.length === 0 && g.runTarget === null) return null;
        const activeCount = groupJobs.filter((j) => j.active).length;

        return (
          <section key={g.grupo} className="mb-8">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-display text-lg font-semibold">
                {g.label}{" "}
                <span className="font-sans text-sm font-normal text-gray-400">
                  {activeCount}/{groupJobs.length} ativos
                </span>
              </h2>
              <div className="flex flex-wrap items-center gap-2">
                {g.grupo === "backfill" && groupJobs.length > 0 && (
                  <>
                    <form action={bulkToggleGroupAction}>
                      <input type="hidden" name="grupo" value={g.grupo} />
                      <input type="hidden" name="active" value="false" />
                      <SubmitButton variant="danger" pendingLabel="…">
                        Pausar todos
                      </SubmitButton>
                    </form>
                    <form action={bulkToggleGroupAction}>
                      <input type="hidden" name="grupo" value={g.grupo} />
                      <input type="hidden" name="active" value="true" />
                      <SubmitButton variant="default" pendingLabel="…">
                        Ativar todos
                      </SubmitButton>
                    </form>
                  </>
                )}
                {g.runTarget && <RunNowButton fn={g.runTarget} />}
              </div>
            </div>
            <GroupTable jobs={groupJobs} />
          </section>
        );
      })}
    </>
  );
}
