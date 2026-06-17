"use strict";
/**
 * cleanup.js — remove os diretórios temporários criados pela revisão.
 *
 * Aceita um caminho de manifest.json (lê `workdir`) ou um diretório direto.
 * Recusa apagar qualquer coisa fora de os.tmpdir() por segurança.
 *
 * Uso:
 *   node cleanup.js <manifest.json | workdir>
 */

const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");

function main() {
  const target = process.argv[2];
  if (!target) {
    console.error("Uso: node cleanup.js <manifest.json | workdir>");
    process.exit(2);
  }

  let dir = target;
  try {
    const stat = fs.statSync(target);
    if (stat.isFile() && target.endsWith(".json")) {
      const manifest = JSON.parse(fs.readFileSync(target, "utf8"));
      if (manifest.workdir) dir = manifest.workdir;
    }
  } catch {
    // segue com target como dir
  }

  const resolved = path.resolve(dir);
  const tmpRoot = path.resolve(os.tmpdir());
  if (!resolved.startsWith(tmpRoot)) {
    console.error(
      `[cleanup] RECUSADO: ${resolved} está fora do temp (${tmpRoot}). ` +
        "Por segurança só removo diretórios temporários da revisão."
    );
    process.exit(1);
  }

  fs.rmSync(resolved, { recursive: true, force: true });
  console.error(`[cleanup] removido: ${resolved}`);
}

main();
