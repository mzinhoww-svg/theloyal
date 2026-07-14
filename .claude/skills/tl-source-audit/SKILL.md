---
name: tl-source-audit
description: Auditoria de segurança editorial do The Loyal (/source-audit). Valida hierarquia de fontes, vigência confirmada, anti-cópia, ausência de dado interno/CMI e a coerência de CPM/VPM/spread/TL Score de uma edição antes de publicar. Use ao revisar uma edição JSON, checar se uma oportunidade pode entrar no Deal Desk, ou auditar risco editorial.
---

# tl-source-audit

Camada humana/LLM de auditoria sobre o gate automático (`npm run validate`). O validador
pega o mecânico (disclaimer, emoji, vigência→veredito, TL Score↔faixa, URL). Esta skill
cobre o que exige julgamento: **qualidade da fonte, cálculo correto e anti-cópia**.

## 1. Hierarquia de fonte (Operating Manual §4.1)

| Nível | Fonte | Uso |
|---|---|---|
| 1 | Oficial com regulamento, vigência e mecânica | Sustenta destaque, cálculo e veredito |
| 2 | Oficial incompleta + editorial confiável | Destaque **com nota de limitação** |
| 3 | Editorial confiável sem confirmação oficial | Contexto/radar. Fora do ranking principal |
| 4 | Post social público sem confirmação | Gera investigação, **não** sustenta recomendação |
| 5 | Rumor, print, grupo fechado, sem link | **Não usar** |

## 2. Overrules obrigatórios (§5.4)

- Sem vigência confirmada → veredito final `nao-confirmado`.
- Sem fonte confiável → **não entra no Deal Desk**.
- Exige clube/cartão e o texto não deixa claro → bloquear.
- Conta usa pontos de origem como se fossem milhas finais → bloquear.
- Conversão não confirmada → **não calcular CPM final** (nunca assumir 1:1 sem fonte).

## 3. Fórmulas a reconferir (§6) — números públicos e auditáveis

```
CPM (compra direta)   = valor_pago / (pontos_ou_milhas / 1000)
CPM (com bônus)       = valor_pago / ((pontos + bonus) / 1000)
CPM final (transfer.) = custo_origem / ((pontos * taxa * (1 + bonus_%)) / 1000)
Preço implícito (P+D) = dinheiro_adicional / ((pontos_cheio - pontos_reduzido) / 1000)
VPM (resgate)         = valor_comparavel / (pontos_usados / 1000)
Spread                = VPM_estimado - CPM_efetivo
Custo de elegibilidade: somar clube/cartão/segmento ao custo real
```
Só calcular VPM com preço comparável e verificável. Separar leitura de quem já é elegível
de quem precisa pagar para se tornar elegível.

## 4. Anti-cópia (§9.4) e regras invioláveis

- Título, abertura e estrutura do bloco **próprios**; regulamento **resumido**, não reproduzido.
- Nenhum dado interno de empresa, nenhum CMI, nenhuma métrica proprietária.
- Sem promessa de ganho, sem urgência artificial, sem emoji.

## 5. Saída da auditoria

Relatório com três seções:

1. **Problemas** (bloqueiam publicação): fonte insuficiente, vigência não confirmada,
   cálculo incorreto, TL Score sem justificativa, trecho próximo demais da fonte.
2. **Riscos** (avisar): fonte nível 2/3 sem nota de limitação, spread negativo tratado como valor,
   elegibilidade não separada.
3. **Correções** propostas dentro do sistema (ex.: rebaixar para `nao-confirmado`, recalcular CPM final,
   reescrever título).

Rodar `npm run validate content/editions/NNNN.json` como checagem mecânica antes de emitir o parecer.
Se qualquer problema do grupo 1 existir, o parecer é **REPROVADO**.
