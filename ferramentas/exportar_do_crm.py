r"""Leva os links de checkout e a Galeria do CRM para o aplicativo e publica (pedido e autorização do Rogerio, 13/10/2026).

Abre o banco do CRM SÓ PARA LEITURA e lê SÓ estas tabelas, sem nenhum dado de cliente:
- checkout_links: plataforma, grupo, oferta, quantidade, preço e link;
- imagens: nome, arquivo, plataforma e grupo da Galeria;
- respostas, grupos_resposta, objecoes, objecoes_secoes e objecoes_mensagens (24/10/2026): os textos prontos, sem as
  mensagens RMK. Vão EMBARALHADOS com a senha de C:\CRM-Lumielle\senha_do_app.txt (veja ferramentas/mensagens.py) e
  só se nenhum texto tiver cara de telefone, CPF, e-mail ou CEP.
Copia as imagens da pasta galeria do CRM para app/galeria, grava app/dados.js e publica (ferramentas/publicar.py).
Na tela aparecem só as contagens. É o Rogerio quem roda, no computador (uma linha):
    C:\CRM-Lumielle\.venv\Scripts\python.exe C:\Agendamento-Lumielle\ferramentas\exportar_do_crm.py
"""
import argparse
import json
import os
import shutil
import sqlite3
import sys
from datetime import datetime

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import mensagens  # noqa: E402

PASTA = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
APP = os.path.join(PASTA, "app")
CRM = os.environ.get("CRM_LUMIELLE", r"C:\CRM-Lumielle")
SENHA = os.path.join(CRM, "senha_do_app.txt")
ORDEM_GRUPO = "CASE grupo WHEN 'normal' THEN 1 WHEN 'extra' THEN 2 WHEN 'desconto' THEN 3 WHEN 'plus' THEN 4 ELSE 5 END"


def ler_crm(banco):
    con = sqlite3.connect(f"file:{banco}?mode=ro", uri=True)  # só leitura
    con.row_factory = sqlite3.Row
    try:
        links = [dict(r) for r in con.execute(
            "SELECT plataforma, grupo, oferta, qtde, preco, link FROM checkout_links"
            f" ORDER BY plataforma = 'Braip', {ORDEM_GRUPO}, ordem, id")]
        colunas = {r["name"] for r in con.execute("PRAGMA table_info(imagens)")}
        if "grupo" in colunas:  # migração 27 do CRM (23/10/2026): galeria separada como o Checkout
            imagens = [dict(r) for r in con.execute(
                "SELECT titulo, arquivo, plataforma, grupo FROM imagens"
                f" ORDER BY CASE plataforma WHEN 'Logzz' THEN 1 WHEN 'Braip' THEN 2 ELSE 3 END, {ORDEM_GRUPO}, ordem, id")]
        else:  # o CRM ainda não foi aberto depois da mudança
            imagens = [dict(r, plataforma=None, grupo=None) for r in con.execute(
                "SELECT titulo, arquivo FROM imagens ORDER BY ordem, id")]
        textos = mensagens.ler(con)
    finally:
        con.close()
    return links, imagens, textos


def exportar(banco, galeria_crm, arquivo_senha=SENHA):
    """Levanta mensagens.DadoPessoal ou mensagens.SenhaInvalida antes de gravar qualquer coisa."""
    links, imagens, textos = ler_crm(banco)
    mensagens.conferir_dados_pessoais(textos)
    senha = mensagens.ler_senha(arquivo_senha)
    destino = os.path.join(APP, "galeria")
    os.makedirs(destino, exist_ok=True)
    validas = []
    for i in imagens:
        nome = os.path.basename(i["arquivo"])
        origem = os.path.join(galeria_crm, nome)
        if not os.path.isfile(origem):
            print(f'Aviso: o arquivo da imagem "{i["titulo"]}" não está na pasta galeria do CRM; ficou de fora.')
            continue
        alvo = os.path.join(destino, nome)
        if not os.path.isfile(alvo) or os.path.getsize(alvo) != os.path.getsize(origem):
            shutil.copy2(origem, alvo)
        validas.append({"titulo": i["titulo"], "arquivo": "galeria/" + nome, "plataforma": i["plataforma"],
                        "grupo": i["grupo"]})
    usados = {os.path.basename(i["arquivo"]) for i in validas}
    for nome in os.listdir(destino):  # imagem que saiu da Galeria do CRM sai do app também
        if nome not in usados:
            os.remove(os.path.join(destino, nome))
    dados = {"exportado_em": datetime.now().strftime("%d/%m/%Y %H:%M"), "checkout": links, "imagens": validas,
             "mensagens": mensagens.cifrar(textos, senha) if senha else None}
    with open(os.path.join(APP, "dados.js"), "w", encoding="utf-8", newline="\n") as f:
        f.write("/* Gerado por ferramentas/exportar_do_crm.py (links de checkout e Galeria do CRM). Não edite à mão. */\n"
                "self.DADOS = " + json.dumps(dados, ensure_ascii=False, indent=1) + ";\n")
    print(f"Do CRM: {len(links)} links de checkout e {len(validas)} imagens da Galeria.")
    n_resp = sum(len(g["itens"]) for g in textos["respostas"])
    n_obj = sum(len(s["itens"]) for s in textos["objecoes"])
    if senha:
        print(f"Mensagens (com senha): {n_resp} respostas e {n_obj} objeções.")
    else:
        print(f"Aviso: as mensagens NÃO foram para o app, porque falta o arquivo da senha ({arquivo_senha}).\n"
              "  Crie esse arquivo no Bloco de Notas com uma frase de 4 palavras ou mais na primeira linha e rode de novo.")


def main():
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")  # acentos certos na tela
    opcoes = argparse.ArgumentParser(description="Leva os links de checkout e a Galeria do CRM para o aplicativo.")
    opcoes.add_argument("--banco", default=os.path.join(CRM, "crm.db"))
    opcoes.add_argument("--galeria", default=os.path.join(CRM, "galeria"))
    opcoes.add_argument("--sem-publicar", action="store_true")
    args = opcoes.parse_args()
    try:
        exportar(args.banco, args.galeria)
    except mensagens.DadoPessoal as erro:
        print("NADA FOI PUBLICADO. Estes textos parecem ter dado de cliente; corrija no CRM e rode de novo:")
        for achado in erro.args[0]:
            print("  - " + achado)
        sys.exit(1)
    except mensagens.SenhaInvalida as erro:
        print("NADA FOI PUBLICADO. " + str(erro))
        sys.exit(1)
    if not args.sem_publicar:
        sys.path.insert(0, os.path.join(PASTA, "ferramentas"))
        import publicar
        publicar.main()


if __name__ == "__main__":
    main()
