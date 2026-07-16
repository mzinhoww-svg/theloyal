// Medição do TL Score engine sobre as 52 campanhas do golden (SPEC §6/§6.1).
//   node v2/golden/score-run.mjs
//
// LEITURA apenas, a partir dos arquivos do golden (sem escrita no banco).
//
// HONESTIDADE DE DADO (determinismo-primeiro, INV-12): o engine é puro sobre
// os VALORES dos componentes. Dois dos quatro componentes NÃO são deriváveis
// dos arquivos do golden:
//   • percentil  — exige o histórico da rota (distribuição de bônus por par),
//                  que só existe depois do re-score da base canonicalizada (D-007);
//   • eficiencia — exige CPM/VPM, que exige preço de emissão (fora deste ciclo).
// Fabricar esses valores violaria INV-03/INV-12. Então, dos arquivos, só é
// derivável de forma determinística:
//   • abrangencia — do público (geral > cartão > clube);
//   • raridade    — depende da frequência da rota na base REAL (não numa amostra
//                   de 52); marcada AUSENTE aqui para não inventar sinal.
// Consequência: rodando sobre os arquivos, TODO item cai em conta_nao_calculavel
// (sem percentil e sem CPM) — além de sem_tier1 (0/52 TIER 1, §4). Isso NÃO é o
// engine falhando: é a medição sendo honesta sobre a lacuna de dado que o
// re-score (D-007) preenche. A parte ACIONÁVEL desta medição é a FILA POR
// PROGRAMA (§6.1): onde o esforço de confirmação TIER 1 se concentra, cruzado
// com a cobertura dos adapters da Trilha B (Smiles/Livelo/Esfera/TAP).

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { calcularScore } from '../lib/score.mjs';

const DIR = dirname(fileURLToPath(import.meta.url));
const rot = JSON.parse(readFileSync(join(DIR, 'AMOSTRA-100-ROTULADA.json'), 'utf8'));
const pesos = JSON.parse(readFileSync(join(DIR, 'score-gold.json'), 'utf8')).pesos;
const campanhas = rot.filter((x) => x.classe === 'campanha');

// Trilha B: os 4 programas com adapter sitemap+fetch (D-009 / MATRIZ-COLETA).
const TRILHA_B = new Set(['smiles', 'livelo', 'esfera', 'tap']);
// Programas que hoje só se confirmam na mão (Azul D-010, LATAM D-011, cartões, etc.).
const SEM_ROTA = new Set(['sem_destino', 'null', null, 'multiplos_cartoes']);

// abrangência determinística do público (geral > cartão > clube). Único componente
// derivável dos arquivos sem fabricar sinal. Selecionados ~ geral restrito.
const ABRANGENCIA = { geral: 1.0, selecionados: 0.7, cartao: 0.6, clube: 0.3 };

function programasDe(g) {
  return [g.origem_programa, g.destino_programa].filter((p) => !SEM_ROTA.has(p));
}

const veredCount = {};
const overrideCount = {};
const filaPrograma = {};      // programa → nº de campanhas ancoradas
let reachable = 0;            // toca ao menos 1 programa da Trilha B
let manualOnly = 0;          // nenhuma rota na Trilha B
const manualProgramas = {};   // programa manual → contagem
const amostraBreakdown = [];

for (const c of campanhas) {
  const g = c.gabarito;
  const publico = g.publico || 'geral';
  const entradas = {
    campaign_id: c.id,
    tem_tier1: false, // 0/52 TIER 1 no golden (§4) — consequência dura da slice 3
    componentes: {
      // percentil AUSENTE (exige histórico da rota — re-score D-007)
      // eficiencia AUSENTE (exige CPM/VPM — preço de emissão, fora do ciclo)
      // raridade  AUSENTE (exige frequência na base real, não em 52 — não fabricar)
      abrangencia: { valor: ABRANGENCIA[publico] ?? 0.6, janela: 'publico' },
    },
  };
  const r = calcularScore(entradas, pesos);
  veredCount[r.veredito] = (veredCount[r.veredito] || 0) + 1;
  for (const o of r.overrides) overrideCount[o.override] = (overrideCount[o.override] || 0) + 1;

  const progs = programasDe(g);
  let hit = false;
  for (const p of progs) {
    filaPrograma[p] = (filaPrograma[p] || 0) + 1;
    if (TRILHA_B.has(p)) hit = true;
  }
  if (hit) reachable++;
  else {
    manualOnly++;
    for (const p of progs) manualProgramas[p] = (manualProgramas[p] || 0) + 1;
    if (progs.length === 0) manualProgramas['(rota indefinida)'] = (manualProgramas['(rota indefinida)'] || 0) + 1;
  }

  if (amostraBreakdown.length < 3) {
    amostraBreakdown.push({ campaign_id: c.id, tipo: g.tipo, publico, ...r });
  }
}

const ordena = (obj) => Object.fromEntries(Object.entries(obj).sort((a, b) => b[1] - a[1]));

const metricas = {
  _doc: 'Medição do TL Score engine sobre as 52 campanhas do golden. Ver cabeçalho de score-run.mjs sobre a lacuna de dado (percentil/eficiência) que o re-score (D-007) preenche.',
  versao_pesos: pesos.versao,
  total_campanhas: campanhas.length,
  tier1_no_golden: 0,
  // Estado HOJE (ligado sobre os arquivos): tudo Não confirmado, por 2 motivos.
  veredito_hoje: ordena(veredCount),
  overrides_disparados: ordena(overrideCount),
  elegiveis_hoje: veredCount['Vale agir'] || 0,
  // "quantos seriam elegíveis se confirmados TIER 1": indeterminado a partir dos
  // arquivos — mesmo com TIER 1, sem percentil/CPM o item fica conta_nao_calculavel.
  elegiveis_se_confirmado_tier1: {
    valor: 'indeterminado_dos_arquivos',
    motivo: 'sem percentil (histórico de rota) nem eficiência (CPM), conta_nao_calculavel persiste mesmo com TIER 1. '
      + 'O número por-item exige o re-score da base canonicalizada (D-007) + preço de emissão. Não fabricado (INV-03).',
  },
  // Parte ACIONÁVEL: a fila por programa (§6.1) — onde asfaltar primeiro.
  fila_por_programa: {
    adapter_reachable: reachable,   // toca Smiles/Livelo/Esfera/TAP → Deal Desk enche por adapter (Path B)
    manual_only: manualOnly,        // só confirmação manual (Azul/LATAM/cartões) → carga operacional inicial
    pct_reachable: Math.round((reachable / campanhas.length) * 1000) / 10,
    programas: ordena(filaPrograma),
    programas_manuais: ordena(manualProgramas),
    trilha_b: [...TRILHA_B],
  },
  amostra_breakdown: amostraBreakdown,
};

writeFileSync(join(DIR, 'SCORE-METRICAS.json'), JSON.stringify(metricas, null, 2) + '\n');

console.log(`\nTL Score engine — medição sobre ${campanhas.length} campanhas (vetor ${pesos.versao})\n`);
console.log('Veredito hoje (0/52 TIER 1):', JSON.stringify(metricas.veredito_hoje));
console.log('Overrides disparados:       ', JSON.stringify(metricas.overrides_disparados));
console.log(`\nFila por programa (§6.1):`);
console.log(`  adapter-reachable (Trilha B): ${reachable}/${campanhas.length} (${metricas.fila_por_programa.pct_reachable}%)`);
console.log(`  manual-only:                  ${manualOnly}/${campanhas.length}`);
console.log('  top programas:', JSON.stringify(ordena(filaPrograma)));
console.log('\nwrote v2/golden/SCORE-METRICAS.json');
