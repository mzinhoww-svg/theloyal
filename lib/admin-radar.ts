// Loader do Radar unificado (Fase P1-A) — camada de I/O.
//
// Faz UMA leitura do ledger e devolve o Radar View Model (composição pura em
// lib/radar-view-model.ts). Server-only (usa admin-db / SERVICE_ROLE_KEY).
// NÃO escreve nada, NÃO altera motores/gates, NÃO persiste.
//
// Diferença deliberada vs. /admin/forecast e /admin/predict: o Radar lê também
// as colunas de PROVENIÊNCIA (first_seen/observed_at/created_at/source_url) — as
// mesmas que o pipeline `scripts/forecast.mjs` (select=*) já usa — para que a
// contenção temporal C0.2 (ex.: `suspect_year` do caso 943) apareça de fato. As
// telas atuais selecionam só 7 colunas e por isso não disparam `suspect_year`;
// o Radar surfa esse gap sem tocar nos motores.

import { join } from "node:path";
import { fetchAllRows } from "./admin-db";
import { getConfig } from "./admin-forecast";
import type { CampaignRow } from "./forecast";
import { composeRadarViewModel, type RadarViewModel } from "./radar-view-model";
// Frescor: reusa o módulo canônico (scripts/forecast-freshness.mjs). allowJs no
// tsconfig permite o import; nenhuma lógica de frescor é reimplementada.
import { assessForecastFile } from "../scripts/forecast-freshness.mjs";

// Colunas lidas: identidade + datas de evento + datas de proveniência + sinais
// de duplicidade (source_url). Explícitas (não `*`) para não puxar colunas pesadas.
const RADAR_SELECT =
  "id,tipo,origem,destino,percentual,vigencia_inicio,vigencia_fim,first_seen,last_seen,observed_at,created_at,source_url,origin";

const FORECAST_ARTIFACT = join(process.cwd(), "content", "forecast.json");

export async function loadRadar(now?: string): Promise<RadarViewModel> {
  const asOf = (now ?? new Date().toISOString()).slice(0, 10);
  const [{ config }, loaded] = await Promise.all([
    getConfig(),
    fetchAllRows<CampaignRow>("campaigns", RADAR_SELECT),
  ]);

  const fresh = assessForecastFile(FORECAST_ARTIFACT, { now: `${asOf}T23:59:59Z` }) as {
    status: string;
    generatedAt?: string | null;
    ageHours?: number | null;
  };

  return composeRadarViewModel(loaded.rows, {
    now: asOf,
    config,
    datasetComplete: loaded.complete,
    pagesRead: loaded.pages,
    freshness: {
      status: fresh.status,
      generatedAt: fresh.generatedAt ?? null,
      ageHours: fresh.ageHours ?? null,
    },
  });
}
