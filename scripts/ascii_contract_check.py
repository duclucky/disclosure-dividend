from pathlib import Path


contract = Path("contracts/disclosure_dividend.py")
data = contract.read_bytes()
source = data.decode("ascii")
lines = source.splitlines()
expected = '# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }'
if not lines or lines[0] != expected:
    raise SystemExit("Contract Depends header does not match the locked API family")
if len(lines) < 2 or lines[1] != "from genlayer import *":
    raise SystemExit("Contract must use from genlayer import * on line 2")
