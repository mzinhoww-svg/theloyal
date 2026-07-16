# Resultado do DRY-RUN (read-only, produção) — para aprovação

> `dryrun-report.mjs` sobre as 3.610 campanhas reais (leitura anon, nada escrito). Matcher testado (14 golden tests). REF=2026-07-16.

## Totais por desfecho

| Desfecho | Campanhas | % |
|---|---|---|
| Resolvida por **ROTA** (origem→destino) | 2.104 | 58,3% |
| Resolvida por **LADO ÚNICO** (sem destino, tipo não exige) | 1.220 | 33,8% |
| **Em REVISÃO** | 286 | 7,9% |
| — `origem_nao_resolvida` | 273 | 7,6% |
| — `transferencia_sem_destino` | 13 | 0,4% |
| **Canonicalizam (rota + lado único)** | **3.324** | **92,1%** |

(249 campanhas resolvidas usam bucket de cauda em algum lado — `origem_bruto` preservado.)

## Checagem que você pediu: algum programa real escapou do A+C na fila de revisão?

**Praticamente não.** Os 273 `origem_nao_resolvida` são, por frequência:
`null(61), desconhecido(52), pp(23), melhoresdestinos(19), hoteis(11), cartao(7), passageirodeprimeira(7), cartoes(4), md(4), na(4), parceiros(4), passageiro de primeira(4), governo(3), natal luz(3), vantagens(3)...` + cauda n=1 de lixo (fgts, oab, serasa, legionarios, cripto, cupom, etc.).

Classificação: **blogs** (melhoresdestinos, passageiro de primeira variantes — corretos como ruído), **cidades/eventos** (natal luz, gramado, valle nevado, sauipe, expoflora), **genéricos** (hoteis, cartao/cartoes, banco/bancos, governo, parceiros, vantagens, pontos, dinheiro), **lixo** (fgts, oab, serasa, x, "3 3", cartao151025). **Nenhum programa real claro foi para revisão** — o A+C pegou o que era programa.

**Único ambíguo a decidir: `pp` (23 ocorrências).** Provavelmente abreviação de "Passageiro de Primeira" (o blog) → ruído. Mas pode ser "Priority Pass". 23 é volume relevante — **sua leitura?** Se for Priority Pass, adiciono `pp` como alias de `priority_pass` antes do apply; se for o blog, fica em ruído.

## Amostra — `origem_nao_resolvida` (20 de 273)

```
2por2      -> smiles     compra        (lixo)
3.3        -> amazon     compra        (lixo)
7do7       -> netshoes   compra        (lixo)
alertas    -> desconhecido clube       (lixo)
arq        -> desconhecido cartao      (lixo)
bahia      -> desconhecido compra      (genérico)
banco      -> banco       estrutural   (genérico)
bancodobrasilnenhum,banco do nordeste -> azul transferencia (lixo de extração)
bancos     -> latampass   transferencia (genérico; origem deveria ter sido um banco específico)
black      -> desconhecido compra      (genérico)
cartao azul-> desconhecido cartao      (genérico)
cartao     -> azul        transferencia (genérico; "cartão" não é programa)
```

## Amostra — `transferencia_sem_destino` (todos os 13)

```
azul     -> desconhecido            (destino não extraído)
bradesco -> passageiro de primeira  (destino = blog -> ruído, correto)
c6       -> melhoresdestinos        (destino = blog)
inter    -> globalaccount           (destino genérico)
interloop-> desconhecido
nubank   -> desconhecido
premmia  -> miles                   (destino genérico "miles")
revolut  -> desconhecido
smiles   -> bancos                  (destino genérico)
smiles   -> desconhecido (x3)
smiles   -> melhoresdestinos        (destino = blog)
```

Todos são transferência onde o **destino** é desconhecido/ruído/genérico → revisão correta (transfer exige destino real). Confirma que blogs-como-ruído também funcionam no lado destino.

## Situação

Dry-run OK, nada escrito. **Parado para sua aprovação** (não rodei apply nem backup). Ao aprovar (e decidir `pp`): faço backup on-demand → confirmo integridade → `--apply` → relatório pós-apply.
