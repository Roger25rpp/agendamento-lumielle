r"""Leva os links de checkout e a Galeria do CRM para o aplicativo e publica (pedido e autorização do Rogerio, 13/10/2026).

Abre o banco do CRM SÓ PARA LEITURA e lê SÓ duas tabelas, sem nenhum dado de cliente:
- checkout_links: plataforma, grupo, oferta, quantidade, preço e link;
- imagens: nome e arquivo da Galeria.
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

PASTA = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
APP = os.path.join(PASTA, "app")
CRM = os.environ.get("CRM_LUMIELLE", r"C:\CRM-Lumielle")
ORDEM_GRUPO = "CASE grupo WHEN 'normal' THEN 1 WHEN 'extra' THEN 2 WHEN 'desconto' THEN 3 WHEN 'plus' THEN 4 ELSE 5 END"


def ler_crm(banco):
    con = sqlite3.connect(f"file:{banco}?mode=ro", uri=True)  # só leitura
    con.row_factory = sqlite3.Row
    try:
        links = [dict(r) for r in con.execute(
            "SELECT plataforma, grupo, oferta, qtde, preco, link FROM checkout_links"
            f" ORDER BY plataforma = 'Braip', {ORDEM_GRUPO}, ordem, id")]
        imagens = [dict(r) for r in con.execute("SELECT titulo, arquivo FROM imagens ORDER BY ordem, id")]
    finally:
        con.close()
    return links, imagens


def exportar(banco, galeria_crm):
    links, imagens = ler_crm(banco)
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
        validas.append({"titulo": i["titulo"], "arquivo": "galeria/" + nome})
    usados = {os.path.basename(i["arquivo"]) for i in validas}
    for nome in os.listdir(destino):  # imagem que saiu da Galeria do CRM sai do app também
        if nome not in usados:
            os.remove(os.path.join(destino, nome))
    dados = {"exportado_em": datetime.now().strftime("%d/%m/%Y %H:%M"), "checkout": links, "imagens": validas}
    with open(os.path.join(APP, "dados.js"), "w", encoding="utf-8", newline="\n") as f:
        f.write("/* Gerado por ferramentas/exportar_do_crm.py (links de checkout e Galeria do CRM). Não edite à mão. */\n"
                "self.DADOS = " + json.dumps(dados, ensure_ascii=False, indent=1) + ";\n")
    print(f"Do CRM: {len(links)} links de checkout e {len(validas)} imagens da Galeria.")


def main():
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")  # acentos certos na tela
    opcoes = argparse.ArgumentParser(description="Leva os links de checkout e a Galeria do CRM para o aplicativo.")
    opcoes.add_argument("--banco", default=os.path.join(CRM, "crm.db"))
    opcoes.add_argument("--galeria", default=os.path.join(CRM, "galeria"))
    opcoes.add_argument("--sem-publicar", action="store_true")
    args = opcoes.parse_args()
    exportar(args.banco, args.galeria)
    if not args.sem_publicar:
        sys.path.insert(0, os.path.join(PASTA, "ferramentas"))
        import publicar
        publicar.main()


if __name__ == "__main__":
    main()
