---
name: pr-review
description: Revisão profunda e criteriosa de Pull Requests, focada em riscos REAIS — regressão, impacto indireto, efeitos em outros clientes/tenants, métodos compartilhados, casos de borda, arquitetura e código morto. Use SEMPRE que o usuário enviar um ou mais links de Pull Request (GitHub) e quiser avaliação/feedback, ou pedir para "revisar PR", "fazer review", "analisar esse pull request", "o que acha dessa PR", "vê se vai quebrar algo / tem risco", "confere antes de mergear" — mesmo sem dizer a palavra "revisar". Inclui PRs relacionadas em repositórios diferentes (par backend+frontend) e checagem de impacto entre clientes. Clona os repos, usa o CLAUDE.md do projeto como referência, produz relatório estruturado e (sob confirmação) posta comentários inline. NÃO use para meramente criar/abrir uma PR, escrever a descrição/título da PR, checar status de CI/build, resolver conflitos de merge, comparar branches, escrever testes, fazer deploy, gerar PULL_REQUEST_TEMPLATE, revisar arquivos locais que não fazem parte de uma PR, ou só resumir em alto nível o que a PR faz sem analisar riscos.
---

# Revisão de Pull Requests

Você revisa PRs de forma profunda, encontrando **riscos reais de regressão e impactos indiretos** —
não ruído cosmético. O objetivo é proteger a entrega e evitar problemas futuros para clientes e
desenvolvedores. Aja como um engenheiro sênior cético, que entende que código compartilhado e
camadas de customização por cliente são onde os bugs caros se escondem.

Entrada: um ou mais links de PR (ex.: `https://github.com/owner/repo/pull/4932`). Podem ser PRs
relacionadas em repos diferentes (backend + frontend) — analise a compatibilidade entre elas.

## Ferramentas bundladas

Os scripts em `scripts/` (Node, cross-platform) automatizam a parte determinística e economizam
contexto/tokens. Eles resolvem o binário `gh` sozinhos (PATH → caminhos de instalação conhecidos),
então não dependem do PATH do shell.

| Script | Para quê |
|--------|----------|
| `scripts/pr-fetch.js` | Baixa metadata + diff de cada PR e clona os repos em temp. Emite `manifest.json`. |
| `scripts/grep-usages.js` | Helper fino: lista candidatos a usos de um símbolo (`arquivo:linha`). Pistas, não verdade. |
| `scripts/post-review.js` | Posta UMA review com comentários inline batchados. Dry-run por padrão; só posta com `--post`. |
| `scripts/cleanup.js` | Remove os diretórios temporários ao final. |

> O caminho da pasta de scripts vem da variável `${CLAUDE_PLUGIN_ROOT}` (raiz do plugin). Use
> `node "<plugin-root>/skills/pr-review/scripts/<script>.js"`. Se não souber a raiz, os scripts
> também funcionam pelo caminho relativo a este `SKILL.md`.

## Fluxo

### 1. Preparação

1. Rode `pr-fetch.js` com todos os links de PR de uma vez. Ele clona cada repo único em temp,
   faz checkout do head e gera `manifest.json`:
   ```
   node "<root>/skills/pr-review/scripts/pr-fetch.js" <url-pr-1> <url-pr-2> ...
   ```
   A saída em stdout é o caminho do `manifest.json`. Leia-o: ele tem, por PR, o diff, a lista de
   arquivos, e o diretório do clone (`repoDir`).
2. **Leia o `CLAUDE.md` do projeto clonado** (na raiz do `repoDir`) e quaisquer docs em
   `.claude/docs/*.md` relevantes ao escopo da PR. Esses documentos são **referência obrigatória**
   durante toda a revisão — regras de domínio, convenções e contratos vêm dali.
3. Leia o diff de cada PR (`diffPath` no manifest). Trabalhe a partir do diff; só abra arquivos
   completos do clone quando precisar validar um impacto ou entender um consumidor.

### 2. Análise

Avalie as dimensões abaixo. **Não** busque problemas artificialmente — só reporte o que traz valor
real. Priorize, nesta ordem: **(1) regressão, (2) impacto indireto, (3) efeitos em outros clientes,
(4) comportamentos compartilhados, (5) sustentabilidade/manutenção, (6) conformidade com o CLAUDE.md.**

**Regressão e métodos compartilhados (peso máximo).** Para cada método/função alterado, não pare no
trecho modificado: encontre quem o consome. Use `grep-usages.js` para listar candidatos e então
**raciocine** sobre cada um (em linguagens dinâmicas/sem tipos o grep gera ruído — filtre nomes
genéricos). Ajuste `--ext` às extensões da stack da PR:
```
node "<root>/skills/pr-review/scripts/grep-usages.js" --dir <repoDir> <nomeDoMetodo> --ext <ext-da-stack>
# ex.: --ext .coffee,.ts,.html  |  --ext .go  |  --ext .py  |  --ext .ts,.tsx
```
Pergunte: a mudança altera contrato (parâmetros/retorno/efeitos)? Algum consumidor quebra? Um
binding em template HTML quebra em runtime?

**Impacto em outros clientes / multi-tenant.** Se o sistema tem camada de customização por cliente,
este é o risco mais caro. **Conhecimento específico do projeto vem do `.claude/docs/` do repo-alvo**
(passo 1.2) — convenções, padrões de override e camadas de customização daquela base estão lá. Se,
além disso, existir um guia em `references/` aplicável à stack desta PR, consulte-o (ex.:
`references/coffeescript-impact.md` cobre o padrão `*CustomFactory` de bases CoffeeScript/AngularJS
multi-tenant); se não existir guia para esta stack, siga apenas pelo `.claude/docs/` e pelo diff —
**não force conceitos de outra base**. Pergunte sempre: uma correção pensada para o cliente X,
aplicada na base, atinge todos os clientes? Existe override que será anulado ou quebrado?

**Casos de borda.** Valores nulos, coleções vazias, dados inconsistentes, fluxos alternativos,
situações excepcionais não tratadas.

**Arquitetura.** Organização, coesão, responsabilidade, reutilização. Existe forma mais simples e
segura? Há método excessivamente grande/complexo que pede extração? Há lógica duplicada que pede
centralização?

**Arquivos de infra.** Mudanças em CI/CD, Docker, Kubernetes, pipelines, scripts, build, deploy —
avalie impacto em outros ambientes/equipes.

**Comportamentos compartilhados entre projetos.** Com PRs relacionadas em repos diferentes, valide
contratos e compatibilidade backend↔frontend; aponte inconsistências.

**Código morto e arquivos indevidos.** Campos/métodos/propriedades sem uso após a mudança; e
arquivos que não deveriam estar versionados (node_modules, artefatos de build, logs, arquivos
gerados, **credenciais/segredos**, config local). Qualquer ocorrência deve ser reportada.

### 3. Resultado

Produza a revisão em **duas partes**, em português.

#### Resumo Geral
- **Escopo analisado** — PRs, repos, nº de arquivos.
- **Principais riscos encontrados**.
- **Principais pontos positivos**.
- **Avaliação geral** da implementação.

Se a implementação está correta e não há riscos relevantes, **diga isso explicitamente**. Não
invente observações para gerar volume.

#### Comentários de Review
Para cada achado, use exatamente esta estrutura:

> **Título** — descrição curta do problema.
> **Severidade** — Baixo | Médio | Alto | Crítico.
> **Problema** — explicação clara do risco.
> **Impacto** — o que acontece se aprovar sem ajuste.
> **Sugestão** — orientação objetiva de correção.
> **Exemplo** — trecho de código/prático sempre que possível.

Ancore cada achado em `arquivo:linha` reais do diff. Nada de achados sem localização.

### 4. Comentários inline (opcional, gated)

Quando o usuário quiser publicar os comentários na PR, monte um `review.json` (veja o cabeçalho de
`post-review.js`) com `nwo`, `number`, `summary` e a lista de `comments` (cada um com `path`, `line`,
`side`, `body`). Cada `line` precisa pertencer ao diff. Rode primeiro em **dry-run** para conferir o
payload, depois com `--post` para publicar (uma única review batchada):
```
node "<root>/skills/pr-review/scripts/post-review.js" review.json          # dry-run
node "<root>/skills/pr-review/scripts/post-review.js" review.json --post   # publica
```

### 5. Limpeza

Ao terminar, remova os temporários:
```
node "<root>/skills/pr-review/scripts/cleanup.js" <caminho-do-manifest.json>
```
`cleanup.js` recusa apagar qualquer coisa fora do diretório temporário, por segurança.

## Eficiência

- Trabalhe a partir do diff; abra arquivos completos do clone só para validar impactos/regressões.
- Use `grep-usages.js` para mapear consumidores em vez de ler arquivos inteiros à procura.
- Busque contexto adicional apenas quando necessário para confirmar um risco.
