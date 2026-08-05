# Disclosure Dividend — Stage 1 Product Brief

## Identity

- Idea ID: `IDEA-010`
- Project name: Disclosure Dividend
- Project slug: `disclosure-dividend`
- Category: Projects
- Status: `SELECTED — STAGE 1 FRONTEND HANDOFF`
- Repository: local child repository; public remote intentionally pending
- Target network: `studionet`

## One-sentence product hook

Seal a vulnerability report before disclosure, then let independent validators
divide the funded reward among the researchers whose evidence materially found,
explained, proved, or verified the fix.

## Product trust hook

The sponsor and competing researchers must not rely on the sponsor, a bug-bounty
operator, or one LLM to decide whether differently worded reports are independent
contributions or copies of the same work. GenLayer validators will compare
commit-bound public reports against an immutable GitHub advisory and patch. The
accepted semantic result will directly open native-GEN withdrawal credits.

## Scope and non-goals

### In scope for the product

- One sponsor-funded reward pool for one repository/package and one later
  published GitHub Security Advisory.
- At most six researchers, each represented by one wallet and one sealed claim.
- Pre-disclosure onchain commitments followed by commit-pinned public report
  reveals.
- Four bounded contribution roles: discovery, root-cause analysis, exploit
  proof, and remediation verification.
- Role-specific overlap detection and a deterministic weighted reward split.
- Honest submitted, accepted/decided, finalized, failed, retry, cancellation,
  credit, and withdrawal experiences.
- Canonical contract reads after every finalized write.

### Out of scope for v1

- Private vulnerability content during validator adjudication; reports become
  public only after the disclosure source is published and the reveal phase opens.
- Legal ownership, employment, copyright, or patent determinations.
- CVSS calculation, exploitability scoring, package-version scanning, or a
  general vulnerability oracle.
- Sponsor-selected winners, manual admin verdict overrides, direct LLM-generated
  percentages, and arbitrary evidence hosts.
- More than one contract; the primitive itself owns the reward and credit ledger.
- Production security-program adoption or non-Studionet deployment claims.

## Provisional contract-capability sketch

This sketch constrains the frontend only. Storage, exact signatures, consensus
implementation, and final interface remain Stage 2 work after the returned
frontend is audited.

### Human roles

| Role | User-visible actions | Value/finality expectation |
| --- | --- | --- |
| Sponsor | Create and fund a pool; inspect commitments; recover unused reward; cancel only when recovery rules permit | Funding and recovery are real native-GEN writes and are not complete until finalized and re-read |
| Researcher | Commit a sealed report; reveal the commit-pinned report; inspect contribution outcome; withdraw bond/reward credit | Commitment may carry a refundable reservation bond; reveal does not promise an award |
| Participant | Propose a disclosure source; request source verification; request or retry independent review | A submitted hash is not a verified source or finalized reward split |
| Observer | Explore pools, policies, public evidence summaries, finalized splits, and Explorer links | Read-only; no system or validator controls |

### Provisional capabilities and minimum view data

| Capability | Minimum canonical data the UI needs |
| --- | --- |
| Enumerate pools | Pool count, pool ID, target package/repository, funded reward, current status, current deadlines |
| Read pool | Sponsor, locked role weights, claim limit/count, source identity/status, reward/credit totals, legal next actions |
| Create and fund | Target identity, four weights totaling 100, claim limit up to six, deadlines, reservation bond, native-GEN value |
| Commit claim | Claimant address, pool ID, commitment digest, nonce, commit timestamp, reservation-bond status |
| Verify disclosure | GHSA ID, advisory commit identity, patch commit SHA, target-match result, retryability |
| Reveal claim | Claim ID, pinned report URL, reveal status/time, bond-credit status; salt/digest remain contextual technical details |
| Review pool | Source coverage, per-claim user-facing outcome, awarded roles, overlap summary, finalized reward consequence |
| Read account | Connected role, own claims, refundable bond credit, reward credit, withdrawal availability |
| Withdraw credit | Amount, submitted/finalized transaction state, refreshed remaining credit |

### Meaningful product states

```text
COMMIT_OPEN
  -> SOURCE_PENDING
  -> REVEAL_OPEN
  -> READY_FOR_REVIEW
  -> DISTRIBUTED

SOURCE_PENDING | READY_FOR_REVIEW
  -> RETRYABLE
  -> SOURCE_PENDING | READY_FOR_REVIEW

COMMIT_OPEN -> CANCELLED
RETRYABLE -> CANCELLED
```

`UNDETERMINED` is a transaction outcome, not a fake canonical pool state. It
leaves the previous state in place and presents a retry path.

### Provisional adapter boundary

The frontend must consume a typed adapter rather than importing fixture data in
screens. Stage 2 will replace the adapter implementation without changing the
components or user journeys.

```ts
export type PoolStatus =
  | "COMMIT_OPEN"
  | "SOURCE_PENDING"
  | "REVEAL_OPEN"
  | "READY_FOR_REVIEW"
  | "RETRYABLE"
  | "DISTRIBUTED"
  | "CANCELLED";

export type ContributionRole =
  | "DISCOVERY"
  | "ROOT_CAUSE"
  | "EXPLOIT_PROOF"
  | "REMEDIATION_VERIFICATION";

export type ClaimOutcome =
  | "COMMITTED"
  | "REVEALED"
  | "MATERIAL"
  | "OVERLAPPING"
  | "IRRELEVANT"
  | "UNVERIFIABLE";

export interface PoolView {
  poolId: string;
  sponsor: string;
  targetRepository: string;
  targetPackage: string;
  status: PoolStatus;
  rewardWei: bigint;
  reservationBondWei: bigint;
  roleWeights: Record<ContributionRole, number>;
  claimLimit: number;
  claimCount: number;
  commitDeadline: number;
  revealDeadline: number;
  sourceStatus: "NONE" | "CANDIDATE" | "VERIFIED" | "UNVERIFIABLE";
}

export interface ClaimView {
  poolId: string;
  claimant: string;
  outcome: ClaimOutcome;
  awardedRoles: ContributionRole[];
  overlappingClaimants: string[];
  refundableBondWei: bigint;
  rewardCreditWei: bigint;
  canReveal: boolean;
}

export interface CreditView {
  refundableBondWei: bigint;
  rewardWei: bigint;
  totalWei: bigint;
}

export interface CreatePoolInput {
  targetRepository: string;
  targetPackage: string;
  roleWeights: Record<ContributionRole, number>;
  claimLimit: number;
  commitDeadline: number;
  revealDeadline: number;
  reservationBondWei: bigint;
  rewardWei: bigint;
}

export interface CommitClaimInput {
  poolId: string;
  commitment: string;
  nonce: string;
  reservationBondWei: bigint;
}

export interface DisclosureInput {
  poolId: string;
  ghsaId: string;
  advisoryDatabaseCommit: string;
  patchCommit: string;
}

export interface RevealClaimInput {
  poolId: string;
  reportUrl: string;
  salt: string;
}

export interface TransactionProgress {
  transactionHash?: string;
  stage:
    | "AWAITING_WALLET"
    | "SUBMITTED"
    | "ACCEPTED"
    | "DECIDED"
    | "FINALIZED"
    | "REJECTED"
    | "FAILED"
    | "UNDETERMINED";
  errorMessage?: string;
}

export interface DisclosureDividendAdapter {
  getPoolCount(): Promise<number>;
  getPool(poolId: string): Promise<PoolView>;
  getPoolClaims(poolId: string): Promise<ClaimView[]>;
  getClaim(poolId: string, claimant: string): Promise<ClaimView | null>;
  getCredit(account: string): Promise<CreditView>;
  createPool(input: CreatePoolInput): Promise<TransactionProgress>;
  commitClaim(input: CommitClaimInput): Promise<TransactionProgress>;
  proposeDisclosure(input: DisclosureInput): Promise<TransactionProgress>;
  verifyDisclosure(poolId: string): Promise<TransactionProgress>;
  revealClaim(input: RevealClaimInput): Promise<TransactionProgress>;
  closeRevealWindow(poolId: string): Promise<TransactionProgress>;
  adjudicatePool(poolId: string): Promise<TransactionProgress>;
  retryPool(poolId: string): Promise<TransactionProgress>;
  cancelPool(poolId: string): Promise<TransactionProgress>;
  settleUnrevealed(poolId: string): Promise<TransactionProgress>;
  withdrawCredit(): Promise<TransactionProgress>;
}
```

## Product/frontend blueprint

### Human users and jobs

| User/role | Primary job | Decision or outcome needed |
| --- | --- | --- |
| Sponsor | Fund a transparent reward policy before seeing competing claims | Know that the pool is locked, the source is valid, and unused reward can be recovered |
| Researcher | Prove priority without exposing the report before disclosure | Know exactly when to commit, reveal, retry, and withdraw |
| Participant | Advance a stalled pool using public evidence | Know whether source verification or review is currently legal |
| Observer | Verify how a published reward was divided | Understand the contribution summary and money consequence without reading contract internals |

### Information architecture

| Screen/view | User purpose | Primary action | Required states | Mobile behavior |
| --- | --- | --- | --- | --- |
| Pool Explorer `/` | Find active and finalized pools; understand the product immediately | Open a pool; sponsor can open Create Pool | Loading, empty, error, wallet disconnected, populated | Single-column cards with reward/status/deadline prioritized |
| Pool Workspace `/pools/:poolId` | Complete and verify one lifecycle from funding through withdrawal | State- and role-dependent action in a persistent action panel | Every canonical pool state plus submitted, accepted/decided, finalized, failed, undetermined | Timeline becomes vertical; action panel remains below the current-state summary, never overlays evidence |
| My Claims & Credits `/account` | Recover pending work and withdraw owned value | Reveal an eligible claim or withdraw available credit | Disconnected, wrong network, no activity, deadline warning, credit available, withdrawal pending/finalized | Claims become compact stacked rows; credit action stays reachable without horizontal scrolling |
| Create Pool dialog/route | Lock a comprehensible reward policy and fund it | Review and sign pool creation | Validation, fee/value review, awaiting wallet, submitted, failed, finalized | Full-screen step flow on narrow viewports with a persistent review summary |

### Pool Workspace composition

1. Target and reward summary: package/repository, reward, status, nearest deadline.
2. Lifecycle timeline: sealed reports, disclosure verification, reveals, review,
   finalized split, withdrawals.
3. Current action panel: one primary action, eligibility explanation, required
   value, finality feedback, and recovery path.
4. Contribution summary: hidden before reveal; after finalization shows roles,
   overlap in plain language, and credits rather than raw validator output.
5. Technical details disclosure: pinned source links, Explorer links, and
   optional transaction identifiers.

### Visibility matrix

| Function/data group | Visibility | Eligible role/state | User need or reason hidden |
| --- | --- | --- | --- |
| Target package/repository, reward, status, deadlines | `USER_PRIMARY` | Everyone | Defines the pool and next decision |
| Role weights and claim capacity | `USER_PRIMARY` | Everyone | Researchers must understand reward policy before committing |
| Create/fund pool | `USER_PRIMARY` | Sponsor / no active creation transaction | Starts the product lifecycle |
| Commit status and reveal eligibility for current wallet | `USER_PRIMARY` | Researcher / commit or reveal phase | Prevents missed deadlines and duplicate actions |
| Propose/verify disclosure | `USER_CONTEXTUAL` | Any connected participant / source pending or retryable | Only useful after commitments close and before reveal |
| Request review/retry | `USER_CONTEXTUAL` | Any connected participant / ready or retryable | Advances a pool without creating an admin role |
| Cancel/recover unused reward | `USER_CONTEXTUAL` | Sponsor / legal recovery state | Must appear only when cancellation cannot erase live rights |
| Own refundable bond and reward credit | `USER_PRIMARY` | Connected owner | Directly controls owned value |
| Other contributors' finalized role/outcome/credit | `USER_PRIMARY` | Everyone / distributed | Explains the public consequence |
| Pinned evidence and Explorer links | `USER_CONTEXTUAL` | Everyone / source available | Supports optional verification without dominating the workflow |
| Commitment digest, salt, nonce, raw report hash | `SYSTEM_ONLY` | Adapter/contract workflow | Needed for integrity, not routine product decisions |
| Raw storage, prompt, rationale, validator identities/config | `SYSTEM_ONLY` | Never in primary UI | Internal/reviewer data; may create security and comprehension risk |
| Attempt IDs, receipt parser fields, deployment revision metadata | `SYSTEM_ONLY` | Deployment/evidence tooling only | Not a product action or user state |
| Portal submission fields, test counts, CI evidence | `SYSTEM_ONLY` | Project documentation only | Must not turn the product into a submission dashboard |

### UI action matrix

| Visible control | Provisional capability | Eligible role | Legal state | Input/value | Expected finality | Failure/recovery |
| --- | --- | --- | --- | --- | --- | --- |
| Create and fund pool | `createPool` | Sponsor | Outside an existing pool | Target, weights, deadlines, claim cap, bond, native GEN | Finalized pool then canonical reload | Preserve form; distinguish wallet rejection, failed tx, and wrong network |
| Seal my report | `commitClaim` | Researcher | `COMMIT_OPEN`; no claim for wallet | Locally computed commitment and reservation bond | Finalized commitment then own-claim reload | Do not expose salt; allow retry only if no canonical commitment exists |
| Propose disclosure | `proposeDisclosure` | Any participant | `SOURCE_PENDING` or source retry | GHSA identity, advisory commit, patch SHA | Candidate recorded; not yet called verified | Keep input editable after rejection; never call proposal success verification |
| Verify disclosure | `verifyDisclosure` | Any participant | Source candidate present | No extra value | Accepted/decided/finalized then pool reload | Show mismatch vs unavailable; valid replacement remains possible |
| Reveal my report | `revealClaim` | Claim owner | `REVEAL_OPEN`; own committed claim | Pinned report URL and locally held salt | Finalized reveal and refundable-bond credit reload | Invalid preimage/auth is non-penalizing and retryable before deadline |
| Close reveal window | `closeRevealWindow` | Any participant | Reveal deadline passed | None | Finalized `READY_FOR_REVIEW` | Explain unrevealed handling; do not silently forfeit before canonical read |
| Review contributions | `adjudicatePool` | Any participant | `READY_FOR_REVIEW` | None | Accepted/decided/finalized, then split and credits reload | `UNVERIFIABLE` becomes retryable; `UNDETERMINED` leaves prior state |
| Retry evidence/review | `retryPool` | Any participant | `RETRYABLE` and retry legal | Corrected source only when source failed | Finalized attempt followed by canonical reload | Read current attempt dynamically; never hardcode first attempt |
| Cancel and recover | `cancelPool` | Sponsor | Pre-commit or expired recovery path | None | Finalized cancellation and sponsor credit | Block while claimant rights or a legal retry remain active |
| Settle unrevealed claims | `settleUnrevealed` | Any participant | Reveal deadline passed | None | Finalized deterministic bond accounting | Idempotent; no semantic penalty for invalid/unverifiable evidence |
| Withdraw credit | `withdrawCredit` | Credit owner | Positive canonical credit | None | Finalized child transfer plus refreshed credit/balance | Debit first; preserve retry guidance if child transfer fails |

### User-facing state language

| Canonical status/outcome | User-facing label | User consequence/next step |
| --- | --- | --- |
| `COMMIT_OPEN` | Reports are being sealed | Commit before the displayed deadline |
| `SOURCE_PENDING` | Waiting for a verified disclosure | Propose or verify the official GHSA and patch |
| `REVEAL_OPEN` | Reports can now be revealed | Claim owners publish their pinned reports |
| `READY_FOR_REVIEW` | Ready for independent review | Any participant can request validator review |
| `RETRYABLE` | Evidence could not be verified | Correct the source when allowed or retry after a transient failure |
| `DISTRIBUTED` | Reward split finalized | Credit owners can withdraw; everyone can inspect the split |
| `CANCELLED` | Pool closed and funds returned | No new action; owned credits remain withdrawable |
| `MATERIAL` | Material contribution | One or more role buckets awarded |
| `OVERLAPPING` | Shared contribution | Reward is shared with semantically overlapping work |
| `IRRELEVANT` | Not matched to this disclosure | No reward; reservation bond from a valid reveal remains refundable |
| `UNVERIFIABLE` | Report could not be verified | No penalty or payout; follow the pool retry state |

### Wallet, network, and transaction behavior

- Discover injected providers, prefer EIP-6963, and allow provider selection.
- Connect only by the selected browser-wallet address; never accept a private
  key in frontend code or a `VITE_` variable.
- Request Studionet switch/add on connect using the chain definition supplied by
  `genlayer-js`, not a hardcoded UI constant.
- Restore an already authorized connection without repeatedly prompting.
- Keep the contract address configurable and fail honestly when absent.
- Track `AWAITING_WALLET -> SUBMITTED -> ACCEPTED/DECIDED -> FINALIZED`, plus
  rejected, failed, undetermined, and retry states.
- Report success only after a canonical state reload confirms the consequence.
- Local storage may remember theme or dismissed help, never pools, claims,
  credits, balances, transaction finality, or role authorization.

### Empty, loading, error, and success treatment

- Empty explorer: explain that no canonical pool is available and offer Create
  Pool only to a connected user.
- Loading: preserve layout with skeletons and never substitute fixture values.
- Missing contract address: show an explicit integration-pending state; do not
  render fixture data as live.
- Wrong network or unfunded wallet: explain the blocker before enabling a write.
- Transaction rejected/failed: preserve inputs and show a specific recovery
  action.
- Submitted/accepted: keep the action disabled while showing that finality is
  still pending.
- Finalized: reload views, then show the semantic outcome and value consequence.
- Undetermined/unverifiable: retain the last canonical state and show who can
  retry and when.

### Visual direction and preservation constraints

- Audience: open-source security researchers and program sponsors; the product
  should feel precise, calm, and evidence-led rather than like a trading terminal.
- Direction: dark-neutral or ink-on-paper foundation, restrained security-signal
  accents, strong typography, compact evidence cards, and a clear lifecycle
  timeline. Avoid neon cyberpunk clichés, glowing dashboards, and excessive
  gradients.
- Use one dominant action per state, readable deadline/value hierarchy, keyboard
  focus, semantic headings, WCAG-aware contrast, and reduced-motion support.
- Contribution roles may use icons plus text; never rely on color alone.
- Stage 2 must preserve the returned visual language, typography, component
  style, navigation, and overall arrangement. Allowed changes are limited to
  contract wiring, role/state visibility, missing lifecycle messages, and clear
  accessibility/responsiveness defects.
- Raw storage, hashes, salts, prompts, validator internals, attempt IDs, receipt
  shapes, deployment evidence, test counts, and Portal submission material stay
  out of the primary experience.

### Development fixture boundary for the frontend builder

- Fixtures may exist only in a clearly named development module implementing the
  adapter interface.
- Every fixture screen must be visibly marked as design data while no contract
  address is configured.
- Components must never import fixture objects directly.
- Fixture writes may simulate UI transitions only inside development mode and
  must never claim wallet signature, transaction acceptance, finality, fee,
  balance, or onchain state.

## Stage 1 evidence and honest limits

Verified during selection:

- The commit-pinned GitHub Advisory Database JSON for
  `GHSA-ph9p-34f9-6g65` returned HTTP 200 with bounded content.
- The immutable `node-tmp` remediation commit returned HTTP 200 with bounded
  patch content.
- The official advisory exposes distinct reporter and remediation-verifier
  contributions, supporting a real multi-contributor reward scenario.
- A structured prompt dry-run on bounded advisory/report/patch excerpts kept the
  critical role distinction stable under paraphrase. This is design feasibility,
  not GenVM or Studionet consensus evidence.

Not yet created or proven:

- frontend implementation;
- contract source or finalized method signatures;
- local tests, lint, build, or CI;
- Studionet source rendering, schema, deployment, validator consensus, value
  transfer, or browser-wallet lifecycle;
- public GitHub repository, Vercel deployment, adoption, or Portal submission.
