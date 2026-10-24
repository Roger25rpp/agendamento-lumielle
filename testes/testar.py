r"""Confere que o aplicativo (app/logica.js) dá exatamente o mesmo resultado que o Agendamento do CRM, com textos
fictícios (fixos + aleatórios). Rodar com o Python do CRM:
    C:\CRM-Lumielle\.venv\Scripts\python.exe testes\testar.py
"""
import json
import os
import random
import subprocess
import sys

PASTA = os.path.dirname(os.path.abspath(__file__))
CRM = os.environ.get("CRM_LUMIELLE", r"C:\CRM-Lumielle")
sys.path.insert(0, CRM)
from crm import agendamento, cobertura, regioes  # noqa: E402

FIXOS = [
    "+55 21 98226-0000\nFulano de tal\n123.456.789-09\n20000-000",
    "Maria\n(11) 8765-4321\n52998224725\n01310100",
    "Nome: ana DA silva\nCPF: 529.982.247-25\nTel: 21 3226-0000\nCEP: 22041-001",
    "[10:32, 06/10/2026] Cliente: *Joana Souza*\n[10:33, 06/10/2026] Cliente: 11987654321\n"
    "[10:33, 06/10/2026] Cliente: 52998224725",
    "06/10/2026 10:32 - Bia: bia dos santos e lima\n06/10/2026 10:33 - Bia: 69000-123",
    "Lia\nLia de novo\n111.111.111-11\n123",
    "", "   \n\n", "só texto aqui", "55 21 98226 0000\n52998224725\n52998224725\n40000-000",
    "CEP: 1234567\nTelefone: 999", "Documento: 12.345.678/0001-95\nzap: 5511987654321",
    "Rua das Flores 123\nJoão\n41.000-000", "José   da   SILVA\n(41) 99876-5432", "+55 21 2222-3333",
    "[12/10, 10:26] Adriana Costa: Lidia" + chr(10) + "[12/10, 10:26] Adriana Costa: 83706-340" + chr(10)
    + "[12/10, 10:27] Adriana Costa: 41997089177" + chr(10) + "[12/10, 10:27] Adriana Costa: 52998224725",
    "nome completo: Ç é\n021 98226 0000",
    # DDD (18/10/2026): o 61 (DF e GO), os que cruzam PR e SC, um que não existe e números de vários estados
    "Ana\n61 98226-0011", "Ana\n42 98226-0011", "Ana\n47 98226-0011", "Ana\n49 98226-0011", "Ana\n20 98226-0011",
    "Ana\n92 98226-0011", "Ana\n85 98226-0011", "Ana\n51 98226-0011", "Ana\n71 3222-0011",
]
PEDACOS = ["Ana", "maria DE souza", "Zé", "João da Silva", "+55 21 98226-0000", "21 8226 0000", "(11) 3322-1100",
           "11987654321", "5511987654321", "529.982.247-25", "52998224725", "12345678900", "20000-000", "01310100",
           "69000-001", "40000000", "CPF: 11144477735", "Tel: 41 99999-8888", "CEP: 88000-000", "obs: tanto faz",
           "*Bia*", "_Lu_", "61 98226-0011", "(47) 99123-0011", "20 98226-0011", "85 3222-0011", "[12/10, 10:27] Ana Lu: 41997089177", "[3/1/2026, 09:00] Ana: Rita Lee", "123", "R. X, 10", "[09:00, 01/10/2026] Ana: 52998224725", "Nome: ", "Cliente: Rita"]


def casos():
    aleatorio = random.Random(2026)
    for texto in FIXOS:
        yield texto
    for _ in range(3000):
        yield "\n".join(aleatorio.sample(PEDACOS, aleatorio.randint(1, 6)))


def esperado(texto):
    d = agendamento.formatar(texto)
    cob = cobertura.verificar(os.path.join(CRM, "cobertura"), d["cep"])
    fmt_cpf = (lambda v: "" if not v else f"{v[:3]}.{v[3:6]}.{v[6:9]}-{v[9:]}" if len(v) == 11
               else f"{v[:2]}.{v[2:5]}.{v[5:8]}/{v[8:12]}-{v[12:]}" if len(v) == 14 else v)
    fmt_cep = (lambda v: f"{v[:5]}-{v[5:]}" if v and len(v) == 8 else (v or ""))
    ddd = regioes.ddd_na_cobertura(d["telefone"], os.path.join(CRM, "regioes"), os.path.join(CRM, "cobertura"))
    return {**d, "cobertura": cob, "cpf_tela": fmt_cpf(d["cpf"]), "cep_tela": fmt_cep(d["cep"]), "ddd": ddd}


def main():
    textos = list(casos())
    js = subprocess.run(["node", os.path.join(PASTA, "rodar_js.js")], input=json.dumps(textos), capture_output=True,
                        text=True, encoding="utf-8", check=True)
    obtidos = json.loads(js.stdout)
    erros = 0
    for texto, obtido in zip(textos, obtidos):
        certo = esperado(texto)
        if certo != obtido:
            erros += 1
            if erros <= 5:
                print("DIFERENTE:", repr(texto), "\n  CRM:", certo, "\n  app:", obtido)
    print(f"{len(textos)} textos conferidos, {erros} diferenças.")
    import testar_links  # links do Check-out no Chrome (24/10/2026)
    erros += testar_links.main()
    import testar_mensagens  # aba Mensagens (24/10/2026)
    erros += testar_mensagens.main()
    sys.exit(1 if erros else 0)


if __name__ == "__main__":
    main()
