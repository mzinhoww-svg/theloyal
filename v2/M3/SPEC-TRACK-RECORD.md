# M3 · Track Record — a prova de metodologia (SPEC, antes de código)

> **Por que (D-046/D-050/D-051).** A máquina está provada; o Deal Desk vivo espera
> **oferta forte** (offer-triggered). Enquanto espera, o produto tem conteúdo real: o
> **track record** — "estas foram as melhores ofertas que já passaram, **com nossa conta
> e nosso veredito**". É o **Sage/mídia** demonstrando a régua funcionando ao longo do
> tempo, base do **accuracy loop**. Dá substância à estreia **sem publicar item vivo
> morno** (D-050). NÃO é o Deal Desk vivo; é o arquivo/prova.
>
> **Regra-mãe herdada:** *o produto não mostra número que o próprio sistema sabe suspeito.*
> Vale para valor (não-valor onde não há conta) **e para TEMPO** (§3 — dependência do predict).

---

## 0. O que é

Superfície **pública** (página M3) que lista ofertas **históricas** (encerradas) que
o sistema pontuou como fortes, cada uma com o **breakdown, a conta em reais e o
veredito** que o The Loyal deu **na época**. É editorial + prova de método, não
recomendação viva (as ofertas já passaram). Segue **integralmente o design system da
marca** (CLAUDE.md: TL Score, vocabulário de veredito, números em mono, `ContaBlock`,
disclaimer, zero urgência/emoji).

---

## 1. Régua de inclusão (quais ofertas entram)

- **Encerradas** (`estado in ('historica','encerrada')`) — oferta viva é do Deal Desk,
  não do track record.
- **Com valor real** — `tl_score_bruto` não-null (exclui os não-valor / `conta_nao_calculavel`,
  D-050.1) e idealmente banda forte na época ("Vale olhar"/"Vale agir"). Mostrar a régua
  **acertando E recusando**: incluir também exemplos fortes-que-a-conta-desmascarou
  (o `livelo→azul` 115%-blog→50%-oficial "Evitaria" é o caso didático — prova do rigor).
- **Fonte rastreável** — de preferência TIER 1 (regulamento); TIER 2 marcado como tal.
- **Dentro da janela temporal confiável** (§3) — inegociável.

## 2. Campos públicos por item (o que aparece)

Por oferta: **TL Score** + **veredito** (vocabulário fixo, cor semântica) + **conta em
R$** (`ContaBlock`: CPM/milheiro, como se montou — custo-base × ratio × bônus) +
**breakdown por componente** (quanto veio de percentil/eficiência/raridade/abrangência,
com `base_n`) + **período de vigência** (§3) + **fonte** (link + tier). Números em
**JetBrains Mono**. **Disclaimer obrigatório** (recomendação histórica ainda é recomendação):
*"Promoções podem mudar sem aviso. Confira sempre as regras no site oficial…"*.

## 3. DEPENDÊNCIA TEMPORAL — inviolável (coordenação com o chat de predict)

O track record exibe **vigência e datas** de ofertas históricas. O chat de predict
descobriu que a **camada temporal está corrompida** (janela confiável **~24 meses**,
reconstrução em curso). Logo:

- **Não exibir data de oferta fora da janela confiável** até a reconstrução fechar —
  mostrar vigência errada ao público é **exatamente o erro que o produto existe para não
  cometer**.
- O track record **herda a janela de confiabilidade temporal do predict**: ofertas
  **dentro de ~24 meses** (pós-reconstrução) são seguras; **mais antigas** dependem da
  reconstrução **ou** aparecem marcadas **"data não-confiável"** (nunca uma data que o
  sistema sabe suspeita).
- **Consequência:** o track record pode ser **construído já** (ranking, scores, contas,
  vereditos são sólidos), mas a **exibição de datas** espera a reconstrução temporal /
  usa a janela confiável. Não estreia com data suspeita. Alinhar via HANDOFF.

---

## 4. Fora de escopo

- Não é o **Deal Desk vivo** (offer-triggered, D-050). Track record = arquivo, não oferta acionável.
- Não liga auto-publish nem toca a calibração (frente paralela, caminho crítico do vivo).
- Não constrói o motor de score (provado); consome o que já está gravado.

## 5. Definição de pronto

- Régua de inclusão consulta a base (encerradas + valor real + janela temporal confiável).
- Item renderiza no design system da marca (score/veredito/`ContaBlock`/breakdown/fonte/disclaimer).
- **Nenhuma data fora da janela confiável exibida sem marca de não-confiável.**

---

## 6. Decisões do operador — RATIFICADAS (2026-07-17)

1. **Régua de inclusão: ✅ inclui as recusas selecionadas.** Um track record só de boas
   ofertas parece agregador; um que inclui "esta parecia boa e não era, veja a conta" é o
   The Loyal. O `livelo→azul` "Evitaria" é peça-chave (prova a régua nos dois sentidos).
2. **Janela de datas: ✅ mostra o seguro, marca o resto, não bloqueia.** Dentro dos ~24m
   confiáveis exibe data; mais antigas = "período aproximado / a confirmar".
3. **Campos: ✅ breakdown completo por componente.** É a prova de método — "veja a conta",
   não "confie em nós". O breakdown É o produto.
4. **Superfície: ✅ página própria** (`/track-record`) — ativo permanente referenciável que
   cresce com o tempo, não conteúdo de uma edição.

## 6.1 CONSTRUÇÃO EM HOLD — espera a fundação cravar (decisão de sequência)

**Spec ratificada, construção SEGURADA.** O track record é conteúdo de estreia de um produto
que **ainda não está no ar** — construí-lo agora é encher a prateleira de uma loja fechada.
O que **abre a loja** é a **calibração fechar** (liga o auto-publish), não o track record.
E o track record depende de **fundação ainda em movimento:** herda a **janela temporal
confiável do predict**, que ainda não está cravada (reconstrução depende da âncora/reconciliação
da edge fn). Construir sobre janela que vai mudar = **retrabalho garantido**. Ordem certa:
**(1)** calibração fecha os vetores → auto-publish; **(2)** predict crava a janela ~24m; **(3)**
só então o track record é construído sobre fundação estável (data confiável + score final);
**(4)** fecha o M2. Não é adiar por adiar — é construir na ordem que evita retrabalho.
Gatilho para construir: **janela temporal cravada E vetores fechados.**

*Promoções podem mudar sem aviso. Confira sempre as regras no site oficial antes de
comprar, transferir ou resgatar.*
