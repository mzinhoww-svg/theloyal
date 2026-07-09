// Gera o relatorio de QA (markdown) da edicao renderizada.
export function renderQA(ed, result, files) {
  const m = ed.meta || {};
  const ok = (b) => (b ? "OK" : "FALTA");
  const has = (k) => ed[k] != null && (Array.isArray(ed[k]) ? ed[k].length > 0 : String(ed[k]).length > 0);
  const st = result.stats || {};
  const L = [];
  L.push(`# QA . The Loyal Daily${m.numero ? ` . No ${m.numero}` : ""}`, "");
  L.push(`Status: ${result.errors.length ? "REPROVADO (" + result.errors.length + " erro(s))" : "APROVADO"}`, "");

  if (result.errors.length) { L.push("## Erros (bloqueiam o envio)"); for (const e of result.errors) L.push(`- ${e}`); L.push(""); }
  if (result.warnings.length) { L.push("## Avisos"); for (const w of result.warnings) L.push(`- ${w}`); L.push(""); }

  L.push("## Blocos obrigatorios");
  for (const [k, label] of [["sinal_do_dia", "Sinal do dia"], ["deal_desk", "Deal Desk"], ["conta_feita", "Conta feita"], ["fecha_logo", "Fecha logo"], ["o_que_evitaria", "O que evitaria"], ["disclaimer", "Disclaimer"], ["footer", "Footer"]])
    L.push(`- [${ok(has(k))}] ${label}`);
  L.push("");

  L.push("## Limites");
  L.push(`- [${ok(st.deals <= 3)}] Deal Desk ${st.deals}/3`);
  L.push(`- [${ok((st.program_watch || 0) <= 5)}] Program Watch ${st.program_watch || 0}/5`);
  L.push(`- [${ok((st.bank_cards_watch || 0) <= 5)}] Bank & Cards ${st.bank_cards_watch || 0}/5`);
  L.push(`- [${ok((st.retail_coalition || 0) <= 5)}] Retail & Coalition ${st.retail_coalition || 0}/5`);
  L.push(`- [${ok((st.sinais_rapidos || 0) <= 5)}] Sinais rapidos ${st.sinais_rapidos || 0}/5`);
  L.push("");

  L.push("## Integridade");
  L.push(`- [${ok(st.tem_conta)}] Conta feita com formula em mono`);
  L.push(`- [${ok(st.tem_disclaimer)}] Disclaimer presente`);
  L.push(`- [${ok(!result.errors.some((e) => e.includes("Ponto")))}] Mascote fora de blocos analiticos`);
  L.push(`- [${ok(!result.errors.some((e) => e.includes("emoji")))}] Sem emoji`);
  L.push(`- [${ok(!result.errors.some((e) => e.includes("interno") || e.includes("CMI")))}] Sem dado interno / CMI`);
  L.push("");

  if (files?.length) { L.push("## Arquivos gerados"); for (const f of files) L.push(`- ${f}`); L.push(""); }
  return L.join("\n");
}
