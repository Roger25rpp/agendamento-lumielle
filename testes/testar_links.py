"""Confere o noNavegador do app/telas.js (24/10/2026): no app instalado do Android, o "Abrir" do Check-out manda o link
para o Chrome; fora disso, o link fica como está. Roda junto com o testes\testar.py."""
import json
import os
import subprocess

PASTA = os.path.dirname(os.path.abspath(__file__))
TELAS = os.path.join(os.path.dirname(PASTA), "app", "telas.js")
ANDROID = "Mozilla/5.0 (Linux; Android 14; SM-A145M) AppleWebKit/537.36 Chrome/130.0 Mobile Safari/537.36"
IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148"
LINK = "https://pay.braip.com/checkout/abc?x=1&y=2"
CASOS = [
    (LINK, ANDROID, True, "intent://pay.braip.com/checkout/abc?x=1&y=2#Intent;scheme=https;package=com.android.chrome;"
                          "S.browser_fallback_url=https%3A%2F%2Fpay.braip.com%2Fcheckout%2Fabc%3Fx%3D1%26y%3D2;end"),
    (LINK, ANDROID, False, LINK),  # aberto no Chrome, não no app instalado
    (LINK, IPHONE, True, LINK),
    ("https://exemplo.com/a#parte", ANDROID, True, "https://exemplo.com/a#parte"),
    ("http://exemplo.com/a", ANDROID, True, "http://exemplo.com/a"),
]
JS = r"""
const s = require("fs").readFileSync(process.argv[1], "utf8");
const inicio = s.indexOf("  function noNavegador"), fim = s.indexOf("\n  }", inicio) + 4;
global.window = {}; global.navigator = {};
const noNavegador = new Function(s.slice(inicio, fim) + "return noNavegador;")();
process.stdout.write(JSON.stringify(JSON.parse(process.argv[2]).map((c) => noNavegador(c[0], c[1], c[2]))));
"""


# "Enviar marcadas" da Galeria (03/11/2026): todos os arquivos juntos, limite de 10, cancelar não é erro.
JS_VARIAS = r"""
const s = require("fs").readFileSync(process.argv[1], "utf8");
const inicio = s.indexOf("  var LIMITE_ENVIO"), fim = s.indexOf("\n  }", s.indexOf("function compartilharVarias")) + 4;
const compartilhar = new Function(s.slice(inicio, fim) + "return compartilharVarias;")();
const enviados = [];
const nav = (share) => ({ canShare: () => true, share: (d) => { enviados.push(d.files.length); return share(); } });
const ok = () => Promise.resolve(), cancelou = () => Promise.reject({ name: "AbortError" }), erro = () => Promise.reject({ name: "NotAllowedError" });
const nomes = (n) => Array(n).fill("a.png");
Promise.all([
  compartilhar(nomes(3), nav(ok)), compartilhar(nomes(10), nav(ok)), compartilhar(nomes(11), nav(ok)),
  compartilhar(nomes(2), nav(cancelou)), compartilhar(nomes(2), nav(erro)),
  compartilhar(nomes(2), { canShare: () => false }), compartilhar(nomes(2), {}),
]).then((r) => process.stdout.write(JSON.stringify({ resultados: r, enviados })));
"""
VARIAS = {"resultados": ["enviou", "enviou", "muitas", "cancelou", "falhou", "sem_suporte", "sem_suporte"],
          "enviados": [3, 10, 2, 2]}


def main():
    js = subprocess.run(["node", "-e", JS, TELAS, json.dumps([c[:3] for c in CASOS])], capture_output=True, text=True,
                        encoding="utf-8")
    saida = json.loads(js.stdout or "[]")
    erros = 0
    for caso, obtido in zip(CASOS, saida + [None] * len(CASOS)):
        if obtido != caso[3]:
            print("FALHOU: link do Check-out", caso[:3], "->", obtido)
            erros += 1
    print(f"Links do Check-out: {erros} problema(s).")
    js = subprocess.run(["node", "-e", JS_VARIAS, TELAS], capture_output=True, text=True, encoding="utf-8")
    if json.loads(js.stdout or "null") != VARIAS:
        print("FALHOU: Enviar marcadas ->", js.stdout, js.stderr)
        erros += 1
    else:
        print("Enviar marcadas da Galeria: ok.")
    return erros


if __name__ == "__main__":
    raise SystemExit(1 if main() else 0)
