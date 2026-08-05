# Disclosure Dividend Specification

## Identity

- Idea ID: `IDEA-010`
- Project name: Disclosure Dividend
- Project slug: `disclosure-dividend`
- Category: Projects
- Status: `BUILDING`
- Repository: local child repository; public remote pending
- Target network: `studionet`

## One-sentence product hook

Disclosure Dividend lets a sponsor fund an OSS security reward before disclosure, then uses GenLayer validators to apportion finalized GEN credits across sealed reports that materially contributed to the later advisory and patch.

## Trust problem

- Decision that must not depend on one party: which pre-disclosure reports materially contributed to the published vulnerability, which roles they support, and which reports semantically overlap.
- Why database/ordinary EVM/backend LLM is insufficient: a database or backend LLM can store commitments and produce a payout proposal, but financially opposed sponsors and researchers would still trust one operator to decide materiality and duplication before money moves.
- Value/rights/access at risk: sponsor-funded native-GEN reward, refundable researcher reservation bonds, and withdrawal rights.

## Fingerprint

- Trust problem: neutral reward apportionment across competing sealed vulnerability reports.
- Actors/adversary: sponsors can underpay; researchers can overclaim roles or deny overlap; participants can advance review using public sources.
- Evidence class: onchain commitments, commit-pinned public report reveals, GitHub Advisory Database JSON pinned to a commit, and immutable patch commits.
- Consensus question: which bounded contribution roles each report materially supports and which claims overlap semantically per role.
- State machine: `COMMIT_OPEN -> SOURCE_PENDING -> REVEAL_OPEN -> READY_FOR_REVIEW -> DISTRIBUTED`, with `RETRYABLE` and `CANCELLED`.
- Direct consequence: finalized verdict opens deterministic GEN credits for researchers and sponsor remainder credits.
- Reuse surface: builders can create pools, accept sealed claims, verify disclosure sources, request review, read split views, and withdraw credits.

## Mandatory gate matrix

| Gate | PASS/FAIL | Evidence/reason |
| --- | --- | --- |
| Replacement | `PASS` | Replacing GenLayer leaves the sponsor/backend deciding materiality and overlap before money moves. |
| Judgment | `PASS` | Validators interpret public report/advisory/patch meaning and role overlap; the client never submits eligibility percentages. |
| Evidence | `PASS` | v1 uses bounded GitHub URLs: advisory database raw JSON, security advisory page/API, patch commit, and report URLs with digest/preimage checks. |
| Equivalence | `PASS` | Consensus compares pool/source identity, source coverage, role support, overlap edges, verdict class, and consequence class, not rationale prose. |
| Consequence | `PASS` | Accepted review deterministically opens native-GEN credits and withdrawal rights. |
| Adversarial | `PASS` | Sponsor and researchers have opposed payout incentives; researchers also conflict with each other over priority and duplication. |
| State model | `PASS` | Spec requires per-pool/per-claim storage, locked policy, one claim per wallet per pool, append-only attempts, and double-settlement prevention. |
| Reuse | `PASS` | Public write/view interface can be integrated by OSS funds, registries, or bounty platforms without copying the UI. |
| Contract count | `PASS` | One contract owns reward funding, semantic review, credits, and withdrawals; a consumer contract would be pass-through in v1. |
| Differentiation | `PASS` | Role-overlap graph and proportional cluster payout differ from covenant/quarantine, escrow, market settlement, and procurement-winner patterns. |
| Claim-to-code | `PASS` | Matrix below maps each claim to methods, reads, tests, and pending network evidence. |
| Full lifecycle | `PASS - planned` | Lifecycle is create/fund, two commits, source verification, reveal, review, credits, withdrawal, and canonical reads. Network evidence remains pending until Phase 8. |
| Scope honesty | `PASS` | Local frontend baseline is verified; contract, direct tests, Studionet, browser write, Vercel, CI, and submission evidence are not claimed until produced. |

## Actors, roles and incentives

| Actor | Permissions | Value at risk | Incentive to bias |
| --- | --- | --- | --- |
| Sponsor | Create/fund pool, cancel only before rights attach or in recovery states, withdraw sponsor credit | Funded reward and unused remainder | Reject valid claims or collapse independent claims into overlap clusters |
| Researcher | Commit one sealed claim, reveal own report, withdraw owned credit | Reservation bond and reward credit | Overstate role coverage or deny semantic overlap |
| Participant | Propose/verify disclosure, close windows, request review/retry, settle unrevealed claims | Gas/time and possible reward transparency | Advance or retry a pool using corrected public evidence |
| Observer | Read pools, outcomes, source links, Explorer links | None | Verify public consequence without private/system data |

## Scope and non-goals

### In scope

- One sponsor-funded reward pool per disclosure.
- Up to six claims per pool.
- Four contribution roles: `DISCOVERY`, `ROOT_CAUSE`, `EXPLOIT_PROOF`, `REMEDIATION_VERIFICATION`.
- Commit-reveal flow with refundable reservation bonds.
- Source verification against GitHub advisory and patch evidence.
- Semantic review of revealed public reports.
- Deterministic role-bucket/overlap-cluster reward split.
- Credits and withdrawals in native GEN.
- Vite/React frontend preserving returned design language.

### Out of scope

- Private disclosure adjudication before public reveal.
- Legal ownership, employment, patent, copyright, or CVSS decisions.
- Arbitrary evidence hosts.
- Sponsor-selected winners or backend-computed payouts.
- More than one contract in v1.
- Non-Studionet deployment or production security-program adoption claims.

## Product/frontend blueprint

### Phase 3B frontend audit result

Returned frontend artifacts were static HTML/screenshot screens with a Luminous Protocol dark glass style. They had no package, runtime routes, adapter, typecheck, or build. The Phase 3B baseline converted them into a buildable Vite/React app while preserving the top navigation, glass cards, sidebar/workspace layout, account credit card, and create-policy editor arrangement.

Functional corrections made or required:

- Remove fake aggregate stats, ETH/APY/USD/DDP, gas estimates, governance/security-audit navigation, committee/manual-review copy, and reviewer/system concepts from primary UI.
- Use GEN, reservation bond, canonical states, reveal/withdraw/review actions, and honest integration-pending copy.
- Keep technical source/Explorer links inside a disclosure, not primary content.

### Human users and jobs

| User/role | Primary job | Decision or outcome needed |
| --- | --- | --- |
| Sponsor | Fund a transparent reward policy before seeing claims | Know pool is locked, valid source is verified, and unused reward can be recovered only under legal states |
| Researcher | Prove priority without exposing a report early | Know when to commit, reveal, recover bond, and withdraw credits |
| Participant | Advance a stalled pool | Know whether source verification, review, retry, or close is legal |
| Observer | Verify a finalized split | Understand role/outcome/credit summary without validator internals |

### Information architecture

| Screen/view | User purpose | Primary action | Required states | Mobile behavior |
| --- | --- | --- | --- | --- |
| `/` Pool Explorer | Find pools and open a workspace | Open pool or create pool | Loading, empty, integration pending, populated, error | Single column cards, filter below hero |
| `/pools/:poolId` Pool Workspace | Complete one lifecycle | One state/role legal action | All canonical states plus submitted/accepted/finalized/failed/undetermined transaction states | Timeline stacks above action panel |
| `/account` My Claims & Credits | Recover own work and value | Reveal eligible claim or withdraw credit | Disconnected, no activity, credit available, tx pending/finalized | Claim cards stack; credit card stays reachable |
| `/create` Create Pool Policy | Lock and fund policy | Create and fund pool | Validation, wallet pending, submitted, failed, finalized | Full-width form then summary |

### Visibility matrix

| Function/data group | Visibility | Eligible role/state | User need or reason hidden |
| --- | --- | --- | --- |
| Target package/repository, reward, status, deadlines | `USER_PRIMARY` | Everyone | Defines the pool and next action |
| Role weights and claim capacity | `USER_PRIMARY` | Everyone | Researchers need policy before committing |
| Create/fund pool | `USER_PRIMARY` | Connected sponsor | Starts lifecycle |
| Commit/reveal status for current wallet | `USER_PRIMARY` | Claim owner | Prevents missed windows and duplicate writes |
| Own bond/reward credit | `USER_PRIMARY` | Connected owner | Controls owned value |
| Finalized contributors' public role/outcome/credit summary | `USER_PRIMARY` | Everyone after `DISTRIBUTED` | Explains public consequence |
| Propose/verify disclosure, close, review, retry | `USER_CONTEXTUAL` | Any participant in legal states | Advances lifecycle only when useful |
| Cancel/recover unused reward | `USER_CONTEXTUAL` | Sponsor in legal recovery states | Must not erase live claimant rights |
| Pinned source links and Explorer links | `USER_CONTEXTUAL` | Everyone when available | Optional verification |
| Commitment digest, report hash, salt, raw preimage | `SYSTEM_ONLY` | Adapter/contract only | Integrity data not routine UI; salt must stay local |
| Raw storage, prompts, rationale, validator identities/config, attempt IDs | `SYSTEM_ONLY` | Never primary UI | Reviewer/system data and potential security risk |
| Portal submission fields, test counts, CI, deployment revision metadata | `SYSTEM_ONLY` | Docs/evidence only | Product is not a judging dashboard |

### UI action matrix

| Visible control | Contract capability/method | Eligible role | Legal state | Input/value | Finality | Failure/recovery |
| --- | --- | --- | --- | --- | --- | --- |
| Create and Fund Pool | `create_pool` | Sponsor | No active creation tx | Target, weights, deadlines, cap, bond, native GEN value | Finalized pool and canonical reload | Preserve form; distinguish rejection, wrong network, failed tx |
| Seal My Report | `commit_claim` | Researcher | `COMMIT_OPEN`, no claim for wallet | Commitment digest and reservation bond value | Finalized claim and own-claim reload | Retry only if no canonical claim exists |
| Propose Disclosure | `propose_disclosure` | Participant | `SOURCE_PENDING` or source retry | GHSA ID, advisory commit, patch commit | Candidate recorded, not verified | Edit replacement after rejection |
| Verify Disclosure | `verify_disclosure` | Participant | Source candidate present | No value | Finalized `REVEAL_OPEN` or `RETRYABLE` | Show mismatch vs unavailable; corrected source remains possible |
| Reveal Report | `reveal_claim` | Claim owner | `REVEAL_OPEN` and unrevealed own claim | Report URL and salt | Finalized reveal and refundable bond credit | Invalid preimage/auth is non-penalizing and retryable before deadline |
| Close Reveal Window | `close_reveal_window` | Participant | Reveal deadline passed | None | Finalized `READY_FOR_REVIEW` | Explain unrevealed handling |
| Review Contributions | `adjudicate_pool` | Participant | `READY_FOR_REVIEW` | None | Accepted/decided/finalized then credit reload | `UNVERIFIABLE` becomes `RETRYABLE`; `UNDETERMINED` leaves previous state |
| Retry Pool | `retry_pool` | Participant | `RETRYABLE` | Corrected source when needed | Finalized attempt and canonical reload | Reads current attempt dynamically |
| Cancel and Recover | `cancel_pool` | Sponsor | Pre-claim or expired recovery state | None | Finalized cancellation and sponsor credit | Disabled while claimant rights or legal retry remain |
| Settle Unrevealed Claims | `settle_unrevealed` | Participant | Reveal deadline passed | None | Finalized deterministic bond accounting | Idempotent |
| Withdraw Credit | `withdraw_credit` | Credit owner | Positive canonical credit | Amount or full credit | Finalized transfer and refreshed credit | Debit first; show retry if child transfer fails |

### User-facing state language

| Canonical status/violation | User-facing label | User consequence/next step |
| --- | --- | --- |
| `COMMIT_OPEN` | Reports are being sealed | Commit before deadline |
| `SOURCE_PENDING` | Waiting for a verified disclosure | Propose or verify GHSA and patch |
| `REVEAL_OPEN` | Reports can now be revealed | Claim owners publish pinned reports |
| `READY_FOR_REVIEW` | Ready for independent review | Any participant can request validator review |
| `RETRYABLE` | Evidence could not be verified | Correct source when allowed or retry |
| `DISTRIBUTED` | Reward split finalized | Credit owners can withdraw |
| `CANCELLED` | Pool closed and funds returned | No new claims; owned credits remain withdrawable |
| `MATERIAL` | Material contribution | One or more role buckets awarded |
| `OVERLAPPING` | Shared contribution | Reward is shared with overlapping reports |
| `IRRELEVANT` | Not matched to this disclosure | No reward; valid reveal bond remains refundable |
| `UNVERIFIABLE` | Report could not be verified | No penalty or payout; pool may become retryable |

### Visual preservation constraints

- Visual language/layout to preserve after frontend handoff: dark glassmorphism, fixed top nav, optional workspace sidebar, pool card grid, timeline card, right-side action panel, account credit card, create-policy form + summary.
- Required Ethereal refinements: background `#0B0F14`, 40px+ blur, 0.5px glowing borders, Space Grotesk headings, Geist Mono labels/data, cyan/teal/violet accents.
- Allowed functional edits: route/runtime conversion, accessible labels, one primary action per state, correct state copy, missing-address handling, wallet/adapter integration, responsiveness fixes.
- System/reviewer details excluded from the primary UI: raw storage, prompt, validator config, attempt IDs, hashes/salts except contextual technical detail, gas/fee/balance simulation, test/CI/submission material.

## State model

### Stable IDs

- `pool_id`: lowercase slug supplied by sponsor, 6-64 chars, unique.
- `claim_id`: `pool_id|claimant_address`.
- `source_attempt_id`: `pool_id|source|attempt_number`.
- `review_attempt_id`: `pool_id|review|attempt_number`.
- `credit_key`: lowercase address string.
- `commitment`: researcher-generated hex digest bound to `pool_id`, claimant, report URL digest, salt, and policy version.

### Structured storage

- `Pool`: sponsor, target repository/package, status, reward, reservation bond, role weights, claim limit, deadlines, source candidate/status, totals, attempt counts.
- `Claim`: pool, claimant, commitment, commit time, reveal URL, reveal digest, outcome, roles, overlap list, bond/reward credits, flags.
- `SourceAttempt`: source identity, fetched coverage, target match, stage, retry reason.
- `ReviewAttempt`: normalized per-claim role support, overlap edges, verdict class, consequence class.
- `credits`: address-keyed GEN credit ledger.
- `pool_ids` and account pool indexes for views.

### State machine

```text
COMMIT_OPEN --commit_claim/researcher--> COMMIT_OPEN
COMMIT_OPEN --commit deadline passed/participant--> SOURCE_PENDING
SOURCE_PENDING --propose_disclosure/participant--> SOURCE_PENDING
SOURCE_PENDING --verify_disclosure accepted/participant--> REVEAL_OPEN
SOURCE_PENDING --verify_disclosure unverifiable/participant--> RETRYABLE
REVEAL_OPEN --reveal_claim/claim owner--> REVEAL_OPEN
REVEAL_OPEN --close_reveal_window/participant--> READY_FOR_REVIEW
READY_FOR_REVIEW --adjudicate_pool accepted/participant--> DISTRIBUTED
READY_FOR_REVIEW --adjudicate_pool unverifiable/participant--> RETRYABLE
RETRYABLE --retry_pool/participant--> SOURCE_PENDING or READY_FOR_REVIEW
COMMIT_OPEN --cancel_pool/sponsor before any claim--> CANCELLED
RETRYABLE --cancel_pool/sponsor after recovery deadline--> CANCELLED
```

### Illegal transitions

- Create duplicate pool ID.
- Commit after `COMMIT_OPEN` or beyond claim limit.
- Same wallet commits twice to the same pool.
- Verify source before candidate exists or target identity matches are invalid.
- Reveal before `REVEAL_OPEN`, after deadline, or without matching commitment.
- Review before source verified or before reveal window closes.
- Distribute twice.
- Cancel after live claimant rights attach unless recovery criteria are met.
- Withdraw more than credit or withdraw twice.

### Authorization

- Sponsor-only: recovery cancellation where legal.
- Claim owner-only: reveal own claim.
- Credit owner-only: withdraw own credit.
- Participant-open: propose/verify source, close windows, review, retry, settle unrevealed where legal.

### Idempotency and double-action prevention

- One `pool_id`.
- One claim per `(pool_id, claimant)`.
- One reveal per claim.
- Append-only attempts with current attempt read from state.
- Distribution sets `DISTRIBUTED` and cannot run again.
- Withdraw debits credit before external transfer.
- `settle_unrevealed` marks processed claims.

## Evidence policy

- Authoritative sources: GitHub Advisory Database raw JSON pinned by commit, GitHub security advisory page/API, immutable repository patch commit, commit-pinned public report URLs from `raw.githubusercontent.com` or `github.com/.../blob/<commit>/...`.
- Provenance/authentication: report reveal must match prior commitment; source identity must include advisory ID, advisory database commit, target repo, and patch commit.
- Authorized attestor/signer: v1 does not use offchain signed private reports; consequential actor-controlled report evidence is authenticated by commitment preimage and claimant wallet.
- Anti-replay event/digest identity: commitment includes `pool_id`, claimant address, report URL digest, salt, and policy version `DISCLOSURE_DIVIDEND_V1`.
- Signed timestamp bounds: onchain commit/reveal timestamps bound phase windows; no offchain timestamp can create priority.
- Immutable policy/source version URLs and hashes: advisory database commit SHA, patch commit SHA, report commit URL, policy version.
- Allowed schemes/domains/paths: `https://github.com/`, `https://raw.githubusercontent.com/`, no fragments, no credentials, max 500 chars.
- Time/window rules: commit before commit deadline; reveal after source verified and before reveal deadline; review after reveal close.
- Size/count bounds: max 6 claims, max 4 roles, max 15 overlap edges, max 80k source chars per fetched artifact, max bounded fetch count.
- Missing evidence: source or report maps to `UNVERIFIABLE`/`RETRYABLE`, no penalty beyond no reward.
- Contradictory evidence: source stage `CONTRADICTORY`, pool `RETRYABLE`, no distribution.
- Unavailable source: source stage `UNAVAILABLE`, pool `RETRYABLE`.
- Invalid/unverifiable attestation: reveal mismatch maps to non-penalizing unrevealed/invalid reveal; reservation bond remains governed by reveal-window rules.
- Prompt-injection boundary: source/report text is untrusted data and cannot alter allowed roles, sources, keys, verdict mapping, or payout logic.
- Private/unverifiable evidence excluded: private report content, email, bug-bounty portal data, and unpublished advisory content cannot drive verdict.

## Consensus design

### Leader task

- Inputs: pool target identity, verified source candidate, revealed report URLs, commitment-derived claim identities, role weights.
- Fetch: advisory JSON/page, patch commit, and each revealed report.
- Extraction: target match, vulnerability summary, patch facts, per-report role support, overlap facts.
- Normalization: bounded role booleans, role-specific overlap edges, source stage, verdict class, consequence class.
- Structured output: JSON with `source_stage`, `claim_results`, `overlap_edges`, `verdict`, `consequence_class`.

### Consensus-critical fields

| Field | Type/bounds | Comparison rule | Why critical |
| --- | --- | --- | --- |
| `pool_id` | existing ID | Exact | Prevents cross-pool verdict replay |
| `source_stage` | enum | Exact | Determines whether distribution is legal |
| `target_match` | enum `MATCH/NO_MATCH/UNKNOWN` | Exact | Prevents wrong advisory/patch payouts |
| `claimant` | address string | Exact set | Ties verdict to committed claim owners |
| `roles_supported` | subset of four roles | Exact bounded set per claim | Determines role bucket eligibility |
| `overlap_edges` | role + claimant pair set, max 15 | Exact normalized undirected set | Determines cluster split |
| `claim_outcome` | enum | Exact | Controls no reward vs material credit |
| `verdict` | `DISTRIBUTE/UNVERIFIABLE` | Exact | Controls consequence |
| `consequence_class` | `OPEN_CREDITS/NO_SETTLEMENT` | Exact | Blocks payout on unverifiable evidence |

### Validator

- Independent evidence/replay: validator refetches the same bounded URLs and reruns the same prompt/extraction.
- Semantic rule: compare normalized critical meaning via deterministic fingerprint; rationale prose can differ.
- Rejection conditions: leader error, non-dict output, unknown enum, unknown claimant, too many edges, missing core fields, source mismatch, role outside allowlist.
- `UNDETERMINED` handling: no state change; UI keeps previous canonical state and shows retry path.

### Rationale policy

The contract may store short human-readable reason text for a final attempt, but it is not consensus-critical and never changes payout by itself. Unknown keys and fact IDs are discarded.

## Consequence and accounting

| Verdict | Canonical state change | Consumer action | Value movement |
| --- | --- | --- | --- |
| `DISTRIBUTE` | Pool becomes `DISTRIBUTED`; claim roles/outcomes/overlaps stored | Frontend reloads split and credit views | Role buckets split across overlap clusters; credits opened |
| `UNVERIFIABLE` | Pool becomes `RETRYABLE`; attempt stored | Frontend shows corrected-source/retry path | No new credit; no slash |
| `CANCELLED` | Pool becomes `CANCELLED` | Frontend shows closed state | Sponsor credit opens for unused funds and eligible refundable bonds remain |

- Accepted/finalized boundary: hard consequence is claimed only after transaction finality and canonical view reload.
- Ledger invariant: `total_received = contract_liability + total_withdrawn`; `contract_liability` equals sum of outstanding credits and locked active pool value.
- Child-message/transfer evidence: withdrawal uses debit-before-transfer and requires receipt/balance proof on Studionet.
- Withdrawal/settlement: credit owner can withdraw available credit; integer remainders and unawarded role buckets become sponsor credit.
- Cure/appeal/restore: no appeal in v1; retry handles unverifiable source/review before distribution.

## Reusable interface

### Write methods

- `create_pool(pool_id, target_repository, target_package, role_weights_csv, claim_limit, commit_deadline, reveal_deadline, reservation_bond_wei)` payable
- `commit_claim(pool_id, commitment)` payable
- `propose_disclosure(pool_id, ghsa_id, advisory_database_commit, patch_commit)`
- `verify_disclosure(pool_id)`
- `reveal_claim(pool_id, report_url, salt)`
- `close_commit_window(pool_id)`
- `close_reveal_window(pool_id)`
- `adjudicate_pool(pool_id)`
- `retry_pool(pool_id)`
- `cancel_pool(pool_id)`
- `settle_unrevealed(pool_id)`
- `withdraw_credit(amount)`

### View methods

- `get_pool_ids()`
- `get_pool(pool_id)`
- `get_pool_claims(pool_id)`
- `get_claim(pool_id, account)`
- `get_account_pool_ids(account)`
- `get_credit(account)`
- `get_attempt(pool_id, attempt_number)`
- `get_contract_summary()`

### Consumer/callback

- Authentication: no consumer callback in v1.
- Idempotency key: not applicable; views/adapters are the integration boundary.
- Failure/retry: frontend reads canonical state; deployment script reads current attempt.
- Authorized cancellation: sponsor-only and state-gated.

## Threat model

| Threat | Attack | Mitigation | Test |
| --- | --- | --- | --- |
| Sponsor underpayment | Cancels after claims or distributes twice | Legal-state cancellation and one distribution | `test_cancel_blocks_live_claim_rights`, `test_distribution_is_idempotent` |
| Researcher duplicate overclaim | Same wallet commits twice or claims every role | One claim per wallet; validator role support bounded | `test_one_claim_per_wallet`, `test_unknown_roles_rejected` |
| Commitment reveal forgery | Reveal URL/salt does not match commitment | Deterministic preimage check | `test_invalid_reveal_is_retryable_without_penalty` |
| Wrong source | Advisory/patch for different repo/package | Source target identity verification | `test_source_target_mismatch_goes_retryable` |
| Prompt injection | Report asks model to change payout rules | Prompt declares source text untrusted; enum/output allowlist | `test_prompt_injection_cannot_expand_roles` |
| Malicious leader | Valid JSON shape but wrong overlap/roles | Validator reruns and fingerprints meaning | `test_semantic_mismatch_disagrees` |
| Double withdrawal | Credit owner calls twice | Debit before transfer and credit bounds | `test_withdraw_debits_before_transfer` |
| Unavailable web | GitHub 404/timeout | `RETRYABLE`, no settlement | `test_unavailable_source_no_payout` |
| Local fake state | UI shows fixture as live | Missing-address notice and adapter boundary | `App.test.tsx` missing-address test |

## Test plan

- Happy path: create/fund pool, two commits, close commit, verify source, reveal two claims, close reveal, adjudicate, open credits, withdraw.
- Unauthorized: sponsor-only cancel and owner-only reveal/withdraw.
- Isolation: two pools with independent claims and credits.
- Evidence failure: missing, malformed, target mismatch, unavailable source.
- Malicious leader: wrong claimant, unknown role, excessive overlap edges.
- Prompt injection: source text tries to change roles/payout.
- Semantic mismatch: JSON shape valid but critical fields differ.
- Verdict classes: distribute and unverifiable/retryable.
- Duplicate: duplicate pool, claim, reveal, distribution, withdrawal.
- Accounting/value: payable metadata, reward locks, bond credits, sponsor remainder, debit-before-transfer.
- Cure/restore: not applicable in v1; retry path covered.
- Consumer enforcement: no consumer contract; frontend adapter/read proof and documented views covered.
- Undetermined/retry: no state change on `UNDETERMINED`, retry reads current attempt.

## Claim-to-code matrix

| Product claim | Contract method/state | View/read | Direct test | Network evidence |
| --- | --- | --- | --- | --- |
| Sponsor funds a locked reward pool | `create_pool`, `Pool.status=COMMIT_OPEN`, reward ledger | `get_pool`, `get_contract_summary` | `test_create_pool_locks_policy_and_value` | `PENDING_REAL_EVIDENCE: create pool tx + view` |
| Researcher seals a pre-disclosure claim | `commit_claim`, `Claim.commitment` | `get_claim`, `get_pool_claims` | `test_commit_claim_requires_bond_and_prevents_duplicates` | `PENDING_REAL_EVIDENCE: commit tx + claim view` |
| Disclosure source is verified by validators | `propose_disclosure`, `verify_disclosure` | `get_pool`, `get_attempt` | `test_verify_disclosure_accepts_matching_github_source` | `PENDING_REAL_EVIDENCE: source verification tx + attempt view` |
| Invalid source does not pay anyone | `verify_disclosure` sets `RETRYABLE` | `get_pool`, `get_credit` | `test_source_target_mismatch_goes_retryable_without_credit` | `PENDING_REAL_EVIDENCE: retryable source attempt` |
| Claim owner reveals only matching preimage | `reveal_claim` | `get_claim` | `test_reveal_requires_commitment_preimage` | `PENDING_REAL_EVIDENCE: reveal tx + claim view` |
| Validators classify roles and overlap | `adjudicate_pool`, `ReviewAttempt` | `get_attempt`, `get_pool_claims` | `test_review_stores_roles_and_overlap_edges` | `PENDING_REAL_EVIDENCE: review tx + attempt view` |
| Finalized split opens deterministic GEN credits | `adjudicate_pool`, credit ledger | `get_credit`, `get_claim` | `test_distribution_opens_researcher_and_sponsor_credits` | `PENDING_REAL_EVIDENCE: distributed tx + credit views` |
| Credits can be withdrawn once | `withdraw_credit` | `get_credit`, balance evidence | `test_withdraw_credit_debits_and_blocks_double_withdraw` | `PENDING_REAL_EVIDENCE: withdraw tx + balance delta` |
| UI does not show system/reviewer controls | Frontend route/action gating | Rendered app tests | `frontend/src/App.test.tsx` | `PENDING_REAL_EVIDENCE: live app verification after deploy` |
| Missing deployment is honestly labeled | Frontend missing-address path | UI notice | `frontend/src/App.test.tsx` | `PENDING_REAL_EVIDENCE: pre-deploy build screenshot/body` |

## Analogue and differentiation matrix

| Analogue/prior idea | Similar dimensions | Structural difference | Collision decision |
| --- | --- | --- | --- |
| TenderSeal Tournament | Sponsor-funded, commit/reveal, public evidence | TenderSeal chooses one procurement winner; Disclosure Dividend pays multi-role contribution clusters | Not duplicate |
| Semantic Interface Covenant | Public software evidence and semantic validator | Covenant quarantines/restores integration; Disclosure Dividend apportions research reward | Not duplicate |
| LabelScope Market | Public authoritative source and value consequence | Market resolves YES/NO stakes; Disclosure Dividend creates role-overlap graph and credits several contributors | Not duplicate |
| EscrowWithSubjectiveRelease legacy | Subjective value release | No bilateral deliverable acceptance/refund; multi-claim role overlap and sponsor remainder | Not duplicate |
| GitHub advisory credits | Security contribution credit domain | GitHub credits are evidence only; validator decides material pre-disclosure reports and payout | Not duplicate |

## Deployment and evidence plan

- Network: GenLayer Studionet only.
- Actors/wallet separation: sponsor primary wallet from ignored `.env`; at least two researcher EOAs for adversarial lifecycle, created/funded only with authorized local secret handling.
- Deploy steps: inspect config, deploy contract, verify schema/result success, write active deployment identity.
- Consequential lifecycle: create/fund pool, two commitments, close commit, propose/verify GHSA + patch, reveal two reports, close reveal, adjudicate, read credits, withdraw one credit.
- Canonical reads: pool, claims, attempt, credit, contract summary after each finalized step.
- Balance/receipt proof: safe allowlisted tx hashes, statuses, finality, public addresses, and before/after balances for withdrawal.
- Evidence path: `docs/evidence/studionet/`.
- Resume/idempotency: one active `deployment.json`; superseded revisions archived with reason and zero-accounting proof.

## Definition of Done

### Intelligent Contracts

- [ ] Reusable primitive.
- [ ] Semantic validator judgment.
- [ ] Direct consequence.
- [ ] Reuse proof through documented views/adapter.
- [ ] Adversarial tests.
- [ ] Real network lifecycle.
- [ ] Canonical evidence.

### Projects

- [ ] Real frontend wallet write.
- [ ] Full lifecycle/failure/retry.
- [ ] Canonical reads.
- [ ] Meaningful user outcome.
- [ ] Browser evidence.
- [ ] Primary UI contains only user-relevant data/actions; system/reviewer details are contextual or hidden.

## Honest limitations

- Frontend Phase 3B baseline is local only and uses clearly labeled design data when no contract address is configured.
- Contract source, direct tests, `npm run check`, Studionet deployment, browser-wallet writes, public GitHub, Vercel, CI, and Portal submission remain pending until their phases produce evidence.
- No legal/security-program adoption or non-Studionet deployment is claimed.

## Kill criteria

- The client/backend computes contribution eligibility or percentages before calling GenLayer.
- Validators compare JSON shape instead of normalized contribution meaning.
- Report/source evidence cannot be bounded to public immutable GitHub artifacts.
- State becomes global/overwriteable or distribution can run twice.
- Frontend simulates signatures, gas, balances, finality, or canonical state.
- A second contract is added without independent state ownership or enforcement.
