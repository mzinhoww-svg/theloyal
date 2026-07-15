# Plano de implementação — Consolidação Weekly ← Daily

**Versão 1.0 · Status: Draft (plano de execução) · Companheiro de DD-WEEKLY-001**

> Plano faseado para implementar `docs/design/weekly-daily-consolidation.md`.
> Ancorado no diagnóstico (as 6 premissas). Cada fase é **shippable isolada** e
> entrega valor mesmo se o restante do backlog nunca fechar.
> Regra-mãe do plano: **nada que dependa de TL Score calculado ou de nota de corte
> madura entra no caminho crítico.** Onde falta cálculo, o item é sugerido +
> aprovado por humano ou classificado "Não confirmado".

---

## 0. Como o plano se relaciona com o diagnóstico

| Premissa do diagnóstico | Como o plano trata |
|---|---|
| 1. Produto pré-operação em partes | Fases entregam valor incremental; nada exige o sistema completo. |
| 2. TL Score é digitado, não calculado | `ranking` usa chave **auditável** (valor confirmado + vigência), não o score cru; ordem é sugerida e **aprovada por humano**. |
| 3. Sem nota de corte madura | Nenhum bloco publica corte automático; gate de elegibilidade + curadoria. |
| 4. Motor que publica ≠ mede acurácia | Consolidador é **separado** do render (Fase 1); Fase 5 abre só a *costura* de export, sem acoplar. |
| 5. Weekly não consolida a Daily de forma automática/rastreável | Núcleo do plano: Fases 0–2 fecham isso, com lineage por item. |
| 6. Comunicação promete além do entregue | O plano só expõe o que é rastreável; "Não confirmado" onde falta dado. Sem leaderboard fake. |

**Dependências para fora deste plano (não bloqueiam):** TL Score calculado e
motor de acurácia são backlog próprio. O plano deixa **ganchos** prontos (chave de
ranking trocável; export de `verdictStart→verdictEnd`) para quando eles chegarem.

---

## 1. Sequência e princípio de corte

```
Fase 0  Contrato de dados      (schema aditivo + backfill)      ── fundação, sem UX
Fase 1  Motor de consolidação  (script read-only → draft.json)  ── valor interno
Fase 2  Schema v2 + render     (ranking, lineage, "O que vem")  ── valor ao leitor
Fase 3  Dedup de saída + gates (1 Fio/1 bloco, elegibilidade)   ── honestidade
Fase 4  Loop de curadoria      (draft → final, npm scripts)     ── operação
Fase 5  Costura de acurácia    (export de transições por Fio)   ── premissa 4
```

Corte de escopo: se só couberem 2 fases num ciclo, **Fase 0 + Fase 1** já fecham a
premissa 5 no nível de dados (consolidação automática e rastreável), mesmo sem
render novo — a Weekly passa a ser *montada* a partir da Daily, não digitada.

---

## 2. Fase 0 — Contrato de dados (fundação)

**Objetivo:** dar ao `deal` da Daily uma identidade estável para join entre
edições. Sem isto, nenhuma consolidação é automática.

**Mudanças (todas aditivas — não quebram edições existentes):**

1. `content/edition.schema.json` → `$defs/deal`: adicionar
   - `entityKey` (string, opcional) — chave canônica de `content/entities`.
   - `routeKey` (string, opcional) — `origem→destino` normalizado (alinha
     ADR-RADAR-009: identidade independente de `vigencia_fim`).
   - `firstSeen` (string ISO date, opcional) — 1ª aparição do fato.
2. `content/entity.schema.json` / `content/entities/` — garantir entradas para as
   entidades citadas nas edições vivas (Livelo, Smiles, Latam Pass, Esfera, Azul…).
3. `scripts/validate.mjs` — validar que `entityKey`, se presente, existe no
   registro; se `routeKey` presente, casa com `category`. **Ausência ⇒ warning,
   não erro** (deals legados continuam válidos).
4. Backfill: `content/editions/0027.json`, `0028.json` recebem `entityKey`/`routeKey`.

**Aceitação:**
- [ ] `npm run validate` passa com e sem os novos campos.
- [ ] Editions 27/28 têm `entityKey` resolvível.
- [ ] Teste em `tests/` cobrindo: deal sem `entityKey` (warning), com `entityKey`
      inexistente (erro), com `routeKey` divergente da `category` (erro).

**Risco/mitigação:** normalização de rota inconsistente → reusar exatamente a
normalização de `lib/forecast.ts` (não reimplementar).

---

## 3. Fase 1 — Motor de consolidação (`scripts/weekly-consolidate.mjs`)

**Objetivo:** produzir automaticamente um rascunho da Weekly a partir das Dailies
da semana, com lineage. **Read-only sobre as edições; separado do render** (premissa 4).

**Entradas:** `content/editions/*.json` da janela `[dateStart, dateEnd]`; a Weekly
anterior (`W-1`) para estado; `content/entities`; opcionalmente `content/forecast.json`.

**Algoritmo (espelha §3–§7 do design):**
1. Selecionar edições da semana.
2. Reconciliar cada `deal` → **Fio**: `entityKey` + `routeKey` + union-find de
   `lib/campaign-quality.ts` (`detectProbableDuplicates`/`pairScore`). **Reuso, não
   reimplementação.**
3. Estado semanal por Fio (NOVO / SEGUE / ENCERROU / VIROU / REABRIU) cruzando
   presença nesta semana × W-1 × `vigencia`.
4. Derivar:
   - `movements` (integral, determinístico);
   - candidatos de `highlights` (rankeados por transição de veredito, spread
     confirmado, salto de `tlScore`);
   - ordem de `ranking` (chave auditável: melhor valor confirmado dentro da
     vigência → desempate `tlScore` → frescor de fonte);
   - `watch` (a) radar `confidence ≥ baixa` + (c) vigência que cai na próxima semana.
5. Emitir `content/weekly/AAAA-Wnn.draft.json` com **lineage `{edition, deal}`** por item.

**Aceitação:**
- [ ] Rodar sobre 27+28 (semana sintética) produz draft com `movements` corretos
      (o `nao-confirmado` de 28 NÃO entra em `novas`/`ranking`; vai para `watch`).
- [ ] Fio com vigência passada aparece em `venceram`; Fio sem prova de encerramento
      NÃO vira `venceram` automático (caso-limite do §10).
- [ ] Determinístico (mesma entrada → mesma saída; ordenação estável).
- [ ] Zero dependência de `render-weekly.mjs`.
- [ ] Testes de reconciliação (2 deals do mesmo Fio → 1) e de estado.

**Entregável isolado:** já fecha a premissa 5 no nível de dados.

---

## 4. Fase 2 — Schema v2 + render

**Objetivo:** o leitor vê a consolidação: `ranking`, lineage e o Radar rebaixado a
"O que vem".

**Mudanças:**
1. `content/weekly.schema.json v2` (aditivo — §9.1 do design):
   - `ranking[]` (`rank`, `fio`, `anchor`, `verdict`, `score`, `lineage`);
   - `lineage` em itens de `movements`/`highlights`;
   - `transition{from,to}` opcional em `highlights`;
   - `radar` inalterado, mas **deixa de ser "o centro"** na descrição.
2. `scripts/render-weekly.mjs v2`:
   - renderizar `ranking` (bloco "Onde está o valor", números em mono);
   - renderizar rótulo **"O que vem"** para o radar (não mais "Radar de janelas"
     como centro), posicionado após ranking, junto ao `watch`;
   - links de lineage ("ver na edição Nº27");
   - ordem canônica dos blocos: tese → movements → highlights → ranking → (radar+watch) → fontes.
3. `scripts/qa.mjs` / `tl-qa` — estender para a Weekly v2 (ranking sem verde-texto
   proibido, âncoras em mono, uma `h1`, contraste, disclaimer íntegro).

**Aceitação:**
- [ ] Draft aprovado → `npm run weekly` gera email/plain/web sem erro.
- [ ] QA gate verde; regras invioláveis de cor/tipografia respeitadas (ranking em
      JetBrains Mono; nada de verde como texto sobre Paper).
- [ ] Weekly antiga (W29, sem ranking) ainda renderiza (retrocompat).

---

## 5. Fase 3 — Dedup de saída + gates de honestidade

**Objetivo:** garantir "um Fio, um bloco, estado terminal" e que rumor nunca ranqueia.

**Mudanças em `validateWeekly` (`render-weekly.mjs`) e/ou no consolidador:**
1. **Precedência de bloco:** um Fio em ≥2 blocos → mantém no de maior precedência
   (`highlights > ranking > movements`), remove dos demais; validação **bloqueia**
   se o mesmo `fio` aparece em 2 blocos.
2. **Elegibilidade de ranking:** Fio sem `vigencia` confirmada OU sem `conta.result`
   numérico **não ranqueia** → rebaixa para "Não confirmado" (regra 9).
3. **Anti-repetição textual:** heurística que sinaliza (warning) quando `note` de
   highlight e `context` do deal têm alta sobreposição literal (regra inviolável 2).

**Aceitação:**
- [ ] Weekly com o mesmo Fio em `ranking` e `movements.seguem` → **falha** na validação.
- [ ] Fio `nao-confirmado` no `ranking` → **falha**.
- [ ] Testes cobrindo as três regras.

---

## 6. Fase 4 — Loop de curadoria (draft → final)

**Objetivo:** formalizar onde máquina e editorial se encontram.

**Mudanças:**
1. Scripts npm:
   - `weekly:draft` → roda `weekly-consolidate.mjs` (gera `*.draft.json`);
   - `weekly:build` → valida + renderiza o `*.json` final aprovado.
2. `content/README.md` — documentar o fluxo: máquina gera draft → editorial
   escreve **tese** + **notas de highlight** + **aprova ranking** + confirma
   `watch(b)` → salva como `AAAA-Wnn.json` → `weekly:build`.
3. Idempotência: rodar `weekly:draft` de novo não sobrescreve campos editoriais já
   preenchidos (merge conservador, ou draft/final separados por convenção de nome).

**Aceitação:**
- [ ] Fluxo documentado e reproduzível ponta a ponta numa semana de exemplo.
- [ ] `weekly:draft` não destrói curadoria humana existente.

---

## 7. Fase 5 — Costura de acurácia (premissa 4)

**Objetivo:** abrir a *interface* para o futuro motor de acurácia sem acoplar.

**Mudanças:**
1. O consolidador exporta, por Fio, `verdictStart → verdictEnd` da semana + lineage
   em `out/weekly-signals/AAAA-Wnn.json` (arquivo separado, não entra no render).
2. Documentar o contrato desse export como entrada futura do motor de medição.

**Aceitação:**
- [ ] Export emitido, **sem** import no caminho de publicação.
- [ ] Contrato documentado; nenhum acoplamento novo em `beehiiv-publish.mjs`.

**Fora de escopo (explícito):** o motor de acurácia em si. Esta fase só entrega a
tomada onde ele vai plugar.

---

## 8. Mapa de arquivos tocados

| Fase | Cria | Edita |
|---|---|---|
| 0 | testes de schema | `edition.schema.json`, `validate.mjs`, `content/entities/*`, editions 27/28 |
| 1 | `scripts/weekly-consolidate.mjs`, testes | — (read-only nas edições) |
| 2 | — | `weekly.schema.json`, `render-weekly.mjs`, `qa.mjs` |
| 3 | testes | `render-weekly.mjs` (validateWeekly) |
| 4 | — | `package.json` (scripts), `content/README.md` |
| 5 | export writer | `content/README.md` |

Reuso obrigatório (não reimplementar): `lib/campaign-quality.ts` (dedup),
`lib/forecast.ts` (normalização de rota), `scripts/taxonomy.mjs` (bandas de
veredito), `scripts/forecast-freshness.mjs` (gate C0 do radar), padrão
`derivedFrom` do Pro (formato de lineage).

---

## 9. Riscos e trade-offs do plano

| Risco | Impacto | Mitigação |
|---|---|---|
| Ranking parecer "leaderboard calculado" com score digitado | quebra premissa 2/6 | chave auditável + aprovação humana + gate de elegibilidade; rótulo honesto |
| Reconciliação errada de Fio (deals distintos fundidos) | consolidação errada | reuso do union-find já testado; entidade sem registro → curadoria, não fusão às cegas |
| Radar rebaixado contraria schema atual | quebra contrato vigente | mudança deliberada, versionada (schema v2); decidir em §10 abaixo |
| Curadoria vira gargalo | Weekly atrasa | `movements` 100% automático já entrega o miolo; highlights/ranking são poucos itens |
| Escopo grande de uma vez | não entrega | fases independentes; Fase 0+1 já fecham a premissa 5 |

---

## 10. Decisões que precisam de aprovação humana antes da Fase 2

1. **Rebaixar o Radar** de "centro do weekly" para "O que vem" (contraria o schema
   atual). *Recomendado.* Se recusado, o radar permanece no topo e ajusta-se a
   ordem dos blocos.
2. **Incluir `ranking` já**, como sugerido+aprovado. *Recomendado.* Alternativa:
   adiar `ranking` até o TL Score ser calculado — nesse caso Fases 0/1/3/4 seguem
   e só o bloco de ranking espera.

Ambas estão nos trade-offs de DD-WEEKLY-001 §12. Fases 0 e 1 podem começar
**independente** dessas decisões (são fundação de dados e motor).

---

## 11. Definição de pronto (global)

- [ ] Uma Weekly de exemplo é **gerada a partir das Dailies da semana**, não digitada.
- [ ] Todo item consolidado tem lineage clicável até a edição/deal.
- [ ] Nenhum Fio aparece em dois blocos; nenhum rumor ranqueia.
- [ ] Radar é uma janela ("O que vem"), não a moldura.
- [ ] `npm run weekly` + QA gate verdes; regras invioláveis respeitadas.
- [ ] Consolidador roda separado do render; export de sinais existe sem acoplar publicação.
