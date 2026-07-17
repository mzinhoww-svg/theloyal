# The Loyal — Auditoria de Motion (Fase 1: só auditoria e planejamento)

> **Status:** auditoria read-only. Nenhuma animação foi implementada. Nenhum código de produção foi alterado.
> **Base:** `main` @ `e487d93` (inclui o merge do PR #66 — redesign mobile-first).
> **Método:** análise estática do código (o motion deste projeto é 100% determinado por CSS + JS vanilla), guiada pelas skills `improve-animations`/`emil-design-eng`/`review-animations` (filosofia de Emil Kowalski) e pelas regras invioláveis do `CLAUDE.md`.
> **Hierarquia de verdade:** `CLAUDE.md` (marca) precede a preferência estética das skills. Onde houver conflito, a marca vence e está anotado.

---

## 0. Resumo executivo

**O The Loyal já é um projeto de motion contido e disciplinado.** Não há biblioteca de animação (só `next`/`react`), não há `transition: all`, não há propriedade de layout animada, e existe um bloco `prefers-reduced-motion` global e completo. A maior parte da resposta desta auditoria é **"manter estático"** ou **"já está correto"** — coerente com o arquétipo Sage, o tom editorial premium e a regra "credibilidade vence a simpatia".

O trabalho de maior alavancagem **não é adicionar motion — é calibrar o que já existe** e cobrir três lacunas pontuais de feedback. Em ordem de leverage:

1. **Reveal por card em toda a landing (existente).** O `Reveal` (IntersectionObserver → fade+translateY) envolve *cada* card dos grids. Na prática é um scroll-reveal/stagger em quase toda a página — exatamente o padrão que o redesign combateu (recria a sensação de "blocos que se montam"). **Decisão: reduzir** a reveal a poucos âncoras, não a cada item. Também há um risco de conteúdo (`opacity:0` até o IO disparar).
2. **Toast do admin sem entrada/saída (existente).** Aparece e some instantaneamente. **Decisão: animar** de forma quase imperceptível (transição, não keyframe) — é a única superfície com feedback ausente.
3. **Sistema de tokens de motion ausente.** Durações são ad-hoc (150/200/400ms) e só existe um easing (`ease-standard`). **Decisão: consolidar** em tokens (sem inventar sistema paralelo).

Fora isso: press-feedback já existe no CTA; o StickyCTA é robusto e **não deve ser tocado**; o mascote é o único elemento "vivo" e é governado pelo `PONTO-MASCOTE-GUIA` — mexer nele é decisão de marca, não de motion.

**Orçamento de motion por superfície (do maior para o menor):** landing (baixo) > admin (mínimo) > edições/Pro (quase nulo). É aceitável que edições e Pro não recebam nenhuma animação nova.

---

## 1. Princípios adotados (do `AUDIT.md`/`STANDARDS.md` + `CLAUDE.md`)

- **Frequência decide.** 100+/dia → nunca animar. Dezenas/dia → reduzir. Ocasional → padrão. Raro/primeira vez → pode ter delight.
- **Todo motion precisa de propósito** (feedback, continuidade espacial, indicação de estado, orientação, evitar mudança abrupta, explicação, confirmação, delight raro). "Fica bonito" não é propósito.
- **Só animar `transform` e `opacity`.** Nunca layout (`width/height/top/left/margin/padding`).
- **Easing:** entrar/sair → `ease-out` forte; mover na tela → `ease-in-out`; hover/cor → `ease`; constante → `linear`. **Nunca `ease-in` em UI.**
- **Duração:** UI < 300ms. Press 100–160ms; tooltip 125–200ms; dropdown 150–250ms; modal/drawer 200–500ms; explicativo/marketing pode ser maior.
- **Nunca `scale(0)`** (começar em 0.9–0.97 + opacity).
- **Interrompível:** transitions/springs para UI dinâmica; keyframes só para movimento único e não-reversível.
- **Reduced motion = menos e mais suave, não zero.** Preserva feedback e compreensão; remove deslocamento/scale.
- **Hover com transform** só sob `@media (hover: hover) and (pointer: fine)`.
- **Marca (invioláveis):** sem urgência artificial (nada de CTA pulsando/countdown/vermelho de urgência); `transform`/`opacity` apenas; sempre com fallback estático em reduced-motion; mascote em 3ª pessoa, sem promessa, e cortado quando a credibilidade pede. A "imagem é dado" — nada decorativo sem função.

---

## 2. Inventário de superfícies (rotas reais vs citadas)

| Superfície | Rota / arquivo | Existe? | Observação de motion |
| --- | --- | --- | --- |
| Landing principal | `app/page.tsx` (+ `shell.tsx`, `sections.tsx`, `graphics.tsx`, `ui.tsx`, `PontoMascot.tsx`, `SubscribeForm.tsx`, `EdicaoMock.tsx`) | ✅ | Onde vive quase todo o motion |
| Arquivo de edições | `app/edicao/page.tsx` | ✅ | Só hover de cor em links |
| Edição individual | `app/edicao/[numero]/page.tsx` (`EditionArticle.tsx`) | ✅ | Só hover de cor |
| Pro (relatório) | `app/pro/page.tsx`, `app/pro/[periodo]/page.tsx` (`ProReport.tsx`) | ✅ | Só hover de cor; contém dados de Radar/Forecast/Predict |
| Daily (preview) | `app/daily/preview/page.tsx` (`DailyEdition.tsx`) | ✅ | Estático |
| Admin — login | `app/admin/login/page.tsx` | ✅ | Form; sem motion |
| Admin — cockpit | `app/admin/(panel)/page.tsx` + `layout.tsx` | ✅ | Sidebar, LiveRefresh, sparklines (SVG estático) |
| Admin — sub-rotas | `backfill`, `campanhas`, `jobs`, `logs`, `noticias`, `observability` | ✅ | Tabelas/forms; hover de cor; toast |
| Componentes globais | `Nav`, `Footer`, `StickyCTA` (`shell.tsx`), `PontoMascot`, `SubscribeForm` | ✅ | Ver §3 |
| **Anuncie** | link `"/anuncie"` no footer (`shell.tsx:212`) | ⚠️ **rota não encontrada** | Link existe, página não. É 404. Fora de escopo até a rota existir. |
| **Área do cliente** (auth cliente, onboarding, perfil, preferências) | — | ❌ **não existe** | Não há UI. Sem motion a auditar. |
| **Assinatura/pagamento/checkout/billing** | — | ❌ **não existe** | Conversão = form de e-mail → `POST /api/subscribe`. |
| **Radar / Forecast / Predict** (como rotas) | — | ❌ **não são rotas** | São dados (`lib/predictions.ts`, `lib/pro.ts`) exibidos em `ProReport`/admin. Sem superfície animável própria. |
| **Onboarding** | — | ❌ não existe | |
| Modais / drawers / tooltips / popovers | — | ❌ **nenhum na base** | Nenhum componente de overlay ancorado. O único overlay transitório é o toast do admin. |
| Loading / error / 404 / 500 dedicados | — | ⚠️ usa defaults do Next | Sem `loading.tsx`/`error.tsx`/`not-found.tsx` próprios. Estados de sucesso/erro do form são inline. |

> **Regra seguida:** não presumir existência por citação. Anuncie, área do cliente, pagamento, onboarding, Radar/Forecast/Predict como páginas, e modais/drawers/tooltips **não existem hoje** e portanto entram no plano apenas como *placeholders condicionais* ("se/quando a rota existir").

---

## 3. Inventário do motion existente

| Arquivo:linha | Superfície | Elemento | Motion atual | Técnica | Duração | Frequência | Problema / veredito |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `components/ui.tsx:16` + `globals.css:37-53` | Landing (todas as seções **e cada card**) | Entrada de bloco: `opacity 0→1` + `translateY(12px→0)` | IntersectionObserver (0.15, once) + CSS transition | 400ms `cubic-bezier(0.2,0,0,1)` | **toda rolagem, por card** | ⚠️ **Reveal em excesso**: por-card ≈ stagger em toda a landing; recria "blocos". Conteúdo fica `opacity:0` até o IO. → REDUZIR |
| `globals.css:56-96` + `PontoMascot.tsx` | Hero / metodologia | Idle do mascote: blink, breathe, ear, tag | CSS `animation … infinite` | 3s / 4s / 7s / 10s (loops) | **contínuo enquanto visível** | ⚠️ loops infinitos (frequência alta). Sutis e gated por reduced-motion. → DECISÃO DE MARCA (guia permite idle sutil) |
| `PontoMascot.tsx:42-59` | Hero desktop | Pupilas seguem o cursor | rAF + `mousemove` (IO-gated, reduced-motion-gated) | 80ms linear | hover contínuo (desktop) | Decoração; bem construída (só com SVG visível). → MANTER / avaliar |
| `PontoMascot.tsx` + `globals.css:101-107` | Hero / form / CTA | `tilt` (foco), `celebrate` (sucesso), `sniff` (hover), `wiggle` (clique) | CSS transition/animation | 400–600ms | por interação / raro | Proposital e raro. → MANTER |
| `components/shell.tsx:135-183` | Landing mobile | StickyCTA entra/sai (`translate-y` + `opacity`) | CSS transition + rAF geométrico (scroll/resize passivos) | 200ms `ease-standard` | ocasional | ✅ Robusto (validado no PR #66). → **NÃO TOCAR** |
| `components/shell.tsx:10,168` | Global / mobile | `backdrop-blur` no Nav e no StickyCTA | CSS (filtro) | — | persistente | Custo de filtro persistente (baixo). → MANTER, monitorar |
| `components/shell.tsx:18-29,177,218` | Global | Links/botões: `transition-colors hover:*` | CSS | 150ms `ease-standard` | hover | ✅ Só cor. → MANTER |
| `components/SubscribeForm.tsx:103` | Landing / CTA | Botão submit: `transition-colors` + `active:translate-y-px` | CSS | 150ms | ocasional | ✅ Press feedback existe (sutil). Estado sucesso/erro troca sem transição → oportunidade leve |
| `components/admin/toast.tsx` | Admin | Toast aparece/some | **nenhuma** (só `aria-live`, `setTimeout` 6s) | — | ocasional (admin) | ⚠️ **feedback ausente** → ANIMAR (quase imperceptível) |
| `components/admin/LiveRefresh.tsx:27-32` | Admin | Auto-refresh 30s (`router.refresh` em `startTransition`) | sem animação (deliberado: "sem spinner") | — | a cada 30s | ✅ Correto. Poderia ter indicador `isPending` sutil (opcional) |
| `components/admin/{Sidebar,SubmitButton,ui}.tsx` | Admin | hover `transition-colors bg/border` | CSS | default | hover | ✅ Só cor. → MANTER |
| `globals.css:9,111` | Global | `scroll-behavior: smooth` (âncoras) | CSS | — | ao clicar âncora | ✅ Gated em reduced-motion. → MANTER |
| `globals.css:110-128` | Global | Bloco `prefers-reduced-motion` | CSS | — | — | ✅ Completo (desliga idle/reveal/tilt/pupila/smooth + `*{…0.01ms}`) |

### Sinais de risco varridos (checklist)

- `transition: all` — **nenhum**. ✅ (tudo é específico: `transition-colors`, `transition-[transform,opacity]`)
- Animação sem `prefers-reduced-motion` — **nenhuma**. ✅ (bloco global cobre tudo)
- Propriedade de layout animada — **nenhuma**. ✅ (só `transform`/`opacity`/`color`)
- Loops infinitos — **mascote** (blink/breathe/ear/tag). ⚠️ sutis + gated → decisão de marca
- Hover em touch — hovers existem sem `@media (hover:hover)`, mas **são todos de cor** (false-hover no tap é desprezível). ⚠️ baixo; corrigir se algum hover virar `transform`
- Scroll listener contínuo — **StickyCTA** (rAF, passivo). ✅ correto
- Animação bloqueante — **nenhuma**. ✅
- Animação repetida a cada render — **nenhuma** (IO desconecta após disparar). ✅
- Animação que esconde informação — **Reveal** (`opacity:0` até o IO). ⚠️ risco se o IO não disparar
- Movimento em operação de alta frequência — **idle do mascote** (contínuo). ⚠️ ver acima

---

## 4. Problemas priorizados (por alavancagem = impacto ÷ esforço)

| # | Severidade | Categoria | Local | Achado | Correção resumida |
| --- | --- | --- | --- | --- | --- |
| 1 | **MÉDIA** | Coesão / Propósito | `ui.tsx:16`, `sections.tsx` (14×), `page.tsx` (5×) | Reveal por card em quase toda a landing; recria "blocos"/stagger que o redesign removeu | Reduzir a reveal a **âncoras de seção** (ou remover dos cards); manter sutil; garantir conteúdo visível se o IO falhar |
| 2 | **MÉDIA** | Acessibilidade / Robustez | `globals.css:37-40`, `ui.tsx` | `.tl-reveal { opacity: 0 }` esconde conteúdo até o IO disparar (risco em scroll muito rápido / falha de JS) | Fallback: revelar no `load` se já em viewport; considerar `@media (scripting: none)` / `@starting-style` |
| 3 | **MÉDIA** | Oportunidade perdida / Feedback | `components/admin/toast.tsx` | Toast surge/some instantaneamente (sem continuidade espacial) | Entrada/saída com **transition** (não keyframe): `translateY(8px)+opacity`, 180–240ms `ease-out`, interrompível |
| 4 | **BAIXA** | Coesão / Tokens | `tailwind.config.ts`, `globals.css` | Durações ad-hoc (150/200/400ms) e um único easing; sem escala de tokens de motion | Introduzir tokens de duração/easing que **estendem** `ease-standard` |
| 5 | **BAIXA** | Física / Frequência | mascote idle (`globals.css:56-96`) | 4 loops infinitos vistos continuamente no hero | Decisão de marca: manter (guia permite idle sutil) **ou** pausar quando fora de foco / após N ciclos |
| 6 | **BAIXA** | Feedback | `SubscribeForm.tsx` | Troca de estado (form → sucesso/erro) sem transição | Crossfade curto opcional (`opacity` 150–200ms) |
| 7 | **BAIXA** | Acessibilidade | hovers de cor sem `@media (hover:hover)` | false-hover no tap (só cor, impacto mínimo) | Só relevante se algum hover ganhar `transform`; então gate obrigatório |

**Não são achados (por design, respeitados):**
- StickyCTA por geometria — deliberado e robusto (PR #66). Não "consertar" com solução visual mais frágil.
- LiveRefresh sem spinner — deliberado (comentário no código).
- `transform-origin: center` no spotlight do Ponto no CTA final — correto (elemento centralizado).
- Ausência de animação em edições/Pro/admin-tabelas — correto para o tom.

---

## 5. Oportunidades (motion que falta, aditivo) — no máximo um punhado

Fundamentadas em costuras reais de UX, não em wishlist:

1. **Toast do admin (item 3).** Entrada/saída ausente é a única lacuna de feedback clara. Continuidade espacial + interrompível (stacking).
2. **Confirmação de cadastro (sucesso do form).** É um momento raro e de emoção — já tem o `celebrate` do Ponto; falta uma transição curta na troca form→sucesso para não "teleportar".
3. **Press-feedback consistente.** O CTA já tem `active:translate-y-px`; padronizar `scale(0.97)`/`translate` em **todos** os elementos pressionáveis (botões admin, links-ação) dá coesão de resposta ao toque — baixo custo, alto retorno percebido.
4. **(Condicional) Anuncie / área do cliente**: quando existirem, terão momentos naturais (transição entre etapas, progresso de upload, sucesso raro). Documentado no plano como lote condicional — **não** implementar agora.

---

## 6. Riscos

- **Regressão de credibilidade.** Motion a mais neste produto é um risco de marca (Sage, anti-urgência), não só de performance. O maior risco é *adicionar* delight onde a marca pede sobriedade.
- **Reveal → "blocos".** Mexer no Reveal pode reintroduzir a sensação de slides que o PR #66 removeu. Qualquer mudança precisa de checagem visual em scroll lento e rápido.
- **Mascote é território de marca.** Alterar o idle toca no `PONTO-MASCOTE-GUIA`. Tratar como decisão humana, não como "fix" de motion.
- **Sem biblioteca de animação.** Manter assim: nada de framer-motion/gsap sem necessidade comprovada (CSS + WAAPI resolvem tudo aqui). Regra da marca e da skill coincidem.
- **Reduced-motion não pode esconder estado.** O bloco atual já respeita isso; qualquer novo motion precisa manter feedback/compreensão no modo reduzido.
- **Feel não se julga só no código.** Crossfades, springs e o "sniff" do mascote precisam de feel-check (câmera lenta, device real) na fase de execução.

---

## 7. Recomendações (o que fazer — e o que não fazer)

**Fazer (baixo esforço, alto valor):**
- Consolidar tokens de motion (§ Plano, lote 1).
- Reduzir o Reveal a âncoras de seção + corrigir o risco de conteúdo oculto (lote 3).
- Dar entrada/saída ao toast do admin (lote 2/6).
- Padronizar press-feedback (lote 2).

**Não fazer (rejeitado por padrão):**
- Scroll-reveal/stagger em todas as seções e cards, parallax, headline letra-a-letra, contadores, barras crescendo, CTA pulsando, fundo/gradiente animado, partículas, scroll preso, mouse-tracking decorativo novo, tilt 3D, cursor custom, mascote seguindo cursor em novas superfícies, animação de tabela/KPI no admin, transição de página em toda navegação.
- Instalar biblioteca de animação.
- "Corrigir" layout com animação.

**Aceitável concluir que várias páginas não precisam de nenhuma animação nova** — edições, Pro, daily e a maioria do admin entram nessa categoria.

---

_Detalhamento por elemento em `MOTION-MATRIX.md`. Planos executáveis por lote em `MOTION-IMPLEMENTATION-PLAN.md`. Nenhum plano deve ser executado sem aprovação humana._
