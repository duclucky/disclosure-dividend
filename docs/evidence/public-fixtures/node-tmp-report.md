# Disclosure Dividend report fixture: node-tmp path traversal

Reporter claim:

- Target package: npm:tmp.
- Target repository: raszi/node-tmp.
- Disclosure: GHSA-ph9p-34f9-6g65.
- Contribution roles claimed: DISCOVERY, ROOT_CAUSE, EXPLOIT_PROOF.

Material summary:

The tmp package built temporary paths by composing caller-controlled `prefix`,
`postfix`, and `dir` values into a path without proving the final normalized
path stayed inside the intended temporary directory. Supplying traversal
segments or separators could cause the generated file or directory path to
escape the configured base temporary directory.

Exploit proof:

An attacker-controlled prefix such as `../escaped` can affect the normalized
path produced by path joining. The security-relevant property is not the string
shape before normalization; it is whether the resolved result remains under the
intended temporary root.

Remediation verification:

The linked patch commit adds containment checks for tmp path traversal behavior
and rejects generated paths that escape the configured temporary directory.
