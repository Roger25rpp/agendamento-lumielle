r"""Confere que o "Deu algum problema na Logzz?" do app (app/situacoes.js) preenche as respostas exatamente como o CRM
(crm/situacoes.py) em milhares de casos fictícios. Roda junto com o testes\testar.py (26/11/2026)."""
import json
import os
import random
import sqlite3
import subprocess
import sys
from datetime import date, timedelta

PASTA = os.path.dirname(os.path.abspath(__file__))
CRM = os.environ.get("CRM_LUMIELLE", r"C:\CRM-Lumielle")
sys.path.insert(0, CRM)
sys.path.insert(0, os.path.join(os.path.dirname(PASTA), "ferramentas"))
from crm import agendamento, situacoes  # noqa: E402
import exportar_do_crm  # noqa: E402

PEDACOS = ["Oi, {nome}! ", "Meu bem, a [dia da semana], dia [XX], não estava disponível. ", "para [cidade] ",
           'a entrega não sai [no dia que ela pediu, ex.: "amanhã"]. ', "O dia [dia que ela pediu, ex.: 05/12] não abriu. ",
           "*[dia da semana], dia [XX/XX]* ", "[dia da semana, dia XX/XX] ", "[dia da semana, dia XX] ", "Se [esse dia] não der, ",
           "Se [dia da semana] não ficar bom, ", "também tenho [dia] ou [dd/mm]. ", "os seus [N] frascos ([kit]) ",
           "agendei para [o dia agendado]. ", "turno [horário]. ", "[XX/XX] ", "[XX] ", "[Dia Da Semana], dia [xx/xx] ",
           "pra você não perder a oferta especial de Black Friday, ",
           "pra garantir pra você a condição de Black Friday que você recebeu. ",
           "Pra você não ficar sem a condição de Black Friday que você recebeu, ", "Black Friday ",
           "a transportadora não consegue entregar nesse endereço 😕 ", "\n\n", "[pediu] ", "[no dia que ela pediu] ",
           "🤗💕 ", "[", "]"]
CHAVES = ["pedido", "agendado", "outra1", "outra2", "oferecido", "novo"]
NOMES = ["Ana Fictícia", "", "  maria   souza", "ÉLLEN", "joão"]


def casos(sorte):
    for _ in range(4000):
        texto = "".join(sorte.choice(PEDACOS) for _ in range(sorte.randint(1, 9)))
        hoje = date(2026, 11, 20) + timedelta(days=sorte.randint(0, 20))
        chaves = sorte.sample(CHAVES, sorte.randint(0, 4))
        datas = [(c, (hoje + timedelta(days=sorte.randint(-2, 20))).isoformat()) for c in chaves]
        campos = {"nome": sorte.choice(NOMES), "cidade": sorte.choice(["", "Campinas", "Lagoa Clara"]),
                  "kit": sorte.choice(["", "3 + 1 extra", "kit com 3 frascos"]), "qtde": sorte.choice(["", 4, 7]),
                  "aviso": sorte.choice(["", "endereco", "bairro"])}
        yield {"texto": texto, "campos": campos, "datas": datas, "hoje": hoje.isoformat()}


def respostas_ficticias():
    return [{"grupo": "Dia da entrega", "itens": [
        {"codigo": "DIA-11", "titulo": "Dia fixo", "biblioteca": "RSP-021B",
         "texto": 'Para [cidade] não sai [no dia que ela pediu, ex.: "amanhã"]: *[dia da semana], dia [XX/XX]*. Se [dia da '
                  "semana] não der, tenho *[dia da semana], dia [XX/XX]* ou *[dia da semana], dia [XX/XX]*. Os seus [N] "
                  "frascos ([kit])."},
        {"codigo": "DIA-08", "titulo": "Endereço", "biblioteca": "RSP-023",
         "texto": "Oi, {nome}! A transportadora não consegue entregar nesse endereço."},
        {"codigo": "DIA-14", "titulo": "Já existe", "biblioteca": "RSP-027", "texto": "Oi, {nome}! Ainda não liberou."},
        {"codigo": "DIA-03", "titulo": "Não abriu", "biblioteca": "RSP-022",
         "texto": "O dia [dia que ela pediu, ex.: 05/12] não abriu; agendei [dia da semana, dia XX], pra garantir pra você a "
                  "condição de Black Friday que você recebeu."},
    ]}]


def banco_com(respostas):
    """Banco em memória só com a tabela respostas, para rodar o montar do CRM com os mesmos textos."""
    con = sqlite3.connect(":memory:")
    con.row_factory = sqlite3.Row
    con.execute("CREATE TABLE respostas (id INTEGER PRIMARY KEY, codigo TEXT, titulo TEXT, texto TEXT, biblioteca TEXT)")
    for g in respostas:
        for r in g["itens"]:
            con.execute("INSERT INTO respostas (codigo, titulo, texto, biblioteca) VALUES (?, ?, ?, ?)",
                        (r["codigo"], r["titulo"], r["texto"], r["biblioteca"]))
    return con


def main():
    sorte = random.Random(27)
    preencher = list(casos(sorte))
    lista = {s["id"]: s for s in exportar_do_crm.situacoes_do_crm()}  # a lista como vai para o app
    respostas = respostas_ficticias()
    montar = []
    for _ in range(1500):
        hoje = date(2026, 11, 20) + timedelta(days=sorte.randint(0, 20))
        s = lista[sorte.choice(["dia-indisponivel", "endereco-recusado", "pedido-em-aberto", "dia-nao-abriu"])]
        campos = {"nome": sorte.choice(NOMES), "cidade": "Campinas", "kit": "6 + 1 extra", "qtde": 7,
                  "aviso": sorte.choice(["", "bairro"])}
        for c in s["datas"]:
            campos[c] = sorte.choice(["", "2026-02-30", (hoje + timedelta(days=sorte.randint(-2, 15))).isoformat()])
        montar.append({"situacao": s, "codigo": sorte.choice(s["codigos"] + ["DIA-99"]), "campos": campos,
                       "hoje": hoje.isoformat()})
    links = [{"qtde": q, "grupo": g} for q in (None, 1, 3, 4, 7, 12) for g in (None, "normal", "extra", "plus", "desconto")]
    entrada = {"preencher": preencher, "montar": montar, "respostas": respostas, "links": links}
    js = subprocess.run(["node", os.path.join(PASTA, "rodar_situacoes.js")], input=json.dumps(entrada),
                        capture_output=True, text=True, encoding="utf-8", check=True)
    obtido = json.loads(js.stdout)
    erros = 0

    def comparar(nome, certo, app, caso):
        nonlocal erros
        if certo != app:
            erros += 1
            if erros <= 5:
                print(f"DIFERENTE ({nome}):", json.dumps(caso, ensure_ascii=False)[:400], "\n  CRM:", certo, "\n  app:", app)

    for caso, app in zip(preencher, obtido["preenchidos"]):
        datas = [(c, date.fromisoformat(d)) for c, d in caso["datas"]]
        texto, avisos = situacoes.preencher(caso["texto"], caso["campos"], datas, date.fromisoformat(caso["hoje"]))
        comparar("preencher", {"texto": texto, "avisos": avisos}, app, caso)
    # No app a "Dia pedido não abriu" tem também a DIA-03 (no CRM ela fica no quadro próprio). Para comparar, o CRM roda
    # com a mesma lista de códigos do app.
    con = banco_com(respostas)
    originais = {s["id"]: s["codigos"] for s in situacoes.SITUACOES}
    try:
        for s in situacoes.SITUACOES:
            s["codigos"] = lista[s["id"]]["codigos"]
        for caso, app in zip(montar, obtido["montados"]):
            certo = situacoes.montar(con, caso["situacao"]["id"], caso["codigo"], caso["campos"],
                                     date.fromisoformat(caso["hoje"]))
            certo.pop("faltando", None)
            comparar("montar", certo, app, {k: caso[k] for k in ("codigo", "campos", "hoje")})
    finally:
        for s in situacoes.SITUACOES:
            s["codigos"] = originais[s["id"]]
    for link, app in zip(links, obtido["kits"]):
        if link["qtde"]:
            kit = (f"{link['qtde'] - 1} + 1 extra" if (link["grupo"] or "") in ("extra", "plus") and link["qtde"] > 1
                   else agendamento.nome_do_kit(link["qtde"], link["grupo"]))
            certo = {"kit": kit, "qtde": link["qtde"]}
        else:
            certo = {"kit": "", "qtde": ""}
        comparar("kit", certo, app, link)
    if [s["id"] for s in situacoes.SITUACOES] != list(lista):
        erros += 1
        print("A lista do app não bate com a do CRM.")
    if lista["dia-nao-abriu"]["codigos"][0] != "DIA-03" or lista["pedido-em-aberto"]["codigos"] != ["RSP-027"]:
        erros += 1
        print("A lista do app não tem a DIA-03 ou a RSP-027 onde devia.")
    print(f"{len(preencher)} preenchimentos, {len(montar)} respostas montadas e {len(links)} kits conferidos, "
          f"{erros} diferenças.")
    return erros


if __name__ == "__main__":
    sys.exit(1 if main() else 0)
