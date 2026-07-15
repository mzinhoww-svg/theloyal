// Fonte de verdade ÚNICA da taxonomia de Verdict do The Loyalty.
// Apêndice C do RFC-001 (Editorial Knowledge System). Todo pipeline —
// validação/render de e-mail (Pipeline A, scripts/lib.mjs), render de e-mail
// legado e web archive (Pipeline B, renderer/*, components/daily) — deriva
// destas constantes. Divergência entre pipelines é barrada por
// tests/taxonomy.test.mjs (D-2 do RFC não pode voltar em silêncio).
//
// `family` é semântica, não cor: cada pipeline mapeia família → paleta própria
// (o e-mail usa uma paleta email-safe reduzida; a web usa os tokens Tailwind).

export const CANONICAL_VERDICTS = [
  { key: "vale-agir",         label: "VALE AGIR",                 min: 85,   max: 100,  family: "green"  },
  { key: "vale-olhar",        label: "VALE OLHAR",                min: 70,   max: 84,   family: "blue"   },
  { key: "casos-especificos", label: "SÓ PARA CASOS ESPECÍFICOS", min: 55,   max: 69,   family: "gray"   },
  { key: "esperaria",         label: "ESPERARIA",                 min: 40,   max: 54,   family: "yellow" },
  { key: "evitaria",          label: "EVITARIA",                  min: 0,    max: 39,   family: "red"    },
  { key: "nao-confirmado",    label: "NÃO CONFIRMADO",            min: null, max: null, family: "gray"   },
];

export const CANONICAL_VERDICT_KEYS = CANONICAL_VERDICTS.map((v) => v.key);

// Aliases legados DEPRECADOS (Pipeline B usava 7 valores). Ainda resolvem para
// não quebrar conteúdo antigo, mas são janela de compatibilidade: migrar o
// conteúdo e remover na v2 da taxonomia. Ver RFC-001 §12.2 (M-1).
export const DEPRECATED_VERDICT_ALIASES = {
  depende: "esperaria",
  "nao-vale": "evitaria",
};

// Normaliza uma chave de veredito (minúsculas + resolve alias deprecado).
// Retorna a chave canônica, ou a original em minúsculas se desconhecida.
export function resolveVerdictKey(key) {
  const k = String(key || "").toLowerCase();
  return DEPRECATED_VERDICT_ALIASES[k] ?? k;
}

export const CANONICAL_VERDICT_BY_KEY = Object.fromEntries(
  CANONICAL_VERDICTS.map((v) => [v.key, v]),
);
