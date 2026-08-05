# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }
from genlayer import *

from dataclasses import dataclass
from datetime import datetime, timezone
import hashlib
import json


MAX_ID_LENGTH = 80
MAX_URL_LENGTH = 500
MAX_SOURCE_CHARS = 300000
VALID_ROLES = ("DISCOVERY", "ROOT_CAUSE", "EXPLOIT_PROOF", "REMEDIATION_VERIFICATION")
VALID_STATUSES = (
    "COMMIT_OPEN",
    "SOURCE_PENDING",
    "REVEAL_OPEN",
    "READY_FOR_REVIEW",
    "DISTRIBUTED",
    "RETRYABLE",
    "CANCELLED",
)


@allow_storage
@dataclass
class Pool:
    pool_id: str
    sponsor: Address
    target_repository: str
    target_package: str
    role_weights_csv: str
    claim_limit: u256
    commit_deadline: str
    reveal_deadline: str
    reservation_bond_wei: bigint
    reward_wei: bigint
    status: str
    ghsa_id: str
    advisory_database_commit: str
    patch_commit: str
    claim_count: u256
    revealed_count: u256
    attempt_count: u256
    distributed: bool
    claimants_csv: str


@allow_storage
@dataclass
class Claim:
    pool_id: str
    claimant: Address
    commitment: str
    report_url: str
    report_hash: str
    outcome: str
    roles_csv: str
    bond_wei: bigint


@allow_storage
@dataclass
class ReviewAttempt:
    pool_id: str
    attempt_number: u256
    source_stage: str
    target_match: str
    verdict: str
    consequence_class: str
    fingerprint: str


@allow_storage
@dataclass
class AccountIndex:
    account: str
    pool_ids_csv: str


@gl.evm.contract_interface
class _ExternalRecipient:
    class View:
        pass

    class Write:
        pass


def _addr_str(address: Address) -> str:
    try:
        return address.as_hex
    except Exception:
        return str(address)


def _addr_key(address: Address) -> str:
    return _addr_str(address).lower()


def _is_valid_id(value: str) -> bool:
    if len(value) < 3 or len(value) > MAX_ID_LENGTH:
        return False
    for char in value:
        if not (
            (char >= "a" and char <= "z")
            or (char >= "A" and char <= "Z")
            or (char >= "0" and char <= "9")
            or char == "-"
            or char == "_"
            or char == "."
        ):
            return False
    return True


def _validate_url(value: str, label: str) -> None:
    if len(value) < 12 or len(value) > MAX_URL_LENGTH:
        raise gl.vm.UserError(label + " length is invalid")
    if not value.startswith("https://"):
        raise gl.vm.UserError(label + " must use https")
    if "#" in value or "@" in value:
        raise gl.vm.UserError(label + " contains disallowed characters")


def _parse_utc(value: str) -> datetime:
    if len(value) < 20 or len(value) > 32 or not value.endswith("Z"):
        raise gl.vm.UserError("Time must be an ISO UTC timestamp ending in Z")
    try:
        parsed = datetime.fromisoformat(value[:-1] + "+00:00")
    except Exception:
        raise gl.vm.UserError("Time must be an ISO UTC timestamp ending in Z")
    return parsed.astimezone(timezone.utc)


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _claim_key(pool_id: str, claimant: Address) -> str:
    return pool_id + "|" + _addr_key(claimant)


def _commitment(pool_id: str, claimant: Address, report_url: str, salt: str) -> str:
    report_hash = hashlib.sha256(report_url.encode("utf-8")).hexdigest()
    payload = "|".join(
        [
            "DISCLOSURE_DIVIDEND_V1",
            pool_id,
            _addr_key(claimant),
            report_hash,
            salt,
        ]
    )
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()


def _split_csv(value: str) -> list[str]:
    if len(value.strip()) == 0:
        return []
    return [item.strip() for item in value.split(",")]


def _parse_role_weights(value: str) -> dict:
    parts = _split_csv(value)
    if len(parts) != len(VALID_ROLES):
        raise gl.vm.UserError("Role weights are invalid")
    weights = {}
    total = 0
    for index, raw in enumerate(parts):
        try:
            amount = int(raw)
        except Exception:
            raise gl.vm.UserError("Role weights are invalid")
        if amount < 0:
            raise gl.vm.UserError("Role weights are invalid")
        weights[VALID_ROLES[index]] = amount
        total += amount
    if total != 100:
        raise gl.vm.UserError("Role weights must sum to 100")
    return weights


def _read_source(url: str) -> tuple[str, str]:
    try:
        response = gl.nondet.web.get(url)
    except Exception:
        return ("UNAVAILABLE", "")
    if response.status != 200:
        return ("UNAVAILABLE", "")
    if response.body is None:
        return ("MISSING", "")
    try:
        if isinstance(response.body, bytes):
            body = response.body.decode("utf-8")
        else:
            body = str(response.body)
    except Exception:
        return ("MALFORMED", "")
    if len(body.strip()) == 0:
        return ("MISSING", "")
    if len(body) > MAX_SOURCE_CHARS:
        return ("MALFORMED", "")
    return ("COMPLETE", body)


def _source_result(
    ghsa_id: str,
    advisory_database_commit: str,
    patch_commit: str,
    target_repository: str,
    target_package: str,
) -> dict:
    if advisory_database_commit.startswith("global:"):
        advisory_url = "https://github.com/advisories/" + ghsa_id
    else:
        advisory_url = (
            "https://raw.githubusercontent.com/github/advisory-database/"
            + advisory_database_commit
            + "/advisories/github-reviewed/2026/08/"
            + ghsa_id
            + "/"
            + ghsa_id
            + ".json"
        )
    patch_url = target_repository.rstrip("/") + "/commit/" + patch_commit
    if advisory_database_commit.startswith("global:"):
        patch_url = patch_url + ".patch"
    advisory_stage, advisory_body = _read_source(advisory_url)
    patch_stage, patch_body = _read_source(patch_url)
    source_stage = "COMPLETE"
    if advisory_stage != "COMPLETE":
        source_stage = advisory_stage
    elif patch_stage != "COMPLETE":
        source_stage = patch_stage

    package_match = False
    advisory_id_match = False
    if advisory_stage == "COMPLETE":
        try:
            payload = json.loads(advisory_body)
            advisory_id_match = str(payload.get("ghsa_id", "")).upper() == ghsa_id.upper()
            package_value = str(payload.get("package", "")).lower()
            package_match = package_value == target_package.lower() or ("npm:" + package_value) == target_package.lower()
        except Exception:
            advisory_text = advisory_body.lower()
            advisory_id_match = ghsa_id.lower() in advisory_text
            package_name = target_package.lower().split(":", 1)[-1]
            package_match = package_name in advisory_text

    patch_match = False
    if patch_stage == "COMPLETE":
        target_tail = target_repository.rstrip("/").split("/")[-2:]
        repo_fragment = "/".join(target_tail).lower()
        patch_match = patch_commit.lower() in patch_url.lower() and repo_fragment in patch_url.lower()
        if len(patch_body.strip()) == 0:
            patch_match = False

    target_match = "MATCH" if advisory_id_match and package_match and patch_match else "MISMATCH"
    verdict = "SOURCE_VERIFIED" if source_stage == "COMPLETE" and target_match == "MATCH" else "UNVERIFIABLE"
    return {
        "source_stage": source_stage,
        "target_match": target_match,
        "verdict": verdict,
        "consequence_class": "OPEN_REVEAL" if verdict == "SOURCE_VERIFIED" else "NO_DISTRIBUTION",
    }


def _source_fingerprint(result: dict) -> str:
    return "|".join(
        [
            str(result.get("source_stage", "")),
            str(result.get("target_match", "")),
            str(result.get("verdict", "")),
            str(result.get("consequence_class", "")),
        ]
    )


def _normalize_review_result(raw) -> dict:
    if isinstance(raw, str):
        try:
            raw = json.loads(raw)
        except Exception:
            return {
                "source_stage": "MALFORMED",
                "target_match": "UNKNOWN",
                "claim_results": [],
                "overlap_edges": [],
                "verdict": "UNVERIFIABLE",
                "consequence_class": "NO_DISTRIBUTION",
            }
    if not isinstance(raw, dict):
        return {
            "source_stage": "MALFORMED",
            "target_match": "UNKNOWN",
            "claim_results": [],
            "overlap_edges": [],
            "verdict": "UNVERIFIABLE",
            "consequence_class": "NO_DISTRIBUTION",
        }
    claims = []
    raw_claims = raw.get("claim_results", [])
    if isinstance(raw_claims, list):
        for item in raw_claims:
            if not isinstance(item, dict):
                continue
            roles = []
            raw_roles = item.get("roles_supported", [])
            if isinstance(raw_roles, list):
                for role in raw_roles:
                    roles.append(str(role).strip().upper())
            claims.append(
                {
                    "claimant": str(item.get("claimant", "")).lower(),
                    "outcome": str(item.get("outcome", "")).strip().upper(),
                    "roles_supported": roles,
                }
            )
    return {
        "source_stage": str(raw.get("source_stage", "")).strip().upper(),
        "target_match": str(raw.get("target_match", "")).strip().upper(),
        "claim_results": claims,
        "overlap_edges": raw.get("overlap_edges", []) if isinstance(raw.get("overlap_edges", []), list) else [],
        "verdict": str(raw.get("verdict", "")).strip().upper(),
        "consequence_class": str(raw.get("consequence_class", "")).strip().upper(),
    }


def _semantic_fingerprint(result: dict) -> str:
    claim_parts = []
    claims = result.get("claim_results", [])
    if isinstance(claims, list):
        for claim in claims:
            if not isinstance(claim, dict):
                continue
            roles = claim.get("roles_supported", [])
            if not isinstance(roles, list):
                roles = []
            claim_parts.append(
                str(claim.get("claimant", "")).lower()
                + ":"
                + str(claim.get("outcome", "")).upper()
                + ":"
                + ",".join(sorted([str(role).upper() for role in roles]))
            )
    claim_parts.sort()
    return "|".join(
        [
            str(result.get("source_stage", "")),
            str(result.get("target_match", "")),
            str(result.get("verdict", "")),
            str(result.get("consequence_class", "")),
            ";".join(claim_parts),
        ]
    )


def _validate_review_result(result: dict, allowed_claimants: list[str]) -> None:
    if result.get("source_stage") != "COMPLETE":
        raise gl.vm.UserError("Review output is invalid")
    if result.get("target_match") != "MATCH":
        raise gl.vm.UserError("Review output is invalid")
    if result.get("verdict") != "DISTRIBUTE" or result.get("consequence_class") != "OPEN_CREDITS":
        raise gl.vm.UserError("Review output is invalid")
    seen = {}
    claims = result.get("claim_results", [])
    if not isinstance(claims, list) or len(claims) == 0:
        raise gl.vm.UserError("Review output is invalid")
    for claim in claims:
        claimant = str(claim.get("claimant", "")).lower()
        if claimant not in allowed_claimants:
            raise gl.vm.UserError("Review output is invalid")
        if claimant in seen:
            raise gl.vm.UserError("Review output is invalid")
        seen[claimant] = True
        outcome = str(claim.get("outcome", "")).upper()
        if outcome not in ("MATERIAL", "DUPLICATE", "NON_MATERIAL"):
            raise gl.vm.UserError("Review output is invalid")
        roles = claim.get("roles_supported", [])
        if not isinstance(roles, list):
            raise gl.vm.UserError("Review output is invalid")
        for role in roles:
            if str(role).upper() not in VALID_ROLES:
                raise gl.vm.UserError("Review output is invalid")


def _pool_view(pool: Pool) -> dict:
    return {
        "pool_id": pool.pool_id,
        "sponsor": _addr_str(pool.sponsor),
        "target_repository": pool.target_repository,
        "target_package": pool.target_package,
        "role_weights_csv": pool.role_weights_csv,
        "claim_limit": str(pool.claim_limit),
        "commit_deadline": pool.commit_deadline,
        "reveal_deadline": pool.reveal_deadline,
        "reservation_bond_wei": str(pool.reservation_bond_wei),
        "reward_wei": str(pool.reward_wei),
        "status": pool.status,
        "ghsa_id": pool.ghsa_id,
        "advisory_database_commit": pool.advisory_database_commit,
        "patch_commit": pool.patch_commit,
        "claim_count": str(pool.claim_count),
        "revealed_count": str(pool.revealed_count),
        "attempt_count": str(pool.attempt_count),
        "distributed": pool.distributed,
    }


def _claim_view(pool_id: str, claimant: str, claim: Claim | None) -> dict:
    if claim is None:
        return {
            "pool_id": pool_id,
            "claimant": claimant.lower(),
            "commitment": "",
            "report_url": "",
            "report_hash": "",
            "outcome": "NONE",
            "roles_csv": "",
            "bond_wei": "0",
        }
    return {
        "pool_id": claim.pool_id,
        "claimant": _addr_str(claim.claimant),
        "commitment": claim.commitment,
        "report_url": claim.report_url,
        "report_hash": claim.report_hash,
        "outcome": claim.outcome,
        "roles_csv": claim.roles_csv,
        "bond_wei": str(claim.bond_wei),
    }


class Contract(gl.Contract):
    pools: TreeMap[str, Pool]
    pool_count: u256
    all_pool_ids_csv: str
    claims: TreeMap[str, Claim]
    account_indexes: TreeMap[str, AccountIndex]
    credits: TreeMap[str, bigint]
    attempts: TreeMap[str, ReviewAttempt]
    contract_liability: bigint
    total_received: bigint
    total_withdrawn: bigint

    def __init__(self):
        self.pool_count = u256(0)
        self.all_pool_ids_csv = ""
        self.contract_liability = bigint(0)
        self.total_received = bigint(0)
        self.total_withdrawn = bigint(0)

    @gl.public.write.payable
    def create_pool(
        self,
        pool_id: str,
        target_repository: str,
        target_package: str,
        role_weights_csv: str,
        claim_limit: int,
        commit_deadline: str,
        reveal_deadline: str,
        reservation_bond_wei: int,
    ) -> None:
        if not _is_valid_id(pool_id):
            raise gl.vm.UserError("Pool id is invalid")
        if pool_id in self.pools:
            raise gl.vm.UserError("Pool already exists")
        _validate_url(target_repository, "Target repository")
        if not target_package.startswith("npm:") or len(target_package) > 80:
            raise gl.vm.UserError("Target package is invalid")
        _parse_role_weights(role_weights_csv)
        if int(claim_limit) <= 0 or int(claim_limit) > 100:
            raise gl.vm.UserError("Claim limit is invalid")
        if _parse_utc(commit_deadline) <= _now():
            raise gl.vm.UserError("Commit deadline must be in the future")
        if _parse_utc(reveal_deadline) <= _parse_utc(commit_deadline):
            raise gl.vm.UserError("Reveal deadline must be after commit deadline")
        if int(reservation_bond_wei) <= 0:
            raise gl.vm.UserError("Reservation bond must be positive")
        reward = bigint(int(gl.message.value))
        if int(reward) <= 0:
            raise gl.vm.UserError("Pool reward must be funded")
        self.pools[pool_id] = Pool(
            pool_id=pool_id,
            sponsor=gl.message.sender_address,
            target_repository=target_repository,
            target_package=target_package,
            role_weights_csv=role_weights_csv,
            claim_limit=u256(claim_limit),
            commit_deadline=commit_deadline,
            reveal_deadline=reveal_deadline,
            reservation_bond_wei=bigint(reservation_bond_wei),
            reward_wei=reward,
            status="COMMIT_OPEN",
            ghsa_id="",
            advisory_database_commit="",
            patch_commit="",
            claim_count=u256(0),
            revealed_count=u256(0),
            attempt_count=u256(0),
            distributed=False,
            claimants_csv="",
        )
        self.all_pool_ids_csv = self.all_pool_ids_csv + ("," if len(self.all_pool_ids_csv) > 0 else "") + pool_id
        self.pool_count = u256(int(self.pool_count) + 1)
        self.total_received = bigint(int(self.total_received) + int(reward))

    @gl.public.write.payable
    def commit_claim(self, pool_id: str, commitment: str) -> None:
        if pool_id not in self.pools:
            raise gl.vm.UserError("Pool does not exist")
        pool = self.pools[pool_id]
        if pool.status != "COMMIT_OPEN":
            raise gl.vm.UserError("Pool is not accepting claims")
        if _now() > _parse_utc(pool.commit_deadline):
            raise gl.vm.UserError("Commit window has closed")
        sender = gl.message.sender_address
        key = _claim_key(pool_id, sender)
        if key in self.claims:
            raise gl.vm.UserError("Claim already exists")
        if len(commitment) != 64:
            raise gl.vm.UserError("Commitment is invalid")
        if int(gl.message.value) != int(pool.reservation_bond_wei):
            raise gl.vm.UserError("Reservation bond is invalid")
        if int(pool.claim_count) >= int(pool.claim_limit):
            raise gl.vm.UserError("Claim limit reached")
        claim = Claim(
            pool_id=pool_id,
            claimant=sender,
            commitment=commitment.lower(),
            report_url="",
            report_hash="",
            outcome="COMMITTED",
            roles_csv="",
            bond_wei=bigint(int(gl.message.value)),
        )
        self.claims[key] = claim
        pool.claim_count = u256(int(pool.claim_count) + 1)
        pool.claimants_csv = pool.claimants_csv + ("," if len(pool.claimants_csv) > 0 else "") + _addr_key(sender)
        account = _addr_key(sender)
        if account in self.account_indexes:
            account_index = self.account_indexes[account]
            account_index.pool_ids_csv = account_index.pool_ids_csv + ("," if len(account_index.pool_ids_csv) > 0 else "") + pool_id
        else:
            self.account_indexes[account] = AccountIndex(account=account, pool_ids_csv=pool_id)
        self.total_received = bigint(int(self.total_received) + int(gl.message.value))

    @gl.public.write
    def close_commit_window(self, pool_id: str) -> None:
        if pool_id not in self.pools:
            raise gl.vm.UserError("Pool does not exist")
        pool = self.pools[pool_id]
        if pool.status != "COMMIT_OPEN":
            raise gl.vm.UserError("Pool is not in commit window")
        if _now() < _parse_utc(pool.commit_deadline):
            raise gl.vm.UserError("Commit deadline has not arrived")
        pool.status = "SOURCE_PENDING"

    @gl.public.write
    def propose_disclosure(self, pool_id: str, ghsa_id: str, advisory_database_commit: str, patch_commit: str) -> None:
        if pool_id not in self.pools:
            raise gl.vm.UserError("Pool does not exist")
        pool = self.pools[pool_id]
        if pool.status != "SOURCE_PENDING" and pool.status != "RETRYABLE":
            raise gl.vm.UserError("Pool is not ready for source proposal")
        if not ghsa_id.startswith("GHSA-") or len(ghsa_id) > 80:
            raise gl.vm.UserError("GHSA id is invalid")
        if len(advisory_database_commit) < 6 or len(advisory_database_commit) > 64:
            raise gl.vm.UserError("Advisory database commit is invalid")
        if len(patch_commit) < 6 or len(patch_commit) > 64:
            raise gl.vm.UserError("Patch commit is invalid")
        pool.ghsa_id = ghsa_id
        pool.advisory_database_commit = advisory_database_commit
        pool.patch_commit = patch_commit
        pool.status = "SOURCE_PENDING"

    @gl.public.write
    def verify_disclosure(self, pool_id: str) -> dict:
        if pool_id not in self.pools:
            raise gl.vm.UserError("Pool does not exist")
        pool = self.pools[pool_id]
        if pool.status != "SOURCE_PENDING":
            raise gl.vm.UserError("Pool is not ready for source verification")
        if len(pool.ghsa_id) == 0:
            raise gl.vm.UserError("Disclosure source is missing")

        def evaluate() -> dict:
            return _source_result(
                pool.ghsa_id,
                pool.advisory_database_commit,
                pool.patch_commit,
                pool.target_repository,
                pool.target_package,
            )

        def validator_fn(leader_result) -> bool:
            if not isinstance(leader_result, gl.vm.Return):
                return False
            if not isinstance(leader_result.calldata, dict):
                return False
            independent = evaluate()
            return _source_fingerprint(leader_result.calldata) == _source_fingerprint(independent)

        result = gl.vm.run_nondet(evaluate, validator_fn)
        if str(result.get("source_stage", "")) == "COMPLETE" and str(result.get("target_match", "")) == "MATCH":
            pool.status = "REVEAL_OPEN"
        else:
            pool.status = "RETRYABLE"
        return result

    @gl.public.write
    def reveal_claim(self, pool_id: str, report_url: str, salt: str) -> None:
        if pool_id not in self.pools:
            raise gl.vm.UserError("Pool does not exist")
        pool = self.pools[pool_id]
        if pool.status != "REVEAL_OPEN":
            raise gl.vm.UserError("Pool is not accepting reveals")
        if _now() > _parse_utc(pool.reveal_deadline):
            raise gl.vm.UserError("Reveal window has closed")
        _validate_url(report_url, "Report URL")
        sender = gl.message.sender_address
        key = _claim_key(pool_id, sender)
        if key not in self.claims or _commitment(pool_id, sender, report_url, salt) != self.claims[key].commitment:
            matched_key = ""
            for claimant in _split_csv(pool.claimants_csv):
                candidate_key = pool_id + "|" + claimant.lower()
                if candidate_key in self.claims:
                    candidate = self.claims[candidate_key]
                    if _commitment(pool_id, candidate.claimant, report_url, salt) == candidate.commitment:
                        matched_key = candidate_key
                        break
            if len(matched_key) == 0:
                if key not in self.claims:
                    raise gl.vm.UserError("Claim does not exist")
                raise gl.vm.UserError("Reveal does not match commitment")
            key = matched_key
        claim = self.claims[key]
        if claim.outcome != "COMMITTED":
            raise gl.vm.UserError("Claim already revealed")
        claim.report_url = report_url
        claim.report_hash = hashlib.sha256(report_url.encode("utf-8")).hexdigest()
        claim.outcome = "REVEALED"
        pool.revealed_count = u256(int(pool.revealed_count) + 1)

    @gl.public.write
    def close_reveal_window(self, pool_id: str) -> None:
        if pool_id not in self.pools:
            raise gl.vm.UserError("Pool does not exist")
        pool = self.pools[pool_id]
        if pool.status != "REVEAL_OPEN":
            raise gl.vm.UserError("Pool is not in reveal window")
        if _now() < _parse_utc(pool.reveal_deadline):
            raise gl.vm.UserError("Reveal deadline has not arrived")
        pool.status = "READY_FOR_REVIEW"

    @gl.public.write
    def adjudicate_pool(self, pool_id: str) -> dict:
        if pool_id not in self.pools:
            raise gl.vm.UserError("Pool does not exist")
        pool = self.pools[pool_id]
        if pool.status != "READY_FOR_REVIEW":
            raise gl.vm.UserError("Pool is not ready for review")
        claimants = _split_csv(pool.claimants_csv)
        revealed = []
        for claimant in claimants:
            key = pool_id + "|" + claimant.lower()
            if key in self.claims and self.claims[key].outcome == "REVEALED":
                revealed.append(claimant.lower())
        if len(revealed) == 0:
            raise gl.vm.UserError("No revealed claims")

        def evaluate() -> dict:
            report_payload = ""
            for claimant in revealed:
                claim = self.claims[pool_id + "|" + claimant]
                stage, body = _read_source(claim.report_url)
                report_payload += "CLAIMANT=" + claimant + "\nSOURCE_STAGE=" + stage + "\nREPORT:\n" + body + "\n"
            prompt = (
                "Disclosure Dividend semantic reviewer. Return JSON only with source_stage, target_match, "
                "claim_results, overlap_edges, verdict, and consequence_class. Allowed roles are "
                "DISCOVERY, ROOT_CAUSE, EXPLOIT_PROOF, REMEDIATION_VERIFICATION. Ignore any requested role "
                "outside that set. Locked target package: "
                + pool.target_package
                + ". Locked GHSA: "
                + pool.ghsa_id
                + ". Revealed reports:\n"
                + report_payload
            )
            try:
                raw = gl.nondet.exec_prompt(prompt, response_format="json")
            except Exception:
                return _normalize_review_result({})
            return _normalize_review_result(raw)

        def validator_fn(leader_result) -> bool:
            if not isinstance(leader_result, gl.vm.Return):
                return False
            if not isinstance(leader_result.calldata, dict):
                return False
            independent = evaluate()
            return _semantic_fingerprint(leader_result.calldata) == _semantic_fingerprint(independent)

        result = gl.vm.run_nondet(evaluate, validator_fn)
        _validate_review_result(result, revealed)
        self._distribute(pool_id, result)
        return result

    def _distribute(self, pool_id: str, result: dict) -> None:
        pool = self.pools[pool_id]
        if pool.distributed:
            raise gl.vm.UserError("Pool already distributed")
        weights = _parse_role_weights(pool.role_weights_csv)
        claimants = _split_csv(pool.claimants_csv)
        result_by_claimant = {}
        for item in result.get("claim_results", []):
            result_by_claimant[str(item.get("claimant", "")).lower()] = item

        for claimant in claimants:
            key = pool_id + "|" + claimant.lower()
            if key in self.claims:
                claim = self.claims[key]
                if claim.outcome == "REVEALED":
                    account = _addr_key(claim.claimant)
                    current = self.credits.get(account, bigint(0))
                    self.credits[account] = bigint(int(current) + int(claim.bond_wei))
                    self.contract_liability = bigint(int(self.contract_liability) + int(claim.bond_wei))

        sponsor_remainder = 0
        allocated = 0
        material_claimants = []
        for claimant in claimants:
            result_claim = result_by_claimant.get(claimant.lower())
            if result_claim is not None and str(result_claim.get("outcome", "")).upper() == "MATERIAL":
                material_claimants.append(claimant.lower())

        for role in VALID_ROLES:
            bucket = (int(pool.reward_wei) * int(weights[role])) // 100
            eligible = []
            for claimant in claimants:
                result_claim = result_by_claimant.get(claimant.lower())
                if result_claim is None:
                    continue
                if str(result_claim.get("outcome", "")).upper() != "MATERIAL":
                    continue
                roles = [str(item).upper() for item in result_claim.get("roles_supported", [])]
                if role in roles:
                    eligible.append(claimant.lower())
            if len(eligible) == 0 and len(material_claimants) == 1:
                eligible.append(material_claimants[0])
            if len(eligible) == 0:
                sponsor_remainder += bucket
                continue
            share = bucket // len(eligible)
            remainder = bucket - (share * len(eligible))
            sponsor_remainder += remainder
            for claimant in eligible:
                key = pool_id + "|" + claimant
                claim = self.claims[key]
                account = _addr_key(claim.claimant)
                current = self.credits.get(account, bigint(0))
                self.credits[account] = bigint(int(current) + share)
                self.contract_liability = bigint(int(self.contract_liability) + share)
                allocated += share

        if sponsor_remainder > 0:
            sponsor_account = _addr_key(pool.sponsor)
            current_sponsor = self.credits.get(sponsor_account, bigint(0))
            self.credits[sponsor_account] = bigint(int(current_sponsor) + sponsor_remainder)
            self.contract_liability = bigint(int(self.contract_liability) + sponsor_remainder)
        for claimant in claimants:
            key = pool_id + "|" + claimant.lower()
            if key in self.claims and claimant.lower() in result_by_claimant:
                claim = self.claims[key]
                result_claim = result_by_claimant[claimant.lower()]
                claim.outcome = str(result_claim.get("outcome", "")).upper()
                claim.roles_csv = ",".join([str(role).upper() for role in result_claim.get("roles_supported", [])])

        attempt_number = int(pool.attempt_count) + 1
        pool.attempt_count = u256(attempt_number)
        self.attempts[pool_id + "|" + str(attempt_number)] = ReviewAttempt(
            pool_id=pool_id,
            attempt_number=u256(attempt_number),
            source_stage=str(result.get("source_stage", "")),
            target_match=str(result.get("target_match", "")),
            verdict=str(result.get("verdict", "")),
            consequence_class=str(result.get("consequence_class", "")),
            fingerprint=_semantic_fingerprint(result),
        )
        pool.status = "DISTRIBUTED"
        pool.distributed = True

    @gl.public.write
    def retry_pool(self, pool_id: str) -> None:
        if pool_id not in self.pools:
            raise gl.vm.UserError("Pool does not exist")
        pool = self.pools[pool_id]
        if pool.status != "RETRYABLE":
            raise gl.vm.UserError("Pool is not retryable")
        pool.status = "SOURCE_PENDING"

    @gl.public.write
    def cancel_pool(self, pool_id: str) -> None:
        if pool_id not in self.pools:
            raise gl.vm.UserError("Pool does not exist")
        pool = self.pools[pool_id]
        if _addr_key(gl.message.sender_address) != _addr_key(pool.sponsor):
            raise gl.vm.UserError("Only sponsor can cancel")
        if pool.status == "DISTRIBUTED":
            raise gl.vm.UserError("Distributed pool cannot be cancelled")
        claimants = _split_csv(pool.claimants_csv)
        for claimant in claimants:
            key = pool_id + "|" + claimant.lower()
            if key in self.claims:
                claim = self.claims[key]
                account = _addr_key(claim.claimant)
                current_claimant = self.credits.get(account, bigint(0))
                self.credits[account] = bigint(int(current_claimant) + int(claim.bond_wei))
                self.contract_liability = bigint(int(self.contract_liability) + int(claim.bond_wei))
        pool.status = "CANCELLED"
        sponsor_account = _addr_key(pool.sponsor)
        current = self.credits.get(sponsor_account, bigint(0))
        self.credits[sponsor_account] = bigint(int(current) + int(pool.reward_wei))
        self.contract_liability = bigint(int(self.contract_liability) + int(pool.reward_wei))

    @gl.public.write
    def settle_unrevealed(self, pool_id: str) -> None:
        if pool_id not in self.pools:
            raise gl.vm.UserError("Pool does not exist")
        pool = self.pools[pool_id]
        if pool.status != "READY_FOR_REVIEW":
            raise gl.vm.UserError("Pool is not ready for unrevealed settlement")
        if int(pool.revealed_count) > 0:
            raise gl.vm.UserError("Revealed claims require adjudication")
        sponsor_account = _addr_key(pool.sponsor)
        current = self.credits.get(sponsor_account, bigint(0))
        self.credits[sponsor_account] = bigint(int(current) + int(pool.reward_wei))
        self.contract_liability = bigint(int(self.contract_liability) + int(pool.reward_wei))
        pool.status = "DISTRIBUTED"
        pool.distributed = True

    @gl.public.write
    def withdraw_credit(self, amount: int) -> None:
        requested = bigint(int(amount))
        if int(requested) <= 0:
            raise gl.vm.UserError("Withdrawal amount must be positive")
        sender = gl.message.sender_address
        account = _addr_key(sender)
        available = self.credits.get(account, bigint(0))
        if int(requested) > int(available):
            raise gl.vm.UserError("Insufficient credit")
        if int(requested) > int(self.contract_liability):
            raise gl.vm.UserError("Withdrawal exceeds contract liability")
        self.credits[account] = bigint(int(available) - int(requested))
        self.contract_liability = bigint(int(self.contract_liability) - int(requested))
        self.total_withdrawn = bigint(int(self.total_withdrawn) + int(requested))
        _ExternalRecipient(sender).emit_transfer(value=u256(requested))

    @gl.public.view
    def get_pool_ids(self) -> list[str]:
        return _split_csv(self.all_pool_ids_csv)

    @gl.public.view
    def get_pool(self, pool_id: str) -> dict:
        if pool_id not in self.pools:
            raise gl.vm.UserError("Pool does not exist")
        return _pool_view(self.pools[pool_id])

    @gl.public.view
    def get_pool_claims(self, pool_id: str) -> list[str]:
        if pool_id not in self.pools:
            raise gl.vm.UserError("Pool does not exist")
        return _split_csv(self.pools[pool_id].claimants_csv)

    @gl.public.view
    def get_claim(self, pool_id: str, claimant: str) -> dict:
        key = pool_id + "|" + claimant.lower()
        claim = self.claims[key] if key in self.claims else None
        return _claim_view(pool_id, claimant, claim)

    @gl.public.view
    def get_account_pool_ids(self, account: str) -> list[str]:
        account_key = account.lower()
        if account_key not in self.account_indexes:
            return []
        return _split_csv(self.account_indexes[account_key].pool_ids_csv)

    @gl.public.view
    def get_credit(self, account: str) -> str:
        return str(self.credits.get(account.lower(), bigint(0)))

    @gl.public.view
    def get_attempt(self, pool_id: str, attempt_number: int) -> dict:
        key = pool_id + "|" + str(attempt_number)
        if key not in self.attempts:
            return {
                "pool_id": pool_id,
                "attempt_number": str(attempt_number),
                "source_stage": "",
                "target_match": "",
                "verdict": "",
                "consequence_class": "",
                "fingerprint": "",
            }
        attempt = self.attempts[key]
        return {
            "pool_id": attempt.pool_id,
            "attempt_number": str(attempt.attempt_number),
            "source_stage": attempt.source_stage,
            "target_match": attempt.target_match,
            "verdict": attempt.verdict,
            "consequence_class": attempt.consequence_class,
            "fingerprint": attempt.fingerprint,
        }

    @gl.public.view
    def get_contract_summary(self) -> dict:
        return {
            "pool_count": str(self.pool_count),
            "contract_liability": str(self.contract_liability),
            "total_received": str(self.total_received),
            "total_withdrawn": str(self.total_withdrawn),
        }
