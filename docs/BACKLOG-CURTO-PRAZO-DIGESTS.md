# Backlog acionável — curto prazo das digests

> Deriva das "Oportunidades de curto prazo" (§14.3) do
> [`DIAGNOSTICO-DIGESTS-DAILY-WEEKLY.md`](./DIAGNOSTICO-DIGESTS-DAILY-WEEKLY.md).
> São itens de **alto valor / baixo esforço** que usam o que já existe. Cada card
> traz problema, mudança, arquivos, critério de aceite, esforço e risco.
>
> Esforço: **P** (≤meio dia) · **M** (1–2 dias) · **G** (3–5 dias).
> Nenhum card quebra regra inviolável nem altera o julgamento editorial — todos
> mantêm "máquina calcula, humano aprova, e-mail só por ação humana".

## Visão geral (ordenado por valor/esforço)

| # | Card | Esforço | Risco | Depende de |
|---|---|---|---|---|
| CP-1 | Cron do forecast + frescor visível no Radar | M | Baixo | — |
| CP-2 | `scoreBreakdown` obrigatório quando há `tlScore` | P | Baixo | — |
| CP-3 | Derivar `movements` da Weekly do ledger | M | Médio | — |
| CP-4 | Ranking de oportunidades vigentes na Weekly (lineage) | M | Baixo | CP-3 (opcional) |
| CP-5 | Extrair radar duplicado p/ `lib.mjs` | P | Baixo | — |
| CP-6 | Corrigir nome da marca entre superfícies | P | Baixo | — |
| CP-7 | Alinhar landing à realidade (Lab/Pro/persona) | P | Baixo | decisão do dono |

Sequência recomendada: **CP-6 → CP-5 → CP-2 → CP-1 → CP-3 → CP-4 → CP-7**
(mecânicos e sem dependência primeiro; os de dado/produto depois).

---

## CP-1 — Cron do forecast + carimbo de frescor visível no Radar

**Problema.** O `content/forecast.json` que a Weekly publica é gerado **à mão**
(`npm run forecast`, sem cron). A auditoria interna encontrou o snapshot desatualizado
(gerado com 119 linhas de ledger enquanto o banco tinha ~2.438). Há gate de frescor
(≤24h) que **corta o radar em silêncio**, mas o leitor nunca sabe quando o dado é de
quando.

**Mudança proposta.**
1. Novo workflow `.github/workflows/forecast.yml`: `schedule` diário (antes da janela
   editorial da manhã) + `workflow_dispatch`, rodando `npm run forecast`. Sem credenciais
   Supabase → modo offline (preserva o artefato), como já faz o script.
2. Commit/artefato do `forecast.json` atualizado (ou escrita no destino que o render lê).
3. **Frescor visível**: no bloco Radar (daily e weekly), acrescentar linha discreta
   "baseado em N campanhas · atualizado há Xh" a partir de `generatedAt`/`ledgerRows`
   do artefato.

**Arquivos.** `.github/workflows/forecast.yml` (novo); `scripts/forecast.mjs` (já
escreve o artefato — só orquestrar); `scripts/render.mjs` e `scripts/render-weekly.mjs`
(bloco radar); `scripts/lib.mjs` (helper de "há Xh" e texto do frescor);
`scripts/forecast-freshness.mjs` (reusar `generatedAt`/idade).

**Critério de aceite.**
- Rodada agendada regenera o artefato sem intervenção; em modo offline não sobrescreve.
- Daily e Weekly exibem amostra + idade do dado no Radar.
- Se o artefato ficar não-fresco, o comportamento atual (cortar radar) é preservado —
  mas agora com o motivo logado no QA.
- `npm run validate` / `npm run qa` seguem verdes.

**Esforço** M · **Risco** Baixo (não muda julgamento; só automatiza e informa).
**Nota:** não resolve a acurácia (isso é o motor `predict`, médio prazo) — só o frescor.

---

## CP-2 — `scoreBreakdown` obrigatório quando há `tlScore`

**Problema.** A checagem `Σ(peso·critério) == tlScore` só roda `if (d.scoreBreakdown)`
(`scripts/validate.mjs:104`), e o schema torna `scoreBreakdown` **opcional**
(`content/edition.schema.json:112`). Um deal pode declarar `tlScore: 88` sem decompor —
o número passa sem qualquer verificação de composição. Isso contradiz o invariante
"o Score é explicável por construção, nunca um número opaco".

**Mudança proposta.** Regra: **todo deal com `tlScore` (≠ `nao-confirmado`) deve trazer
`scoreBreakdown`**. Implementar no validador (não só no schema, para dar mensagem de
erro clara). `nao-confirmado` (sem score) segue isento.

**Arquivos.** `scripts/validate.mjs` (erro quando há `tlScore` e falta breakdown);
`content/edition.schema.json` (documentar a condicionalidade — JSON Schema puro não
expressa "obrigatório se outro campo existe" de forma simples, então a regra dura fica
no validador); edições `0027`/`0028` (0027 tem `tlScore: 76` **sem** breakdown → precisa
receber o breakdown para não quebrar o gate).

**Critério de aceite.**
- Deal com `tlScore` e sem `scoreBreakdown` → erro bloqueante com mensagem explícita.
- Deal `nao-confirmado` sem score → passa.
- 0027 atualizada com breakdown coerente (soma fecha com 76).
- Teste novo cobrindo os dois caminhos.

**Esforço** P · **Risco** Baixo. **Efeito colateral desejado:** força o score a ser
sempre auditável — pré-requisito para, no futuro, calcular o TL Score por código.

---

## CP-3 — Derivar `movements` da Weekly do ledger (parar de redigir do zero)

**Problema.** Nenhum código lê as campanhas da semana para montar os `movements`
(Abriram/Seguem/Encerraram) da Weekly — hoje são **escritos à mão** no JSON. Não escala
e não é rastreável às edições/ao ledger.

**Mudança proposta.** Script/etapa que lê o ledger de campanhas (status já existe:
`vencida`/`vence-72h`/`continua`) e/ou as edições da semana (`content/editions/*.json`
com `date` dentro de `dateStart..dateEnd`) e monta um rascunho de `movements`:
- `novas` = campanhas com `vigencia_inicio` na semana;
- `venceram` = `vigencia_fim` na semana;
- `seguem` = vigentes que atravessam a semana.
Saída como **sugestão para o editor** (o humano ainda cura o texto), não publicação
automática — mantém a fronteira editorial.

**Arquivos.** Novo `scripts/weekly-movements.mjs` (derivação); `scripts/render-weekly.mjs`
(consumir `movements` quando presentes; sem mudança de contrato); opcional bloco no
`/admin` para revisar a sugestão.

**Critério de aceite.**
- Dado um período, o script emite `movements` coerentes com o ledger/edições.
- O editor pode sobrescrever (o JSON manual continua tendo precedência).
- Cria a primeira ponte real **Daily → Weekly**.

**Esforço** M · **Risco** Médio (depende da qualidade do dado do ledger; ver dívidas de
dedup/idade no diagnóstico — por isso a saída é *sugestão*, não publicação).

---

## CP-4 — Ranking de oportunidades vigentes na Weekly (trazer o lineage do Pro)

**Problema.** A landing promete no Weekly "**ranking de oportunidades ainda vigentes**",
que o Weekly real (W29) não tem. O Pro **já faz** isso via `derivedFrom` (lineage
edição→deal→veredito→`tlScore` em `content/pro-report.schema.json`).

**Mudança proposta.** Bloco opcional `ranking` no Weekly: lista dos deals da semana
ainda vigentes, ordenados por `tlScore` (e, quando houver, por confiança/acionabilidade),
com veredito e link à edição de origem — reaproveitando o padrão `derivedFrom` do Pro.

**Arquivos.** `content/weekly.schema.json` (novo bloco `ranking[]` opcional, espelhando
`derivedFrom`); `scripts/render-weekly.mjs` (render do bloco nas 3 saídas); opcional
`scripts/weekly-movements.mjs` (CP-3) para também popular o ranking.

**Critério de aceite.**
- Weekly renderiza um ranking de vigentes com score + origem quando o bloco existe.
- Ausente → nada muda (retrocompatível).
- Entrega parte concreta da promessa da landing sem inventar dado.

**Esforço** M · **Risco** Baixo. **Depende de** CP-3 se quiser popular automático; dá
para começar manual.

---

## CP-5 — Extrair o radar duplicado para `lib.mjs`

**Problema.** O HTML do bloco Radar está **duplicado** entre `scripts/render.mjs`
(daily, ~L76–94) e `scripts/render-weekly.mjs` (weekly, ~L94–110) — mesma marcação,
manutenção em dobro, risco de divergência.

**Mudança proposta.** Extrair um helper único (ex.: `renderRadarBlock(radar)`) para
`scripts/lib.mjs` e consumir nos dois renders. Sem mudança visual.

**Arquivos.** `scripts/lib.mjs` (helper); `scripts/render.mjs`; `scripts/render-weekly.mjs`;
opcional `scripts/render-web.mjs` (versão web também).

**Critério de aceite.**
- Saída de e-mail/plain/web **byte-idêntica** antes/depois (ou diff só de whitespace),
  verificável pelo manifest sha256 do `render-system`.
- Um só ponto de manutenção do radar.

**Esforço** P · **Risco** Baixo (refactor puro, coberto por auditoria de artefato).

---

## CP-6 — Corrigir o nome da marca entre superfícies

**Problema.** O plain-text da Daily imprime **"THE LOYALTY"** (`scripts/render.mjs:137`)
e o web usa **"The Loyalty"** (`scripts/render-web.mjs:61` e fallbacks), enquanto e-mail
e Weekly usam **"The Loyal"**. A marca é **The Loyal** (CLAUDE.md/landing). Inconsistência
visível ao leitor.

**Mudança proposta.** Padronizar para **"The Loyal"** em todas as superfícies (confirmar
antes se algum "The Loyalty" é intencional — a hierarquia de docs cita
`THE-LOYALTY-LLM-SYSTEM.md`, mas isso é nome de documento interno, não da marca ao leitor).

**Arquivos.** `scripts/render.mjs` (masthead do plain-text); `scripts/render-web.mjs`
(título/subject fallback); varredura por `The Loyalty`/`THE LOYALTY` nas superfícies de
saída.

**Critério de aceite.**
- Todas as superfícies (e-mail, plain, web, weekly) exibem "The Loyal".
- QA verde; nenhum uso de "The Loyalty" em conteúdo voltado ao leitor.

**Esforço** P · **Risco** Baixo. **Ação do dono:** confirmar que não há uso intencional.

---

## CP-7 — Alinhar a landing à realidade do produto

**Problema.** A landing (`COPY-LANDING.md` / `components/sections.tsx`) anuncia:
- **The Loyal Lab** como "Incluído" — **não existe no código**;
- **The Loyal Pro** como "Em breve" — **já está implementado** (schema, render, VPM);
- no Weekly, "**estratégia por perfil**" — o produto não tem personalização por persona.

**Mudança proposta (requer decisão do dono — 3 opções, não mutuamente exclusivas):**
1. **Ajustar a copy** para o estado real (Lab "em breve" ou fora; Pro "beta" em vez de
   "em breve"; Weekly sem prometer persona até CP-4/persona existir). *Menor esforço.*
2. **Priorizar o que já está pronto** (revelar o Pro) e segurar o que não está (Lab).
3. **Assumir a promessa como roadmap** e sequenciar (persona → CP-4; Lab → médio prazo).

**Arquivos.** `components/sections.tsx` (seção "O que você recebe" e "Para quem é"),
`COPY-LANDING.md` (fonte da cópia). Mudança de UI segue regras de marca (tokens, sem
hex, AA) — passa por `npm run qa`.

**Critério de aceite.** Nenhuma afirmação da landing sem correspondente no produto (ou
claramente marcada como "em breve"). Decisão registrada.

**Esforço** P (copy) · **Risco** Baixo. **Bloqueio:** depende da direção que o dono
escolher (é decisão de produto, não técnica).

---

## Fora do curto prazo (ponteiros)

Os itens de **médio prazo** (promover o `predict` backtestado a fonte do Radar; corrigir
dado a montante — dedup com URL, filtro de idade, reconciliação forecast×predict;
clusters como unidade editorial; versão executiva/curta; persona) e a **visão futura**
(régua híbrida por risco, digest adaptativa, sazonalidade/anomalia, Lab como trilha,
auditoria por amostragem) estão descritos em §14.3 do diagnóstico. Vários **dependem de
correção de dado** e de **medir acurácia** antes de expor previsão — por isso não entram
no curto prazo.
