# Disclosure Dividend Stage 2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete Disclosure Dividend from returned frontend artifacts through specification, contract, tests, frontend integration, Studionet evidence, public app, and submission packet.

**Architecture:** Keep the returned Luminous Protocol layout and convert its static HTML screens into a Vite/React app with a typed adapter. Implement one GenLayer Intelligent Contract that owns pools, commitments, source verification, semantic review, deterministic GEN credits, and withdrawals. Use one deployment/evidence script; no consumer contract unless a real independent state boundary appears.

**Tech Stack:** GenVM Python contract, gltest direct tests, Node/Vite/React/TypeScript/Tailwind CSS, genlayer-js on Studionet.

## Global Constraints

- Category remains `Projects`.
- Network remains `studionet`.
- Preserve returned frontend visual layout; do not regenerate or redesign.
- Primary UI shows only user-relevant pool, claim, credit, wallet, transaction, and consequence state.
- No private keys in frontend env; no fake balances, gas, fees, signatures, finality, or canonical state.
- Contract consequence is finalized GEN credits and withdrawal accounting.
- `npm run check` is the local verification gate after contract/tests/frontend changes.

---

### Task 1: Phase 3B Frontend Baseline

**Files:**
- Create: `frontend/package.json`, `frontend/index.html`, `frontend/vite.config.ts`, `frontend/tsconfig.json`, `frontend/src/*`
- Preserve: `frontend/*/code.html`, `frontend/*/screen.png`, `frontend/luminous_protocol/DESIGN.md`
- Modify: `.gitignore`, `README.md`, `docs/README.md`

**Interfaces:**
- Produces: `DisclosureDividendAdapter` and app routes `/`, `/pools/:poolId`, `/account`, `/create`.

- [ ] Write frontend tests for route rendering, fixture boundary label, role/state action visibility, and missing contract address.
- [ ] Run frontend tests and confirm they fail before implementation.
- [ ] Build the Vite/React app from the returned design language.
- [ ] Remove or replace non-product UI: fake network stats, ETH/APY/USD/DDP, governance/security audit/sidebar reviewer controls, gas estimate, committee/manual review language.
- [ ] Run frontend tests, `npm --prefix frontend run lint`, and `npm --prefix frontend run build`.

### Task 2: Phase 4 Full Specification

**Files:**
- Modify: `docs/README.md`, `README.md`, root `..\docs\IDEA-REGISTRY.md`

**Interfaces:**
- Produces: finalized write/view names and claim-to-code matrix.

- [ ] Complete trust model, state machine, evidence policy, consensus output, equivalence, consequence mapping, tests, deployment evidence plan, and UI matrices.
- [ ] Move status to `BUILDING` only after the claim-to-code matrix has no blank cells.
- [ ] Run docs self-review for stale Stage 1 claims and forbidden evidence claims.

### Task 3: Phase 5-6 Contract And Direct Tests

**Files:**
- Create: `contracts/disclosure_dividend.py`
- Create: `tests/direct/conftest.py`, `tests/direct/helpers.py`, `tests/direct/test_*.py`
- Create: `tests/test_static_contract.py`, `tests/test_deployment_receipts.py`, `tests/studionet_script.test.mjs`
- Create: `scripts/check.ps1`, `scripts/ascii_contract_check.py`, `scripts/studionet.mjs`, `scripts/deployment_receipts.py`
- Modify: `package.json`, `.env.example`

**Interfaces:**
- Contract writes: `create_pool`, `commit_claim`, `propose_disclosure`, `verify_disclosure`, `reveal_claim`, `close_reveal_window`, `adjudicate_pool`, `retry_pool`, `cancel_pool`, `settle_unrevealed`, `withdraw_credit`.
- Contract views: `get_pool_ids`, `get_pool`, `get_pool_claims`, `get_claim`, `get_account_pool_ids`, `get_credit`, `get_attempt`, `get_contract_summary`.

- [ ] Write failing direct/static tests for state creation, authorization, value/payable metadata, source guards, reveal preimage, semantic review, retry/cancel, duplicate settlement, withdrawal, malicious output, and receipt parsing.
- [ ] Implement the contract and scripts incrementally until focused tests pass.
- [ ] Run `npm run check`.

### Task 4: Phase 7-10 Frontend Integration

**Files:**
- Modify: `frontend/src/lib/adapter.ts`, `frontend/src/lib/wallet.ts`, `frontend/src/App.tsx`, `frontend/src/*.test.tsx`
- Create: `frontend/.env.example`

**Interfaces:**
- Adapter implementation uses `genlayer-js` `createClient({ chain: studionet, account })`, view reads, write transactions, receipt waiting, canonical reload.

- [ ] Write failing adapter/wallet tests for missing address, provider discovery fallback, Studionet chain switching, transaction lifecycle mapping, and canonical reload.
- [ ] Replace fixture-only adapter with real GenLayer adapter plus clearly labeled development fallback.
- [ ] Run frontend tests, lint, and production build.
- [ ] Scan UI strings for English-only user-facing copy.

### Task 5: Phase 8-15 Deployment, Evidence, Publish, Submit

**Files:**
- Create/update: `docs/evidence/studionet/*`, `README.md`, deployment JSON files
- Modify: `frontend/.env` only as ignored local config after deployment

**Interfaces:**
- `npm run studionet:inspect`, `npm run studionet:deploy`, `npm run studionet:lifecycle`.

- [ ] Discover secrets safely from project `.env`, then parent `.env`, without printing values.
- [ ] Verify current official/studionet/tool status before network debugging.
- [ ] Deploy, run lifecycle, save safe allowlisted evidence, and verify canonical views/credits/balances.
- [ ] Wire deployed address into frontend local/prod env and build.
- [ ] Run public Git hygiene audit, push public repo, deploy Vercel, verify live URL with `curl`.
- [ ] Prepare copy-ready submission packet with exact counts, URLs, evidence, and limitations.

### Task 6: Phase 16 Postmortem

**Files:**
- Modify: `..\docs\IDEA-REGISTRY.md`
- Create: `docs/POSTMORTEM.md`

- [ ] Update registry status/outcome from actual evidence.
- [ ] Record validated vs pending items and anti-duplication fingerprint.
