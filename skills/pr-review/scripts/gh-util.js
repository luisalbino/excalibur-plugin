"use strict";
/**
 * Utilitário compartilhado: resolve o binário do GitHub CLI (`gh`) de forma robusta.
 *
 * Motivo: em algumas máquinas (ex.: Windows logo após instalar via winget) o `gh`
 * está instalado mas NÃO no PATH do shell atual. Assumir PATH faz todo script falhar
 * com "gh: command not found". Aqui tentamos PATH primeiro e caímos para caminhos de
 * instalação conhecidos antes de desistir com instrução de install.
 */

const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");

const WINDOWS_CANDIDATES = [
  "C:\\Program Files\\GitHub CLI\\gh.exe",
  "C:\\Program Files (x86)\\GitHub CLI\\gh.exe",
  path.join(os.homedir(), "AppData", "Local", "Programs", "GitHub CLI", "gh.exe"),
];

const UNIX_CANDIDATES = ["/usr/bin/gh", "/usr/local/bin/gh", "/opt/homebrew/bin/gh"];

function works(bin) {
  try {
    const r = spawnSync(bin, ["--version"], { stdio: "ignore" });
    return r.status === 0;
  } catch {
    return false;
  }
}

let cached = null;

/** Devolve um caminho/comando de gh que funciona, ou lança erro com instrução. */
function resolveGh() {
  if (cached) return cached;

  // 1. PATH
  if (works("gh")) return (cached = "gh");

  // 2. caminhos conhecidos
  const candidates = process.platform === "win32" ? WINDOWS_CANDIDATES : UNIX_CANDIDATES;
  for (const c of candidates) {
    if (fs.existsSync(c) && works(c)) return (cached = c);
  }

  throw new Error(
    "GitHub CLI (gh) não encontrado.\n" +
      "Instale e autentique:\n" +
      "  Windows: winget install --id GitHub.cli\n" +
      "  macOS:   brew install gh\n" +
      "  Linux:   https://github.com/cli/cli#installation\n" +
      "Depois: gh auth login\n" +
      "Se já instalou, reinicie o terminal para atualizar o PATH."
  );
}

/** Executa gh com args; devolve { status, stdout, stderr }. */
function gh(args, opts = {}) {
  const bin = resolveGh();
  const r = spawnSync(bin, args, {
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024, // diffs grandes
    ...opts,
  });
  return { status: r.status, stdout: r.stdout || "", stderr: r.stderr || "" };
}

/** Igual a gh(), mas lança se status != 0. */
function ghOrThrow(args, opts = {}) {
  const r = gh(args, opts);
  if (r.status !== 0) {
    throw new Error(`gh ${args.join(" ")} falhou (status ${r.status}):\n${r.stderr || r.stdout}`);
  }
  return r.stdout;
}

module.exports = { resolveGh, gh, ghOrThrow };
