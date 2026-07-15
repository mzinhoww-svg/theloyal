# ADR-RADAR-009 — Identidade e deduplicação de campanhas

- **Status:** proposed
- **Data:** 2026-07-15
- **Relacionado:** arquitetura §5, §10, §27d.5, §27f; ADR-RADAR-010 (validação temporal);
  `docs/AUDITORIA-FORENSE-PREDICT-FORECAST.md` §11–12; `docs/auditoria/edge-function-campaigns.md`;
  `docs/auditoria/predict-forecast-lineage.md` (L1)

## Contexto
O `id` da campanha é gerado por `makeId = origem-destino-tipo-vigencia_fim` (edge fn
`campaigns` v13, confirmado). Como `vigencia_fim` é **mutável e sujeita a erro de
extração**, a mesma campanha lida de dois artigos ("último dia" e "prorrogado") ou em
duas rodadas com datas diferentes gera **ids diferentes** e **não deduplica**. O caso
`livelo→connectmiles` (943 dias) é exatamente isto: **uma campanha, dois registros**.

## Problema
A identidade da campanha **não pode** depender de um campo mutável/errável
(`vigencia_fim`). Sem identidade estável e sem estados de duplicidade, o ledger acumula
duplicatas que viram intervalos e ondas falsos, e não há como versionar a mesma campanha
(lançamento → prorrogação → último dia) nem separar "a campanha" de "cada observação de
fonte".

## Alternativas
1. Manter `id = …-vigencia_fim` (status quo — gera duplicatas por data).
2. `id` por hash do texto/URL (dedupa observações idênticas, mas não campanhas
   re-anunciadas).
3. **Separar quatro entidades** (abaixo), com identidade **independente da data de fim**
   e estados explícitos de duplicidade.

## Decisão proposta
Alternativa 3. Modelo conceitual de quatro entidades:

```
campaign_identity   # a campanha real, estável. Chave NÃO usa vigencia_fim.
                    #   identidade ~ origem + destino + tipo + mecanica + segmento
                    #   (+ janela de vigência RESOLVIDA e validada, não vigencia_fim crua)
campaign_version    # versões da mesma identidade ao longo do tempo:
                    #   lancamento | prorrogacao | ultimo_dia | reedicao | correcao
source_observation  # cada leitura de fonte (URL, data_publicacao, texto, confiança)
                    #   N observações → 1 identidade
campaign_wave       # onda analítica (datas ≤ epsilon colapsadas) usada na série
```

**Estados de duplicidade** (por par de registros):
```
unique              # sem par candidato
possible_duplicate  # sinais fracos coincidem
probable_duplicate  # sinais fortes coincidem (bloqueia intervalo em runtime — C0)
confirmed_duplicate # revisado por humano
merged              # unificado (só com estrutura persistida — fase futura)
rejected_duplicate  # revisado: não é duplicata
```

**Critérios para `possible`/`probable`** (ponderados, nunca um só):
origem · destino · tipo · bônus (base/máx) · mecânica · segmento · similaridade de
título e texto · URLs (mesmo domínio/artigo relacionado) · datas de publicação ·
datas observadas · fontes · **proximidade temporal** · relação textual
**"lançamento" / "último dia" / "prorrogação"** (mesma campanha em fases).

**Sem merge automático quando a evidência for ambígua** (`possible_duplicate` nunca
funde sozinho; só `confirmed_duplicate` por revisão humana com justificativa e
auditoria).

**Fase C0 (contenção, runtime, sem migration):** detectar pares
`probable_duplicate` em memória e **bloquear o intervalo** que eles formam na série
(marcar a onda como suspeita, tirar do cálculo de cadência), **exibir os registros
relacionados** no admin, e **não persistir** decisão estrutural nesta fase.

## Consequências positivas
- O caso 943d deixa de gerar intervalo (as duas pontas viram 1 identidade / 1 onda).
- Versionar a mesma campanha (lançamento→prorrogação) sem inflar cadência.
- Separar "campanha" de "observação de fonte" (base para `source_count` e confiança).

## Consequências negativas
- Identidade estável exige resolver a janela de vigência **validada** (depende de
  ADR-010) antes de compor a chave.
- Detecção de duplicidade probabilística exige calibrar pesos e limiares.

## Riscos
- Falso `probable_duplicate` funde campanhas distintas → mitigado por **não fundir
  automaticamente** e por revisão humana.
- Falso `unique` mantém duplicata → mitigado por auditar pares `possible` no admin.

## Questões em aberto
- Pesos e limiar exatos de `possible`/`probable`.
- Composição final da `campaign_identity` (quais campos, como incorporar a janela
  resolvida sem reintroduzir mutabilidade).
- Momento de persistir `merged` (fase estrutural, não C0).

## Critério para `accepted`
Aprovação do usuário do modelo de quatro entidades, dos estados de duplicidade, do
princípio "identidade não depende de `vigencia_fim`" e da detecção em runtime na Fase C0
sem merge automático.
