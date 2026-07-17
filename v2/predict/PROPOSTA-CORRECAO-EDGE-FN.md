# Proposta — correção da origem (edge fn `campaigns`) · PRIORIDADE 1

> **Proposta, NÃO aplicada.** Nada foi deployado. Este documento é o primeiro portão de
> aprovação (D-041): você revisa → dry-run/teste → deploy → verifica amostra pós-deploy.
> Só depois da origem estancada é que a reconstrução do histórico (2º portão) roda.
> Diretriz que atravessa tudo: **não pode regredir o caminho `daily`, que está limpo hoje.**

## 1. Causa, em uma frase (confirmada no código v13)

A edge fn manda ao LLM **só o texto** (`text.slice(0,12000)`), **sem a data de publicação**, e grava `vigencia_fim` **sem nenhuma validação** (`edge-function-campaigns.md`: "Validação das datas: NENHUMA"). Sem âncora de ano, o modelo fabrica/atrasa o ano; a data errada entra no `id` (`makeId` embute `vigencia_fim`), e a mesma campanha relida com outra data vira **linha nova** (raiz dos 943 dias).

## 2. As mudanças, separadas por risco (deploy em duas fases)

### Fase 1a — ESTANCA o sangramento (baixo risco, sem mudar chave/schema — deploy primeiro)

Ataca a raiz (âncora de ano) e marca o que ainda escapar. **Não muda `id`, não muda upsert, não mexe em linha existente.** Seguro para o `daily`.

**(i) Passar `published_at` ao prompt como âncora de ano.** É a mudança de maior alavanca e a mais barata. No `analyze`, injetar a data de publicação e a regra de ancoragem:

```ts
// processItem passa it.published_at para analyze()
async function analyze(text: string, publishedAt: string | null) {
  const anchor = publishedAt
    ? `\n\nData de publicacao desta noticia: ${publishedAt}. Use-a como ancora de ano: `
      + `se o texto nao trouxer o ANO explicito da vigencia, use o ano coerente com a `
      + `publicacao. NUNCA gere vigencia_inicio/vigencia_fim ANTERIOR a data de publicacao `
      + `por mais de 30 dias, a menos que o texto diga explicitamente que a campanha e antiga `
      + `(ex.: "aconteceu em", "no ano passado"). Na duvida sobre o ano, use null e confianca "baixa".`
    : "";
  // ... messages: [{system}, {user: text.slice(0,12000) + anchor}]
}
```
Isto conserta a causa na entrada: o modelo passa a ter a proveniência que faltava. O `daily` (já limpo) não regride — dar a âncora a uma extração que já acerta não a piora.

**(ii) Validação de plausibilidade pós-extração (flag, NÃO autocorrige — ADR-RADAR-010/INV-16).** Antes do upsert, comparar a data de evento com `published_at` e **marcar** o suspeito, sem reescrever a data e sem autocorrigir:

```ts
function temporalFlag(vigFim: string, vigIni: string | null, publishedAt: string | null): {
  status: "valid" | "suspect_year" | "event_after_source"; includeInPrediction: boolean;
} {
  if (!publishedAt || vigFim === "na" || !/^\d{4}-\d{2}-\d{2}$/.test(vigFim))
    return { status: "valid", includeInPrediction: true }; // sem base p/ julgar → não bloqueia por si
  const evento = vigIni && /^\d{4}-\d{2}-\d{2}/.test(vigIni) ? vigIni.slice(0,10) : vigFim;
  const dEvento = Date.parse(evento + "T00:00:00Z");
  const dPub = Date.parse(publishedAt.slice(0,10) + "T00:00:00Z");
  const days = (dPub - dEvento) / 864e5;
  if (days > 365) return { status: "suspect_year", includeInPrediction: false }; // evento >1 ano antes da fonte
  if (days < -30) return { status: "event_after_source", includeInPrediction: true }; // informativo
  return { status: "valid", includeInPrediction: true };
}
```
O suspeito **não some**: entra com `temporal_status='suspect_year'`, `include_in_prediction=false`, e cai na fila de reprocessamento/revisão (D-042: marca e exclui da série, **não deleta**). O limiar 365 d é **de partida** — é alvo de calibração do Agente 3 (ADR-RADAR-010, não congela o número).

**(iii) Coluna aditiva para carregar o flag.** Migration **aditiva** (segura, não destrutiva): `alter table campaigns add column if not exists temporal_status text default 'valid', add column if not exists include_in_prediction boolean default true;`. Os motores passam a filtrar `include_in_prediction=true` (mudança separada, no chat de predict, coordenada com a slice de plausibilidade).

### Fase 1b — dedup por identidade estável (risco maior; migration + coordenação com M1 — deploy depois de 1a validada)

**Esta é a parte que interage com a fundação e por isso é separada.** Hoje `makeId` embute `vigencia_fim`; tirar a data do `id` muda a **chave de upsert** de uma tabela viva de ~3.600 linhas que os motores, o admin e a canonicalização já referenciam. Não é um patch de uma linha.

- **Não inventar dedup novo.** O M1 já construiu `campanha_identidade` + `campanha_versoes` (mudança de % = evento) + `identidade.mjs` (D-033). A correção certa é a edge fn **escrever através da identidade canônica do M1**, não gerar um `id`-com-data paralelo. Prorrogação (nova `vigencia_fim`, mesma campanha) vira **evento em `campanha_versoes`**, não linha nova — mata os 943 dias na origem.
- **Requer migration de repontagem** (mapear ids-com-data existentes → identidade canônica) e **coordenação com o dono da identidade M1**. Proposta: fazer 1b como slice própria, com seu dry-run e sua trava, **depois** de 1a estar no ar e verificada. Tentar 1a+1b juntas num deploy só aumenta o risco sobre pipeline vivo sem necessidade — 1a já estanca.

## 3. Plano de teste (dos dois lados — conserta o quebrado sem quebrar o são)

Antes de qualquer deploy, rodar a edge fn corrigida (local/preview, sem gravar em produção) contra um conjunto fixo:

| Grupo | Fonte | Resultado esperado |
|---|---|---|
| **Daily limpo (não-regressão)** | ~15 casos `origin='daily'` que hoje nascem coerentes (`yr_off=0`) | Continuam `valid`, mesma data, mesmo comportamento. **Zero regressão.** |
| **Auto quebrado (conserta)** | ~15 casos `origin='auto'` com `yr_off≥1` (inclui `esfera→connectmiles fev25/set25`) | Com a âncora, nascem com ano coerente; o que ainda escapar vira `suspect_year` (não `valid` com data errada). |
| **Caso canônico** | `livelo→connectmiles` "último dia (12)" sem token de ano | `suspect_year`, `include_in_prediction=false`, **NÃO autocorrigido**. |
| **Permanente / sem data** | `vigencia_fim="na"`; notícia sem data | `valid` (permanente) / confiança baixa — sem falso `suspect_year`. |

**Pós-deploy (produção):** medir uma **amostra de notícias novas** processadas após o deploy — a taxa de `yr_off≥1` em `origin='auto'` deve cair para ~0. Se não cair, rollback e re-diagnóstico. Este é o critério objetivo de "a origem foi estancada".

## 4. O que fica para sua aprovação (nada aplicado)

- [ ] **Fase 1a** (âncora no prompt + flag de plausibilidade + migration aditiva do flag) como o deploy que estanca — baixo risco, primeiro.
- [ ] O **limiar 365 d** como ponto de partida (calibrável pelo Agente 3, não congelado).
- [ ] **Fase 1b** (dedup via identidade M1 + `id` sem data) como **slice própria e posterior**, com migration de repontagem e coordenação com a identidade do M1 — não no mesmo deploy de 1a.
- [ ] O **plano de teste** dos dois lados (daily limpo + auto quebrado) como gate pré-deploy, e a **amostra pós-deploy** como critério de sucesso.

Aprovada a 1a, eu implemento o `index.ts` corrigido + a migration aditiva, rodo o plano de teste e trago o resultado antes de propor o deploy. **Nenhum deploy nem escrita sem sua palavra.**
