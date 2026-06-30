"use strict";
/**
 * fetch-comments.js — coleta os COMENTÁRIOS HUMANOS de uma ou mais PRs.
 *
 * Fonte de aprendizado da skill `pr-learn`: o que revisores humanos apontaram numa
 * PR já revisada. NÃO clona o repo nem baixa o diff completo — o `diff_hunk` de cada
 * comentário inline já traz o contexto de código necessário para destilar o ensinamento.
 *
 * Por PR, junta:
 *   - bodies de review (aprovações/changes-requested com texto)  → `gh pr view --json reviews`
 *   - comentários de issue (discussão geral da PR)               → `gh pr view --json comments`
 *   - comentários INLINE (com path/line/diff_hunk)               → `gh api .../pulls/{n}/comments`
 *
 * Comentários inline só vêm da REST API — `gh pr view` não os traz. Por isso as duas chamadas.
 *
 * Emite um JSON consolidado no stdout (texto que o modelo lê e generaliza). Logs vão pro stderr.
 * Entradas com corpo vazio são descartadas aqui (ruído puro, ex.: APPROVE sem texto); a filtragem
 * semântica (bot/LGTM/nit/autor da PR) fica para o modelo na skill.
 *
 * Uso:
 *   node fetch-comments.js <url-pr> [<url-pr> ...]
 *
 * Cross-platform (Windows/macOS/Linux). Resolve gh via gh-util do pr-review (não depende do PATH).
 */

const path = require("node:path");
const { resolveGh, ghOrThrow } = require(path.join(
  __dirname,
  "..",
  "..",
  "pr-review",
  "scripts",
  "gh-util"
));

/** https://github.com/owner/repo/pull/123 -> { owner, repo, number, nwo, url } */
function parsePrUrl(url) {
  const m = url.match(/github\.com[/:]([^/]+)\/([^/]+)\/pull\/(\d+)/i);
  if (!m) throw new Error(`URL de PR inválida: ${url}`);
  const owner = m[1];
  const repo = m[2].replace(/\.git$/, "");
  return { owner, repo, number: Number(m[3]), nwo: `${owner}/${repo}`, url };
}

function nonEmpty(s) {
  return typeof s === "string" && s.trim().length > 0;
}

/** Comentários inline da REST API (com âncora de código). Paginado via JSONL. */
function fetchInline(pr) {
  // `--jq '.[]'` emite UM objeto JSON por linha (JSONL), unindo todas as páginas de
  // forma robusta — evita o `[...][...]` inválido que `--paginate` gera num array cru.
  const out = ghOrThrow([
    "api",
    "--paginate",
    `repos/${pr.owner}/${pr.repo}/pulls/${pr.number}/comments`,
    "--jq",
    ".[]",
  ]);
  const items = [];
  for (const line of out.split("\n")) {
    const t = line.trim();
    if (!t) continue;
    try {
      items.push(JSON.parse(t));
    } catch {
      /* ignora linha parcial de borda de paginação */
    }
  }
  return items
    .filter((c) => nonEmpty(c.body))
    .map((c) => ({
      author: c.user && c.user.login,
      path: c.path,
      line: c.line != null ? c.line : c.original_line,
      diffHunk: c.diff_hunk,
      body: c.body,
      inReplyTo: c.in_reply_to_id || null,
    }));
}

function main() {
  const urls = process.argv.slice(2).filter((a) => !a.startsWith("--"));
  if (urls.length === 0) {
    console.error("Informe ao menos uma URL de PR.\nUso: node fetch-comments.js <url-pr> [...]");
    process.exit(2);
  }

  resolveGh(); // valida cedo, com mensagem de install se faltar

  const prs = urls.map(parsePrUrl).map((pr) => {
    console.error(`[fetch-comments] coletando ${pr.nwo} #${pr.number} ...`);

    const view = JSON.parse(
      ghOrThrow([
        "pr",
        "view",
        String(pr.number),
        "--repo",
        pr.nwo,
        "--json",
        "title,reviews,comments",
      ])
    );

    const reviewSummaries = (view.reviews || [])
      .filter((r) => nonEmpty(r.body))
      .map((r) => ({
        author: r.author && r.author.login,
        state: r.state,
        body: r.body,
      }));

    const issueComments = (view.comments || [])
      .filter((c) => nonEmpty(c.body))
      .map((c) => ({ author: c.author && c.author.login, body: c.body }));

    let inlineComments = [];
    try {
      inlineComments = fetchInline(pr);
    } catch (e) {
      console.error(`[fetch-comments] aviso: comentários inline indisponíveis (${e.message})`);
    }

    return {
      url: pr.url,
      nwo: pr.nwo,
      number: pr.number,
      title: view.title,
      reviewSummaries,
      issueComments,
      inlineComments,
    };
  });

  const total = prs.reduce(
    (n, p) => n + p.reviewSummaries.length + p.issueComments.length + p.inlineComments.length,
    0
  );
  console.error(`[fetch-comments] ${total} comentário(s) humano(s) com texto coletado(s).`);

  // stdout = JSON consolidado (o modelo lê e generaliza). Logs ficaram no stderr.
  console.log(JSON.stringify({ generatedBy: "fetch-comments.js", prs }, null, 2));
}

try {
  main();
} catch (e) {
  console.error(`[fetch-comments] ERRO: ${e.message}`);
  process.exit(1);
}
