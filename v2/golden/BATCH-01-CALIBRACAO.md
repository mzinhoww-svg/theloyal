# Golden set — leva 1 de calibração (15 itens)

> Para o operador calibrar o critério ANTES da rotulação em escala. Rótulos com proveniência (trecho que justifica). Cada item aponta o erro de extração atual. **Não escalar para 100 até a calibração ser aprovada.**

## A · `origem_generica_recuperavel` (os 22 obrigatórios — leva com 8)

| # | notícia (título) | tipo (gabarito) | origem | destino | % | vigência | erro atual | proveniência |
|---|---|---|---|---|---|---|---|---|
| 1 | Ultrablue **BTG Pactual** (cartão alta renda, pontos ou cashback) | bonus_acumulo | **btg** | sem_destino | — | indeterminada | origem `banco`→btg | título "Ultrablue **BTG Pactual**" |
| 2 | Cartão **Azul** Skyline / Visa Infinite: 100 mil pontos bônus | bonus_acumulo | **azul_fidelidade** | sem_destino | — | últimos dias | origem `cartao azul`→azul | título "Cartão **Azul** Skyline… 100 mil pontos bônus" |
| 3 | Pontos dos cartões **BTG** → programa próprio do banco (muda 20/02) | outro (estrutural) | **btg** | sem_destino | — | 2025-02-20 | origem `banco`→btg | título "cartões **BTG**"; trecho "a partir de 20/02" |
| 4 | Azul Fidelidade: até 110% na transferência **do cartão** (até 12/09) | transferencia_bonificada | **multiplos_cartoes** | azul_fidelidade | 110 | 2025-09-12 | origem `cartao` (multi) | "transferência de pontos **do cartão**"; "110%"; "válida até 12/09" |
| 5 | Azul Fidelidade: até 130% na transferência do cartão (até 19/11) | transferencia_bonificada | **multiplos_cartoes** | azul_fidelidade | 130 | 2025-11-19 | origem `cartao` (multi) | "130%"; "até 19/11" |
| 6 | Azul Fidelidade: até 110% na transferência do cartão | transferencia_bonificada | **multiplos_cartoes** | azul_fidelidade | 110 | indeterminada | origem `cartao` (multi) | "110%… do cartão" |
| 7 | LATAM Pass: até 30% ao transferir dos cartões — **diversos bancos** (termina hoje 28) | transferencia_bonificada | **multiplos_cartoes** | latam_pass | 30 | 2024-06-28 | origem `cartao` (multi) | "de **diversos bancos**"; "30%"; "Termina hoje (28)" |
| 8 | LATAM Pass: até 40% ao transferir do cartão — **mais de 10 bancos** | transferencia_bonificada | **multiplos_cartoes** | latam_pass | 40 | indeterminada | origem `cartao` (multi) | "**mais de 10 bancos**"; "40%" |

## B · cobertura de tipos limpos + negativos (leva com 7)

| # | notícia (título) | tipo (gabarito) | origem | destino | % | vigência | erro atual | proveniência |
|---|---|---|---|---|---|---|---|---|
| 9 | Esfera **prorroga** transferência para AAdvantage | `parceria_sem_bonus` → outro? | esfera | aa_advantage | **null** | indeterminada | rotulado transferência **sem bônus** | "**prorroga** transferência" (sem %) |
| 10 | Esfera **anuncia parceria** com TAP Miles&Go **e** Aeromexico | `parceria_sem_bonus` → outro? | esfera | aeromexico (+tap) | null | indeterminada | 2 destinos numa notícia; sem bônus | "anuncia parceria… TAP **e** Aeromexico" |
| 11 | Esfera ganha 2 parceiros: **IHG e Air France/KLM** | `parceria_sem_bonus` → outro? | esfera | flyingblue (+ihg) | null | indeterminada | 2 destinos; sem bônus | "IHG **e** Air France/KLM" |
| 12 | Cama/mesa/banho até 60% OFF — cupom do **9.9** | **não é campanha** (cupom varejo) | — | — | — | — | `falso_positivo`: virou compra_pontos | "até 60% **OFF**… cupom do 9.9" (varejo) |
| 13 | Resgates de Primeira: NY→Manaus executiva 30k milhas AAdvantage (**economia 90%**) | **não é campanha** (exemplo de resgate) | — | — | — | — | `resgate_como_compra`: 90% virou % | "**economia** de 90%" (não é bônus) |
| 14 | AA vai premiar 100 mil milhas o 1º bebê de 1º de maio | **não é campanha** (stunt de PR) | — | — | — | — | `falso_positivo`: virou clube | conteúdo é ação de RP, não promo |
| 15 | Universo AAdvantage 50% OFF + "Dominando o Seats.aero" grátis | **não é campanha** (produto do blog) | — | — | — | — | `falso_positivo`: virou clube | é **curso do blog**, não clube do programa |

## Calibração — 4 decisões que preciso de você antes das 100

1. **Multi-banco (itens 4–8):** confirmo `origem_programa = multiplos_cartoes` (sentinela) com `publico=cartao`? É o caso mais comum de transferência bonificada e não é recuperável a 1 banco — o genérico está **certo**, ao contrário dos itens 1–3.
2. **Parceria/prorrogação sem bônus (9–11):** a rota é real mas não há % de bônus. Rotulo como `transferencia_bonificada` com `percentual=null`, ou crio distinção (`parceria`→`outro`) para não poluir o Deal Desk com "transferência sem valor"?
3. **Negativos (12–15):** confirmo incluir **notícias que NÃO são campanha** no golden set (cupom de varejo, resgate, stunt, produto do blog)? Sem negativos o portão não mede precision de verdade — mas quero seu aval de que o golden set arbitra também "o que a extração deveria REJEITAR".
4. **Notícia com 2 destinos (10–11):** uma notícia gera 2 campanhas (uma por destino). O gabarito deve then ter 2 linhas para a mesma notícia? Confirmo esse formato 1-notícia→N-campanhas.

Aprovadas as 4, produzo as 100 no critério calibrado (22 generica + cobertura dos 9 tipos + lado único + negativos, com proveniência), meço precision/recall e fecho a slice 4.
