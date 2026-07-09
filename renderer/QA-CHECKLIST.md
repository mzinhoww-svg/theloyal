# Checklist de QA — The Loyal Daily (sistema de renderizacao)

O `qa-report.md` gerado por edicao cobre os itens dinamicos. Este checklist e o gate manual.

## Entrada
- [ ] JSON valida contra `renderer/edition.schema.json`
- [ ] `node scripts/validate-daily.mjs edicao.json --now <data>` retorna APROVADO
- [ ] Vigencia de cada Deal conferida na fonte oficial (`vigencia_iso` nao expirada)
- [ ] Links do footer preenchidos (ou placeholders `{{...}}` para o Beehiiv)

## Regras de conteudo (validadas por codigo)
- [ ] Deal Desk com no maximo 3 itens
- [ ] Secoes secundarias com no maximo 5 itens
- [ ] Blocos obrigatorios: Sinal do dia, Deal Desk, Conta feita, Fecha logo, O que evitaria, Disclaimer, Footer
- [ ] Conta feita com formula em mono
- [ ] Disclaimer presente
- [ ] Sem emoji, sem CMI/dado interno
- [ ] Mascote Ponto ausente de Deal Desk, contas, vereditos e demais blocos analiticos
- [ ] Sem aviao, stock photo (garantido: o sistema so gera texto e SVG proprio)

## E-mail (`daily-email.html`)
- [ ] 600px, uma coluna, tabelas role=presentation
- [ ] CSS 100% inline, sem `:root`, sem Google Fonts, sem JavaScript
- [ ] Fontes web-safe (Georgia / Arial / Courier)
- [ ] Preheader oculto presente
- [ ] Chips de veredito com rotulo textual (nunca so cor)
- [ ] Teste real em Gmail, Apple Mail, Outlook (win), Gmail app

## Web archive (React)
- [ ] `/daily/preview` renderiza a edicao
- [ ] Fraunces, Inter e JetBrains Mono aplicadas (fontes do app)
- [ ] Tokens oficiais via Tailwind
- [ ] Bloco da conta com scroll horizontal seguro no mobile
- [ ] `npm run build` sem erros

## Plain text (`daily-plaintext.txt`)
- [ ] Todas as secoes presentes, blocos separados por regua
- [ ] Vereditos por extenso, links no rodape
