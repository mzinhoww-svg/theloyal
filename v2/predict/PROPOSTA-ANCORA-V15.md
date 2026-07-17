# Proposta — âncora de ano (edge fn `campaigns` v15), para o PRINCIPAL deployar

> **Proposta do chat de predict, NÃO deployada.** Pela regra de escrita única, **quem
> deploya a edge fn é o chat principal** (dono da v14 em produção). O predict entrega o
> patch da âncora como incremento sobre a v14-shadow; o principal integra e deploya v15.
> Nada aqui foi aplicado.

## Por que — o que a v14 tem e o que falta

A v14-shadow (principal, deployada) **flaga mas não previne**: persiste `published_at`,
grava `date_suspect` (±65d ao redor de múltiplo de ano) e `dedup_key` em shadow. Mas o
`analyze(text)` **não passa `published_at` ao prompt** — o LLM continua sem âncora de ano e
segue fabricando o ano; a v14 só marca depois. **A prevenção na origem (a peça de maior
alavanca) está faltando.** Este é o incremento do predict.

## Patch 1 — âncora de ano no prompt (a prevenção)

Sobre a v14, alterar `analyze` para receber e injetar a data de publicação:

```ts
function yearAnchor(publishedAt: string | null): string {
  if (!publishedAt || !/^\d{4}-\d{2}-\d{2}/.test(publishedAt)) return "";
  return `\n\nData de publicacao desta noticia: ${publishedAt.slice(0, 10)}. `
    + `Use-a como ancora de ano: se o texto nao trouxer o ANO explicito da vigencia, `
    + `use o ano coerente com a publicacao. NUNCA gere vigencia_inicio/vigencia_fim `
    + `anterior a data de publicacao por mais de 30 dias, a menos que o texto diga `
    + `explicitamente que a campanha e antiga. Na duvida sobre o ano, use null e confianca "baixa".`;
}

// analyze(text) → analyze(text, publishedAt); no corpo:
//   { role: "user", content: text.slice(0, 12000) + yearAnchor(publishedAt) }
// no call site (processItem):
//   const { json, usage } = await analyze(text, it.published_at ?? null);
```

Não muda `makeId`, não muda chave de upsert, não muda schema. Ataca a raiz sem risco de
regressão estrutural (o caminho `daily`, já limpo, não piora por receber a âncora).

## Patch 2 — reconciliação do flag (combinar as duas coberturas)

A v14 usa `eventDateLooksFabricated(eventDate, prov)` = gap ≈ N×365 **±65d**. Isso pega o
**year-shift exato** (731d, 2190d) mas **perde os gaps sujos**: o canônico `livelo→connectmiles`
(943d, fica a 152d de 3×365), os +1yr de 608/581d, o daily sujo de 852d. O predict tem o
guard `>365d` (pega todos, mais recall, mais risco de falso-positivo). **Reconciliação
proposta — combinar (OU):**

```ts
// date_suspect = fabricado por padrão de ano OU evento muito antes da fonte
const gap = daysBetween(eventDate, provenance);
const dateSuspect = eventDateLooksFabricated(eventDate, provenance)   // ±65d de N×365 (v14)
                 || gap > 365;                                        // gap grande (predict)
```

Isso mantém a precisão do sinal de year-shift **e** captura os gaps sujos que hoje escapam
(incluindo o canônico 943d). O limiar 365d e o ±65d são ambos **de partida, calibráveis
pelo Agente 3** (ADR-RADAR-010). A lógica `>365d` de referência está em
`v2/lib/temporal-plausibility.mjs` (golden: `…test.mjs`, 20/20).

**Consumo:** os motores (`lib/forecast.ts`, `lib/predict-engine.ts`) precisam **excluir da
série** as linhas com `date_suspect=true` (equivalente ao `include_in_prediction=false` —
marca e exclui, não deleta, D-042). Confirmar/ligar esse filtro é parte da integração do
principal.

## Ordem (protocolo + escrita única)

1. Principal integra os patches 1 e 2 na v14 → **v15**, e deploya (dono da edge fn).
   Preservar `verify_jwt=false` (como a v14) para não quebrar o cron.
2. **Teste dos dois lados** antes do deploy: os `daily` limpos não regridem (gate
   bloqueante) + os `auto` quebrados são pegos/prevenidos.
3. **Mede em produção:** notícias novas pós-v15 nascem com ano válido (`yr_off≥1 → ~0`) e a
   taxa de `date_suspect` nas novas. Só então a **origem está estancada**.
4. Estancada a origem, o predict aplica a **reconstrução histórica** (regra apertada,
   fronteira 12 — já aprovada), com inscrição prévia + trava de anomalia.

## O que NÃO fazer

Não deployar do predict (não é o dono). Não misturar a Fase 1b (dedup por identidade, muda
`id`) neste deploy — é slice posterior coordenada com o M1.
