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

> **Squad de review.** A análise é feita por uma squad de 4 lentes especialistas
> (`excalibur:pr-squad-*`), disparadas em paralelo. O contrato compartilhado (mapa de blocos, formato
> de saída, placar) está em `squad-protocol.md` (mesma pasta) — leia-o antes de orquestrar.

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

### 1.5. Carregar lições aprendidas

Antes do fan-out, carregue a base de conhecimento acumulada pela skill `pr-learn` — heurísticas gerais
extraídas de comentários humanos de PRs passadas, organizadas nas mesmas 4 dimensões das lentes:
```
node "<root>/scripts/learnings-path.js"
```
O stdout é o caminho de `pr-review-learnings.md`. **Leia o arquivo** (tool Read). Se não existir ou
estiver vazio, siga sem lições — é opcional. Se existir, separe o conteúdo pelas 4 seções (`## Regressão
/ impacto na master`, `## Impacto cliente / tenant`, `## Impacto no usuário`, `## Qualidade /
arquitetura`) para repassar cada uma à lente correspondente no passo 2.2.

### 2. Squad de análise (fan-out por lente)

A análise não é feita num cérebro só. Você (orquestrador) fatia as mudanças em blocos e dispara 4
lentes especialistas em paralelo; cada uma avalia a PR inteira sob **uma** dimensão e devolve achados
marcados por bloco. Leia `squad-protocol.md` (mesma pasta) — ele define os formatos exatos.

**2.1. Splitter lógico.** Com o diff e o `CLAUDE.md` em mãos, agrupe as mudanças em **blocos lógicos
semânticos** — uma unidade de sentido (ex.: "novo cálculo de desconto" = método no backend + binding no
frontend), não por arquivo nem por hunk. Atribua IDs estáveis `B1..Bn` com âncoras `arquivo:linha`
reais, no formato do protocolo (§1).

**2.2. Fan-out paralelo.** Numa **única mensagem**, abra as 4 lentes via Agent tool (rodam em paralelo).
Passe a cada uma: o **mapa de blocos**, o `diffPath`, o `repoDir` e as regras do `CLAUDE.md`. Se houver
base de lições (passo 1.5), inclua também a **seção correspondente** como bloco "Conhecimento prévio
(lições de reviews passadas)" — regressão recebe a seção Regressão, tenant a de tenant, etc. As lições
são **heurística/checklist de risco, não achado confirmado**: a lente só reporta se o diff/código real
confirmar; nunca gera achado só porque a regra existe. Cada lente lê o diff sozinha e retorna no formato
do protocolo (§2).

| Lente (`subagent_type`) | Dimensão coberta |
|-------------------------|------------------|
| `excalibur:pr-squad-regressao` | Regressão / impacto na master: métodos compartilhados, contratos, consumidores (usa `grep-usages.js`). |
| `excalibur:pr-squad-tenant` | Multi-tenant: base compartilhada × customização por cliente, `*CustomFactory`, overrides anulados. |
| `excalibur:pr-squad-usuario` | Usuário final: comportamento visível, UX, fluxo, dados exibidos. |
| `excalibur:pr-squad-arquitetura` | Arquitetura/coesão/código morto + casos de borda + infra (CI/Docker/pipeline). |

Nº de lentes é **fixo (4)**, independente do tamanho da PR — o custo não escala com o número de blocos.

**2.3. Agregação → placar por bloco.** Consolide os 4 veredictos por bloco (protocolo §3):
- **Criticidade** = maior severidade entre todos os achados do bloco.
- **Impacto na master** ← lente regressão · **Impacto cliente/tenant** ← lente tenant ·
  **Impacto no usuário** ← lente usuário · **Qualidade/arquitetura** ← lente arquitetura.

Princípios mantidos: nenhum achado sem âncora `arquivo:linha`; nada inventado para gerar volume; se uma
dimensão está limpa, a lente declara isso explicitamente.

### 3. Resultado

Produza a revisão em **três partes**, em português: Placar por bloco, Resumo Geral e Comentários de
Review.

#### Placar por bloco
Uma entrada por bloco `B1..Bn`, no formato do protocolo (§3): título semântico, arquivos envolvidos e
a tabela de eixos (Criticidade, Impacto na master, Impacto cliente/tenant, Impacto no usuário,
Qualidade/arquitetura). É a visão de relance de onde está o risco. Lente sem achado no bloco → "Sem
impacto" / "OK".

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
