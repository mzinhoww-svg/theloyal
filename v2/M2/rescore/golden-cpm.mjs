// Golden do CPM VIVO de transferência (RE-SCORE-2, D-032/D-035/D-039). Prova que
// o caminho NOVO — custo-base(origem) × ratio(par) → CPM → derivarEficiencia →
// calcularScore — é fiel e determinístico, e que o CONTRATO ratio-null⇒CPM-null
// (D-039) não afunda item legítimo (redistribui). BLOQUEANTE junto do golden 6/6.
//
// Diferença vs o golden 6/6 (golden-replay.mjs): lá o caso E recebe CPM 60 PRONTO
// (componente `eficiencia` congelado). AQUI o CPM PASSA por cpmDeCustoBase (custo
// livelo=30, bônus 40%, ratio 0,3333 → R$64,29) e por derivarEficiencia contra
// uma população fixa — exercita a reconstrução ponta-a-ponta, não um valor dado.
//
// Determinismo (INV-12): população de CPM e histórico de rota são FIXOS aqui, então
// o score é exato e auditável. Não lê banco. Não inventa dado (INV-03).

import assert from 'node:assert/strict';
import { cpmDeCustoBase } from '../../lib/cpm/custo-base.mjs';
import { montarEntradas, derivarEficiencia, DERIVACAO_V1 } from '../../lib/derivacao.mjs';
import { calcularScore } from '../../lib/score.mjs';

// score_pesos.v1 (espelho hermético; idêntico ao golden-replay).
const PESOS_V1 = {
  versao: 'v1',
  peso_percentil: 0.45, peso_eficiencia: 0.30, peso_raridade: 0.15, peso_abrangencia: 0.10,
  shrink_k: 5, min_samples: 3,
};

// Custo-base e ratios FIXOS do caso (espelham as linhas reais do banco).
const CUSTO_LIVELO = 30;        // custo_base_moeda.custo_milheiro (livelo)
const RATIO_3PARA1 = 0.3333;    // custo_base_ratio (livelo→connectmiles), 3:1

// População de CPM FIXA p/ tornar a eficiência exata (n=6, inclui o próprio 64,29).
const POP_CPM = [15, 30, 45, 60, 64.29, 90];
// Histórico de rota FIXO (só a própria campanha): percentil neutro base curta.
const HIST_ROTA = [40];

function montarEComPontuar({ cpmEfetivo, percentual, historicoRota, frequencia, publico, temTier1 }) {
  // A campanha entra no engine com cpm_value = CPM EFETIVO (o que o runner faz).
  const campanha = { id: 'golden-cpm', tipo: 'transferencia', percentual, cpm_value: cpmEfetivo, tier: temTier1 ? 1 : 2 };
  const contexto = { historicoRota, distribuicaoCpm: POP_CPM, rota: 'livelo|connectmiles', frequencia, publico };
  const entradas = montarEntradas(campanha, contexto, DERIVACAO_V1);
  const s = calcularScore(entradas, PESOS_V1);
  return { entradas, s };
}

export function rodarGoldenCpm() {
  const linhas = [];
  const push = (caso, desc, bateu, detalhe) => linhas.push({ caso, desc, bateu, detalhe });

  // ---------------------------------------------------------------------------
  // CPM-1 — RECONSTRUÍDO: custo-base × ratio → CPM → eficiência → score.
  // cpmDeCustoBase(30, 40, 0,3333) = 30 / ((1+0,4)·0,3333) = 30/0,466620 = 64,29.
  // ---------------------------------------------------------------------------
  const cpm1 = cpmDeCustoBase(CUSTO_LIVELO, 40, RATIO_3PARA1);
  const cpm1_ok = cpm1 === 64.29;

  const r1 = montarEComPontuar({
    cpmEfetivo: cpm1, percentual: 40, historicoRota: HIST_ROTA, frequencia: 1, publico: 'geral', temTier1: false,
  });
  // eficiência: ecdf(64,29 em [15,30,45,60,64,29,90]) = (4 + 0,5·1)/6 = 0,75 → efic = 0,25.
  const efic1 = r1.entradas.componentes.eficiencia;
  const efic1_ok = efic1 != null && efic1.valor === 0.25;
  // score: percentil amortecido 0,5·(1)+0,5·5)/6 = 0,5; efic 0,25; raridade 0,85 (n=1); abrang 1,0.
  //   0,45·0,5 + 0,30·0,25 + 0,15·0,85 + 0,10·1,0 = 0,5275 → 53. Esperaria (pré-override).
  const score1_ok = r1.s.tl_score_bruto === 53 && r1.s.veredito_bruto === 'Esperaria';
  const c1 = cpm1_ok && efic1_ok && score1_ok;
  push('CPM-1', 'RECONSTRUÍDO livelo→connectmiles %40 · custo 30 · ratio 0,3333 → CPM 64,29 → efic 0,25 → bruto 53',
    c1, `cpm=${cpm1} efic=${efic1 ? efic1.valor : null} bruto=${r1.s.tl_score_bruto}/${r1.s.veredito_bruto}`);

  // ---------------------------------------------------------------------------
  // CPM-2 — CONTRATO ratio-null ⇒ CPM null ⇒ NÃO afunda (redistribui, D-039).
  // O helper EXIGE ratio (sem default): sem ratio → null. O item segue por
  // percentil (redistribui os pesos), NÃO cai em conta_nao_calculavel.
  // ---------------------------------------------------------------------------
  const cpm2_undef = cpmDeCustoBase(CUSTO_LIVELO, 40, undefined); // sem ratio
  const cpm2_null = cpmDeCustoBase(CUSTO_LIVELO, 40, null);        // ratio NULL
  const contrato_ok = cpm2_undef === null && cpm2_null === null;

  const r2 = montarEComPontuar({
    cpmEfetivo: null, percentual: 40, historicoRota: HIST_ROTA, frequencia: 1, publico: 'geral', temTier1: false,
  });
  const efic2_ausente = r2.entradas.componentes.eficiencia === undefined;
  const nao_afundou = r2.s.override_aplicado !== 'conta_nao_calculavel';
  // score redistribuído (sem eficiência): pesos {0,45 perc, 0,15 rar, 0,10 abr} = 0,70.
  //   (0,45·0,5 + 0,15·0,85 + 0,10·1,0)/0,70 = 0,4525/0,70 = 0,646… → 65. Só para casos específicos.
  const score2_ok = r2.s.tl_score_bruto === 65 && r2.s.veredito_bruto === 'Só para casos específicos';
  const c2 = contrato_ok && efic2_ausente && nao_afundou && score2_ok;
  push('CPM-2', 'CONTRATO par sem ratio → CPM null → eficiência ausente → redistribui (bruto 65), não afunda',
    c2, `cpm(sem ratio)=${cpm2_undef}/${cpm2_null} efic_ausente=${efic2_ausente} override=${r2.s.override_aplicado} bruto=${r2.s.tl_score_bruto}/${r2.s.veredito_bruto}`);

  const ok = linhas.filter((l) => l.bateu).length;
  return { total: linhas.length, ok, passou: ok === linhas.length, linhas };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const res = rodarGoldenCpm();
  console.log('\n=== GOLDEN CPM VIVO (custo-base × ratio → CPM → eficiência → score) ===');
  for (const l of res.linhas) console.log(`${l.bateu ? 'OK ' : 'XX '}${l.caso}  ${l.detalhe}  — ${l.desc}`);
  console.log(`\nfidelidade CPM vivo: ${res.ok}/${res.total}`);
  try {
    assert.equal(res.passou, true, 'GOLDEN CPM VIVO FALHOU — caminho custo-base×ratio infiel, PARAR (D-032/D-039).');
    console.log('PASS — reconstrução de CPM fiel e contrato ratio-null respeitado.\n');
  } catch (e) {
    console.error('\n' + e.message + '\n');
    process.exit(1);
  }
}
