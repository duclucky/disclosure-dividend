import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { createAccount, createClient } from "genlayer-js";
import { studionet } from "genlayer-js/chains";
import { TransactionStatus } from "genlayer-js/types";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(SCRIPT_DIR, "..");
const CONTRACT_PATH = path.join(ROOT_DIR, "contracts", "disclosure_dividend.py");
const EVIDENCE_DIR = path.join(ROOT_DIR, "docs", "evidence", "studionet");
const EVIDENCE_PATH = path.join(EVIDENCE_DIR, "deployment.json");
const EXPLORER_URL = "https://explorer-studio.genlayer.com";
const DEFAULT_RPC_URL = studionet.rpcUrls.default.http[0];
const TERMINAL_FAILURES = new Set(["UNDETERMINED", "CANCELED", "LEADER_TIMEOUT", "VALIDATORS_TIMEOUT"]);
const PRIMARY_KEY_VARIABLES = ["STUDIONET_PRIVATE_KEY", "GENLAYER_PRIVATE_KEY", "PRIVATE_KEY"];
const CLAIMANT_KEY_VARIABLES = ["STUDIONET_INTEGRATOR_PRIVATE_KEY", "STUDIONET_CLAIMANT_PRIVATE_KEY"];
const DEMO_COMMIT_WINDOW_MS = 240_000;
const DEMO_REVEAL_WINDOW_MS = 600_000;

function parseEnvFile(filePath) {
  if (!existsSync(filePath)) return {};
  const result = {};
  for (const line of readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!match) continue;
    let value = match[2];
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    result[match[1]] = value;
  }
  return result;
}

function loadEnv() {
  const parent = parseEnvFile(path.resolve(ROOT_DIR, "..", ".env"));
  const project = parseEnvFile(path.join(ROOT_DIR, ".env"));
  return { ...parent, ...project, ...process.env };
}

const ENV = loadEnv();
const RPC_URL = ENV.STUDIONET_RPC_URL?.trim() || ENV.GENLAYER_RPC_URL?.trim() || DEFAULT_RPC_URL;

function requirePrivateKey(names) {
  for (const name of names) {
    const value = ENV[name]?.trim();
    if (value) return value.startsWith("0x") ? value : `0x${value}`;
  }
  throw new Error(`Missing private key variable from allowed set: ${names.join(", ")}`);
}

function git(args) {
  return execFileSync("git", args, { cwd: ROOT_DIR, encoding: "utf8" }).trim();
}

function sourceCommit() {
  return git(["rev-parse", "HEAD"]);
}

function contractHash() {
  return createHash("sha256").update(readFileSync(CONTRACT_PATH)).digest("hex");
}

function jsonSafe(value) {
  if (typeof value === "bigint") return value.toString();
  if (Array.isArray(value)) return value.map(jsonSafe);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, jsonSafe(item)]));
  }
  return value;
}

function readEvidence() {
  if (!existsSync(EVIDENCE_PATH)) return {};
  return JSON.parse(readFileSync(EVIDENCE_PATH, "utf8"));
}

function writeEvidence(next) {
  mkdirSync(EVIDENCE_DIR, { recursive: true });
  writeFileSync(EVIDENCE_PATH, `${JSON.stringify(jsonSafe(next), null, 2)}\n`, "utf8");
}

function mergeEvidence(patch) {
  writeEvidence({
    ...readEvidence(),
    network: "studionet",
    chainId: studionet.id,
    rpc: RPC_URL,
    explorer: EXPLORER_URL,
    sourceCommit: sourceCommit(),
    contractSha256: contractHash(),
    updatedAt: new Date().toISOString(),
    ...patch,
  });
}

function signingClient(privateKey) {
  const account = createAccount(privateKey);
  const client = createClient({ chain: studionet, endpoint: RPC_URL, account });
  return { account, client };
}

function publicClient() {
  return createClient({ chain: studionet, endpoint: RPC_URL });
}

async function assertStudionet(client) {
  const chainHex = await client.request({ method: "eth_chainId", params: [] });
  const chainId = Number(BigInt(chainHex));
  if (chainId !== studionet.id) {
    throw new Error(`Connected chain ${chainId} is not Studionet ${studionet.id}`);
  }
  return chainId;
}

function executionName(receipt) {
  const normalized = receipt?.txExecutionResultName ?? receipt?.execution_result ?? receipt?.executionResultName;
  if (normalized) return normalized;
  const leader = Array.isArray(receipt?.consensus_data?.leader_receipt)
    ? receipt.consensus_data.leader_receipt[0]
    : receipt?.consensus_data?.leader_receipt;
  if (leader?.execution_result === "SUCCESS") return "FINISHED_WITH_RETURN";
  if (typeof leader?.execution_result === "string") return "FINISHED_WITH_ERROR";
  return "UNKNOWN";
}

function contractAddressFromReceipt(receipt) {
  return (
    receipt?.txDataDecoded?.contractAddress ??
    receipt?.tx_data_decoded?.contract_address ??
    receipt?.data?.contract_address ??
    receipt?.data?.contractAddress ??
    receipt?.contract_address ??
    null
  );
}

async function waitForNetworkFinality(client, hash, retries = 240) {
  for (let attempt = 0; attempt < retries; attempt += 1) {
    const status = await client.request({ method: "gen_getTransactionStatus", params: [hash] });
    if (status === "FINALIZED") return status;
    if (TERMINAL_FAILURES.has(status)) throw new Error(`Transaction ${hash} reached ${status}`);
    await new Promise((resolve) => setTimeout(resolve, 5000));
  }
  throw new Error(`Transaction ${hash} did not finalize before timeout`);
}

async function waitForReceipt(client, hash, operation) {
  const accepted = await client.waitForTransactionReceipt({
    hash,
    status: TransactionStatus.ACCEPTED,
    interval: 5000,
    retries: 120,
  });
  const networkStatus = await waitForNetworkFinality(client, hash);
  const execution = executionName(accepted);
  if (networkStatus !== "FINALIZED") throw new Error(`${operation} did not finalize`);
  if (execution !== "FINISHED_WITH_RETURN" && execution !== "SUCCESS") {
    throw new Error(`${operation} failed with ${execution}`);
  }
  return { ...accepted, networkStatus, execution };
}

function txRecord(hash, receipt) {
  return {
    transactionHash: hash,
    status: receipt.networkStatus,
    execution: receipt.execution,
    finalizedAt: new Date().toISOString(),
  };
}

async function deploy() {
  const evidence = readEvidence();
  if (
    evidence.primary?.status === "FINALIZED" &&
    evidence.sourceCommit === sourceCommit() &&
    evidence.contractSha256 === contractHash()
  ) {
    console.log(JSON.stringify({ action: "deploy", status: "SKIPPED", contractAddress: evidence.primary.contractAddress }, null, 2));
    return evidence.primary.contractAddress;
  }
  const supersededRevisions = [...(evidence.supersededRevisions ?? [])];
  if (evidence.primary?.status === "FINALIZED") {
    supersededRevisions.push({
      sourceCommit: evidence.sourceCommit ?? null,
      contractSha256: evidence.contractSha256 ?? null,
      primary: evidence.primary,
      demo: evidence.demo ?? null,
      status: "SUPERSEDED_BY_SOURCE_CHANGE",
      supersededAt: new Date().toISOString(),
    });
  }
  const { account, client } = signingClient(requirePrivateKey(PRIMARY_KEY_VARIABLES));
  await assertStudionet(client);
  const code = new Uint8Array(readFileSync(CONTRACT_PATH));
  const hash = await client.deployContract({ code, args: [] });
  mergeEvidence({
    wallets: { ...(evidence.wallets ?? {}), sponsorAddress: account.address },
    primary: { transactionHash: hash, status: "SUBMITTED", submittedAt: new Date().toISOString() },
  });
  console.log(JSON.stringify({ action: "deploy", status: "SUBMITTED", transactionHash: hash }, null, 2));
  const receipt = await waitForReceipt(client, hash, "deploy DisclosureDividend");
  const contractAddress = contractAddressFromReceipt(receipt);
  if (!/^0x[0-9a-fA-F]{40}$/.test(contractAddress ?? "")) throw new Error("Contract address missing from deploy receipt");
  const primary = { contractAddress, ...txRecord(hash, receipt) };
  mergeEvidence({
    wallets: { ...(evidence.wallets ?? {}), sponsorAddress: account.address },
    primary,
    supersededRevisions,
    demo: null,
    status: "DEPLOYED",
  });
  console.log(JSON.stringify({ action: "deploy", status: "FINALIZED", contractAddress }, null, 2));
  return contractAddress;
}

async function writeFinalized(client, address, functionName, args, value = 0n, existing) {
  if (existing?.status === "FINALIZED") return existing;
  const hash = await client.writeContract({ address, functionName, args, value });
  console.log(JSON.stringify({ action: functionName, status: "SUBMITTED", transactionHash: hash }, null, 2));
  const receipt = await waitForReceipt(client, hash, functionName);
  return txRecord(hash, receipt);
}

async function readView(client, address, functionName, args = []) {
  return jsonSafe(await client.readContract({ address, functionName, args, jsonSafeReturn: true }));
}

function commitmentFor(poolId, claimant, reportUrl, salt) {
  const reportHash = createHash("sha256").update(reportUrl).digest("hex");
  const payload = ["DISCLOSURE_DIVIDEND_V1", poolId, claimant.toLowerCase(), reportHash, salt].join("|");
  return createHash("sha256").update(payload).digest("hex");
}

function utcTimestamp(offsetMs) {
  return new Date(Date.now() + offsetMs).toISOString().replace(/\.\d{3}Z$/, "Z");
}

async function sleepUntil(timestamp) {
  const delay = Math.max(0, new Date(timestamp).getTime() - Date.now() + 2000);
  if (delay > 0) await new Promise((resolve) => setTimeout(resolve, delay));
}

async function demo() {
  const contractAddress = await deploy();
  const evidence = readEvidence();
  const sponsor = signingClient(requirePrivateKey(PRIMARY_KEY_VARIABLES));
  const claimant = signingClient(requirePrivateKey(CLAIMANT_KEY_VARIABLES));
  if (sponsor.account.address.toLowerCase() === claimant.account.address.toLowerCase()) {
    throw new Error("Sponsor and claimant wallets must differ");
  }
  await assertStudionet(sponsor.client);
  await assertStudionet(claimant.client);

  const repoRawBase = ENV.PUBLIC_RAW_BASE?.trim();
  if (!repoRawBase) {
    throw new Error("Set PUBLIC_RAW_BASE to the pushed raw GitHub base URL before running lifecycle demo");
  }

  let reusableDemo = evidence.demo ?? null;
  if (reusableDemo?.status !== "FINALIZED_LIFECYCLE" && reusableDemo?.poolId) {
    const pool = await readView(sponsor.client, contractAddress, "get_pool", [reusableDemo.poolId]);
    const revealDeadline = new Date(pool.reveal_deadline ?? 0).getTime();
    const stale =
      pool.status === "RETRYABLE" ||
      pool.status === "CANCELLED" ||
      pool.status === "DISTRIBUTED" ||
      (pool.status === "REVEAL_OPEN" && Number.isFinite(revealDeadline) && revealDeadline <= Date.now());
    if (stale) {
      const failedDemos = [...(evidence.failedDemos ?? [])];
      failedDemos.push({
        ...reusableDemo,
        archivedAt: new Date().toISOString(),
        archivedReason: `stale_${String(pool.status).toLowerCase()}`,
        finalObservedPool: pool,
      });
      mergeEvidence({ failedDemos, demo: null });
      reusableDemo = null;
    }
  }

  const demoState = {
    poolId: reusableDemo?.poolId ?? `node-tmp-${Date.now().toString(36)}`,
    reportUrl: `${repoRawBase.replace(/\/$/, "")}/docs/evidence/public-fixtures/node-tmp-report.md`,
    salt: reusableDemo?.salt ?? `salt-${Date.now().toString(36)}`,
    commitDeadline: reusableDemo?.commitDeadline ?? utcTimestamp(DEMO_COMMIT_WINDOW_MS),
    revealDeadline: reusableDemo?.revealDeadline ?? utcTimestamp(DEMO_REVEAL_WINDOW_MS),
    transactions: { ...(reusableDemo?.transactions ?? {}) },
  };
  const persist = () =>
    mergeEvidence({
      wallets: {
        ...(readEvidence().wallets ?? {}),
        sponsorAddress: sponsor.account.address,
        claimantAddress: claimant.account.address,
      },
      demo: demoState,
    });

  persist();
  const commitment = commitmentFor(demoState.poolId, claimant.account.address, demoState.reportUrl, demoState.salt);
  demoState.commitment = commitment;

  demoState.transactions.createPool = await writeFinalized(
    sponsor.client,
    contractAddress,
    "create_pool",
    [
      demoState.poolId,
      "https://github.com/raszi/node-tmp",
      "npm:tmp",
      "20,30,40,10",
      6,
      demoState.commitDeadline,
      demoState.revealDeadline,
      25n,
    ],
    1000n,
    demoState.transactions.createPool,
  );
  persist();

  demoState.transactions.commitClaim = await writeFinalized(
    claimant.client,
    contractAddress,
    "commit_claim",
    [demoState.poolId, commitment],
    25n,
    demoState.transactions.commitClaim,
  );
  persist();

  await sleepUntil(demoState.commitDeadline);
  demoState.transactions.closeCommit = await writeFinalized(
    sponsor.client,
    contractAddress,
    "close_commit_window",
    [demoState.poolId],
    0n,
    demoState.transactions.closeCommit,
  );
  persist();

  demoState.transactions.proposeDisclosure = await writeFinalized(
    sponsor.client,
    contractAddress,
    "propose_disclosure",
    [demoState.poolId, "GHSA-ph9p-34f9-6g65", "global:github-advisories-2026-08-05", "efa4a06f24374797ae32ab2b6ae39b7a611ae429"],
    0n,
    demoState.transactions.proposeDisclosure,
  );
  persist();

  demoState.transactions.verifyDisclosure = await writeFinalized(
    sponsor.client,
    contractAddress,
    "verify_disclosure",
    [demoState.poolId],
    0n,
    demoState.transactions.verifyDisclosure,
  );
  persist();

  demoState.transactions.revealClaim = await writeFinalized(
    claimant.client,
    contractAddress,
    "reveal_claim",
    [demoState.poolId, demoState.reportUrl, demoState.salt],
    0n,
    demoState.transactions.revealClaim,
  );
  persist();

  await sleepUntil(demoState.revealDeadline);
  demoState.transactions.closeReveal = await writeFinalized(
    sponsor.client,
    contractAddress,
    "close_reveal_window",
    [demoState.poolId],
    0n,
    demoState.transactions.closeReveal,
  );
  persist();

  demoState.transactions.adjudicate = await writeFinalized(
    sponsor.client,
    contractAddress,
    "adjudicate_pool",
    [demoState.poolId],
    0n,
    demoState.transactions.adjudicate,
  );
  persist();

  const credit = await readView(sponsor.client, contractAddress, "get_credit", [claimant.account.address]);
  if (BigInt(credit) > 0n) {
    demoState.transactions.withdrawCredit = await writeFinalized(
      claimant.client,
      contractAddress,
      "withdraw_credit",
      [BigInt(credit)],
      0n,
      demoState.transactions.withdrawCredit,
    );
    persist();
  }

  demoState.finalReads = {
    pool: await readView(sponsor.client, contractAddress, "get_pool", [demoState.poolId]),
    claim: await readView(sponsor.client, contractAddress, "get_claim", [demoState.poolId, claimant.account.address]),
    claimantCreditWei: await readView(sponsor.client, contractAddress, "get_credit", [claimant.account.address]),
    summary: await readView(sponsor.client, contractAddress, "get_contract_summary", []),
  };
  demoState.status = "FINALIZED_LIFECYCLE";
  persist();
  console.log(JSON.stringify({ action: "demo", status: demoState.status, finalReads: demoState.finalReads }, null, 2));
}

async function recoverCredit(client, address, accountAddress, existing) {
  if (existing?.status === "FINALIZED") return existing;
  const credit = await readView(client, address, "get_credit", [accountAddress]);
  if (BigInt(credit) === 0n) return { status: "SKIPPED_ZERO_CREDIT", creditWei: "0" };
  return writeFinalized(client, address, "withdraw_credit", [BigInt(credit)], 0n, existing);
}

async function recoverRevision(revision, label, sponsor, claimant) {
  const address = revision.primary?.contractAddress;
  const demoState = revision.demo;
  if (!address || !demoState?.poolId) return { label, status: "SKIPPED_NO_DEMO" };
  const recovery = { ...(demoState.recovery ?? {}), label, updatedAt: new Date().toISOString() };
  const pool = await readView(sponsor.client, address, "get_pool", [demoState.poolId]);
  recovery.initialPool = pool;
  if (pool.status !== "CANCELLED" && pool.status !== "DISTRIBUTED") {
    try {
      recovery.cancelPool = await writeFinalized(
        sponsor.client,
        address,
        "cancel_pool",
        [demoState.poolId],
        0n,
        recovery.cancelPool,
      );
    } catch (error) {
      recovery.cancelPool = { status: "FAILED", message: error instanceof Error ? error.message : String(error) };
    }
  }
  try {
    recovery.sponsorWithdraw = await recoverCredit(
      sponsor.client,
      address,
      sponsor.account.address,
      recovery.sponsorWithdraw,
    );
  } catch (error) {
    recovery.sponsorWithdraw = { status: "FAILED", message: error instanceof Error ? error.message : String(error) };
  }
  try {
    recovery.claimantWithdraw = await recoverCredit(
      claimant.client,
      address,
      claimant.account.address,
      recovery.claimantWithdraw,
    );
  } catch (error) {
    recovery.claimantWithdraw = { status: "FAILED", message: error instanceof Error ? error.message : String(error) };
  }
  recovery.finalReads = {
    pool: await readView(sponsor.client, address, "get_pool", [demoState.poolId]),
    sponsorCreditWei: await readView(sponsor.client, address, "get_credit", [sponsor.account.address]),
    claimantCreditWei: await readView(sponsor.client, address, "get_credit", [claimant.account.address]),
    summary: await readView(sponsor.client, address, "get_contract_summary", []),
  };
  recovery.status = "RECOVERED_OR_DOCUMENTED";
  return recovery;
}

async function recover() {
  const evidence = readEvidence();
  const sponsor = signingClient(requirePrivateKey(PRIMARY_KEY_VARIABLES));
  const claimant = signingClient(requirePrivateKey(CLAIMANT_KEY_VARIABLES));
  await assertStudionet(sponsor.client);
  await assertStudionet(claimant.client);

  if (evidence.demo) {
    evidence.demo.recovery = await recoverRevision(evidence, "primary", sponsor, claimant);
  }
  const superseded = [...(evidence.supersededRevisions ?? [])];
  for (let index = 0; index < superseded.length; index += 1) {
    if (superseded[index].demo) {
      superseded[index].demo.recovery = await recoverRevision(superseded[index], `superseded-${index + 1}`, sponsor, claimant);
    }
  }
  evidence.supersededRevisions = superseded;
  evidence.updatedAt = new Date().toISOString();
  writeEvidence(evidence);
  console.log(JSON.stringify({ action: "recover", status: "RECOVERED_OR_DOCUMENTED" }, null, 2));
}

async function inspect() {
  const client = publicClient();
  await assertStudionet(client);
  const evidence = readEvidence();
  const address = evidence.primary?.contractAddress;
  const report = {
    network: "studionet",
    chainId: studionet.id,
    sourceCommit: evidence.sourceCommit ?? null,
    contractAddress: address ?? null,
    status: evidence.status ?? "PENDING_REAL_EVIDENCE",
    demoStatus: evidence.demo?.status ?? "PENDING_REAL_EVIDENCE",
    reads: {},
  };
  if (address && evidence.demo?.poolId) {
    report.reads.pool = await readView(client, address, "get_pool", [evidence.demo.poolId]);
    report.reads.summary = await readView(client, address, "get_contract_summary", []);
  }
  console.log(JSON.stringify(report, null, 2));
}

const command = process.argv[2] ?? "inspect";
if (command === "deploy") await deploy();
else if (command === "demo") await demo();
else if (command === "inspect") await inspect();
else if (command === "recover") await recover();
else throw new Error(`Unknown command: ${command}`);
