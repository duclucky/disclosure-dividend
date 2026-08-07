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

**Contract (studionet):** `0x51eafA78c75467Fe4AF36f875c70E9A3DB458DBB`

## Copy-ready notes / description

Disclosure Dividend is a GenLayer Projects-track dApp for sponsor-funded open-source security rewards. A sponsor creates a funded GEN pool for a target repository. Researchers seal a report commitment before disclosure, then reveal a public report after a GitHub advisory and patch are available. GenLayer validators independently inspect the bounded public evidence, normalize locked contribution roles, and finalize whether each sealed report materially supports Discovery, Root Cause, Exploit Proof, or Remediation Verification. The finalized consequence opens deterministic native GEN credits for researchers and sponsor remainder credits, with withdrawal guarded by canonical contract state. The repo includes the reusable DisclosureDividend contract, React/Vite frontend, direct/static tests, deployment parser tests, frontend tests, Studionet deployment evidence, successful CI, reviewer-requested cancellation hardening, browser-exposed lifecycle writes, and a production Vercel app.

Character count: 991

## Evidence links

- Repository: https://github.com/duclucky/disclosure-dividend
- Live frontend: https://disclosure-dividend.vercel.app
- Successful CI for submission packet commit `8d94a627ff576bacb3b4e8d9e7368567ed26e03d`: https://github.com/duclucky/disclosure-dividend/actions/runs/31014180121
- Primary contract address: `0x51eafA78c75467Fe4AF36f875c70E9A3DB458DBB`
- Primary contract deploy transaction: https://explorer-studio.genlayer.com/tx/0xac575dfbba74b422f78ac10aab9e2ac896cb3df570ae2a2b0052c52fdd47750c
- Primary contract address explorer: https://explorer-studio.genlayer.com/address/0x51eafA78c75467Fe4AF36f875c70E9A3DB458DBB
- Lifecycle evidence file: `docs/evidence/studionet/deployment.json`
- Consumer / integration contract explorer: N/A. The v1 product intentionally uses one reusable contract; a second consumer contract would only mirror state.

## Verified facts

- Contract count: 1
- Primary contract: `DisclosureDividend` in `contracts/disclosure_dividend.py`
- Contract public interface: 20 methods total, 8 view methods and 12 write methods.
- Network: GenLayer Studionet
- Deployed contract source commit recorded in evidence: `1331b8df018f3f47b7bfc08651d5b7537584d1cc`
- Verified frontend/submission-base commit: `17b390199d86363cac709f5e8589a849c936e13e`
- Verified submission packet commit: `8d94a627ff576bacb3b4e8d9e7368567ed26e03d`
- Local verification command: `npm run check`
- Local verification result: GenVM lint/schema check passed; 15 direct/static contract tests passed; 3 deployment parser tests passed; frontend TypeScript passed; 32 frontend Vitest tests passed; production frontend build completed.
- CI verification: GitHub Actions run `31014180121` completed successfully for submission packet commit `8d94a627ff576bacb3b4e8d9e7368567ed26e03d`.
- Production frontend deployment: `https://frontend-byo9i8evq-duckys-projects-bc83c6a0.vercel.app` (`dpl_CzbKvKpkFcoB2J3DokwKKYgv4aLN`), aliased to `https://disclosure-dividend.vercel.app`.
- Production frontend verification: `https://disclosure-dividend.vercel.app/` returned HTTP 200; the deployed bundle contains `0x51eafA78c75467Fe4AF36f875c70E9A3DB458DBB`, does not contain the superseded `0x484f...` address, and includes the lifecycle controls `Propose Disclosure`, `Request Validator Review`, and `Retry Pool`.

## Response to reviewer request

- `cancel_pool` is now sponsor-authorized and restricted to explicit safe recovery states: `COMMIT_OPEN` with zero claims, or `RETRYABLE` with zero revealed reports.
- `cancel_pool` is idempotent: if the pool is already `CANCELLED`, the method returns without opening any additional credit.
- Direct tests prove a second cancel cannot credit the same funds twice and that cancellation cannot bypass adjudication once a pool reaches `READY_FOR_REVIEW`.
- The browser frontend now exposes the contract writes required to advance and adjudicate a pool without relying on `scripts/deploy_studionet.mjs`: `close_commit_window`, `propose_disclosure`, `verify_disclosure`, `close_reveal_window`, `adjudicate_pool`, and `retry_pool`.

## Studionet lifecycle evidence summary

- Demo status: `FINALIZED_LIFECYCLE`
- Demo pool: `node-tmp-msj5t2v5`
- Final pool status: `DISTRIBUTED`
- Claim outcome: `MATERIAL`
- Claim roles: `DISCOVERY,ROOT_CAUSE,EXPLOIT_PROOF,REMEDIATION_VERIFICATION`
- Final accounting: `total_received=1025`, `total_withdrawn=1025`, `contract_liability=0`

Lifecycle transactions:

- Create pool: `0x8b521b7903b496d63e14b2f59bd11e3bd4c5517a0bf81f154a0b3bd09f694236`
- Commit claim: `0xeb9b99470f2a44510f5090c639c99e1cb0e9191d216eca7326171e0ed6df0f56`
- Close commit window: `0x2f5357005896ef35d8bcc1e7e9d06cfe3b70e9910b9d02b433a213228fe89e15`
- Propose disclosure source: `0x8a2e7a91c4a770ab3330788bf737d7ce46cb1a841955bd55b476734213830c10`
- Verify disclosure source: `0x920f2ba3cd412c997d0e06ceaefbf1d96c0e1982a188a76c6e005e6348a12025`
- Reveal claim: `0xb1cae3798f7c9adbcaac4d1360b30631e55d474121754a3763f6fafaab4a4bdb`
- Close reveal window: `0xb54eb9283526b7b24d2941f3e71b9e8765b00effc564ae78e9c683af29f5a898`
- Adjudicate reward split: `0xaf62c435b5a99c2fb95ff6d41b9099e5cf5f89bcaef5a0124d67fc5a8ca2b613`
- Withdraw credit: `0x70919b793137aedbe7b6aa58ff9822a3e7face877c74e641129d89a71ed8bf88`

## What validators inspect

Validators inspect the GitHub advisory `GHSA-ph9p-34f9-6g65`, the immutable patch commit `efa4a06f24374797ae32ab2b6ae39b7a611ae429`, and the revealed report URL committed by the claimant. They normalize source stage, target match, claimant identity, locked contribution roles, verdict class, and consequence class. Rationale wording is not consensus-critical.

## Why GenLayer is required

An ordinary database, EVM-only escrow, or sponsor-run backend LLM would let one operator decide whether a sealed report materially contributed before money moves. Disclosure Dividend needs validators to independently interpret public vulnerability evidence and agree on semantic role support. The finalized validator result directly changes native GEN credit balances and withdrawal rights.

## Reuse value

Other security programs, open-source foundations, package registries, and bounty platforms can use the contract interface to create funded pools, accept sealed commitments, verify disclosure sources, adjudicate role support, read canonical outcomes, and withdraw credits without copying this frontend.

## Honest limitations / pending

- The canonical full lifecycle evidence is script-signed on Studionet. A full production browser-wallet lifecycle through final distribution is not claimed.
- Browser wallet integration is implemented and covered by frontend tests, including provider selection, Studionet chain switching, persisted session restore, balance display, logout, source proposal/verification, window closing, adjudication, and retry.
- No mainnet deployment, real security-program adoption, external user volume, or non-Studionet value claim is made.
- CI has a non-blocking GitHub Actions annotation about Node.js 20 deprecation on actions; the current check run completed successfully.

## Why this category

This is a Projects submission because it includes both a reusable Intelligent Contract and a deployed wallet-enabled frontend. The frontend reads canonical Studionet contract views, exposes user-scoped actions, and avoids simulated canonical state. The submission does not rely on a second consumer contract because v1 has one real state owner and a pass-through consumer would not add an enforcement boundary.
