// TL Score engine (M2 slice 4). PURO, sem I/O. Determinismo-primeiro (INV-12):
// mesmo input + mesmo vetor de pesos → mesmo score, sempre. LLM nunca calcula.
//
// A função NÃO conhece os pesos: eles vêm do argumento `pesos` (linha de
// score_pesos). Recalibrar = nova versão da tabela + novo golden, sem deploy.
//
// Régua (faixa → veredito):
//   85–100 Vale agir · 70–84 Vale olhar · 55–69 Só para casos específicos ·
//   40–54 Esperaria · 0–39 Evitaria.
//
// 4 componentes, cada valor ∈ [0,1]:
//   percentil   — bônus/valor vs histórico da própria rota (dominante; amortecido por base curta)
//   eficiencia  — CPM/VPM/spread (a conta; ausente → redistribui, nunca zero que afunda)
//   raridade    — frequência da rota/tipo (modula)
//   abrangencia — público (geral > cartão > clube; ajuste fino)
//
// Vigência NÃO é componente (saiu do score — urgência, D-022).
// regra/fricção/estoque NÃO pontuam (órfãos editoriais, §2.3) — o LLM narra, não some.
//
// 2 overrides → "Não confirmado" (INV-07), aplicados DEPOIS do cálculo, sempre logados:
//   sem_tier1            — campanha_fontes sem tier=1 (INV-02)
//   conta_nao_calculavel — sem sinal de valor nenhum (sem %, sem percentil, sem CPM)
// Preserva tl_score_bruto/veredito_bruto; grava override_aplicado (§3).

export const NAO_CONFIRMADO = 'Não confirmado';

// Ordem canônica dos componentes e a chave do peso correspondente em `pesos`.
const COMPONENTES = [
  { nome: 'percentil', peso: 'peso_percentil' },
  { nome: 'eficiencia', peso: 'peso_eficiencia' },
  { nome: 'raridade', peso: 'peso_raridade' },
  { nome: 'abrangencia', peso: 'peso_abrangencia' },
];

// Régua: faixa de score (0–100) → veredito. Puro, versionado junto com o engine.
export function vereditoDaFaixa(score) {
  if (score >= 85) return 'Vale agir';
  if (score >= 70) return 'Vale olhar';
  if (score >= 55) return 'Só para casos específicos';
  if (score >= 40) return 'Esperaria';
  return 'Evitaria';
}

// Amortecimento de base curta (SPEC §2): base pequena puxa o percentil para 0,5
// (neutro). NUNCA vira percentil cheio sem amostra. Aplica-se só ao percentil.
//   percentil_efetivo = (percentil_bruto·base_n + 0,5·shrink_k) / (base_n + shrink_k)
export function amortecerPercentil(percentilBruto, baseN, shrinkK) {
  const n = Number.isFinite(baseN) ? baseN : 0;
  return (percentilBruto * n + 0.5 * shrinkK) / (n + shrinkK);
}

// Um componente está PRESENTE quando entradas.componentes[nome] existe e tem
// valor numérico finito. Ausente (undefined/null/NaN) → redistribui (§2.1).
function componentePresente(c) {
  return c != null && Number.isFinite(c.valor);
}

/**
 * @param {object} entradas
 *   entradas.campaign_id   {string}
 *   entradas.tem_tier1     {boolean}   campanha_fontes tem tier=1? (override sem_tier1)
 *   entradas.componentes   {{
 *       percentil?:   {valor:number, base_n?:number, janela?:string},  // valor = percentil BRUTO
 *       eficiencia?:  {valor:number, base_n?:number, janela?:string},
 *       raridade?:    {valor:number, base_n?:number, janela?:string},
 *       abrangencia?: {valor:number, base_n?:number, janela?:string}
 *   }}
 * @param {object} pesos  linha de score_pesos: {versao, peso_percentil, peso_eficiencia,
 *   peso_raridade, peso_abrangencia, shrink_k, min_samples}
 * @returns {{
 *   campaign_id, versao_pesos, tl_score_bruto, veredito_bruto, veredito,
 *   override_aplicado, base_curta,
 *   overrides: Array<{override, de_veredito, para_veredito, evidencia}>,
 *   breakdown: Array<{componente, valor, valor_bruto, peso, peso_efetivo,
 *                     contribuicao, base_n, janela, base_curta}>
 * }}
 */
export function calcularScore(entradas, pesos) {
  if (!pesos || typeof pesos !== 'object') throw new Error('calcularScore: pesos obrigatório (vetor versionado)');
  const shrinkK = Number.isFinite(pesos.shrink_k) ? pesos.shrink_k : 5;
  const minSamples = Number.isFinite(pesos.min_samples) ? pesos.min_samples : 3;
  const comps = entradas.componentes || {};

  // 1) Componentes presentes, com percentil amortecido por base curta.
  const presentes = [];
  let baseCurtaGlobal = false;
  for (const { nome, peso } of COMPONENTES) {
    const c = comps[nome];
    if (!componentePresente(c)) continue;
    const pesoNominal = Number(pesos[peso]);
    const baseN = Number.isFinite(c.base_n) ? c.base_n : null;

    let valorUsado = c.valor;
    let valorBruto = c.valor;
    let baseCurta = false;
    if (nome === 'percentil') {
      valorUsado = amortecerPercentil(c.valor, baseN ?? 0, shrinkK);
      baseCurta = baseN != null && baseN < minSamples;
      if (baseCurta) baseCurtaGlobal = true;
    }
    presentes.push({
      nome,
      valorUsado,
      valorBruto,
      pesoNominal,
      baseN,
      janela: c.janela ?? null,
      baseCurta,
    });
  }

  // 2) Redistribuição (§2.1): score = Σ_presentes pesoᵢ·valorᵢ / Σ_presentes pesoᵢ.
  //    Componente ausente NÃO vira zero que afunda — some da conta inteira.
  const somaPesos = presentes.reduce((s, p) => s + p.pesoNominal, 0);
  let scoreFrac = 0;
  const breakdown = [];
  for (const p of presentes) {
    const pesoEfetivo = somaPesos > 0 ? p.pesoNominal / somaPesos : 0;
    const contribuicao = pesoEfetivo * p.valorUsado;
    scoreFrac += contribuicao;
    breakdown.push({
      componente: p.nome,
      valor: round4(p.valorUsado),        // valor USADO (percentil já amortecido)
      valor_bruto: round4(p.valorBruto),  // valor original antes do amortecimento
      peso: round4(p.pesoNominal),        // peso NOMINAL do vetor
      peso_efetivo: round4(pesoEfetivo),  // peso após redistribuição
      contribuicao: round4(contribuicao), // Σ = tl_score_bruto/100
      base_n: p.baseN,
      janela: p.janela,
      base_curta: p.baseCurta,
    });
  }

  const tlScoreBruto = presentes.length === 0 ? 0 : Math.round(scoreFrac * 100);
  const vereditoBruto = vereditoDaFaixa(tlScoreBruto);

  // 3) Overrides → "Não confirmado", DEPOIS do cálculo, todos logados (§3).
  //    Prioridade em override_aplicado: conta_nao_calculavel > sem_tier1
  //    (a conta vazia é desqualificação mais fundamental que a falta de fonte —
  //     um item sem valor computável não deve entrar na fila de "confirmar", §4).
  const overrides = [];

  // conta_nao_calculavel: sem sinal de valor NENHUM (sem percentil E sem eficiência).
  // raridade/abrangência sozinhas descrevem a rota, não dão veredito de valor (INV-07).
  const temPercentil = componentePresente(comps.percentil);
  const temEficiencia = componentePresente(comps.eficiencia);
  if (!temPercentil && !temEficiencia) {
    overrides.push(ovr('conta_nao_calculavel', vereditoBruto,
      'sem percentil e sem eficiência (CPM/VPM/spread) — nenhum sinal de valor computável'));
  }

  // sem_tier1: Deal Desk exige TIER 1 (INV-02). Sempre computa o bruto (a Ferrari),
  // mas rebaixa até a fonte oficial confirmar (a estrada, §4).
  if (entradas.tem_tier1 !== true) {
    overrides.push(ovr('sem_tier1', vereditoBruto,
      'campanha_fontes sem tier=1 — Deal Desk exige fonte TIER 1 (INV-02)'));
  }

  const PRIORIDADE = ['conta_nao_calculavel', 'sem_tier1'];
  const overrideAplicado = overrides.length === 0
    ? null
    : [...overrides].sort((a, b) => PRIORIDADE.indexOf(a.override) - PRIORIDADE.indexOf(b.override))[0].override;
  const veredito = overrides.length === 0 ? vereditoBruto : NAO_CONFIRMADO;

  return {
    campaign_id: entradas.campaign_id ?? null,
    versao_pesos: pesos.versao ?? null,
    tl_score_bruto: tlScoreBruto,
    veredito_bruto: vereditoBruto,
    veredito,
    override_aplicado: overrideAplicado,
    base_curta: baseCurtaGlobal,
    overrides,
    breakdown,
  };
}

function ovr(override, deVeredito, evidencia) {
  return { override, de_veredito: deVeredito, para_veredito: NAO_CONFIRMADO, evidencia };
}

// Arredonda para 4 casas — estabiliza golden sem perder rastreabilidade (INV-03).
function round4(x) {
  return Math.round(x * 1e4) / 1e4;
}
