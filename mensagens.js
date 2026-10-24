/* Aba Mensagens (24/10/2026): Respostas e Objeções do CRM, protegidas por senha (veja cifra.js).
   A senha é pedida uma vez: o celular guarda a chave (não a senha) e abre sozinho nas próximas vezes.
   O nome da cliente digitado aqui troca o {nome} dos textos e não sai do celular (nem fica guardado). */
(function () {
  "use strict";
  var DADOS = window.DADOS, PACOTE = DADOS && DADOS.mensagens;
  var GUARDA = "lumielle-mensagens-chave";
  var raiz = document.getElementById("conteudo-mensagens");
  var textos = null, parte = "respostas", abertos = {}, busca = "", nome = "";

  function elemento(tag, classe, conteudo) {
    var el = document.createElement(tag);
    if (classe) el.className = classe;
    if (conteudo != null) el.textContent = conteudo;
    return el;
  }
  function botao(texto, classe) {
    var b = elemento("button", "botao " + classe, texto);
    b.type = "button";
    return b;
  }
  function avisar(b, texto, original, ok) {
    b.textContent = texto;
    b.classList.toggle("copiado", !!ok);
    if (ok && navigator.vibrate) navigator.vibrate(30);
    setTimeout(function () { b.textContent = original; b.classList.remove("copiado"); }, 2000);
  }
  function copiarTexto(valor) {
    if (navigator.clipboard && window.isSecureContext) return navigator.clipboard.writeText(valor);
    return new Promise(function (ok, falha) {
      var campo = document.createElement("textarea");
      campo.value = valor; campo.style.position = "fixed"; campo.style.opacity = "0";
      document.body.appendChild(campo); campo.select();
      try { document.execCommand("copy") ? ok() : falha(); } catch (e) { falha(e); }
      document.body.removeChild(campo);
    });
  }
  function guardada() { try { return localStorage.getItem(GUARDA); } catch (e) { return null; } }
  function guardar(valor) {
    try { if (valor) localStorage.setItem(GUARDA, valor); else localStorage.removeItem(GUARDA); } catch (e) { /* sem espaço */ }
  }
  function simples(texto) {  // para a busca: sem acento e minúsculo
    return String(texto || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  }
  function primeiroNome(n) {  // igual ao CRM: a primeira palavra, com maiúscula
    var p = String(n || "").trim().split(/\s+/)[0] || "";
    return p ? p.charAt(0).toUpperCase() + p.slice(1).toLowerCase() : "";
  }
  function comNome(texto) {
    var p = primeiroNome(nome);
    return p ? texto.replace(/\{nome\}/g, p) : texto;
  }
  function limpar() { while (raiz.firstChild) raiz.removeChild(raiz.firstChild); }

  // ---------- senha ----------
  function aviso(texto) {
    limpar();
    raiz.appendChild(elemento("p", "cartao vazio", texto));
  }
  function pedirSenha(erro) {
    limpar();
    var cartao = elemento("section", "cartao");
    cartao.appendChild(elemento("h2", null, "Mensagens protegidas"));
    var rotulo = elemento("label", null, "Senha das mensagens (a frase que está no computador)");
    rotulo.htmlFor = "senha-mensagens";
    var campo = elemento("input", "campo");
    campo.id = "senha-mensagens"; campo.type = "password"; campo.autocomplete = "current-password";
    campo.setAttribute("autocapitalize", "none"); campo.spellcheck = false;
    var liberar = botao("Liberar", "cobre");
    var msg = elemento("p", "pequeno texto-alerta", erro || "");
    var acoes = elemento("div", "acoes");
    acoes.appendChild(liberar);
    cartao.appendChild(rotulo); cartao.appendChild(campo); cartao.appendChild(acoes); cartao.appendChild(msg);
    cartao.appendChild(elemento("p", "pequeno nota", "Pede só uma vez neste celular. Maiúsculas não fazem diferença."));
    raiz.appendChild(cartao);
    function tentar() {
      if (!campo.value.trim()) return;
      liberar.disabled = true; liberar.textContent = "Abrindo...";
      Cifra.derivar(campo.value, PACOTE.iteracoes).then(function (chave) {
        return Cifra.abrir(PACOTE, chave).then(function (t) {
          guardar(Cifra.paraBase64(chave));
          mostrar(t);
        });
      }).catch(function (e) {
        pedirSenha(e && e.message === "senha" ? "Senha errada. Confira e tente de novo." : "Não consegui abrir as mensagens.");
      });
    }
    liberar.addEventListener("click", tentar);
    campo.addEventListener("keydown", function (e) { if (e.key === "Enter") tentar(); });
  }

  // ---------- lista ----------
  function cartaoMensagem(titulo, codigo, texto, detalhes) {
    var cartao = elemento("div", "mensagem");
    var topo = elemento("div", "mensagem-titulo");
    if (codigo) topo.appendChild(elemento("span", "codigo", codigo));
    topo.appendChild(elemento("strong", null, titulo));
    cartao.appendChild(topo);
    (detalhes || []).forEach(function (d) { if (d) cartao.appendChild(elemento("p", "pequeno detalhe", d)); });
    var final = comNome(texto);
    cartao.appendChild(elemento("p", "texto-mensagem", final));
    var acoes = elemento("div", "acoes");
    var enviar = botao("Enviar", "cobre"), copiar = botao("Copiar", "claro");
    enviar.addEventListener("click", function () {
      if (!navigator.share) { avisar(enviar, "Use Copiar", "Enviar"); return; }
      navigator.share({ text: final }).catch(function (e) {
        if (!e || e.name !== "AbortError") avisar(enviar, "Não enviou", "Enviar");
      });
    });
    copiar.addEventListener("click", function () {
      copiarTexto(final).then(function () { avisar(copiar, "Copiado!", "Copiar", true); },
                              function () { avisar(copiar, "Não copiou", "Copiar"); });
    });
    acoes.appendChild(enviar); acoes.appendChild(copiar);
    cartao.appendChild(acoes);
    return cartao;
  }

  function grupo(chave, titulo, quantos, nota, montar) {
    var sanfona = elemento("details", "cartao grupo-mensagens");
    sanfona.open = !!busca || !!abertos[chave];
    sanfona.addEventListener("toggle", function () { if (!busca) abertos[chave] = sanfona.open; });
    var resumo = elemento("summary", null, titulo + " ");
    resumo.appendChild(elemento("span", "pequeno", "(" + quantos + ")"));
    sanfona.appendChild(resumo);
    if (nota) sanfona.appendChild(elemento("p", "pequeno detalhe", nota));
    montar(sanfona);
    return sanfona;
  }

  function acha() {
    var termo = simples(busca).trim();
    return function () {
      if (!termo) return true;
      return simples(Array.prototype.join.call(arguments, " ")).indexOf(termo) >= 0;
    };
  }

  function montarLista(lista) {
    while (lista.firstChild) lista.removeChild(lista.firstChild);
    var bate = acha(), total = 0;
    if (parte === "respostas") {
      textos.respostas.forEach(function (g, n) {
        var itens = g.itens.filter(function (r) { return bate(r.codigo, r.titulo, r.texto, g.grupo); });
        if (!itens.length) return;
        total += itens.length;
        lista.appendChild(grupo("r" + n, g.grupo, itens.length, "", function (caixa) {
          itens.forEach(function (r) { caixa.appendChild(cartaoMensagem(r.titulo, r.codigo, r.texto)); });
        }));
      });
    } else {
      textos.objecoes.forEach(function (s, n) {
        var itens = s.itens.filter(function (o) {
          return bate(o.codigo, o.titulo, o.dor, o.resultado, o.nota, s.secao,
                      o.mensagens.map(function (m) { return m.rotulo + " " + m.texto; }).join(" "));
        });
        if (!itens.length) return;
        total += itens.length;
        lista.appendChild(grupo("o" + n, s.secao, itens.length, s.nota, function (caixa) {
          itens.forEach(function (o) {
            var bloco = elemento("div", "objecao");
            bloco.appendChild(elemento("h3", "titulo-objecao", o.codigo + " · " + o.titulo));
            if (o.dor) bloco.appendChild(elemento("p", "pequeno detalhe", "Dor: " + o.dor));
            if (o.resultado) bloco.appendChild(elemento("p", "pequeno detalhe", "Objetivo: " + o.resultado));
            if (o.nota) bloco.appendChild(elemento("p", "pequeno detalhe", o.nota));
            o.mensagens.forEach(function (m, i) {
              var rotulo = m.rotulo || (o.mensagens.length > 1 ? "Mensagem " + (i + 1) : "Mensagem");
              bloco.appendChild(cartaoMensagem(rotulo, "", m.texto));
            });
            caixa.appendChild(bloco);
          });
        }));
      });
    }
    if (!total) lista.appendChild(elemento("p", "cartao vazio", busca ? "Nada encontrado." : "Nenhuma mensagem."));
  }

  function mostrar(t) {
    textos = t;
    limpar();
    var topo = elemento("section", "cartao filtros-mensagens");
    var segmento = elemento("div", "segmento");
    [["respostas", "Respostas"], ["objecoes", "Objeções"]].forEach(function (p) {
      var b = botao(p[1], parte === p[0] ? "cobre" : "claro");
      b.setAttribute("aria-pressed", parte === p[0] ? "true" : "false");
      b.addEventListener("click", function () { parte = p[0]; mostrar(textos); });
      segmento.appendChild(b);
    });
    topo.appendChild(segmento);
    var campoBusca = elemento("input", "campo");
    campoBusca.type = "search"; campoBusca.placeholder = "Buscar (texto ou código)"; campoBusca.value = busca;
    campoBusca.setAttribute("aria-label", "Buscar mensagem");
    var rotuloNome = elemento("label", null, "Nome da cliente (troca o {nome}; fica só nesta tela)");
    rotuloNome.htmlFor = "nome-cliente";
    var campoNome = elemento("input", "campo");
    campoNome.id = "nome-cliente"; campoNome.placeholder = "ex.: Maria"; campoNome.value = nome;
    campoNome.autocomplete = "off";
    topo.appendChild(campoBusca); topo.appendChild(rotuloNome); topo.appendChild(campoNome);
    raiz.appendChild(topo);
    var lista = elemento("div", "lista-mensagens");
    raiz.appendChild(lista);
    campoBusca.addEventListener("input", function () { busca = campoBusca.value; montarLista(lista); });
    campoNome.addEventListener("input", function () { nome = campoNome.value; montarLista(lista); });
    montarLista(lista);
    var bloquear = botao("Bloquear as mensagens neste celular", "claro pequeno-botao");
    bloquear.addEventListener("click", function () {
      if (!confirm("Bloquear? Para abrir de novo, digite a senha.")) return;
      guardar(null); textos = null; nome = ""; busca = ""; pedirSenha();
    });
    var rodape = elemento("p", "rodape");
    rodape.appendChild(bloquear);
    raiz.appendChild(rodape);
  }

  // ---------- início ----------
  if (!PACOTE) { aviso("As mensagens ainda não estão no app. No computador, crie a senha e rode o comando de atualizar o app (item 2 do COMANDOS.txt)."); return; }
  if (!window.Cifra || !Cifra.disponivel()) { aviso("Este navegador não consegue abrir as mensagens protegidas. Abra o app pelo ícone instalado (ou pelo Chrome)."); return; }
  var chave = guardada();
  if (!chave) { pedirSenha(); return; }
  Cifra.abrir(PACOTE, Cifra.deBase64(chave)).then(mostrar).catch(function () {
    guardar(null);  // a senha mudou no computador
    pedirSenha("A senha das mensagens mudou. Digite a nova.");
  });
})();
