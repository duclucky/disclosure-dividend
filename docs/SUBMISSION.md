# Disclosure Dividend submission fields

## Category

Projects

## Project name

Disclosure Dividend

## Repository

https://github.com/duclucky/disclosure-dividend

## Primary contract

- Network: GenLayer Studionet
- Contract address: `0x484f2a86CAFa7E43894d78F846ad132df8Dc6F5A`
- Deploy transaction / Explorer: https://explorer-studio.genlayer.com/tx/0x248225cd3616bd352acdacf0018cb09c7faf7240f82edb3d7b1699bc1d03fe7d
- Source commit: `94a4597cf37d5c8dbb002b52fd7fbcd54afed45a`

## Frontend

https://disclosure-dividend.vercel.app

## CI

https://github.com/duclucky/disclosure-dividend/actions/runs/30980558503

## Lifecycle evidence

- Evidence file: `docs/evidence/studionet/deployment.json`
- Demo status: `FINALIZED_LIFECYCLE`
- Demo pool: `node-tmp-msfnpd9s`
- Final pool status: `DISTRIBUTED`
- Claim outcome: `MATERIAL`
- Claim roles: `DISCOVERY,ROOT_CAUSE,EXPLOIT_PROOF,REMEDIATION_VERIFICATION`
- Final accounting: `total_received=1025`, `total_withdrawn=1025`, `contract_liability=0`

## Copy-ready description

Disclosure Dividend is a GenLayer dApp for sponsor-funded open-source security rewards. A researcher first seals a report commitment before public disclosure, then reveals the report URL after validators verify a public GitHub advisory and patch. GenLayer validators independently read the bounded public evidence and classify which locked contribution roles the report supports. The finalized verdict opens deterministic native GEN credits for the researcher, and the credit owner can withdraw after finality. The project demonstrates a reusable contract interface for creating pools, committing claims, verifying disclosure sources, adjudicating role support, reading canonical outcomes, and withdrawing credits.

## What validators inspect

Validators inspect the GitHub advisory `GHSA-ph9p-34f9-6g65`, the patch commit `efa4a06f24374797ae32ab2b6ae39b7a611ae429`, and the revealed report URL committed by the claimant. They compare normalized source stage, target match, claimant identity, locked role support, verdict, and consequence class.

## Honest limits

- Browser-wallet walkthrough evidence is not claimed yet.
- No mainnet deployment, real security-program adoption, or non-Studionet value claim is made.
