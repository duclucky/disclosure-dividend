# Disclosure Dividend

Disclosure Dividend is a GenLayer dApp that divides a funded open-source
security reward among researchers whose sealed pre-disclosure reports made
material, non-duplicative contributions to a published vulnerability.

Status: **BUILDING - Stage 2 implementation**.

The full Stage 2 specification is in [docs/README.md](docs/README.md). The
returned frontend has been audited and converted into a buildable Vite/React
baseline. Contract source, direct tests, Studionet deployment, browser-wallet
evidence, public repository, and production deployment remain pending until
their phases produce evidence.

## Why GenLayer

Different researchers may describe the same root cause, exploit path, or
remediation evidence in different language. A sponsor-run database or one LLM
can store those claims, but it leaves financially opposed contributors trusting
the sponsor to decide materiality and overlap. GenLayer validators will inspect
the same bounded public evidence, agree on contribution meaning, and make that
accepted verdict open native-GEN withdrawal credits.

## Planned track

- Category: Projects
- Network: GenLayer Studionet
- Architecture: one Intelligent Contract plus a wallet-enabled Vite/React dApp
- Current boundary: local frontend baseline exists; contract and network
  lifecycle are not yet claimed
