# The Loyal — Sistema de logo v1

Marca **100% tipográfica** (wordmark Fraunces) + **monograma TL construído** (geometria fixa,
font-independente). Zero gradiente, zero sombra, zero ícone anexado. Segue
THE-LOYALTY-BRAND-GUIDELINES §3 e o brand kit (`assets/logo/*`).

## Arquivos

| Arquivo | Uso |
|---|---|
| `the-loyalty-wordmark.svg` | Wordmark Ink — fundo Paper/claro |
| `the-loyalty-wordmark-inverted.svg` | Wordmark Paper — fundo Ink/escuro |
| `the-loyalty-wordmark-tagline.svg` | Wordmark + "Fidelidade com conta feita" — relatórios, mídia kit |
| `tl-monogram.svg` | Monograma primário — quadrado Ink, letras Paper |
| `tl-monogram-green.svg` | Variante acento — quadrado Verde `#00A878`, letras Ink (badge/selo) |
| `tl-monogram-inverted.svg` | Monograma para superfície escura — quadrado Paper, letras Ink |
| `favicon.svg` | Monograma com respiro reduzido, legível em 16–32px |

No site (React), prefira `components/Logo.tsx` (`<Wordmark />`, `<Monogram />`) — usa os tokens
do tema e renderiza a Fraunces já carregada via `next/font`.

## Regras de aplicação

- **Área de respiro:** altura da letra L do wordmark em todos os lados.
- **Tamanhos mínimos:** wordmark 120px de largura · monograma 24px.
- **Cantos do monograma:** retos (radius 0). Nunca arredondar.
- **Proibido:** gradiente, sombra, inclinação, ícone de avião/cartão/moeda anexado,
  aplicação sobre foto sem camada de contraste, cor fora da paleta.
- **Wordmark:** só Ink sobre claro ou Paper sobre escuro. Nunca amarelo, nunca verde como texto.

## Produção (media kit / e-mail)

Os SVGs de wordmark usam `<text>` com Fraunces + fallback Georgia. Para assets distribuídos
fora do site (e-mail, PDF, terceiros), **converter o texto em contornos** (ex.:
`inkscape --export-text-to-path` ou o "Object to Path" equivalente) para independência de fonte.
O monograma e o favicon já são geometria pura — não precisam de conversão.
