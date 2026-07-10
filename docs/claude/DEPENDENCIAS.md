# Mapeamento de Dependências — The Loyalty

> Gerado em 2026-07-10. Inventário real de dependências externas: uso no código,
> criticidade, risco de manutenção e superfície de ataque.

## 1. Sumário

| Métrica | Valor |
|---|---|
| `dependencies` | **3** (next, react, react-dom) |
| `devDependencies` | **7** |
| Total direto | **10** |
| Total no lockfile (diretas + transitivas) | **118** |
| Transitivas | **~108** |
| Órfãs | **0** |
| Redundâncias | **0** |
| Abandonadas | **0** |

O projeto cumpre a regra do CLAUDE.md ("Next.js + TypeScript + Tailwind, sem
outras dependências"): não há nenhuma lib de UI, animação, ícone, data ou HTTP.
Os scripts de edição (`scripts/`, `renderer/`, `lib/`) usam **apenas built-ins
do Node** (`node:fs`, `node:path`, `node:crypto`, `node:url`) — zero dependência
externa fora do app Next.

## 2. Essenciais

Todas as 3 dependencies são essenciais — não existe camada marginal ou órfã.

| Nome | Versão | O que faz no projeto | Usos diretos | Status |
|---|---|---|---|---|
| `next` | 14.2.15 | Framework inteiro: App Router, `next/font`, `next/link`, route handler `/api/subscribe`, build estático | 12 imports em 7 arquivos | Ativa (16.x em 2026-07) |
| `react` | 18.3.1 | Runtime de todos os componentes; hooks em 6 arquivos client + JSX implícito em 17 `.tsx` | 6 imports diretos + 17 arquivos JSX | Ativa (19.x em 2026-06) |
| `react-dom` | 18.3.1 | Renderização DOM/SSR — consumida internamente pelo Next, sem import direto | 0 imports diretos (peer obrigatória do Next) | Ativa (19.x em 2026-06) |

**Blast radius se sumir amanhã:**

- `next` — total. O site, o roteamento, as fontes, o favicon e a API de
  subscribe deixam de existir. Alternativas viáveis existem (Remix, Astro,
  Vite + React Router), mas seria reescrita do app, não troca de pacote.
- `react` / `react-dom` — total. Todos os 17 componentes `.tsx` dependem do
  runtime. Alternativa API-compatível: Preact (`preact/compat`) — possível,
  mas sem ganho que justifique no tamanho atual.

Fora de escopo por regra do prompt: não há sugestão de migração de framework.

## 3. Relevantes e Marginais

Não existem. A distribuição é binária: 3 essenciais e nada abaixo disso.

## 4. Órfãs

**Nenhuma.** `react-dom` tem 0 imports diretos no código, mas **não é órfã**:
é peer dependency obrigatória do Next (o próprio Next a importa para SSR e
hidratação). Removê-la quebra `npm install` e o build. Confirmado por grep
amplo em `.ts/.tsx/.js/.mjs/.json` — só aparece em `package.json` e lockfile,
que é exatamente o esperado para uma peer do framework.

## 5. Redundâncias

**Nenhuma.** Não há dois pacotes com a mesma função, nem pacote com equivalente
nativo, nem polyfill obsoleto. Os pontos onde projetos costumam acumular libs
já são resolvidos nativamente aqui:

- HTTP: `fetch` nativo (route handler e publisher Beehiiv)
- Hash/crypto: `node:crypto` (scripts)
- Animação: CSS keyframes em `globals.css` (sem framer-motion)
- Ícones/mascote: SVG próprio em `PontoMascot.tsx`/`graphics.tsx` (sem lucide)

## 6. Abandonadas

**Nenhuma.** Todos os pacotes diretos tiveram release nos últimos 30 dias
(checado no registry npm em 2026-07-10).

O único risco de calendário é de **versão, não de manutenção**: o projeto está
em Next 14 / React 18, duas majors atrás do latest (Next 16 / React 19). A
linha 14.x ainda recebe patches de segurança, mas a janela encurta a cada major
nova. Não é urgente; entra como recomendação de médio prazo.

## 7. Superfície de ataque

| Camada | Pacotes |
|---|---|
| Diretas | 10 |
| Total no lockfile | 118 |
| Fator de multiplicação | ~12× |

118 pacotes no lockfile é uma superfície pequena para um app Next (projetos
típicos passam de 800). Quase tudo é subárvore do próprio Next (`@next/*`,
`@swc/*`) e da toolchain PostCSS/Tailwind — devDependencies que não vão para
o bundle do cliente.

## 8. devDependencies (seção curta)

| Nome | Versão | Uso confirmado | Status |
|---|---|---|---|
| `typescript` | 5.5.4 | `tsconfig.json`, todo o código | Ativa |
| `tailwindcss` | 3.4.10 | `tailwind.config.ts` (tokens da marca), `globals.css` | Ativa (4.x é a linha atual) |
| `postcss` | 8.4.38 | `postcss.config.mjs` | Ativa |
| `autoprefixer` | 10.4.19 | `postcss.config.mjs` | Ativa |
| `@types/node` | 20.14.0 | scripts e route handler | Ativa |
| `@types/react` | 18.3.3 | todos os `.tsx` | Ativa |
| `@types/react-dom` | 18.3.0 | par do `react-dom` | Ativa |

Todas as 7 estão em uso. Nenhuma remoção possível.

## 9. Recomendações por ordem de impacto

1. **Nada a remover.** O inventário está no mínimo viável — qualquer corte
   quebra build. Este é o estado que a maioria dos projetos tenta alcançar.
2. **Médio prazo: planejar upgrade Next 14 → 15/16 e React 18 → 19** em uma
   tarefa dedicada (com `npm run build` + QA gate como critério). Motivação é
   janela de patches de segurança da linha 14.x, não feature.
3. **Observação sobre Tailwind 3 → 4:** a v4 muda o modelo de configuração
   (CSS-first, sem `tailwind.config.ts` tradicional). Como o config é a fonte
   única dos tokens da marca, migrar exige cuidado extra — tratar junto com o
   upgrade do Next, nunca isolado num bump automático.
4. **Manter a disciplina atual:** antes de adicionar qualquer dependency nova,
   checar se `fetch`/`node:*`/CSS nativo resolve — foi essa regra que manteve o
   lockfile em 118 pacotes.
