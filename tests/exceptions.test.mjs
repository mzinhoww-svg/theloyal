// Fase 2.2 — ledger de exceções: append-only e recusa de regra inviolável.
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { recordException, isRegistrableException, loadExceptions } from "../scripts/lib/exceptions.mjs";

const TMP = join(tmpdir(), "tl-exceptions-test.json");
function clean() { if (existsSync(TMP)) rmSync(TMP); }

test("regra inviolável não é registrável; regra comum é", () => {
  assert.equal(isRegistrableException("interno"), false);
  assert.equal(isRegistrableException("emoji"), false);
  assert.equal(isRegistrableException("cmi"), false);
  assert.equal(isRegistrableException("limite-de-deals"), true);
});

test("recordException recusa regra inviolável", () => {
  assert.throws(
    () => recordException(
      { edition: 28, item: "Deal 1", rule: "cmi", reviewer: "ed", justification: "x", finalDisposition: "A" },
      { dryRun: true, at: "2026-07-15T00:00:00Z" },
    ),
    /inviolável/,
  );
});

test("recordException exige campos completos", () => {
  assert.throws(() => recordException({ edition: 28, rule: "limite-de-deals" }, { dryRun: true }), /incompleta/);
});

test("recordException (dryRun) devolve registro com timestamp, sem escrever", () => {
  clean();
  const rec = recordException(
    { edition: 28, item: "Deal 4", rule: "limite-de-deals", reviewer: "ed", justification: "4o deal excepcional", finalDisposition: "B" },
    { dryRun: true, at: "2026-07-15T00:00:00Z", path: TMP },
  );
  assert.equal(rec.rule, "limite-de-deals");
  assert.equal(rec.at, "2026-07-15T00:00:00Z");
  assert.equal(existsSync(TMP), false, "dryRun não deve escrever");
});

test("append-only: entradas acumulam", () => {
  clean();
  recordException(
    { edition: 28, item: "Deal 1", rule: "limite-de-deals", reviewer: "ed", justification: "a", finalDisposition: "B" },
    { at: "2026-07-15T00:00:00Z", path: TMP },
  );
  recordException(
    { edition: 29, item: "Deal 2", rule: "confianca-radar", reviewer: "ed", justification: "b", finalDisposition: "D" },
    { at: "2026-07-15T01:00:00Z", path: TMP },
  );
  const ledger = loadExceptions(TMP);
  assert.equal(ledger.entries.length, 2);
  assert.equal(ledger.entries[0].edition, 28);
  assert.equal(ledger.entries[1].edition, 29);
  clean();
});

test("ledger inicial do repo carrega vazio e válido", () => {
  const ledger = loadExceptions();
  assert.equal(ledger.schemaVersion, 1);
  assert.ok(Array.isArray(ledger.entries));
});
