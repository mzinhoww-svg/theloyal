# HANDOFF-CHAT — Estado compartilhado dos chats v2

> **Handoff único, não três divergentes.** Os três chats paralelos (principal, calibração,
> predict) leem e escrevem o mesmo estado aqui. Antes de encerrar qualquer marco, o chat
> atualiza sua seção. Fonte de verdade das decisões continua sendo `v2/DECISIONS.md`.
> Atualizado 2026-07-17.

## Bifurcação dos chats

| Chat | Escopo | Não toca |
|---|---|---|
| **Principal** | Corrida do Deal Desk; pipeline editorial; publicação. | Params dos motores; predict. |
| **Calibração** | Parâmetros dos motores de score (TL Score, derivação, CPM). | Predict; edições. |
| **Predict** | Backtesting e calibração do `campaign_predict_v2` contra o histórico; plausibilidade temporal. | Params de score; edições. |

## Regra de inscrição cruzada

Quando um chat chega a um marco (backtest rodado, params propostos, base construída,
achado que afeta os outros), **inscreve o que aconteceu aqui** antes de encerrar o marco.
Os três compartilham o mesmo estado. Um achado que muda a premissa de outro chat entra em
**destaque** (ver o alerta dos 36 meses abaixo) — não fica enterrado numa seção só.

---

## ⚠️ CORREÇÃO CRÍTICA — LER ANTES DE SEGUIR (afeta os três chats)

**A premissa de "36 meses de notícias limpas já processadas" está REFUTADA.**

A `docs/AUDITORIA-FORENSE-PREDICT-FORECAST.md` (dados reais do Supabase, 2026-07-15)
confirma que a **camada temporal do corpus está corrompida**:

- **Erro de ano sistemático:** 77% das transferências têm data de evento >180 dias antes
  do `first_seen` (média **+310 dias**); 281 datas em 2023–2024 são majoritariamente ano
  fabricado pela extração LLM.
- **Span nominal ~41 meses** (`window_date` 2023-02 → 2026-07) é **artefato de erro**, não
  histórico. O caso canônico `livelo→connectmiles` gera 943 dias de intervalo a partir da
  **mesma campanha duplicada com ano inventado**.

**Diagnóstico de causa-raiz FECHADO (Agente 1, banco vivo 2026-07-17) — ver
`v2/predict/DIAGNOSTICO-CAUSA-RAIZ-TEMPORAL.md`:**
- Erro é **SISTEMÁTICO** (ano atrasado 1–6 anos; 425/562 = 75,6% dos datados, massa em
  +1 ano), **não aleatório** → parcialmente recuperável.
- Nasce na **EXTRAÇÃO** (LLM da edge fn `campaigns` v13, sem validação de data) e **ainda
  está VIVO** — quase todo em `origin='auto'`; `daily` (curadoria) está limpo; +246
  transferências novas desde a auditoria, a mais recente (2026-07-16) ainda corrompida.
- **~49% reconstruíveis por evidência** (token mês-ano no slug == ano de `first_seen`);
  o resto vira `suspect_year` e sai (nunca chutado). O caso canônico fica `suspect_year`.
- **Cobertura recuperável real: ~17 rotas** (`base_n≥3`, série≥12m) sobre **~24 meses**
  confiáveis (2024-07 → 2026-07), com a regra de reconstrução aprovada; **~9 rotas** sem
  ela. Não são 34 meses, nem o piso de 2025-12.
- **Nada aplicado** — regra de correção proposta, aguardando aprovação do operador +
  trava de anomalia + dry-run. **A origem (edge fn) precisa de correção também**, senão
  a limpeza histórica não dura.

**Plano aprovado pelo operador (D-041/D-042/D-043) — ordem travada:**
1. **Corrigir a origem PRIMEIRO** (edge fn `campaigns`): validar data, passar
   `published_at` ao prompt, `id` sem data embutida, dedup por identidade estável. **Não
   pode regredir o `daily` limpo** — testa contra casos que funcionam E que falham.
2. **Só então reconstruir o histórico** (regra de ano por evidência, dry-run + amostra
   auditável dos dois grupos, aprovação sobre a amostra, trava de anomalia).
3. `suspect_year`/`sem_data` = **marca e exclui da série, NÃO deleta** do corpus (D-042).
4. **Fronteira do predict v1** = número só para **~17 rotas / ~24 meses**; qualitativo no
   resto; datada e auto-expansível (D-043).
- **Duas aprovações do operador** antes de qualquer escrita na camada temporal: (a) a
  correção da edge fn; (b) a regra de reconstrução.
- **Calibração de params do predict destrava** (D-040 Parte B) só após a reconstrução,
  quando houver série confiável para calibrar contra.

**Impacto nos outros chats (ler):**
- **Calibração:** se usou datas para qualquer coisa (percentil histórico, span), a janela
  confiável é **~24 meses (2024-07 → 2026-07)**, não os 34 do bruto. Reavaliar inputs
  temporais.
- **Principal:** qualquer coisa que dependa de data de campanha herda essa limitação até
  a reconstrução rodar. **A correção da edge fn (Fase 1a) é pré-requisito para vigência
  confiável de campanhas NOVAS** — afeta a cobertura de fontes que o principal gerencia
  (campanhas novas passam a nascer com data válida/flagada). E a **Fase 1b é coordenada
  com o principal** (toca a identidade M1).

**Impacto nos outros chats:** a **calibração de score** também pode estar usando datas
ruins (percentil histórico, re-score D-007/D-038 dependem de série temporal). O chat de
calibração precisa checar se seus inputs temporais passam pela mesma plausibilidade antes
de cravar qualquer vetor.

---

## Estado por chat

### Predict (este chat) — 2026-07-17

**Já existe (não é M4-a-começar):**
- `lib/predict-engine.ts` (`campaign_predict_v2`, RFC-009): determinístico, puro, **sem
  LLM**. Modelo A (quando: sobrevivência ponderada por recência → P{7,15,30,60,90,180}) +
  Modelo B (quanto: distribuição empírica de bônus). Gate `minSamples=3`.
- **Backtest walk-forward já implementado** (`BACKTEST_VERSION="walk_forward_v1"`): não
  vaza futuro; rebaixa confiança por CV e por backtest fraco.
- Auditoria forense completa + `ADR-RADAR-010` (plausibilidade temporal).

**Cobertura real (regra 9 — não confirmado onde falta dado):**
- Séries que passam o gate `base_n≥3`: **38** (30 rotas + 8 clusters, de 120) — mas fração
  grande é **inflada por datas duplicadas/erradas**; nem o 38 é base confiável.
- Span de 36 meses: **NÃO CONFIRMADO** (ver alerta acima).

**Decisões deste marco:**
- **D-040** gravada (Aprovada): predict é frequencial calibrado/validado, não ML opaco
  (Parte A); calibração de params **travada** até a camada temporal ser confiável (Parte B).
- **ADR-RADAR-010** ratificada (proposed → accepted): mecanismo de detecção de ano suspeito
  aceito; **limiares (548d/365d/k·MAD) são de partida, calibráveis pelo Agente 3**, sem
  reabrir a ADR.

**Trava ativa:** nenhum parâmetro do predict é gravado/calibrado até a slice de
plausibilidade temporal fechar. Backtest sobre datas corrompidas está proibido.

**Status (2026-07-17):** Agente 1 fechou o diagnóstico (causa-raiz sistemática, viva na
extração). **Fase 1a implementada e testada, aguardando deploy** (1º portão):
- `v2/lib/temporal-plausibility.mjs` + golden `…test.mjs` (**20/20 verdes**): não-regressão
  (0 limpos viram suspect) + correção (todos os quebrados → `suspect_year`, inclui o
  canônico e um daily sujo de 852d).
- Edge fn `campaigns` (v14 proposta): âncora de `published_at` no prompt + guard inline +
  colunas `temporal_status`/`include_in_prediction`. **Não muda `makeId` (isso é 1b).**
- Migration aditiva `supabase/migrations/0008_temporal_plausibility.sql` (proposta).
- Guard `>365d` sobre o corpus vivo: flaga **193/562** (backstop conservador de alta
  precisão; o resto é âncora na origem + reconstrução por evidência na Fase 2).
- **Pendente:** aprovação do operador para deploy + medição pós-deploy (yr_off≥1 → ~0).

**Fase 1b = slice COORDENADA com o chat principal** (não unilateral do predict): tirar a
data do `id` e dedup por identidade estável tocam `campanha_identidade`/`campanha_versoes`,
construídos e usados pelo M1 (chat principal). Só roda alinhada com o dono do M1.

### Calibração — *(a preencher pelo chat de calibração)*
Pendência sinalizada: verificar se os inputs temporais do re-score/percentil passam pela
plausibilidade temporal antes de cravar vetor.

### Principal — *(a preencher pelo chat principal)*
