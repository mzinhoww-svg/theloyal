// medir-numero-orfao.mjs — mede o VOLUME HISTÓRICO de sínteses com número órfão
// (INV-25 · DELTA). Read-only: lê news_raw (title, content, summary) via REST e
// roda o MESMO `numerosSemLastro` do crivo sobre cada síntese já gravada. Não
// escreve nada — só reporta quantas teriam número sem lastro (incl. as do Clipping
// vivo). Sem creds → aborta avisando (não inventa número).
//
// Uso: SUPABASE_URL=… SUPABASE_SERVICE_ROLE_KEY=… node scripts/medir-numero-orfao.mjs [--limit N]
import { numerosSemLastro } from '../v2/lib/digest/sintese-clipping.mjs';

async function main() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) {
    console.error('[medir] sem SUPABASE_URL / SERVICE_KEY no ambiente — nada a medir (não invento volume).');
    process.exit(2);
  }
  const limIdx = process.argv.indexOf('--limit');
  const limit = limIdx >= 0 ? Number(process.argv[limIdx + 1]) : 5000;

  const q = `news_raw?summary=not.is.null&select=id,source,title,content,summary&limit=${limit}`;
  const r = await fetch(`${url}/rest/v1/${q}`, { headers: { apikey: key, authorization: `Bearer ${key}` } });
  if (!r.ok) throw new Error(`REST news_raw ${r.status}: ${(await r.text()).slice(0, 200)}`);
  const rows = await r.json();

  let comOrfao = 0;
  const exemplos = [];
  for (const n of rows) {
    const fonte = `${n.title ?? ''}\n${n.content ?? ''}`;
    const orfaos = numerosSemLastro(n.summary ?? '', fonte);
    if (orfaos.length) {
      comOrfao++;
      if (exemplos.length < 10) exemplos.push({ id: n.id, source: n.source, orfaos, summary: String(n.summary).slice(0, 160) });
    }
  }
  const total = rows.length;
  console.log(`[medir] sínteses analisadas: ${total}`);
  console.log(`[medir] com número órfão (INV-25): ${comOrfao} (${total ? ((comOrfao / total) * 100).toFixed(1) : '0'}%)`);
  for (const e of exemplos) {
    console.log(`  · ${e.id} [${e.source}] órfãos=${JSON.stringify(e.orfaos)} :: "${e.summary}"`);
  }
}

main().catch((e) => { console.error(`[medir] Erro: ${e.message ?? e}`); process.exit(1); });
