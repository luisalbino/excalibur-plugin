# Análise de impacto em CoffeeScript / AngularJS (e camadas de customização por cliente)

Guia de apoio para rastrear consumidores e riscos de regressão em bases CoffeeScript/AngularJS
(como `client/scripts/...`). Use como **pistas para raciocínio**, não como regra mecânica —
CoffeeScript não tem tipos, então grep gera ruído e exige julgamento.

## Como métodos/funções aparecem

CoffeeScript define e chama de várias formas. Ao procurar consumidores de um símbolo `foo`,
considere todas:

- **Método de objeto/classe**: `foo: (args) ->` (definição) e `obj.foo(...)` / `@foo(...)` / `this.foo(...)` (uso).
- **Função/atribuição**: `foo = (args) ->` e `foo(...)`.
- **Property de factory/service Angular**: retornada num objeto literal `{ foo, bar }` e consumida via injeção (`MeuService.foo(...)`).
- **Binding em template HTML**: `ng-click="foo()"`, `{{ foo(x) }}`, diretivas — uma mudança de assinatura quebra a view sem erro de compilação.

Estratégia: rode `grep-usages.js` com o nome do símbolo em `.coffee` **e** `.html`. Depois leia
cada candidato e decida se é realmente o mesmo símbolo (cuidado com nomes genéricos: `total`,
`format`, `get` etc. — alta taxa de falso-positivo).

## Superfície nº 1 de regressão: camada de customização por cliente

Esta base é **multi-tenant**. Há uma camada de override por cliente, tipicamente em arquivos
`*CustomFactory.coffee` (ex.: `OrderCustomFactory`, `FormacaoPrecoCustomFactory`,
`PoliticaItemSimplificadaCustomFactory`), e branches/escopos por cliente (`meplas`, `rovitex`, ...).

Sempre que uma PR mexe num **método base/compartilhado**, faça estas perguntas:

1. **Existe override por cliente desse método/fluxo?** Procure o nome do método (ou o nome da
   factory base) dentro dos `*CustomFactory`. Se um cliente sobrescreve o comportamento, a
   mudança na base pode:
   - ser silenciosamente anulada para aquele cliente (o override "ganha"), ou
   - quebrar o override (mudou assinatura, contrato de retorno, efeito colateral esperado).
2. **A mudança deveria ser global ou client-scoped?** Uma correção pensada para o cliente X,
   aplicada na base, atinge **todos** os clientes. Avalie se outros clientes dependem do
   comportamento antigo. Esse é o risco "impacto em outros clientes" da spec — o de maior peso.
3. **Há divergência de contrato base ↔ override?** Se a base passa a retornar um campo novo ou
   a esperar um parâmetro, todo override precisa acompanhar. Liste os overrides afetados.

Enquadre o achado de forma geral ("o método compartilhado X é sobrescrito por N clientes; a
mudança Y pode afetá-los") e cite os arquivos `arquivo:linha` concretos.

## Outras superfícies frequentes

- **`shared/` e `utils`** (ex.: `pedidoUtils`, `utils.coffee`, `constants.coffee`): usados em
  muitos controllers/components. Mudança aqui propaga amplamente — sempre mapear consumidores.
- **Controllers que compartilham service**: alterar um service afeta todos os controllers que o
  injetam (Cad/Con/Det/Div...). Verifique fluxos alternativos (cadastro vs consulta vs detalhe).
- **Templates HTML**: bindings quebram em runtime, não em build. Se a assinatura de um método
  usado em `.html` muda, procure todos os usos no HTML.

## Checklist rápido por método alterado

- [ ] Listei os consumidores reais (filtrando ruído de nomes genéricos)?
- [ ] Existe override `*CustomFactory` para este método/fluxo?
- [ ] A mudança é segura para **todos** os clientes, ou deveria ser escopada?
- [ ] Contrato (parâmetros/retorno/efeitos) mudou? Os consumidores acompanham?
- [ ] Há uso em template HTML que quebraria em runtime?
