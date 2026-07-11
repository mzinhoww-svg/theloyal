import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import type { Verdict } from "@/components/ui";

// The Loyal Pro — relatório executivo (espelha content/pro-report.schema.json).
export type Benchmark = {
  category: string;
  metric: string;
  unit: string;
  low: string;
  normal: string;
  high: string;
  note?: string;
};
export type Player = {
  player: string;
  move: string;
  reading: string;
  signal: "abertura" | "aperto" | "estável";
};
export type MatrixRow = { player: string; x: string; y: string; quadrant: string };
export type Alert = { level: "insight" | "warning" | "danger"; text: string };
export type Source = { label: string; url: string };

export type ProReport = {
  periodId: string;
  period: string;
  title: string;
  illustrative?: boolean;
  summary: string[];
  tlScorePeriod: {
    average: number;
    sampled: number;
    distribution: { verdict: Verdict; count: number }[];
    note?: string;
  };
  benchmarks: Benchmark[];
  players: Player[];
  matrix: { x: string; y: string; rows: MatrixRow[] };
  implications: string[];
  alerts: Alert[];
  watch: string[];
  sources: Source[];
  disclaimer: string;
};

const DIR = path.join(process.cwd(), "content", "pro");

export function listProReports(): ProReport[] {
  return readdirSync(DIR)
    .filter((f) => f.endsWith(".json"))
    .map((f) => JSON.parse(readFileSync(path.join(DIR, f), "utf8")) as ProReport)
    .sort((a, b) => b.periodId.localeCompare(a.periodId));
}

export function getProReport(periodId: string): ProReport | undefined {
  return listProReports().find((r) => r.periodId === periodId);
}
