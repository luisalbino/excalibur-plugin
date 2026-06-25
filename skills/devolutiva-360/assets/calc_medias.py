# Helper para calcular as medias por tema de um Feedback 360.
# Escala: Sempre=5, Frequentemente=4, As vezes=3, Raramente=2, Nunca=1.
# Monte `rows` com uma lista por respondente, na ordem:
#   [postura1, postura2, postura3, tecnica1, tecnica2,
#    protagonismo1, protagonismo2, adapt1, adapt2, geral(1-5)]
# Descarte respostas de ma-fe antes de incluir aqui.

M = {'S': 5, 'F': 4, 'A': 3, 'R': 2, 'N': 1}

def conv(seq):
    return [M[x] for x in seq]

def avg(vals):
    return round(sum(vals) / len(vals), 1)

def medias(rows):
    post = tec = prot = adap = []
    post, tec, prot, adap, ger = [], [], [], [], []
    for r in rows:
        post += conv(r[0:3])
        tec  += conv(r[3:5])
        prot += conv(r[5:7])
        adap += conv(r[7:9])
        ger.append(r[9])
    return {
        "n": len(rows),
        "Postura": avg(post),
        "Tecnica": avg(tec),
        "Protagonismo": avg(prot),
        "Adapt/Comun": avg(adap),
        "Geral": avg(ger),
    }

if __name__ == "__main__":
    exemplo = [
        ['S','S','S','S','S','S','S','S','S',5],
        ['F','S','S','S','S','F','F','F','S',5],
    ]
    print(medias(exemplo))
    # largura da barra de cada card = media/5*100 (ex.: 4.8 -> 96%)
