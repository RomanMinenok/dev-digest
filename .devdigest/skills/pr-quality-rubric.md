# PR Quality Rubric

A checklist for reviewing a pull-request diff. Walk each section and report only
concrete, defensible findings, each citing an exact file:line that exists in the
diff. State the mechanism — which input triggers the wrong behaviour and what
goes wrong.

## Correctness
- Inverted/incorrect conditionals, off-by-one, wrong operator or comparison.
- Async bugs: missing `await`, unhandled rejection, `forEach` with an async body,
  race conditions / TOCTOU.
- Truthiness traps: `[]`/`0`/`''` treated as "absent"; `??` vs `||` confusion.
- Boundary/empty-collection cases that the change does not handle.

## Security
- Hardcoded secrets, missing authz checks, unsanitised input reaching a sink.
- Fail-open paths where the code should fail closed.
- Missing workspace/tenant scope on a data query.

## Tests
- New behaviour shipped without a test; deleted or weakened assertions.
- Tests that assert on mocks instead of real behaviour.
- Flaky patterns: time/order/network dependence without control.

## Scope
- Report ONLY issues introduced or worsened by THIS diff; ignore pre-existing code
  the change does not touch.
- Unrelated changes / drive-by refactors that obscure the actual change.
- Precision over volume: cap output at the **5 highest-signal findings**. If you
  would dismiss a finding as a likely false positive, drop it entirely.