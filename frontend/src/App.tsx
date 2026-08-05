import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowRight,
  Clock3,
  ExternalLink,
  FileKey2,
  Fingerprint,
  GitBranch,
  LayoutDashboard,
  Link2,
  ShieldCheck,
  Wallet,
} from "lucide-react";
import {
  configuredContractAddress,
  connectWallet,
  createPool,
  disconnectWalletSession,
  discoverWallets,
  fetchAccount,
  fetchPools,
  getWalletBalance,
  revealClaim,
  restoreWalletSession,
  sealClaim,
  withdrawCredit,
  type AccountView,
  type PoolStatus,
  type PoolView,
  type WalletOption,
} from "./genlayerClient";

type Route =
  | { name: "explorer" }
  | { name: "pool"; poolId: string }
  | { name: "account" }
  | { name: "create" };

type UiPool = {
  id: string;
  repository: string;
  packageName: string;
  issue: string;
  status: PoolStatus;
  reward: string;
  rewardWei: string;
  reservationBondWei: string;
  deadline: string;
  claims: number;
};

const designPools: UiPool[] = [
  {
    id: "node-tmp",
    repository: "raszi/node-tmp",
    packageName: "npm:tmp",
    issue: "Path traversal vulnerability",
    status: "COMMIT_OPEN",
    reward: "50,000 GEN",
    rewardWei: "1000",
    reservationBondWei: "25",
    deadline: "Commit window ends in 14h 22m",
    claims: 2,
  },
  {
    id: "express-rate-limit",
    repository: "express-rate-limit/express-rate-limit",
    packageName: "npm:express-rate-limit",
    issue: "Bypass via X-Forwarded-For",
    status: "SOURCE_PENDING",
    reward: "25,000 GEN",
    rewardWei: "25000",
    reservationBondWei: "25",
    deadline: "Disclosure source pending",
    claims: 4,
  },
  {
    id: "core-js",
    repository: "zloirock/core-js",
    packageName: "npm:core-js",
    issue: "Prototype pollution",
    status: "DISTRIBUTED",
    reward: "120,000 GEN",
    rewardWei: "120000",
    reservationBondWei: "25",
    deadline: "Reward split finalized",
    claims: 6,
  },
  {
    id: "nginx-ingress",
    repository: "kubernetes/ingress-nginx",
    packageName: "container:ingress-nginx",
    issue: "Config injection",
    status: "COMMIT_OPEN",
    reward: "200,000 GEN",
    rewardWei: "200000",
    reservationBondWei: "25",
    deadline: "Commit window ends in 2d 5h",
    claims: 1,
  },
];

const statusLabels: Record<PoolStatus, string> = {
  COMMIT_OPEN: "Reports are being sealed",
  SOURCE_PENDING: "Waiting for a verified disclosure",
  REVEAL_OPEN: "Reports can now be revealed",
  READY_FOR_REVIEW: "Ready for independent review",
  RETRYABLE: "Evidence could not be verified",
  DISTRIBUTED: "Reward split finalized",
  CANCELLED: "Pool closed and funds returned",
};

const genWeiFactor = 10n ** 18n;

function formatWeiAsGen(value: string | bigint | undefined) {
  try {
    const wei = typeof value === "bigint" ? value : BigInt(value || "0");
    const whole = wei / genWeiFactor;
    const fraction = wei % genWeiFactor;
    if (fraction === 0n) return `${whole.toString()} GEN`;
    const fractionText = fraction.toString().padStart(18, "0").replace(/0+$/, "");
    return `${whole.toString()}.${fractionText} GEN`;
  } catch {
    return "0 GEN";
  }
}

function parseGenInputToWei(value: string): bigint | null {
  const trimmed = value.trim();
  const match = /^(\d+)(?:\.(\d{1,18}))?$/.exec(trimmed);
  if (!match) return null;
  try {
    const whole = BigInt(match[1]);
    const fraction = BigInt((match[2] ?? "").padEnd(18, "0") || "0");
    return whole * genWeiFactor + fraction;
  } catch {
    return null;
  }
}

function poolFromContract(pool: PoolView): UiPool {
  return {
    id: pool.pool_id,
    repository: pool.target_repository.replace(/^https:\/\/github\.com\//, ""),
    packageName: pool.target_package,
    issue: pool.ghsa_id ? `${pool.ghsa_id} disclosure` : "Disclosure source pending",
    status: pool.status,
    reward: formatWeiAsGen(pool.reward_wei),
    rewardWei: pool.reward_wei,
    reservationBondWei: pool.reservation_bond_wei,
    deadline: pool.status === "COMMIT_OPEN" ? `Commit closes ${pool.commit_deadline}` : statusLabels[pool.status],
    claims: Number(pool.claim_count),
  };
}

function parseRoute(): Route {
  const hash = window.location.hash.replace(/^#/, "") || "/";
  if (hash === "/account") return { name: "account" };
  if (hash === "/create") return { name: "create" };
  if (hash.startsWith("/pools/")) return { name: "pool", poolId: hash.slice("/pools/".length) };
  return { name: "explorer" };
}

function useRoute(): Route {
  const [route, setRoute] = useState<Route>(() => parseRoute());
  useEffect(() => {
    const onHashChange = () => setRoute(parseRoute());
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);
  return route;
}

function useWallet() {
  const [account, setAccount] = useState("");
  const [walletName, setWalletName] = useState("");
  const [wallets, setWallets] = useState<WalletOption[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [balanceWei, setBalanceWei] = useState("");
  const [balanceBusy, setBalanceBusy] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const openPicker = useCallback(async () => {
    setBusy(true);
    setError("");
    try {
      const detected = await discoverWallets({ eip6963DelayMs: 120 });
      setWallets(detected);
      if (detected.length === 0) {
        setError("No browser wallet was detected");
        setPickerOpen(false);
        return;
      }
      setAccountMenuOpen(false);
      setPickerOpen(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not scan browser wallets");
    } finally {
      setBusy(false);
    }
  }, []);

  const connect = useCallback(async (walletId: string) => {
    setBusy(true);
    setError("");
    try {
      const selectedWallet = wallets.find((wallet) => wallet.id === walletId);
      const session = await connectWallet(selectedWallet ?? walletId);
      setAccount(session.account);
      setWalletName(session.walletName);
      setPickerOpen(false);
      setAccountMenuOpen(false);
      setBalanceWei("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Wallet connection failed");
    } finally {
      setBusy(false);
    }
  }, [wallets]);

  const toggleAccountMenu = useCallback(async () => {
    if (!account) return;
    const opening = !accountMenuOpen;
    setPickerOpen(false);
    setAccountMenuOpen(opening);
    if (!opening) return;
    setBalanceBusy(true);
    setError("");
    try {
      setBalanceWei(await getWalletBalance(account));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not read wallet balance");
      setBalanceWei("");
    } finally {
      setBalanceBusy(false);
    }
  }, [account, accountMenuOpen]);

  const logout = useCallback(() => {
    disconnectWalletSession();
    setAccount("");
    setWalletName("");
    setAccountMenuOpen(false);
    setPickerOpen(false);
    setBalanceWei("");
    setError("");
  }, []);

  const closeMenus = useCallback(() => {
    setPickerOpen(false);
    setAccountMenuOpen(false);
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function restore() {
      try {
        const [detected, session] = await Promise.all([discoverWallets(), restoreWalletSession()]);
        if (cancelled) return;
        setWallets(detected);
        if (session) {
          setAccount(session.account);
          setWalletName(session.walletName);
        }
      } catch {
        if (!cancelled) {
          setAccount("");
          setWalletName("");
        }
      }
    }
    void restore();
    const retry = window.setTimeout(() => void restore(), 500);
    return () => {
      cancelled = true;
      window.clearTimeout(retry);
    };
  }, []);

  return {
    account,
    accountMenuOpen,
    balanceBusy,
    balanceWei,
    busy,
    error,
    pickerOpen,
    walletName,
    wallets,
    connect,
    closeMenus,
    logout,
    openPicker,
    setPickerOpen,
    toggleAccountMenu,
  };
}

function usePools() {
  const [pools, setPools] = useState<UiPool[]>(configuredContractAddress ? [] : designPools);
  const [loading, setLoading] = useState(Boolean(configuredContractAddress));
  const [error, setError] = useState("");
  const [live, setLive] = useState(false);

  const refresh = useCallback(async () => {
    if (!configuredContractAddress) return;
    setLoading(true);
    setError("");
    try {
      const loaded = await fetchPools();
      setPools(loaded.map(poolFromContract));
      setLive(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not read contract state");
      setPools([]);
      setLive(false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { pools, loading, error, live, refresh };
}

function parseWeiInput(value: string): bigint | null {
  const trimmed = value.trim();
  if (!/^\d+$/.test(trimmed)) return null;
  try {
    return BigInt(trimmed);
  } catch {
    return null;
  }
}

function goto(path: string) {
  window.location.hash = path;
}

function shortAddress(address: string) {
  return address ? `${address.slice(0, 6)}...${address.slice(-4)}` : "Connect Wallet";
}

function Header({
  active,
  wallet,
}: {
  active: Route["name"];
  wallet: ReturnType<typeof useWallet>;
}) {
  const account = wallet.account;
  const { accountMenuOpen, closeMenus, pickerOpen } = wallet;
  const walletAreaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!pickerOpen && !accountMenuOpen) return;

    const closeOnOutsidePointer = (event: PointerEvent) => {
      const target = event.target;
      if (target instanceof Node && walletAreaRef.current?.contains(target)) return;
      closeMenus();
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeMenus();
    };

    document.addEventListener("pointerdown", closeOnOutsidePointer);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsidePointer);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [accountMenuOpen, closeMenus, pickerOpen]);

  return (
    <header className="topbar">
      <a className="brand" href="#/" aria-label="Disclosure Dividend home">
        <ShieldCheck size={24} aria-hidden="true" />
        <span>Disclosure Dividend</span>
      </a>
      <nav className="topnav" aria-label="Primary navigation">
        <a className={active === "explorer" || active === "pool" ? "active" : ""} href="#/">
          Explorer
        </a>
        <a className={active === "account" ? "active" : ""} href="#/account">
          My Claims
        </a>
      </nav>
      <div className="wallet-area" ref={walletAreaRef}>
        <button
          aria-expanded={account ? wallet.accountMenuOpen : wallet.pickerOpen}
          aria-haspopup="dialog"
          className={account ? "wallet-button connected" : "wallet-button"}
          type="button"
          onClick={account ? wallet.toggleAccountMenu : wallet.openPicker}
          disabled={wallet.busy}
        >
          <Wallet size={18} aria-hidden="true" />
          {account ? (
            <>
              <span className="connected-dot" aria-hidden="true" />
              {shortAddress(account)}
            </>
          ) : wallet.busy ? (
            "Connecting"
          ) : (
            "Connect Wallet"
          )}
        </button>
        {wallet.pickerOpen ? (
          <section className="wallet-popover glass" role="dialog" aria-label="Choose wallet">
            <p className="eyebrow">Choose wallet</p>
            <h2>Connect browser wallet</h2>
            <div className="wallet-choice-list">
              {wallet.wallets.map((option) => (
                <button className="wallet-choice" type="button" key={option.id} onClick={() => wallet.connect(option.id)}>
                  <span>{option.name}</span>
                  <small>Detected extension</small>
                </button>
              ))}
            </div>
            <button className="wallet-popover-close" type="button" onClick={() => wallet.setPickerOpen(false)}>
              Cancel
            </button>
          </section>
        ) : null}
        {wallet.accountMenuOpen ? (
          <section className="wallet-popover wallet-account-popover glass" role="dialog" aria-label="Wallet account">
            <p className="eyebrow">Connected</p>
            <h2>{wallet.walletName || "Browser Wallet"}</h2>
            <p className="wallet-address">{account}</p>
            <div className="wallet-balance">
              <span>GenLayer native token</span>
              <strong>{wallet.balanceBusy ? "Loading..." : formatWeiAsGen(wallet.balanceWei || "0")}</strong>
            </div>
            <button className="logout-button" type="button" onClick={wallet.logout}>
              Logout
            </button>
          </section>
        ) : null}
      </div>
    </header>
  );
}

function Sidebar({ active }: { active: "overview" | "claims" | "create" }) {
  return (
    <aside className="sidebar" aria-label="Pool workspace navigation">
      <div className="sidebar-title">
        <GitBranch size={28} aria-hidden="true" />
        <div>
          <p>Pool Workspace</p>
          <span>Active Rewards</span>
        </div>
      </div>
      <a className={active === "overview" ? "side-link active" : "side-link"} href="#/">
        <LayoutDashboard size={20} aria-hidden="true" />
        Pool Overview
      </a>
      <a className={active === "claims" ? "side-link active" : "side-link"} href="#/account">
        <ShieldCheck size={20} aria-hidden="true" />
        Claim History
      </a>
      <a className={active === "create" ? "side-link active" : "side-link"} href="#/create">
        <FileKey2 size={20} aria-hidden="true" />
        Create Pool
      </a>
    </aside>
  );
}

function IntegrationNotice({ loading, error, live }: { loading: boolean; error: string; live: boolean }) {
  if (!configuredContractAddress) {
    return (
      <section className="notice" aria-label="Integration pending">
        <strong>Integration pending</strong>
        <span>No contract address is configured. This interface is showing Design data until Studionet deployment is wired.</span>
      </section>
    );
  }
  if (loading) {
    return (
      <section className="notice" aria-label="Loading contract state">
        <strong>Reading Studionet</strong>
        <span>Loading canonical pool state from the configured contract.</span>
      </section>
    );
  }
  if (error) {
    return (
      <section className="notice" aria-label="Contract read failed">
        <strong>Read failed</strong>
        <span>{error}</span>
      </section>
    );
  }
  if (live) {
    return (
      <section className="notice" aria-label="Studionet connected">
        <strong>Studionet connected</strong>
        <span>Pool cards and account credits are read from canonical contract views.</span>
      </section>
    );
  }
  return null;
}

function Explorer({ wallet, poolState }: { wallet: ReturnType<typeof useWallet>; poolState: ReturnType<typeof usePools> }) {
  return (
    <>
      <Header active="explorer" wallet={wallet} />
      <main className="page explorer">
        <section className="hero">
          <p className="eyebrow">{configuredContractAddress ? "Studionet pools" : "Design data"}</p>
          <h1>Disclosure Dividend</h1>
          <p>
            Seal a vulnerability report before disclosure, then let GenLayer validators divide a funded reward across material,
            role-backed research contributions.
          </p>
          <button className="secondary-cta" type="button" onClick={() => goto("/create")}>
            <FileKey2 size={18} aria-hidden="true" />
            Create Pool
          </button>
        </section>
        <IntegrationNotice loading={poolState.loading} error={poolState.error || wallet.error} live={poolState.live} />
        <section className="content-grid" aria-label="Pool explorer">
          <aside className="filter-card glass">
            <h2>Filter Pools</h2>
            <button className="filter active" type="button">All statuses</button>
            <button className="filter" type="button">Reports are being sealed</button>
            <button className="filter" type="button">Waiting for disclosure</button>
            <button className="filter" type="button">Reward split finalized</button>
          </aside>
          <div className="pool-grid">
            {poolState.pools.length === 0 && configuredContractAddress ? (
              <article className="pool-card glass">
                <div className="card-row">
                  <span className="status source_pending">{poolState.loading ? "LOADING" : "EMPTY"}</span>
                  <span className="metric-label">Studionet</span>
                </div>
                <h2>{poolState.loading ? "Loading pool state" : "No pools found"}</h2>
                <p>{poolState.loading ? "Canonical contract views are still loading." : "Create a pool to start the first reward lifecycle."}</p>
              </article>
            ) : null}
            {poolState.pools.map((pool) => (
              <article className="pool-card glass" key={pool.id}>
                <div className="card-row">
                  <span className={`status ${pool.status.toLowerCase()}`}>{pool.status}</span>
                  <span className="metric-label">Reward</span>
                </div>
                <div className="card-row align-end">
                  <div>
                    <h2>{pool.id}</h2>
                    <p>{pool.issue}</p>
                  </div>
                  <strong className="reward">{pool.reward}</strong>
                </div>
                <div className="divider" />
                <div className="card-row muted-row">
                  <span>
                    <Clock3 size={16} aria-hidden="true" />
                    {pool.deadline}
                  </span>
                  <a href={`#/pools/${pool.id}`} aria-label={`View Details for ${pool.id}`}>
                    View Details <ArrowRight size={18} aria-hidden="true" />
                  </a>
                </div>
              </article>
            ))}
          </div>
        </section>
      </main>
      <Footer live={poolState.live} />
    </>
  );
}

function PoolWorkspace({
  poolId,
  wallet,
  poolState,
}: {
  poolId: string;
  wallet: ReturnType<typeof useWallet>;
  poolState: ReturnType<typeof usePools>;
}) {
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [commitment, setCommitment] = useState("");
  const [reportUrl, setReportUrl] = useState("");
  const [salt, setSalt] = useState("");
  const [txState, setTxState] = useState("");
  const [busy, setBusy] = useState(false);
  const pool = useMemo(
    () =>
      poolState.pools.find((item) => item.id === poolId) ??
      (configuredContractAddress ? undefined : designPools.find((item) => item.id === poolId) ?? designPools[0]),
    [poolId, poolState.pools],
  );
  const canWrite = Boolean(configuredContractAddress && wallet.account && !busy);
  const canSeal = Boolean(canWrite && pool?.status === "COMMIT_OPEN");
  const canReveal = Boolean(canWrite && pool?.status === "REVEAL_OPEN");

  async function onSeal() {
    if (!pool || !canSeal) return;
    setBusy(true);
    setTxState("Submitting sealed report commitment...");
    try {
      await sealClaim(wallet.account, pool.id, commitment, pool.reservationBondWei);
      setTxState("Commitment accepted and finalized. Refreshing pool state.");
      await poolState.refresh();
    } catch (err) {
      setTxState(err instanceof Error ? err.message : "Could not seal report");
    } finally {
      setBusy(false);
    }
  }

  async function onReveal() {
    if (!pool || !canReveal) return;
    setBusy(true);
    setTxState("Submitting report reveal...");
    try {
      await revealClaim(wallet.account, pool.id, reportUrl, salt);
      setTxState("Reveal accepted and finalized. Refreshing pool state.");
      await poolState.refresh();
    } catch (err) {
      setTxState(err instanceof Error ? err.message : "Could not reveal report");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Header active="pool" wallet={wallet} />
      <Sidebar active="overview" />
      <main className="page with-sidebar workspace">
        <section className="workspace-head">
          <p className="eyebrow">Target repository</p>
          <h1>{pool?.id ?? poolId}</h1>
          <p>
            {pool
              ? `${pool.repository} is funding ${pool.reward} for public reports that materially match the later GitHub advisory and patch evidence.`
              : "Canonical pool state is not available for this route yet."}
          </p>
        </section>
        <IntegrationNotice loading={poolState.loading} error={poolState.error || wallet.error} live={poolState.live} />
        {pool ? (
          <div className="workspace-grid">
          <section className="glass lifecycle" aria-label="Lifecycle status">
            <h2>Lifecycle Status</h2>
            {[
              ["Sealed Reports", "Commitments are open and reports remain private.", "COMMIT_OPEN"],
              ["Disclosure Verification", "A GHSA and patch commit must be verified before reveals.", "SOURCE_PENDING"],
              ["Reveals", "Claim owners publish commit-pinned reports and prove preimage.", "REVEAL_OPEN"],
              ["Independent Review", "Validators classify locked contribution roles from public report evidence.", "READY_FOR_REVIEW"],
              ["Reward Split", "Canonical credits open after the finalized verdict.", "DISTRIBUTED"],
              ["Withdrawals", "Credit owners withdraw available GEN.", "DISTRIBUTED"],
            ].map(([title, body, status]) => (
              <div className={`timeline-item ${pool.status === status ? "current" : ""}`} key={title}>
                <span className="timeline-dot" />
                <div>
                  <h3>{title}</h3>
                  <p>{body}</p>
                </div>
              </div>
            ))}
          </section>
          <aside className="glass action-panel" aria-label="Current action">
            <h2>
              {pool.status === "COMMIT_OPEN"
                ? "Seal My Report"
                : pool.status === "REVEAL_OPEN"
                  ? "Reveal My Report"
                  : statusLabels[pool.status]}
            </h2>
            <p>
              {pool.status === "REVEAL_OPEN"
                ? "Publish your commit-pinned report URL and salt so the contract can match the original commitment."
                : pool.status === "COMMIT_OPEN"
                  ? "Submit a commitment digest before the deadline. Keep the salt locally until the reveal phase opens."
                  : "No user transaction is available for this pool in its current lifecycle state."}
            </p>
            {pool.status === "REVEAL_OPEN" ? (
              <>
                <label htmlFor="reportUrl">Report URL</label>
                <input id="reportUrl" value={reportUrl} onChange={(event) => setReportUrl(event.target.value)} placeholder="https://raw.githubusercontent.com/..." />
                <label htmlFor="salt">Commitment salt</label>
                <input id="salt" value={salt} onChange={(event) => setSalt(event.target.value)} placeholder="local secret salt" />
                <button className="primary-cta" type="button" onClick={onReveal} disabled={!canReveal || !reportUrl || !salt}>
                  <Fingerprint size={18} aria-hidden="true" />
                  Reveal Report
                </button>
              </>
            ) : pool.status === "COMMIT_OPEN" ? (
              <>
                <label htmlFor="commitment">Commitment digest</label>
                <input id="commitment" value={commitment} onChange={(event) => setCommitment(event.target.value)} placeholder="64-character sha256 digest" />
                <label htmlFor="bond">Reservation bond</label>
                <input id="bond" value={formatWeiAsGen(pool.reservationBondWei)} readOnly />
                <button className="primary-cta" type="button" onClick={onSeal} disabled={!canSeal || commitment.length !== 64}>
                  <Fingerprint size={18} aria-hidden="true" />
                  Seal My Report
                </button>
              </>
            ) : (
              <p className="tx-status" role="status">{statusLabels[pool.status]}</p>
            )}
            {txState ? <p className="tx-status" role="status">{txState}</p> : null}
            <div className="divider" />
            <button className="disclosure-button" type="button" onClick={() => setDetailsOpen((value) => !value)}>
              Technical Details
            </button>
            {detailsOpen ? (
              <section className="technical-details" role="region" aria-label="Technical Details">
                <a href="https://github.com/raszi/node-tmp/security/advisories/GHSA-ph9p-34f9-6g65">
                  GitHub advisory <ExternalLink size={14} aria-hidden="true" />
                </a>
                <a href="https://explorer-studio.genlayer.com">
                  Explorer <ExternalLink size={14} aria-hidden="true" />
                </a>
              </section>
            ) : null}
          </aside>
        </div>
        ) : (
          <section className="glass action-panel" aria-label="Current action">
            <h2>{poolState.loading ? "Loading pool" : "Pool not found"}</h2>
            <p>{poolState.loading ? "Waiting for canonical Studionet state." : "Return to the explorer and select an available pool."}</p>
          </section>
        )}
      </main>
      <Footer live={poolState.live} />
    </>
  );
}

function Account({ wallet }: { wallet: ReturnType<typeof useWallet> }) {
  const [accountView, setAccountView] = useState<AccountView | null>(null);
  const [amountGen, setAmountGen] = useState("");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    if (!configuredContractAddress || !wallet.account) return;
    setBusy(true);
    try {
      setAccountView(await fetchAccount(wallet.account));
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Could not read account");
    } finally {
      setBusy(false);
    }
  }, [wallet.account]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function onWithdraw() {
    setBusy(true);
    setStatus("Submitting withdrawal...");
    try {
      const requestedWei = amountGen.trim() ? parseGenInputToWei(amountGen)?.toString() : accountView?.creditWei || "0";
      if (!requestedWei) throw new Error("Enter a valid GEN amount");
      await withdrawCredit(wallet.account, requestedWei);
      setStatus("Withdrawal accepted and finalized.");
      await refresh();
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Could not withdraw credit");
    } finally {
      setBusy(false);
    }
  }

  const liveClaims = accountView?.claims ?? [];
  const hasLiveAccount = Boolean(configuredContractAddress && wallet.account && accountView);
  const showDesignAccount = !configuredContractAddress;
  const creditWei = parseWeiInput(accountView?.creditWei ?? "0") ?? 0n;
  const requestedWithdrawWei = amountGen.trim() ? parseGenInputToWei(amountGen) : creditWei;
  const canWithdraw = Boolean(
    hasLiveAccount &&
      !busy &&
      creditWei > 0n &&
      requestedWithdrawWei !== null &&
      requestedWithdrawWei > 0n &&
      requestedWithdrawWei <= creditWei,
  );

  return (
    <>
      <Header active="account" wallet={wallet} />
      <Sidebar active="claims" />
      <main className="page with-sidebar account">
        <p className="eyebrow">Connected account</p>
        <h1>My Claims & Credits</h1>
        <p className="intro">Track your sealed reports, reveal windows, refundable bonds, reward credits, and withdrawals.</p>
        <IntegrationNotice loading={busy && !accountView} error={wallet.error || status} live={hasLiveAccount} />
        <div className="account-grid">
          <section aria-label="Active claims">
            <div className="section-title">
              <h2>Active Claims</h2>
              <span>{hasLiveAccount ? `${liveClaims.length} linked` : showDesignAccount ? "2 pending" : "Canonical view"}</span>
            </div>
            {hasLiveAccount ? (
              liveClaims.map((claim) => (
                <article className="claim-card glass highlighted" key={`${claim.pool_id}-${claim.commitment}`}>
                  <div>
                    <h3>{claim.pool_id} report</h3>
                    <p>{claim.report_url || "Report remains sealed until reveal."}</p>
                  </div>
                  <dl>
                    <div><dt>Bond credit</dt><dd>{formatWeiAsGen(claim.bond_wei)}</dd></div>
                    <div><dt>Status</dt><dd>{claim.outcome}</dd></div>
                    <div><dt>Pool</dt><dd>{claim.pool_id}</dd></div>
                  </dl>
                </article>
              ))
            ) : showDesignAccount ? (
              <>
                <article className="claim-card glass highlighted">
                  <div>
                    <h3>node-tmp report</h3>
                    <p>Path traversal report committed before disclosure</p>
                  </div>
                  <dl>
                    <div><dt>Bond credit</dt><dd>25 GEN</dd></div>
                    <div><dt>Status</dt><dd>Reveal eligible soon</dd></div>
                    <div><dt>Pool</dt><dd>node-tmp</dd></div>
                  </dl>
                  <button className="secondary-cta" type="button">Reveal Report</button>
                </article>
                <article className="claim-card glass">
                  <div>
                    <h3>core-js report</h3>
                    <p>Root-cause contribution accepted in finalized split</p>
                  </div>
                  <dl>
                    <div><dt>Reward credit</dt><dd>4,450 GEN</dd></div>
                    <div><dt>Status</dt><dd>Credit available</dd></div>
                    <div><dt>Outcome</dt><dd>Material contribution</dd></div>
                  </dl>
                </article>
              </>
            ) : (
              <article className="claim-card glass highlighted">
                <div>
                  <h3>{wallet.account ? "No linked claims" : "Connect wallet"}</h3>
                  <p>{wallet.account ? "This account has no claims in the canonical contract view." : "Connect a browser wallet to read your canonical claim history."}</p>
                </div>
              </article>
            )}
          </section>
          <aside className="credit-card glass">
            <h2>Credit Summary</h2>
            <p>Total available balance</p>
            <strong>{hasLiveAccount ? formatWeiAsGen(accountView?.creditWei) : showDesignAccount ? "4,475 GEN" : "0 GEN"}</strong>
            <dl>
              <div><dt>Refundable bonds</dt><dd>{hasLiveAccount ? "Included above" : showDesignAccount ? "25 GEN" : "Canonical view"}</dd></div>
              <div><dt>Reward credits</dt><dd>{hasLiveAccount ? "Canonical view" : showDesignAccount ? "4,450 GEN" : "Canonical view"}</dd></div>
              <div><dt>Pending withdrawals</dt><dd>0 GEN</dd></div>
            </dl>
            {hasLiveAccount ? (
              <>
                <label htmlFor="withdrawAmount">Withdraw amount (GEN)</label>
                <input id="withdrawAmount" inputMode="decimal" value={amountGen} onChange={(event) => setAmountGen(event.target.value)} placeholder={formatWeiAsGen(accountView?.creditWei).replace(" GEN", "")} />
              </>
            ) : null}
            <button className="primary-cta" type="button" onClick={onWithdraw} disabled={!canWithdraw}>
              <Wallet size={18} aria-hidden="true" />
              Withdraw Credit
            </button>
            {status ? <p className="tx-status" role="status">{status}</p> : null}
          </aside>
        </div>
      </main>
      <Footer live={Boolean(configuredContractAddress)} />
    </>
  );
}

function CreatePool({ wallet, onCreated }: { wallet: ReturnType<typeof useWallet>; onCreated: () => Promise<void> }) {
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    poolId: "node-tmp",
    targetRepository: "https://github.com/raszi/node-tmp",
    targetPackage: "npm:tmp",
    rewardGen: "2",
    claimLimit: "6",
    reservationBondGen: "1",
    commitDeadline: "2026-08-06T12:00",
    revealDeadline: "2026-08-09T12:00",
  });

  function updateForm(field: keyof typeof form, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function isoUtc(datetimeLocal: string) {
    return `${datetimeLocal}:00Z`;
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setStatus("Submitting funded pool...");
    try {
      const rewardWei = parseGenInputToWei(form.rewardGen);
      const reservationBondWei = parseGenInputToWei(form.reservationBondGen);
      if (rewardWei === null || reservationBondWei === null) throw new Error("Enter valid GEN amounts");
      await createPool(wallet.account, {
        poolId: form.poolId,
        targetRepository: form.targetRepository,
        targetPackage: form.targetPackage,
        roleWeightsCsv: "20,30,40,10",
        claimLimit: Number(form.claimLimit),
        commitDeadline: isoUtc(form.commitDeadline),
        revealDeadline: isoUtc(form.revealDeadline),
        reservationBondWei: reservationBondWei.toString(),
        rewardWei: rewardWei.toString(),
      });
      setStatus("Pool accepted and finalized. Refreshing explorer.");
      await onCreated();
      goto(`/pools/${form.poolId}`);
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Could not create pool");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Header active="create" wallet={wallet} />
      <Sidebar active="create" />
      <main className="page with-sidebar create-page">
        <p className="eyebrow">Sponsor workflow</p>
        <h1>Create Pool Policy</h1>
        <p className="intro">Lock the target, timing, claim capacity, role weights, and funded GEN reward before reports are visible.</p>
        <div className="create-grid">
          <form id="createPoolForm" className="glass form-card" onSubmit={onSubmit}>
            <h2>Target Scope</h2>
            <label htmlFor="poolId">Pool id</label>
            <input id="poolId" value={form.poolId} onChange={(event) => updateForm("poolId", event.target.value)} />
            <label htmlFor="targetRepository">Target repository</label>
            <input id="targetRepository" value={form.targetRepository} onChange={(event) => updateForm("targetRepository", event.target.value)} />
            <label htmlFor="targetPackage">Target package</label>
            <input id="targetPackage" value={form.targetPackage} onChange={(event) => updateForm("targetPackage", event.target.value)} />
            <div className="form-split">
              <label htmlFor="rewardAmount">
                Reward amount (GEN)
                <input id="rewardAmount" inputMode="decimal" value={form.rewardGen} onChange={(event) => updateForm("rewardGen", event.target.value)} />
              </label>
              <label htmlFor="claimLimit">
                Claim limit
                <input id="claimLimit" inputMode="numeric" value={form.claimLimit} onChange={(event) => updateForm("claimLimit", event.target.value)} />
              </label>
            </div>
            <div className="form-split">
              <label htmlFor="commitDeadline">
                Commit deadline
                <input id="commitDeadline" type="datetime-local" value={form.commitDeadline} onChange={(event) => updateForm("commitDeadline", event.target.value)} />
              </label>
              <label htmlFor="revealDeadline">
                Reveal deadline
                <input id="revealDeadline" type="datetime-local" value={form.revealDeadline} onChange={(event) => updateForm("revealDeadline", event.target.value)} />
              </label>
            </div>
            <h2>Reward Role Weights</h2>
            {[
              ["DISCOVERY", "20%"],
              ["ROOT_CAUSE", "30%"],
              ["EXPLOIT_PROOF", "40%"],
              ["REMEDIATION_VERIFICATION", "10%"],
            ].map(([role, weight]) => (
              <div className="weight-row" key={role}>
                <span>{role}</span>
                <strong>{weight}</strong>
              </div>
            ))}
            {status ? <p className="tx-status" role="status">{status}</p> : null}
          </form>
          <aside className="glass summary-card">
            <h2>Policy Summary</h2>
            <p>
              This pool rewards public, commit-pinned reports for <strong>{form.targetPackage}</strong>. Role weights total 100%, and
              validators determine material roles from public evidence before credits open.
            </p>
            <dl>
              <div><dt>Reward</dt><dd>{parseGenInputToWei(form.rewardGen) === null ? "Invalid GEN amount" : formatWeiAsGen(parseGenInputToWei(form.rewardGen) ?? 0n)}</dd></div>
              <div><dt>Reservation bond</dt><dd>{parseGenInputToWei(form.reservationBondGen) === null ? "Invalid GEN amount" : formatWeiAsGen(parseGenInputToWei(form.reservationBondGen) ?? 0n)}</dd></div>
              <div><dt>Maximum claims</dt><dd>{form.claimLimit}</dd></div>
            </dl>
            <button className="primary-cta" type="submit" form="createPoolForm" disabled={!configuredContractAddress || !wallet.account || busy}>
              <Link2 size={18} aria-hidden="true" />
              Create and Fund Pool
            </button>
          </aside>
        </div>
      </main>
      <Footer live={Boolean(configuredContractAddress)} />
    </>
  );
}

function Footer({ live }: { live: boolean }) {
  return (
    <footer className="footer">
      <span>Disclosure Dividend</span>
      <span>{live ? "Using configured Studionet contract views." : "Studionet project evidence remains pending until deployment."}</span>
    </footer>
  );
}

export default function App() {
  const route = useRoute();
  const wallet = useWallet();
  const poolState = usePools();
  if (route.name === "pool") return <PoolWorkspace poolId={route.poolId} wallet={wallet} poolState={poolState} />;
  if (route.name === "account") return <Account wallet={wallet} />;
  if (route.name === "create") return <CreatePool wallet={wallet} onCreated={poolState.refresh} />;
  return <Explorer wallet={wallet} poolState={poolState} />;
}
