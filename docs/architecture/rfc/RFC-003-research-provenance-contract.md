# RFC-003 — Research & Provenance Contract
**Version 1.0 · Status: Proposed · Layer: Domain (Anti-Corruption Layer, upstream do Editorial)**

| Campo | Valor |
|---|---|
| Conforma-se a | RFC-001, DDD-001/002, Blueprint, Architecture Review |
| Resolve | F-16 (mecanismo da "ressalva" do Nível 3), reforça I-1, I-2, I-5, I-7 |
| Precedência | Regras Invioláveis > Operating Manual > RFC-001 > **RFC-003** |

## 1. Propósito
Formalizar a **fronteira de entrada** do domínio: nenhum fato existe dentro de uma Edição sem **proveniência classificada** e **vigência confirmada**. A RFC-003 é o ACL que o Blueprint aprovou entre o mundo (regulamentos, comunicados, rumores) e o agregado Edição. Ela torna **estrutural** a garantia Sage — não confiada à disciplina de quem pesquisa.

**Princípio.** *Um fato sem proveniência não é um fato — é um boato com boa aparência.*

## 2. Escopo
**IN:** o value object **Fato**, a **cadeia de proveniência**, a escala de **Nível de Autoridade**, a **Vigência** e sua confirmação, o estado **Radar**, e as obrigações do ACL.
**OUT:** como se descobre um fato (método de pesquisa é ofício, não domínio); ferramentas; serialização.

## 3. Ubiquitous Language (adições)
| Termo | Definição |
|---|---|
| **Fato** | Afirmação verificável admitida no domínio, com origem e validade. |
| **Cadeia de proveniência** | Sequência *fato → fonte → confirmação → ratificação* que torna o fato auditável. |
| **Confirmação** | Ato datado de verificar a vigência/veracidade contra a fonte. |
| **Radar** | Fato admitido como *monitoramento*, incapaz de sustentar veredito. |
| **Janela de frescor** | Prazo máximo entre a Confirmação e a publicação. |
| **Corroboração** | Segunda fonte independente que eleva o teto de veredito. |

## 4. Entidade central: **FATO** (value object)
- **Responsabilidade.** Carregar uma afirmação com origem, nível e validade.
- **Objetivo.** Ser a menor unidade auditável do domínio.
- **Propriedades.** Afirmação (texto próprio, nunca reproduzido); Fonte (nível 1–4); Confirmação (datada); Vigência (janela); Estado (Admitido | Radar | Rejeitado | Expirado).
- **Relacionamentos.** Sustenta Deals, Sinal e Fecha logo; ≥1 por afirmação de análise.
- **Lifecycle.** `Capturado → Classificado(nível) → Confirmado(vigência) → {Admitido | Radar | Rejeitado} → Expirado`.
- **Ownership.** Analista/Research.
- **Versionamento.** A escala de níveis e a janela de frescor são versionadas com esta RFC.
- **Governança.** Ver invariantes R-1..R-6.

## 5. Escala de Nível de Autoridade (com mecanismo da ressalva — resolve F-16)

| Nível | Natureza | Teto de veredito que sustenta sozinho | Ressalva |
|---|---|---|---|
| 1 | Regulamento/comunicado oficial | Vale agir (pleno) | — |
| 2 | Canal oficial secundário / T&C | Vale agir (pleno) | — |
| 3 | Cobertura terceirizada confiável | **Teto: Vale olhar** | Para ultrapassar o teto, **DEVE** haver Corroboração por fonte Nível ≤2 |
| 4 | Sinal social / não-oficial | **Não sustenta** → força `Não confirmado` (Radar) | Só entra como Radar |

**Mecanismo da ressalva (a lacuna F-16, agora fechada):** um fato de Nível 3 **limita** o veredito ao teto "Vale olhar"; a **Corroboração** por Nível 1–2 destrava as faixas superiores. Isso dá ao "sustenta com ressalva" uma regra testável, não uma frase.

## 6. Contrato do ACL

| Obrigações (DEVE) | Proibições (NÃO DEVE) | Garantias |
|---|---|---|
| Todo fato entra com Nível **e** Vigência. | Admitir dado interno/CMI/proprietário (I-1). | Nenhum fato órfão no agregado. |
| Confirmação datada e dentro da Janela de Frescor. | Reproduzir texto/estrutura de fonte (I-2). | Nível 4 nunca vira veredito. |
| Afirmação em redação **própria**. | Inventar dado ausente (I-5). | Vigência vencida barrada na origem (I-7). |

## 7. Decision tree — admissão
```
Fato proposto
 ├─ interno/CMI? ───────── sim ▶ REJEITADO (I-1)
 ├─ reproduz fonte? ────── sim ▶ REJEITADO (I-2)
 ├─ sem Nível? ─────────── sim ▶ REJEITADO (sem proveniência)
 ├─ Nível 4? ───────────── sim ▶ RADAR (não sustenta)
 ├─ Vigência não conf.? ── sim ▶ RADAR / Não confirmado (I-7)
 ├─ Confirmação fora da janela de frescor? ── sim ▶ RECONFIRMAR ou RADAR
 ├─ Nível 3 sem corroboração? ─ sim ▶ ADMITIDO com teto "Vale olhar"
 └─ senão ─────────────────────── ADMITIDO pleno
```

## 8. Invariantes (R-x)
| # | Invariante |
|---|---|
| R-1 | Todo Fato tem Nível e Vigência. |
| R-2 | Nível 4 nunca sustenta veredito. |
| R-3 | Nível 3 sozinho limita a "Vale olhar"; destrava só com Corroboração ≤2. |
| R-4 | Confirmação DEVE ser datada e dentro da Janela de Frescor no momento da publicação. |
| R-5 | Afirmação em redação própria (anti-cópia). |
| R-6 | Sem dado interno/CMI, em nenhuma hipótese. |

## 9. Examples / Counter-examples
- ✅ Fato Nível 1, vigência confirmada 6h antes → sustenta "Vale agir".
- ❌ Rumor social ("120% em breve") tratado como fato → viola R-2; correto = Radar.
- ❌ Blog terceirizado (Nível 3) sozinho ancorando "Vale agir 88" → viola R-3; teto seria "Vale olhar".
- ❌ "Conversão média do programa" como fonte → viola R-6 (CMI).

## 10. Anti-patterns
Fonte órfã · cópia-e-cola com citação · confirmação sem data · "todo mundo sabe" (nível ausente) · rumor promovido a fato por repetição.

## 11. Alternativas descartadas
- *Validar proveniência só na publicação* → permite boato circular pelo pipeline; ACL na entrada vence.
- *Escala binária (oficial/não-oficial)* → perde a nuance do Nível 3; escala 1–4 com ressalva vence.

## 12. Dependências / questões abertas
Depende de RFC-007 (o teto de nível interage com a faixa de score). Janela de Frescor exata → governada como constante (ver RFC-005 §constantes). Q: independência de duas fontes para "Corroboração" precisa de definição (v1.1).
