r"""Confere a aba Mensagens (24/10/2026) só com dados fictícios: o Python embaralha e o app (cifra.js, no Node)
desembaralha igual; senha errada não abre; a trava de dado pessoal; o que sai do banco do CRM (sem as RMK).
Roda junto com o testes\testar.py (e, portanto, antes de cada publicação).
"""
import json
import os
import subprocess
import sys
import tempfile

PASTA = os.path.dirname(os.path.abspath(__file__))
APP = os.path.join(os.path.dirname(PASTA), "app")
CRM = os.environ.get("CRM_LUMIELLE", r"C:\CRM-Lumielle")
sys.path.insert(0, CRM)
sys.path.insert(0, os.path.join(os.path.dirname(PASTA), "ferramentas"))
import mensagens  # noqa: E402

SENHA = "girassol cadeira azul montanha"
FICTICIO = {"respostas": [{"grupo": "Abertura", "itens": [{"codigo": "", "titulo": "Oi", "texto": "Oi, {nome}! Tudo bem? ção ✓"}]}],
            "objecoes": [{"secao": "Preço", "nota": "", "itens": [{"codigo": "RSP-001", "titulo": "Achou caro", "dor": "d",
                                                                   "resultado": "r", "nota": "",
                                                                   "mensagens": [{"rotulo": "Passo 1", "texto": "x" * 5000}]}]}]}

JS = r"""
const Cifra = require(process.argv[2]);
let entrada = "";
process.stdin.on("data", (p) => (entrada += p));
process.stdin.on("end", async () => {
  const { pacote, senhas } = JSON.parse(entrada);
  const saida = [];
  for (const s of senhas) {
    try { saida.push(await Cifra.abrir(pacote, await Cifra.derivar(s, pacote.iteracoes))); }
    catch (e) { saida.push("ERRO:" + e.message); }
  }
  process.stdout.write(JSON.stringify(saida));
});
"""


def checar(condicao, descricao, erros):
    if not condicao:
        print("FALHOU:", descricao)
        erros.append(descricao)


def testar_cifra(erros):
    pacote = mensagens.cifrar(FICTICIO, SENHA)
    checar(mensagens.decifrar(pacote, "  Girassol  CADEIRA azul montanha ") == FICTICIO, "Python abre com a senha", erros)
    try:
        mensagens.decifrar(pacote, "girassol cadeira azul")
        checar(False, "Python recusa senha errada", erros)
    except mensagens.SenhaInvalida:
        pass
    checar("Achou caro" not in json.dumps(pacote) and "Oi, {nome}" not in json.dumps(pacote), "pacote embaralhado", erros)
    with tempfile.NamedTemporaryFile("w", suffix=".js", delete=False, encoding="utf-8") as f:
        f.write(JS)
    try:
        js = subprocess.run(["node", f.name, os.path.join(APP, "cifra.js")], capture_output=True, text=True, encoding="utf-8",
                            input=json.dumps({"pacote": pacote, "senhas": ["Girassol cadeira azul montanha", "outra senha qualquer"]}))
    finally:
        os.unlink(f.name)
    saida = json.loads(js.stdout or "null") or [None, None]
    checar(saida[0] == FICTICIO, "app abre com a senha (maiúscula do celular não atrapalha)", erros)
    checar(saida[1] == "ERRO:senha", "app recusa senha errada", erros)


def testar_senha(erros):
    with tempfile.TemporaryDirectory() as pasta:
        caminho = os.path.join(pasta, "senha_do_app.txt")
        checar(mensagens.ler_senha(caminho) is None, "sem arquivo de senha", erros)
        with open(caminho, "w", encoding="utf-8") as f:
            f.write("curta demais\n")
        try:
            mensagens.ler_senha(caminho)
            checar(False, "senha com menos de 4 palavras é recusada", erros)
        except mensagens.SenhaInvalida:
            pass
        with open(caminho, "w", encoding="utf-8-sig") as f:
            f.write("\n  Girassol cadeira  azul montanha \n")
        checar(mensagens.ler_senha(caminho) == SENHA, "senha lida e normalizada", erros)


def testar_trava(erros):
    limpos = ["R$ 197,90 à vista ou 12x de R$ 19,79", "3 frascos + 1 extra", "Entrega em 3 a 7 dias úteis",
              "Pedido 1234567", "20/10/2026", "Oi, {nome}!"]
    perigosos = {"telefone": "me chama no (21) 98226-0000", "telefone ": "5521982260000",
                 "CPF": "o CPF é 529.982.247-25", "e-mail": "ana@exemplo.com", "CEP": "CEP 20040-002"}
    for texto in limpos:
        try:
            mensagens.conferir_dados_pessoais({"respostas": [{"grupo": "G", "itens": [{"titulo": "t", "texto": texto}]}],
                                               "objecoes": []})
        except mensagens.DadoPessoal:
            checar(False, f"falso alarme em {texto!r}", erros)
    for tipo, texto in perigosos.items():
        try:
            mensagens.conferir_dados_pessoais({"respostas": [], "objecoes": [{"secao": "S", "nota": "", "itens": [
                {"codigo": "RSP-9", "titulo": "t", "dor": "", "resultado": "", "nota": "",
                 "mensagens": [{"rotulo": "", "texto": texto}]}]}]})
            checar(False, f"trava não pegou {tipo.strip()}", erros)
        except mensagens.DadoPessoal as e:
            checar(texto not in " ".join(e.args[0]), "o aviso não mostra o dado", erros)


def testar_banco(erros):
    """Banco fictício do CRM: as respostas RMK ficam de fora; grupos e objeções na ordem."""
    from crm.db import conectar, migrar
    with tempfile.TemporaryDirectory() as pasta:
        banco = os.path.join(pasta, "ficticio.db")
        migrar(banco, os.path.join(pasta, "backups"))
        con = conectar(banco)
        agora = "2026-10-24 10:00:00"
        con.execute("INSERT INTO grupos_resposta (id, nome, ordem, criado_em) VALUES (1, 'Abertura', 1, ?), (2, 'Recompra', 2, ?)",
                    (agora, agora))
        con.execute("INSERT INTO respostas (grupo_id, titulo, texto, codigo, ordem, criado_em, atualizado_em) VALUES"
                    " (1, 'Oi', 'Oi, {nome}!', NULL, 1, ?, ?), (2, 'RMK', 'recompra', 'RMK-002-A', 1, ?, ?)",
                    (agora, agora, agora, agora))
        con.execute("INSERT INTO objecoes_secoes (id, nome, nota, ordem) VALUES (1, 'Preço', 'nota da seção', 1)")
        con.execute("INSERT INTO objecoes (id, codigo, secao_id, titulo, dor, resultado, criado_em, atualizado_em)"
                    " VALUES (1, 'RSP-001', 1, 'Achou caro', 'dor', 'objetivo', ?, ?)", (agora, agora))
        con.execute("INSERT INTO objecoes_mensagens (objecao_id, rotulo, texto, ordem) VALUES (1, 'Passo 1', 'Entendo, {nome}.', 1)")
        con.commit()
        textos = mensagens.ler(con)
        con.close()
    checar(textos["respostas"] == [{"grupo": "Abertura", "itens": [{"codigo": "", "titulo": "Oi", "texto": "Oi, {nome}!"}]}],
           "respostas sem as RMK", erros)
    checar(textos["objecoes"][0]["itens"][0]["mensagens"] == [{"rotulo": "Passo 1", "texto": "Entendo, {nome}."}],
           "objeções com as mensagens", erros)


def main():
    erros = []
    for teste in (testar_cifra, testar_senha, testar_trava, testar_banco):
        teste(erros)
    print(f"Mensagens: {len(erros)} problema(s).")
    return len(erros)


if __name__ == "__main__":
    sys.exit(1 if main() else 0)
