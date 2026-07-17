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

### ⚠️ RECONCILIAÇÃO DE ESTADO DA EDGE FN (2026-07-17, dado do banco vivo)

**Corrige uma contradição entre chats.** Foi propagada a leitura de que a "Fase 1a foi
deployada e o yr_off caiu para ~0". **Isso NÃO aconteceu.** Verdade verificada no banco:

- **Deployada em produção:** `campaigns` **v14 do PRINCIPAL** (shadow mode, migração 0009
  aplicada: `published_at`/`date_suspect`/`dedup_key`). `updated_at` 2026-07-17 ~13:24 UTC.
- **Ela FLAGA, não PREVINE:** o `analyze(text)` da v14 **não passa `published_at` ao prompt**
  (sem âncora). Grava `date_suspect` (±65d ao redor de múltiplo de ano) — que **perde o
  canônico de 943d** e os +1yr sujos. Não impede o LLM de fabricar o ano.
- **Fase 1a do predict NÃO foi deployada:** coluna `temporal_status` **não existe**;
  migração 0008 nunca aplicada. A 1a existe só como proposta em #105.
- **Sem medição de yr_off:** `criadas_hoje=0`, última criação 2026-07-16 23:05,
  `news_pendentes=0`. Nada processado hoje — não há amostra pós-deploy.
- **⇒ A ORIGEM NÃO ESTÁ ESTANCADA.** A reconstrução histórica está **bloqueada** pelo
  protocolo (exige origem estancada antes de reconstruir).

**Causa da contradição:** a v14 do principal foi deployada **sem inscrição no handoff** →
propagou a suposição de estancamento. **Aprendizado travado: nenhuma escrita em produção
sem inscrição prévia** (vale para os três chats).

### Artefatos do predict corrigidos (limpeza)
- **Revertida** a edição da edge fn `supabase/functions/campaigns/index.ts` (era v13-based,
  competia com a v14 viva) e **removida** a migração `0008` (colunas concorrentes das do
  principal). O flag reconcilia para o `date_suspect` **deles**.
- Mantidos como referência da lógica do predict: `v2/lib/temporal-plausibility.mjs` + golden
  (o guard `>365d`, insumo da reconciliação do flag).

### Ordem correta aprovada pelo operador (respeita protocolo + escrita única)
1. **Reconciliar e inscrever o estado real** (feito aqui).
2. **Predict PROPÕE a âncora (v15) sobre a v14 do principal** + reconciliação do flag
   (combinar: flag se gap `>365d` **OU** perto de múltiplo de ano ±65d). Proposta, não deploy.
   Ver `v2/predict/PROPOSTA-ANCORA-V15.md`.
3. **Chat PRINCIPAL deploya a v15** (regra de escrita única: ele é dono da edge fn).
4. **Mede em produção** que a âncora estancou (yr_off→0 nas notícias novas).
5. **Só então** aplica a reconstrução histórica (regra **apertada**, fronteira **12** —
   aprovada sobre a amostra), com inscrição prévia + confirmação de não-colisão de linhas.

**Fase 1b** (dedup por identidade, muda chave de upsert) segue posterior e coordenada com o
principal (toca `campanha_identidade`/`campanha_versoes` do M1).

### Calibração — *(a preencher pelo chat de calibração)*
Pendência sinalizada: verificar se os inputs temporais do re-score/percentil passam pela
plausibilidade temporal antes de cravar vetor.

### Principal — PEDIDO DO PREDICT: integrar e deployar a âncora v15 (2026-07-17)

O predict entrega a âncora como proposta (`v2/predict/PROPOSTA-ANCORA-V15.md`); pela **regra
de escrita única, o deploy da edge fn é seu**. Passos:

1. **Integrar a âncora** (`published_at` no prompt do `analyze`) sobre a sua v14-shadow → **v15**.
   É a prevenção que falta: a v14 flaga mas não impede o LLM de fabricar o ano.
2. **Reconciliar o flag:** `date_suspect = eventDateLooksFabricated(±65d) OU gap>365d`. O seu
   ±65d **perde o canônico de 943d** (e +1yr sujos); o `>365d` do predict pega. Combinar cobre
   os dois. Lógica de referência: `v2/lib/temporal-plausibility.mjs` (golden 20/20).
3. **Teste dos dois lados antes do deploy** (a v15 toca a extração viva): os **`daily` limpos
   são gate de não-regressão BLOQUEANTE** (se algum regride, não deploya) + os `auto` quebrados
   como correção. Desenho do teste em `PROPOSTA-CORRECAO-EDGE-FN.md` §3.
4. **Deployar** (preservar `verify_jwt=false`, senão quebra o cron) e **medir em produção**:
   notícias novas pós-v15 nascem com ano válido (`yr_off≥1 → ~0`). Só então a origem está
   estancada.

**Nota crítica sobre a medição:** hoje há **0 notícias novas** (última criação 2026-07-16
23:05, `news_pendentes=0`). Depois de deployar a v15, pode **não haver notícia nova imediata**
para medir. O estancamento se confirma quando o **próximo ciclo de coleta** produzir notícias
novas com data válida. **"Sem notícia nova para medir" ≠ "não estancou"** — a medição só
precisa de notícia nova para existir. Se a coleta estiver parada/lenta, a confirmação espera
o próximo ciclo.

**Dependência a jusante:** enquanto a v15 não for deployada e medida, o predict **não aplica**
a reconstrução histórica (regra apertada, fronteira 12, já aprovada). O seu deploy da v15
destrava a cadeia inteira. Ao deployar e medir, **inscreva aqui** o resultado (versão no ar,
yr_off pós-medição) — a inscrição fecha o loop que faltou na v14.

*(demais itens do principal a preencher pelo próprio chat principal)*
