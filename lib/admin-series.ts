import type { Alert } from "@/components/admin/ui";

// Campanha que pede revisão humana: veio de extração automática e o próprio
// pipeline marcou confiança baixa nas notas.
export function needsReview(c: {
  origin?: string | null;
  notes?: string | null;
}): boolean {
  const o = c.origin ?? "";
  return (
    (o === "auto" || o === "backfill") &&
    !!c.notes &&
    /confianca:\s*baixa/i.test(c.notes)
  );
}

// Agrega datas em contagem por dia para os últimos `days` dias (mais antigo →
// mais novo). Usa a data-só (corta em 10 chars) pra evitar off-by-one de fuso.
export function bucketByDay(
  dates: (string | null | undefined)[],
  days = 14,
): number[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const startMs = today.getTime() - (days - 1) * 86400000;
  const buckets = new Array(days).fill(0);
  for (const d of dates) {
    if (!d) continue;
    const t = new Date(String(d).slice(0, 10));
    if (isNaN(+t)) continue;
    t.setHours(0, 0, 0, 0);
    const idx = Math.round((t.getTime() - startMs) / 86400000);
    if (idx >= 0 && idx < days) buckets[idx] += 1;
  }
  return buckets;
}

// Monta a faixa "Atenção agora" a partir de contadores já apurados. Ordem por
// severidade: vermelho → amarelo → azul. Lista vazia = tudo em dia.
export function deriveAttention(a: {
  newsPendentes: number;
  newsErro: number;
  venceHoje: number;
  vence72: number;
  reviewCount: number;
  jobsPausados: number;
  runFailed?: string | null;
}): Alert[] {
  const out: Alert[] = [];
  if (a.newsErro > 0)
    out.push({
      tone: "red",
      text: `${a.newsErro} notícias com erro na extração`,
      href: "/admin/noticias?status=erro",
    });
  if (a.runFailed)
    out.push({
      tone: "red",
      text: `Última execução falhou: ${a.runFailed}`,
      href: "/admin/logs?status=failed",
    });
  if (a.venceHoje > 0)
    out.push({
      tone: "red",
      text: `${a.venceHoje} campanhas vencem hoje`,
      href: "/admin/campanhas?status=vence-hoje",
    });
  if (a.newsPendentes > 0)
    out.push({
      tone: "yellow",
      text: `${a.newsPendentes} notícias aguardando extração`,
      href: "/admin/noticias?status=pendente",
    });
  if (a.vence72 > 0)
    out.push({
      tone: "yellow",
      text: `${a.vence72} campanhas vencem em 72h`,
      href: "/admin/campanhas?status=vence-72h",
    });
  if (a.reviewCount > 0)
    out.push({
      tone: "yellow",
      text: `${a.reviewCount} campanhas pedem revisão`,
      href: "/admin/campanhas?revisao=1",
    });
  if (a.jobsPausados > 0)
    out.push({
      tone: "blue",
      text: `${a.jobsPausados} crons pausados`,
      href: "/admin/jobs",
    });
  return out;
}
