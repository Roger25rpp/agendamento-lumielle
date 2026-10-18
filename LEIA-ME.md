# Agendamento Lumielle (aplicativo de celular)

Endereço: https://roger25rpp.github.io/agendamento-lumielle/ (abrir no Chrome do celular → "Instalar app").

O mesmo "Agendamento" do CRM (WhatsApp → Agendamento), feito para o celular. Você cola o que a cliente mandou
(nome, CPF, telefone e CEP, em qualquer ordem), e o app devolve os campos prontos para o formulário da Logzz, cada um
com o seu "Copiar". Também avisa se o CEP está na cobertura da Logzz, mostra se a Logzz atende o DDD do telefone
(aproximado) e tem um quadro de Anotações.

- **Nada sai do celular.** O app não envia nada para lugar nenhum. O texto colado e as anotações ficam guardados só no
  aparelho, até você tocar em Limpar ou em Apagar anotações.
- Depois de instalado, funciona **sem internet**.
- Não tem dado de cliente nesta pasta. A lista de CEPs da Logzz (`app/cobertura.js`) só tem faixas de CEP e cidades, e a
  tabela de DDDs (`app/ddd.js`) só tem DDD, estado, cidade de referência e contagem de municípios atendidos.

## Pastas
- `app/`: o aplicativo (é só isto que vai para a internet).
- `ferramentas/atualizar.py`: copia a lista de CEPs do CRM para o app, gera a tabela de DDDs e marca a versão nova.
- `testes/testar.py`: confere que o app dá o mesmo resultado do CRM (3.000 textos fictícios).

## Quando a lista de CEPs da Logzz mudar
1. Troque o arquivo no CRM, como já faz (`C:\CRM-Lumielle\cobertura\cobertura_logzz.xlsx`).
2. Rode: `C:\CRM-Lumielle\.venv\Scripts\python.exe ferramentas\publicar.py`. Ele atualiza a lista, confere o app
   contra o CRM e publica. O celular pega a versão nova na próxima vez que abrir o app com internet. Às vezes ele só
   pega na segunda abertura.

## Quando mudar os links de checkout ou a Galeria no CRM
No computador, na conversa com o Claude (pasta do CRM), digite sem espaço depois do `!`:

    !.venv/Scripts/python ../Agendamento-Lumielle/ferramentas/exportar_do_crm.py

Ele abre o banco do CRM só para leitura, pega só os links de checkout e as imagens da Galeria (nada de cliente), atualiza
a lista de CEPs e publica. As imagens da Galeria ficam públicas no endereço do app (decisão de 13/10/2026: só produto).

## Regra importante
A lógica fica em `app/logica.js` e é uma cópia de `crm/agendamento.py`, `crm/cobertura.py` e da função
`ddd_na_cobertura` de `crm/regioes.py`. Se o Agendamento do CRM
mudar, mude também o `logica.js` e rode `testes/testar.py`.

## Histórico
- 12/10/2026: primeira versão. Mesmas funções do Agendamento do CRM: regra do 9, " ." no nome único, CPF conferido,
  cobertura da Logzz. Tem também o botão "Colar", que pega o que está copiado no celular e já formata.
- 13/10/2026: "Colar" acrescenta numa linha nova (não apaga o que já está no quadro); entende várias mensagens
  copiadas no WhatsApp do celular ("[12/10, 10:26] Nome: texto"); tela compacta, com os dados e o resultado na mesma
  tela, sem rolar.
- 13/10/2026: abas Check-out (links da Logzz e da Braip por grupo, com Abrir e Copiar, sem imagens) e Galeria
  (Enviar pelo compartilhar do celular e Copiar), com os dados do CRM.
- 18/10/2026: ao formatar, mostra também o DDD do telefone (cidade de referência e UF) e se a Logzz atende essa
  cidade, com "N de M municípios do DDD" (aproximado), igual ao Agendamento do CRM. A tabela vem do CRM
  (`app/ddd.js`, gerada pelo `atualizar.py`); quem decide continua sendo o CEP.
