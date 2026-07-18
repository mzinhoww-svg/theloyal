# Contrato — janelas previstas (trilha P / `/promocoes` consome) · PROPOSTA

> **Mede e propõe. Nada gravado em produção.** Contrato do olha-pra-frente por rota que a
> trilha P do principal consome. Honra INV-25/INV-03 **como descritos pelo operador** (não
> tenho o texto canônico no branch): número só com `base_n≥3` **e** série `≥12m`; rota sem
> base = `sem_previsao` ("sem previsão ainda"), **nunca número inventado**. O valor numérico
> fino (p30/p90 exatos, bônus %) **não vai ao dashboard** — teaser de Pro; mostra só a banda.

## Shape (por rota elegível)

```json
{
  "rota": "livelo→azul",                  // origem_code→destino_code (normalizado)
  "estado": "com_previsao",               // com_previsao | sem_previsao
  "proxima_janela": { "de": "2026-07-26", "ate": "2026-08-12" },  // FAIXA, nunca ponto
  "confianca": "baixa",                   // banda: baixa | media | alta (o "probabilidade em banda")
  "basis": "29 ondas · cadência irregular ~15d (CV 0.78) · backtest 26 janelas, acerto 38%, erro mediano 10d · última 2026-07-17",
  "atualizado_em": "2026-07-17",
  "versao_modelo": "campaign_predict_v2 / walk_forward_v1"
  // OCULTO do dashboard (Pro): p7..p180 exatos, bônus provável %, central exata
}
```

**Degradação graciosa (INV-25/INV-03):**
```json
{ "rota": "c6→smiles", "estado": "sem_previsao", "motivo": "base insuficiente (base_n<3 ou série<12m)" }
```
Sem janela, sem confiança, sem número. A trilha P renderiza "sem previsão ainda".

## Exemplo REAL — `livelo→azul` (dado reconstruído, regra apertada; asOf 2026-07-17)

Computado com a matemática de `lib/predict-engine.ts` (DEFAULT_PREDICT_CONFIG) sobre as
datas reconstruídas da rota (34 datas → 29 ondas após colapso ε=3):

| campo | valor |
|---|---|
| estado | `com_previsao` (base_n 34, span 533d ≥ 12m) |
| próxima janela | **26/jul → 12/ago 2026** (central 01/ago) |
| confiança (banda) | **baixa** |
| basis | 29 ondas · cadência irregular ~15d (CV 0.78) · backtest 26 janelas, acerto de janela **38%**, erro mediano 10d · última 2026-07-17 |
| oculto (Pro) | p30=85%, p90=100%, bônus provável — **não vão ao dashboard** |

**Achado honesto:** mesmo na rota mais rica (34 eventos), a confiança sai **baixa** — cadência
irregular (CV 0.78) e backtest com acerto de janela 38%. O predict, honesto, não promete
precisão que não tem. O dashboard mostra "janela ~26/jul–12/ago, confiança baixa" — a banda
comunica trust, a faixa comunica quando; o número fino fica no Pro. Isso é INV-25 operando.

## Trava de produção — por que HOJE toda rota degrada para `sem_previsao`

Este exemplo roda sobre datas **reconstruídas no dry-run, NÃO persistidas**. Em produção o
corpus **ainda está corrompido** (reconstrução não aplicada — ver status abaixo). Rodar o
contrato sobre o corpus vivo hoje produziria as janelas **fictícias** (intervalos de 943 dias,
jan/2029). Logo: **a trilha P mostrar "sem previsão ainda" HOJE é o comportamento CORRETO** —
a degradação graciosa protegendo o produto enquanto a camada temporal não é confiável.

O contrato popula com janelas reais **só depois** que:
1. a v15 estancar a origem (medido em produção), e
2. a reconstrução apertada (fronteira 12) for aplicada.

Até lá: estado `sem_previsao` em todas as rotas é honesto, não um bug.

## Rotas da fronteira (base_n≥3 & ≥12m, regra apertada) — as ~12 que ganharão número

Top por base (datas reconstruídas): `livelo→azul` (34), `itau→latampass` (26),
`esfera→azul` (20), `livelo→latampass` (20), `livelo→smiles` (16), `itau→azul` (14)…
São as rotas que saem de `sem_previsao` para `com_previsao` quando a reconstrução aplicar.
