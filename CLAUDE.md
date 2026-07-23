# The Loyal — CLAUDE.md

> Arquivo de contexto do projeto. Precede preferências estéticas do modelo.
> Hierarquia de verdade: **THE-LOYALTY-LLM-SYSTEM.md > DESIGN.md > THE-LOYALTY-BRAND-GUIDELINES.md > PONTO-MASCOTE-GUIA.md > TL-GRAPHICS.md > Operating Manual v1**.
> Se um pedido conflitar com uma regra inviolável, sinalize o conflito antes de executar.

## Identidade

The Loyal é uma **mídia vertical independente** sobre loyalty, pontos, milhas, cartões, bancos, varejo, cashback, CRM e comportamento de consumo. Não é blog de cupom, não é comunicação oficial de programa, não é SaaS genérico.

- **Personalidade:** analítico, independente, direto, premium editorial, confiável. Arquétipo **Sage** — autoridade vem do método, não do tom.
- **Frame mental:** mídia premium tipo Morning Brew/Axios com clareza de Stripe.
- **Promessa:** em 5 minutos, o leitor entende o que mudou, por que importa, qual é a conta e qual é o risco.
- **Regra-mãe visual:** *a imagem é dado.* Fotografia é substituída por data-art, cenas do Ponto e banners de template (TL-GRAPHICS.md).

## Stack e estrutura

**Next.js 14 (App Router) · TypeScript strict · Tailwind. Sem outras dependências** (nada de framer-motion, shadcn, lucide, styled-components).

```
app/
  layout.tsx             fontes via next/font, metadata pt-BR, skip link → #conteudo
  page.tsx               Nav → main#conteudo (seções) → Footer
  globals.css            base, .tl-label/.tl-container/.tl-section, keyframes do Ponto, reduced-motion
  icon.svg · apple-icon.png   favicon do mascote (auto-detectados pelo App Router)
  api/subscribe/route.ts route handler POST — Beehiiv server-only
components/
  ui.tsx                 Reveal, SectionLabel, TLBadge, ContaBlock
  PontoMascot.tsx        mascote SVG (poses padrão/lupa, idle, tilt, celebrate, interações)
  SubscribeForm.tsx      form + honeypot + validação + aria-live
  graphics.tsx           CompareBanner, PontoReadingScene, Sparkline, LedgerTexture
  shell.tsx              Nav sticky, Hero, Footer
  EdicaoMock.tsx         edição exemplo — SEM Ponto
  sections.tsx           Problema, Metodo, Recebe, ParaQuem, ComoAnalisamos, CTAFinal
tailwind.config.ts       tokens da marca (fonte única de hex)
```

## Regras invioláveis

Não podem ser quebradas nem por pedido direto no meio da tarefa.

1. Nunca usar dado interno de empresa, CMI ou métrica proprietária de programa.
2. Nunca copiar texto, título ou estrutura de fonte externa. Redação sempre própria.
3. Nunca prometer ganho. Bônus alto não é valor automático.
4. Nunca usar urgência artificial ("imperdível", "corra", "garanta já", countdown, vermelho de urgência).
5. Nunca usar emoji no corpo editorial ou em UI.
6. Nunca usar avião, cartão 3D genérico, stock photo ou gradiente decorativo.
7. **Amarelo `#F2C94C` nunca como texto** — somente fill com texto Ink por cima.
8. **`#00C48C` (green-500) nunca como texto sobre Paper** — green-500 só em fill/SVG e sobre Ink (dark). Texto verde é `#00A878` (green-600) em rótulos de veredito/accent e em fill+text-pair (chip). **Exceção — texto de LINK: `#007A57` (green-700)**, porque green-600 reprova contraste AA sobre Paper/Surface (~2.6–3.1:1) e green-700 clara ≥4.55:1 na mesma matiz (D-090).
9. Faltou dado para cálculo ou veredito → classificar **"Não confirmado"**. Nunca chutar.
10. Todo conteúdo com recomendação carrega o disclaimer: *"Promoções podem mudar sem aviso. Confira sempre as regras no site oficial antes de comprar, transferir ou resgatar."*

**Regras de código adicionais:**
- Fundo de página **Paper `#FAF7F0`**, nunca branco puro. Cards em **Surface `#FFFFFF`**.
- **Nunca hardcodar hex em componente** — usar classes do tema. **Exceção única:** a geometria SVG do mascote (`PontoMascot.tsx`) e dos gráficos (`graphics.tsx`), que usa os hex das constantes documentadas.
- Nenhuma cor default do Tailwind (slate, zinc, emerald, indigo…), nenhum `bg-white`/`text-white`.
- Todo número de análise (CPM, VPM, R$, %, TL Score) em **JetBrains Mono**.
- Comentários mínimos, só onde a intenção não é óbvia.

## Design tokens

Valores exatos (espelhados em `tailwind.config.ts`). Não inventar variações.

| Token Tailwind | Hex | Uso |
|---|---|---|
| `ink` | `#111111` | Texto, títulos, botões primários, fundos dark |
| `paper` / `paper-dark` | `#FAF7F0` / `#F1ECE1` | Fundo de página / faixas e chips |
| `surface` | `#FFFFFF` | Cards e painéis |
| `line` | `#E5E0D5` | Bordas e divisores (nome evita conflito com a utility `border`) |
| `gray-700/500/400` | `#3D3A34` / `#555555` / `#8A8578` | Ink dark / texto secundário / metadados |
| `green-100/500/600/700` | `#D9F4E9` / `#00C48C` / `#00A878` / `#007A57` | fill / **fill+SVG** / **texto** / hover-texto |
| `blue-100/600/700` | `#E4EAFF` / `#315CFF` / `#2547CC` | fill / Sinal do dia, links, foco / hover |
| `yellow-100/500` | `#FCF0CE` / `#F2C94C` | fill claro / **fill (texto Ink)** |
| `red-100/600/700` | `#F9E2E2` / `#D64545` / `#B53A3A` | fill / Evitaria, risco / hover |
| `caramel` / `dark` / `cream` | `#D9A15B` / `#B8813F` / `#F3E3C3` | mascote (SVG) |

**Mapa semântico TL Score** (obrigatório em qualquer UI com veredito):

```
85–100  Vale agir             → green-600 (#00A878)
70–84   Vale olhar            → blue-600  (#315CFF)
55–69   Só casos específicos  → gray-400  (#8A8578)
40–54   Esperaria             → yellow-500 fill, texto Ink
0–39    Evitaria              → red-600   (#D64545)
s/dado  Não confirmado        → gray-400, borda tracejada
```

Espaçamento base 4px (4/8/12/16/24/32/48/64/80/120). Radius 8 padrão / 12 cards grandes / 9999 pills. Sombra: nenhuma ou `0 1px 3px rgba(17,17,17,0.08)` — flat editorial.

## Tipografia

| Uso | Fonte | Peso | Tamanho |
|---|---|---|---|
| Display/Hero | Fraunces | 700 | clamp 40–64px |
| H1 / H2 | Fraunces | 700 / 600 | 32–40 / 24px |
| Label de seção | Inter | 600 | 12–14px caps, tracking 0.08em |
| Body | Inter | 400 | ≥ 16px, line-height 1.6 |
| Dados/fórmulas | JetBrains Mono | 400–600 | 14–16px |

- **Serif (Fraunces) só em títulos**, nunca no corpo.
- Fontes via `next/font/google`, `display: swap`, variáveis `--font-display/-sans/-mono`. Fallbacks Georgia / Arial / Consolas.

## Componentes canônicos

Usar estes padrões antes de inventar novos (implementados em `components/`):

1. **TLBadge** (`ui.tsx`) — pill com fundo semântico, label CAPS Inter 600 12px + score em mono. `score` obrigatório, exceto `nao-confirmado`.
2. **ContaBlock** (`ui.tsx`) — ritual "conta feita": fundo **Ink fixo** (não muda em dark), mono Paper, chave gray-400 / valor à direita, resultado com borda gray-700 em green-500. Responsivo 13→14px.
3. **SectionLabel** (`ui.tsx`) — linha 1px `line` + label CAPS. Divisor canônico de seção.
4. **CompareBanner / Sparkline / PontoReadingScene / LedgerTexture** (`graphics.tsx`) — data-art com **um único destaque verde** por peça, valores em mono, tese em Fraunces. LedgerTexture é a **única peça decorativa** (opacity 0.05, `hidden lg:block`, aria-hidden).
5. **EdicaoMock** — Sinal do dia (barra blue-600), Deal Desk (ContaBlock + TLBadge + fonte), Fecha logo (tag yellow-500 + CPM mono). Prova de produto no lugar de screenshot/stock.
6. **CTA primário** — fundo green-600, texto Paper, hover green-700, radius 8px.

Vocabulário proprietário com grafia fixa: TL Score, Vale agir, Vale olhar, Só para casos específicos, Esperaria, Evitaria, Não confirmado, Sinal do dia, Deal Desk, Fecha logo, conta feita.

## Mascote Ponto

Vira-lata caramelo cético — **companheiro do leitor, não selo** (o selo é o TL Score). Guia completo em PONTO-MASCOTE-GUIA.md.

- **Elementos fixos:** coleira verde `#00C48C`, tag TL (Ink, texto Paper, mono), sobrancelha direita levantada na pose padrão. Contorno Ink 3px, flat, zero gradiente/sombra.
- **Poses:** `padrao` (ceticismo) e `lupa` (Não confirmado). `tilt` inclina 12° no foco do form. `celebrate` (orelhas em pé) é a **única celebração permitida**, só no sucesso do formulário.
- **Aparece só em:** hero, cena da metodologia, pós-conversão, empty states/404/loading, footer da newsletter, Sobre/Metodologia.
- **Nunca:** dentro do Deal Desk ou de bloco de cálculo, ao lado de veredito real, em conteúdo patrocinado, acima de 30% da largura, falando em 1ª pessoa com promessa ("aproveite", "corra"). Voz em 3ª pessoa, humor seco.
- **Animação:** transform/opacity apenas, sempre com fallback estático em `prefers-reduced-motion`. Idle sutil; tracking de pupilas só com o SVG visível na viewport.
- Em conflito entre simpatia e credibilidade, **credibilidade vence — corta o mascote da peça.**

## Acessibilidade (gates de publicação)

- `html lang="pt-BR"`, skip link → `#conteudo`, landmarks `header`/`main`/`nav`/`footer`, **uma única `h1`**.
- Contraste AA sobre Paper `#FAF7F0` (medido): Ink 17.2:1, Muted 7.1:1, **green-700 (texto de link) 5.0:1** (green-600 NÃO é texto de link — reprova ~2.9:1, D-090), blue-600 4.8:1, red-600 4.9:1. Body ≥ 16px.
- Foco visível custom (anel blue-600), alvos de toque ≥ 44px.
- Formulário: label, `aria-invalid`, erro via `aria-describedby`, status em `aria-live`.
- `prefers-reduced-motion` desliga idle do mascote, reveals, tilt, tracking de pupilas e smooth scroll.

## Comandos

```bash
npm install
npm run dev      # http://localhost:3000
npm run build    # produção (deve compilar estático, página / static)
npm run start
npm run edition  # validate → render → publish (índices locais)
npm run beehiiv  # publica no Beehiiv o conteúdo já renderizado (draft por padrão)
```

Formulário: `POST /api/subscribe` (server-only). Sem `BEEHIIV_API_KEY`/`BEEHIIV_PUBLICATION_ID` → modo mock. Chave nunca no client. Ver README.

Publisher: `npm run beehiiv` publica a edição **já renderizada** no Beehiiv sem reescrever conteúdo (`POST /v2/publications/{pub_id}/posts`). Roda o QA gate antes, é idempotente (não dispara duas vezes), cria só **rascunho** por padrão, e sem credenciais opera em modo mock. Status em `content/beehiiv-status.json`. Ver `content/README.md`.

## Checklist de saída (rodar antes de entregar qualquer peça)

1. Todas as cores vêm dos tokens? Nenhum hex fora de `PontoMascot.tsx`/`graphics.tsx`?
2. Números de análise em JetBrains Mono?
3. Serif apenas em títulos?
4. Fundo de página é Paper, não branco puro? Cards em Surface?
5. Verde de texto é green-600? Amarelo só como fill com Ink?
6. Veredito usa o vocabulário e a cor semântica corretos?
7. Zero emoji, stock photo, avião, gradiente, urgência artificial?
8. Contraste AA? Body ≥ 16px? Alvos ≥ 44px? Uma h1? Landmarks + skip link?
9. `prefers-reduced-motion` respeitado?
10. Disclaimer presente quando há recomendação? Texto próprio, fonte citada?
11. Ponto dentro das regras do guia (fora do Deal Desk, sem promessa)?
12. `npm run build` compila sem erro nem type error?

Se qualquer item falhar, corrigir antes de entregar. Se o pedido exigir quebrar uma regra inviolável, apontar o conflito e propor alternativa dentro do sistema.
