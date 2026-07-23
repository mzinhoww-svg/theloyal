// fontes.mjs — atribuição de fonte determinística: o rótulo de uma fonte é
// derivado do HOST da URL, nunca de um `source_name` armazenado (que pode vir
// errado do coletor — ex.: "tavily", a ferramenta de busca, no lugar do outlet).
//
// Duas perguntas que o render faz:
//   1. Como CHAMAR a fonte?  → rotuloFonte(url): nome canônico do host.
//   2. É a página OFICIAL do PROGRAMA?  → ehFonteOficial(url): só então o render
//      pode escrever "fonte oficial". Domínio desconhecido = NÃO oficial (nunca
//      superestima; o pior caso vira "segundo <host>", jamais "oficial" falso).
//
// Guarda de teste: rotuloBateHost(label, url) — barra rótulo que não casa o host.

export function hostDe(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '').toLowerCase();
  } catch {
    return null;
  }
}

// host canônico → { nome legível, oficial: é domínio de PROGRAMA }.
// Outlets/agregadores (idinheiro, melhoresdestinos, …) NUNCA são oficiais: são
// mídia terceira. Oficiais são os domínios dos próprios programas/emissores.
const FONTES = Object.freeze({
  // --- outlets / agregadores / mídia (oficial: false) ---
  'idinheiro.com.br': { nome: 'iDinheiro', oficial: false },
  'melhoresdestinos.com.br': { nome: 'Melhores Destinos', oficial: false },
  'melhorescartoes.com.br': { nome: 'Melhores Cartões', oficial: false },
  'passageirodeprimeira.com': { nome: 'Passageiro de Primeira', oficial: false },
  'mestredasmilhas.com': { nome: 'Mestre das Milhas', oficial: false },
  'pontospravoar.com': { nome: 'Pontos pra Voar', oficial: false },
  'brasilturis.com.br': { nome: 'Brasilturis', oficial: false },
  'panrotas.com.br': { nome: 'PANROTAS', oficial: false },

  // --- programas / emissores (oficial: true) ---
  'smiles.com.br': { nome: 'Smiles', oficial: true },
  'latampass.latam.com': { nome: 'LATAM Pass', oficial: true },
  'latam.com': { nome: 'LATAM', oficial: true },
  'esfera.com.br': { nome: 'Esfera', oficial: true },
  'pontosesfera.com.br': { nome: 'Esfera', oficial: true },
  'livelo.com.br': { nome: 'Livelo', oficial: true },
  'tudoazul.com': { nome: 'TudoAzul', oficial: true },
  'voeazul.com.br': { nome: 'Azul', oficial: true },
  'all.accor.com': { nome: 'ALL Accor', oficial: true },
  'accor.com': { nome: 'ALL Accor', oficial: true },
  'iberia.com': { nome: 'Iberia Plus', oficial: true },
  'bb.com.br': { nome: 'Banco do Brasil', oficial: true },
  'itau.com.br': { nome: 'Itaú', oficial: true },
  'credicard.com.br': { nome: 'Credicard', oficial: true },
  'santander.com.br': { nome: 'Santander', oficial: true },
});

// Casa o host exato OU um subdomínio (`sub.dominio.com`). Retorna a entrada do mapa
// ou null.
function entrada(host) {
  if (!host) return null;
  if (FONTES[host]) return FONTES[host];
  for (const [dom, meta] of Object.entries(FONTES)) {
    if (host === dom || host.endsWith('.' + dom)) return meta;
  }
  return null;
}

// Nome canônico da fonte a partir da URL. Domínio conhecido → nome do mapa;
// desconhecido → o próprio host (sempre "casa" o host por construção, nunca
// inventa outlet). Sem URL válida → 'fonte'.
export function rotuloFonte(url) {
  const host = hostDe(url);
  if (!host) return 'fonte';
  const meta = entrada(host);
  return meta ? meta.nome : host;
}

// A URL é a página OFICIAL de um PROGRAMA/emissor? Só então "fonte oficial" é
// verdade. Desconhecido/outlet → false.
export function ehFonteOficial(url) {
  const host = hostDe(url);
  if (!host) return false;
  const meta = entrada(host);
  return Boolean(meta && meta.oficial);
}

// Guarda: o rótulo bate com o host da URL? Verdadeiro só quando o rótulo é o nome
// canônico daquele host (ou o próprio host, no fallback). Usado no teste que barra
// atribuição errada (ex.: 'tavily' apontando passageirodeprimeira.com).
export function rotuloBateHost(label, url) {
  const host = hostDe(url);
  if (!host) return false;
  return label === rotuloFonte(url);
}
