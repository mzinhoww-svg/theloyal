# M2 · Slice — Ligar a coleta TIER 1 em produção (SPEC, antes de código)

> **Por que agora.** Pergunta do operador sobre o Digest Engine ("por que Deal Desk não
> consome TIER 2, já que tem conteúdo com conta feita?") revelou que o mecanismo pedido
> — **extrai, valida, cruza, confirma, então aplica score** — **já existe, testado, puro,
> zero LLM** (`v2/lib/coleta/confianca.mjs` + `coleta-tier1.mjs`, D-048/D-049). O que
> falta não é arquitetura nova: é **ligar o que já foi construído** para rodar em
> produção, com dado vivo, em cadência — hoje é CLI manual sobre uma fixture congelada,
> rodou **uma vez** (`COLETA-TIER1-LOTE-1.md`). Escolhida como prioridade **antes** do
> Digest Engine terminar (pode mudar o cenário de dia fraco que a engine vai encontrar).

---

## 0. Achado honesto — medido agora, antes de prometer o que isto destrava

**O que já existe e já é sólido:**
- `confianca.mjs` — função **pura**, 5 sinais objetivos ponderados (fonte oficial 0,30;
  janela de vigência clara 0,25; estado vivo 200 0,15; público inequívoco 0,15; termos
  legíveis 0,15), zero LLM na decisão (LLM só narraria o *porquê*, não decide — nunca
  implementado, nem precisa).
- `coleta-tier1.mjs` — fluxo completo por viva crawleável: resolve URL oficial → fetch
  redirect-manual → detecta campanha vs evergreen pela janela (D-047) → extrai termos →
  classifica resultado (corrobora_limpo/ajuste/refuta) → aplica confiança.
- Cobertura direta hoje: 3 adapters com sitemap oficial (Livelo, Smiles, Esfera — TAP
  listado mas sem adapter próprio ainda).

**O que falta — três lacunas concretas, nenhuma delas é reprojetar o gate:**
1. **Fonte de candidatos é uma fixture estática** (`fixtures/vivas-crawleaveis.json`,
   congelada no lote-1) — não lê `campaigns` ao vivo.
2. **Nunca escreve.** O `main()` só **reporta** a decisão que o gate tomaria — `tier`,
   `campanha_fontes`, `veredito_bruto` nunca são gravados pelo runner. É dry-run por
   trava explícita no código.
3. **Não roda em cadência.** `main()` só existe atrás de `process.argv[1]` — precisa de
   alguém invocar o script manualmente. Sem cron, sem edge function.

**O número que muda a expectativa (medido agora, banco vivo):**

```sql
vivas crawleáveis (livelo/smiles/esfera/tap) SEM tier=1 hoje:            17
  · dessas, com tl_score_bruto >= 70 (piso de valor, D-048 §5):           0
```

**Ligar a coleta hoje NÃO destrava nenhum item do Deal Desk imediatamente** — o piso de
valor (70) já existente no desenho do D-048 filtraria os 17 candidatos ANTES de gastar
uma chamada de rede confirmando algo que, mesmo confirmado, não cruzaria o corte de
veredito (Vale agir/olhar) do Digest Engine. **Isso não invalida a prioridade** — o
ganho real é **estrutural, não pontual**: com a coleta rodando em cadência, o gate
"a captura automático no instante em que [a oferta forte] aparecer" (D-050 decisão 2)
deixa de depender de alguém lembrar de rodar um script manualmente. Hoje é dia fraco
com ou sem esta slice; a diferença é que **depois** dela, o produto está pronto para não
perder a próxima oferta forte por falta de alguém apertar o botão.

---

## 1. O que muda — três lacunas, três entregas

### 1.1 Candidatos vivos do banco (substitui a fixture)

Query determinística: `campaigns` onde `estado IN ('ativa','detectada','ultimos_dias')`,
`origem_code IN ('livelo','smiles','esfera','tap_milesgo')`, `coalesce(tier,2) <> 1`,
**`tl_score_bruto >= 70`** (piso de valor, D-048 §5 — já decidido, só nunca foi
implementado como filtro de entrada real). O runner recebe essa lista no lugar do JSON
de fixture; o núcleo puro (`coletarLote`, `confianca`, `classificarResultado`) **não
muda uma linha** — só a fonte do input.

### 1.2 Passo de escrita (o que hoje não existe)

Regra por resultado, direto do D-048/D-049 (nenhuma regra nova, só a implementação):

| Confiança | Resultado | Ação |
|---|---|---|
| ≥ limiar | `corrobora_limpo` | Grava `campaigns.tier=1` + `veredito_bruto`/`tl_score_bruto` recomputado sobre o termo oficial (se precisar) + INSERT em `campanha_fontes` (`papel='confirmacao_oficial'`, `tier=1`, `verificado_em=hoje`, `payload`=termos extraídos). **Publica sem revisão** (D-048). |
| ≥ limiar | `corrobora_com_ajuste` | Mesma gravação, mas separa por público quando a escala tiver mais de uma faixa (D-047) — pode virar N identidades. |
| ≥ limiar | `refuta` | **Remove/rebaixa com firmeza** (D-049 ref.1): não grava `tier=1`; marca `veredito_bruto='Não confirmado'` + `override_aplicado` próprio (`refutado_tier1`, novo valor no domínio de overrides) + trilha em `campanha_versoes` (evento `refutado_confirmacao_tier1`, mesmo padrão do `correcao_nao_valor_d050_1`). Não deleta.
| < limiar | qualquer | **Fila de revisão** — INSERT em `campanha_fontes` com `payload` completo (inclusive a confiança calculada) mas **sem** setar `tier=1`; fica visível no admin para revisão humana. Não bloqueia, não corrige sozinho. |

**Por que a escrita pode ser autônoma (não é decisão nova):** D-048 já aprovou
"confiança ≥ limiar → publica sem revisão humana" como o desenho do gate. O que faltava
era a implementação da gravação — a decisão de que ela roda sem revisão humana **já
foi tomada**. A trava que continua valendo: **piso gated** (baixar o limiar abaixo do
que o operador cravou exige aprovação; subir é livre) e **auditoria pré-publicação
continua acima** (a confirmação pula a revisão da FONTE, nunca a auditoria da edição —
gate 5.5 do Digest Engine roda igual, recomputando os 3 portões, mesmo já confirmado).

### 1.3 Cadência (cron)

Mesmo padrão já em produção (`ingest`, `campaigns`): edge function invocada por
`pg_cron`. Justificativa técnica de que isso é viável sem custo de LLM: o pipeline
inteiro é `fetch` + regex + função pura — roda limpo em Deno, sem chamada a
OpenRouter/nenhum provedor. **Proposta de frequência: a cada 6h** (mais espaçado que o
`extract-2h` de 5 min — fetch de página oficial é mais pesado e não precisa da mesma
urgência que processar notícia nova; 6h ainda captura uma oferta forte em horas, não
dias). Idempotência: **não reprocessa item já com `tier=1` confirmado**; item já visto e
não confirmado (refutado ou em revisão) só é re-tentado se `last_seen`/`estado` mudou
desde a última tentativa (evita bater na mesma página 4x/dia sem necessidade).

---

## 2. Decisões a ratificar antes do código

1. **Cravar o limiar definitivo agora.** D-049 propôs 0,75 como partida "o operador
   crava vendo o 1º lote" — o lote-1 já rodou (`COLETA-TIER1-LOTE-1.md`: hilton
   `corrobora_limpo` 1,00, smiles `ajuste`→revisão). Ratificar **0,75** como limiar de
   produção, ou quer ver mais um lote antes de cravar?
2. **Frequência do cron: proponho 6h.** Ratificar, ou prefere mais/menos frequente?
3. **Novo valor de override `refutado_tier1`** (item 1.2, linha refuta) — domínio de
   `override_aplicado` ganha um terceiro valor além de `sem_tier1`/`conta_nao_calculavel`.
   Aditivo, não quebra nada existente. Ratificar?
4. **Terceiro adapter TAP** — `coleta-tier1.mjs` já lista `tap` na cobertura mas
   `descobrirTodos` só importa `smiles/livelo/esfera` (TAP sem adapter de sitemap ainda,
   achado desta leitura). Fora de escopo desta slice **fechar** o adapter TAP (é Frente A
   da `SPEC-SLICE-COBERTURA-FONTES.md`, já adiada por D-051 — sem alvo forte medido em
   TAP hoje) — só registrando que a cobertura desta slice é **3 de 4** programas
   listados, não 4.

---

## 3. Fora de escopo

- Fechar o adapter TAP (Frente A da cobertura, D-051 — sem alvo medido).
- Reverse-lookup / Frente B (já provada em dry-run; amplia QUEM entra na fila de
  candidatos, mas é extensão separada — esta slice liga o que já roda sobre os 3
  adapters diretos primeiro).
- Qualquer mudança no Digest Engine (`SPEC-SLICE-DIGEST-ENGINE.md`) — ele continua
  lendo `campaigns.tier=1` como está; esta slice só aumenta quantas linhas
  legitimamente têm `tier=1`.
- Auto-publish do Daily (D-050 decisão 3 continua em vigor).

## 4. Definição de pronto

1. Runner lê candidatos vivos do banco (§1.1), não da fixture — fixture vira só
   golden/teste, não fonte de produção.
2. Passo de escrita implementado e testado (as 4 linhas da tabela §1.2), com trilha em
   `campanha_versoes` para toda gravação/refutação.
3. Edge function + `pg_cron` no ar, cadência ratificada (§2.2), idempotente (golden:
   rodar 2x seguidas não duplica nem reprocessa item já confirmado).
4. Limiar 0,75 (ou o valor ratificado) cravado em config versionada (mesmo padrão de
   `score_pesos`/`derivacao_config` — não hardcoded).
5. Medição pós-deploy: quantas das 17 vivas crawleáveis de hoje mudam de estado
   (confirmado/refutado/revisão) no primeiro ciclo — mesmo que o resultado honesto seja
   "0 cruzou o piso de valor, 0 processado" (§0), a métrica fica registrada, não
   inventada depois.

*Promoções podem mudar sem aviso. Confira sempre as regras no site oficial antes de
comprar, transferir ou resgatar.*
