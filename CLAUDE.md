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
- **Squad de review (agents)** — `agents/pr-squad-{regressao,tenant,usuario,arquitetura}.md`. Quatro lentes especialistas usadas **internamente** pela skill `pr-review` (não auto-invocáveis pelo usuário). O orquestrador da skill fatia o diff em blocos lógicos e dispara as 4 em paralelo (custo fixo, não escala com o nº de blocos); cada lente avalia a PR sob uma dimensão e retorna achados marcados por bloco. O contrato compartilhado (mapa de blocos, formato de saída, placar por bloco) vive em `skills/pr-review/squad-protocol.md` — fonte única da verdade para skill + agents. Ao alterar formato de saída, severidade ou agregação, edite esse protocolo, não cada agente.
- **Loop de aprendizado (skill `pr-learn` → `pr-review`)** — `commands/pr-learn.md` + `skills/pr-learn/`. A skill `pr-learn` lê os **comentários humanos** de uma PR já revisada (`skills/pr-learn/scripts/fetch-comments.js`, que reusa o `gh-util.js` da pr-review), generaliza cada um numa heurística transferível mapeada a uma das 4 dimensões da squad, e mescla (sem duplicar) numa base de conhecimento global. A base é **markdown gerado em runtime** (`pr-review-learnings.md`), **não versionado**, salvo em `CLAUDE_PLUGIN_DATA` para sobreviver a updates de versão. `scripts/learnings-path.js` (raiz do plugin) é a **fonte única do caminho** — `pr-learn` escreve, `pr-review` lê (no novo passo 1.5) e injeta a seção de cada dimensão na lente correspondente como "Conhecimento prévio". Lições são checklist de risco, **não achado automático** — a lente só reporta se o diff confirmar (regra em `squad-protocol.md` §1.1).
- **Skills de produto (não-scaffold)** — `skills/analise-orcamento/` e `skills/devolutiva-360/`, cada uma com seu command fino em `commands/` que delega via `Invoque a skill excalibur:<nome>`. `devolutiva-360` carrega assets (`assets/calc_medias.py`, `assets/template_devolutiva.html`) do próprio diretório da skill. São o padrão real do plugin: command magro + skill com a lógica + assets co-localizados.
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
