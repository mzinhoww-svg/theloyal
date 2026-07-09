import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import type { Verdict } from "@/components/ui";

// Modelo editorial (espelha content/edition.schema.json). Mesmo JSON que
// alimenta e-mail e plain text alimenta a página web.
export type Conta = { rows: [string, string][]; result: [string, string] };

export type Deal = {
  category: string;
  title: string;
  context: string;
  conta: Conta;
  verdict: Verdict;
  verdictNote?: string;
  source: string;
  sourceUrl?: string;
  vigencia?: string;
  tlScore?: number;
};

export type FechaLogo = {
  tag: string;
  text: string;
  cpm?: string;
  note?: string;
  vigencia?: string;
};

export type Source = { label: string; url: string };

export type Edition = {
  number: number;
  date: string;
  weekday: string;
  publishTime: string;
  readingMinutes: number;
  illustrative?: boolean;
  subject?: string;
  preheader?: string;
  signal: string;
  deals: Deal[];
  fechaLogo?: FechaLogo[];
  sources: Source[];
  disclaimer: string;
};

const DIR = path.join(process.cwd(), "content", "editions");

export function listEditions(): Edition[] {
  return readdirSync(DIR)
    .filter((f) => f.endsWith(".json"))
    .map((f) => JSON.parse(readFileSync(path.join(DIR, f), "utf8")) as Edition)
    .sort((a, b) => b.number - a.number);
}

export function getEdition(n: number): Edition | undefined {
  return listEditions().find((e) => e.number === n);
}
