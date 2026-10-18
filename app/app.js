/* Tela do Agendamento: liga os botões à lógica (logica.js) e guarda o texto e as anotações neste aparelho
   (localStorage) até tocar em Limpar / Apagar anotações. Nada é enviado para lugar nenhum. */
(function () {
  "use strict";
  var A = window.Agendamento;
  var texto = document.getElementById("texto"), notas = document.getElementById("anotacoes");
  var resultado = document.getElementById("resultado");

  function ler(chave) { try { return localStorage.getItem(chave) || ""; } catch (e) { return ""; } }
  function gravar(chave, valor) {
    try { valor ? localStorage.setItem(chave, valor) : localStorage.removeItem(chave); } catch (e) {}
  }
  function elemento(tag, classe, conteudo) {
    var el = document.createElement(tag);
    if (classe) el.className = classe;
    if (conteudo != null) el.textContent = conteudo;
    return el;
  }

  function copiarTexto(valor) {
    if (navigator.clipboard && window.isSecureContext) return navigator.clipboard.writeText(valor);
    return new Promise(function (ok, falha) {  // navegador antigo: copia por um campo escondido
      var campo = document.createElement("textarea");
      campo.value = valor; campo.setAttribute("readonly", ""); campo.style.position = "fixed"; campo.style.opacity = "0";
      document.body.appendChild(campo); campo.select();
      try { document.execCommand("copy") ? ok() : falha(); } catch (e) { falha(e); }
      document.body.removeChild(campo);
    });
  }

  function linha(lista, rotulo, valor) {
    lista.appendChild(elemento("dt", null, rotulo));
    var dd = elemento("dd");
    if (!valor) {
      dd.appendChild(elemento("span", "texto-alerta", "não encontrado"));
    } else {
      dd.appendChild(elemento("span", "copiavel", valor));
      var botao = elemento("button", "botao claro botao-copiar", "Copiar");
      botao.type = "button";
      botao.addEventListener("click", function () {
        copiarTexto(valor).then(function () {
          botao.textContent = "Copiado!"; botao.classList.add("copiado");
          if (navigator.vibrate) navigator.vibrate(30);
        }, function () { botao.textContent = "Não copiou"; });
        setTimeout(function () { botao.textContent = "Copiar"; botao.classList.remove("copiado"); }, 2000);
      });
      dd.appendChild(botao);
    }
    lista.appendChild(dd);
  }

  // Pelo DDD do telefone (18/10/2026), igual ao Agendamento do CRM: é só uma pista; quem decide é o CEP
  function mostrarDdd(r, temCep) {
    var caixa = document.getElementById("ddd");
    caixa.textContent = "";
    if (!r) return;
    var onde = "DDD " + r.ddd + (r.cidade ? " · " + r.cidade + "/" + r.uf : "");
    var p = elemento("p", "cobertura");
    if (r.situacao === "atende") {
      p.classList.add("atende");
      p.appendChild(elemento("strong", null, "✅ " + onde + ": a Logzz atende " + r.cidade));
      p.appendChild(elemento("span", "pequeno", " · " + r.atendidos + " de " + r.municipios + " municípios do DDD (aproximado)"));
    } else if (r.situacao === "nao_atende") {
      if (!r.atendidos) p.classList.add("fora");
      p.appendChild(elemento("strong", null, (r.atendidos ? "ℹ️ " : "⚠️ ") + onde + ": a Logzz não atende " + r.cidade));
      p.appendChild(elemento("span", "pequeno", " · " + r.atendidos + " de " + r.municipios +
                                                " municípios do DDD atendidos (aproximado)"));
    } else if (r.situacao === "desconhecido") {
      p.textContent = "DDD " + r.ddd + " não existe na tabela de DDDs: confira o telefone com a cliente.";
    } else {
      p.textContent = onde + ". Sem a lista de cobertura da Logzz, não dá para conferir o DDD.";
    }
    caixa.appendChild(p);
    if (r.observacao) {
      caixa.appendChild(elemento("p", "pequeno", "O DDD " + r.ddd + " " + r.observacao.charAt(0).toLowerCase() +
                                                 r.observacao.slice(1) + "."));
    }
    caixa.appendChild(elemento("p", "pequeno", "Pelo DDD: é onde o número foi registrado, não onde a cliente mora. " +
                                               "Quem decide é o CEP" + (temCep ? " (acima)." : ".")));
  }

  function formatar() {
    if (!texto.value.trim()) { resultado.hidden = true; return; }
    var d = A.formatar(texto.value);
    var cobertura = A.verificar(window.COBERTURA && window.COBERTURA.faixas, d.cep);
    var campos = document.getElementById("campos");
    campos.textContent = "";
    linha(campos, "Nome", d.nome);
    linha(campos, "CPF", A.mostrarCpf(d.cpf));
    linha(campos, "Telefone", d.telefone);
    linha(campos, "CEP", A.mostrarCep(d.cep));

    var aviso = document.getElementById("cobertura");
    aviso.className = "cobertura";
    aviso.textContent = "";
    if (cobertura.situacao === "atende") {
      aviso.classList.add("atende");
      aviso.appendChild(elemento("strong", null, "✅ Logzz atende: " + cobertura.cidades.join(", ")));
    } else if (cobertura.situacao === "fora") {
      aviso.classList.add("fora");
      aviso.appendChild(elemento("strong", null, "⚠️ Fora da cobertura da Logzz: direcionar para a Braip"));
    } else if (cobertura.situacao === "sem_cep") {
      aviso.textContent = "Sem CEP: não dá para conferir a cobertura da Logzz.";
    } else {
      aviso.textContent = "Lista de CEPs da Logzz não encontrada no aplicativo.";
    }
    var obs = document.getElementById("obs");
    obs.textContent = "";
    cobertura.obs.forEach(function (o) { obs.appendChild(elemento("p", "pequeno", o)); });
    mostrarDdd(A.dddNaCobertura(window.DDDS, d.telefone), !!d.cep);

    var avisos = document.getElementById("avisos");
    avisos.textContent = "";
    d.avisos.forEach(function (a) { avisos.appendChild(elemento("li", null, a)); });
    document.getElementById("sobras").textContent = d.sobras.length ? "Linhas que não entendi: " + d.sobras.join(" · ") : "";
    resultado.classList.toggle("alerta", d.avisos.length > 0);
    resultado.hidden = false;
  }

  document.getElementById("formatar").addEventListener("click", function () {
    gravar("agendamento-texto", texto.value);
    formatar();
  });
  document.getElementById("limpar").addEventListener("click", function () {
    texto.value = ""; gravar("agendamento-texto", ""); resultado.hidden = true; texto.focus();
  });
  document.getElementById("colar").addEventListener("click", function () {
    if (!navigator.clipboard || !navigator.clipboard.readText) { texto.focus(); return; }
    navigator.clipboard.readText().then(function (colado) {
      colado = (colado || "").trim();
      if (!colado) return;
      // acrescenta embaixo do que já está no quadro, numa linha nova (pedido de 13/10/2026)
      var antes = texto.value.replace(/\s+$/, "");
      texto.value = (antes ? antes + "\n" : "") + colado + "\n";
      texto.scrollTop = texto.scrollHeight;
      gravar("agendamento-texto", texto.value); formatar();
    }, function () { texto.focus(); });  // sem permissão: deixa colar à mão (toque longo no quadro → Colar)
  });
  texto.addEventListener("input", function () { gravar("agendamento-texto", texto.value); });

  notas.value = ler("agendamento-notas");
  notas.addEventListener("input", function () { gravar("agendamento-notas", notas.value); });
  document.getElementById("apagar-anotacoes").addEventListener("click", function () {
    notas.value = ""; gravar("agendamento-notas", "");
  });

  // voltou para o aplicativo: mostra de novo o que estava formatado
  texto.value = ler("agendamento-texto");
  formatar();

  var C = window.COBERTURA;
  document.getElementById("rodape").textContent = C
    ? "Lista de CEPs da Logzz: " + C.faixas.length + " faixas, atualizada em " + C.atualizada_em + "."
    : "";

  if ("serviceWorker" in navigator && location.protocol !== "file:") {
    var tinhaVersao = !!navigator.serviceWorker.controller;  // primeira abertura: não precisa recarregar
    navigator.serviceWorker.register("sw.js").catch(function () {});
    var recarregou = false;  // versão nova instalada: recarrega uma vez para usá-la
    navigator.serviceWorker.addEventListener("controllerchange", function () {
      if (tinhaVersao && !recarregou) { recarregou = true; location.reload(); }
    });
  }
})();
