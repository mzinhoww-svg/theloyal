// Fase 2 — render da Weekly v2. Garante que ranking, lineage, transição e o
// bloco "O que vem" (radar rebaixado) aparecem, que movements aceitam objeto e
// string (retrocompat), e que validateWeekly aceita a estrutura v2.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  validateWeekly, renderWeeklyEmail, renderWeeklyPlain, renderWeeklyWeb,
} from "../scripts/render-weekly.mjs";

const DISCLAIMER = "Promoções podem mudar sem aviso. Confira sempre as regras no site oficial antes de comprar, transferir ou resgatar.";

function weekly(over = {}) {
  return {
    number: 28, period: "Semana de 6 a 12 de julho de 2026",
    dateStart: "2026-07-06", dateEnd: "2026-07-12", publishTime: "9H00", readingMinutes: 6,
    signal: "A semana consolidou o aperto de regra nas transferências para aéreo.",
    movements: {
      novas: [{ text: "Esfera → Latam Pass abriu.", fio: "esfera->latam-pass", lineage: { edition: 28, deal: 0 } }],
      seguem: ["Bônus para Latam Pass segue ativo em mais de uma origem."],
      venceram: [{ text: "Livelo → Smiles encerrou.", fio: "livelo->smiles", lineage: { edition: 27, deal: 0 } }],
    },
    highlights: [
      { title: "Esfera → Latam Pass", note: "A melhor conta da semana para quem é do clube.",
        verdict: "vale-agir", score: 88, lineage: { edition: 28, deal: 0 } },
      { title: "Livelo → Smiles perdeu força", note: "Virou caro sem o clube.",
        verdict: "evitaria", score: 30, transition: { from: "vale-olhar", to: "evitaria" }, lineage: { edition: 27, deal: 0 } },
    ],
    ranking: [
      { rank: 1, fio: "esfera->latam-pass", label: "Esfera → Latam Pass", anchor: "CPM R$ 12,00 /milheiro",
        verdict: "vale-agir", score: 88, lineage: { edition: 28, deal: 0 } },
    ],
    watch: ["Confirmar regulamento da próxima transferência para Latam Pass."],
    sources: [{ label: "Regulamento oficial (exemplo)", url: "https://www.latampass.latam.com" }],
    disclaimer: DISCLAIMER,
    ...over,
  };
}

test("validateWeekly: estrutura v2 (ranking + lineage) passa sem erro", () => {
  const { errors } = validateWeekly(weekly());
  assert.equal(errors.length, 0, errors.join("; "));
});

test("email: ranking, lineage, transição e 'O que vem' presentes", () => {
  const html = renderWeeklyEmail(weekly());
  assert.match(html, /Onde está o valor/);
  assert.match(html, /O que vem/);
  assert.match(html, /Daily Nº 28/);
  assert.match(html, /#1/);
  assert.match(html, /CPM R\$ 12,00/);
  // radar rebaixado: não deve haver o rótulo antigo "Radar de janelas"
  assert.doesNotMatch(html, /Radar de janelas/);
});

test("plain: blocos reordenados (mudou → pesou → valor → vem)", () => {
  const txt = renderWeeklyPlain(weekly());
  const iMudou = txt.indexOf("O QUE MUDOU");
  const iValor = txt.indexOf("ONDE ESTÁ O VALOR");
  const iVem = txt.indexOf("O QUE VEM");
  assert.ok(iMudou >= 0 && iValor > iMudou && iVem > iValor, `ordem: ${iMudou}/${iValor}/${iVem}`);
  assert.match(txt, /#1 Esfera → Latam Pass/);
});

test("web: ranking e lineage renderizam", () => {
  const html = renderWeeklyWeb(weekly());
  assert.match(html, /Onde está o valor/);
  assert.match(html, /Daily Nº 28/);
  assert.match(html, /O que vem/);
});

test("movements aceitam string (retrocompat) e objeto na mesma edição", () => {
  const wk = weekly();
  const txt = renderWeeklyPlain(wk);
  assert.match(txt, /Bônus para Latam Pass segue ativo/); // string
  assert.match(txt, /Esfera → Latam Pass abriu/); // objeto
});

test("email: sem emoji e disclaimer íntegro", () => {
  const html = renderWeeklyEmail(weekly());
  assert.match(html, /Confira sempre as regras no site oficial/);
});
