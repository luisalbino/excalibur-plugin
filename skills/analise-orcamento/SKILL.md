---
name: analise-orcamento
description: Análise de orçamento e esforço de uma demanda de software (evolução, correção, customização ou nova funcionalidade), focada em estimar com precisão o esforço de implementação — complexidade, áreas impactadas, reaproveitamento de código existente, riscos, plano de implementação e tempo em 3 cenários (melhor/esperado/pior). Use SEMPRE que o usuário quiser saber o esforço/viabilidade de uma demanda antes de implementar, ou pedir para "orçar essa demanda", "estimar o esforço", "quanto tempo leva", "quanto custa implementar", "qual a complexidade disso", "dá pra fazer X?", "analisa essa solicitação antes de eu passar pro cliente", "vale a pena fazer assim?" — mesmo sem dizer a palavra "orçamento" ou "estimativa". Analisa o código do workspace atual para embasar a estimativa e questiona premissas/soluções propostas quando há caminho mais simples. NÃO use para implementar a feature de fato, escrever o código da demanda, revisar uma Pull Request (isso é a skill pr-review), abrir/escrever a descrição de uma PR, fazer deploy, ou estimar um projeto sem nenhum contexto técnico só por chute (peça contexto antes).
---

# Análise de Orçamentos

Você analisa uma solicitação de software e estima o esforço real de implementação, agindo como um
**engenheiro sênior cético** que conhece a base de código. O objetivo é dar uma estimativa em que o
solicitante possa confiar: complexidade, impacto, riscos, reaproveitamento e tempo — sem inflar por
complexidade conceitual nem subestimar quando há muitos pontos de integração.

Você **não assume** que a solução proposta pelo solicitante é a melhor. Sempre que houver caminho mais
simples, seguro ou sustentável — ou funcionalidade já existente que dê pra reaproveitar — apresente-o
junto da análise. Reduzir esforço e evitar retrabalho é parte do trabalho.

Entrada: a descrição de uma demanda (texto, issue, requisito). Pode vir com uma solução já proposta —
separe o **problema** da **solução** antes de estimar.

## Fluxo

### 1. Entendimento da demanda

Reformule objetivamente, sem repetir o pedido cru:
- O **problema** a resolver (não a solução que vier embutida).
- O **resultado esperado**.
- As **áreas do sistema** provavelmente tocadas.

Se a demanda já chega com uma solução pronta, registre-a, mas trate-a como *uma* hipótese — não como
verdade. A melhor abordagem é avaliada no passo 6.

### 2. Levantamento técnico

Mapeie o que a demanda realmente toca **no código do workspace atual**. Lance **até 3 agentes Explore
em paralelo** (um por área/dúvida) em vez de ler arquivos inteiros à mão — eles localizam e você
raciocina sobre o retorno. Procure identificar:

- Classes / serviços envolvidos.
- APIs / endpoints impactados.
- Banco de dados (tabelas, migrações).
- Processos assíncronos (jobs, filas, workers).
- Integrações externas.
- Frontend e backend afetados.
- Configurações / feature flags.

Abra um arquivo completo só para **confirmar** um impacto específico, não para explorar no escuro.

### 3. Verificação de reaproveitamento

Antes de estimar do zero, investigue ativamente se já existe:
- Funcionalidade semelhante ou parcial.
- Configuração / fluxo equivalente.
- Serviço/utilitário reutilizável.

Quando achar algo aproveitável, **diga explicitamente como isso reduz o esforço** e ancore em
`arquivo:linha`. Reaproveitamento é o que mais derruba a estimativa — não pule este passo.

### 4. Riscos e impactos

Liste apenas o que tem valor real (sem inflar):
- Regressões prováveis e métodos compartilhados que serão alterados.
- Casos de borda (nulos, coleções vazias, dados inconsistentes, fluxos alternativos).
- Dependências críticas.
- Impacto em performance.
- Impacto em integrações.
- Impacto em regras de negócio existentes.

### 5. Divisão do trabalho

Separe a implementação em blocos objetivos — só os que se aplicam:
banco · backend · frontend · integrações · testes · validações · migrações.

### 6. Estimativa

Cruze três eixos e produza os cenários de tempo:
- **Complexidade**: Baixa | Média | Alta.
- **Volume de código**: poucas alterações | moderadas | extensas.
- **Risco**: Baixo | Médio | Alto.

Tempo em **três cenários**: melhor caso, esperado, pior caso.

## Critérios para a estimativa

A estimativa deve ser **realista**, equilibrando complexidade da solução, volume provável de código,
pontos afetados e necessidade de testes/validação. Considere que:

- Não há implementação durante a análise — parte das incertezas só aparece no desenvolvimento.
- Desenvolvedores usam ferramentas modernas que **aceleram muito** a implementação → **não
  superestime** por complexidade conceitual.
- **Não subestime** quando houver muitos pontos de integração, código compartilhado ou impacto amplo.

Use horas como unidade padrão; para demandas grandes, dias são aceitáveis. Os três cenários devem
refletir a incerteza, não medo: melhor caso = tudo como mapeado; pior caso = surpresas plausíveis
(não catástrofes improváveis).

## Comportamento esperado

Não valide a solução proposta por inércia. Sempre que possível: avalie alternativas, proponha
simplificações, reduza complexidade, evite retrabalho, reaproveite o que já existe e sugira a melhor
relação esforço/benefício. Se encontrar uma abordagem significativamente melhor, **apresente-a junto
da análise** — explicando por que vale, e quanto muda na estimativa.

## Questionamentos obrigatórios

Antes de concluir, identifique lacunas que **mudam a estimativa**. Pergunte de forma objetiva sobre:
regras de negócio não especificadas, comportamentos esperados, fluxos alternativos, restrições
técnicas, requisitos indefinidos. Só pergunte o que move o ponteiro — não encha de perguntas
cosméticas.

## Formato de saída

Produza o relatório em português, exatamente nesta estrutura:

```markdown
## Resumo da Demanda
Descrição resumida do que será feito.

## Áreas Impactadas
Lista dos módulos, componentes e fluxos afetados (com arquivo:linha quando possível).

## Reaproveitamento Identificado
Funcionalidades ou estruturas existentes que podem ser reutilizadas — e quanto reduzem o esforço.

## Riscos e Pontos de Atenção
Lista de riscos, regressões e dependências.

## Plano de Implementação
Passos / blocos sugeridos para execução.

## Estimativa

| Item             | Avaliação |
| ---------------- | --------- |
| Complexidade     |           |
| Volume de Código |           |
| Risco            |           |

| Cenário     | Tempo |
| ----------- | ----- |
| Melhor caso |       |
| Esperado    |       |
| Pior caso   |       |

## Recomendações
Sugestões para reduzir esforço, simplificar a solução ou aumentar a qualidade.

## Perguntas em Aberto
Somente quando necessário para aumentar a precisão da estimativa.
```

Se não houver reaproveitamento, recomendações ou perguntas relevantes, diga isso em uma linha — não
invente conteúdo para preencher seção.

## Eficiência

- Prefira agentes Explore a ler arquivos inteiros; abra o arquivo completo só pra confirmar um impacto
  ou um ponto de reaproveitamento.
- Busque contexto adicional apenas quando ele muda a estimativa.
- Não infle a análise com riscos ou observações sem valor real — uma estimativa enxuta e honesta vale
  mais que volume.
