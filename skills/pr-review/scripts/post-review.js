"use strict";
/**
 * post-review.js — posta UMA review com comentários inline batchados numa PR (via gh api).
 *
 * SEGURANÇA: por padrão roda em DRY-RUN (só imprime o payload). Só posta de verdade com
 * a flag explícita `--post`. Assim o harness de avaliação nunca escreve nas PRs reais —
 * ele invoca sem `--post`. Em revisão real, a skill chama com `--post`.
 *
 * Batcha tudo numa única review (não N comentários soltos), reduzindo notificações.
 *
 * Entrada: arquivo JSON com:
 *   {
 *     "nwo": "owner/repo",
 *     "number": 4932,
 *     "commit_id": "<sha opcional; se ausente, busca o head atual>",
 *     "event": "COMMENT",            // COMMENT | REQUEST_CHANGES | APPROVE
 *     "summary": "Resumo geral em markdown",
 *     "comments": [
 *       { "path": "client/scripts/x.coffee", "line": 42, "side": "RIGHT", "body": "..." },
 *       { "path": "...", "start_line": 10, "line": 14, "side": "RIGHT", "body": "..." }
 *     ]
 *   }
 *
 * `line` = número da linha no arquivo (lado novo => side RIGHT; lado antigo => LEFT).
 * A linha PRECISA fazer parte do diff, senão a API rejeita aquele comentário.
 *
 * Uso:
 *   node post-review.js <review.json> [--post]
 */

const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const { ghOrThrow } = require("./gh-util");

function main() {
  const argv = process.argv.slice(2);
  const post = argv.includes("--post");
  const inputPath = argv.find((a) => a !== "--post");
  if (!inputPath) {
    console.error("Uso: node post-review.js <review.json> [--post]");
    process.exit(2);
  }

  const review = JSON.parse(fs.readFileSync(inputPath, "utf8"));
  if (!review.nwo || !review.number) {
    throw new Error("review.json precisa de `nwo` e `number`.");
  }

  let commitId = review.commit_id;
  if (!commitId) {
    const meta = JSON.parse(
      ghOrThrow(["pr", "view", String(review.number), "--repo", review.nwo, "--json", "headRefOid"])
    );
    commitId = meta.headRefOid;
  }

  const payload = {
    commit_id: commitId,
    event: review.event || "COMMENT",
    body: review.summary || "",
    comments: (review.comments || []).map((c) => {
      const o = { path: c.path, line: c.line, side: c.side || "RIGHT", body: c.body };
      if (c.start_line) {
        o.start_line = c.start_line;
        o.start_side = c.start_side || o.side;
      }
      return o;
    }),
  };

  if (!post) {
    console.error("[post-review] DRY-RUN (sem --post). Payload que SERIA enviado:");
    console.log(JSON.stringify(payload, null, 2));
    console.error(
      `[post-review] ${payload.comments.length} comentário(s) inline + resumo. ` +
        `Rode com --post para publicar em ${review.nwo}#${review.number}.`
    );
    return;
  }

  const tmp = path.join(os.tmpdir(), `pr-review-payload-${Date.now()}.json`);
  fs.writeFileSync(tmp, JSON.stringify(payload));
  try {
    const out = ghOrThrow([
      "api",
      "--method", "POST",
      `repos/${review.nwo}/pulls/${review.number}/reviews`,
      "--input", tmp,
    ]);
    const res = JSON.parse(out);
    console.error(`[post-review] Review publicada: ${res.html_url || res.id}`);
    console.log(res.html_url || String(res.id));
  } finally {
    try {
      fs.unlinkSync(tmp);
    } catch {}
  }
}

try {
  main();
} catch (e) {
  console.error(`[post-review] ERRO: ${e.message}`);
  process.exit(1);
}
