// Renderiza os cards sociais para PNGs SEM precisar de servidor rodando —
// usa o mesmo motor @vercel/og que o Next empacota. Alternativa ao
// social-export.mjs (que busca as rotas /social/* via HTTP) para ambientes que
// não podem subir um listener. Espelha os layouts de app/social/*.
//
// Uso: node scripts/social-render.mjs            -> PNGs em content/social/cards/
//      OUT=/tmp/x node scripts/social-render.mjs  -> destino custom
import React from "react";
import { ImageResponse } from "next/dist/compiled/@vercel/og/index.node.js";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { CANONICAL_VERDICTS } from "./taxonomy.mjs";

const h = React.createElement;

const HEX = {
  paper: "#FAF7F0", paperDark: "#F1ECE1", ink: "#111111", gray700: "#3D3A34",
  gray500: "#555555", gray400: "#8A8578", green100: "#D9F4E9", green500: "#00C48C",
  green600: "#00A878", green700: "#007A57", blue100: "#E4EAFF", blue700: "#2547CC",
  yellow500: "#F2C94C", red600: "#D64545", surface: "#FFFFFF",
};
// Só ESTILO — os rótulos vêm da taxonomia canônica (DEBT-004), não são copiados.
const VERDICT_STYLE = {
  "vale-agir": { bg: HEX.green100, fg: HEX.green700 },
  "vale-olhar": { bg: HEX.blue100, fg: HEX.blue700 },
  "casos-especificos": { bg: HEX.paperDark, fg: HEX.gray500 },
  esperaria: { bg: HEX.yellow500, fg: HEX.ink },
  evitaria: { bg: HEX.red600, fg: HEX.surface },
  "nao-confirmado": { bg: HEX.paper, fg: HEX.gray500, dashed: true },
};
const VERDICT = Object.fromEntries(
  CANONICAL_VERDICTS.map((v) => [v.key, { label: v.label, ...VERDICT_STYLE[v.key] }]),
);
const SIZES = { square: { width: 1080, height: 1080 }, wide: { width: 1200, height: 675 }, portrait: { width: 1080, height: 1350 } };
const CRIT = ["valor", "regra", "vigência", "fricção", "aplicab.", "liquidez", "estoque", "fontes"];

const seal = (on = "paper") => {
  const sealBg = on === "ink" ? HEX.paper : HEX.ink;
  const sealFg = on === "ink" ? HEX.ink : HEX.paper;
  const wordFg = on === "ink" ? HEX.paper : HEX.ink;
  return h("div", { style: { display: "flex", alignItems: "center", gap: 14 } }, [
    h("div", { key: "s", style: { display: "flex", alignItems: "center", justifyContent: "center", width: 48, height: 48, background: sealBg, color: sealFg, borderRadius: 6, fontSize: 22, fontWeight: 700, letterSpacing: -1 } }, "TL"),
    h("div", { key: "w", style: { display: "flex", gap: 7, fontSize: 26, color: wordFg } }, [h("span", { key: 1 }, "The"), h("span", { key: 2, style: { fontWeight: 800 } }, "Loyal")]),
  ]);
};
const footer = (text) => h("div", { style: { display: "flex", alignItems: "center", gap: 18 } }, [
  h("div", { key: "b", style: { display: "flex", width: 96, height: 7, background: HEX.green600, borderRadius: 999 } }),
  h("div", { key: "t", style: { display: "flex", fontSize: 24, color: HEX.gray500, fontWeight: 600 } }, text),
]);
const kicker = (t) => h("div", { style: { display: "flex", fontSize: 22, letterSpacing: 3, textTransform: "uppercase", color: HEX.gray500, fontWeight: 600 } }, t);
const frame = (size, children) => h("div", { style: { width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", background: HEX.paper, padding: 72 } }, children);

function quote({ text, kick = "A conta, não a manchete", size = "square" }) {
  const s = SIZES[size];
  const fontSize = text.length > 150 ? 52 : text.length > 90 ? 62 : 72;
  return [frame(s, [
    h("div", { key: "top", style: { display: "flex", flexDirection: "column", gap: 20 } }, [seal("paper"), kicker(kick)]),
    h("div", { key: "mid", style: { display: "flex", flexDirection: "column", gap: 28 } }, [
      h("div", { key: "q", style: { display: "flex", fontSize, lineHeight: 1.12, fontWeight: 700, color: HEX.ink, letterSpacing: -1, maxWidth: s.width - 144 } }, text),
      h("div", { key: "u", style: { display: "flex", width: 160, height: 8, background: HEX.green600, borderRadius: 999 } }),
    ]),
    footer("theloyal.com.br · a conta feita, todo dia útil às 8h"),
  ]), s];
}

function tlscore({ score, verdict = "nao-confirmado", title, bars = [] }) {
  const s = SIZES.square; const v = VERDICT[verdict];
  const hasScore = verdict !== "nao-confirmado" && Number.isFinite(+score);
  const scoreTxt = hasScore ? String(Math.round(+score)) : "sem nota";
  return [frame(s, [
    h("div", { key: "top", style: { display: "flex", flexDirection: "column", gap: 16 } }, [seal("paper"), kicker("TL Score")]),
    h("div", { key: "sc", style: { display: "flex", alignItems: "flex-end", gap: 28 } }, [
      h("div", { key: "n", style: { display: "flex", fontFamily: "monospace", fontSize: hasScore ? 220 : 92, fontWeight: 700, lineHeight: 0.9, color: hasScore ? HEX.ink : HEX.gray400, letterSpacing: hasScore ? -6 : -2, marginBottom: hasScore ? 0 : 20 } }, scoreTxt),
      h("div", { key: "p", style: { display: "flex", alignItems: "center", marginBottom: 24, padding: "12px 22px", borderRadius: 999, background: v.dashed ? HEX.paper : v.bg, color: v.fg, border: v.dashed ? `2px dashed ${HEX.gray400}` : "none", fontSize: 26, fontWeight: 700, letterSpacing: 1 } }, v.label),
    ]),
    bars.length === 8
      ? h("div", { key: "bars", style: { display: "flex", alignItems: "flex-end", gap: 12, height: 120 } }, bars.map((b, i) =>
          h("div", { key: i, style: { display: "flex", flexDirection: "column", alignItems: "center", gap: 8 } }, [
            h("div", { key: "bar", style: { display: "flex", width: 74, height: Math.max(6, Math.min(100, b)), background: HEX.green600, borderRadius: 4 } }),
            h("div", { key: "l", style: { display: "flex", fontSize: 15, color: HEX.gray400 } }, CRIT[i]),
          ])))
      : h("div", { key: "bars", style: { display: "flex" } }),
    h("div", { key: "title", style: { display: "flex", fontSize: 34, lineHeight: 1.25, color: HEX.gray500, maxWidth: s.width - 144 } }, title),
    footer("theloyal.com.br · nota de 0 a 100, oito critérios auditáveis"),
  ]), s];
}

function conta({ title, rows, result }) {
  const s = SIZES.portrait;
  const parse = (r) => { const i = r.indexOf(":"); return i === -1 ? [r, ""] : [r.slice(0, i).trim(), r.slice(i + 1).trim()]; };
  const rws = rows.split("|").map(parse); const [rk, rv] = parse(result);
  return [frame(s, [
    h("div", { key: "top", style: { display: "flex", flexDirection: "column", gap: 16 } }, [
      seal("paper"), kicker("Deal Desk · conta feita"),
      h("div", { key: "t", style: { display: "flex", fontSize: 46, fontWeight: 700, color: HEX.ink, letterSpacing: -1, lineHeight: 1.1, maxWidth: s.width - 144 } }, title),
    ]),
    h("div", { key: "block", style: { display: "flex", flexDirection: "column", background: HEX.ink, borderRadius: 12, padding: "40px 44px", fontFamily: "monospace", color: HEX.paper, fontSize: 34, lineHeight: 1.7 } }, [
      ...rws.map(([k, val], i) => h("div", { key: i, style: { display: "flex", justifyContent: "space-between", gap: 24 } }, [
        h("span", { key: "k", style: { color: HEX.gray400 } }, k), h("span", { key: "v", style: { textAlign: "right" } }, val)])),
      h("div", { key: "res", style: { display: "flex", justifyContent: "space-between", gap: 24, marginTop: 18, paddingTop: 18, borderTop: `2px solid ${HEX.gray700}`, color: HEX.green500 } }, [
        h("span", { key: "k" }, rk), h("span", { key: "v", style: { fontWeight: 700, textAlign: "right" } }, rv)]),
    ]),
    footer("Confira sempre as regras no site oficial antes de transferir."),
  ]), s];
}

function carrossel({ i = 1, n = 6, kind = "texto", kick = "Método à mostra", title = "", body = "", score, verdict = "vale-agir" }) {
  const s = SIZES.portrait;
  const indicator = h("div", { key: "ind", style: { display: "flex", justifyContent: "space-between", alignItems: "center" } }, [
    seal("paper"), h("div", { key: "i", style: { display: "flex", fontFamily: "monospace", fontSize: 26, color: HEX.gray400 } }, `${i}/${n}`)]);
  let core;
  if (kind === "capa") {
    core = h("div", { key: "c", style: { display: "flex", flexDirection: "column", gap: 28 } }, [
      kicker(kick),
      h("div", { key: "t", style: { display: "flex", fontSize: 84, fontWeight: 700, color: HEX.ink, letterSpacing: -2, lineHeight: 1.05, maxWidth: s.width - 144 } }, title),
      h("div", { key: "u", style: { display: "flex", width: 180, height: 9, background: HEX.green600, borderRadius: 999 } }),
    ]);
  } else if (kind === "veredito") {
    const v = VERDICT[verdict];
    const hasScore = verdict !== "nao-confirmado" && Number.isFinite(+score);
    const st = hasScore ? String(Math.round(+score)) : "sem nota";
    core = h("div", { key: "c", style: { display: "flex", flexDirection: "column", gap: 24 } }, [
      h("div", { key: "row", style: { display: "flex", alignItems: "flex-end", gap: 24 } }, [
        h("div", { key: "n", style: { display: "flex", fontFamily: "monospace", fontSize: hasScore ? 180 : 80, fontWeight: 700, color: hasScore ? HEX.ink : HEX.gray400, lineHeight: 0.9, letterSpacing: hasScore ? -5 : -2, marginBottom: hasScore ? 0 : 16 } }, st),
        h("div", { key: "p", style: { display: "flex", marginBottom: 22, padding: "12px 22px", borderRadius: 999, background: v.dashed ? HEX.paper : v.bg, color: v.fg, border: v.dashed ? `2px dashed ${HEX.gray400}` : "none", fontSize: 26, fontWeight: 700, letterSpacing: 1 } }, v.label)]),
      body ? h("div", { key: "b", style: { display: "flex", fontSize: 38, lineHeight: 1.35, color: HEX.gray500, maxWidth: s.width - 144 } }, body) : h("div", { key: "b", style: { display: "flex" } }),
    ]);
  } else if (kind === "cta") {
    core = h("div", { key: "c", style: { display: "flex", flexDirection: "column", gap: 28 } }, [
      h("div", { key: "t", style: { display: "flex", fontSize: 64, fontWeight: 700, color: HEX.ink, letterSpacing: -1, lineHeight: 1.1, maxWidth: s.width - 144 } }, title),
      h("div", { key: "cta", style: { display: "flex", alignItems: "center", alignSelf: "flex-start", padding: "18px 34px", borderRadius: 8, background: HEX.green600, color: HEX.paper, fontSize: 34, fontWeight: 700 } }, body),
    ]);
  } else {
    core = h("div", { key: "c", style: { display: "flex", flexDirection: "column", gap: 24 } }, [
      title ? h("div", { key: "t", style: { display: "flex", fontSize: 56, fontWeight: 700, color: HEX.ink, letterSpacing: -1, lineHeight: 1.1, maxWidth: s.width - 144 } }, title) : h("div", { key: "t", style: { display: "flex" } }),
      h("div", { key: "b", style: { display: "flex", fontSize: 40, lineHeight: 1.4, color: HEX.gray500, maxWidth: s.width - 144 } }, body),
    ]);
  }
  return [frame(s, [indicator, core, h("div", { key: "f", style: { display: "flex", fontSize: 22, color: HEX.gray400, letterSpacing: 1 } }, "The Loyal · pontos e milhas sem pegadinha")]), s];
}

// ---------------------------------------------------------------------------
// MANIFESTO COMPLETO — 30 dias. Hooks extraídos dos bancos de docs/GTM-CONTENT-30D.md.
// ---------------------------------------------------------------------------
const METODO = [
  ["m01", "Um bônus dobra a quantidade de pontos, não o valor deles."],
  ["m02", "CPM é o preço de acumular. Sem ele, “100% de bônus” é só uma manchete."],
  ["m03", "Milha barata que resgata mal não é barata. É cara disfarçada."],
  ["m04", "O TL Score premia a conta inteira, não o número da capa."],
  ["m05", "Sem regra e sem data, não é oportunidade. É Não confirmado."],
  ["m06", "A comparação certa é entre o CPM de acúmulo e o VPM do seu resgate."],
  ["m07", "Cartão premium se justifica por conta, não por status."],
  ["m08", "Cashback e pontos não se comparam pela porcentagem, e sim pelo valor final em reais."],
  ["m09", "Bônus de algo que você não consegue usar vale zero."],
  ["m10", "Acumular sem plano de resgate é financiar o programa, não a sua viagem."],
  ["m11", "A origem do dado é parte do dado. Rumor não é conta fechada."],
  ["m12", "Toda a análise cabe numa subtração: VPM menos CPM."],
];
const MITO = [
  ["v01", "Milha nunca desvaloriza é a frase mais cara do mundo dos pontos."],
  ["v02", "Bônus alto sobre um ponto que vale pouco é bônus cosmético."],
  ["v03", "Volume não é veredito. Todo mundo transferindo não quer dizer que vale."],
  ["v04", "Cartão premium se paga na milha? Só depois de subtrair a anuidade."],
  ["v05", "Desconto sobre um preço já ruim continua ruim."],
  ["v06", "Acumular sem plano de resgate não é ganhar. É emprestar."],
  ["v07", "Nenhum programa é o melhor em tudo. Fidelidade cega custa spread."],
  ["v08", "Status só vale a conta dos benefícios que você de fato usa."],
  ["v09", "Sofisticação é escolher pela conta, não pelo status do instrumento."],
  ["v10", "Programa de loja não vale nada? Alguns têm o melhor VPM do mercado."],
  ["v11", "Transferir ponto não é de graça: a origem também tem um VPM."],
  ["v12", "Prazo curto não melhora uma conta ruim."],
];
const PONTO = [
  ["p01", "Foi conferir a vigência. Não achou regulamento. A sobrancelha continuou levantada."],
  ["p02", "O que ele não adora é o resgate custando três vezes mais milhas que mês passado. Ele anotou."],
  ["p03", "Perguntaram se valia a pena. Ele pediu a conta. Ainda está esperando a conta."],
  ["p04", "O Ponto não tem programa favorito. O Ponto tem planilha."],
  ["p05", "Perguntou qual era o VPM do resgate. O silêncio respondeu."],
  ["p06", "Contas boas não fogem. Contas ruins é que insistem em correr."],
  ["p07", "Leu o regulamento até o fim. O “nunca” durava doze meses."],
  ["p08", "Fez a conta da anuidade. Continuou na categoria de baixo, com mais dinheiro."],
  ["p09", "Ele desconfia porque já fez a conta antes."],
  ["p10", "Não tinha segredo. Tinha subtração: o que a milha vale menos o que custou."],
];
const PERGUNTA = [
  ["q01", "Qual foi o pior resgate que você já fez sem perceber na hora?"],
  ["q02", "Você acumula com um resgate em mente, ou acumula primeiro e pensa depois?"],
  ["q03", "Quantos programas você acompanha? E quantos você realmente usa?"],
  ["q04", "Cartão com anuidade alta: você já fez a conta de quanto resgatou no ano?"],
  ["q05", "Cashback ou pontos: qual venceu a última conta que você fez?"],
  ["q06", "Qual programa mais te decepcionou com desvalorização silenciosa?"],
  ["q07", "Você já deixou ponto expirar? Quanto acha que perdeu?"],
  ["q08", "Se pudesse manter um só programa, qual seria — e por quê?"],
];

const TLSCORES = [
  ["tl-vale-agir", { score: 88, verdict: "vale-agir", title: "Transferência bonificada com compra de origem em desconto", bars: [92, 90, 100, 80, 85, 80, 75, 90] }],
  ["tl-vale-olhar", { score: 76, verdict: "vale-olhar", title: "Compra de pontos com bônus, resgate de liquidez média", bars: [78, 82, 90, 70, 72, 68, 65, 85] }],
  ["tl-casos-especificos", { score: 62, verdict: "casos-especificos", title: "Bônus só compensa para quem já é do clube", bars: [64, 70, 80, 55, 50, 60, 58, 75] }],
  ["tl-esperaria", { score: 48, verdict: "esperaria", title: "Spread apertado, melhor aguardar a próxima janela", bars: [46, 55, 70, 40, 42, 45, 50, 60] }],
  ["tl-evitaria", { score: 31, verdict: "evitaria", title: "CPM acima do VPM de resgate: a conta não fecha", bars: [28, 40, 55, 30, 25, 30, 35, 50] }],
  ["tl-nao-confirmado", { verdict: "nao-confirmado", title: "Rumor de 120% em compra direta ainda sem regulamento" }],
];
const CONTAS = [
  ["conta-esfera-latam", { title: "Esfera → Latam Pass, 100% de bônus", rows: "custo origem:R$ 1.200,00|pontos:50.000|bônus:100%|milhas finais:100.000", result: "CPM final:R$ 12,00 /milheiro" }],
  ["conta-compra-pontos", { title: "Compra de pontos com 60% de bônus", rows: "preço base:R$ 38,00 /mil|bônus:60%|CPM bruto:R$ 23,75|VPM resgate:R$ 28,00", result: "spread:+R$ 4,25 /milheiro" }],
];

const CAROUSELS = {
  c1: [
    { kind: "capa", kick: "Método à mostra", title: "Por que bônus de 100% quase nunca vale" },
    { kind: "texto", title: "O bônus dobra a quantidade", body: "Mas não dobra o valor. Se a milha vale pouco no resgate, 100% sobre pouco continua pouco." },
    { kind: "texto", title: "O número que decide é o VPM", body: "Quanto a milha vale quando você usa. Sem ele, a porcentagem do anúncio não diz nada." },
    { kind: "texto", title: "Spread = VPM − CPM", body: "Positivo, talvez valha. Negativo, a manchete escondeu metade da conta." },
    { kind: "veredito", score: 88, verdict: "vale-agir", body: "Quando o spread fecha e a regra é clara, vira Vale agir — com a conta à mostra." },
    { kind: "cta", title: "A conta completa vira uma edição de 5 minutos, todo dia útil às 8h.", body: "Assine grátis · theloyal.com.br" },
  ],
  c2: [
    { kind: "capa", kick: "Método à mostra", title: "A régua em três números" },
    { kind: "texto", title: "CPM — o preço de acumular", body: "Quanto custa cada mil milhas depois do bônus. R$ 1.200 por 100 mil dá R$ 12 por milheiro." },
    { kind: "texto", title: "VPM — o preço de usar", body: "Quanto essas mil milhas valem no resgate real. Milha barata que resgata mal é cara disfarçada." },
    { kind: "texto", title: "Spread — a subtração que decide", body: "VPM menos CPM. Positivo, pode valer. Negativo, a oferta trabalha contra você." },
    { kind: "texto", title: "É isto que o TL Score condensa", body: "Oito critérios auditáveis, uma nota de 0 a 100, um veredito. A conta à mostra, sempre." },
    { kind: "cta", title: "A conta de cada promoção, todo dia útil às 8h.", body: "Assine grátis · theloyal.com.br" },
  ],
  c3: [
    { kind: "capa", kick: "Como analisamos", title: "A categoria mais impopular — e mais útil" },
    { kind: "texto", title: "Sem regra publicada, não há veredito", body: "Uma oferta sem regulamento é uma oferta que pode mudar antes de você agir." },
    { kind: "texto", title: "Sem vigência, não há timing", body: "Data não é detalhe burocrático. É o que separa uma conta real de um boato." },
    { kind: "veredito", verdict: "nao-confirmado", body: "Classificamos como Não confirmado e seguimos. Radar, não recomendação." },
    { kind: "texto", title: "Perder o hype custa menos que errar a conta", body: "De quem confiou nela. Independência não é postura; é método." },
    { kind: "cta", title: "Método antes de manchete, todo dia.", body: "Assine grátis · theloyal.com.br" },
  ],
};

const CARDS = [
  ...METODO.map(([id, text]) => [`metodo-${id}.png`, quote({ kick: "Método à mostra", text })]),
  ...MITO.map(([id, text]) => [`mito-${id}.png`, quote({ kick: "Mito vs. conta", text })]),
  ...PONTO.map(([id, text]) => [`ponto-${id}.png`, quote({ kick: "Ponto comenta", text })]),
  ...PERGUNTA.map(([id, text]) => [`pergunta-${id}.png`, quote({ kick: "Pergunta do dia", text })]),
  ...TLSCORES.map(([id, cfg]) => [`${id}.png`, tlscore(cfg)]),
  ...CONTAS.map(([id, cfg]) => [`${id}.png`, conta(cfg)]),
  ...Object.entries(CAROUSELS).flatMap(([ck, panels]) =>
    panels.map((p, idx) => [`carrossel-${ck}-${idx + 1}-${p.kind}.png`, carrossel({ ...p, i: idx + 1, n: panels.length })])),
];

const OUT = process.env.OUT || join(process.cwd(), "content", "social", "cards");
mkdirSync(OUT, { recursive: true });
let ok = 0;
for (const [file, [el, size]] of CARDS) {
  const img = new ImageResponse(el, size);
  const buf = Buffer.from(await img.arrayBuffer());
  writeFileSync(join(OUT, file), buf);
  ok += 1;
  console.log(`ok ${file} (${buf.length} bytes, ${size.width}x${size.height})`);
}
console.log(`\n${ok}/${CARDS.length} cards renderizados em ${OUT}`);
