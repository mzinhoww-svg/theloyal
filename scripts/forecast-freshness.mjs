// Controle de frescor do artefato de previsão (content/forecast.json). Fase C0.
// Nenhum consumidor editorial pode usar um artefato desatualizado, incompleto,
// ausente ou inválido sem sinalizar. Determinístico e puro (now injetável) para
// ser testável. Sem I/O aqui, exceto o helper assessForecastFile.
import { existsSync, readFileSync } from "node:fs";

export const DEFAULT_MAX_FORECAST_AGE_HOURS = 24;

// Estados possíveis. Só "fresh" libera números editoriais.
//   fresh · stale · missing · invalid · incomplete
export function assessForecastArtifact(artifact, opts = {}) {
  const maxAgeHours = opts.maxAgeHours ?? DEFAULT_MAX_FORECAST_AGE_HOURS;
  const nowMs = opts.now ? Date.parse(opts.now) : Date.now();

  if (artifact == null) return { status: "missing", reasons: ["artefato ausente"] };
  if (typeof artifact !== "object") return { status: "invalid", reasons: ["artefato não é um objeto"] };

  const generatedAt = artifact.generatedAt ?? null;
  if (!generatedAt || Number.isNaN(Date.parse(generatedAt)))
    return { status: "invalid", generatedAt, reasons: ["generatedAt ausente ou inválido"] };

  const ledgerRows = typeof artifact.ledgerRows === "number" ? artifact.ledgerRows : null;

  // datasetComplete === false → incompleto (artefatos antigos sem o campo são
  // tratados como completos por retrocompatibilidade).
  if (artifact.datasetComplete === false)
    return { status: "incomplete", generatedAt, ledgerRows, reasons: ["datasetComplete=false"] };

  const ageHours = (nowMs - Date.parse(generatedAt)) / 3_600_000;
  if (ageHours > maxAgeHours)
    return { status: "stale", ageHours, generatedAt, ledgerRows, reasons: [`idade ${ageHours.toFixed(1)}h > ${maxAgeHours}h`] };

  return { status: "fresh", ageHours, generatedAt, ledgerRows, reasons: [] };
}

// Lê e avalia um arquivo de forecast. missing/invalid tratados sem lançar.
export function assessForecastFile(path, opts = {}) {
  if (!existsSync(path)) return { status: "missing", reasons: ["arquivo ausente"] };
  let artifact;
  try {
    artifact = JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return { status: "invalid", reasons: ["JSON inválido"] };
  }
  return assessForecastArtifact(artifact, opts);
}
