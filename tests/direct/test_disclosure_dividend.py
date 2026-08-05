import pytest

from tests.direct.conftest import to_hex
from tests.direct.helpers import (
    AFTER_REVEAL,
    COMMIT_DEADLINE,
    CONTRACT_PATH,
    REVEAL_DEADLINE,
    commit_claim,
    commitment_for,
    create_pool,
    mock_review,
    mock_source_success,
    review_result,
)


def test_create_pool_locks_policy_and_value(direct_vm, direct_deploy, direct_alice):
    contract = direct_deploy(CONTRACT_PATH)
    create_pool(contract, direct_vm, direct_alice)

    pool = contract.get_pool("node-tmp")
    assert pool["status"] == "COMMIT_OPEN"
    assert pool["sponsor"] == to_hex(direct_alice)
    assert pool["target_package"] == "npm:tmp"
    assert pool["reward_wei"] == "1000"
    assert pool["role_weights_csv"] == "20,30,40,10"
    assert contract.get_pool_ids() == ["node-tmp"]


def test_commit_claim_requires_bond_and_prevents_duplicates(direct_vm, direct_deploy, direct_alice, direct_bob):
    contract = direct_deploy(CONTRACT_PATH)
    create_pool(contract, direct_vm, direct_alice)
    digest = commit_claim(contract, direct_vm, direct_bob)

    claim = contract.get_claim("node-tmp", to_hex(direct_bob))
    assert claim["commitment"] == digest
    assert claim["outcome"] == "COMMITTED"

    with direct_vm.expect_revert("Claim already exists"):
        commit_claim(contract, direct_vm, direct_bob)


def test_source_target_mismatch_goes_retryable_without_credit(direct_vm, direct_deploy, direct_alice, direct_bob):
    contract = direct_deploy(CONTRACT_PATH)
    create_pool(contract, direct_vm, direct_alice)
    commit_claim(contract, direct_vm, direct_bob)
    direct_vm.warp(COMMIT_DEADLINE)
    contract.close_commit_window("node-tmp")
    contract.propose_disclosure("node-tmp", "GHSA-wrong", "2e6f60c", "efa4a06")

    direct_vm.mock_web(r".*", {"method": "GET", "status": 200, "body": '{"ghsa_id":"GHSA-wrong","package":"other"}'})
    contract.verify_disclosure("node-tmp")

    assert contract.get_pool("node-tmp")["status"] == "RETRYABLE"
    assert contract.get_credit(to_hex(direct_bob)) == "0"


def test_reveal_requires_commitment_preimage(direct_vm, direct_deploy, direct_alice, direct_bob):
    contract = direct_deploy(CONTRACT_PATH)
    create_pool(contract, direct_vm, direct_alice)
    report_url = "https://raw.githubusercontent.com/acme/reports/abc/node-tmp.md"
    salt = "salt-a"
    commit_claim(contract, direct_vm, direct_bob, report_url=report_url, salt=salt)
    direct_vm.warp(COMMIT_DEADLINE)
    contract.close_commit_window("node-tmp")
    contract.propose_disclosure("node-tmp", "GHSA-ph9p-34f9-6g65", "2e6f60c", "efa4a06")
    mock_source_success(direct_vm)
    contract.verify_disclosure("node-tmp")

    with direct_vm.expect_revert("Reveal does not match commitment"):
        contract.reveal_claim("node-tmp", report_url, "wrong-salt")

    contract.reveal_claim("node-tmp", report_url, salt)
    assert contract.get_claim("node-tmp", to_hex(direct_bob))["outcome"] == "REVEALED"


def test_distribution_opens_researcher_and_sponsor_credits(direct_vm, direct_deploy, direct_alice, direct_bob, direct_charlie):
    contract = direct_deploy(CONTRACT_PATH)
    create_pool(contract, direct_vm, direct_alice, reward=1000, bond=25)
    report_a = "https://raw.githubusercontent.com/acme/reports/abc/node-tmp.md"
    report_b = "https://raw.githubusercontent.com/acme/reports/def/node-tmp-fix.md"
    commit_claim(contract, direct_vm, direct_bob, report_url=report_a, salt="salt-a")
    commit_claim(contract, direct_vm, direct_charlie, report_url=report_b, salt="salt-b")
    direct_vm.warp(COMMIT_DEADLINE)
    contract.close_commit_window("node-tmp")
    contract.propose_disclosure("node-tmp", "GHSA-ph9p-34f9-6g65", "2e6f60c", "efa4a06")
    mock_source_success(direct_vm)
    contract.verify_disclosure("node-tmp")
    contract.reveal_claim("node-tmp", report_a, "salt-a")
    contract.reveal_claim("node-tmp", report_b, "salt-b")
    direct_vm.warp(AFTER_REVEAL)
    contract.close_reveal_window("node-tmp")
    mock_review(direct_vm, review_result(direct_bob, direct_charlie))
    contract.adjudicate_pool("node-tmp")

    assert contract.get_pool("node-tmp")["status"] == "DISTRIBUTED"
    assert contract.get_credit(to_hex(direct_bob)) == "925"
    assert contract.get_credit(to_hex(direct_charlie)) == "125"
    assert contract.get_claim("node-tmp", to_hex(direct_bob))["outcome"] == "MATERIAL"


def test_withdraw_credit_debits_and_blocks_double_withdraw(direct_vm, direct_deploy, direct_alice, direct_bob):
    contract = direct_deploy(CONTRACT_PATH)
    create_pool(contract, direct_vm, direct_alice, reward=1000, bond=25)
    report_url = "https://raw.githubusercontent.com/acme/reports/abc/node-tmp.md"
    commit_claim(contract, direct_vm, direct_bob, report_url=report_url, salt="salt-a")
    direct_vm.warp(COMMIT_DEADLINE)
    contract.close_commit_window("node-tmp")
    contract.propose_disclosure("node-tmp", "GHSA-ph9p-34f9-6g65", "2e6f60c", "efa4a06")
    mock_source_success(direct_vm)
    contract.verify_disclosure("node-tmp")
    contract.reveal_claim("node-tmp", report_url, "salt-a")
    direct_vm.warp(AFTER_REVEAL)
    contract.close_reveal_window("node-tmp")
    mock_review(direct_vm, review_result(direct_bob))
    contract.adjudicate_pool("node-tmp")

    direct_vm.sender = direct_bob
    contract.withdraw_credit(1025)
    assert contract.get_credit(to_hex(direct_bob)) == "0"
    with direct_vm.expect_revert("Insufficient credit"):
        contract.withdraw_credit(1)


def test_invalid_review_output_cannot_expand_roles(direct_vm, direct_deploy, direct_alice, direct_bob):
    contract = direct_deploy(CONTRACT_PATH)
    create_pool(contract, direct_vm, direct_alice)
    report_url = "https://raw.githubusercontent.com/acme/reports/abc/node-tmp.md"
    commit_claim(contract, direct_vm, direct_bob, report_url=report_url, salt="salt-a")
    direct_vm.warp(COMMIT_DEADLINE)
    contract.close_commit_window("node-tmp")
    contract.propose_disclosure("node-tmp", "GHSA-ph9p-34f9-6g65", "2e6f60c", "efa4a06")
    mock_source_success(direct_vm)
    contract.verify_disclosure("node-tmp")
    contract.reveal_claim("node-tmp", report_url, "salt-a")
    direct_vm.warp(AFTER_REVEAL)
    contract.close_reveal_window("node-tmp")
    bad = review_result(direct_bob)
    bad["claim_results"][0]["roles_supported"] = ["DISCOVERY", "MAKE_ME_RICH"]
    mock_review(direct_vm, bad)

    with direct_vm.expect_revert("Review output is invalid"):
        contract.adjudicate_pool("node-tmp")
