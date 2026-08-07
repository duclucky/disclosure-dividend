# Disclosure Dividend

Disclosure Dividend is a GenLayer Projects-track dApp that divides a funded open-source security reward among researchers whose sealed pre-disclosure reports prove locked contribution roles against a later public advisory and patch.

Status: **Reviewer remediation complete; Studionet lifecycle complete; Vercel frontend deployed**.

## Live project evidence

- Repository: `https://github.com/duclucky/disclosure-dividend`
- Studionet contract: `0x51eafA78c75467Fe4AF36f875c70E9A3DB458DBB`
- Contract Explorer: `https://explorer-studio.genlayer.com/tx/0xac575dfbba74b422f78ac10aab9e2ac896cb3df570ae2a2b0052c52fdd47750c`
- Contract Address Explorer: `https://explorer-studio.genlayer.com/address/0x51eafA78c75467Fe4AF36f875c70E9A3DB458DBB`
- Contract deployment source commit: `1331b8df018f3f47b7bfc08651d5b7537584d1cc`
- Verified frontend/submission-base commit: `17b390199d86363cac709f5e8589a849c936e13e`
- Verified submission packet commit: `8d94a627ff576bacb3b4e8d9e7368567ed26e03d`
- Lifecycle evidence: `docs/evidence/studionet/deployment.json`
- Submission packet: `docs/SUBMISSION.md`
- Successful CI for submission packet commit: `https://github.com/duclucky/disclosure-dividend/actions/runs/31014180121`
- Frontend production URL: `https://disclosure-dividend.vercel.app`
- Latest Vercel deployment: `https://frontend-byo9i8evq-duckys-projects-bc83c6a0.vercel.app` (`dpl_CzbKvKpkFcoB2J3DokwKKYgv4aLN`)
- Final demo state: `FINALIZED_LIFECYCLE`
- Final pool: `node-tmp-msj5t2v5`, status `DISTRIBUTED`
- Final accounting: `total_received=1025`, `total_withdrawn=1025`, `contract_liability=0`

## Reviewer remediation

The latest contract revision addresses the “More information requested” review:

- `cancel_pool` is restricted to explicit safe recovery states only: `COMMIT_OPEN` before any claim exists, or `RETRYABLE` before any report has been revealed.
- `cancel_pool` is idempotent: calling it again on an already cancelled pool is a no-op and cannot credit the same funds twice.
- Direct tests prove cancellation cannot bypass live adjudication from `READY_FOR_REVIEW` and cannot duplicate sponsor credit.
- The browser frontend now exposes the writes needed to advance a pool without the deployment script: `close_commit_window`, `propose_disclosure`, `verify_disclosure`, `close_reveal_window`, `adjudicate_pool`, and `retry_pool`.

## Why GenLayer

Researchers and sponsors have conflicting incentives over whether a sealed report materially contributed to a public vulnerability disclosure. A sponsor database, ordinary EVM contract, or backend LLM would still let one operator decide contribution roles before money moves. Disclosure Dividend makes validators independently inspect bounded public evidence, then turns the finalized verdict into native GEN withdrawal credits.

## What validators inspect

- The GitHub advisory for `GHSA-ph9p-34f9-6g65`.
- The immutable patch commit `efa4a06f24374797ae32ab2b6ae39b7a611ae429`.
- The revealed public report URL that matches the claimant's earlier commitment.
- Locked role vocabulary: `DISCOVERY`, `ROOT_CAUSE`, `EXPLOIT_PROOF`, `REMEDIATION_VERIFICATION`.

## Implementation

- Contract: `contracts/disclosure_dividend.py`
- Frontend: `frontend/`
- Full specification: `docs/README.md`
- Direct/static tests: `tests/`
- Deployment tooling: `scripts/deploy_studionet.mjs`

## Verification

Latest local verification:

```powershell
npm run check
```

Result: GenVM lint/schema check passed, 15 direct/static contract tests passed, 3 deployment parser tests passed, frontend TypeScript passed, 32 frontend tests passed, and production frontend build completed. Vite reports a non-blocking bundle-size warning.

## Honest limits

- The current frontend reads/writes the configured Studionet contract through `genlayer-js`, including lifecycle advancement/adjudication actions. The canonical full lifecycle evidence is still script-signed; a full production browser-wallet lifecycle through final distribution is not claimed.
- No real security-program adoption, mainnet deployment, or non-Studionet value claim is made.
