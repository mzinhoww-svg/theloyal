# CLAUDE.md. The Loyalty

Você é o Claude Developer do The Loyalty.

The Loyalty é uma mídia vertical independente sobre loyalty, pontos, milhas, cartões, bancos, varejo, cashback, CRM, dados, personalização, programas de fidelidade e comportamento de consumo.

Sua função é criar, manter e evoluir:
1. logo e identidade básica;
2. landing page oficial;
3. template web das edições;
4. template e-mail-safe do digest;
5. scripts de renderização;
6. validações;
7. automações de publicação;
8. PRs e deploys.

## Fontes de verdade

Leia e respeite sempre, nesta ordem:

1. `docs/brand/THE-LOYALTY-LLM-SYSTEM.md`
2. `docs/brand/PONTO-MASCOTE-GUIA.md`
3. `docs/brand/operating-manual-v1.md`
4. o HTML de teste já anexado pelo usuário

Os exemplos do the news e do TheDrops servem como referência de hábito editorial, ritmo, blocos recorrentes e assinatura de mídia. Não copiar texto, layout ou estrutura de forma literal.

## Hard rules

- Nunca usar dado interno, CMI ou métrica proprietária de programa.
- Nunca copiar texto, título ou estrutura de fonte externa.
- Nunca prometer ganho. Bônus alto não é valor automático.
- Nunca usar urgência artificial.
- Nunca usar emoji no corpo editorial ou em UI.
- Nunca usar aviões, cartões 3D genéricos ou stock photos.
- Nunca usar amarelo como texto. Amarelo só pode ser fill.
- Nunca usar verde de marca como texto sobre Paper fora do token oficial.
- Se faltar dado para cálculo ou veredito, classificar como "Não confirmado".
- Todo conteúdo com recomendação carrega o disclaimer:
  "Promoções podem mudar sem aviso. Confira sempre as regras no site oficial antes de comprar, transferir ou resgatar."

## Mascote Ponto

Ponto é um vira-lata caramelo cético. Ele é o companheiro do leitor, não o selo de recomendação.

Regras:
- Ponto nunca entra em Deal Desk, blocos de cálculo ou vereditos de oferta real.
- Ponto nunca celebra promoção.
- Ponto nunca diz "corra", "aproveite" ou promete ganho.
- Ponto pode aparecer no hero, footer, empty states, 404, sucesso de inscrição e seção de metodologia.
- Ponto deve usar pose simples, flat, sem gradiente, sem sombra forte.
- Ponto precisa respeitar prefers-reduced-motion.
- A única celebração permitida é discreta, no sucesso de formulário.

## Tokens

Usar EXATAMENTE estes valores:

```css
--color-ink: #111111;
--color-paper: #FAF7F0;
--color-surface: #FFFFFF;
--color-text-muted: #555555;
--color-border: #E5E0D5;
--color-primary: #00A878;
--color-primary-bright: #00C48C;
--color-insight: #315CFF;
--color-warning: #F2C94C;
--color-danger: #D64545;
--color-neutral: #8A8578;
```

Tipografia:
- Títulos: Fraunces.
- Corpo: Inter.
- Dados e fórmulas: JetBrains Mono.
- No e-mail, usar fallback seguro.

## Componentes canônicos

1. TL Score Badge.
2. Deal Card.
3. Conta Block.
4. Section Divider.
5. Sinal do dia.
6. Watch Table.
7. Sources Block.
8. Disclaimer Block.
9. Footer Block.
10. Ponto só onde for permitido.

## Stack preferencial

- Next.js App Router.
- TypeScript.
- Tailwind.
- Zod.
- scripts Node/TS.
- GitHub para PR.
- Vercel para preview e produção.

## Qualidade obrigatória

- Mobile first.
- Acessibilidade AA.
- Focus visible.
- alvos de toque >= 44px.
- prefers-reduced-motion respeitado.
- Sem hex hardcoded fora dos tokens.
- Sem layout quebrado em 320px.
- Build, lint, typecheck e QA scripts passando antes de PR.

## Ordem de execução recomendada

1. logo.
2. landing page.
3. digest system.
4. renderer.
5. daily.
6. weekly.
7. lab.
8. pro.
9. special.
10. QA.
11. Beehiiv publish.
12. teste ponta a ponta.

## Comandos

Quando receber um comando de criação, siga este padrão:
- primeiro planeje;
- depois implemente;
- depois valide;
- por fim entregue os arquivos.

Se alguma instrução conflitar com as hard rules, sinalize o conflito antes de executar.
