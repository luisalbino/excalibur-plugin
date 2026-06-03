# excalibur-plugin

Plugin Claude Code com exemplos de todos os tipos de componente: slash command, skill, agent, hook e MCP server. Use como ponto de partida — substitua os placeholders com sua lógica.

## Componentes incluídos

| Tipo | Arquivo | Invocação |
|------|---------|-----------|
| Command | `commands/hello.md` | `/excalibur-plugin:hello [args]` |
| Skill | `skills/excalibur/SKILL.md` | `/excalibur-plugin:excalibur` ou auto |
| Agent | `agents/excalibur-helper.md` | Via `Agent` tool com `subagent_type: excalibur-plugin:excalibur-helper` |
| Hook | `hooks/hooks.json` + `scripts/session-start.js` | Automático no `SessionStart` |
| MCP server | `.mcp.json` | Ativar: remover `"disabled": true` e configurar o pacote |

## Instalar a partir do GitHub

Substitua `SEU-USUARIO` pelo seu nome de usuário do GitHub:

```
/plugin marketplace add SEU-USUARIO/excalibur-plugin
/plugin install excalibur-plugin@excalibur-marketplace
```

## Desenvolvimento local

Teste sem publicar, passando o diretório diretamente:

```bash
claude --plugin-dir /caminho/para/excalibur-plugin
```

Dentro da sessão, use `/excalibur-plugin:hello` para confirmar que o plugin carregou.

## Estrutura

```
excalibur-plugin/
├── .claude-plugin/
│   ├── plugin.json          # Manifest do plugin (name, version, description, author)
│   └── marketplace.json     # Catalog do marketplace — aponta pra "./" (este repo)
├── commands/
│   └── hello.md             # Slash command: /excalibur-plugin:hello
├── skills/
│   └── excalibur/
│       └── SKILL.md         # Skill auto-invocável
├── agents/
│   └── excalibur-helper.md  # Subagente especializado
├── hooks/
│   └── hooks.json           # Configuração de hooks
├── scripts/
│   └── session-start.js     # Script do hook SessionStart (Node, cross-platform)
└── .mcp.json                # Configuração de MCP server (desabilitado por padrão)
```

## Personalizar cada componente

### Command (`commands/hello.md`)
- Frontmatter `description`: Claude usa para auto-sugestão.
- Corpo: instrução em linguagem natural + `$ARGUMENTS` para input do usuário.

### Skill (`skills/excalibur/SKILL.md`)
- Frontmatter `description`: **mais específica = melhor decisão de invocação automática**.
- Frontmatter `name`: sobrescreve o nome da pasta para invocação.
- Adicione arquivos `.md` de referência na mesma pasta — a skill pode carregá-los.

### Agent (`agents/excalibur-helper.md`)
- Ajuste `model`: `haiku` (rápido/barato), `sonnet` (balanceado), `opus` (raciocínio profundo).
- Ajuste `tools`: apenas o necessário — princípio do menor privilégio.
- `maxTurns`: limite de iterações para evitar loops. Padrão do sistema: 20.

### Hook (`hooks/hooks.json` + `scripts/session-start.js`)
- Eventos disponíveis: `SessionStart`, `PreToolUse`, `PostToolUse`, `Stop`, e [muitos outros](https://code.claude.com/docs/en/plugins-reference.md).
- O script Node recebe variáveis via `process.env`: `CLAUDE_PLUGIN_ROOT`, `CLAUDE_PLUGIN_DATA`, `CLAUDE_PROJECT_DIR`.
- Stdout do script → injetado como contexto de sistema para Claude.
- Stderr → exibido como aviso no terminal.

### MCP Server (`.mcp.json`)
- Substitua `"your-mcp-package@latest"` pelo pacote npm do seu MCP server.
- Remova `"disabled": true` para ativar.
- Use `${user_config.CHAVE}` para variáveis configuradas pelo usuário, ou `${ENV_VAR}` para variáveis de ambiente.

## Publicar e versionar

1. Crie o repo no GitHub: `https://github.com/SEU-USUARIO/excalibur-plugin`
2. Push inicial:
   ```bash
   git remote add origin https://github.com/SEU-USUARIO/excalibur-plugin.git
   git branch -M main
   git push -u origin main
   ```
3. Para cada release, bumpe `version` em `.claude-plugin/plugin.json` (ex: `0.1.0` → `0.2.0`) e faça push. Sem bump de versão, usuários instalados **não** recebem o update.

## Licença

MIT — veja [LICENSE](LICENSE).
