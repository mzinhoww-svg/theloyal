// Exporta os cards sociais (rotas /social/*) para PNGs em out/social/.
// Uso: BASE=http://localhost:3000 node scripts/social-export.mjs
// (rode `npm run start` antes; em CI, aponte BASE para o preview da Vercel.)
//
// O manifesto abaixo casa com os roteiros em content/social/. Edite os params
// para gerar as artes de cada peça. Deals reais só entram com fonte e vigência
// confirmadas (regra 9) — os exemplos aqui são ilustrativos.

import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const BASE = process.env.BASE || "http://localhost:3000";
const OUT = join(process.cwd(), "out", "social");

const CARDS = [
  {
    file: "quote-mito-desvaloriza.png",
    route: "quote",
    params: {
      kicker: "Mito vs. conta",
      text: "Milha nunca desvaloriza é a frase mais cara do mundo dos pontos.",
    },
  },
  {
    file: "quote-metodo-bonus.png",
    route: "quote",
    params: {
      kicker: "Método à mostra",
      text: "Um bônus dobra a quantidade de pontos, não o valor deles.",
    },
  },
  {
    file: "tlscore-vale-agir.png",
    route: "tlscore",
    params: {
      score: "88",
      verdict: "vale-agir",
      title: "Transferência bonificada com compra de origem em desconto",
      bars: "92,90,100,80,85,80,75,90",
    },
  },
  {
    file: "tlscore-nao-confirmado.png",
    route: "tlscore",
    params: {
      verdict: "nao-confirmado",
      title: "Rumor de 120% em compra direta ainda sem regulamento",
    },
  },
  {
    file: "conta-esfera-latam.png",
    route: "conta",
    params: {
      title: "Esfera → Latam Pass, 100% de bônus",
      rows: "custo origem:R$ 1.200,00|pontos:50.000|bônus:100%|milhas finais:100.000",
      result: "CPM final:R$ 12,00 /milheiro",
    },
  },
  // Carrossel C1 — método "por que bônus de 100% engana"
  { file: "c1-1-capa.png", route: "carrossel", params: { i: "1", n: "6", kind: "capa", kicker: "Método à mostra", title: "Por que bônus de 100% quase nunca vale" } },
  { file: "c1-2-texto.png", route: "carrossel", params: { i: "2", n: "6", kind: "texto", title: "O bônus dobra a quantidade", body: "Mas não dobra o valor. Se a milha vale pouco no resgate, 100% sobre pouco continua pouco." } },
  { file: "c1-3-texto.png", route: "carrossel", params: { i: "3", n: "6", kind: "texto", title: "O número que decide é o VPM", body: "Quanto a milha vale quando você usa. Sem ele, a porcentagem do anúncio não diz nada." } },
  { file: "c1-4-texto.png", route: "carrossel", params: { i: "4", n: "6", kind: "texto", title: "Spread = VPM − CPM", body: "Positivo, talvez valha. Negativo, a manchete escondeu metade da conta." } },
  { file: "c1-5-veredito.png", route: "carrossel", params: { i: "5", n: "6", kind: "veredito", score: "88", verdict: "vale-agir", body: "Quando o spread fecha e a regra é clara, vira Vale agir — com a conta à mostra." } },
  { file: "c1-6-cta.png", route: "carrossel", params: { i: "6", n: "6", kind: "cta", title: "A conta completa vira uma edição de 5 minutos, todo dia útil às 8h.", body: "Assine grátis · theloyal.com.br" } },
];

function url(card) {
  const qs = new URLSearchParams(card.params).toString();
  return `${BASE}/social/${card.route}?${qs}`;
}

async function main() {
  mkdirSync(OUT, { recursive: true });
  let ok = 0;
  for (const card of CARDS) {
    const res = await fetch(url(card));
    if (!res.ok) {
      console.error(`FALHOU ${card.file}: HTTP ${res.status}`);
      continue;
    }
    const buf = Buffer.from(await res.arrayBuffer());
    writeFileSync(join(OUT, card.file), buf);
    ok += 1;
    console.log(`ok ${card.file} (${buf.length} bytes)`);
  }
  console.log(`\n${ok}/${CARDS.length} cards exportados em ${OUT}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
