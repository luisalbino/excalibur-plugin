"use strict";
/**
 * pr-fetch.js — baixa tudo que a revisão precisa de uma ou mais PRs, com mínimo de tokens.
 *
 * Para cada URL de PR:
 *   - coleta metadata (título, estado, base/head, autor, +/-, arquivos) via `gh pr view --json`
 *   - salva o diff unificado em arquivo (`gh pr diff`)
 *   - clona cada repo envolvido UMA vez em os.tmpdir() e faz checkout do head (`gh pr checkout`)
 *     para permitir análise de impacto na árvore completa (achar consumidores de métodos etc.)
 *
 * Emite um manifest.json apontando para todos os artefatos. O corpo da skill lê o manifest
 * e os arquivos sob demanda — não recarrega tudo no contexto.
 *
 * Uso:
 *   node pr-fetch.js <url-pr> [<url-pr> ...] [--out <dir>] [--no-clone]
 *
 * Exemplo:
 *   node pr-fetch.js https://github.com/owner/repo/pull/4932 https://github.com/owner/repo/pull/5031
 *
 * Cross-platform (Windows/macOS/Linux). Resolve gh via gh-util (não depende do PATH).
 */

const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const { spawnSync } = require("node:child_process");
const { resolveGh, gh, ghOrThrow } = require("./gh-util");

function parseArgs(argv) {
  const urls = [];
  let out = null;
  let clone = true;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--out") out = argv[++i];
    else if (a === "--no-clone") clone = false;
    else urls.push(a);
  }
  return { urls, out, clone };
}

/** https://github.com/owner/repo/pull/123 -> { owner, repo, number, nwo } */
function parsePrUrl(url) {
  const m = url.match(/github\.com[/:]([^/]+)\/([^/]+)\/pull\/(\d+)/i);
  if (!m) throw new Error(`URL de PR inválida: ${url}`);
  const owner = m[1];
  const repo = m[2].replace(/\.git$/, "");
  return { owner, repo, number: Number(m[3]), nwo: `${owner}/${repo}`, url };
}

function rand() {
  return Math.random().toString(36).slice(2, 10);
}

function run(cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, { encoding: "utf8", stdio: "inherit", ...opts });
  if (r.status !== 0) {
    throw new Error(`${cmd} ${args.join(" ")} falhou (status ${r.status})`);
  }
}

function main() {
  const { urls, out, clone } = parseArgs(process.argv.slice(2));
  if (urls.length === 0) {
    console.error("Informe ao menos uma URL de PR.\nUso: node pr-fetch.js <url-pr> [...] [--out <dir>] [--no-clone]");
    process.exit(2);
  }

  resolveGh(); // valida cedo, com mensagem de install se faltar

  const workdir = out || path.join(os.tmpdir(), `pr-review-${rand()}`);
  fs.mkdirSync(workdir, { recursive: true });

  const ghBin = resolveGh();
  const prs = urls.map(parsePrUrl);
  const repos = {}; // nwo -> { dir, cloned }

  // 1. Clona cada repo único e faz checkout do head da primeira PR daquele repo.
  if (clone) {
    for (const pr of prs) {
      if (repos[pr.nwo]) continue;
      const repoDir = path.join(workdir, "repos", pr.nwo.replace("/", "__"));
      fs.mkdirSync(path.dirname(repoDir), { recursive: true });
      console.error(`[pr-fetch] clonando ${pr.nwo} ...`);
      // Partial clone: rápido, mas mantém refs para `gh pr checkout` funcionar.
      run(ghBin, ["repo", "clone", pr.nwo, repoDir, "--", "--filter=blob:none", "--no-tags"]);
      repos[pr.nwo] = { dir: repoDir, cloned: true };
    }
    // checkout do head de cada PR (em repos com 1 PR, deixa a árvore no head)
    for (const pr of prs) {
      const repoDir = repos[pr.nwo].dir;
      console.error(`[pr-fetch] checkout PR #${pr.number} em ${pr.nwo} ...`);
      const r = spawnSync(ghBin, ["pr", "checkout", String(pr.number), "--repo", pr.nwo], {
        cwd: repoDir,
        encoding: "utf8",
        stdio: "inherit",
      });
      if (r.status !== 0) {
        console.error(`[pr-fetch] aviso: checkout da PR #${pr.number} falhou; árvore fica na base.`);
      }
      pr.headCheckedOut = r.status === 0;
    }
  }

  // 2. Metadata + diff por PR.
  const manifestPrs = [];
  for (const pr of prs) {
    const tag = `${pr.owner}__${pr.repo}__${pr.number}`;
    const metaJson = ghOrThrow([
      "pr", "view", String(pr.number), "--repo", pr.nwo,
      "--json", "title,state,body,author,baseRefName,headRefName,headRefOid,additions,deletions,changedFiles,files,url,createdAt",
    ]);
    const metaPath = path.join(workdir, `pr-${tag}.meta.json`);
    fs.writeFileSync(metaPath, metaJson);

    const diff = ghOrThrow(["pr", "diff", String(pr.number), "--repo", pr.nwo]);
    const diffPath = path.join(workdir, `pr-${tag}.diff`);
    fs.writeFileSync(diffPath, diff);

    const meta = JSON.parse(metaJson);
    manifestPrs.push({
      url: pr.url,
      nwo: pr.nwo,
      number: pr.number,
      title: meta.title,
      state: meta.state,
      baseRefName: meta.baseRefName,
      headRefName: meta.headRefName,
      headRefOid: meta.headRefOid,
      additions: meta.additions,
      deletions: meta.deletions,
      changedFiles: meta.changedFiles,
      files: (meta.files || []).map((f) => f.path),
      repoDir: repos[pr.nwo] ? repos[pr.nwo].dir : null,
      headCheckedOut: !!pr.headCheckedOut,
      metaPath,
      diffPath,
    });
  }

  const manifest = {
    generatedBy: "pr-fetch.js",
    workdir,
    ghBin,
    repos: Object.fromEntries(Object.entries(repos).map(([k, v]) => [k, v.dir])),
    prs: manifestPrs,
  };
  const manifestPath = path.join(workdir, "manifest.json");
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

  // stdout = só o caminho do manifest (fácil de capturar). Logs vão pro stderr.
  console.log(manifestPath);
}

try {
  main();
} catch (e) {
  console.error(`[pr-fetch] ERRO: ${e.message}`);
  process.exit(1);
}
