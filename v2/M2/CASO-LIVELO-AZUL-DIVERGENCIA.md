# Caso `livelo→azul` — divergência blog × oficial (primeiro Deal Desk, D-045)

> Primeiro caso concreto que justifica a **arquitetura de tiers de fonte** e a
> regra "Deal Desk exige TIER 1" (D-044/D-045). Guardar: é a evidência de por que
> o produto é rigoroso com fonte, útil quando alguém questionar o rigor.

## O que aconteceu

A campanha `livelo-azul-transferencia-2026-07-31` foi ingerida de **fonte de
terceiro** (`melhorescartoes.com.br`, TIER 2, `[confianca:baixa]`) como **115%**.
Score, CPM e o "primeiro Deal Desk" foram computados sobre esse 115%.

Ao rodar o passo de confirmação TIER 1, fui à **fonte oficial** da Livelo
(`https://www.livelo.com.br/transfira-seus-pontos-promo-azulfidelidade`, página
**viva, HTTP 200**, renderizada pós-JS com Chromium). **O 115% NÃO aparece na
página oficial.** Os percentuais extraíveis do render (100, 125, 95, 85…) não são
atribuíveis com segurança à oferta azul — há ruído de CSS (`width:100%`) e bônus
de outros parceiros na mesma listagem. **Conclusão honesta:** o 115% do blog não é
corroborado pela fonte oficial, e o número azul vigente exige leitura humana
(confirmação manual TIER 1, D-003) — não se crava por scraping, e chutar violaria
a regra-mãe (oferta acionável com conta verdadeira).

## Por que o número importa tanto — a régua nos três cenários

Engine determinístico (import, mesmos vetores do banco: pesos v1, derivação
raridade n=1=0,85), rota `livelo→azul` (custo-base R$30, ratio 1, freq 44,
histórico de 41 bônus 70–130%, público geral):

| oferta | CPM | percentil | eficiência | raridade | abrangência | `tl_score_bruto` | banda (se TIER 1) |
|---|--:|--:|--:|--:|--:|--:|---|
| 100% | R$15,00 | 0,28 | 0,77 | 0,25 | 1,0 | **51** | **Esperaria** (40–54) |
| 115% (blog) | R$13,95 | 0,79 | 0,92 | 0,25 | 1,0 | **76** | **Vale olhar** (70–84) |
| 125% | R$13,33 | 0,98 | 0,97 | 0,25 | 1,0 | **85** | **Vale agir** (85–100) |

**O dado oficial move o veredito por TRÊS bandas.** Publicar o 115% do blog daria
"Vale olhar"; o número real pode ser "Esperaria" (medíocre) ou "Vale agir"
(excelente). O percentil é sensível porque a rota tem histórico denso: 100% cai no
28º percentil da própria rota (abaixo da mediana), 125% no 98º.

## A conta (como se monta)

`CPM_destino = custo_milheiro(livelo) / ((1 + bônus/100) × ratio)`, com
custo-base Livelo R$30/milheiro (D-039) e ratio `livelo→azul` = 1 (confiança alta,
âncora de paridade). O milheiro Azul sai a **R$15,00 (100%) / R$13,95 (115%) /
R$13,33 (125%)** — quanto maior o bônus, menor o custo do milheiro.

## RESOLUÇÃO — regulamento oficial (fonte TIER 1) recebido 2026-07-17

O operador leu a página oficial e enviou o **regulamento** (fonte TIER 1). Ele
resolve tudo e o 115% cai por terra:

- **Vigência real:** 10h de **15/04** às 23h59 de **17/04/2025** — encerrada há
  mais de um ano. O "vivo, vence 31/07/2026" era dado do blog desatualizado.
- **NÃO é 115%. É escala por público**, mesmo par `livelo→azul`, mesma janela:
  não-assinante **50%** · Clube Livelo/Azul **100%** · Clube Azul 6–12m **105%** ·
  Clube Azul tiers 1k–5k **110%** · Clube Azul 10k/20k (>12m) **120%**. Teto 300
  mil pts/CPF; bônus válido 6 meses.
- **115% não existe em nenhum tier.** O blog fabricou/mediou um número que a fonte
  oficial desmente — a prova concreta de por que blog é TIER 2 e o Deal Desk exige
  TIER 1. **Caso-fundador da arquitetura de tiers.**

**Correção aplicada (confirmação manual TIER 1, D-003):** a linha (`publico=geral`)
foi corrigida para o tier geral = **50%**, vigência 15–17/04/2025, `estado=historica`,
`tier=1`, regulamento como fonte oficial (`campanha_fontes` com a escala completa no
`payload` jsonb; trilha em `campanha_versoes` com o blog-115-refutado). Re-scorada:
a **50% geral → percentil 0** (50% é pior que todo o histórico 70–130% da rota),
CPM R$20,00, **`tl_score_bruto`=25 → "Evitaria"** (override nenhum, TIER 1 real).

**O produto num item:** o blog publicaria "Vale olhar" (76). A verdade para o
público geral é **"Evitaria" (25)** — um bônus abaixo do mercado da própria rota.
A fonte oficial transformou um "parece bom" num "evite". Fora do Deal Desk vivo por
vigência (encerrada); entra no **track record** como exemplo.

## Aprendizado registrado

1. **Blog como fonte de percentual é TIER 2 e foi pego errando o número** logo no
   primeiro item. Reforça D-044 (Deal Desk exige TIER 1) e D-045 (TIER 1 corrobora
   os TERMOS, não só a existência da página).
2. **Ponto em aberto (pergunta de identidade, M1):** o render mostrou 100% e 125%.
   Se forem a mesma oferta em **públicos diferentes** (ex.: 100% geral, 125%
   clube/cartão), então pela regra de identidade (público na tupla, M1) são **duas
   campanhas distintas**, cada uma com seu score e veredito — não "um número a
   corrigir". A leitura humana da página resolve isso.
3. Próximo passo: confirmação manual TIER 1 (D-003) com o número + público +
   vigência lidos da página oficial → `confirmar_tier1` (URL oficial, percentual
   corrigido, público, data, evidência jsonb) → re-score → item publicável.

*Promoções podem mudar sem aviso. Confira sempre as regras no site oficial antes
de comprar, transferir ou resgatar.*
