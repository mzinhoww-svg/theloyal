// Fidelity gate do re-score (D-038). PROVA que o engine IMPORTADO reproduz os 6
// exemplos-golden da PROPOSTA §2 (79/37/77/59/44/27) — SEM tocar o banco.
//
// Por que aqui e não end-to-end no banco: os componentes derivados de cada
// golden (percentil, eficiência, raridade, abrangência) estão CONGELADOS na
// PROPOSTA §2, medidos sobre um snapshot do banco de 2026-07-16/17. O banco vivo
// já cresceu (rotas ganharam/perderam linhas), então rodar a derivação hoje
// sobre a rota daria componentes levemente diferentes — drift de DADO, não do
// engine. Esta gate isola a fidelidade do ENGINE: alimenta os componentes
// documentados no `calcularScore` IMPORTADO e exige o bruto/veredito documentado.
// O drift ponta-a-ponta é medido à parte pelo runner (golden vivo) e reportado.
//
// A derivação em si é coberta pelos 21 testes verdes de derivacao.test.mjs.

import assert from 'node:assert/strict';
import { calcularScore } from '../../lib/score.mjs';

// score_pesos.v1 (lido do banco; espelhado aqui só para a gate ser hermética).
const PESOS_V1 = {
  versao: 'v1',
  peso_percentil: 0.45,
  peso_eficiencia: 0.30,
  peso_raridade: 0.15,
  peso_abrangencia: 0.10,
  shrink_k: 5,
  min_samples: 3,
};

// Os 6 golden da PROPOSTA §2, com os componentes EXATOS ali documentados.
// base_n reproduz o amortecimento de base curta do próprio engine.
const GOLDEN = [
  {
    caso: 'A', desc: 'livelo→azul transf · %115 · CPM 11,85 · t2',
    componentes: { percentil: { valor: 0.8125, base_n: 40 }, eficiencia: { valor: 0.95, base_n: 10 }, raridade: { valor: 0.25 }, abrangencia: { valor: 1.0 } },
    tem_tier1: false,
    esperado: { tl_score_bruto: 77, veredito: 'Não confirmado', override_aplicado: 'sem_tier1' },
  },
  {
    caso: 'B', desc: 'bancos→smiles transf · %70 · CPM 15,37 · t1',
    componentes: { percentil: { valor: 0.5, base_n: 1 }, eficiencia: { valor: 0.75, base_n: 10 }, raridade: { valor: 0.25 }, abrangencia: { valor: 1.0 } },
    tem_tier1: true,
    esperado: { tl_score_bruto: 59, veredito: 'Só para casos específicos', override_aplicado: null },
  },
  {
    caso: 'C', desc: 'itau→latampass transf · %40 · sem CPM · t2',
    componentes: { percentil: { valor: 0.96, base_n: 50 }, raridade: { valor: 0.25 }, abrangencia: { valor: 1.0 } },
    tem_tier1: false,
    esperado: { tl_score_bruto: 79, veredito: 'Não confirmado', override_aplicado: 'sem_tier1' },
  },
  {
    caso: 'D', desc: 'itau→latampass transf · %25 · sem CPM · t2',
    componentes: { percentil: { valor: 0.25, base_n: 50 }, raridade: { valor: 0.25 }, abrangencia: { valor: 1.0 } },
    tem_tier1: false,
    esperado: { tl_score_bruto: 37, veredito: 'Não confirmado', override_aplicado: 'sem_tier1' },
  },
  {
    caso: 'E', desc: 'livelo→connectmiles transf · %40 · CPM 60 · t2 (rota rara n=3)',
    componentes: { percentil: { valor: 0.5, base_n: 3 }, eficiencia: { valor: 0.05, base_n: 10 }, raridade: { valor: 0.65 }, abrangencia: { valor: 1.0 } },
    tem_tier1: false,
    esperado: { tl_score_bruto: 44, veredito: 'Não confirmado', override_aplicado: 'sem_tier1' },
  },
  {
    caso: 'F', desc: 'accor→accor clube · sem % · sem CPM · t2',
    componentes: { raridade: { valor: 0.25 }, abrangencia: { valor: 0.3 } },
    tem_tier1: false,
    esperado: { tl_score_bruto: 27, veredito: 'Não confirmado', override_aplicado: 'conta_nao_calculavel' },
  },
];

export function rodarGoldenReplay() {
  const linhas = [];
  let ok = 0;
  for (const g of GOLDEN) {
    const r = calcularScore({ campaign_id: g.caso, tem_tier1: g.tem_tier1, componentes: g.componentes }, PESOS_V1);
    const bateu =
      r.tl_score_bruto === g.esperado.tl_score_bruto &&
      r.veredito === g.esperado.veredito &&
      r.override_aplicado === g.esperado.override_aplicado;
    if (bateu) ok++;
    linhas.push({
      caso: g.caso, desc: g.desc,
      esperado_bruto: g.esperado.tl_score_bruto, obtido_bruto: r.tl_score_bruto,
      esperado_veredito: g.esperado.veredito, obtido_veredito: r.veredito,
      esperado_override: g.esperado.override_aplicado, obtido_override: r.override_aplicado,
      bateu,
    });
  }
  return { total: GOLDEN.length, ok, passou: ok === GOLDEN.length, linhas };
}

// Execução direta: imprime a tabela e falha com exit!=0 se algum golden divergir.
if (import.meta.url === `file://${process.argv[1]}`) {
  const res = rodarGoldenReplay();
  console.log('\n=== GOLDEN REPLAY (engine importado · score.mjs) ===');
  for (const l of res.linhas) {
    const flag = l.bateu ? 'OK ' : 'XX ';
    console.log(`${flag}${l.caso}  bruto ${l.obtido_bruto}/${l.esperado_bruto}  ${l.obtido_veredito}${l.obtido_override ? ` [${l.obtido_override}]` : ''}  — ${l.desc}`);
  }
  console.log(`\nfidelidade: ${res.ok}/${res.total} golden`);
  try {
    assert.equal(res.passou, true, 'GOLDEN REPLAY FALHOU — engine infiel, PARAR (D-038).');
    console.log('PASS — engine reproduz o golden. OK para o dry-run.\n');
  } catch (e) {
    console.error('\n' + e.message + '\n');
    process.exit(1);
  }
}
