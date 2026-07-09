# Architecture & AAP — The Loyalty

Índice dos artefatos produzidos na linha do **AAP** (Architecture Approval Process)
para o Editorial Content Model e a operação editorial do The Loyalty.

> Documentos de **domínio e arquitetura**. Não contêm código, serialização,
> framework ou plataforma. Hierarquia de verdade do projeto (ver `CLAUDE.md`)
> precede qualquer documento aqui.

## Ordem de leitura

| # | Documento | O que é | Status |
|---|---|---|---|
| 00 | [Discovery Report](./00-discovery-report.md) | Auditoria de assunção do repositório (11 fases) | Fechada |
| 01 | [First Edition Plan](./01-first-edition-plan.md) | Plano executável da 1ª edição (canal MCP + assets) | Fechada |
| — | [RFC-001 — Editorial Content Model](./rfc/RFC-001-editorial-content-model.md) | Modelo de domínio editorial | v1.0 (aprovada condicionalmente) |
| — | [RFC-001 — Auditoria](./rfc/RFC-001-audit.md) | Revisão independente da RFC-001 (score 81/100, 6 P0) | Fechada |
| — | RFC-002 — Renderer Projection Contract | Prova de fidelidade da projeção | **Pendente** (depende de ADR-003 + C-1) |
| — | [RFC-003 — Research & Provenance Contract](./rfc/RFC-003-research-provenance-contract.md) | ACL de entrada; níveis de fonte; vigência | v1.0 proposta |
| — | [RFC-004 — Publisher & Dispatch Contract](./rfc/RFC-004-publisher-dispatch-contract.md) | Despacho, idempotência, gatilho humano | v1.0 proposta |
| — | [RFC-005 — Automation & Gating Contract](./rfc/RFC-005-automation-gating-contract.md) | Gate mecânico vs. julgamento humano | v1.0 proposta |
| — | [RFC-006 — Product Specializations](./rfc/RFC-006-product-specializations.md) | Daily/Weekly/Lab/Pro/Special; namespace de numeração | v1.0 proposta |
| — | [RFC-007 — Scoring Methodology](./rfc/RFC-007-scoring-methodology.md) | Pontuação TL, reconciliação, comparabilidade | v1.0 proposta |
| — | [RFC-008 — Errata & Correction Policy](./rfc/RFC-008-errata-correction-policy.md) | Correção pós-publicação append-only | v1.0 proposta |

## Pendências conhecidas

- **RFC-002** (Renderer Projection Contract) — o *oráculo de fidelidade* segue em aberto.
- **ADRs formais** (ADR-001..008) identificados na auditoria da RFC-001 ainda não redigidos.
- **RFC de Unidade** (achado F-14) — pré-requisito de reconciliação plena em RFC-007.
- Análise de **migração** dos artefatos demo/legado (achado F-19).

## Nota sobre "outros chats"

Trabalhos de outras sessões paralelas deste projeto vivem como **PRs abertos**
no GitHub (à data desta escrita: #10, #11, #13 — CI/DevOps, GO-LIVE, consolidação
de renderer). Não são reproduzíveis aqui porque não estão no contexto desta
sessão; estão rastreáveis pelos próprios PRs.
