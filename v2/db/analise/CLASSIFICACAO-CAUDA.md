# Classificação da cauda — o que falta cobrir (para ratificar)

> Gerado por `classificar-cauda.mjs` (matcher real sobre distribuições reais). O head de 103 programas já cobre **84,6% das linhas de origem** e **57,3% de destino** (35,9% do destino é ruído `desconhecido`). Resta a **cauda**: ~9% origem / ~7% destino por volume, mas ~400 variantes distintas. Abaixo, proposta de ação por grupo — **confirme/ajuste**.

## Resumo por lado

| Lado | Head (programa) | Ruído | Cauda a classificar |
|---|---|---|---|
| origem | 185 var / 3.045 linhas (84,6%) | 50 var / 221 (6,1%) | **224 var / 334 (9,3%)** |
| destino | 162 var / 2.061 (57,3%) | 24 var / 1.294 (35,9%) | **176 var / 245 (6,8%)** |

## Ação A — PROMOVER a programa (adicionar ao seed). Marcas reais recorrentes ou majoritárias

**Aéreo (internacionais que faltam):** qantas, krisflyer/singaporeairlines, ethiopian, alaska, ryanair, jetblue/trueblue, aegean, cathaypacific, philippineairlines, air_europa (suma), aircanada→aeroplan, virginatlantic, garudaindonesia, malaysiaairlines, vietnamairlines, hongkongairlines, aerolineasargentinas, arajet, flybondi, jetsmart, easyjet, aeromexico, taag, frontier, royaljordanian, airchina, copa→connectmiles.
*(alianças `oneworld`/`staralliance` NÃO são programa → ruído.)*

**Hotel (redes que faltam):** iberostar, melia, radisson, bestwestern, choice (privileges), gha_discovery, palladium, bourbon (rede). Hotéis/resorts **individuais** (n=1) NÃO promovem → bucket `hotel_outro`.

**Banco/fintech:** neon, sofisa, genial, banco_do_nordeste (bnb), banpara, infinitepay.

**Cashback/lounge/viagem:** meliuz, topcashback, dotz, coopera, viator, civitatis, rocketmiles, seats_aero, prioritypass, loungekey, dragonpass, msc, costa (cruzeiros), clubmed, cvc, zarpo, decolar (já no head).

**Streaming/tech (contexto shopping):** hbomax/max, spotify, deezer, youtube, applemusic, nintendo, xbox, roku, crunchyroll.

**Varejo/marcas (contexto shopping):** apple, lg, tcl, puma, adidas, asics, lego, brastemp, lenovo, huawei, motorola, oppo, temu, wish, leroy_merlin, rihappy, petz, petlove, camicado, hering, lacoste, vivara, starbucks, havaianas.

## Ação B — MANTER em bucket (cauda de baixo volume, `origem_bruto` preservado; promover quando ganhar volume)

- **hotel_outro** (~26 var): buzios beach resort, cana brava resort, cyan resort, taua atibaia, sao pedro thermas, bourbon santos/atibaia, japaratinga resort, universal orlando resort, beach hotel cambury, royal palm plaza, blue tree thermas, thermas da mata, nannai, vale das aguas, grandpalladiumimbassai, sanmahotel, hotbeachresort, etc.
- **aerea_outra / servico_outro / varejo_outro**: one-offs n=1 sem recorrência.
- Tudo hoje cai em `outro` porque a heurística de kind não pega nome de marca sem palavra-chave — ao promover (Ação A) ou ajustar a heurística, muitos saem de `outro`.

## Ação C — MOVER para RUÍDO (não é programa)

- **Mídia/blogs (são as fontes, não programas):** melhoresdestinos, "melhores destinos", passageirodeprimeira, "passageiro de primeira", passageiroprimeira, "pontos pra voar", pontosparavoar, milhatododia, expomilhas, melhorescartoes.
- **Cidades/países/eventos/lugares:** argentina, chile, italia, lima, cusco, gramado, "natal luz"/natal_luz, expoflora, sauipe, "valle nevado", "atracoes e restaurantes da serra gaucha".
- **Lixo/genéricos:** fgts, oab, oab-rj, legionarios, whatsapp, chatgpt, google, "carteira google", serasa, "bancodobrasilnenhum,banco do nordeste", super7, saideira, zift, elbo, prospera, comerc, udm, hero, "loja oficial jbl", zoo_sp/zoologico_sp, parqueaquatico, rodagigantefoziguacu.
- **Ambíguos (decidir):** crypto.com (exchange com rewards — programa ou ruído?), astro/astropay(já head), revo, theclub, globalaccount, life.

## Números-alvo depois de A+C

- Promover ~90–100 marcas → cobertura de origem sobe de 84,6% para ~**92–94%**; a cauda `outro` encolhe para hotéis/one-offs.
- Mover mídia/cidades/lixo para ruído tira ~30–40 variantes de "candidata" (eram falsos positivos de bucket).
- Restante em bucket: hotéis individuais + marcas n=1 sem recorrência — aceitável até ganharem volume.

## Como quer proceder?

1. **Ratificar A** (eu adiciono as ~90 marcas ao `seed-aliases.json`, com kind), **C** (movo mídia/cidades/lixo p/ ruído), e re-rodo o classificador para os números finais.
2. Ou revisar grupo a grupo antes.
