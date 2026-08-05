import { createClient } from "genlayer-js";
import { studionet } from "genlayer-js/chains";
import { TransactionStatus, type TransactionHash } from "genlayer-js/types";

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
};

declare global {
  interface Window {
    ethereum?: WalletProvider;
  }
}

export const configuredContractAddress = (import.meta.env.VITE_CONTRACT_ADDRESS as string | undefined)?.trim();
const contractAddress = configuredContractAddress as `0x${string}` | undefined;
const readClient = createClient({ chain: studionet });

function requireContractAddress(): `0x${string}` {
  if (!contractAddress) {
    throw new Error("No contract address is configured");
  }
  return contractAddress;
}

function writeClient(account: string) {
  if (!window.ethereum) {
    throw new Error("Wallet provider is not available");
  }
  return createClient({
    chain: studionet,
    account: account as `0x${string}`,
    provider: window.ethereum,
  });
}

async function waitForAcceptedAndFinalized(hash: TransactionHash) {
  const accepted = await readClient.waitForTransactionReceipt({
    hash,
    status: TransactionStatus.ACCEPTED,
  });
  const finalized = await readClient.waitForTransactionReceipt({
    hash,
    status: TransactionStatus.FINALIZED,
  });
  return { hash, accepted, finalized };
}

export async function connectWallet(): Promise<string> {
  if (!window.ethereum) {
    throw new Error("No browser wallet was detected");
  }
  const accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
  const firstAccount = Array.isArray(accounts) ? String(accounts[0] ?? "") : "";
  if (!firstAccount) {
    throw new Error("Wallet did not return an account");
  }
  await writeClient(firstAccount).connect("studionet");
  return firstAccount;
}

export async function fetchPools(): Promise<PoolView[]> {
  const address = requireContractAddress();
  const ids = (await readClient.readContract({
    address,
    functionName: "get_pool_ids",
    args: [],
  })) as string[];
  return Promise.all(
    ids.map((poolId) =>
      readClient.readContract({
        address,
        functionName: "get_pool",
        args: [poolId],
      }) as Promise<PoolView>,
    ),
  );
}

export async function fetchPool(poolId: string): Promise<PoolView> {
  return (await readClient.readContract({
    address: requireContractAddress(),
    functionName: "get_pool",
    args: [poolId],
  })) as PoolView;
}

export async function fetchAccount(address: string): Promise<AccountView> {
  const contract = requireContractAddress();
  const [creditWei, poolIds] = await Promise.all([
    readClient.readContract({
      address: contract,
      functionName: "get_credit",
      args: [address],
    }) as Promise<string>,
    readClient.readContract({
      address: contract,
      functionName: "get_account_pool_ids",
      args: [address],
    }) as Promise<string[]>,
  ]);
  const claims = await Promise.all(
    poolIds.map((poolId) =>
      readClient.readContract({
        address: contract,
        functionName: "get_claim",
        args: [poolId, address],
      }) as Promise<ClaimView>,
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
  const hash = (await writeClient(account).writeContract({
    address: requireContractAddress(),
    functionName: "commit_claim",
    args: [poolId, commitment],
    value: BigInt(reservationBondWei),
  })) as TransactionHash;
  return waitForAcceptedAndFinalized(hash);
}

export async function revealClaim(account: string, poolId: string, reportUrl: string, salt: string) {
  const hash = (await writeClient(account).writeContract({
    address: requireContractAddress(),
    functionName: "reveal_claim",
    args: [poolId, reportUrl, salt],
    value: BigInt(0),
  })) as TransactionHash;
  return waitForAcceptedAndFinalized(hash);
}

export async function withdrawCredit(account: string, amountWei: string) {
  const hash = (await writeClient(account).writeContract({
    address: requireContractAddress(),
    functionName: "withdraw_credit",
    args: [BigInt(amountWei)],
    value: BigInt(0),
  })) as TransactionHash;
  return waitForAcceptedAndFinalized(hash);
}
