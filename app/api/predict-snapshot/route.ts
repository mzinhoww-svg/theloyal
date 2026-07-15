// Snapshot diário do Predict via cron (Vercel Cron chama GET com
// "Authorization: Bearer ${CRON_SECRET}"). Sem snapshot diário não existe
// tendência por série no admin. Idempotente: o insert é upsert por
// série+as_of_date, então re-execuções no mesmo dia não duplicam nada.
// Sem CRON_SECRET configurado o endpoint fica desligado (503) — nunca aberto.

import { NextResponse } from "next/server";
import { snapshotAll } from "@/lib/admin-predict";
import { adminConfigured } from "@/lib/admin-db";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret || !adminConfigured()) {
    return NextResponse.json(
      { ok: false, error: "cron não configurado (CRON_SECRET/SERVICE_KEY ausentes)" },
      { status: 503 },
    );
  }
  const auth = req.headers.get("authorization") ?? "";
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  try {
    const { count, asOf } = await snapshotAll("cron");
    return NextResponse.json({ ok: true, count, asOf });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "falha ao snapshotar" },
      { status: 500 },
    );
  }
}
