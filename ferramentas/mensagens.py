"""Respostas e Objeções do CRM para a aba Mensagens do app, embaralhadas com a senha do Rogerio (pedido de 24/10/2026).

O app é público (GitHub Pages): os textos são o roteiro de venda, por isso vão embaralhados. A senha fica no arquivo
C:\\CRM-Lumielle\\senha_do_app.txt (fora do Git e da internet); o celular pede a mesma senha uma vez.
Mesmo esquema do app/cifra.js, só com a biblioteca padrão do Python (veja a explicação lá).
A Recompra fica de fora (decisão do Rogerio, 24/10/2026): as mensagens com código RMK não vão.
"""
import base64
import hashlib
import hmac
import json
import os
import re
import unicodedata

SAL = b"agendamento-lumielle:mensagens:v1"
ITERACOES = 600_000
PALAVRAS_MINIMAS = 4

# Trava (24/10/2026): texto com cara de dado pessoal não é publicado
DADOS_PESSOAIS = {
    "telefone": re.compile(r"(?<!\d)(?:\+?55[\s.-]?)?\(?\d{2}\)?[\s.-]?9?\d{4}[\s.-]?\d{4}(?!\d)"),
    "CPF": re.compile(r"(?<!\d)\d{3}\.?\d{3}\.?\d{3}-?\d{2}(?!\d)"),
    "e-mail": re.compile(r"[\w.+-]+@[\w-]+\.[\w.-]+"),
    "CEP": re.compile(r"(?<!\d)\d{5}-\d{3}(?!\d)"),
}


class SenhaInvalida(ValueError):
    pass


class DadoPessoal(ValueError):
    pass


def normalizar(senha):
    """Igual ao app: sem espaços nas pontas, espaços repetidos viram um, tudo minúsculo."""
    return " ".join(unicodedata.normalize("NFC", senha or "").split()).lower()


def ler_senha(caminho):
    """Primeira linha do arquivo. Sem arquivo -> None. Senha curta -> SenhaInvalida."""
    if not os.path.isfile(caminho):
        return None
    with open(caminho, encoding="utf-8-sig") as f:
        linhas = [normalizar(l) for l in f if l.strip()]
    senha = linhas[0] if linhas else ""
    if len(senha.split(" ")) < PALAVRAS_MINIMAS:
        raise SenhaInvalida(f"A senha do arquivo {caminho} precisa ter pelo menos {PALAVRAS_MINIMAS} palavras "
                            '(ex.: "girassol cadeira azul montanha").')
    return senha


def _fluxo(chave, nonce, tamanho):
    blocos = (hmac.new(chave, nonce + i.to_bytes(4, "big"), hashlib.sha256).digest() for i in range((tamanho + 31) // 32))
    return b"".join(blocos)[:tamanho]


def cifrar(objeto, senha, nonce=None):
    chave = hashlib.pbkdf2_hmac("sha256", normalizar(senha).encode("utf-8"), SAL, ITERACOES, dklen=64)
    nonce = nonce or os.urandom(16)
    claro = json.dumps(objeto, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
    dados = bytes(a ^ b for a, b in zip(claro, _fluxo(chave[:32], nonce, len(claro))))
    selo = hmac.new(chave[32:], b"v1" + nonce + dados, hashlib.sha256).digest()
    b64 = lambda b: base64.b64encode(b).decode("ascii")
    return {"v": 1, "iteracoes": ITERACOES, "nonce": b64(nonce), "dados": b64(dados), "selo": b64(selo)}


def decifrar(pacote, senha):
    """Só para os testes (o app faz o mesmo no celular)."""
    chave = hashlib.pbkdf2_hmac("sha256", normalizar(senha).encode("utf-8"), SAL, pacote["iteracoes"], dklen=64)
    nonce, dados = base64.b64decode(pacote["nonce"]), base64.b64decode(pacote["dados"])
    selo = hmac.new(chave[32:], b"v1" + nonce + dados, hashlib.sha256).digest()
    if not hmac.compare_digest(selo, base64.b64decode(pacote["selo"])):
        raise SenhaInvalida("senha errada")
    return json.loads(bytes(a ^ b for a, b in zip(dados, _fluxo(chave[:32], nonce, len(dados)))))


def ler(con):
    """{"respostas": [{"grupo", "itens": [{"codigo", "titulo", "texto"}]}],
        "objecoes": [{"secao", "nota", "itens": [{"codigo", "titulo", "dor", "resultado", "nota",
                                                   "mensagens": [{"rotulo", "texto"}]}]}]}"""
    respostas, grupos = [], {}
    for r in con.execute(
            "SELECT g.id AS gid, g.nome AS grupo, r.codigo, r.titulo, r.texto FROM respostas r"
            " JOIN grupos_resposta g ON g.id = r.grupo_id WHERE COALESCE(r.codigo, '') NOT LIKE 'RMK-%'"
            " ORDER BY g.ordem, g.id, r.ordem, r.id"):
        if r["gid"] not in grupos:
            grupos[r["gid"]] = {"grupo": r["grupo"], "itens": []}
            respostas.append(grupos[r["gid"]])
        grupos[r["gid"]]["itens"].append({"codigo": r["codigo"] or "", "titulo": r["titulo"], "texto": r["texto"]})
    objecoes = []
    for s in con.execute("SELECT id, nome, nota FROM objecoes_secoes ORDER BY ordem, id").fetchall():
        itens = []
        for o in con.execute("SELECT id, codigo, titulo, dor, resultado, nota FROM objecoes WHERE secao_id = ?"
                             " ORDER BY ordem, id", (s["id"],)).fetchall():
            mensagens = [{"rotulo": m["rotulo"], "texto": m["texto"]} for m in con.execute(
                "SELECT rotulo, texto FROM objecoes_mensagens WHERE objecao_id = ? ORDER BY ordem, id", (o["id"],))]
            itens.append({"codigo": o["codigo"], "titulo": o["titulo"], "dor": o["dor"], "resultado": o["resultado"],
                          "nota": o["nota"], "mensagens": mensagens})
        if itens:
            objecoes.append({"secao": s["nome"], "nota": s["nota"], "itens": itens})
    return {"respostas": respostas, "objecoes": objecoes}


def conferir_dados_pessoais(mensagens):
    """Levanta DadoPessoal com a lista do que parece telefone, CPF, e-mail ou CEP (mostra só onde, nunca o valor)."""
    achados = []

    def olhar(onde, *textos):
        for nome, padrao in DADOS_PESSOAIS.items():
            if any(padrao.search(t or "") for t in textos):
                achados.append(f"{onde}: parece ter {nome}")

    for g in mensagens["respostas"]:
        for r in g["itens"]:
            olhar(f'Resposta "{r["titulo"]}" (grupo {g["grupo"]})', r["titulo"], r["texto"])
    for s in mensagens["objecoes"]:
        olhar(f'Seção de objeções "{s["secao"]}"', s["secao"], s["nota"])
        for o in s["itens"]:
            olhar(f'Objeção {o["codigo"]}', o["titulo"], o["dor"], o["resultado"], o["nota"],
                  *(m["rotulo"] for m in o["mensagens"]), *(m["texto"] for m in o["mensagens"]))
    if achados:
        raise DadoPessoal(achados)
