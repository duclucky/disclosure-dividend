from scripts.deployment_receipts import safe_receipt_summary


def test_safe_receipt_summary_parses_raw_studio_consensus_shape():
    receipt = {
        "hash": "0xabc",
        "status": "FINALIZED",
        "consensus_data": {
            "leader_receipt": [
                {
                    "execution_result": "SUCCESS",
                    "contract_address": "0x1111111111111111111111111111111111111111",
                    "node_config": {"private": "must-not-leak"},
                }
            ]
        },
        "node_config": {"private": "must-not-leak"},
    }

    assert safe_receipt_summary(receipt) == {
        "tx_hash": "0xabc",
        "status": "FINALIZED",
        "execution_result": "SUCCESS",
        "contract_address": "0x1111111111111111111111111111111111111111",
    }


def test_safe_receipt_summary_parses_normalized_sdk_shape_and_allowlists_fields():
    receipt = {
        "transaction_hash": "0xdef",
        "status": "FINALIZED",
        "execution_result": {"status": "SUCCESS"},
        "contract_address": "0x2222222222222222222222222222222222222222",
        "stdout": "must-not-leak",
        "stderr": "must-not-leak",
        "trace": {"must": "not leak"},
    }

    summary = safe_receipt_summary(receipt)

    assert summary == {
        "tx_hash": "0xdef",
        "status": "FINALIZED",
        "execution_result": "SUCCESS",
        "contract_address": "0x2222222222222222222222222222222222222222",
    }
    assert not ({"stdout", "stderr", "trace", "node_config"} & set(summary))


def test_safe_receipt_summary_parses_genlayer_js_deploy_shape():
    receipt = {
        "hash": "0xfeed",
        "statusName": "FINALIZED",
        "txExecutionResultName": "FINISHED_WITH_RETURN",
        "txDataDecoded": {
            "type": "deploy",
            "contractAddress": "0x3333333333333333333333333333333333333333",
            "code": "must-not-leak",
        },
    }

    assert safe_receipt_summary(receipt) == {
        "tx_hash": "0xfeed",
        "status": "FINALIZED",
        "execution_result": "FINISHED_WITH_RETURN",
        "contract_address": "0x3333333333333333333333333333333333333333",
    }
