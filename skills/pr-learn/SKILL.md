---
name: pr-learn
description: Aprende com os COMENTÁRIOS HUMANOS de uma Pull Request já revisada e acumula o conhecimento numa base global que a skill pr-review usa depois. Use quando o usuário quiser "aprender com essa PR", "capturar as lições dessa review", "o que os revisores apontaram aqui que devemos lembrar", "extrair regras desses comentários", "registrar esse feedback pra próxima revisão", "alimentar o pr-review com o que pegaram nessa PR" — mesmo sem dizer "aprender". Pega os comentários dos revisores, generaliza cada um numa heurística transferível entre projetos (ex.: "validar retorno possivelmente nulo antes de usar") e mescla na base sem duplicar. NÃO use para revisar/avaliar uma PR e achar problemas (isso é a skill pr-review), nem para criar/abrir PR, postar comentários, checar CI ou resumir o que a PR faz.
---

# Aprender com comentários de PR

Esta skill fecha o ciclo de aprendizado do review: ela lê os **comentários humanos** de uma PR já
revisada e destila **lições gerais e transferíveis** — o princípio por trás de cada apontamento, não
uma regra amarrada àquele repositório. Essas lições se acumulam numa base que a skill `pr-review`
carrega depois, para pegar mais cedo riscos que humanos já pegaram antes.

O foco é **generalização**: toda lição se separa em **princípio** (transferível, vai na Regra) e
**mecanismo** (a forma concreta daquele projeto, vai só no Exemplo). O comentário "cadê o null check no
`getCliente()`?" não vira "checar `getCliente`", vira o princípio "validar retorno possivelmente nulo
antes de usar" — e `getCliente()` fica só como exemplo. Assim a lição vale para qualquer projeto futuro.

Entrada: um ou mais links de PR (ex.: `https://github.com/owner/repo/pull/4932`).

## Ferramentas bundladas

| Script | Para quê |
|--------|----------|
| `scripts/fetch-comments.js` | Coleta comentários humanos da(s) PR(s): review bodies, comentários de issue e inline (com `path`/`line`/`diff_hunk`). Emite JSON no stdout. |
| `../../scripts/learnings-path.js` (raiz do plugin) | Resolve o caminho **estável** da base de lições em `CLAUDE_PLUGIN_DATA`. Fonte única do caminho, compartilhada com a `pr-review`. |

> Os caminhos de script vêm de `${CLAUDE_PLUGIN_ROOT}`. Use `node "<plugin-root>/skills/pr-learn/scripts/fetch-comments.js" ...`
> e `node "<plugin-root>/scripts/learnings-path.js"`. O `fetch-comments.js` resolve o binário `gh`
> sozinho (reusa o `gh-util.js` da pr-review), então não depende do PATH do shell.

## Fluxo

### 1. Captura

Rode o coletor com todos os links de uma vez:
```
node "<plugin-root>/skills/pr-learn/scripts/fetch-comments.js" <url-pr-1> <url-pr-2> ...
```
O stdout é um JSON com, por PR: `reviewSummaries`, `issueComments` e `inlineComments` (estes com
`path`, `line`, `diffHunk` — o contexto de código do comentário). Logs vão pro stderr.

### 2. Filtro (descarte de ruído)

Antes de generalizar, descarte o que não ensina nada:
- Comentários de **bots** (autores como `*[bot]`, `coderabbit`, `dependabot`, CI).
- Aprovações/elogios vazios: "LGTM", "👍", "ok", "perfeito".
- **Nits puramente cosméticos** sem efeito de comportamento (espaçamento, aspas) — a menos que revelem
  uma convenção recorrente do time.
- Comentários do **próprio autor** da PR respondendo a si mesmo (não são feedback de revisor).

Mantenha apenas o feedback substantivo: aponta risco, bug, caso de borda, contrato quebrado, impacto em
cliente, problema de UX ou de arquitetura.

### 3. Generalização → heurística por dimensão

> **Esta é a etapa crítica.** A base é injetada em TODO review de TODO projeto. Uma regra amarrada a um
> produto (ex.: o mecanismo de tradução de um app específico) é ruído nos outros. Generalize com método,
> não copie o comentário.

#### 3.1. Princípio vs Mecanismo

Toda lição tem duas camadas — separe-as:

- **Princípio** (vai na **Regra**): o que vale independente de linguagem, framework, biblioteca, nome de
  cliente ou mecanismo do projeto.
- **Mecanismo** (vai SÓ no **Exemplo**): a forma concreta — sintaxe, nome de API/classe/função/flag,
  chave de tradução, identificador de cliente.

**Proibido na Regra:** nome de função/classe/variável/flag, sintaxe de framework, e qualquer mecanismo
exclusivo de UM projeto. Se está na Regra, sobe pro Exemplo.

#### 3.2. Escada de abstração

Suba do concreto até o nível que valeria em outro stack:

```
instância concreta  →  categoria  →  princípio
traducao[669] vazio  →  texto de UI sem tradução  →  texto novo de UI deve passar pela camada de i18n (quando o projeto usa)
```

#### 3.3. Teste do outro-stack (litmus)

Antes de gravar cada Regra, pergunte: **"isso ainda faz sentido num projeto de linguagem/framework
diferente?"** Se não, suba um nível. Se a Regra só vale para UM produto, está específica demais.

#### 3.4. Antipadrões (específico demais → genérico)

| ❌ Específico demais | ✅ Genérico |
|---|---|
| "Todo texto usa `traducao[...]`" | "Texto novo de UI deve passar pela camada de i18n do projeto (quando há)" |
| "Não usar `R$ #{valor}`, usar `currency`" | "Formatar valores (moeda/data/número) sempre via biblioteca/utilitário, nunca por concatenação manual" |
| "Validar null no `getCliente()`" | "Validar retorno possivelmente nulo antes de usar" |
| "Inverter default de `permiteMudarCliente`" | "Default de método novo na factory base é herdado por todos; o default deve ser o comportamento atual, restrição vai na factory do cliente" |

#### 3.5. Exceção — camada de tecnologia

Regras de uma tecnologia **ampla** (JPA, SQL/índices, Liquibase, promises, HTTP) podem nomear a tech na
Regra — valem para qualquer projeto naquele stack, então são transferíveis (ex.: "JPA — não chamar
`persist` em entidade já managed"). O que **não** pode é token de UM projeto: nome de cliente, flag
proprietária, mecanismo interno do produto.

#### 3.6. Classificação por dimensão

Classifique cada lição em **uma** das 4 dimensões (as mesmas lentes da `pr-review`):

| Seção da base | Dimensão |
|---------------|----------|
| `## Regressão / impacto na master` | Métodos/contratos compartilhados, consumidores, quebra de assinatura/retorno. |
| `## Impacto cliente / tenant` | Base compartilhada × customização por cliente, overrides, `*CustomFactory`. |
| `## Impacto no usuário` | Comportamento visível, UX, dados exibidos, mensagens, quebra de expectativa. |
| `## Qualidade / arquitetura` | Coesão/duplicação, casos de borda (null/vazio), código morto, infra. |

Cada lição vira uma regra no formato:
```markdown
- **Regra:** <heurística acionável e curta, em forma de checagem>
  - Porquê: <o risco que ela previne>
  - Exemplo: <caso curto e ANONIMIZADO — sem nome de cliente/repo/pessoa; ex.: "visto em PR de checkout">
```
Anonimize: nada de nomes de cliente, pessoas ou repositórios sensíveis no exemplo.

### 4. Merge na base (sem duplicar)

1. Resolva o caminho da base:
   ```
   node "<plugin-root>/scripts/learnings-path.js"
   ```
   (cria o diretório se faltar; o stdout é o caminho do `pr-review-learnings.md`).
2. **Leia** o conteúdo atual da base (se o arquivo não existir ou estiver vazio, comece da estrutura
   com os 4 cabeçalhos de seção).
3. Mescla **semântica**, não append cego:
   - Se já existe regra equivalente, **reforce/funde** (melhore a redação, some o novo exemplo se
     agregar) — **não** crie uma segunda regra dizendo o mesmo.
   - Se é nova, acrescente na seção da dimensão correta.
   - Mantenha as regras enxutas e ordenadas; a base é injetada em todo review, então prolixidade custa
     tokens em toda execução da `pr-review`.
4. **Reescreva o arquivo inteiro** com a base consolidada (use a tool Write no caminho resolvido).

Estrutura canônica do arquivo:
```markdown
# Lições de Review (base global)

> Heurísticas transferíveis extraídas de comentários humanos de PRs, pela skill pr-learn.
> Carregadas pela pr-review e injetadas nas 4 lentes como conhecimento prévio.

## Regressão / impacto na master
- **Regra:** ...
  - Porquê: ...
  - Exemplo: ...

## Impacto cliente / tenant
...

## Impacto no usuário
...

## Qualidade / arquitetura
...
```

### 5. Relatório

Resuma ao usuário, em português:
- Quantos comentários foram coletados e quantos sobraram após o filtro.
- Quantas regras foram **criadas** e quantas **reforçadas/fundidas**, agrupadas por dimensão.
- O caminho do arquivo da base atualizado.

Se nenhum comentário substantivo sobrou após o filtro, diga isso — não invente regras para gerar
volume.
