// Fase 0 — contrato de dados: identidade canônica do deal (entityKey / routeKey
// / firstSeen) que a consolidação Weekly usa para agrupar deals num Fio.
// Testa os helpers de lib.mjs e os gates de validate.mjs.
import { test } from "node:test";
import assert from "node:assert/strict";
import { entityKeySet, parseRouteKey, loadEntities } from "../scripts/lib.mjs";
import { validateEdition } from "../scripts/validate.mjs";

const KNOWN = new Set(["livelo", "esfera", "smiles", "latam-pass", "azul-fidelidade"]);

// Edição mínima válida, parametrizável pelo deal.
function edition(deal) {
  return {
    number: 99, date: "2026-07-08", weekday: "QUARTA-FEIRA", publishTime: "8H00",
    readingMinutes: 5,
    signal: "sinal de teste",
    deals: [{
      category: "Transferência bonificada · Livelo → Smiles",
      title: "t", context: "c",
      conta: { rows: [["a", "b"]], result: ["CPM", "R$ 10,00"] },
      verdict: "vale-olhar", tlScore: 76,
      vigencia: "2026-07-31T23:59:00-03:00",
      source: "Regulamento oficial", sourceUrl: "https://www.smiles.com.br",
      ...deal,
    }],
    sources: [{ label: "x", url: "https://www.smiles.com.br" }],
    disclaimer: "Promoções podem mudar sem aviso. Confira sempre as regras no site oficial antes de comprar, transferir ou resgatar.",
  };
}

test("parseRouteKey: origem->destino válido", () => {
  assert.deepEqual(parseRouteKey("livelo->smiles"), { origem: "livelo", destino: "smiles" });
  assert.deepEqual(parseRouteKey("esfera->latam-pass"), { origem: "esfera", destino: "latam-pass" });
});

test("parseRouteKey: formato inválido → null", () => {
  assert.equal(parseRouteKey("livelo"), null);
  assert.equal(parseRouteKey("livelo->"), null);
  assert.equal(parseRouteKey("Livelo->Smiles"), null); // maiúscula não é chave canônica
  assert.equal(parseRouteKey(null), null);
});

test("entityKeySet: o registro real carrega as entidades vivas", () => {
  const set = entityKeySet(loadEntities());
  for (const k of ["livelo", "esfera", "smiles", "latam-pass", "azul-fidelidade"]) {
    assert.ok(set.has(k), `registro deve conter ${k}`);
  }
});

test("deal com entityKey conhecido: sem aviso de rastreabilidade", () => {
  const { errors, warnings } = validateEdition(edition({ entityKey: "smiles", routeKey: "livelo->smiles" }), { entityKeys: KNOWN });
  assert.equal(errors.length, 0, errors.join("; "));
  assert.ok(!warnings.some((w) => /sem entityKey/.test(w)));
});

test("deal sem entityKey: aviso, não erro (edição legada não quebra)", () => {
  const { errors, warnings } = validateEdition(edition({}), { entityKeys: KNOWN });
  assert.equal(errors.length, 0, errors.join("; "));
  assert.ok(warnings.some((w) => /sem entityKey/.test(w)));
});

test("deal com entityKey inexistente: erro (bloqueia)", () => {
  const { errors } = validateEdition(edition({ entityKey: "inexistente" }), { entityKeys: KNOWN });
  assert.ok(errors.some((e) => /entityKey "inexistente" não existe/.test(e)));
});

test("routeKey fora do formato: erro", () => {
  const { errors } = validateEdition(edition({ entityKey: "smiles", routeKey: "livelo_smiles" }), { entityKeys: KNOWN });
  assert.ok(errors.some((e) => /routeKey .* fora do formato/.test(e)));
});

test("routeKey com entidade desconhecida: aviso (não erro)", () => {
  const { errors, warnings } = validateEdition(edition({ entityKey: "smiles", routeKey: "livelo->desconhecido" }), { entityKeys: KNOWN });
  assert.equal(errors.length, 0, errors.join("; "));
  assert.ok(warnings.some((w) => /destino "desconhecido" do routeKey/.test(w)));
});

test("firstSeen inválido: erro", () => {
  const { errors } = validateEdition(edition({ entityKey: "smiles", firstSeen: "ontem" }), { entityKeys: KNOWN });
  assert.ok(errors.some((e) => /firstSeen "ontem" inválido/.test(e)));
});
