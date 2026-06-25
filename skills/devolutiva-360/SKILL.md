---
name: devolutiva-360
description: >-
  Gera uma devolutiva de Feedback 360 cruzando a autoavaliação da pessoa com as
  respostas dos pares, de forma anônima, e produz um arquivo HTML no formato
  aprovado (termômetro de médias por tema, forças, cruzamento "sua visão × como
  o time vê", pontos de desenvolvimento, mensagem final e espaço de compromisso).
  Use sempre que o usuário pedir para "montar uma devolutiva de feedback 360",
  "cruzar autoavaliação com respostas dos pares", "preparar o retorno do feedback
  360 de alguém", "consolidar feedback 360", ou qualquer variação de preparar a
  devolutiva de um ciclo de avaliação 360.
---

# Devolutiva de Feedback 360

Método para transformar uma autoavaliação + as respostas de pares (formulário 360)
em uma devolutiva clara, anônima e construtiva, entregue como arquivo HTML.

## Insumos necessários

1. **Planilha de autoavaliação** — contém a linha da pessoa avaliada, com a resposta
   dela em cada competência (texto aberto) e, geralmente, uma nota de satisfação/
   engajamento de 1 a 10.
2. **Planilha de respostas do 360 da pessoa** — uma linha por respondente, com:
   - a relação com a pessoa (ex.: colega de squad / de outro time),
   - avaliações em escala de frequência por competência,
   - comentários abertos opcionais por competência,
   - uma sugestão construtiva,
   - a avaliação geral (1 a 5).

Normalmente são Google Sheets. Leia ambas antes de começar.

## Passo a passo

### 1. Extrair os dados
Leia a linha da pessoa na autoavaliação e todas as respostas do 360 dela.

### 2. Calcular as médias por tema (termômetro)
Converta a escala de frequência em nota:

| Resposta | Nota |
|---|---|
| Sempre | 5 |
| Frequentemente | 4 |
| Às vezes | 3 |
| Raramente | 2 |
| Nunca | 1 |

Tire a média por tema, agrupando as afirmações de cada competência:
- **Postura Profissional** — 3 afirmações
- **Competência Técnica** — 2 afirmações
- **Protagonismo** — 2 afirmações
- **Adaptabilidade e Comunicação** — 2 afirmações
- **Geral** — a nota de contribuição (já é de 1 a 5)

Use 1 casa decimal. Apresente sempre como **tendência, não nota exata** — com poucos
respondentes, uma resposta destoante move bastante a média. A barra de cada card =
média ÷ 5 × 100%. Há um helper em `assets/calc_medias.py`.

### 3. Cruzar autoavaliação × pares
Para cada competência, compare "como a pessoa se vê" com "como o time a vê".
Destaque três coisas:
- **Convergências** — onde as duas visões batem.
- **Divergências** — onde diferem (inclua o caso comum em que a pessoa se
  **subestima**: o time a vê mais forte do que ela mesma).
- **Pontos cegos** — o que os pares levantam e a pessoa não citou.

### 4. Anonimização (regra inviolável)
- Nenhum respondente pode ser identificável pelo texto ou pelos exemplos.
- Consolide os comentários; nunca atribua uma fala a um tipo de relação se isso
  permitir deduzir quem é.
- Remova nomes de clientes, colegas, projetos ou situações específicas — generalize.
- Suavize pontos sensíveis: traga a verdade construtiva, sem reproduzir ataques
  pessoais nem o tom agressivo.
- Comentários feitos de má-fé ou em tom de ofensa devem ser **descartados do
  cálculo e do texto** — confirme com quem conduz o processo antes.

### 5. Montar o HTML
Use `assets/template_devolutiva.html` como base. Mantenha a ordem das seções:
1. **Termômetro** — cards de médias por tema (antes de tudo).
2. **O que reforçar** — forças reconhecidas pelo time; destaque onde a pessoa se subestima.
3. **Onde sua visão e a do time se encontram** — cards "sua visão × como o time te vê" por competência.
4. **Pontos de desenvolvimento** — o que vale trabalhar.
5. **Mensagem para levar** — fecho que lidera pelas forças.
6. **Meu compromisso** — campos editáveis em 1ª pessoa, preenchidos pela própria pessoa.
7. Botão **"Salvar como PDF"** no topo.

Salve como `Devolutiva_<Nome>_<Ano>.html`.

### 6. Tom
Construtivo e acolhedor. Lidere pelas forças. Trate os números como tendência.
O documento é mostrado à própria pessoa, então cada frase deve ajudar o desenvolvimento,
nunca expor ou julgar.

## Resultado
Um HTML autocontido, anônimo, pronto para ser aberto, preenchido na conversa e salvo em PDF.
