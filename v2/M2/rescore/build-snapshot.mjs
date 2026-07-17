// Monta out/snapshot.json a partir dos arquivos de resultado do MCP (leitura real
// do banco). Cada arquivo é o result-dump do execute_sql: {"result":"...<untrusted>
// [{\"j\":\"<json escapado>\"}] </untrusted>..."}. Extrai o array-de-arrays de `j`.
// As tabelas pequenas (custo-base, ratios, pesos, derivacao) vêm inline (lidas via
// MCP e coladas aqui). Nada inventado — só transcrição do que o banco retornou.
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const DIR = dirname(fileURLToPath(import.meta.url));

function extrairArrayDeArquivoMcp(path) {
  const raw = readFileSync(path, 'utf8');
  const obj = JSON.parse(raw);                 // {"result": "<texto>"}
  const texto = obj.result;
  const ini = texto.indexOf('[{"j":');
  const fim = texto.lastIndexOf('}]') + 2;
  if (ini < 0 || fim < 2) throw new Error(`formato inesperado em ${path}`);
  const rowJson = texto.slice(ini, fim);       // [{"j":"<json escapado>"}]
  const rows = JSON.parse(rowJson);            // [{j:"<json>"}]
  return JSON.parse(rows[0].j);                // array-de-arrays
}

const arquivos = process.argv.slice(2);
if (arquivos.length < 2) { console.error('uso: build-snapshot.mjs <chunk0> <chunk1> [...]'); process.exit(1); }

let campanhas = [];
for (const f of arquivos) campanhas = campanhas.concat(extrairArrayDeArquivoMcp(f));

// Dedup defensivo por id (paginação por OFFSET é estável com ORDER BY id).
const vistos = new Set();
const dedup = [];
for (const c of campanhas) { if (!vistos.has(c[0])) { vistos.add(c[0]); dedup.push(c); } }

// Tabelas pequenas — transcrição fiel das leituras MCP (custo_base_moeda /
// custo_base_ratio / score_pesos.v1 / derivacao_config.derivacao.v1).
const custo_base_moeda = [
  { moeda: 'esfera', custo_milheiro: 35.0 },
  { moeda: 'ihg', custo_milheiro: 28.0 },
  { moeda: 'livelo', custo_milheiro: 30.0 },
  { moeda: 'smiles', custo_milheiro: 21.0 },
];
const custo_base_ratio = [
  { origem: 'esfera', destino: 'azul_fidelidade', ratio: 1 },
  { origem: 'esfera', destino: 'connectmiles', ratio: 0.3333 },
  { origem: 'esfera', destino: 'latam_pass', ratio: 1 },
  { origem: 'esfera', destino: 'smiles', ratio: 1 },
  { origem: 'livelo', destino: 'azul_fidelidade', ratio: 1 },
  { origem: 'livelo', destino: 'connectmiles', ratio: 0.3333 },
  { origem: 'livelo', destino: 'latam_pass', ratio: 1 },
  { origem: 'livelo', destino: 'smiles', ratio: 1 },
];
const score_pesos = {
  versao: 'v1', peso_percentil: 0.45, peso_eficiencia: 0.3, peso_raridade: 0.15,
  peso_abrangencia: 0.1, shrink_k: 5, min_samples: 3,
};
const derivacao_config = {
  versao: 'derivacao.v1', percentil_janela: 'rota-total', percentil_min_samples: 3,
  eficiencia_metodo: 'ecdf-inverso', eficiencia_janela: 'cpm-populacao-global',
  raridade_janela: 'snapshot-rota',
  raridade_limiares: [{ max: 1, valor: 0.85 }, { max: 2, valor: 0.85 }, { max: 5, valor: 0.65 }, { max: 20, valor: 0.45 }, { max: 50, valor: 0.25 }, { max: null, valor: 0.1 }],
  abrangencia_janela: 'publico',
  abrangencia_mapa: { clube: 0.3, geral: 1, cartao: 0.6, selecionados: 0.45 },
};

const snap = { campanhas: dedup, custo_base_moeda, custo_base_ratio, score_pesos, derivacao_config };
const outPath = join(DIR, 'out', 'snapshot.json');
writeFileSync(outPath, JSON.stringify(snap));
console.log(`snapshot: ${dedup.length} campanhas (de ${campanhas.length} lidas) → ${outPath}`);
