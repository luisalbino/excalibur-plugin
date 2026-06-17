# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A **Claude Code plugin** scaffold demonstrating one working example of every plugin component type: slash command, skill, agent, hook, and MCP server. There is no application code, build step, package manager, or test suite — the "code" is the plugin manifest plus markdown/JSON component definitions that Claude Code loads at runtime. The README is in Portuguese; component bodies are too.

## Key fact: it's both a plugin and its own marketplace

The repo root (`./`) is referenced by `.claude-plugin/marketplace.json` as the plugin source. So this single repo serves simultaneously as the marketplace catalog and the plugin it distributes. The two manifests must stay consistent:
- `.claude-plugin/plugin.json` — the plugin manifest (`name`, `version`, `description`, `author`).
- `.claude-plugin/marketplace.json` — the marketplace catalog; its `plugins[].name` must match `plugin.json`'s `name`, and `source` points at `"./"`.

## How components wire together

Every component is namespaced under the plugin name `excalibur`:

- **Command** — `commands/pr-review.md`. Markdown with a `description` frontmatter; body is a natural-language instruction that invokes the `pr-review` skill. `$ARGUMENTS` interpolates user input (PR links). Invoked as `/excalibur:pr-review [links]`.
- **Skill** — `skills/excalibur/SKILL.md`. The `name` frontmatter overrides the folder name for invocation; `description` drives auto-invocation (more specific = better). Reference `.md` files placed in the same folder can be loaded by the skill.
- **Agent** — `agents/excalibur-helper.md`. Frontmatter sets `model` (`haiku`/`sonnet`/`opus`), `tools` (least privilege), and optional `maxTurns`. Invoked via the Agent tool with `subagent_type: excalibur:excalibur-helper`.
- **Hook** — `hooks/hooks.json` registers a `SessionStart` hook that runs `scripts/session-start.js` via Node. The script path uses `${CLAUDE_PLUGIN_ROOT}`. The script reads env vars (`CLAUDE_PLUGIN_ROOT`, `CLAUDE_PLUGIN_DATA`, `CLAUDE_PROJECT_DIR`); **stdout is injected as system context for Claude, stderr is a terminal-only warning, exit code 1 signals failure.** Hook scripts must be cross-platform Node (this repo targets Windows + others).
- **MCP server** — `.mcp.json`. Disabled by default (`"disabled": true`). Uses `${user_config.KEY}` for user-configured values and `${ENV_VAR}` for environment variables.

## Developing and testing

There is no build/lint/test tooling. To test changes, load the plugin directly from disk:

```bash
claude --plugin-dir /caminho/para/excalibur-plugin
```

Then inside the session run `/excalibur:pr-review` to confirm the plugin loaded.

## Releasing

Users who already installed the plugin only receive updates when the `version` field in `.claude-plugin/plugin.json` is bumped (e.g. `0.1.0` → `0.2.0`). **A push without a version bump does not propagate to installed users.**
