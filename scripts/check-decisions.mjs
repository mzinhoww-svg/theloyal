#!/usr/bin/env node
// check-decisions.mjs — GATE DE COLISÃO de decisões (C4, governança).
//
// Faz cumprir o "Índice de alocação de faixas" no topo de v2/DECISIONS.md. Mata a
// classe de colisão que apareceu em três chats paralelos numerando do mesmo ponto
// (predict e principal ambos D-040..043; calibração e principal ambos D-066..068).
//
// Três checagens, todas determinísticas:
//   (1) DUPLICATA — o mesmo rótulo D-NNN não pode aparecer duas vezes no arquivo.
//   (2) FAIXA — todo cabeçalho de decisão cai dentro de uma faixa declarada no
//       índice do topo. (Se o arquivo ainda não tem índice — branch legado —, a
//       checagem de faixa é PULADA; a cross-branch abaixo ainda pega a colisão.)
//   (3) CROSS-BRANCH — compara este arquivo com o do branch default e REPROVA se o
//       MESMO D-NNN existir nos dois com TÍTULO diferente. É a colisão literal do
//       C4: dois branches declarando o mesmo número com decisões diferentes. É o
//       que trava os PRs paralelos (#105/#106/#107/#108) até renumerarem p/ a
//       sua faixa. Best-effort: sem acesso ao default, emite aviso e segue.
//
// Uso: node scripts/check-decisions.mjs  (sai !=0 em violação).
// Base p/ cross-branch: env DECISIONS_BASE_REF ou GITHUB_BASE_REF; senão o default
// conhecido do repo.
import { readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';

const ARQ = 'v2/DECISIONS.md';
const DEFAULT_BASE = 'claude/loyalty-landing-page-v1-7vbjq7';

// Cabeçalho de decisão: "## D-050 — Título" ou "## D-050.1 — Título".
const RE_HEADER = /^##\s+D-(\d+)(\.\d+)?\s+[—-]\s+(.+?)\s*$/;
// Linha da tabela de faixas: "| **D-001 .. D-099** | Dono | ... |".
const RE_FAIXA = /D-(\d+)\s*\.\.\s*D-(\d+)/;

function parseDecisoes(texto) {
  const headers = []; // {label, num, title, line}
  const faixas = [];  // {lo, hi}
  const linhas = texto.split('\n');
  for (let i = 0; i < linhas.length; i++) {
    const l = linhas[i];
    const mh = RE_HEADER.exec(l);
    if (mh) {
      headers.push({
        label: `D-${mh[1]}${mh[2] || ''}`,
        num: Number(mh[1]),
        title: mh[3].replace(/\s+/g, ' ').trim(),
        line: i + 1,
      });
      continue;
    }
    // Só lê faixa de linhas de TABELA (começam com "|"), nunca de prosa que
    // menciona um intervalo por acaso.
    if (l.trimStart().startsWith('|')) {
      const mf = RE_FAIXA.exec(l);
      if (mf) faixas.push({ lo: Number(mf[1]), hi: Number(mf[2]) });
    }
  }
  return { headers, faixas };
}

function lerBaseDecisoes() {
  const base = process.env.DECISIONS_BASE_REF || process.env.GITHUB_BASE_REF || DEFAULT_BASE;
  const refs = [`origin/${base}`, base, 'FETCH_HEAD'];
  // Tenta ler direto; se falhar (checkout raso), tenta buscar o base e reler.
  for (const ref of refs) {
    try {
      return { texto: execSync(`git show ${ref}:${ARQ}`, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }), ref };
    } catch { /* tenta o próximo */ }
  }
  try {
    execSync(`git fetch --depth=1 origin ${base}`, { stdio: 'ignore' });
    return { texto: execSync(`git show FETCH_HEAD:${ARQ}`, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }), ref: `origin/${base} (fetched)` };
  } catch {
    return null;
  }
}

function main() {
  const texto = readFileSync(ARQ, 'utf8');
  const { headers, faixas } = parseDecisoes(texto);
  const erros = [];
  const avisos = [];

  // (1) DUPLICATA
  const vistos = new Map();
  for (const h of headers) {
    if (vistos.has(h.label)) {
      erros.push(`DUPLICATA: ${h.label} aparece 2x (linhas ${vistos.get(h.label)} e ${h.line}) — "${h.title}"`);
    } else {
      vistos.set(h.label, h.line);
    }
  }

  // (2) FAIXA (só se o índice existir neste arquivo)
  if (faixas.length === 0) {
    avisos.push('sem índice de faixas neste arquivo (branch legado) — checagem de faixa pulada; cross-branch ainda vale.');
  } else {
    for (const h of headers) {
      const dentro = faixas.some((f) => h.num >= f.lo && h.num <= f.hi);
      if (!dentro) {
        erros.push(`FORA DE FAIXA: ${h.label} ("${h.title}", linha ${h.line}) não cai em nenhuma faixa declarada [${faixas.map((f) => `${f.lo}..${f.hi}`).join(', ')}]`);
      }
    }
  }

  // (3) CROSS-BRANCH (mesmo D-NNN, título diferente entre este ref e o default)
  const base = lerBaseDecisoes();
  if (!base) {
    avisos.push(`sem acesso ao branch default para a checagem cross-branch — pulada (rode com DECISIONS_BASE_REF apontando p/ um ref acessível).`);
  } else {
    const baseMap = new Map(parseDecisoes(base.texto).headers.map((h) => [h.label, h.title]));
    for (const h of headers) {
      const t = baseMap.get(h.label);
      if (t !== undefined && t !== h.title) {
        erros.push(`COLISÃO CROSS-BRANCH: ${h.label} tem título diferente aqui e no default (${base.ref}).\n    aqui:    "${h.title}"\n    default: "${t}"\n    → renumere para a faixa do seu chat (ver índice no topo do DECISIONS.md).`);
      }
    }
  }

  for (const a of avisos) console.warn(`[check-decisions] aviso: ${a}`);
  if (erros.length) {
    console.error(`\n[check-decisions] ${erros.length} violação(ões) de governança de decisões:\n`);
    for (const e of erros) console.error(`  ✗ ${e}`);
    console.error('\nO índice de faixas (topo de v2/DECISIONS.md) aloca D-001..099 ao principal, D-100..199 ao predict, D-200..299 à calibração. Cada chat só cria D-NNN na sua faixa.');
    process.exit(1);
  }
  console.log(`[check-decisions] OK — ${headers.length} decisões, ${faixas.length} faixa(s), zero colisão.`);
}

main();
