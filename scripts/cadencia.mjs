// cadencia.mjs — persistência do artefato diário (MODO C: disco + revisão, SEM
// envio). Grava o render FIEL da edição (o mesmo `renderEmail`, schema v4 inteiro)
// num caminho VERSIONADO e mantém a tabela de cadência no ledger markdown. A rota
// /revisao/N serve exatamente estes bytes — o operador VÊ sem rodar nada.
//
// A LÓGICA de upsert da tabela é pura (`upsertLinhaCadencia`) e testada; aqui o
// plumbing de I/O só lê/escreve arquivo.
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';

export const RENDERS_DIR = 'content/renders';
const LEDGER = 'content/m2-cadencia-ledger.md';
const START = '<!-- CADENCIA:START -->';
const END = '<!-- CADENCIA:END -->';
const HEADER = '| Data (BRT) | Nº | Gate | Render (revisão) | Revisão do operador |';
const SEP = '|------------|----|------|------------------|---------------------|';

// Grava o render de revisão num caminho versionado (content/renders/NNNN.html).
// Retorna o caminho do arquivo. Só chamado em gate VERDE — dia sem edição válida
// não gera artefato de revisão (regra 3: nada de verde artificial).
export function persistirRenderRevisao({ ed, html, dir = RENDERS_DIR }) {
  mkdirSync(dir, { recursive: true });
  const caminho = `${dir}/${String(ed.number).padStart(4, '0')}.html`;
  writeFileSync(caminho, html);
  return caminho;
}

const reData = /(\d{4}-\d{2}-\d{2})/;

// Upsert PURO de uma linha na tabela entre os marcadores CADENCIA. Chave = data.
// PRESERVA a coluna "Revisão do operador" de uma linha já existente (nunca
// sobrescreve a marca humana); linha nova entra "pendente". Ordena por data asc.
// Idempotente: mesma entrada → mesmo markdown.
export function upsertLinhaCadencia(md, { date, weekday, number, gatePass, renderLink }) {
  const i = md.indexOf(START);
  const j = md.indexOf(END);
  if (i < 0 || j < 0 || j < i) throw new Error('ledger: marcadores CADENCIA ausentes/invertidos');
  const antes = md.slice(0, i + START.length);
  const depois = md.slice(j);
  const bloco = md.slice(i + START.length, j);

  const linhas = bloco.split('\n').map((l) => l.trim()).filter((l) => l.startsWith('|'));
  const dados = linhas.filter((l) => !/^\|\s*Data/.test(l) && !/^\|[-\s|]+\|$/.test(l));
  const porData = new Map();
  for (const l of dados) {
    const m = l.match(reData);
    if (m) porData.set(m[1], l);
  }

  const rotulo = weekday ? `${date} (${weekday})` : date;
  const gate = gatePass ? '🟢 VERDE' : '🔴 RED';
  const render = renderLink ? `[/revisao/${number}](${renderLink})` : '—';
  let revisao = 'pendente';
  const existente = porData.get(date);
  if (existente) {
    const cells = existente.split('|').map((c) => c.trim());
    if (cells[5]) revisao = cells[5]; // ['', data, nº, gate, render, revisão, '']
  }
  porData.set(date, `| ${rotulo} | ${number} | ${gate} | ${render} | ${revisao} |`);

  const ordenadas = [...porData.entries()]
    .sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0))
    .map(([, l]) => l);
  const novoBloco = `\n${HEADER}\n${SEP}\n${ordenadas.join('\n')}\n`;
  return `${antes}${novoBloco}${depois}`;
}

// Registra o dia no ledger (I/O). renderLink = `/revisao/N` no verde, null no red.
export function registrarCadencia({ ed, veredito, renderLink, hoje, ledgerPath = LEDGER }) {
  if (!existsSync(ledgerPath)) return { atualizado: false, motivo: 'ledger ausente' };
  const md = readFileSync(ledgerPath, 'utf8');
  const novo = upsertLinhaCadencia(md, {
    date: ed.date || hoje,
    weekday: ed.weekday,
    number: ed.number,
    gatePass: Boolean(veredito?.pass),
    renderLink,
  });
  if (novo !== md) writeFileSync(ledgerPath, novo);
  return { atualizado: novo !== md };
}
