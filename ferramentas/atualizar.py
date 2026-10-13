"""Prepara o aplicativo para publicar.

1. Lê a lista de CEPs da Logzz do CRM (C:\\CRM-Lumielle\\cobertura\\cobertura_logzz.xlsx), com a mesma leitura do CRM,
   e grava app/cobertura.js. A lista não tem dado de cliente.
2. Muda a VERSAO do app/sw.js quando algum arquivo do aplicativo mudou, para o celular baixar a versão nova.

Rodar com o Python do CRM (tem o openpyxl):
    C:\\CRM-Lumielle\\.venv\\Scripts\\python.exe ferramentas\\atualizar.py
"""
import hashlib
import json
import os
import re
import sys
from datetime import date

PASTA = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
APP = os.path.join(PASTA, "app")
CRM = os.environ.get("CRM_LUMIELLE", r"C:\CRM-Lumielle")


def gravar(caminho, texto):
    with open(caminho, "w", encoding="utf-8", newline="\n") as f:
        f.write(texto)


def ler(caminho):
    with open(caminho, encoding="utf-8") as f:
        return f.read()


def cobertura():
    sys.path.insert(0, CRM)
    from crm import cobertura as leitura
    planilha = os.path.join(CRM, "cobertura", leitura.ARQUIVO)
    faixas = [[f["inicio"], f["fim"], f["cidade"], f["uf"], f["obs"]] for f in leitura.ler(planilha)]
    atualizada = date.fromtimestamp(os.path.getmtime(planilha)).strftime("%d/%m/%Y")
    caminho = os.path.join(APP, "cobertura.js")
    antes = ler(caminho) if os.path.exists(caminho) else ""
    corpo = json.dumps(faixas, ensure_ascii=False, separators=(",", ":")).replace("],[", "],\n[")
    novo = ("/* Gerado por ferramentas/atualizar.py a partir do cobertura_logzz.xlsx do CRM. Não edite à mão. */\n"
            f'window.COBERTURA = {{"atualizada_em": "{atualizada}", "faixas": {corpo}}};\n')
    if novo != antes:
        gravar(caminho, novo)
    print(f"Lista de CEPs: {len(faixas)} faixas (arquivo de {atualizada}).")


def versao():
    soma = hashlib.sha256()
    for raiz, pastas, arquivos in os.walk(APP):
        pastas.sort()
        for nome in sorted(arquivos):
            if nome == "sw.js":
                continue
            caminho = os.path.join(raiz, nome)
            soma.update(os.path.relpath(caminho, APP).replace("\\", "/").encode())
            with open(caminho, "rb") as f:
                soma.update(f.read())
    sw = os.path.join(APP, "sw.js")
    texto = ler(sw)
    nova = soma.hexdigest()[:12]
    texto_novo = re.sub(r'var VERSAO = "[^"]*";', f'var VERSAO = "{nova}";', texto, count=1)
    if texto_novo != texto:
        gravar(sw, texto_novo)
        print(f"Versão nova do aplicativo: {nova}")
    else:
        print(f"Nada mudou no aplicativo (versão {nova}).")


if __name__ == "__main__":
    cobertura()
    versao()
