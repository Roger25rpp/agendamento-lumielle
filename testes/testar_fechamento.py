r"""Confere que a mensagem de fechamento do app (app/logica.js) dá exatamente o mesmo resultado do CRM (crm/agendamento.py) em
milhares de casos fictícios, e que o bloco gerado no app é lido certo pelo CRM. Roda junto com o testes\testar.py."""
import json
import os
import random
import subprocess
import sys
import tempfile
from datetime import date, timedelta

PASTA = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.environ.get("CRM_LUMIELLE", r"C:\CRM-Lumielle"))
from crm import agendamento as ag  # noqa: E402

FIXOS = ["Rua das Acácias, 120, apto 32, Jardim Primavera, Belo Horizonte", "Av. Brasil 4500 casa 2 - Centro - Curitiba/PR",
         "Rua:  Ipê Amarelo\nNº 15\nBairro: Vila Nova\nCidade: Goiânia", "", "   \n ", "Rua 10", "Rua 7 de Setembro", "só um texto",
         "Rua 7 de Setembro 120, Centro, Lagoa Santa", "Rua 10, 120, Centro, Goiânia, GO, 74000-000", "Rua Fictícia 45 Bairro: Alto Cidade: Lagoa CEP: 30130-000",
         "Rua Sem Saída S/N, Casa Verde, São Paulo", "Rua das Flores, 12\nfundos\nCentro\nmontes claros - mg", "Rua X sem numero, Centro, Lagoa",
         "Travessa B nº 9, bloco A, apto 201, Vila Rica, Niterói RJ", "Rua: Av. Paulista, 1000, Complemento: sala 5, Bela Vista, São Paulo-SP",
         "[12/10, 10:26] Ana Fictícia: Rua Doze 12, Lapa, Rio de Janeiro", "Rua A, 1, Bairro B, Extra C, Cidade D", "*Rua Negrito*, 1, _Lapa_, Lagoa",
         "Nome: Ana\nRua X, 1", "UF: XX\nEstado: Minas Gerais", "Rua: \nBairro: ", "CEP 30.130-000", "Cidade: Goiânia/GO", "Número: 15\nRua Y", "2º andar, Rua Z, 3"]
PEDACOS = ["Rua das Acácias", "Av. Brasil", "Avenida 5", "Rua 25 de Março", "R. Doze", "Travessa B", "Rua Ipê 120", "Av. Sete 45 casa 2", "Rodovia BR 101",
           "120", "45A", "s/n", "S/N", "sn", "sem número", "Nº 15", "n 12", "nº9", "apto 32", "ap 4", "Apartamento 12", "casa", "casa B", "Casa Verde", "bloco A",
           "bl 3", "sala 2", "lote 5", "quadra 3 lote 2", "fundos", "torre 1", "2º andar", "Edifício Aurora", "Centro", "Jardim Primavera", "Vila Nova", "Lapa",
           "Belo Horizonte", "Curitiba/PR", "Goiânia - GO", "Niterói RJ", "São Paulo-SP", "montes claros", "MG", "sp", "PR", "AP", "30130-000", "CEP: 01001-000",
           "20.000-000", "74000000", "Rua: Ipê", "Bairro: Alto", "Cidade: Lagoa", "Cidade: Lagoa/MG", "Complemento: fundos", "Compl: ap 2", "UF: RJ", "Estado: SP",
           "Número: 77", "Logradouro: Beco Y 8", "Referência: perto da praça", "Nome: Ana", "*Rua Negrito*", "_Lapa_"]
SEPARADORES = [", ", ",", " - ", "\n", "; ", " – ", " "]
LINKS = [{"id": 1, "plataforma": "Logzz", "grupo": "normal", "qtde": 1, "preco": 197.9, "oferta": "a", "link": "https://exemplo.com/1"},
         {"id": 2, "plataforma": "Logzz", "grupo": "normal", "qtde": 3, "preco": 297.9, "oferta": "b", "link": "https://exemplo.com/2"},
         {"id": 3, "plataforma": "Logzz", "grupo": "extra", "qtde": 4, "preco": 297.9, "oferta": "c", "link": "https://exemplo.com/3"},
         {"id": 4, "plataforma": "Logzz", "grupo": "plus", "qtde": 7, "preco": 1377.5, "oferta": "d", "link": "https://exemplo.com/4"},
         {"id": 5, "plataforma": "Logzz", "grupo": "desconto", "qtde": 12, "preco": 677.9, "oferta": "e", "link": "https://exemplo.com/5"},
         {"id": 6, "plataforma": "Logzz", "grupo": None, "qtde": None, "preco": None, "oferta": "f", "link": "https://exemplo.com/6"},
         {"id": 7, "plataforma": "Braip", "grupo": "normal", "qtde": 3, "preco": 297.9, "oferta": "g", "link": "https://exemplo.com/7"},
         {"id": 8, "plataforma": "Braip", "grupo": "extra", "qtde": 5, "preco": None, "oferta": "h", "link": "https://exemplo.com/8"},
         {"id": 9, "plataforma": "Braip", "grupo": None, "qtde": 2, "preco": 100, "oferta": "i", "link": "https://exemplo.com/9"}]
MODELOS = {"Logzz": ag.MODELO_LOGZZ, "Braip": ag.MODELO_BRAIP}
NOMES = ["Maria de Souza", "ana", "ROGERIO .", ".", "", "  josé   lima ", "Ç é"]


def enderecos(sorte):
    yield from FIXOS
    for _ in range(4000):
        partes = sorte.sample(PEDACOS, sorte.randint(1, 7))
        separador = sorte.choice(SEPARADORES)
        yield separador.join(partes)


def fechamentos(sorte):
    hoje = date(2026, 11, 3)
    for _ in range(3000):
        dia = hoje + timedelta(days=sorte.randint(-3, 40))
        base = (hoje + timedelta(days=sorte.randint(0, 6))).isoformat()
        yield {"hoje": base, "situacao": sorte.choice(["atende", "atende", "fora", "sem_cep", "sem_lista"]), "sem_estoque": sorte.random() < .2, "campos": {
            "nome": sorte.choice(NOMES), "telefone": sorte.choice(["21982260000", "", "(21) 8226-0000"]), "cpf": sorte.choice(["", "529.982.247-25"]),
            "cep": sorte.choice(["30130-000", "30130000", "123", ""]), "rua": sorte.choice(["Rua das Acácias", "  Rua   Dupla ", "", "{kit}"]),
            "numero": sorte.choice(["120", "s/n", ""]), "complemento": sorte.choice(["", "apto 32", "  "]), "bairro": sorte.choice(["Centro", "", "Jardim $1"]),
            "cidade": sorte.choice(["Lagoa Clara", ""]), "uf": sorte.choice(["", "MG"]), "link_id": sorte.choice(["", "1", "2", "3", "4", "5", "6", "7", "8", "9", "99"]),
            "dia_tipo": sorte.choice(["", "amanha", "quanto_antes", "data", "data"]), "dia_data": sorte.choice([dia.isoformat(), "2026-02-30", "qualquer", ""]),
            "turno": sorte.choice(["", "manha", "tarde", "outro"])}}


def testar_exportacao():
    """O que vai para o app: o id dos links e os textos, estes só embaralhados. Banco temporário, nada é publicado."""
    sys.path.insert(0, os.path.join(os.path.dirname(PASTA), "ferramentas"))
    import exportar_do_crm
    import mensagens
    from crm import db
    erros = 0
    with tempfile.TemporaryDirectory() as pasta:
        banco = os.path.join(pasta, "t.db")
        db.migrar(banco, os.path.join(pasta, "b"))
        con = db.conectar(banco)
        with con:
            con.execute("INSERT INTO checkout_links (plataforma, oferta, qtde, preco, link, grupo, criado_em, atualizado_em) "
                        "VALUES ('Logzz', 'x', 3, 297.9, 'https://exemplo.com/x', 'normal', 'a', 'a')")
            con.execute("INSERT INTO imagens (titulo, arquivo, criado_em) VALUES ('Aviso', 'img_aviso.png', 'a')")
        ag.salvar_estoque(con, "", "", 1)
        con.close()
        links, _, textos = exportar_do_crm.ler_crm(banco)
        a = textos["agendamento"]
        pacote = json.dumps(mensagens.cifrar(textos, "girassol cadeira azul montanha"))
        for certo, descricao in ((links[0]["id"] == 1, "o link leva o id"),
                                 (a["Logzz"] == ag.MODELO_LOGZZ and a["Braip"] == ag.MODELO_BRAIP, "textos do fechamento"),
                                 (a["estoque_sem_previsao"] == ag.MODELO_ESTOQUE_SEM_PREVISAO, "textos do estoque"),
                                 (a["estoque_imagem"] == "galeria/img_aviso.png", "imagem do estoque"),
                                 ("setor de agendamento" not in pacote and "Minha flor" not in pacote, "os textos vão embaralhados")):
            if not certo:
                print("FALHOU:", descricao)
                erros += 1
        try:
            mensagens.conferir_dados_pessoais(textos)
        except mensagens.DadoPessoal as erro:
            print("FALHOU: falso alarme de dado pessoal:", erro)
            erros += 1
        textos["agendamento"]["estoque_previsao"] = "Ligue para (21) 98226-0000"
        try:
            mensagens.conferir_dados_pessoais(textos)
            print("FALHOU: a trava de dado pessoal não pegou o texto do agendamento")
            erros += 1
        except mensagens.DadoPessoal:
            pass
    return erros


def main():
    sorte = random.Random(2026)
    lista_enderecos, lista_fechamentos = list(enderecos(sorte)), list(fechamentos(sorte))
    hoje = date(2026, 11, 3)
    dias = [[t, (hoje + timedelta(days=n)).isoformat(), (hoje + timedelta(days=b)).isoformat()]
            for n in range(-5, 30) for b in range(0, 7) for t in ("amanha", "data", "quanto_antes", "")]
    kits_nomes = [[q, g] for q in (None, 0, 1, 2, 3, 4, 7, 13) for g in ("normal", "extra", "plus", "desconto", None)]
    reais = [0, 1, 197.9, 297.9, 1000, 1397.9, 12345.5, 1234567.89]
    js = subprocess.run(["node", os.path.join(PASTA, "rodar_fechamento.js")], capture_output=True, text=True, encoding="utf-8", check=True,
                        input=json.dumps({"enderecos": lista_enderecos, "fechamentos": lista_fechamentos, "links": LINKS, "modelos": MODELOS, "dias": dias,
                                          "kitsNomes": kits_nomes, "reais": reais, "nomes": NOMES}))
    app = json.loads(js.stdout)
    erros, total = 0, 0

    def comparar(rotulo, entrada, crm, obtido):
        nonlocal erros, total
        total += 1
        if crm != obtido:
            erros += 1
            if erros <= 5:
                print(f"DIFERENTE ({rotulo}):", repr(entrada), "\n  CRM:", crm, "\n  app:", obtido)

    for texto, obtido in zip(lista_enderecos, app["enderecos"]):
        comparar("endereço", texto, ag.separar_endereco(texto), obtido)
    for caso, obtido, bloco in zip(lista_fechamentos, app["fechamentos"], app["blocos"]):
        dia = date.fromisoformat(caso["hoje"])
        comparar("fechamento", caso, ag.fechamento(caso["campos"], LINKS, caso["situacao"], MODELOS, dia), obtido)
        comparar("bloco", caso, ag.gerar_bloco(caso["campos"], dia, caso["sem_estoque"], LINKS), bloco)
        lido = ag.ler_bloco(bloco, dia)  # do app para o CRM, no mesmo dia: a mensagem tem de ser a mesma
        if lido is None:
            comparar("bloco lido", caso, "reconhecido", None)
            continue
        comparar("bloco lido", caso, bool(caso["sem_estoque"]), lido["sem_estoque"])
        comparar("mensagem pelo bloco", caso, obtido["mensagem"], ag.fechamento(lido, LINKS, caso["situacao"], MODELOS, dia)["mensagem"])
    for d, obtido in zip(dias, app["dias"]):
        comparar("dia", d, ag.dia_da_entrega(d[0], d[1], date.fromisoformat(d[2])), obtido)
    for k, obtido in zip(kits_nomes, app["kits"]):
        comparar("kit", k, ag.nome_do_kit(k[0], k[1]), obtido)
    for v, obtido in zip(reais, app["reais"]):
        comparar("reais", v, ag.em_reais(v), obtido)
    for n, obtido in zip(NOMES, app["nomes"]):
        comparar("nome", n, ag.primeiro_nome(n), obtido)
    print(f"Mensagem de fechamento: {total} casos conferidos, {erros} diferenças.")
    return erros + testar_exportacao()


if __name__ == "__main__":
    raise SystemExit(1 if main() else 0)
