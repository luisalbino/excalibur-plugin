"use strict";
/**
 * grep-usages.js — helper FINO para localizar candidatos a usos de um símbolo num repo clonado.
 *
 * Propósito: reduzir tokens. Em vez de carregar arquivos inteiros, devolve uma lista de
 * `arquivo:linha: trecho` onde o símbolo aparece. A DECISÃO de impacto é do modelo — este
 * script só aponta candidatos. CoffeeScript não tem tipos (@metodo, `foo: (x) ->` vs
 * `foo = (x) ->`, nomes comuns geram ruído), então trate o resultado como pistas, não verdade.
 *
 * Usa ripgrep (rg) se disponível (rápido, respeita .gitignore); cai para varredura própria.
 *
 * Uso:
 *   node grep-usages.js --dir <repoDir> <simbolo> [<simbolo> ...] [--ext .coffee,.ts] [--json]
 *
 * Exemplo:
 *   node grep-usages.js --dir /tmp/pr-review-x/repos/owner__repo calcularFrete --ext .coffee
 */

const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

function parseArgs(argv) {
  let dir = ".";
  let exts = null;
  let json = false;
  const symbols = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--dir") dir = argv[++i];
    else if (a === "--ext") exts = argv[++i].split(",").map((s) => s.trim());
    else if (a === "--json") json = true;
    else symbols.push(a);
  }
  return { dir, exts, json, symbols };
}

function hasRg() {
  try {
    return spawnSync("rg", ["--version"], { stdio: "ignore" }).status === 0;
  } catch {
    return false;
  }
}

function rgSearch(dir, symbol, exts) {
  const args = ["--line-number", "--no-heading", "--color", "never", "--word-regexp"];
  if (exts) for (const e of exts) args.push("--glob", `*${e}`);
  args.push("--", symbol, dir);
  const r = spawnSync("rg", args, { encoding: "utf8", maxBuffer: 32 * 1024 * 1024 });
  if (r.status !== 0 && r.status !== 1) return []; // 1 = sem match
  return (r.stdout || "")
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => {
      const m = line.match(/^(.*?):(\d+):(.*)$/);
      if (!m) return null;
      return { file: path.relative(dir, m[1]), line: Number(m[2]), text: m[3].trim() };
    })
    .filter(Boolean);
}

function* walk(dir, exts) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const ent of entries) {
    if (ent.name === ".git" || ent.name === "node_modules") continue;
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) yield* walk(full, exts);
    else if (!exts || exts.some((e) => ent.name.endsWith(e))) yield full;
  }
}

function fallbackSearch(dir, symbol, exts) {
  const re = new RegExp(`\\b${symbol.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`);
  const out = [];
  for (const file of walk(dir, exts)) {
    let content;
    try {
      content = fs.readFileSync(file, "utf8");
    } catch {
      continue;
    }
    const lines = content.split(/\r?\n/);
    for (let i = 0; i < lines.length; i++) {
      if (re.test(lines[i])) {
        out.push({ file: path.relative(dir, file), line: i + 1, text: lines[i].trim() });
      }
    }
  }
  return out;
}

function main() {
  const { dir, exts, json, symbols } = parseArgs(process.argv.slice(2));
  if (symbols.length === 0) {
    console.error("Uso: node grep-usages.js --dir <repoDir> <simbolo> [...] [--ext .coffee,.ts] [--json]");
    process.exit(2);
  }
  const useRg = hasRg();
  const result = {};
  for (const sym of symbols) {
    const hits = useRg ? rgSearch(dir, sym, exts) : fallbackSearch(dir, sym, exts);
    result[sym] = hits;
  }

  if (json) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }
  for (const sym of symbols) {
    const hits = result[sym];
    console.log(`\n== ${sym} (${hits.length} candidatos${useRg ? "" : ", fallback"}) ==`);
    for (const h of hits) console.log(`${h.file}:${h.line}: ${h.text}`);
  }
}

main();
