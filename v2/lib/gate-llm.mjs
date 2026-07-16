// Gate de rejeição — camada B (julgamento por LLM). Determinismo-primeiro: só chega
// aqui o que a camada A não resolveu. A LLM JULGA e CITA; nunca calcula número.
//
// Produção: Edge Function chama a LLM com PROMPT_B + SCHEMA_B (structured output).
// Medição desta slice: judgeOffline() é UM passe de Claude (referência offline), não
// a LLM viva — os números in-sample precisam de held-out + fila de revisão p/ confirmar.

export const CONF_MIN = 0.6; // abaixo disto → status='revisao' (abstenção, D-016)

export const PROMPT_B = `Você é o gate de rejeição do The Loyal. Recebe uma notícia que a camada
determinística NÃO conseguiu classificar. Decida se ela é uma CAMPANHA de fidelidade
(oferta/mudança de mecânica que o membro age: transferência bonificada, emissão, compra
de pontos, clube, status match, acúmulo, shopping) ou NÃO-CAMPANHA de um destes motivos:
- stunt_rp: marketing/PR/patrocínio/ops de companhia, sem oferta ao membro
- exemplo_resgate: exemplo/disponibilidade de resgate, tarifa; "economia %" que não é bônus
- cupom_varejo / tarifa_pacote_dinheiro / perk_sem_pontos / produto_blog (se a camada A não pegou)
Regras: JULGUE e CITE o trecho; NÃO invente número. Na dúvida, veredito='campanha' com
confidence baixa (o sistema manda para revisão, não descarta). Rejeitar campanha real é
o pior erro.`;

export const SCHEMA_B = {
  type: 'object', additionalProperties: false,
  required: ['veredito', 'confidence', 'evidencia'],
  properties: {
    veredito: { enum: ['campanha', 'rejeitar'] },
    motivo: { enum: ['stunt_rp', 'exemplo_resgate', 'cupom_varejo', 'tarifa_pacote_dinheiro', 'perk_sem_pontos', 'produto_blog', null] },
    evidencia: { type: 'string' },              // trecho que justifica
    confidence: { type: 'number', minimum: 0, maximum: 1 },
  },
};

// ── Passe de referência offline (um passe de Claude sobre os 7 que sobem para B) ──
// Confidences refletem a dificuldade real do julgamento (não são um alvo).
const VEREDITOS = {
  'azul-desconhecido-estrutural-2030-12-31':      { veredito: 'rejeitar', motivo: 'stunt_rp', confidence: 0.90, evidencia: 'patrocínio às Seleções (marketing, sem oferta ao membro)', flags: ['ambiguo_real'] },
  'delta-desconhecido-estrutural-2024-12-31':     { veredito: 'rejeitar', motivo: 'stunt_rp', confidence: 0.85, evidencia: 'define preços com base em IA (ops de cia)', flags: ['ambiguo_real'] },
  'qatar-desconhecido-estrutural-na':             { veredito: 'rejeitar', motivo: 'stunt_rp', confidence: 0.70, evidencia: 'retoma voos em Doha (ops); "facilita status" vago', flags: ['ambiguo_real'] },
  'latampass-desconhecido-compra-2024-09-29':     { veredito: 'rejeitar', motivo: 'exemplo_resgate', confidence: 0.65, evidencia: 'passagens a partir de R$148 ou 2.692 milhas (tarifa)', flags: ['ambiguo_real'] },
  'smiles-melhores destinos-compra-na':           { veredito: 'rejeitar', motivo: 'exemplo_resgate', confidence: 0.55, evidencia: 'voos a partir de 62 mil milhas (disponibilidade de resgate)', flags: ['ambiguo_real'] },
  'livelo-magalu-compra-na':                      { veredito: 'rejeitar', motivo: 'cupom_varejo', confidence: 0.85, evidencia: 'cupons Amazon e Magalu; origem livelo espúria', flags: ['regra_faltante'] },
  'mastercard-azul-compra-2024-11-26':            { veredito: 'rejeitar', motivo: 'cupom_varejo', confidence: 0.80, evidencia: 'cupom 25% Azul Viagens (Mastercard Surpreenda)', flags: ['regra_faltante'] },
  // borderline retido como campanha (promo real de programa; camada A abstém e sobe p/ cá)
  'latampass-smiles-transferencia-na':            { veredito: 'campanha', motivo: null, confidence: 0.60, evidencia: 'Smiles oferece 30% de desconto no resgate (promo do programa)', flags: ['borderline_resgate'] },
};

/**
 * @returns {{veredito:'campanha'|'rejeitar', motivo?:string, evidencia:string, confidence:number, flags?:string[]}}
 */
export function judgeOffline(id, _input) {
  if (VEREDITOS[id]) return VEREDITOS[id];
  // Default: passou a camada A e tem mecânica de pontos/milhas/cashback → campanha.
  return { veredito: 'campanha', motivo: null, evidencia: 'oferta de ponto/milha/cashback ao membro', confidence: 0.9, flags: [] };
}
