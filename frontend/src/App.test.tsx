import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, test } from "vitest";
import App from "./App";

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
