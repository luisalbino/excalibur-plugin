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
 *     // `event` é IGNORADO: a review é SEMPRE postada como REQUEST_CHANGES (gate de merge).
 *     "summary": "Resumo geral em markdown",
 *     "comments": [
 *       { "path": "client/scripts/x.coffee", "line": 42, "side": "RIGHT", "severity": "Crítico", "body": "..." },
 *       { "path": "...", "start_line": 10, "line": 14, "side": "RIGHT", "severity": "Médio", "body": "..." }
 *     ]
 *   }
 *
 * `line` = número da linha no arquivo (lado novo => side RIGHT; lado antigo => LEFT).
 * A linha PRECISA fazer parte do diff, senão a API rejeita aquele comentário.
 *
 * `severity` ∈ {Baixo, Médio, Alto, Crítico} (default: Médio). O GitHub renderiza os comentários
 * inline na ordem do diff (arquivo/linha), NÃO na ordem do array — então a prioridade não pode ser
 * expressa pela posição inline. Para garantir ordenação por prioridade SEMPRE, este script:
 *   1. ordena os comentários por severidade desc (estável, mantém ordem de diff no desempate);
 *   2. prefixa cada `body` com um badge de severidade + rank (ex.: `🔴 #1 · Crítico`);
 *   3. anexa ao `summary` um índice "Comentários por prioridade" — esse bloco é renderizado na
 *      ordem em que é escrito, dando a leitura priorizada que o inline sozinho não dá.
 *
 * Uso:
 *   node post-review.js <review.json> [--post]
 */

const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const { ghOrThrow } = require("./gh-util");

// Severidade → peso (ordenação) + badge (rótulo visível inline).
const SEVERITY = {
  "crítico": { rank: 4, badge: "🔴", label: "Crítico" },
  critico: { rank: 4, badge: "🔴", label: "Crítico" },
  alto: { rank: 3, badge: "🟠", label: "Alto" },
  "médio": { rank: 2, badge: "🟡", label: "Médio" },
  medio: { rank: 2, badge: "🟡", label: "Médio" },
  baixo: { rank: 1, badge: "🔵", label: "Baixo" },
};
const DEFAULT_SEVERITY = SEVERITY["médio"];

function severityOf(c) {
  const key = String(c.severity || "").trim().toLowerCase();
  return SEVERITY[key] || DEFAULT_SEVERITY;
}

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

  // Ordena por severidade desc, mantendo a ordem original como desempate (sort estável no Node).
  const ordered = (review.comments || [])
    .map((c, i) => ({ c, i, sev: severityOf(c) }))
    .sort((a, b) => b.sev.rank - a.sev.rank || a.i - b.i);

  const comments = ordered.map(({ c, sev }, idx) => {
    const rank = idx + 1;
    const prefix = `${sev.badge} #${rank} · ${sev.label}`;
    // Não duplica o badge se o body já começa com ele (re-execução idempotente).
    const body = c.body && c.body.startsWith(sev.badge) ? c.body : `${prefix}\n\n${c.body}`;
    const o = { path: c.path, line: c.line, side: c.side || "RIGHT", body };
    if (c.start_line) {
      o.start_line = c.start_line;
      o.start_side = c.start_side || o.side;
    }
    return o;
  });

  // Índice priorizado anexado ao resumo — renderizado na ordem (o inline não respeita ordem de array).
  let summary = review.summary || "";
  if (ordered.length) {
    const index = ordered
      .map(({ c, sev }, idx) => {
        const firstLine = String(c.body || "").split("\n")[0].replace(/^#+\s*/, "").trim();
        const loc = c.start_line ? `${c.path}:${c.start_line}-${c.line}` : `${c.path}:${c.line}`;
        return `${idx + 1}. ${sev.badge} **${sev.label}** — \`${loc}\`${firstLine ? ` — ${firstLine}` : ""}`;
      })
      .join("\n");
    summary += `\n\n## Comentários por prioridade\n\n${index}`;
  }

  // A pr-review SEMPRE pede ajustes (gate de merge), nunca só comenta. Forçamos REQUEST_CHANGES
  // aqui — não no campo `event` do review.json — para que nenhum input mal montado consiga
  // rebaixar a review para um COMMENT advisory que não bloqueia o merge.
  const payload = {
    commit_id: commitId,
    event: "REQUEST_CHANGES",
    body: summary,
    comments,
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
