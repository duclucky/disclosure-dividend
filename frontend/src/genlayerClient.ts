import { createClient } from "genlayer-js";
import { studionet } from "genlayer-js/chains";
import { TransactionStatus, type CalldataEncodable, type TransactionHash } from "genlayer-js/types";

export type PoolStatus =
  | "COMMIT_OPEN"
  | "SOURCE_PENDING"
  | "REVEAL_OPEN"
  | "READY_FOR_REVIEW"
  | "RETRYABLE"
  | "DISTRIBUTED"
  | "CANCELLED";

export type PoolView = {
  pool_id: string;
  sponsor: string;
  target_repository: string;
  target_package: string;
  role_weights_csv: string;
  claim_limit: string;
  commit_deadline: string;
  reveal_deadline: string;
  reservation_bond_wei: string;
  reward_wei: string;
  status: PoolStatus;
  ghsa_id: string;
  advisory_database_commit: string;
  patch_commit: string;
  claim_count: string;
  revealed_count: string;
  attempt_count: string;
  distributed: boolean;
};

export type ClaimView = {
  pool_id: string;
  claimant: string;
  commitment: string;
  report_url: string;
  report_hash: string;
  outcome: string;
  roles_csv: string;
  bond_wei: string;
};

export type AccountView = {
  address: string;
  creditWei: string;
  poolIds: string[];
  claims: ClaimView[];
};

export type WalletProvider = {
  request(args: { method: string; params?: unknown[] }): Promise<unknown>;
  ethereum?: WalletProvider;
  providers?: WalletProvider[];
  isBraveWallet?: boolean;
  isCoinbaseWallet?: boolean;
  isOkxWallet?: boolean;
  isMetaMask?: boolean;
  isPhantom?: boolean;
  isRabby?: boolean;
  isTrust?: boolean;
  isTrustWallet?: boolean;
  isWalletConnect?: boolean;
};

export type WalletOption = {
  id: string;
  name: string;
  provider: WalletProvider;
  icon?: string;
};

export type WalletSession = {
  account: string;
  walletId: string;
  walletName: string;
};

declare global {
  interface Window {
    ethereum?: WalletProvider;
    okxwallet?: WalletProvider;
  }
}

export const configuredContractAddress = (import.meta.env.VITE_CONTRACT_ADDRESS as string | undefined)?.trim();
const contractAddress = configuredContractAddress as `0x${string}` | undefined;
const readClient = createClient({ chain: studionet });
const transientRpcRetryDelaysMs = [0, 400];
const studionetChainId = `0x${studionet.id.toString(16)}`;
const studionetWalletChain = {
  chainId: studionetChainId,
  chainName: studionet.name,
  rpcUrls: studionet.rpcUrls.default.http,
  nativeCurrency: studionet.nativeCurrency,
  blockExplorerUrls: studionet.blockExplorers?.default?.url ? [studionet.blockExplorers.default.url] : undefined,
};
const walletStorageKeys = {
  account: "disclosureDividend.walletAccount",
  walletId: "disclosureDividend.walletId",
};
let activeWalletProvider: WalletProvider | undefined;
const announcedProviders: Eip6963ProviderDetail[] = [];
let eip6963Listening = false;

type Eip6963ProviderDetail = {
  info?: {
    icon?: string;
    name?: string;
    rdns?: string;
    uuid?: string;
  };
  provider?: WalletProvider;
};

function walletStorage() {
  try {
    return typeof window === "undefined" ? undefined : window.localStorage;
  } catch {
    return undefined;
  }
}

function slug(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function walletIdentity(provider: WalletProvider, detail?: Eip6963ProviderDetail): Omit<WalletOption, "provider"> {
  const announcedName = detail?.info?.name?.trim();
  const announcedId = detail?.info?.rdns || detail?.info?.uuid || announcedName;
  if (announcedName && announcedId) {
    return { id: slug(announcedId), name: announcedName, icon: detail?.info?.icon };
  }
  if (provider.isRabby) return { id: "rabby", name: "Rabby" };
  if (provider.isCoinbaseWallet) return { id: "coinbase-wallet", name: "Coinbase Wallet" };
  if (provider.isOkxWallet) return { id: "okx-wallet", name: "OKX Wallet" };
  if (provider.isPhantom) return { id: "phantom", name: "Phantom" };
  if (provider.isTrust || provider.isTrustWallet) return { id: "trust-wallet", name: "Trust Wallet" };
  if (provider.isBraveWallet) return { id: "brave-wallet", name: "Brave Wallet" };
  if (provider.isWalletConnect) return { id: "walletconnect", name: "WalletConnect" };
  if (provider.isMetaMask) return { id: "metamask", name: "MetaMask" };
  return { id: "browser-wallet", name: "Browser Wallet" };
}

function pushWallet(
  options: WalletOption[],
  seenProviders: Set<WalletProvider>,
  seenIds: Set<string>,
  seenNames: Set<string>,
  provider: WalletProvider | undefined,
  detail?: Eip6963ProviderDetail,
) {
  if (!provider?.request || seenProviders.has(provider)) return;
  const identity = walletIdentity(provider, detail);
  const id = identity.id || "browser-wallet";
  const nameKey = identity.name.trim().toLowerCase();
  if (seenIds.has(id) || seenNames.has(nameKey)) {
    return;
  }
  seenProviders.add(provider);
  seenIds.add(id);
  seenNames.add(nameKey);
  options.push({ id, name: identity.name, provider, icon: identity.icon });
}

export function __resetWalletDiscoveryForTests() {
  announcedProviders.length = 0;
  activeWalletProvider = undefined;
}

function rememberAnnouncedProvider(detail: Eip6963ProviderDetail | undefined) {
  if (!detail?.provider?.request) return;
  if (announcedProviders.some((announced) => announced.provider === detail.provider)) return;
  announcedProviders.push(detail);
}

function ensureEip6963Listener() {
  if (eip6963Listening || typeof window === "undefined") return;
  window.addEventListener("eip6963:announceProvider", ((event: Event) => {
    rememberAnnouncedProvider((event as CustomEvent<Eip6963ProviderDetail>).detail);
  }) as EventListener);
  eip6963Listening = true;
}

async function requestEip6963Providers(delayMs: number) {
  ensureEip6963Listener();
  window.dispatchEvent(new Event("eip6963:requestProvider"));
  if (delayMs > 0) {
    await new Promise((resolve) => window.setTimeout(resolve, delayMs));
  }
}

function parseAccounts(accounts: unknown): string[] {
  return Array.isArray(accounts) ? accounts.map((account) => String(account)).filter(Boolean) : [];
}

function normalizeChainId(chainId: unknown) {
  return typeof chainId === "string" ? chainId.toLowerCase() : "";
}

function walletErrorMessage(err: unknown) {
  return err instanceof Error ? err.message : typeof err === "string" ? err : "";
}

function walletErrorCode(err: unknown) {
  if (typeof err === "object" && err && "code" in err) {
    return (err as { code?: unknown }).code;
  }
  return undefined;
}

function isUnknownChainError(err: unknown) {
  const code = walletErrorCode(err);
  const message = walletErrorMessage(err).toLowerCase();
  return (
    code === 4902 ||
    code === "4902" ||
    message.includes("unrecognized chain") ||
    message.includes("unknown chain") ||
    message.includes("not added") ||
    message.includes("has not been added")
  );
}

async function switchWalletToStudionet(provider: WalletProvider) {
  await provider.request({ method: "wallet_switchEthereumChain", params: [{ chainId: studionetChainId }] });
}

async function ensureWalletOnStudionet(provider: WalletProvider) {
  try {
    const currentChainId = normalizeChainId(await provider.request({ method: "eth_chainId" }));
    if (currentChainId === studionetChainId) return;
  } catch {
    // Some injected wallets only expose chain state after a switch request.
  }

  try {
    await switchWalletToStudionet(provider);
  } catch (err) {
    if (isUnknownChainError(err)) {
      try {
        await provider.request({ method: "wallet_addEthereumChain", params: [studionetWalletChain] });
        await switchWalletToStudionet(provider);
        return;
      } catch (addErr) {
        const detail = walletErrorMessage(addErr);
        throw new Error(
          detail
            ? `Wallet is not connected to GenLayer Studionet. Approve adding and switching the network in your wallet. (${detail})`
            : "Wallet is not connected to GenLayer Studionet. Approve adding and switching the network in your wallet.",
        );
      }
    }
    const detail = walletErrorMessage(err);
    throw new Error(
      detail
        ? `Wallet is not connected to GenLayer Studionet. Approve the network switch in your wallet. (${detail})`
        : "Wallet is not connected to GenLayer Studionet. Approve the network switch in your wallet.",
    );
  }
}

async function ensureActiveWalletOnStudionet() {
  const provider = activeWalletProvider;
  if (!provider) {
    throw new Error("Wallet provider is not available");
  }
  await ensureWalletOnStudionet(provider);
}

function saveWalletSession(session: WalletSession) {
  const storage = walletStorage();
  storage?.setItem(walletStorageKeys.walletId, session.walletId);
  storage?.setItem(walletStorageKeys.account, session.account);
}

function clearWalletSession() {
  const storage = walletStorage();
  storage?.removeItem(walletStorageKeys.walletId);
  storage?.removeItem(walletStorageKeys.account);
}

function requireContractAddress(): `0x${string}` {
  if (!contractAddress) {
    throw new Error("No contract address is configured");
  }
  return contractAddress;
}

function rpcErrorMessage(err: unknown) {
  const cause = typeof err === "object" && err && "cause" in err ? (err as { cause?: unknown }).cause : undefined;
  if (err instanceof Error) {
    return [err.message, cause instanceof Error ? cause.message : ""].filter(Boolean).join(" ");
  }
  return typeof err === "string" ? err : "";
}

function isTransientRpcError(err: unknown) {
  const message = rpcErrorMessage(err).toLowerCase();
  return (
    message.includes("failed to fetch") ||
    message.includes("networkerror") ||
    message.includes("load failed") ||
    message.includes("timeout") ||
    message.includes("temporarily unavailable") ||
    message.includes("too many requests") ||
    message.includes("connection") ||
    message.includes("502") ||
    message.includes("503") ||
    message.includes("504")
  );
}

async function delay(ms: number) {
  if (ms <= 0) return;
  await new Promise((resolve) => window.setTimeout(resolve, ms));
}

async function withTransientRpcRetry<T>(operation: () => Promise<T>): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= transientRpcRetryDelaysMs.length; attempt += 1) {
    try {
      return await operation();
    } catch (err) {
      lastError = err;
      if (!isTransientRpcError(err) || attempt === transientRpcRetryDelaysMs.length) {
        throw err;
      }
      await delay(transientRpcRetryDelaysMs[attempt]);
    }
  }
  throw lastError;
}

function writeClient(account: string) {
  const provider = activeWalletProvider ?? window.ethereum;
  if (!provider) {
    throw new Error("Wallet provider is not available");
  }
  return createClient({
    chain: studionet,
    account: account as `0x${string}`,
    provider,
  });
}

async function waitForAcceptedAndFinalized(hash: TransactionHash) {
  const accepted = await withTransientRpcRetry(() =>
    readClient.waitForTransactionReceipt({
      hash,
      status: TransactionStatus.ACCEPTED,
    }),
  );
  const finalized = await withTransientRpcRetry(() =>
    readClient.waitForTransactionReceipt({
      hash,
      status: TransactionStatus.FINALIZED,
    }),
  );
  return { hash, accepted, finalized };
}

export async function discoverWallets(optionsInput: { eip6963DelayMs?: number } = {}): Promise<WalletOption[]> {
  if (typeof window === "undefined") return [];
  const options: WalletOption[] = [];
  const seenProviders = new Set<WalletProvider>();
  const seenIds = new Set<string>();
  const seenNames = new Set<string>();
  const delayMs = optionsInput.eip6963DelayMs ?? 0;

  await requestEip6963Providers(delayMs);
  announcedProviders.forEach((detail) => pushWallet(options, seenProviders, seenIds, seenNames, detail.provider, detail));

  pushWallet(options, seenProviders, seenIds, seenNames, window.okxwallet?.ethereum ?? window.okxwallet, {
    info: { name: "OKX Wallet", rdns: "com.okx.wallet" },
  });

  const injected = window.ethereum;
  const legacyProviders = Array.isArray(injected?.providers) ? injected.providers : [];
  legacyProviders.forEach((provider) => pushWallet(options, seenProviders, seenIds, seenNames, provider));
  if (legacyProviders.length === 0) {
    pushWallet(options, seenProviders, seenIds, seenNames, injected);
  }

  return options;
}

export async function connectWallet(walletOrId?: string | WalletOption): Promise<WalletSession> {
  let selected = typeof walletOrId === "object" ? walletOrId : undefined;
  const walletId = typeof walletOrId === "string" ? walletOrId : selected?.id;
  let wallets = selected ? [selected] : await discoverWallets();
  if (!selected && (wallets.length === 0 || (walletId && !wallets.some((wallet) => wallet.id === walletId)))) {
    wallets = await discoverWallets({ eip6963DelayMs: 120 });
  }
  if (wallets.length === 0) {
    throw new Error("No browser wallet was detected");
  }
  selected = selected ?? (walletId ? wallets.find((wallet) => wallet.id === walletId) : wallets[0]);
  if (!selected) {
    throw new Error("Selected wallet extension is not available");
  }
  const accounts = await selected.provider.request({ method: "eth_requestAccounts" });
  const firstAccount = parseAccounts(accounts)[0] ?? "";
  if (!firstAccount) {
    throw new Error("Wallet did not return an account");
  }
  activeWalletProvider = selected.provider;
  await ensureWalletOnStudionet(selected.provider);
  const session = { account: firstAccount, walletId: selected.id, walletName: selected.name };
  saveWalletSession(session);
  return session;
}

export async function restoreWalletSession(): Promise<WalletSession | null> {
  const storage = walletStorage();
  const storedWalletId = storage?.getItem(walletStorageKeys.walletId);
  const storedAccount = storage?.getItem(walletStorageKeys.account);
  if (!storedWalletId || !storedAccount) return null;

  let selected = (await discoverWallets()).find((wallet) => wallet.id === storedWalletId);
  if (!selected) {
    selected = (await discoverWallets({ eip6963DelayMs: 120 })).find((wallet) => wallet.id === storedWalletId);
  }
  if (!selected) return null;

  const accounts = parseAccounts(await selected.provider.request({ method: "eth_accounts" }));
  const restoredAccount =
    accounts.find((account) => account.toLowerCase() === storedAccount.toLowerCase()) ?? accounts[0] ?? "";
  if (!restoredAccount) {
    clearWalletSession();
    return null;
  }

  activeWalletProvider = selected.provider;
  const session = { account: restoredAccount, walletId: selected.id, walletName: selected.name };
  saveWalletSession(session);
  return session;
}

export async function getWalletBalance(account: string): Promise<string> {
  let provider = activeWalletProvider;
  if (!provider) {
    const storedWalletId = walletStorage()?.getItem(walletStorageKeys.walletId);
    provider =
      (await discoverWallets()).find((wallet) => wallet.id === storedWalletId)?.provider ??
      (await discoverWallets({ eip6963DelayMs: 120 })).find((wallet) => wallet.id === storedWalletId)?.provider;
  }
  if (!provider) {
    throw new Error("Connected wallet provider is not available");
  }
  const balance = await provider.request({ method: "eth_getBalance", params: [account, "latest"] });
  if (typeof balance === "string" && balance.startsWith("0x")) {
    return BigInt(balance).toString();
  }
  return String(balance ?? "0");
}

export function disconnectWalletSession() {
  activeWalletProvider = undefined;
  clearWalletSession();
}

export async function fetchPools(): Promise<PoolView[]> {
  const address = requireContractAddress();
  const ids = (await withTransientRpcRetry(() =>
    readClient.readContract({
      address,
      functionName: "get_pool_ids",
      args: [],
    }),
  )) as string[];
  return Promise.all(
    ids.map((poolId) =>
      withTransientRpcRetry(
        () =>
          readClient.readContract({
            address,
            functionName: "get_pool",
            args: [poolId],
          }) as Promise<PoolView>,
      ),
    ),
  );
}

export async function fetchPool(poolId: string): Promise<PoolView> {
  return (await withTransientRpcRetry(() =>
    readClient.readContract({
      address: requireContractAddress(),
      functionName: "get_pool",
      args: [poolId],
    }),
  )) as PoolView;
}

export async function fetchAccount(address: string): Promise<AccountView> {
  const contract = requireContractAddress();
  const [creditWei, poolIds] = await Promise.all([
    withTransientRpcRetry(
      () =>
        readClient.readContract({
          address: contract,
          functionName: "get_credit",
          args: [address],
        }) as Promise<string>,
    ),
    withTransientRpcRetry(
      () =>
        readClient.readContract({
          address: contract,
          functionName: "get_account_pool_ids",
          args: [address],
        }) as Promise<string[]>,
    ),
  ]);
  const claims = await Promise.all(
    poolIds.map((poolId) =>
      withTransientRpcRetry(
        () =>
          readClient.readContract({
            address: contract,
            functionName: "get_claim",
            args: [poolId, address],
          }) as Promise<ClaimView>,
      ),
    ),
  );
  return { address, creditWei, poolIds, claims };
}

export async function createPool(
  account: string,
  input: {
    poolId: string;
    targetRepository: string;
    targetPackage: string;
    roleWeightsCsv: string;
    claimLimit: number;
    commitDeadline: string;
    revealDeadline: string;
    reservationBondWei: string;
    rewardWei: string;
  },
) {
  await ensureActiveWalletOnStudionet();
  const hash = (await writeClient(account).writeContract({
    address: requireContractAddress(),
    functionName: "create_pool",
    args: [
      input.poolId,
      input.targetRepository,
      input.targetPackage,
      input.roleWeightsCsv,
      input.claimLimit,
      input.commitDeadline,
      input.revealDeadline,
      BigInt(input.reservationBondWei),
    ],
    value: BigInt(input.rewardWei),
  })) as TransactionHash;
  return waitForAcceptedAndFinalized(hash);
}

export async function sealClaim(account: string, poolId: string, commitment: string, reservationBondWei: string) {
  await ensureActiveWalletOnStudionet();
  const hash = (await writeClient(account).writeContract({
    address: requireContractAddress(),
    functionName: "commit_claim",
    args: [poolId, commitment],
    value: BigInt(reservationBondWei),
  })) as TransactionHash;
  return waitForAcceptedAndFinalized(hash);
}

export async function revealClaim(account: string, poolId: string, reportUrl: string, salt: string) {
  await ensureActiveWalletOnStudionet();
  const hash = (await writeClient(account).writeContract({
    address: requireContractAddress(),
    functionName: "reveal_claim",
    args: [poolId, reportUrl, salt],
    value: BigInt(0),
  })) as TransactionHash;
  return waitForAcceptedAndFinalized(hash);
}

async function writePoolLifecycle(account: string, functionName: string, args: CalldataEncodable[]) {
  await ensureActiveWalletOnStudionet();
  const hash = (await writeClient(account).writeContract({
    address: requireContractAddress(),
    functionName,
    args,
    value: BigInt(0),
  })) as TransactionHash;
  return waitForAcceptedAndFinalized(hash);
}

export async function closeCommitWindow(account: string, poolId: string) {
  return writePoolLifecycle(account, "close_commit_window", [poolId]);
}

export async function proposeDisclosure(account: string, poolId: string, ghsaId: string, advisoryDatabaseCommit: string, patchCommit: string) {
  return writePoolLifecycle(account, "propose_disclosure", [poolId, ghsaId, advisoryDatabaseCommit, patchCommit]);
}

export async function verifyDisclosure(account: string, poolId: string) {
  return writePoolLifecycle(account, "verify_disclosure", [poolId]);
}

export async function closeRevealWindow(account: string, poolId: string) {
  return writePoolLifecycle(account, "close_reveal_window", [poolId]);
}

export async function adjudicatePool(account: string, poolId: string) {
  return writePoolLifecycle(account, "adjudicate_pool", [poolId]);
}

export async function retryPool(account: string, poolId: string) {
  return writePoolLifecycle(account, "retry_pool", [poolId]);
}

export async function withdrawCredit(account: string, amountWei: string) {
  await ensureActiveWalletOnStudionet();
  const hash = (await writeClient(account).writeContract({
    address: requireContractAddress(),
    functionName: "withdraw_credit",
    args: [BigInt(amountWei)],
    value: BigInt(0),
  })) as TransactionHash;
  return waitForAcceptedAndFinalized(hash);
}
