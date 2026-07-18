// Edge Function `coleta-tier1` — liga a coleta TIER 1 em produção
// (SPEC-SLICE-COLETA-TIER1-PRODUCAO.md). Roda o gate de confiança determinístico
// (D-048/D-049) sobre candidatos vivos do banco (crawleáveis, sem TIER 1, acima
// do piso de valor 70) e EXECUTA o plano de gravação — grava tier=1 quando
// corrobora_limpo + confiança ≥ 0,75; refuta com firmeza quando refuta + confiança
// ≥ 0,75; manda para revisão (sem gravar em campaigns) em todo o resto,
// incluindo corrobora_com_ajuste (comportamento já travado em golden, D-047).
//
// FONTE DE VERDADE: os módulos .mjs sob ./lib/ são o MESMO arquivo versionado
// em v2/lib/{coleta,adapters,vigencia.mjs} — importados aqui sem fork (INV-12).
// Mantenha os dois em sincronia ao redeployar (mesma disciplina da `campaigns`).
//
// Cron: pg_cron a cada 6h (proposta ratificada). verify_jwt=false (chamada só
// pelo cron interno do Supabase, mesmo padrão de `ingest`/`campaigns`).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { rodarCiclo } from "./lib/coleta/rodar-producao.mjs";

const supa = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

Deno.serve(async () => {
  const url = Deno.env.get("SUPABASE_URL")!.replace(/\/$/, "");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const hoje = new Date().toISOString().slice(0, 10);

  let resumo: any;
  let status = "ok";
  let erro: string | null = null;
  try {
    resumo = await rodarCiclo({ url, key, hoje });
  } catch (e) {
    status = "erro";
    erro = String(e).slice(0, 500);
    resumo = { candidatos_no_banco: 0, processados_agora: 0, contagens: {}, itens: [] };
  }

  try {
    await supa.from("runs").insert({
      product: "coleta-tier1",
      kind: "scheduled",
      status,
      human_note: erro
        ? `coleta-tier1 erro: ${erro}`
        : `coleta-tier1: ${resumo.candidatos_no_banco} candidatos, ${resumo.processados_agora} processados agora, ` +
          `${resumo.ja_processados_hoje ?? 0} já vistos hoje — ` +
          `grava_tier1=${resumo.contagens?.grava_tier1 ?? 0} refuta=${resumo.contagens?.refuta ?? 0} revisao=${resumo.contagens?.revisao ?? 0}`,
    });
  } catch (e) {
    console.error("Erro ao logar run:", e);
  }

  return new Response(JSON.stringify({ ...resumo, status, erro }), {
    status: erro ? 500 : 200,
    headers: { "Content-Type": "application/json" },
  });
});
