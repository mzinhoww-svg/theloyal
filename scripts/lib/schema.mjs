// Validação de schema em runtime (backlog P2.13b). Aplica os contratos
// content/*.schema.json (draft 2020-12, additionalProperties:false) ANTES dos
// checks semânticos — um campo fora do contrato deixa de passar em silêncio.
// Best-effort: schema ausente/ilegível ⇒ [] (não bloqueia por falta de schema).
import Ajv2020 from "ajv/dist/2020.js";
import addFormatsMod from "ajv-formats";
import { readFileSync } from "node:fs";

const addFormats = addFormatsMod.default ?? addFormatsMod;

const SCHEMA_PATHS = {
  edition: "content/edition.schema.json",
  weekly: "content/weekly.schema.json",
  pro: "content/pro-report.schema.json",
  forecast: "content/forecast.schema.json",
  entity: "content/entity.schema.json",
};

let _ajv = null;
const _validators = new Map();

function ajv() {
  if (!_ajv) {
    // strict:false — os schemas usam palavras-chave (const, format) que o modo
    // estrito recusaria; a validação de dados segue rigorosa.
    _ajv = new Ajv2020({ allErrors: true, strict: false });
    addFormats(_ajv);
  }
  return _ajv;
}

function validatorFor(kind, schemaPath) {
  let v = _validators.get(kind);
  if (v) return v;
  const path = schemaPath ?? SCHEMA_PATHS[kind];
  if (!path) return null;
  v = ajv().compile(JSON.parse(readFileSync(path, "utf8")));
  _validators.set(kind, v);
  return v;
}

function formatError(e) {
  const where = e.instancePath || "(raiz)";
  if (e.keyword === "additionalProperties") {
    return `schema: ${where} tem campo fora do contrato: '${e.params.additionalProperty}'`;
  }
  if (e.keyword === "required") {
    return `schema: ${where} falta campo obrigatório '${e.params.missingProperty}'`;
  }
  return `schema: ${where} ${e.message}`;
}

// Retorna array de mensagens legíveis (vazio = válido). Determinístico.
export function schemaErrors(kind, data, opts = {}) {
  try {
    const v = validatorFor(kind, opts.schemaPath);
    if (!v) return [];
    if (v(data)) return [];
    // Deduplica e limita para não inundar o relatório.
    const msgs = [...new Set((v.errors ?? []).map(formatError))];
    return msgs.slice(0, 12);
  } catch {
    return [];
  }
}
