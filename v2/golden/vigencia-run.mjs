// Mede o parser de vigência contra o gold estrito (M2 slice 3).
//   node v2/golden/vigencia-run.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { parseVigencia } from '../lib/vigencia.mjs';

const DIR = dirname(fileURLToPath(import.meta.url));
const rot = JSON.parse(readFileSync(join(DIR, 'AMOSTRA-100-ROTULADA.json'), 'utf8'));
const gold = new Map(JSON.parse(readFileSync(join(DIR, 'vigencia-gold.json'), 'utf8')).map((g) => [g.id, g.esperado]));
const camp = rot.filter((r) => r.classe === 'campanha');
const slugDe = (u) => u.replace(/\/+$/, '').split('/').pop().replace(/\.html$/, '');

const IN = 'indeterminada';
const res = { correta: [], year_error: [], wrong: [], overprecision: [], missed: [], correta_indet: [] };
for (const r of camp) {
  const esperado = gold.get(r.id);
  const out = parseVigencia({ texto: `${r.input.titulo} ${r.input.trecho}`, slug: slugDe(r.url), publicado_em: null });
  const got = out.vigencia_fim;
  const rec = { id: r.id, esperado, got, motivo: out.motivo };
  if (esperado === IN && got === IN) res.correta_indet.push(rec);
  else if (esperado === IN && got !== IN) res.overprecision.push(rec);          // INV-16: deve ser 0
  else if (esperado !== IN && got === IN) res.missed.push(rec);
  else if (got === esperado) res.correta.push(rec);
  else {
    const [ey, em, ed] = esperado.split('-'); const [gy, gm, gd] = got.split('-');
    (em === gm && ed === gd ? res.year_error : res.wrong).push(rec);
  }
}

// parsing precision/recall (só datas; indeterminada certa não conta como acerto de data nem erro)
const afirmadas = res.correta.length + res.year_error.length + res.wrong.length + res.overprecision.length;
const datasGold = res.correta.length + res.year_error.length + res.wrong.length + res.missed.length;
const precision = afirmadas ? res.correta.length / afirmadas : null;
const recall = datasGold ? res.correta.length / datasGold : null;

// confiabilidade (eixo separado) — todas as fontes do golden são TIER 2
const fontes = {};
for (const r of camp) fontes[r.fonte] = (fontes[r.fonte] || 0) + 1;

const out = {
  gerado_em: '2026-07-16', n_campanhas: camp.length,
  invariante_overprecision: { valor: res.overprecision.length, exigido: 0, ok: res.overprecision.length === 0 },
  parsing: {
    precision: round(precision), recall: round(recall),
    datas_afirmadas: afirmadas, datas_no_gold: datasGold,
    correta: res.correta.length, year_error: res.year_error.length, wrong: res.wrong.length,
    missed: res.missed.length, indeterminada_correta: res.correta_indet.length,
  },
  alvo: { overprecision: 0, precision: 0.90, recall: 0.85 },
  bate_portao: res.overprecision.length === 0 && precision >= 0.90 && recall >= 0.85,
  confiabilidade_a_parte: { tier1: 0, tier2: camp.length, nota: 'todas as fontes do golden sao TIER 2; 0% confirmado e estado correto do FSM, nao bug de parsing', fontes },
};
writeFileSync(join(DIR, 'VIGENCIA-METRICAS.json'), JSON.stringify({ ...out, detalhe: res }, null, 2));
console.log(JSON.stringify(out, null, 2));
if (res.overprecision.length) { console.log('\nOVERPRECISION (viola INV-16):'); for (const x of res.overprecision) console.log(`  ${x.id} got=${x.got} (${x.motivo})`); }
if (res.year_error.length) { console.log('\nyear_error:'); for (const x of res.year_error) console.log(`  ${x.id} esperado=${x.esperado} got=${x.got}`); }
if (res.wrong.length) { console.log('\nwrong:'); for (const x of res.wrong) console.log(`  ${x.id} esperado=${x.esperado} got=${x.got} (${x.motivo})`); }
if (res.missed.length) { console.log('\nmissed (deveria ler, disse indeterminada):'); for (const x of res.missed) console.log(`  ${x.id} esperado=${x.esperado} (${x.motivo})`); }

function round(x) { return x == null ? null : Math.round(x * 1000) / 1000; }
