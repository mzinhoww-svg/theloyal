// Trilha D — proposta assistida de correção de datas fabricadas.
// Casos derivados do lineage real (docs/auditoria/predict-forecast-lineage.md).
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  extractUrlDateHints,
  proposeDateCorrections,
  eventDateLooksFabricated,
} from "../lib/date-review.ts";
import { assessCampaignQuality } from "../lib/campaign-quality.ts";
import { normProgram } from "../lib/series-builder.ts";

const quality = (rows) => assessCampaignQuality(rows, { normalize: normProgram });

// L2 real: esfera→connectmiles, vigencia_fim 2024-02-22 mas fonte de fev/2025.
const L2 = {
  id: "esfera-connectmiles-transferencia-2024-02-22",
  tipo: "transferencia",
  origem: "esfera",
  destino: "connectmiles",
  percentual: 45,
  vigencia_inicio: null,
  vigencia_fim: "2024-02-22",
  first_seen: "2025-02-20",
  source_url: "https://exemplo.com/esfera-connectmiles-fev25.html",
};

// L1 real: gap 943d NÃO é múltiplo de ano (dia/mês fabricados) — sem proposta.
const L1 = {
  id: "livelo-connectmiles-transferencia-2023-12-12",
  tipo: "transferencia",
  origem: "livelo",
  destino: "connectmiles",
  percentual: 40,
  vigencia_inicio: null,
  vigencia_fim: "2023-12-12",
  first_seen: "2026-07-12",
  source_url: "https://exemplo.com/ultimo-dia-livelo-connectmiles.html",
};

test("extractUrlDateHints lê fev25, set-25, ano solto", () => {
  const hints = extractUrlDateHints("https://x.com/esfera-copa-bonus-75-set25.html");
  assert.ok(hints.some((h) => h.month === 9 && h.year === 2025));
  assert.ok(
    extractUrlDateHints("https://x.com/post-2026/promo-jul-26.html").some(
      (h) => h.month === 7 && h.year === 2026,
    ),
  );
  assert.deepEqual(extractUrlDateHints(null), []);
});

test("L2: propõe +1 ano com confiança alta (URL confirma fev25)", () => {
  const q = quality([L2]);
  assert.ok(q.excluded.some((e) => e.temporal.flags.includes("suspect_year")), "pré-condição: bloqueada");
  const props = proposeDateCorrections([L2], q);
  assert.equal(props.length, 1);
  const p = props[0];
  assert.equal(p.proposedDate, "2025-02-22");
  assert.equal(p.yearsShifted, 1);
  assert.equal(p.confidence, "alta");
  assert.ok(p.evidence.some((e) => e.includes("fev25")));
});

test("L1: gap 943d não casa com padrão de ano — NENHUMA proposta (não chutar)", () => {
  const q = quality([L1]);
  const props = proposeDateCorrections([L1], q);
  assert.equal(props.length, 0);
});

test("URL que contradiz a proposta descarta a correção", () => {
  const row = { ...L2, source_url: "https://exemplo.com/esfera-connectmiles-fev24.html" };
  const props = proposeDateCorrections([row], quality([row]));
  assert.equal(props.length, 0);
});

test("sem hint na URL → proposta com confiança média", () => {
  const row = { ...L2, source_url: "https://exemplo.com/esfera-connectmiles-bonus.html" };
  const props = proposeDateCorrections([row], quality([row]));
  assert.equal(props.length, 1);
  assert.equal(props[0].confidence, "media");
});

test("eventDateLooksFabricated: validador para o ingest", () => {
  assert.deepEqual(eventDateLooksFabricated("2024-02-22", "2025-02-20"), {
    fabricated: true,
    yearsOff: 1,
  });
  assert.equal(eventDateLooksFabricated("2023-12-12", "2026-07-12").fabricated, false);
  assert.equal(eventDateLooksFabricated("2026-07-01", "2026-07-10").fabricated, false);
});
