r"""Publica o aplicativo no GitHub Pages: atualiza a lista de CEPs e a versão, confere a lógica contra o CRM, salva a
versão e envia só a pasta app/ para o ramo gh-pages (é dele que o GitHub Pages monta o site).

    C:\CRM-Lumielle\.venv\Scripts\python.exe ferramentas\publicar.py
"""
import os
import subprocess
import sys

PASTA = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def rodar(*comando, checar=True):
    print(">", " ".join(comando))
    return subprocess.run(comando, cwd=PASTA, check=checar)


def main():
    rodar(sys.executable, "ferramentas/atualizar.py")
    rodar(sys.executable, "testes/testar.py")
    rodar("git", "add", "-A")
    if subprocess.run(["git", "diff", "--cached", "--quiet"], cwd=PASTA).returncode:
        rodar("git", "commit", "-q", "-m", "Atualiza o aplicativo")
    rodar("git", "push", "-q", "origin", "main")
    rodar("git", "subtree", "push", "--prefix", "app", "origin", "gh-pages")
    print("Publicado. O celular pega a versão nova na próxima vez que abrir o app com internet.")


if __name__ == "__main__":
    main()
