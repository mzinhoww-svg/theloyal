# Resultado — Slice Matcher URL→campanha (M2, D-033)

> Elo que faltava na estrada TIER 1: ligar uma página oficial (payload dos adapters, Trilha B) à campanha canônica certa. Função **pura**, determinística, reusando a identidade do M1. Nada toca rede nem produção — a execução ao vivo é a slice B3, depois, com aprovação.

## O que entrou

| Arquivo | Papel |
|---|---|
| `v2/lib/matcher-url.mjs` | `casarUrlCampanha(payloadOficial, indices, campanhasExistentes, ref)` — pura |
| `v2/lib/matcher-url.test.mjs` | `node --test`, 9 casos (confirmar / criar / revisão) |
| `v2/db/migrations/009_criar_campanha_tier1.sql` | função de **nascimento** TIER 1 (aditiva, idempotente, **não aplicada**) |

## Fluxo

```
payload da página oficial (extrairCampanha: programa, titulo, slug, %, url_canonica)
        │
        ▼  normalização (só afirma o que a página evidencia; senão abstém)
   campanha { tipo, origem, destino, vigencia_fim, notes }
        │
        ▼  resolverCampanha(...)  ← REUSO do M1 (identidade.mjs), não matcher novo
   identidade canônica { identity_key, origemCode, destinoCode, publico, estado, ... }
        │
        ├── resolvido + 1 campanha com a MESMA identity_key ──► { acao:'confirmar', campaign_id, evidencia }
        ├── resolvido + NENHUMA campanha ────────────────────► { acao:'criar', identidade, payload_campanha, evidencia }
        └── não resolvido / ambíguo / N campanhas ───────────► { acao:'revisao', motivo, detalhe, evidencia }
```

`evidencia` (trecho/%/vigência/url com proveniência) acompanha **os três** desfechos e é o que vai para `campanha_fontes.payload jsonb` (D-034).

### Reuso do M1 (D-033, inegociável) — como foi honrado

- Tipo canoniza por `resolverTipo`; programas resolvem por `resolverPrograma`; a chave é a `identityKey` do M1; a decisão origem/destino/lado-único/estado é toda de `resolverCampanha`. O matcher **não** reimplementa identidade — só **normaliza o payload** e **consulta** o índice de existentes.
- Origem = `payload.origem ?? payload.programa` (o site oficial rastreado é a origem). Tipo e destino, quando não vêm explícitos no payload, são derivados de título/slug/url com sinais conservadores; campos semânticos explícitos no payload são **autoritativos** (permite ao adapter/curador injetar sinal forte — e o B3 futuro enriquecer).

### Os dois caminhos no banco

- **Confirmar** (campanha existe): a função pura devolve `campaign_id`; a slice B3 chama `confirmar_tier1(campaign_id, url, verificado_em, papel)` (migration 003, já pronta) e grava a evidência em `campanha_fontes.payload`.
- **Criar** (campanha não existe): nasce já confirmada via **`criar_campanha_tier1(identidade, payload, url, verificado_em)`** (migration 009), que numa transação idempotente: insere `campanha_identidade` (idempotente por `identity_key`), insere `campaigns` (estado pré-TIER1), **chama `confirmar_tier1`** (reuso — promove estado e gera evento `confirmacao_tier1`), grava a evidência em `campanha_fontes.payload` (D-034) e registra o evento **`nascimento_tier1`** em `campanha_versoes`. Ambos os caminhos, portanto, geram evento em `campanha_versoes` (D-033).

## Abstenção (não força match errado)

Mesma filosofia do resto do projeto. Vai para `revisao`, nunca chuta:

| motivo | quando |
|---|---|
| `sem_url_canonica` | payload sem url — nada a confirmar |
| `destino_ambiguo` | 2+ programas plausíveis de destino (ex.: "…para Smiles ou LATAM") |
| `tipo_indefinido` | página sem sinal de tipo (ex.: "Passagens Aéreas - Smiles") |
| `transferencia_sem_destino` | regra por tipo do M1: transferência exige destino |
| `origem_generica_recuperavel` / `origem_nao_resolvida` | herdados de `resolverCampanha` |
| `multiplas_campanhas_mesma_identidade` | N campanhas sob a mesma `identity_key` — não adivinha qual recebe a fonte |

## Testado com fixture vs. dependente de banco vivo

**Coberto por fixture (verde, determinístico) — `node --test`:**
- `matcher-url.test.mjs`: 9/9 — confirmar (rota Livelo→Smiles existente), criar (rota nova, estado `ativa`), índice por `identity_key` e por `{tipo,origem_code,destino_code,publico}`, destino ambíguo, tipo indefinido, transferência sem destino, sem url, N campanhas mesma identidade, override explícito.
- Suíte inteira do `v2/lib` (incl. identidade/adapters/gate/vigência): **64/64**, sem regressão.

**Validado em Postgres 16 efêmero (cluster descartável no scratchpad, produção intocada):**
- `009` compila limpo sobre `001`+`003`+`008`.
- Caminho **criar**: identidade+campanha criadas; `confirmar_tier1` promoveu `detectada → ativa`; `campanha_fontes.payload` gravado com evidência (`percentual: 90`); eventos `nascimento_tier1` (origem `matcher`) e `confirmacao_tier1` (origem `admin`) presentes.
- **Idempotência**: 2ª chamada da mesma rota → `criada:false`, mesmo `campaign_id`, zero duplicação.
- Caminho **confirmar**: `confirmar_tier1` numa campanha existente adiciona nova fonte sem promover de novo (estável).

**Depende de banco vivo (fora desta slice — B3):** a varredura real dos adapters, a leitura de `campanha_identidade`/`campaigns` para montar `campanhasExistentes`, e a **aplicação** das migrations (007/008/009 seguem *não aplicadas* por decisão do brief). O matcher é puro; não lê o banco.

## Decisões novas / a consolidar (para o orquestrador — não editei DECISIONS.md)

1. **Derivação de tipo/destino a partir de título/slug é da camada de normalização do matcher.** O payload de `extrairCampanha` (Trilha B) hoje entrega `programa/titulo/slug/percentual/url` — **não** `tipo`/`destino`. O matcher deriva esses dois com sinais conservadores e **abstém** quando fracos/ambíguos; aceita campos semânticos explícitos como autoritativos. Se o desejo for que os adapters já emitam `tipo`/`destino` estruturados, isso é evolução do `extrairCampanha` (outra trilha) — sinalizo, não assumi.
2. **`criar_campanha_tier1` gera `campaign_id` `tl_<uuid>`** (a coluna `campaigns.id` é `text` sem default). Convém o orquestrador ratificar o prefixo/estratégia de id de campanhas nascidas do radar.
3. **Legacy `campaigns.status` × FSM `estado`.** No nascimento gravo `status = estado` inicial; `confirmar_tier1` (003) promove só `estado` (a FSM nova), deixando o `status` legado como estava — comportamento idêntico ao que 003 já faz para qualquer campanha. Se o legacy `status` precisar acompanhar a FSM, é decisão transversal ao 003, fora desta slice.
4. **N campanhas sob a mesma identidade → revisão.** `confirmar_tier1` é por `campaign_id`; a identidade é 1:N com campanhas. Quando há mais de uma, o matcher abstém em vez de escolher. Ratificar se essa é a regra desejada.

## Coordenação de numeração (migration 009)

Usei **009**: na base (`claude/loyalty-landing-page-v1-7vbjq7`) 006 é lacuna (tl_score_engine vive em outra trilha) e 007/008 já existem — 009 é o próximo livre. **A slice de derivação, rodando em paralelo, também pode querer 009.** Não apliquei nenhuma migration; se colidir, o merge deve renumerar uma das duas antes de aplicar. **Sinalizo a possível colisão — não resolvi por conta própria.**

## Fora de escopo (respeitado)

Nada de mutação em massa de produção, nenhuma migration aplicada, nada tocado em `score.mjs`/`derivacao.mjs`/`gate`/`vigencia`/`DECISIONS.md`/`REQUIREMENTS.md`/golden. Identidade reusada, não reimplementada.
