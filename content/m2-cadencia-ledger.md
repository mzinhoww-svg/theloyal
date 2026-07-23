# M2 — Cadência diária em modo disco + revisão (envio adiado)

> **Modo C (decisão do operador, 2026-07-23).** O envio ao ESP fica **adiado**
> (Beehiiv em tier Launch, sem API; ESP a definir). O motor roda todo dia útil,
> monta a edição, passa o gate único e **persiste o render em disco**
> (`content/renders/NNNN.html`, servido em `/revisao/N`). O operador **revisa o
> render** e marca "ok" na tabela — **sem envio**. Autopublish **OFF** o tempo todo
> (D-050; `TL_AUTOPUBLISH=off`). O passo Beehiiv degrada sem quebrar (D-088).
>
> **"Aprovado" no modo C:** o operador abriu o render, conferiu e marcou ✅ na
> coluna "Revisão do operador". **5 dias úteis consecutivos de edição VÁLIDA
> revisada = motor provado (M2.7 funcional).** O envio real fica para quando o ESP
> estiver ligado — não é pré-requisito de fechar o motor.
>
> **Regras da contagem (inalteradas):**
> - Dia **sem revisão** do operador **não conta** — e **não pula**: a série trava
>   ali até haver revisão. Número honesto menor é melhor que um número inflado.
> - Dia que **falha o gate** → reporta, **não persiste render**, **não conta**; o
>   diagnóstico vira prioridade antes de seguir (regra 3).
> - "Consecutivos" = dias úteis seguidos, todos revisados. Um furo reinicia a série.

## Janela dos dias úteis

> A tabela abaixo é **atualizada pelo runner** a cada rodada (marcadores
> `CADENCIA`). O runner escreve Data / Nº / Gate / Render e deixa a **Revisão do
> operador** como `pendente`; **só o operador** troca para `✅ ok` (a marca humana é
> preservada em re-runs). Não editar dentro dos marcadores à mão salvo a coluna de
> revisão.

<!-- CADENCIA:START -->
| Data (BRT) | Nº | Gate | Render (revisão) | Revisão do operador |
|------------|----|------|------------------|---------------------|
| 2026-07-22 (QUARTA-FEIRA) | 29 | 🟢 VERDE | [/revisao/29](/revisao/29) | pendente |
<!-- CADENCIA:END -->

**Progresso:** 0/5 dias úteis consecutivos revisados. A série inicia no primeiro
dia com edição VÁLIDA (gate verde) revisada pelo operador.

## Como revisar um dia (operador)

1. Abrir `/revisao/N` no deploy de **preview** do Vercel (a rota é **noindex** e
   retorna **404 em produção** — não é superfície pública). Alternativa durável:
   abrir `content/renders/NNNN.html` no GitHub (repo privado).
2. Conferir: edição fresca do dia, triada, gate verde, seções com conteúdo real
   (Deal Desk só com lastro; Ofertas ativas com selo quando não confirmado).
3. Trocar `pendente` → `✅ ok (AAAA-MM-DD)` na linha do dia. **Sem envio.**
4. 5 linhas `✅ ok` em dias úteis consecutivos = **M2.7 funcional provado**.

## Log de eventos

- **2026-07-23** — Migração para o **modo C** (disco + revisão). Persistência do
  artefato diário ligada: o runner grava `content/renders/NNNN.html` (render fiel,
  schema v4) e atualiza a tabela acima; rota `/revisao/N` (preview, noindex,
  404 em produção) serve o render. Envio adiado (ESP a definir). D-089.
- **2026-07-22** — Antes do modo C, a nº29 dava gate RED (dia fraco, pré-EPSILON).
  Depois de EPSILON (D-086) o dia fraco válido passa o gate; a contagem recomeça
  aqui, agora medindo **revisão** (não envio).
