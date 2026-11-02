# Harness (M0)

Runs each task twice: once with the `good` overlay and once with the `bad` overlay.
The suite passes only when the good patch passes and the bad patch fails for every task.

```bash
bun run m0
```

Run a single task:

```bash
bun harness/run.ts slugify good
bun harness/run.ts slugify bad
```

A task is a directory under `tasks/`:

```
tasks/<id>/
  task.json          # { "id": "...", "command": ["bun", "test"] }
  repo/              # starting code
  patches/good/      # files copied over repo/ before running
  patches/bad/       # files copied over repo/ before running
```

M0 uses file overlays instead of unified diffs because the goal is to validate the
evaluator, not patch parsing. The mutator will produce real diffs later.

## Mutator

`bun run mutate <task>` calls an OpenAI-compatible chat completions endpoint,
writes `candidates/<task>-model/`, and scores it. Configuration:

```bash
ARCHE_API_KEY=...
ARCHE_BASE_URL=https://api.deepseek.com
ARCHE_MODEL=deepseek-chat
ARCHE_ENV_FILE=/path/to/api.env   # optional
```

Never commit the env file.
