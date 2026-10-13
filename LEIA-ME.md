# Agendamento Lumielle (aplicativo de celular)

Endereço: https://roger25rpp.github.io/agendamento-lumielle/ (abrir no Chrome do celular → "Instalar app").

O mesmo "Agendamento" do CRM (WhatsApp → Agendamento), feito para o celular. Você cola o que a cliente mandou
(nome, CPF, telefone e CEP, em qualquer ordem), e o app devolve os campos prontos para o formulário da Logzz, cada um
com o seu "Copiar". Também avisa se o CEP está na cobertura da Logzz e tem um quadro de Anotações.

- **Nada sai do celular.** O app não envia nada para lugar nenhum. O texto colado e as anotações ficam guardados só no
  aparelho, até você tocar em Limpar ou em Apagar anotações.
- Depois de instalado, funciona **sem internet**.
- Não tem dado de cliente nesta pasta. A lista de CEPs da Logzz (`app/cobertura.js`) só tem faixas de CEP e cidades.

## Pastas
- `app/`: o aplicativo (é só isto que vai para a internet).
- `ferramentas/atualizar.py`: copia a lista de CEPs do CRM para o app e marca a versão nova.
- `testes/testar.py`: confere que o app dá o mesmo resultado do CRM (3.000 textos fictícios).

## Quando a lista de CEPs da Logzz mudar
1. Troque o arquivo no CRM, como já faz (`C:\CRM-Lumielle\cobertura\cobertura_logzz.xlsx`).
2. Rode: `C:\CRM-Lumielle\.venv\Scripts\python.exe ferramentas\publicar.py`. Ele atualiza a lista, confere o app
   contra o CRM e publica. O celular pega a versão nova na próxima vez que abrir o app com internet. Às vezes ele só
   pega na segunda abertura.

## Regra importante
A lógica fica em `app/logica.js` e é uma cópia de `crm/agendamento.py` e `crm/cobertura.py`. Se o Agendamento do CRM
mudar, mude também o `logica.js` e rode `testes/testar.py`.

## Histórico
- 12/10/2026: primeira versão. Mesmas funções do Agendamento do CRM: regra do 9, " ." no nome único, CPF conferido,
  cobertura da Logzz. Tem também o botão "Colar", que pega o que está copiado no celular e já formata.
