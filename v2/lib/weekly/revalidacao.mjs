// revalidacao.mjs — GATE de revalidação de vigência do Weekly (M3.1, SPEC-WEEKLY-MEMO).
// PURO, sem I/O. Fecha a lacuna que o operador cravou como não-negociável: o
// recheck atual do weekly-consolidate.mjs usa a vigência CONGELADA no JSON da
// Daily (isExpired(latest.vigencia, windowEnd)). Aqui, todo item que o Weekly
// vai exibir como ATIVO é revalidado contra o banco VIVO (`campaigns`) na DATA
// DE PUBLICAÇÃO — nada vencido na publicação pode sair como ativo.
//
// Junção por identidade canônica (tipo, origem, destino, publico), o mesmo eixo
// do matcher/selecionar. Determinismo-primeiro (INV-12): mesma entrada → mesmo
// veredito. Não reescreve seleção — só valida o que a consolidação já escolheu.

const ESTADOS_VIVO = ['ativa', 'detectada', 'ultimos_dias'];

/** Chave canônica de identidade. Aceita tanto item do Weekly quanto linha de campaigns. */
export function chaveIdentidade(x) {
  const origem = x.origem ?? x.origem_code ?? '';
  const destino = x.destino ?? x.destino_code ?? 'sem_destino';
  const publico = x.publico ?? '';
  return [x.tipo ?? '', origem, destino || 'sem_destino', publico].join('|');
}

/**
 * @param {object[]} itensAtivos  itens que o Weekly exibirá como ativos/vivos
 *   (ranking + segueVivo). Cada um precisa de tipo/origem/destino/publico.
 * @param {object} ctx
 * @param {string} ctx.dataPublicacao  YYYY-MM-DD (dia em que o Weekly sai)
 * @param {object[]} ctx.campaignsVivas  linhas de `campaigns` LIDAS AO VIVO no
 *   fechamento (não a vigência congelada do JSON). Cada uma com estado,
 *   vigencia_fim_date, e as colunas de identidade.
 * @returns {{pass:boolean, reprovados:Array<{item:object,motivo:string}>, log:object[]}}
 */
export function gateRevalidacaoVigencia(itensAtivos = [], { dataPublicacao, campaignsVivas = [] } = {}) {
  const pubMs = Date.parse(dataPublicacao);
  if (Number.isNaN(pubMs)) throw new Error(`gateRevalidacaoVigencia: dataPublicacao inválida: ${dataPublicacao}`);

  const idx = new Map();
  for (const c of campaignsVivas) idx.set(chaveIdentidade(c), c);

  const reprovados = [];
  const log = [];
  for (const item of itensAtivos) {
    const k = chaveIdentidade(item);
    const c = idx.get(k);

    if (!c) {
      reprovados.push({ item, motivo: 'sem correspondência viva no banco na data de publicação' });
      log.push({ chave: k, ok: false, motivo: 'sem_match_vivo' });
      continue;
    }
    const vigMs = c.vigencia_fim_date ? Date.parse(c.vigencia_fim_date) : null;
    const estadoVivo = ESTADOS_VIVO.includes(c.estado);

    if (vigMs !== null && !Number.isNaN(vigMs) && vigMs < pubMs) {
      reprovados.push({ item, motivo: `vigência ${c.vigencia_fim_date} vencida antes da publicação ${dataPublicacao}` });
      log.push({ chave: k, ok: false, motivo: 'vencida', vigencia: c.vigencia_fim_date });
    } else if (!estadoVivo) {
      reprovados.push({ item, motivo: `estado não-vivo no banco na publicação: ${c.estado}` });
      log.push({ chave: k, ok: false, motivo: 'estado_nao_vivo', estado: c.estado });
    } else {
      log.push({ chave: k, ok: true, vigencia: c.vigencia_fim_date ?? null, estado: c.estado });
    }
  }
  return { pass: reprovados.length === 0, reprovados, log };
}
