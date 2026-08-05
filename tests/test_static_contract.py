import ast
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
CONTRACT = ROOT / "contracts" / "disclosure_dividend.py"
EXPECTED_HEADER = '# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }'


def test_contract_file_is_ascii_and_uses_locked_header():
    source = CONTRACT.read_bytes().decode("ascii")
    lines = source.splitlines()
    assert lines[0] == EXPECTED_HEADER
    assert lines[1] == "from genlayer import *"


def test_exactly_one_contract_subclass_and_no_placeholders():
    source = CONTRACT.read_text(encoding="ascii")
    tree = ast.parse(source)
    contract_classes = [
        node.name
        for node in tree.body
        if isinstance(node, ast.ClassDef)
        and any(isinstance(base, ast.Attribute) and base.attr == "Contract" for base in node.bases)
    ]
    assert contract_classes == ["Contract"]
    assert "TODO" not in source
    assert "placeholder" not in source.lower()


def test_value_entrypoints_are_payable_and_withdraw_uses_eoa_interface():
    source = CONTRACT.read_text(encoding="ascii")
    tree = ast.parse(source)
    methods = {
        node.name: node
        for top in tree.body
        if isinstance(top, ast.ClassDef) and top.name == "Contract"
        for node in top.body
        if isinstance(node, ast.FunctionDef)
    }
    for method_name in ("create_pool", "commit_claim"):
        decorators = [ast.unparse(item) for item in methods[method_name].decorator_list]
        assert "gl.public.write.payable" in decorators
        assert "gl.message.value" in ast.unparse(methods[method_name])

    rendered = ast.unparse(methods["withdraw_credit"])
    assert "_ExternalRecipient(sender).emit_transfer" in rendered
    assert "gl.eth" not in rendered


def test_review_uses_custom_semantic_validator():
    source = CONTRACT.read_text(encoding="ascii")
    assert "gl.vm.run_nondet(" in source
    assert "_semantic_fingerprint" in source
    assert "isinstance(leader_result, gl.vm.Return)" in source
    assert "Disclosure Dividend semantic reviewer" in source
