# The Loyal — Plano de Implementação de Motion (por lotes)

> **Commit base da auditoria:** `e487d93` (`main`, inclui PR #66).
> **Status global:** TODO — nenhum lote implementado. Requer aprovação humana antes de qualquer execução.
> **Regras transversais (valem para todos os lotes):**
> - Só `transform` e `opacity` (nunca layout). Nunca `transition: all`. Nunca `ease-in` em UI. Nunca `scale(0)`.
> - UI < 300ms. Transitions (não keyframes) para UI dinâmica/interrompível.
> - Todo motion novo entra no bloco `prefers-reduced-motion` existente (`globals.css:110`).
> - Não instalar biblioteca de animação (CSS + WAAPI resolvem).
> - Não tocar no `StickyCTA` (lógica geométrica do PR #66).
> - Verificação de cada lote: `npm run lint && npm run typecheck && npm run build` + feel-check (câmera lenta no DevTools Animations + toggle reduced-motion) + screenshots antes/depois.

---

## Ordem recomendada e dependências

| Lote | Título | Depende de | Risco | Esforço |
| --- | --- | --- | --- | --- |
| 0 | Correções de motion existente | — | baixo | baixo |
| 1 | Tokens + reduced motion | 0 | baixo | baixo |
| 2 | Componentes globais (press, toast) | 1 | baixo | médio |
| 3 | Landing (Reveal) | 1 | **médio** (risco de marca) | médio |
| 4 | Anuncie | rota existir | — | condicional |
| 5 | Área do cliente | rotas existirem | — | condicional |
| 6 | Admin | 1, 2 | baixo | baixo |
| 7 | Revisão final (`review-animations`) | todos | — | baixo |

---

## Lote 0 — Correções de motion existente

**Objetivo:** eliminar riscos do que já existe, sem adicionar nada novo.

### 0.1 — Reveal não pode esconder conteúdo
- **Arquivos:** `components/ui.tsx` (Reveal), `app/globals.css:37-53`.
- **Comportamento atual:** `.tl-reveal { opacity: 0; transform: translateY(12px) }` até o IntersectionObserver adicionar `.is-in`. Se o IO não disparar (scroll muito rápido, JS falho, bots), o conteúdo permanece invisível.
- **Comportamento proposto:** conteúdo visível por padrão; a animação é uma *melhoria progressiva*. Opções (escolher uma na execução):
  - (a) Só aplicar `opacity:0` quando o JS confirmar suporte (ex.: adicionar classe `js-reveal` no `<html>` via script inline no `layout`); ou
  - (b) `@starting-style` para a entrada, mantendo o estado final visível no CSS base.
- **Critérios de aceite:** com JS desabilitado, todo o conteúdo da landing aparece; com scroll rápido até o fim, nenhuma seção fica invisível.
- **Testes:** `next build` (rota `/` estática); DevTools → desabilitar JS → conferir landing completa; reduced-motion → tudo visível.
- **Risco:** baixo. **Rollback:** reverter `ui.tsx`/`globals.css`.

### 0.2 — Gate de hover para qualquer transform (preventivo)
- **Arquivos:** `globals.css` (adicionar utilitário/regra), revisão de `sections.tsx`/`shell.tsx`.
- **Atual:** hovers são só de cor (ok). **Proposto:** documentar/estabelecer que qualquer hover com `transform` fique sob `@media (hover: hover) and (pointer: fine)`. Nada a mudar hoje além de registrar a regra (não há transform-hover ainda).
- **Aceite:** nenhum `:hover` com `transform` fora do media query após lotes futuros.

---

## Lote 1 — Tokens e reduced motion

**Objetivo:** uma fonte única de duração/easing; reduced-motion pronto para o novo motion.

- **Arquivos:** `tailwind.config.ts`, `app/globals.css`.
- **Atual:** só `ease-standard: cubic-bezier(0.2,0,0,1)` no Tailwind; durações ad-hoc (150/200/400ms).
- **Proposto (avaliar e justificar cada token):**

```css
:root {
  --motion-instant: 100ms;  /* micro-feedback */
  --motion-press:   140ms;  /* press de botão (100–160) */
  --motion-small:   180ms;  /* toast, tooltip pequeno */
  --motion-medium:  240ms;  /* dropdown/estado */
  --motion-panel:   300ms;  /* modal/drawer */
  --motion-explain: 600ms;  /* explicativo (fora de UI) */

  --ease-out:    cubic-bezier(0.23, 1, 0.32, 1);
  --ease-in-out: cubic-bezier(0.77, 0, 0.175, 1);
  --ease-panel:  cubic-bezier(0.32, 0.72, 0, 1);
}
```

- **Reconciliação obrigatória:** o projeto já usa `ease-standard = cubic-bezier(0.2,0,0,1)` (Tailwind). Decidir **um** de:
  - (a) tratar `ease-standard` como o `--ease-out` do sistema (renomear/alinhar), ou
  - (b) manter `ease-standard` e adicionar só `--ease-in-out`/`--ease-panel`.
  Evitar dois ease-out quase-iguais convivendo (isso é justamente um achado de consolidação).
- **Justificativa por token:** `press` casa a faixa 100–160ms; `small` cobre toast/tooltip (125–200); `medium` cobre estado/dropdown (150–250); `panel` cobre modal/drawer (200–500, escolhido curto=300 para o tom crisp); `explain` só para peças explicativas (não-UI). `--ease-out` para entrar/sair, `--ease-in-out` para mover, `--ease-panel` para drawers iOS-like.
- **Reduced motion:** o bloco atual (`globals.css:110`) já zera tudo; garantir que os novos tokens sejam usados **dentro** de transições `transform/opacity` que o bloco já cobre. Nenhuma exceção que esconda estado.
- **Aceite:** nenhuma duração hardcoded nova; `grep` não acha `transition: all`; build verde.
- **Risco:** baixo. **Rollback:** remover tokens (nada os consome ainda).

---

## Lote 2 — Componentes globais (press-feedback + toast)

### 2.1 — Press-feedback padronizado
- **Arquivos:** `components/SubscribeForm.tsx`, `components/admin/SubmitButton.tsx`, botões em `shell.tsx`, `components/admin/ui.tsx`.
- **Atual:** só o submit do form tem `active:translate-y-px`.
- **Proposto:** classe utilitária de press: `:active { transform: scale(0.97) }` com `transition: transform var(--motion-press) var(--ease-out)`. Aplicar a todos os pressionáveis.
- **Aceite:** todo botão responde ao toque/click com scale sutil; reduced-motion mantém o `:active` de cor, remove o scale.
- **Testes:** feel-check em device real (toque) + desktop (click).
- **Risco:** baixo. **Rollback:** remover a classe.

### 2.2 — Toast do admin com entrada/saída
- **Arquivos:** `components/admin/toast.tsx`.
- **Atual:** toast entra/sai instantaneamente (só `aria-live`, `setTimeout` 6s).
- **Proposto:** entrada `opacity 0→1` + `translateY(8px→0)`; saída inverso. **Transition** (interrompível para stacking), `--motion-small` (180ms) `var(--ease-out)`. Entrada via `@starting-style` ou `data-mounted`. Manter `aria-live="polite"`.
- **Aceite:** empilhar toasts rapidamente nunca reinicia do zero; sumiço suave; reduced-motion vira só `opacity`.
- **Testes:** disparar múltiplos toasts; toggle reduced-motion; câmera lenta.
- **Risco:** baixo. **Rollback:** reverter `toast.tsx`.

---

## Lote 3 — Landing (calibrar o Reveal)

**Objetivo:** manter a leitura editorial contínua; eliminar o reveal por card.

- **Arquivos:** `components/sections.tsx` (14 `<Reveal>`), `app/page.tsx` (5 `<Reveal>`), `components/ui.tsx`, `app/globals.css`.
- **Atual:** cada card de grid é envolvido em `<Reveal>` → reveal/stagger por item em quase toda a landing.
- **Proposto (escolher na execução, com checagem visual):**
  - (a) **Remover** `<Reveal>` dos itens de `.map()`; manter no máximo uma revelação sutil por *âncora de seção* (o header da seção), ou
  - (b) remover totalmente o reveal e confiar nas bandas de fundo (o redesign já dá ritmo sem motion).
- **Comportamento proposto:** se mantida, a entrada é `opacity` + `translateY(≤8px)`, 300–400ms `var(--ease-out)`, **uma vez**, nunca por card, nunca bloqueando.
- **Aceite:** scroll lento e rápido não produzem "cards se montando"; nenhuma seção fica invisível (ver 0.1); a página não recria sensação de blocos/slides.
- **Testes:** vídeo de scroll em 375 e 1280; comparar com os screenshots do PR #66; reduced-motion → sem deslocamento.
- **Risco:** **médio (marca)** — pode reintroduzir "blocos". Exige aprovação visual humana.
- **Rollback:** restaurar os `<Reveal>`.

---

## Lote 4 — Anuncie (condicional — rota não existe hoje)

- **Pré-condição:** existir `app/anuncie/page.tsx`. Hoje há só o link no footer.
- **Candidatos (quando existir):** transição curta entre etapas (`opacity`+`translateX`, `--motion-medium`), feedback de seleção (borda/scale sutil), barra de progresso (`linear`), upload (indeterminado sem spinner girando exagerado), preview (crossfade), confirmação/sucesso raro (delight pontual).
- **Rejeitar:** mockups em loop, números contando, cards girando, form tremendo, labels com grande movimento, CTA pulsando, estatísticas decorativas.
- **Aceite/testes/rollback:** definir quando a rota existir. **Não implementar agora.**

---

## Lote 5 — Área do cliente (condicional — não existe hoje)

- **Pré-condição:** existirem rotas de auth/onboarding/perfil/assinatura/pagamento.
- **Orçamento:** baixo. **Candidatos:** toast, confirmação de salvar, modal/drawer (mobile), onboarding inicial (1ª vez), empty state inicial, sucesso raro.
- **Rejeitar:** entrada de página a cada navegação, animação de tabela, stagger de linhas, métricas contando, gráfico redesenhando, filtros/busca/paginação animados, fade da tela inteira a cada update.
- **Não implementar agora.**

---

## Lote 6 — Admin

- **Arquivos:** `components/admin/*`, `app/admin/(panel)/*`.
- **Escopo mínimo (só o que tem propósito):**
  - Toast (já no lote 2.2).
  - Press-feedback (lote 2.1).
  - **(Opcional)** indicador sutil de `isPending` no LiveRefresh (`aria-busy` + `opacity` leve) — sem spinner girando.
  - **(Se existir ação destrutiva)** hold-to-confirm com `clip-path` assimétrico (press ~2s linear, release 200ms `ease-out`).
  - **(Se criados modais/drawers)** seguir tokens + origin-aware (modal center; drawer `translateY(100%)`).
- **Rejeitar:** animação de tabela/KPI, contadores, gráfico desenhando, hover com escala em linhas, filtro/busca/paginação/command-palette animados, transição de página, motion decorativo.
- **Aceite:** admin permanece "crisp"; nenhuma animação em operação de dezenas/dia.
- **Risco:** baixo. **Rollback:** por componente.

---

## Lote 7 — Revisão final

- **Ferramenta:** skill `review-animations` sobre o diff acumulado (esta skill é reservada para revisar implementação, não para a fase 1).
- **Checklist:** sem `transition: all`; sem `ease-in` em UI; sem `scale(0)`; sem layout animado; todo hover-transform sob `@media (hover:hover)`; reduced-motion preserva feedback; durações < 300ms em UI; tokens consolidados; nenhuma lib nova.
- **Feel-check final:** câmera lenta (DevTools Animations 10%), device real para toque, olhos frescos no dia seguinte.
- **Gates:** `npm run lint && npm run typecheck && npm run build` + gates editoriais (`validate`/`render`/`qa`) verdes.

---

## Critérios de qualidade (para julgar a implementação)

A implementação **falha** se: recomendar/implementar motion para "preencher a matriz"; animar tudo; usar a mesma solução em marketing e admin; ignorar frequência/touch/reduced-motion; instalar biblioteca sem necessidade; propor motion sem propósito; ou tentar corrigir layout com animação.

A implementação **passa** se: a landing continua editorial e contínua; o admin continua crisp; o único motion novo tem propósito claro (feedback/continuidade); reduced-motion preserva compreensão; e várias páginas permanecem sem nenhuma animação nova — por decisão, não por esquecimento.
