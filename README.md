# Disclosure Dividend

Disclosure Dividend is a GenLayer Projects-track dApp that divides a funded open-source security reward among researchers whose sealed pre-disclosure reports prove locked contribution roles against a later public advisory and patch.

Status: **Studionet lifecycle complete; Vercel frontend deployed**.

## Live project evidence

- Repository: `https://github.com/duclucky/disclosure-dividend`
- Studionet contract: `0x484f2a86CAFa7E43894d78F846ad132df8Dc6F5A`
- Contract Explorer: `https://explorer-studio.genlayer.com/tx/0x248225cd3616bd352acdacf0018cb09c7faf7240f82edb3d7b1699bc1d03fe7d`
- Contract Address Explorer: `https://explorer-studio.genlayer.com/address/0x484f2a86CAFa7E43894d78F846ad132df8Dc6F5A`
- Contract deployment source commit: `94a4597cf37d5c8dbb002b52fd7fbcd54afed45a`
- Verified frontend/submission-base commit: `17b390199d86363cac709f5e8589a849c936e13e`
- Lifecycle evidence: `docs/evidence/studionet/deployment.json`
- Submission packet: `docs/SUBMISSION.md`
- CI: `https://github.com/duclucky/disclosure-dividend/actions/runs/31012926269`
- Frontend production URL: `https://disclosure-dividend.vercel.app`
- Final demo state: `FINALIZED_LIFECYCLE`
- Final pool: `node-tmp-msfnpd9s`, status `DISTRIBUTED`
- Final accounting: `total_received=1025`, `total_withdrawn=1025`, `contract_liability=0`

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

Result: GenVM lint/schema check passed, 13 direct/static contract tests passed, 3 deployment parser tests passed, frontend TypeScript passed, 30 frontend tests passed, and production frontend build completed. Vite reports a non-blocking bundle-size warning.

## Honest limits

- The current frontend reads/writes the configured Studionet contract through `genlayer-js`, but the canonical full lifecycle evidence is script-signed; a full production browser-wallet lifecycle through final distribution is still not claimed.
- No real security-program adoption, mainnet deployment, or non-Studionet value claim is made.
