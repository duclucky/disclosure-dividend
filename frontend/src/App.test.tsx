import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import App from "./App";
import { __resetWalletDiscoveryForTests } from "./genlayerClient";

vi.mock("genlayer-js", () => ({
  createClient: vi.fn(() => ({
    connect: vi.fn().mockResolvedValue(undefined),
    readContract: vi.fn().mockResolvedValue([]),
    waitForTransactionReceipt: vi.fn().mockResolvedValue({}),
    writeContract: vi.fn().mockResolvedValue("0xhash"),
  })),
}));

type TestProvider = {
  isMetaMask?: boolean;
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
      return null;
    }),
  };
}

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
  __resetWalletDiscoveryForTests();
  eipRequestController = new AbortController();
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
  }
  expect(screen.getAllByText(/Design data/i).length).toBeGreaterThan(0);
});

test("pool workspace exposes one legal primary action and hides system controls", async () => {
  render(<App />);
  await userEvent.click(screen.getByRole("link", { name: /View Details for node-tmp/i }));

  expect(screen.getByRole("heading", { name: /node-tmp/i })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /Seal My Report/i })).toBeDisabled();
  expect(screen.queryByText(/Estimated Gas/i)).not.toBeInTheDocument();
  expect(screen.queryByText(/Governance/i)).not.toBeInTheDocument();
  expect(screen.queryByText(/Security Audit/i)).not.toBeInTheDocument();
  expect(screen.queryByText(/Committee Review/i)).not.toBeInTheDocument();
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

test("create pool keeps policy editor layout with real v1 fields", async () => {
  render(<App />);
  await userEvent.click(screen.getByRole("button", { name: /Create Pool/i }));

  expect(screen.getByRole("heading", { name: /Create Pool Policy/i })).toBeInTheDocument();
  expect(screen.getByLabelText(/Target repository/i)).toBeInTheDocument();
  expect(screen.getByLabelText(/Reward amount/i)).toBeInTheDocument();
  expect(screen.getByLabelText(/Claim limit/i)).toBeInTheDocument();
  expect(screen.getByLabelText(/Commit deadline/i)).toBeInTheDocument();
  expect(screen.getByLabelText(/Reveal deadline/i)).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /Create and Fund Pool/i })).toBeInTheDocument();
  expect(screen.queryByText(/APY/i)).not.toBeInTheDocument();
  expect(screen.queryByText(/multi-sig/i)).not.toBeInTheDocument();
});

test("finalized split keeps technical details contextual", async () => {
  render(<App />);
  await userEvent.click(screen.getByRole("link", { name: /View Details for node-tmp/i }));

  const disclosure = screen.getByRole("button", { name: /Technical Details/i });
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
  expect(within(menu).getByText(/100 wei/i)).toBeInTheDocument();
  await userEvent.click(within(menu).getByRole("button", { name: /Logout/i }));

  expect(screen.getByRole("button", { name: /Connect Wallet/i })).toBeInTheDocument();
  expect(localStorage.getItem("disclosureDividend.walletAccount")).toBeNull();
});
