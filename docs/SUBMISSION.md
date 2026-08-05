# Disclosure Dividend submission packet

Prepared for the GenLayer Portal Builders / Projects category.

## Recommended category

Projects

## Title

Disclosure Dividend

## Copy-ready short report

**Project name:** Disclosure Dividend

**Description:** Disclosure Dividend uses GenLayer validators to split funded security disclosure rewards from sealed researcher reports and public GitHub advisory evidence.

**GitHub (public):** https://github.com/duclucky/disclosure-dividend

**Live app:** https://disclosure-dividend.vercel.app

**Contract (studionet):** `0x484f2a86CAFa7E43894d78F846ad132df8Dc6F5A`

## Copy-ready notes / description

Disclosure Dividend is a GenLayer Projects-track dApp for sponsor-funded open-source security rewards. A sponsor creates a funded GEN pool for a target repository. Researchers seal a report commitment before disclosure, then reveal a public report after a GitHub advisory and patch are available. GenLayer validators independently inspect the bounded public evidence, normalize locked contribution roles, and finalize whether each sealed report materially supports Discovery, Root Cause, Exploit Proof, or Remediation Verification. The finalized consequence opens deterministic native GEN credits for researchers and sponsor remainder credits, with withdrawal guarded by canonical contract state. The repo includes the reusable DisclosureDividend contract, React/Vite frontend, direct/static tests, deployment parser tests, frontend tests, Studionet deployment evidence, successful CI, and a production Vercel app.

Character count: 914

## Evidence links

- Repository: https://github.com/duclucky/disclosure-dividend
- Live frontend: https://disclosure-dividend.vercel.app
- Successful CI for submission packet commit `8d94a627ff576bacb3b4e8d9e7368567ed26e03d`: https://github.com/duclucky/disclosure-dividend/actions/runs/31014180121
- Primary contract address: `0x484f2a86CAFa7E43894d78F846ad132df8Dc6F5A`
- Primary contract deploy transaction: https://explorer-studio.genlayer.com/tx/0x248225cd3616bd352acdacf0018cb09c7faf7240f82edb3d7b1699bc1d03fe7d
- Primary contract address explorer: https://explorer-studio.genlayer.com/address/0x484f2a86CAFa7E43894d78F846ad132df8Dc6F5A
- Lifecycle evidence file: `docs/evidence/studionet/deployment.json`
- Consumer / integration contract explorer: N/A. The v1 product intentionally uses one reusable contract; a second consumer contract would only mirror state.

## Verified facts

- Contract count: 1
- Primary contract: `DisclosureDividend` in `contracts/disclosure_dividend.py`
- Contract public interface: 20 methods total, 8 view methods and 12 write methods.
- Network: GenLayer Studionet
- Deployed contract source commit recorded in evidence: `94a4597cf37d5c8dbb002b52fd7fbcd54afed45a`
- Verified frontend/submission-base commit: `17b390199d86363cac709f5e8589a849c936e13e`
- Verified submission packet commit: `8d94a627ff576bacb3b4e8d9e7368567ed26e03d`
- Local verification command: `npm run check`
- Local verification result: GenVM lint/schema check passed; 13 direct/static contract tests passed; 3 deployment parser tests passed; frontend TypeScript passed; 30 frontend Vitest tests passed; production frontend build completed.
- CI verification: GitHub Actions run `31014180121` completed successfully for submission packet commit `8d94a627ff576bacb3b4e8d9e7368567ed26e03d`.
- Production frontend verification: `https://disclosure-dividend.vercel.app/` returned HTTP 200 and the deployed bundle contains the app landing/explorer copy.

## Studionet lifecycle evidence summary

- Demo status: `FINALIZED_LIFECYCLE`
- Demo pool: `node-tmp-msfnpd9s`
- Final pool status: `DISTRIBUTED`
- Claim outcome: `MATERIAL`
- Claim roles: `DISCOVERY,ROOT_CAUSE,EXPLOIT_PROOF,REMEDIATION_VERIFICATION`
- Final accounting: `total_received=1025`, `total_withdrawn=1025`, `contract_liability=0`

Lifecycle transactions:

- Create pool: `0xfa7ef5e7b3f5c6a73a3696691310221a3cf6ca27801c0b28fe4468f7fb9c52e6`
- Commit claim: `0x03510561dfe19f9ac067159fc8062347c94ad3193bb14e482bc0cf3f20567332`
- Close commit window: `0xd4afaa62707d66a5e877819fa580c7cbc59cb3354a8a9f51c646e1577969c366`
- Propose disclosure source: `0x49d5abdf24443c7ff7bdf000e09d6105bf7050c14b4d94e299a5cf876cb29405`
- Verify disclosure source: `0xfa024b835546e1d1667ec97f24952e067f8fb007b78c34262cb67dd3affdb4c7`
- Reveal claim: `0x3f5f6bec2e3f6c504e6781da460c5c69a4b4a4e811bbc3eb4d72317db10bb356`
- Close reveal window: `0x829cd891d12fc7b24536d6361755c1c8701bd96e9cb4e32ae6af4093b4bb6ad7`
- Adjudicate reward split: `0x7d7623e1f3cbd34d8fb63c8bcbd9df5427dc0171eb43a8b41bbb2fefacdff430`
- Withdraw credit: `0x0081dbd45e0b0e2498b6296d243d7ff89ea77e05c6b5c2ea832b2ad625aeac81`

## What validators inspect

Validators inspect the GitHub advisory `GHSA-ph9p-34f9-6g65`, the immutable patch commit `efa4a06f24374797ae32ab2b6ae39b7a611ae429`, and the revealed report URL committed by the claimant. They normalize source stage, target match, claimant identity, locked contribution roles, verdict class, and consequence class. Rationale wording is not consensus-critical.

## Why GenLayer is required

An ordinary database, EVM-only escrow, or sponsor-run backend LLM would let one operator decide whether a sealed report materially contributed before money moves. Disclosure Dividend needs validators to independently interpret public vulnerability evidence and agree on semantic role support. The finalized validator result directly changes native GEN credit balances and withdrawal rights.

## Reuse value

Other security programs, open-source foundations, package registries, and bounty platforms can use the contract interface to create funded pools, accept sealed commitments, verify disclosure sources, adjudicate role support, read canonical outcomes, and withdraw credits without copying this frontend.

## Honest limitations / pending

- The canonical full lifecycle evidence is script-signed on Studionet. A full production browser-wallet lifecycle through final distribution is not claimed.
- Browser wallet integration is implemented and covered by frontend tests, including provider selection, Studionet chain switching, persisted session restore, balance display, and logout.
- No mainnet deployment, real security-program adoption, external user volume, or non-Studionet value claim is made.
- CI has a non-blocking GitHub Actions annotation about Node.js 20 deprecation on actions; the current check run completed successfully.

## Why this category

This is a Projects submission because it includes both a reusable Intelligent Contract and a deployed wallet-enabled frontend. The frontend reads canonical Studionet contract views, exposes user-scoped actions, and avoids simulated canonical state. The submission does not rely on a second consumer contract because v1 has one real state owner and a pass-through consumer would not add an enforcement boundary.
