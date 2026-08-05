from __future__ import annotations


def _status_from_execution_result(value):
    if isinstance(value, dict):
        return value.get("status") or value.get("result") or value.get("name")
    return value


def safe_receipt_summary(receipt: dict) -> dict:
    tx_hash = receipt.get("transaction_hash") or receipt.get("hash")
    status = receipt.get("status") or receipt.get("statusName")
    execution_result = _status_from_execution_result(
        receipt.get("execution_result") or receipt.get("txExecutionResultName")
    )
    contract_address = receipt.get("contract_address")

    consensus_data = receipt.get("consensus_data")
    if isinstance(consensus_data, dict):
        leader_receipt = consensus_data.get("leader_receipt")
        if isinstance(leader_receipt, list) and len(leader_receipt) > 0:
            leader = leader_receipt[0]
            if isinstance(leader, dict):
                execution_result = execution_result or _status_from_execution_result(leader.get("execution_result"))
                contract_address = contract_address or leader.get("contract_address")

    tx_data_decoded = receipt.get("txDataDecoded")
    if isinstance(tx_data_decoded, dict):
        contract_address = contract_address or tx_data_decoded.get("contractAddress")

    summary = {}
    if tx_hash is not None:
        summary["tx_hash"] = tx_hash
    if status is not None:
        summary["status"] = status
    if execution_result is not None:
        summary["execution_result"] = execution_result
    if contract_address is not None:
        summary["contract_address"] = contract_address
    return summary
