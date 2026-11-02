# Arche

**元** — a self-improving agent that changes itself through reviewed Git commits.

Arche is an experiment in recursive self-improvement at the code level (L3). It does not chase unbounded capability growth. It runs a loop:

1. read failing tasks
2. propose a patch to its own `agent/`
3. evaluate the patch in an isolated sandbox
4. open a pull request
5. a human merges it only if the numbers improve

The harness, task set, sandbox, and branch protection sit outside the mutable scope. The agent can write branches. It cannot merge, edit workflows, or read secrets.

## Status

Design phase. See [DESIGN.md](./DESIGN.md).

## Principles

- The evaluator is not part of what gets optimized.
- Every promotion is a tag; every rollback is a revert.
- No merge without a human.
- If a patch cannot be measured, it is not an improvement.
