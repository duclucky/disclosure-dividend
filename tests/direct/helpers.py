import hashlib
import json

from tests.direct.conftest import to_hex


CONTRACT_PATH = "contracts/disclosure_dividend.py"
NOW = "2026-08-05T00:00:00Z"
COMMIT_DEADLINE = "2026-08-05T00:10:00Z"
REVEAL_DEADLINE = "2026-08-05T00:30:00Z"
AFTER_REVEAL = "2026-08-05T00:31:00Z"


def commitment_for(pool_id, claimant, report_url, salt):
    payload = "|".join(
        [
            "DISCLOSURE_DIVIDEND_V1",
            pool_id,
            to_hex(claimant).lower(),
            hashlib.sha256(report_url.encode("utf-8")).hexdigest(),
            salt,
        ]
    )
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()


def create_pool(contract, vm, sponsor, pool_id="node-tmp", reward=1000, bond=25):
    vm.sender = sponsor
    vm.value = reward
    vm.warp(NOW)
    contract.create_pool(
        pool_id,
        "https://github.com/raszi/node-tmp",
        "npm:tmp",
        "20,30,40,10",
        6,
        COMMIT_DEADLINE,
        REVEAL_DEADLINE,
        bond,
    )
    contract_address = vm._contract_address
    current_balance = vm._balances.get(bytes(contract_address), 0)
    vm.deal(contract_address, current_balance + reward)
    vm.value = 0


def commit_claim(contract, vm, claimant, pool_id="node-tmp", report_url="https://raw.githubusercontent.com/acme/reports/abc/node-tmp.md", salt="salt-a", bond=25):
    vm.sender = claimant
    vm.value = bond
    digest = commitment_for(pool_id, claimant, report_url, salt)
    contract.commit_claim(pool_id, digest)
    contract_address = vm._contract_address
    current_balance = vm._balances.get(bytes(contract_address), 0)
    vm.deal(contract_address, current_balance + bond)
    vm.value = 0
    return digest


def mock_source_success(vm):
    vm.mock_web(
        r".*advisory-database.*GHSA-ph9p-34f9-6g65.*",
        {"method": "GET", "status": 200, "body": '{"ghsa_id":"GHSA-ph9p-34f9-6g65","package":"tmp","repository":"raszi/node-tmp"}'},
    )
    vm.mock_web(
        r".*github\.com/raszi/node-tmp/commit/efa4a06.*",
        {"method": "GET", "status": 200, "body": "patch adds path containment checks for tmp path traversal"},
    )


def mock_review(vm, result):
    vm.mock_web(
        r".*raw\.githubusercontent\.com/acme/reports/.*",
        {"method": "GET", "status": 200, "body": "report explains tmp path traversal root cause and exploit proof"},
    )
    vm.mock_llm(r"(?s).*Disclosure Dividend semantic reviewer.*", json.dumps(result))


def review_result(claimant_a, claimant_b=None):
    a = to_hex(claimant_a).lower()
    claims = [
        {
            "claimant": a,
            "outcome": "MATERIAL",
            "roles_supported": ["DISCOVERY", "ROOT_CAUSE", "EXPLOIT_PROOF"],
        }
    ]
    edges = []
    if claimant_b is not None:
        b = to_hex(claimant_b).lower()
        claims.append(
            {
                "claimant": b,
                "outcome": "MATERIAL",
                "roles_supported": ["REMEDIATION_VERIFICATION"],
            }
        )
    return {
        "source_stage": "COMPLETE",
        "target_match": "MATCH",
        "claim_results": claims,
        "overlap_edges": edges,
        "verdict": "DISTRIBUTE",
        "consequence_class": "OPEN_CREDITS",
    }
