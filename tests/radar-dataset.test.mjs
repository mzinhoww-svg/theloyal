// Fase C0 — dataset completo com paginação (sem limite silencioso de 2.000).
import { test } from "node:test";
import assert from "node:assert/strict";
import { loadCampaignsPaged } from "../scripts/radar-dataset.mjs";

function fakePage(total, pageSize) {
  return async (offset, limit) => {
    assert.equal(limit, pageSize);
    const rows = [];
    for (let i = offset; i < Math.min(offset + limit, total); i++) rows.push({ id: `row-${i}` });
    return rows;
  };
}

test("carrega mais de 2.000 registros sem descarte silencioso", async () => {
  const r = await loadCampaignsPaged({ fetchPage: fakePage(2543, 1000), pageSize: 1000 });
  assert.equal(r.totalRows, 2543);
  assert.equal(r.rows.length, 2543);
  assert.equal(r.datasetComplete, true);
  assert.equal(r.pagesRead, 3); // 1000 + 1000 + 543
});

test("dataset exatamente múltiplo lê uma página vazia final e completa", async () => {
  const r = await loadCampaignsPaged({ fetchPage: fakePage(2000, 1000), pageSize: 1000 });
  assert.equal(r.totalRows, 2000);
  assert.equal(r.datasetComplete, true);
  assert.equal(r.pagesRead, 3); // 1000 + 1000 + 0(curta)
});

test("estouro do teto de páginas → datasetComplete=false (bloqueia distribuição)", async () => {
  const r = await loadCampaignsPaged({ fetchPage: fakePage(100000, 1000), pageSize: 1000, maxPages: 3 });
  assert.equal(r.pagesRead, 3);
  assert.equal(r.datasetComplete, false);
});

test("fetchPage ausente lança erro", async () => {
  await assert.rejects(() => loadCampaignsPaged({}));
});
