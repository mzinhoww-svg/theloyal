// Rotulador do golden em escala (frente CALIBRAÇÃO / D-051).
//   node v2/golden/escala/rotular.mjs
// Lê POOL-DRAW.json (o draw determinístico md5(estrato||id)) e aplica as regras de
// rótulo CONGELADAS (CRITERIO-ROTULACAO.md + R1/R2/R5 aprovados pelo operador) ao
// título+trecho, emitindo GOLDEN-400.json com proveniência.
//
// IMPORTANTE (não-circularidade): este rotulador NÃO importa gate.mjs/vigencia.mjs/
// identidade.mjs. Ele produz a VERDADE a partir do conteúdo; os motores são medidos
// CONTRA ela em remedir.mjs. Rótulo derivado do motor mediria o motor contra si mesmo.
// rotulador = "regra-auto-v1"; itens auditados à mão viram "agente-2 (auditado)" no JSON final.

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const DIR = dirname(fileURLToPath(import.meta.url));
const pool = JSON.parse(readFileSync(join(DIR, 'POOL-DRAW.json'), 'utf8'));

const strip = (s) => (s == null ? '' : String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase());

// alias de programa (extração bruta -> code canônico). Conservador; cobre a cabeça.
const PROG = {
  azul: 'azul_fidelidade', 'azul fidelidade': 'azul_fidelidade', azul_fidelidade: 'azul_fidelidade',
  latam: 'latam_pass', latampass: 'latam_pass', 'latam pass': 'latam_pass', latam_pass: 'latam_pass',
  smiles: 'smiles', livelo: 'livelo', esfera: 'esfera', itau: 'itau', 'itaú': 'itau',
  c6: 'c6', inter: 'inter', nubank: 'nubank', bradesco: 'bradesco', santander: 'santander',
  accor: 'accor', all: 'all_accor', 'all accor': 'all_accor', iberia: 'iberia', avios: 'avios',
  'mercado livre': 'mercado_livre', mercadolivre: 'mercado_livre', amazon: 'amazon', shell: 'shell',
  bb: 'banco_do_brasil', 'banco do brasil': 'banco_do_brasil', tap: 'tap_milesgo', 'best western': 'best_western',
  bestwestern: 'best_western', 'qatar': 'qatar_privilege', magalu: 'magalu', shopee: 'shopee', caixa: 'caixa',
};
const prog = (raw) => { const n = strip(raw); return PROG[n] || (n ? n.replace(/[^a-z0-9]+/g, '_') : null); };

// mês por extenso
const MES = { janeiro: 1, fevereiro: 2, marco: 3, março: 3, abril: 4, maio: 5, junho: 6, julho: 7, agosto: 8, setembro: 9, outubro: 10, novembro: 11, dezembro: 12 };

function inferAno(dia, mes, pub) {
  if (!pub) return null;
  const [py, pm] = pub.split('-').map(Number);
  // trava de virada (D-021): alvo antes do mês de publicação -> ano seguinte
  let y = py;
  if (mes < pm || (mes === pm && dia < Number(pub.split('-')[2]))) y = py + 1;
  return y;
}

function parseVig(t, pub) {
  // dd/mm[/yy] explícito
  let m = t.match(/at[eé]\s+(?:as?\s+\d{1,2}h\d{0,2}\s+d[eo]{1,2}\s+)?(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?/);
  if (m) {
    const d = +m[1], mo = +m[2];
    let y = m[3] ? (+m[3] < 100 ? 2000 + +m[3] : +m[3]) : inferAno(d, mo, pub);
    if (y && d >= 1 && d <= 31 && mo >= 1 && mo <= 12) return `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  }
  // "válida até DD de MÊS"
  m = t.match(/at[eé]\s+(\d{1,2})\s+de\s+([a-zç]+)/);
  if (m && MES[m[2]]) {
    const d = +m[1], mo = MES[m[2]];
    const y = inferAno(d, mo, pub);
    if (y) return `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  }
  // último dia / só hoje -> publicado_em (proxy)
  if (/ultimo dia|so hoje|hoje e o ultimo|termina hoje|encerra hoje/.test(t) && pub) return pub;
  return 'indeterminada';                          // D-021: não fabricar
}

// R1: percentual de headline com "até" = teto de escala -> geral null.
// Varre TODAS as mencoes "N%": prefixo "até" => teto; sufixo "de bonus" sem "até" => base geral.
function parsePct(t) {
  const re = /(at[eé]\s+)?(\d{1,3})\s?%(\s+de\s+b[oô]nus|\s+extra|\s+adicional)?/g;
  let m, ate = null, base = null;
  while ((m = re.exec(t))) {
    const n = +m[2];
    if (m[1]) { if (ate == null || n > ate) ate = n; }          // "até N%" -> teto de escala
    else if (m[3] && /bonus|bônus/.test(m[3])) { if (base == null) base = n; } // "N% de bônus" (geral explicito)
  }
  if (base != null) return { pct: base, teto: ate, divergente: ate != null, nota: ate != null ? 'base geral explicita + teto de escala (R1)' : 'percentual base explicito' };
  if (ate != null) return { pct: null, teto: ate, divergente: true, nota: 'teto "ate X%" -> geral null (R1)' };
  return { pct: null, teto: null, divergente: false, nota: null };
}

const TEM_PONTO = /(ponto|milha|milheiro|cashback)/;
const TRANSFERIVEL = /(transfer|vira (ponto|milha)|resgat[aá]v|sac[aá]v|converte em (ponto|milha))/;

function rotular(it) {
  const t = strip(`${it.title} ${it.snippet || ''}`);
  const temPonto = TEM_PONTO.test(t);
  const estrato = it.estrato;

  // ---------- NEGATIVOS (verdade vence o pool) ----------
  // produto_blog/editorial pre-vetado
  if (estrato === 'negativo.produto_blog') {
    const motivo = /(resgat|a partir de[^.]*(mil )?(pontos|milhas)[^.]*(trecho|taxas|executiva)|alerta pp)/.test(t) && !/transfira|bonus na|bônus na/.test(t)
      ? 'resgate' : 'produto_blog';
    return neg(motivo, it, 'noticia editorial / exemplo de tarifa-resgate, sem oferta de acumulo ao membro');
  }
  // cupom forte
  if (/(\bcupom\b|\bcupons\b|\soff\b)/.test(t) && !/(transfer|compre pontos|compra de pontos)/.test(t)) return neg('cupom', it, 'palavra cupom/OFF = varejo (D-018 ruling 1)');
  // desconto de produto físico
  if (/\d{1,3}\s?%\s+(de\s+)?desconto/.test(t) && /(airpods|iphone|notebook|\btv\b|geladeira|celular|eletro|smartphone|kindle|echo|alexa|fone|playstation|xbox)/.test(t)) return neg('produto_blog', it, 'desconto em produto fisico, sem mecanica de ponto');
  // resgate
  if (/resgat/.test(t) && /desconto/.test(t) && !/(bonus|bônus)\s+n[ao]\s+(transfer|compra)|transfira/.test(t)) return neg('resgate', it, 'desconto no resgate (queima), nao bonus de acumulo');
  // conta/câmbio (Nomad, Wise, conta global) SEM ponto/milha = perk de produto financeiro (D-018)
  if (/(abra conta|conta global|conta internacional|conta digital|conta americana)/.test(t) && !/(ponto|milha|milheiro)/.test(t)) {
    return neg('perk', it, 'oferta de conta/cambio sem ponto/milha transferivel (D-018)');
  }
  // stunt / PR
  if (/(recorde|maior .* do mundo|primeir[oa] beb[eê]|patrocin|inaugura|constru[ií]|doad[oa]s pelo|balanco social)/.test(t) && !temPonto) return neg('stunt', it, 'marketing/PR/ops sem oferta ao membro');
  // explainer/how-to SEM oferta acionável -> editorial (falso-positivo do extrator).
  const titulo0 = strip(it.title);
  const temOferta = /(ganhe|receba|aproveite|assine|transfira|transfir|compre|comprar|pe[çc]a|acumule|pontue|envie|at[eé]\s+\d|de b[oô]nus|ganhar)/.test(t);
  if ((/^(como |saiba como|conhe[çc]a|o que [eé]|entenda|guia |vale a pena|dicas |tudo sobre|passo a passo)/.test(titulo0) || /\?\s*$/.test(strip(it.title))) && !temOferta) {
    return neg('produto_blog', it, 'artigo explicativo/how-to/anuncio estrutural, sem oferta acionavel ao membro');
  }

  // ---------- TIPAGEM por conteúdo (NÃO pelo tipo bruto — R3). null = sem assinatura positiva. ----------
  const TRANSF_SIG = /transfer|envio de pontos[^.]*\bpara\b|envie pontos[^.]*\bpara\b|convert[ae]r? pontos[^.]*\bpara\b/;
  let tipo = null;
  if (/status match/.test(t)) tipo = 'status_match';
  else if (/pontos\s?\+\s?dinheiro|pontos mais dinheiro|milhas\s?\+\s?dinheiro|\+\s?dinheiro/.test(t)) tipo = 'pontos_mais_dinheiro';
  else if (/shopping\s+(livelo|esfera|itau|c6|latam|smiles|santander|azul)|clique (e|para) (ganhe|pontue|comprar)|pontos por real|pts\/real|pontos\/real/.test(t)) tipo = 'shopping';
  else if (/(ampliam? parceria|firma[m]? (parceria|acordo)|nova parceria)/.test(t) && !/\d+\s?%/.test(t) && !/(bonus|bônus)/.test(t)) tipo = 'outro';
  else if (TRANSF_SIG.test(t) && /(bonus|bônus|at[eé]\s+\d)/.test(t)) tipo = 'transferencia_bonificada';
  else if (/(muda(m)?\s+(as\s+)?regras|altera(m)?\s+(as\s+)?regras|reduz.*(pontua|milha)|desvaloriz|reforma.*programa)/.test(t)) tipo = 'outro';
  else if ((/pontos de boas|boas-vindas|de boas vindas|mil pontos b|milhas b[oô]nus/.test(t) && /(cartao|cartão)/.test(t)) || (/(cartao|cartão)/.test(t) && /(mil pontos|mil milhas)/.test(t))) tipo = 'promocao_emissao';
  else if (/(acumulo|acúmulo|pontue|pontos em dobro|em dobro|multiplique)/.test(t) && temPonto) tipo = 'bonus_acumulo';
  else if (/clube/.test(t) && /(assine|pontos|milhas|mensais)/.test(t)) tipo = 'clube';
  else if (/compre pontos|compra de pontos|comprar pontos|comprar milhas/.test(t) || (/milheiro/.test(t) && /(bonus|bônus)/.test(t))) tipo = 'compra_pontos';
  else if (/parceria|prorroga|meta de gasto|bateu.*ganhou/.test(t)) tipo = 'outro';
  else if (!estrato.startsWith('negativo.')) tipo = estrato.split('.')[0]; // fallback SÓ p/ pool positivo

  // ---------- VETO de perk/cashback + default de negativo (verdade de conteúdo vence o pool) ----------
  // perk vence só quando NÃO há mecânica real de ponto/milha (protege promocao_emissao/clube reais, D-016).
  const bemVindo = /(mil pontos|mil milhas|pontos de boas|milhas de boas|boas.?vindas|pontos b[oô]nus|milhas b[oô]nus|transfer|compre pontos|compra de pontos)/.test(t);
  const perkHit = /(anuidade gratis|anuidade gratuita|sem anuidade|isencao de anuidade|sala vip|salas vip|disney\+|deezer|uber one|clube ifood|ifood gratis|globoplay|streaming gratis)/.test(t);
  const cashFechado = /cashback/.test(t) && !TRANSFERIVEL.test(t) && !/(ponto|milha)/.test(t);
  if ((perkHit || cashFechado) && !bemVindo && !temPonto) return neg('perk', it, cashFechado ? 'cashback preso no cartao (R2)' : 'vantagem de ter o cartao sem ponto/milha (D-018)');
  if (tipo == null) {                               // sem assinatura positiva -> negativo pelo pool
    const mp = { 'negativo.cupom': 'cupom', 'negativo.resgate': 'resgate', 'negativo.perk': 'perk', 'negativo.stunt': 'stunt', 'negativo.produto_blog': 'produto_blog' };
    return neg(mp[estrato] || 'produto_blog', it, 'sem assinatura de campanha no conteudo (default do estrato)');
  }

  const pctInfo = parsePct(t);
  const isTransfer = tipo === 'transferencia_bonificada';
  const isShopping = tipo === 'shopping';
  // publico
  let publico = 'geral';
  if (/\bclube\b/.test(t) && tipo === 'clube') publico = 'clube';
  else if (/selecionad|convidad|segmentad/.test(t)) publico = 'selecionados';
  else if (tipo === 'promocao_emissao') publico = 'cartao';
  // origem/destino
  let origem = prog(it.xo) || null, destino = prog(it.xd) || null;
  const ladoUnicoTipos = new Set(['compra_pontos', 'clube', 'promocao_emissao', 'shopping', 'status_match', 'bonus_acumulo', 'pontos_mais_dinheiro', 'outro']);
  let lado_unico = isTransfer ? false : true;
  if (isTransfer) { if (!destino && /azul/.test(t)) destino = 'azul_fidelidade'; if (!destino && /smiles/.test(t)) destino = 'smiles'; if (!destino && /latam/.test(t)) destino = 'latam_pass'; }
  if (ladoUnicoTipos.has(tipo) && !destino) destino = 'sem_destino';
  if (destino && destino !== 'sem_destino' && origem && destino !== origem) lado_unico = false;

  // percentual final com R1 (shopping "até X pontos por real" também vira geral null)
  let percentual = pctInfo.pct;
  let tetoNota = pctInfo.teto ? `teto do blog: ${pctInfo.teto}${isShopping ? ' (catalogo)' : '%'}` : null;
  if (isShopping && /at[eé]\s+\d/.test(t)) { percentual = null; tetoNota = tetoNota || 'ate X pts/real = teto de catalogo (R1-ext) -> geral indeterminada'; }
  const divergente = (isTransfer || isShopping) && (pctInfo.divergente || /at[eé]\s+\d/.test(t));

  const vig = parseVig(t, it.published_at);

  return {
    id: it.id, estrato, seed: `md5('${estrato}'||id)`, drawn_at: '2026-07-17',
    fonte: it.source, url: null, publicado_em: it.published_at,
    input: { titulo: it.title, trecho: it.snippet || '' },
    extracao_snapshot: { tipo: it.xt, origem: it.xo, destino: it.xd, percentual: it.xp },
    classe: 'campanha',
    gabarito: { tipo, origem_programa: origem, destino_programa: destino, publico, percentual, vigencia_fim: vig, lado_unico },
    proveniencia: {
      origem_programa: origem ? `origem "${it.xo || origem}" no titulo/extracao` : 'origem nao nomeada',
      percentual: pctInfo.nota || (percentual != null ? 'percentual explicito' : 'sem % de bonus'),
      vigencia_fim: vig === 'indeterminada' ? 'sem data completa no texto -> indeterminada (D-021)' : 'data lida do titulo',
    },
    motivo_nao_campanha: null,
    divergencia: { candidato: !!divergente, nota: divergente ? (tetoNota || pctInfo.nota) : null },
    sintetico: false,
    rotulador: 'regra-auto-v1', rotulado_em: '2026-07-17',
  };
}

function neg(motivo, it, nota) {
  return {
    id: it.id, estrato: it.estrato, seed: `md5('${it.estrato}'||id)`, drawn_at: '2026-07-17',
    fonte: it.source, url: null, publicado_em: it.published_at,
    input: { titulo: it.title, trecho: it.snippet || '' },
    extracao_snapshot: { tipo: it.xt, origem: it.xo, destino: it.xd, percentual: it.xp },
    classe: 'nao_campanha', gabarito: null,
    proveniencia: { origem_programa: 'n/a', percentual: 'n/a', vigencia_fim: 'n/a' },
    motivo_nao_campanha: motivo, divergencia: { candidato: false, nota },
    sintetico: false, rotulador: 'regra-auto-v1', rotulado_em: '2026-07-17',
  };
}

// 45 itens lidos no CONTEUDO completo (auditoria que calibrou as regras deste rotulador).
// Marcados como auditados para honestidade de proveniencia (o resto e regra-auto-v1).
const AUDITADOS = new Set(['2be57fd13608073398860d11d4c0ab70c7c9bc965a029fb938798f3f281fe4e4','564f725b62ffda066cb7d1fd554541148ce641e9bb04082e21584b3539d62fa4','84a366faeccf7d7d0ecbdd50a119752bbb4bd0abd6e1e7b9f32494b11e9a9ab3','aafd63ac0a24f1d84b5a56831a765408751dec98da2b0a60984a46a4ae3ba5e9','e48d17d62ea11c7a70245bb9fffe5bfcb6f2a88ad28f14c82440d9e45540e537','eb03927a2fe0b6b2b993fc41de60f43f2c873e0ec75185dc854d6fb001cfb461','6e799e1b722894fc19f70d8f765d58ebc05a407faf5263fad0204f45d2409029','3f99502338b0431f1feca555d1a90b261ea222bbfbeac0d238a6fb5a5dccf72a','a86df0ac2bd015b32087205ec4564e0a0c9d2b03974242e5d36c327287712681','a2021ab3a966a00e2739dc9c8fd610f47819c9ddc84836dccaa4a264d8bb867c','e6dc2e854ae4d259db7d64c952233d8ea0ba48d778ac8821f2f2578f33ef6d91','4cd6fc7ceadbea67d57858ba95bafd924971e681dd4e2ceb750964e467fc3213','0f367b1eb20ffda9019695b87dc61c1851e2a1637a9455c963f76153250146a9','674c396bc3b87665e6e8d99f2bd1db24ba73fba69a58aae07f90afa4a1687237','b589d7d754a0724bec8b41485497dd181b95321f8d1019083c8adb81f5a98b53','81b062c8185d79c07dc75aa1850968ce4719e5c63c3780146c2882db5410871c','1dfb3d84408b0e5cd3d45ffbc5c6d2de12e201ffcd6e45a14c4770ee4d75a37c','884f6f26ffbdfb5b99d718bb6f4f94e4a12c6a97f07b8924181426dfbc0e860c','da444cf43e75d0911c776fbae281caff40f19b74bf43d2b9886da3c5e66664d0','8964134149e30866dfa1cbdf6e7023e12928fa4e0790c6c2d2aa54a0cb8d1ca2','379101b55aa2b97b378f1a6829ce7fd8549a271be77caeb3fe67593f1ab63950','48d856c8a1dfefcd6ad4c4274550c14941f81f98c7fe5ed463be80b8b922064a','a42b6a2430132620c48f7167e55402eb97531d3ceceacf691cf2defe731db9a7','db494f106acfa2e07761d7c77e17d659be43adec9e4dfbe4a0fd4c15ca447b88','3df87c1585a15a0b09a854a857106208ba24851fd1fe9292e92cba5da552a8ec','5969efe45c837c8640cebd98e6ca97827ae38cfddf6dfe7ce90fbe69b89ee8fb','d89824345d276289101bc734e6e3ee138823b05d0e4f7db586dad949330a2e87','2078b9582729e7f0a29806421d81cbec8f04f33829e1432739e4b183edfb59e4','3d1ce81dfbba8537a450408f16f120d627ec4d9e18ffda93e58f6d5cb42c8994','ca02d0f9b99f6298a2c6061d8628cacecb1e275b83e96b1cef6db3bb9e1db0a2','04ab8fcd5af3ce371a6c95588c6b97bf4c68069cf4c655a44a287f91286308c2','2da5b55d8970dece9f67de1c8296729a90b82d2ad6429fa9661837c9a7840ca0','45c7c0a68f15a9b00cc7fdc984083d813f80a4ae029449d697e446c8f1aa0e95','671cda3e34c8db6383ac09106fa0a7a1c3af3c6e88433e01efa0df9cdba2013d','8a113102aba065cdda96cbe4004d7a1b59d45757aa51f1b855ddcecb88af174b','4486575818e8393d07b2808e7c75ca56f1fd6f8a38bc2c25e875a1b8fe9aaac1','c01104f5931c47fd3dd28fb14f13e6a98c8254c92a4cce2ca7dc098e7e736d6c','75afd795c5f16b9c1686f32960032bf149da6798879bd9093d7c06f28aa7a176','076c939f7dd977e3eb7467877e19f041efe5a6783083aae0c9cf677209e15720','62f2d0ea7aec8e9cc3d35b06352e6b3129cdbe1b4c0514ddd020bccb3ae4600c','175e73af2c6ec9c696282701d99320b30223ea8cee6c52b54037a2b416536288','d659a14d9a576b0655496969976574b8cfde5e5392fab0e7e40942557f9eeb5a','de80340d3b149e02e594a0c1be5974d0e7b90a2b9138332024f940ec2fc629cf','241628e003b24936195aaad719062a662ffe0377b8551244226ebd4e9d474e3e','2606e4dc449c6d73b3df4dbaf6844bf978bd070420a1e7283b83045643632553']);
const itens = pool.map(rotular).map((x) => (AUDITADOS.has(x.id) ? { ...x, rotulador: 'agente-2 (auditado)' } : x));
const out = {
  _meta: {
    descricao: 'Golden em escala (frente CALIBRACAO, D-051). Draw deterministico md5(estrato||id) + rotulo por regra congelada (CRITERIO + R1/R2/R5). rotulador=regra-auto-v1; subconjunto auditado a mao. Numero NAO publico ate revisao do operador.',
    corpus: 'qjqnqcsdnpvvmyzkavoq', drawn_at: '2026-07-17', n: itens.length,
    alvo_N: 400, nota_N: 'draw efetivo 379 apos dedup por id e content_hash',
  },
  itens,
};
writeFileSync(join(DIR, 'GOLDEN-400.json'), JSON.stringify(out, null, 1));

// resumo
const camp = itens.filter((x) => x.classe === 'campanha');
const neg_ = itens.filter((x) => x.classe === 'nao_campanha');
const byTipo = {}; for (const x of camp) byTipo[x.gabarito.tipo] = (byTipo[x.gabarito.tipo] || 0) + 1;
const byMot = {}; for (const x of neg_) byMot[x.motivo_nao_campanha] = (byMot[x.motivo_nao_campanha] || 0) + 1;
console.log('n', itens.length, '| campanha', camp.length, '| nao_campanha', neg_.length);
console.log('tipos:', JSON.stringify(byTipo));
console.log('motivos neg:', JSON.stringify(byMot));
console.log('divergencia candidatos:', camp.filter((x) => x.divergencia.candidato).length);
console.log('percentual null em transfer:', camp.filter((x) => x.gabarito.tipo === 'transferencia_bonificada' && x.gabarito.percentual == null).length, '/', camp.filter((x) => x.gabarito.tipo === 'transferencia_bonificada').length);
console.log('vigencia indeterminada:', camp.filter((x) => x.gabarito.vigencia_fim === 'indeterminada').length, '/', camp.length);
