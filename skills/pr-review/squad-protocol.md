# Protocolo da Squad de Review

Contrato compartilhado entre o orquestrador (skill `pr-review`) e as 4 lentes especialistas
(`excalibur:pr-squad-*`). Todos falam dos **mesmos blocos** e do **mesmo formato de saída** para que
a agregação seja mecânica. Este arquivo é a fonte única da verdade — se mudar aqui, vale para todos.

## Papéis

- **Orquestrador** (thread principal, dentro da skill): fatia o diff em blocos lógicos, dispara as 4
  lentes em paralelo, agrega os veredictos num placar por bloco e monta o relatório final.
- **Lentes** (subagentes): cada uma lê a PR inteira sob uma única dimensão de risco e devolve achados
  marcados por `bloco_id`. Não conversam entre si; não publicam nada no GitHub.

| Lente | Agente | Dimensão |
|-------|--------|----------|
| Regressão / impacto na master | `excalibur:pr-squad-regressao` | Métodos compartilhados, contratos, consumidores. |
| Multi-tenant / clientes | `excalibur:pr-squad-tenant` | Base compartilhada × customização por cliente. |
| Usuário final | `excalibur:pr-squad-usuario` | Comportamento visível, UX, fluxo, dados exibidos. |
| Arquitetura / edge / infra | `excalibur:pr-squad-arquitetura` | Coesão, código morto, casos de borda, infra. |

## 1. Mapa de blocos (orquestrador → lentes)

O orquestrador agrupa as mudanças em **blocos lógicos semânticos** (uma unidade de sentido — ex.:
"novo cálculo de desconto" = método no backend + binding no frontend), não por arquivo nem por hunk.
Cada bloco recebe um ID estável `B1`, `B2`, … e é passado às lentes assim:

```
B1 | <título semântico curto> | <arquivo:linha-início–fim>, <arquivo:linha…>
B2 | <título semântico curto> | <arquivo:linha…>
...
```

Regras:
- ID estável e único por execução. Toda lente usa o **mesmo** `bloco_id` para a mesma mudança.
- As âncoras `arquivo:linha` apontam para linhas reais do diff.
- Um bloco pode cruzar arquivos/repos (par backend+frontend).

### 1.1. Conhecimento prévio (opcional)

Junto do mapa de blocos, o orquestrador pode passar à lente um bloco **"Conhecimento prévio (lições de
reviews passadas)"** — heurísticas gerais da dimensão daquela lente, acumuladas pela skill `pr-learn`
em `pr-review-learnings.md`. Regras de uso, válidas para todas as lentes:
- É **checklist de risco a procurar**, não achado pronto. A lente só vira uma lição em achado se o
  **diff/código real confirmar** que o risco se aplica àquela PR.
- **Nunca** gere achado apenas porque uma regra existe — isso seria falso positivo.
- Lições ausentes (base vazia/inexistente) são normais; a lente opera igual sem elas.

## 2. Saída de cada lente (lente → orquestrador)

Cada lente retorna **somente** achados da sua dimensão, neste formato, um item por achado:

```
## Lente: <nome da lente>

- bloco_id: B<n>
  arquivo:linha — <arquivo:linha real do diff>
  severidade: Baixo | Médio | Alto | Crítico
  problema: <explicação clara e específica do risco>
  impacto: <o que acontece se aprovar sem ajuste>
  sugestão: <orientação objetiva de correção>
  confiança: alta | média | baixa
```

Regras:
- Severidade ∈ {Baixo, Médio, Alto, Crítico}. Confiança ∈ {alta, média, baixa}.
- Todo achado ancorado em `arquivo:linha` real. Nada sem localização.
- Não inventar achados para gerar volume. Se a dimensão está limpa, retornar exatamente:
  `Sem achados nesta lente.`
- Se um achado não se encaixa em nenhum bloco do mapa, usar `bloco_id: B0` (fora dos blocos) e
  explicar no campo `problema`.

## 3. Placar por bloco (orquestrador agrega)

Para cada bloco, o orquestrador consolida os veredictos das 4 lentes:

```
### Bloco B<n> — <título semântico>
Arquivos: <lista de arquivos:linhas>

| Eixo | Veredicto |
|------|-----------|
| Criticidade | <maior severidade entre os achados do bloco, ou "OK"> |
| Impacto na master | <resumo da lente regressão p/ este bloco, ou "Sem impacto"> |
| Impacto cliente/tenant | <resumo da lente tenant, ou "Sem impacto"> |
| Impacto no usuário | <resumo da lente usuário, ou "Sem impacto"> |
| Qualidade/arquitetura | <resumo da lente arquitetura, ou "OK"> |

Achados: <referências aos comentários detalhados, ou "nenhum">
```

- **Criticidade do bloco** = a maior severidade entre todos os achados de todas as lentes naquele bloco.
- Cada coluna de impacto vem da lente correspondente. Lente sem achado no bloco → "Sem impacto" / "OK".

## 4. Integração com o relatório final

O placar por bloco vira uma seção nova do relatório. Os achados das lentes alimentam, sem reescrever
o conteúdo:
- **Resumo Geral** — riscos principais saem dos blocos de maior criticidade.
- **Comentários de Review** — cada achado vira um comentário no formato padrão da skill
  (Título / Severidade / Problema / Impacto / Sugestão / Exemplo), ancorado em `arquivo:linha`.

Mapeamento de campos lente → comentário:
`problema` → Problema · `impacto` → Impacto · `sugestão` → Sugestão · `severidade` → Severidade ·
`arquivo:linha` → âncora. O Título é derivado do problema; o Exemplo é adicionado quando útil.
