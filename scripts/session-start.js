#!/usr/bin/env node
/**
 * Hook: SessionStart
 * Roda ao iniciar cada sessão Claude Code com este plugin ativo.
 *
 * Variáveis disponíveis via process.env:
 *   CLAUDE_PLUGIN_ROOT  — diretório do plugin instalado
 *   CLAUDE_PLUGIN_DATA  — diretório de dados persistentes do plugin
 *   CLAUDE_PROJECT_DIR  — raiz do projeto atual
 *
 * Saída para stdout: texto que aparece como contexto de sistema para Claude.
 * Saída para stderr: aparece como aviso/erro no terminal.
 * Exit code 1: Claude trata como falha e pode interromper o fluxo.
 *
 * Exemplo abaixo: emite uma mensagem de contexto simples.
 * Substitua com sua lógica: carregar config, checar ambiente, injetar contexto, etc.
 */

const pluginRoot = process.env.CLAUDE_PLUGIN_ROOT || "(desconhecido)";
const projectDir = process.env.CLAUDE_PROJECT_DIR || "(nenhum)";

// Emite contexto para Claude via stdout (opcional — remova se não precisar)
process.stdout.write(
  `excalibur-plugin ativo. Plugin root: ${pluginRoot} | Projeto: ${projectDir}\n`
);

// Para apenas logar no terminal sem injetar contexto, use stderr:
// process.stderr.write("excalibur-plugin: sessão iniciada.\n");
