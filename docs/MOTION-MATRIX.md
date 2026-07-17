# The Loyal — Matriz de Motion

> Decisão elemento a elemento. Read-only; nada implementado.
> **Decisões possíveis:** `ANIMAR` · `QUASE IMPERCEPTÍVEL` · `MANTER ESTÁTICO` · `REMOVER/REDUZIR MOTION` · `INVESTIGAR (protótipo)`.
> **Frequência:** 100+/dia · dezenas/dia · ocasional · rara · 1ª vez.
> Valores de duração/easing vêm de `AUDIT.md`/`STANDARDS.md`. Onde a decisão é de marca, está marcado 🏷️.

## Legenda de easing/tokens (proposta — ver plano, lote 1)
`--ease-out: cubic-bezier(0.23,1,0.32,1)` · `--ease-in-out: cubic-bezier(0.77,0,0.175,1)` · `--ease-panel: cubic-bezier(0.32,0.72,0,1)` · existente `ease-standard: cubic-bezier(0.2,0,0,1)` (reconciliar com `--ease-out`).

---

## Landing (`/`)

| Página | Elemento | Decisão | Propósito | Frequência | Motion | Duração | Técnica | Reduced motion | Prioridade |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Landing | Header (Nav) | MANTER ESTÁTICO | — | persistente | nenhum (só `backdrop-blur` + `transition-colors` no hover) | 150ms cor | CSS | igual | — |
| Landing | Logo | MANTER ESTÁTICO | — | persistente | nenhum | — | — | — | — |
| Landing | Botão "Assinar" / CTA verde | MANTER + padronizar press | feedback | ocasional | `transition-colors` (existe) + **press `scale(0.97)`** | 150ms cor / 120ms press | CSS `:active` | cor mantém; scale removível | P2 |
| Landing | Hero headline / eyebrow / microcopy | MANTER ESTÁTICO | — | 1ª vez | nenhum (rejeitar letra-a-letra) | — | — | — | — |
| Landing | Ponto no hero — idle (blink/breathe/ear/tag) | INVESTIGAR 🏷️ | delight/"vivo" | contínuo | loops infinitos (existe) | 3–10s | CSS `animation infinite` | **já desligado** | P3 (decisão de marca) |
| Landing | Ponto — pupilas seguem cursor | MANTER | delight decorativo | hover desktop | rAF+mousemove (existe, IO-gated) | 80ms | JS | **já desligado** | — |
| Landing | Ponto — `tilt` no foco do form | MANTER | indicação de estado | por foco | `rotate(12deg)` (existe) | 400ms | CSS transition | **já desligado** | — |
| Landing | Ponto — `celebrate` no sucesso | MANTER | confirmação (delight raro) | rara | orelhas+cauda (existe) | 450ms | CSS | **já desligado** | — |
| Landing | Formulário — botão submit | MANTER | feedback | ocasional | `active:translate-y-px` (existe) | 150ms | CSS | mantém (transform mínimo) | — |
| Landing | Formulário — troca form→sucesso/erro | QUASE IMPERCEPTÍVEL | evitar teleporte | rara | crossfade `opacity` | 150–200ms `ease-out` | CSS `@starting-style`/`data-` | vira só opacity (já é) | P3 |
| Landing | Entrada de seções (Problema, Método, Recebe, Para quem, Como analisamos, Glossário) | **REDUZIR** | evitar mudança abrupta | toda rolagem | hoje: fade+`translateY(12px)` por bloco → reduzir a **âncora de seção**, não por card | 300–400ms `ease-out` | IntersectionObserver+CSS (existe) | **já:** `opacity:1`, sem translate | **P1** |
| Landing | Cards dos grids (Método/Recebe/Para quem/Princípios/Glossário) | **REMOVER reveal por card** | (não há propósito por-item) | toda rolagem | remover `<Reveal>` individual; revelar o grupo uma vez ou nada | — | — | n/a | **P1** |
| Landing | CompareBanner / contas / ContaBlock / Sparkline | MANTER ESTÁTICO | "imagem é dado" | ocasional | nenhum (rejeitar barras crescendo/contadores) | — | — | — | — |
| Landing | EdicaoMock (prova) | MANTER ESTÁTICO | — | ocasional | nenhum | — | — | — | — |
| Landing | Sticky CTA (entrada/saída) | MANTER 🛡️ | continuidade/estado | ocasional | `translateY`+`opacity` (existe, geométrico) | 200ms `ease-standard` | CSS transition + rAF passivo | mantém (essencial) | **NÃO TOCAR** |
| Landing | CTA final (banda Ink) + spotlight do Ponto | MANTER ESTÁTICO | — | 1ª vez | nenhum (Ponto celebra só no sucesso) | — | — | — | — |
| Landing | Footer | MANTER ESTÁTICO | — | persistente | só hover de cor | — | CSS | — | — |
| Landing | Fundo / bandas paper·paper-dark·ink | MANTER ESTÁTICO | — | — | nenhum (rejeitar fundo/gradiente animado, parallax) | — | — | — | — |

---

## Mobile (comportamento transversal)

| Contexto | Elemento | Decisão | Motivo |
| --- | --- | --- | --- |
| 320–430px | Qualquer entrada em scroll | REDUZIR | não deslocar conteúdo enquanto se lê; sem stagger por card |
| viewport reduzida / teclado aberto | Sticky CTA vs input | MANTER lógica geométrica 🛡️ | já não cobre input focado (validado no PR #66); não substituir por solução visual |
| touch | Hovers | MANTER (só cor) | color-only tolera false-hover; **proibir** novos hovers com transform sem `@media (hover:hover)` |
| scroll rápido/lento | Reveal | corrigir risco de conteúdo oculto | garantir visível se o IO não disparar |
| safe area / orientation change | Sticky CTA | MANTER | usa `env(safe-area-inset-bottom)` + `resize` listener |
| dispositivo lento | idle do mascote | INVESTIGAR pausa fora de foco | reduzir custo contínuo |

---

## Desktop web (transversal)

| Elemento | Decisão | Motion | Nota |
| --- | --- | --- | --- |
| Links / botões clicáveis | MANTER + press | `transition-colors` + `scale(0.97)` | gate de hover só se virar transform |
| Cards **não** clicáveis | MANTER ESTÁTICO | nenhum | rejeitar hover/tilt em conteúdo não clicável |
| Cards clicáveis (arquivo de edições, Pro) | QUASE IMPERCEPTÍVEL (opcional) | `background`/`border` no hover (já existe) | sem escala; `@media (hover:hover)` se adicionar transform |
| Mascote | MANTER | pupilas/idle já gated | rejeitar mascote seguindo cursor em novas superfícies |
| Navegação / menus | MANTER ESTÁTICO | nenhum | sem transição de página em toda navegação |
| Tooltip / popover / modal / drawer | N/A | — | não existem; se criados, seguir tokens+origin-aware |

---

## Anuncie (`/anuncie`) — ⚠️ rota não existe

| Elemento | Decisão | Nota |
| --- | --- | --- |
| Toda a página | N/A — **placeholder condicional** | Só há link no footer. Quando a rota existir: transição curta entre etapas, feedback de seleção, progresso/upload, confirmação, sucesso raro. **Rejeitar**: mockups em loop, contadores, cards girando, form tremendo, CTA pulsando. Não implementar agora. |

---

## Área do cliente / assinatura / pagamento — ❌ não existe

| Elemento | Decisão | Nota |
| --- | --- | --- |
| auth cliente, onboarding, perfil, preferências, assinatura, pagamento, histórico, busca, filtros, tabelas, cancelamento | N/A — **placeholder condicional** | Nenhuma UI hoje. Orçamento futuro **baixo**: toast, confirmação de salvar, modal/drawer mobile, onboarding inicial, empty state inicial, sucesso raro. **Rejeitar**: entrada de página a cada navegação, animação de tabela, stagger de linhas, métricas contando, gráfico redesenhando, filtros/busca/paginação animados. |

---

## Edições / Pro / Daily (conteúdo)

| Página | Elemento | Decisão | Motivo |
| --- | --- | --- | --- |
| `/edicao`, `/edicao/[n]` | Lista, artigo, links | MANTER ESTÁTICO | leitura; só hover de cor. Nenhuma animação nova. |
| `/pro`, `/pro/[periodo]` | ProReport, dados Radar/Forecast/Predict, sparklines | MANTER ESTÁTICO | "imagem é dado"; rejeitar gráfico desenhando/contadores |
| `/daily/preview` | DailyEdition | MANTER ESTÁTICO | — |

---

## Admin

| Página | Elemento | Decisão | Propósito | Frequência | Motion | Duração | Técnica | Reduced motion | Prioridade |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Admin (global) | Toast (`admin/toast.tsx`) | **ANIMAR (quase imperceptível)** | continuidade espacial + feedback | ocasional | entrada `translateY(8px)+opacity 0→1`; saída inverso | 180–240ms `ease-out` | CSS **transition** (interrompível) + `@starting-style`/`data-mounted` | vira só `opacity` | **P2** |
| Admin | Sidebar / nav links | MANTER ESTÁTICO | — | dezenas/dia | só `transition-colors` | default | CSS | — | — |
| Admin | Botões / SubmitButton | MANTER + press | feedback | ocasional | `transition-colors` (existe) + press `scale(0.97)` | 120ms | CSS `:active` | scale removível | P2 |
| Admin | LiveRefresh (auto 30s) | MANTER ESTÁTICO (opcional indicador) | estado | a cada 30s | sem spinner (deliberado); opcional: `opacity`/`aria-busy` sutil no `isPending` | — | React `useTransition` | — | P3 (opcional) |
| Admin | Tabelas / linhas | MANTER ESTÁTICO | — | dezenas/dia | nenhum | — | — | — | — |
| Admin | KPIs / sparklines | MANTER ESTÁTICO | "imagem é dado" | dezenas/dia | nenhum (rejeitar contadores/gráfico desenhando) | — | — | — | — |
| Admin | Filtros / busca / paginação | MANTER ESTÁTICO | — | dezenas/dia | nenhum | — | — | — | — |
| Admin | Ação destrutiva (se existir) | INVESTIGAR | confirmação deliberada | rara | hold-to-confirm `clip-path` (assimétrico: press lento, release rápido) | press ~2s linear / release 200ms `ease-out` | CSS/WAAPI | vira confirmação sem movimento | P3 |
| Admin | Modal / drawer (se criados) | ANIMAR (padrão) | continuidade | ocasional | modal `scale(0.96)+opacity`, origin center; drawer `translateY/X 100%` | 200–300ms `ease-panel` | CSS transition | opacity-only | condicional |

> **Orçamento do admin é o menor.** Só o toast e o press-feedback justificam motion novo. Todo o resto: manter estático.

---

## Componentes globais

| Componente | Decisão | Nota |
| --- | --- | --- |
| `PontoMascot` | MANTER (idle sob revisão de marca) | já totalmente gated |
| `SubscribeForm` | MANTER (crossfade de estado opcional) | press já existe |
| `StickyCTA` | **NÃO TOCAR** 🛡️ | lógica geométrica robusta |
| `Nav`/`Footer` | MANTER ESTÁTICO | — |

---

## Contagem de decisões

- **MANTER ESTÁTICO:** maioria (edições, Pro, daily, admin-tabelas/KPIs/busca, headline, gráficos, fundos).
- **MANTER (motion existente correto):** StickyCTA, hovers de cor, press do CTA, tilt/celebrate/pupila do mascote, smooth-scroll.
- **REDUZIR/REMOVER:** Reveal por card (P1).
- **ANIMAR / QUASE IMPERCEPTÍVEL:** toast do admin (P2), press-feedback padronizado (P2), crossfade de estado do form (P3), toast condicional.
- **INVESTIGAR:** idle do mascote (marca), hold-to-confirm destrutivo.
- **N/A (rota inexistente):** Anuncie, área do cliente, pagamento, onboarding, modais/drawers/tooltips.
