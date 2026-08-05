import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import App from "./App";
import { __resetWalletDiscoveryForTests } from "./genlayerClient";

const genlayerMocks = vi.hoisted(() => ({
  connect: vi.fn().mockResolvedValue(undefined),
  readContract: vi.fn().mockResolvedValue([]),
  waitForTransactionReceipt: vi.fn().mockResolvedValue({}),
  writeContract: vi.fn().mockResolvedValue("0xhash"),
}));

vi.mock("genlayer-js", () => ({
  createClient: vi.fn(() => ({
    connect: genlayerMocks.connect,
    readContract: genlayerMocks.readContract,
    waitForTransactionReceipt: genlayerMocks.waitForTransactionReceipt,
    writeContract: genlayerMocks.writeContract,
  })),
}));

type TestProvider = {
  isMetaMask?: boolean;
  isOkxWallet?: boolean;
  isRabby?: boolean;
  request: ReturnType<typeof vi.fn>;
};

let eipRequestController: AbortController;

function provider(accounts: string[], balance = "0x2a", flags: Partial<TestProvider> = {}): TestProvider {
  return {
    ...flags,
    request: vi.fn(async ({ method }: { method: string }) => {
      if (method === "eth_requestAccounts" || method === "eth_accounts") return accounts;
      if (method === "eth_getBalance") return balance;
      if (method === "eth_chainId") return "0xf22f";
      return null;
    }),
  };
}

function chainSwitchingProvider(accounts: string[], initialChainId = "0x1", flags: Partial<TestProvider> = {}): TestProvider {
  let chainId = initialChainId;
  return {
    ...flags,
    request: vi.fn(async ({ method, params }: { method: string; params?: unknown[] }) => {
      if (method === "eth_requestAccounts" || method === "eth_accounts") return accounts;
      if (method === "eth_getBalance") return "0x2a";
      if (method === "eth_chainId") return chainId;
      if (method === "wallet_addEthereumChain") {
        const [config] = params ?? [];
        chainId = String((config as { chainId?: string } | undefined)?.chainId ?? chainId);
        return null;
      }
      if (method === "wallet_switchEthereumChain") {
        const [config] = params ?? [];
        chainId = String((config as { chainId?: string } | undefined)?.chainId ?? chainId);
        return null;
      }
      return null;
    }),
  };
}

function unknownChainProvider(accounts: string[], flags: Partial<TestProvider> = {}): TestProvider {
  let added = false;
  return {
    ...flags,
    request: vi.fn(async ({ method, params }: { method: string; params?: unknown[] }) => {
      if (method === "eth_requestAccounts" || method === "eth_accounts") return accounts;
      if (method === "eth_getBalance") return "0x2a";
      if (method === "eth_chainId") return "0x1";
      if (method === "wallet_addEthereumChain") {
        added = true;
        return null;
      }
      if (method === "wallet_switchEthereumChain") {
        if (!added) {
          const error = new Error("Unrecognized chain") as Error & { code: number };
          error.code = 4902;
          throw error;
        }
        return params;
      }
      return null;
    }),
  };
}

function contractPool(status: string, poolId = "node-tmp") {
  return {
    pool_id: poolId,
    sponsor: "0x0000000000000000000000000000000000000000",
    target_repository: "https://github.com/raszi/node-tmp",
    target_package: "npm:tmp",
    role_weights_csv: "20,30,40,10",
    claim_limit: "1",
    commit_deadline: "2026-08-06T12:00:00Z",
    reveal_deadline: "2026-08-07T12:00:00Z",
    reservation_bond_wei: "25",
    reward_wei: "1000",
    status,
    ghsa_id: "GHSA-ph9p-34f9-6g65",
    advisory_database_commit: "abc",
    patch_commit: "def",
    claim_count: "1",
    revealed_count: status === "COMMIT_OPEN" ? "0" : "1",
    attempt_count: status === "COMMIT_OPEN" ? "0" : "1",
    distributed: status === "DISTRIBUTED",
  };
}

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
  genlayerMocks.connect.mockResolvedValue(undefined);
  genlayerMocks.readContract.mockResolvedValue([]);
  genlayerMocks.waitForTransactionReceipt.mockResolvedValue({});
  genlayerMocks.writeContract.mockResolvedValue("0xhash");
  __resetWalletDiscoveryForTests();
  eipRequestController = new AbortController();
  window.location.hash = "";
  Reflect.deleteProperty(window, "ethereum");
});

afterEach(() => {
  eipRequestController.abort();
});

function onEip6963Request(listener: () => void) {
  window.addEventListener("eip6963:requestProvider", listener, { signal: eipRequestController.signal });
}

test("renders the returned explorer layout without fake aggregate stats", () => {
  render(<App />);

  expect(screen.getByRole("heading", { name: /Disclosure Dividend/i })).toBeInTheDocument();
  expect(screen.getByRole("link", { name: /Explorer/i })).toHaveAttribute("href", "#/");
  expect(screen.getByRole("link", { name: /My Claims/i })).toHaveAttribute("href", "#/account");
  expect(screen.getByRole("button", { name: /Connect Wallet/i })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /Create Pool/i })).toBeInTheDocument();
  expect(screen.queryByText(/Total Value Locked/i)).not.toBeInTheDocument();
  expect(screen.queryByText(/Avg Resolution/i)).not.toBeInTheDocument();
});

test("shows missing contract address as integration pending instead of live data", () => {
  render(<App />);

  if (import.meta.env.VITE_CONTRACT_ADDRESS) {
    expect(screen.getByText(/Reading Studionet/i)).toBeInTheDocument();
    expect(screen.getByText(/Loading canonical pool state/i)).toBeInTheDocument();
  } else {
    expect(screen.getByText(/Integration pending/i)).toBeInTheDocument();
    expect(screen.getByText(/No contract address is configured/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Design data/i).length).toBeGreaterThan(0);
  }
});

test("configured contract loading does not show design pool cards as live content", () => {
  if (!import.meta.env.VITE_CONTRACT_ADDRESS) return;
  genlayerMocks.readContract.mockImplementation(() => new Promise(() => undefined));

  render(<App />);

  expect(screen.getByText(/Reading Studionet/i)).toBeInTheDocument();
  expect(screen.queryByText(/Path traversal vulnerability/i)).not.toBeInTheDocument();
  expect(screen.queryByRole("link", { name: /View Details for node-tmp/i })).not.toBeInTheDocument();
});

test("pool workspace exposes one legal primary action and hides system controls", async () => {
  if (import.meta.env.VITE_CONTRACT_ADDRESS) {
    genlayerMocks.readContract.mockImplementation(async ({ functionName, args }) => {
      if (functionName === "get_pool_ids") return ["node-tmp"];
      if (functionName === "get_pool" && args?.[0] === "node-tmp") return contractPool("COMMIT_OPEN");
      return [];
    });
    window.location.hash = "#/pools/node-tmp";
  }
  render(<App />);
  if (!import.meta.env.VITE_CONTRACT_ADDRESS) {
    await userEvent.click(screen.getByRole("link", { name: /View Details for node-tmp/i }));
  }

  expect(await screen.findByRole("heading", { name: /node-tmp/i })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /Seal My Report/i })).toBeDisabled();
  expect(screen.queryByText(/Estimated Gas/i)).not.toBeInTheDocument();
  expect(screen.queryByText(/Governance/i)).not.toBeInTheDocument();
  expect(screen.queryByText(/Security Audit/i)).not.toBeInTheDocument();
  expect(screen.queryByText(/Committee Review/i)).not.toBeInTheDocument();
});

test("distributed live pool does not expose a seal transaction action", async () => {
  if (!import.meta.env.VITE_CONTRACT_ADDRESS) return;
  genlayerMocks.readContract.mockImplementation(async ({ functionName, args }) => {
    if (functionName === "get_pool_ids") return ["distributed-pool"];
    if (functionName === "get_pool" && args?.[0] === "distributed-pool") {
      return contractPool("DISTRIBUTED", "distributed-pool");
    }
    return [];
  });
  const metamask = provider(["0x7777777777777777777777777777777777777777"], "0x70", { isMetaMask: true });
  Object.defineProperty(window, "ethereum", {
    configurable: true,
    value: { providers: [metamask], request: vi.fn() },
  });
  localStorage.setItem("disclosureDividend.walletId", "metamask");
  localStorage.setItem("disclosureDividend.walletAccount", "0x7777777777777777777777777777777777777777");

  window.location.hash = "#/pools/distributed-pool";
  render(<App />);

  expect(await screen.findByRole("heading", { name: /distributed-pool/i })).toBeInTheDocument();
  expect(screen.queryByPlaceholderText(/64-character sha256 digest/i)).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: /^Seal My Report$/i })).not.toBeInTheDocument();
  expect(screen.getAllByText(/Reward split finalized/i).length).toBeGreaterThan(0);
});

test("account screen uses GEN credits and user-owned actions", async () => {
  render(<App />);
  await userEvent.click(screen.getByRole("link", { name: /My Claims/i }));

  expect(screen.getByRole("heading", { name: /My Claims & Credits/i })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /Withdraw Credit/i })).toBeInTheDocument();
  expect(screen.queryByText(/DDP/i)).not.toBeInTheDocument();
  expect(screen.queryByText(/USD/i)).not.toBeInTheDocument();
  expect(screen.queryByText(/Manage Evidence/i)).not.toBeInTheDocument();
});

test("account screen does not label a configured deployment as pending when wallet is disconnected", async () => {
  if (!import.meta.env.VITE_CONTRACT_ADDRESS) return;

  render(<App />);
  await userEvent.click(screen.getByRole("link", { name: /My Claims/i }));

  expect(screen.getByText(/Connect a browser wallet to read your canonical claim history/i)).toBeInTheDocument();
  expect(screen.getByText(/Using configured Studionet contract views/i)).toBeInTheDocument();
  expect(screen.queryByText(/Studionet project evidence remains pending until deployment/i)).not.toBeInTheDocument();
});

test("account with zero canonical credit cannot submit a withdrawal", async () => {
  if (!import.meta.env.VITE_CONTRACT_ADDRESS) return;
  genlayerMocks.readContract.mockImplementation(async ({ functionName }) => {
    if (functionName === "get_credit") return "0";
    if (functionName === "get_account_pool_ids") return [];
    return [];
  });
  const metamask = provider(["0x8888888888888888888888888888888888888888"], "0x80", { isMetaMask: true });
  Object.defineProperty(window, "ethereum", {
    configurable: true,
    value: { providers: [metamask], request: vi.fn() },
  });
  localStorage.setItem("disclosureDividend.walletId", "metamask");
  localStorage.setItem("disclosureDividend.walletAccount", "0x8888888888888888888888888888888888888888");

  window.location.hash = "#/account";
  render(<App />);

  expect((await screen.findAllByText(/0 GEN/i)).length).toBeGreaterThan(0);
  expect(screen.getByRole("button", { name: /Withdraw Credit/i })).toBeDisabled();
});

test("withdraw amount is entered as GEN and submitted to the contract as wei", async () => {
  if (!import.meta.env.VITE_CONTRACT_ADDRESS) return;
  genlayerMocks.readContract.mockImplementation(async ({ functionName }) => {
    if (functionName === "get_credit") return "1000";
    if (functionName === "get_account_pool_ids") return [];
    return [];
  });
  const metamask = provider(["0x8888888888888888888888888888888888888888"], "0x80", { isMetaMask: true });
  Object.defineProperty(window, "ethereum", {
    configurable: true,
    value: { providers: [metamask], request: vi.fn() },
  });
  localStorage.setItem("disclosureDividend.walletId", "metamask");
  localStorage.setItem("disclosureDividend.walletAccount", "0x8888888888888888888888888888888888888888");

  window.location.hash = "#/account";
  render(<App />);

  await screen.findByText(/0\.000000000000001 GEN/i);
  await userEvent.type(screen.getByLabelText(/Withdraw amount \(GEN\)/i), "0.000000000000001");
  await userEvent.click(screen.getByRole("button", { name: /Withdraw Credit/i }));

  await waitFor(() =>
    expect(genlayerMocks.writeContract).toHaveBeenCalledWith(
      expect.objectContaining({
        functionName: "withdraw_credit",
        args: [1000n],
      }),
    ),
  );
});

test("create pool keeps policy editor layout with real v1 fields", async () => {
  render(<App />);
  await userEvent.click(screen.getByRole("button", { name: /Create Pool/i }));

  expect(screen.getByRole("heading", { name: /Create Pool Policy/i })).toBeInTheDocument();
  expect(screen.getByLabelText(/Target repository/i)).toBeInTheDocument();
  expect(screen.getByLabelText(/Reward amount \(GEN\)/i)).toBeInTheDocument();
  expect(screen.getByLabelText(/Claim limit/i)).toBeInTheDocument();
  expect(screen.getByLabelText(/Commit deadline/i)).toBeInTheDocument();
  expect(screen.getByLabelText(/Reveal deadline/i)).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /Create and Fund Pool/i })).toBeInTheDocument();
  expect(screen.getByText("2 GEN")).toBeInTheDocument();
  expect(screen.getByText("1 GEN")).toBeInTheDocument();
  expect(screen.queryByText(/APY/i)).not.toBeInTheDocument();
  expect(screen.queryByText(/multi-sig/i)).not.toBeInTheDocument();
});

test("create pool amount is entered as GEN and submitted to the contract as wei", async () => {
  if (!import.meta.env.VITE_CONTRACT_ADDRESS) return;
  const metamask = provider(["0x7777777777777777777777777777777777777777"], "0x70", { isMetaMask: true });
  Object.defineProperty(window, "ethereum", {
    configurable: true,
    value: { providers: [metamask], request: vi.fn() },
  });
  localStorage.setItem("disclosureDividend.walletId", "metamask");
  localStorage.setItem("disclosureDividend.walletAccount", "0x7777777777777777777777777777777777777777");

  window.location.hash = "#/create";
  render(<App />);

  const rewardInput = await screen.findByLabelText(/Reward amount \(GEN\)/i);
  await userEvent.clear(rewardInput);
  await userEvent.type(rewardInput, "0.000000000000001");
  await userEvent.click(screen.getByRole("button", { name: /Create and Fund Pool/i }));

  await waitFor(() =>
    expect(genlayerMocks.writeContract).toHaveBeenCalledWith(
      expect.objectContaining({
        functionName: "create_pool",
        args: expect.arrayContaining([1000000000000000000n]),
        value: 1000n,
      }),
    ),
  );
});

test("finalized split keeps technical details contextual", async () => {
  if (import.meta.env.VITE_CONTRACT_ADDRESS) {
    genlayerMocks.readContract.mockImplementation(async ({ functionName, args }) => {
      if (functionName === "get_pool_ids") return ["node-tmp"];
      if (functionName === "get_pool" && args?.[0] === "node-tmp") return contractPool("DISTRIBUTED");
      return [];
    });
    window.location.hash = "#/pools/node-tmp";
  }
  render(<App />);
  if (!import.meta.env.VITE_CONTRACT_ADDRESS) {
    await userEvent.click(screen.getByRole("link", { name: /View Details for node-tmp/i }));
  }

  const disclosure = await screen.findByRole("button", { name: /Technical Details/i });
  expect(disclosure).toBeInTheDocument();
  expect(screen.queryByText(/validator identities/i)).not.toBeInTheDocument();
  expect(screen.queryByText(/attempt id/i)).not.toBeInTheDocument();

  await userEvent.click(disclosure);
  const region = screen.getByRole("region", { name: /Technical Details/i });
  expect(within(region).getByText(/GitHub advisory/i)).toBeInTheDocument();
  expect(within(region).getByText(/Explorer/i)).toBeInTheDocument();
});

test("connect wallet opens a provider picker and connects the chosen extension", async () => {
  const metamask = provider(["0x1111111111111111111111111111111111111111"], "0x10", { isMetaMask: true });
  const rabby = provider(["0x2222222222222222222222222222222222222222"], "0x20", { isRabby: true });
  Object.defineProperty(window, "ethereum", {
    configurable: true,
    value: { providers: [metamask, rabby], request: vi.fn() },
  });

  render(<App />);
  await userEvent.click(screen.getByRole("button", { name: /Connect Wallet/i }));

  const dialog = await screen.findByRole("dialog", { name: /Choose wallet/i });
  expect(within(dialog).getByRole("button", { name: /MetaMask/i })).toBeInTheDocument();
  await userEvent.click(within(dialog).getByRole("button", { name: /Rabby/i }));

  await waitFor(() => expect(rabby.request).toHaveBeenCalledWith({ method: "eth_requestAccounts" }));
  expect(await screen.findByRole("button", { name: /0x2222...2222/i })).toBeInTheDocument();
});

test("wallet picker prefers announced providers over a legacy provider hijacked by another wallet", async () => {
  const phantom = provider(["0x9999999999999999999999999999999999999999"], "0x90");
  const metamask = provider(["0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"], "0xa0", { isMetaMask: true });
  const rabby = provider(["0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"], "0xb0", { isRabby: true });
  Object.defineProperty(window, "ethereum", {
    configurable: true,
    value: phantom,
  });
  onEip6963Request(() => {
    window.setTimeout(() => {
      window.dispatchEvent(
        new CustomEvent("eip6963:announceProvider", {
          detail: {
            info: { name: "MetaMask", rdns: "io.metamask" },
            provider: metamask,
          },
        }),
      );
      window.dispatchEvent(
        new CustomEvent("eip6963:announceProvider", {
          detail: {
            info: { name: "Rabby", rdns: "io.rabby" },
            provider: rabby,
          },
        }),
      );
    }, 0);
  });

  render(<App />);
  await userEvent.click(screen.getByRole("button", { name: /Connect Wallet/i }));
  await userEvent.click(await screen.findByRole("button", { name: /MetaMask/i }));

  await waitFor(() => expect(metamask.request).toHaveBeenCalledWith({ method: "eth_requestAccounts" }));
  expect(phantom.request).not.toHaveBeenCalledWith({ method: "eth_requestAccounts" });
  expect(await screen.findByRole("button", { name: /0xaaaa...aaaa/i })).toBeInTheDocument();
});

test("choosing OKX uses the provider object from the visible picker without rediscovering Phantom", async () => {
  const phantom = provider(["0x9999999999999999999999999999999999999999"], "0x90");
  const okx = provider(["0x5555555555555555555555555555555555555555"], "0x50");
  Object.defineProperty(window, "ethereum", {
    configurable: true,
    value: phantom,
  });
  let announced = false;
  onEip6963Request(() => {
    if (announced) return;
    announced = true;
    window.setTimeout(() => {
      window.dispatchEvent(
        new CustomEvent("eip6963:announceProvider", {
          detail: {
            info: { name: "OKX Wallet", rdns: "com.okx.wallet" },
            provider: okx,
          },
        }),
      );
    }, 0);
  });

  render(<App />);
  await userEvent.click(screen.getByRole("button", { name: /Connect Wallet/i }));
  await userEvent.click(await screen.findByRole("button", { name: /OKX Wallet/i }));

  await waitFor(() => expect(okx.request).toHaveBeenCalledWith({ method: "eth_requestAccounts" }));
  expect(phantom.request).not.toHaveBeenCalledWith({ method: "eth_requestAccounts" });
  expect(await screen.findByRole("button", { name: /0x5555...5555/i })).toBeInTheDocument();
});

test("wallet picker closes when the user clicks outside it", async () => {
  const metamask = provider(["0x1111111111111111111111111111111111111111"], "0x10", { isMetaMask: true });
  Object.defineProperty(window, "ethereum", {
    configurable: true,
    value: { providers: [metamask], request: vi.fn() },
  });

  render(<App />);
  await userEvent.click(screen.getByRole("button", { name: /Connect Wallet/i }));

  expect(await screen.findByRole("dialog", { name: /Choose wallet/i })).toBeInTheDocument();
  await userEvent.click(document.body);

  await waitFor(() => expect(screen.queryByRole("dialog", { name: /Choose wallet/i })).not.toBeInTheDocument());
});

test("wallet popover is rendered as a viewport layer above page content", () => {
  const css = readFileSync(join(__dirname, "index.css"), "utf8");
  const walletPopoverRule = css.match(/\.wallet-popover\s*\{(?<body>[^}]+)\}/)?.groups?.body ?? "";
  const walletGlassRule = css.match(/\.wallet-popover\.glass\s*\{(?<body>[^}]+)\}/)?.groups?.body ?? "";
  const zIndex = Number(walletPopoverRule.match(/z-index:\s*(\d+)/)?.[1] ?? "0");

  expect(walletPopoverRule).toContain("position: fixed");
  expect(zIndex).toBeGreaterThanOrEqual(1000);
  expect(walletGlassRule).toContain("rgba(11, 15, 20, 0.96)");
  expect(walletGlassRule).toContain("blur(56px)");
});

test("token amounts display GenLayer native token units instead of wei", async () => {
  if (!import.meta.env.VITE_CONTRACT_ADDRESS) return;
  genlayerMocks.readContract.mockImplementation(async ({ functionName, args }) => {
    if (functionName === "get_pool_ids") return ["node-tmp"];
    if (functionName === "get_pool" && args?.[0] === "node-tmp") return contractPool("COMMIT_OPEN");
    return [];
  });
  window.location.hash = "#/pools/node-tmp";

  render(<App />);

  expect((await screen.findAllByText(/0\.000000000000001 GEN/)).length).toBeGreaterThan(0);
  expect(screen.getByDisplayValue("0.000000000000000025 GEN")).toBeInTheDocument();
  expect(screen.queryByText(/1000 wei/i)).not.toBeInTheDocument();
});

test("connect wallet switches the selected provider to Studionet before marking it connected", async () => {
  const phantom = chainSwitchingProvider(["0x9999999999999999999999999999999999999999"], "0x1");
  const okx = chainSwitchingProvider(["0x5555555555555555555555555555555555555555"], "0x1", { isOkxWallet: true });
  Object.defineProperty(window, "ethereum", {
    configurable: true,
    value: phantom,
  });
  Object.defineProperty(window, "okxwallet", {
    configurable: true,
    value: okx,
  });

  render(<App />);
  await userEvent.click(screen.getByRole("button", { name: /Connect Wallet/i }));
  await userEvent.click(await screen.findByRole("button", { name: /OKX Wallet/i }));

  await waitFor(() => expect(okx.request).toHaveBeenCalledWith({ method: "eth_chainId" }));
  expect(okx.request).toHaveBeenCalledWith({ method: "wallet_switchEthereumChain", params: [{ chainId: "0xf22f" }] });
  expect(okx.request).not.toHaveBeenCalledWith(expect.objectContaining({ method: "wallet_addEthereumChain" }));
  expect(phantom.request).not.toHaveBeenCalled();
  expect(await screen.findByRole("button", { name: /0x5555...5555/i })).toBeInTheDocument();
});

test("connect wallet adds Studionet only when the selected provider does not know the chain", async () => {
  const okx = unknownChainProvider(["0x6666666666666666666666666666666666666666"], { isOkxWallet: true });
  Object.defineProperty(window, "okxwallet", {
    configurable: true,
    value: okx,
  });

  render(<App />);
  await userEvent.click(screen.getByRole("button", { name: /Connect Wallet/i }));
  await userEvent.click(await screen.findByRole("button", { name: /OKX Wallet/i }));

  await waitFor(() =>
    expect(okx.request).toHaveBeenCalledWith({
      method: "wallet_addEthereumChain",
      params: [
        expect.objectContaining({
          chainId: "0xf22f",
          chainName: "Genlayer Studio Network",
        }),
      ],
    }),
  );
  expect(okx.request).toHaveBeenCalledWith({ method: "wallet_switchEthereumChain", params: [{ chainId: "0xf22f" }] });
  expect(await screen.findByRole("button", { name: /0x6666...6666/i })).toBeInTheDocument();
});

test("wallet session is restored after reload when the selected provider still exposes accounts", async () => {
  const metamask = provider(["0x3333333333333333333333333333333333333333"], "0x30", { isMetaMask: true });
  Object.defineProperty(window, "ethereum", {
    configurable: true,
    value: { providers: [metamask], request: vi.fn() },
  });
  localStorage.setItem("disclosureDividend.walletId", "metamask");
  localStorage.setItem("disclosureDividend.walletAccount", "0x3333333333333333333333333333333333333333");

  render(<App />);

  expect(await screen.findByRole("button", { name: /0x3333...3333/i })).toBeInTheDocument();
  expect(metamask.request).toHaveBeenCalledWith({ method: "eth_accounts" });
});

test("connected wallet dropdown shows native balance and supports logout", async () => {
  const metamask = provider(["0x4444444444444444444444444444444444444444"], "0x64", { isMetaMask: true });
  Object.defineProperty(window, "ethereum", {
    configurable: true,
    value: { providers: [metamask], request: vi.fn() },
  });

  render(<App />);
  await userEvent.click(screen.getByRole("button", { name: /Connect Wallet/i }));
  await userEvent.click(await screen.findByRole("button", { name: /MetaMask/i }));
  await userEvent.click(screen.getByRole("button", { name: /0x4444...4444/i }));

  const menu = screen.getByRole("dialog", { name: /Wallet account/i });
  expect(within(menu).getByText(/0.0000000000000001 GEN/i)).toBeInTheDocument();
  await userEvent.click(within(menu).getByRole("button", { name: /Logout/i }));

  expect(screen.getByRole("button", { name: /Connect Wallet/i })).toBeInTheDocument();
  expect(localStorage.getItem("disclosureDividend.walletAccount")).toBeNull();
});
