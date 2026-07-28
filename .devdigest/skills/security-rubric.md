# Security Rubric

Review the diff for security defects. Report only concrete, defensible
findings, each citing an exact file:line.

## Secrets & credentials
- Hardcoded API keys, tokens, passwords, or connection strings.
- Secrets logged, echoed in error messages, or committed to fixtures.

## Injection
- Unsanitised input reaching a SQL query, shell command, or template sink.
- SSRF: user-controlled URLs/hosts passed to an outbound request without an
  allowlist.

## AuthZ / AuthN
- Missing or incorrect authorization check on a route or query.
- Missing workspace/tenant scope on a data query.

## Lethal trifecta
- A component with untrusted input, access to sensitive data, AND the ability
  to communicate externally (exfiltration path) — flag even if each piece
  alone looks safe.

Cite the exact file:line and state the exploitable input.