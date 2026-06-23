"use strict";
/**
 * learnings-path.js — fonte única do caminho da base de conhecimento de reviews.
 *
 * A base (`pr-review-learnings.md`) é o arquivo onde a skill `pr-learn` acumula
 * heurísticas gerais extraídas de comentários humanos de PRs, e que a skill
 * `pr-review` carrega para injetar nas 4 lentes. Os dois lados resolvem o caminho
 * por aqui — assim ele nunca diverge.
 *
 * Onde fica:
 *   - `CLAUDE_PLUGIN_DATA` (diretório de dados persistente do plugin) se setado.
 *     Sobrevive a updates de versão; fica FORA do cache versionado do plugin.
 *   - fallback: <home>/.claude/excalibur-data  (quando a env não está disponível,
 *     ex.: rodando o script solto fora do runtime do plugin).
 *
 * Cria o diretório se faltar. Imprime o caminho do arquivo no stdout (padrão dos
 * scripts deste plugin: stdout = dado capturável, logs vão pro stderr).
 *
 * Uso:
 *   node learnings-path.js
 */

const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");

const FILE_NAME = "pr-review-learnings.md";

/** Resolve o diretório de dados estável do plugin. */
function dataDir() {
  const fromEnv = process.env.CLAUDE_PLUGIN_DATA;
  if (fromEnv && fromEnv.trim()) return fromEnv;
  return path.join(os.homedir(), ".claude", "excalibur-data");
}

/** Resolve o caminho do arquivo da base, garantindo que o diretório exista. */
function learningsPath() {
  const dir = dataDir();
  fs.mkdirSync(dir, { recursive: true });
  return path.join(dir, FILE_NAME);
}

module.exports = { learningsPath, dataDir, FILE_NAME };

if (require.main === module) {
  try {
    console.log(learningsPath());
  } catch (e) {
    console.error(`[learnings-path] ERRO: ${e.message}`);
    process.exit(1);
  }
}
