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

**Próximo trabalho substantivo:** Agente 1 — **investigação de causa-raiz da corrupção
temporal** (bug de ingestão reversível vs ausência de dado na origem). Decide se
recuperamos parte dos ~34 meses ou se 2025-12 é o começo real. É o que destrava (ou não)
o backtest honesto e a calibração.

### Calibração — *(a preencher pelo chat de calibração)*
Pendência sinalizada: verificar se os inputs temporais do re-score/percentil passam pela
plausibilidade temporal antes de cravar vetor.

### Principal — *(a preencher pelo chat principal)*
