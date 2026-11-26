/* "Deu algum problema na Logzz?" no celular (26/11/2026), igual ao fim do Agendamento do CRM (§5.32): um botão por
   situação, com quando aparece, quando mandar, o que fazer, as datas e a resposta já preenchida com os dados da mensagem
   de fechamento. A lista e os textos vêm do CRM embaralhados (abrem com a senha da aba Mensagens). Aqui nada é gravado:
   o que precisa ficar registrado vai pelo "Copiar para o CRM". Nada sai do celular. */
(function () {
  "use strict";
  var S = window.Situacoes, DADOS = window.DADOS;
  var LINKS = (DADOS && DADOS.checkout) || [];
  var GUARDA = "agendamento-problemas";
  var quadro = document.getElementById("problemas");
  var textos = null, fechamento = { estado: {}, r: null };
  var guardado = ler();  // {situacao, codigos: {id: codigo}, datas: {id: {chave: data}}, avisos: {id: "bairro"}}
  var el = {};

  function ler() { try { return JSON.parse(localStorage.getItem(GUARDA) || "{}") || {}; } catch (e) { return {}; } }
  function guardar() { try { localStorage.setItem(GUARDA, JSON.stringify(guardado)); } catch (e) { /* sem espaço */ } }
  guardado.codigos = guardado.codigos || {}; guardado.datas = guardado.datas || {}; guardado.avisos = guardado.avisos || {};
  function hoje() {
    var d = new Date();
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  }
  function elemento(tag, classe, conteudo) {
    var e = document.createElement(tag);
    if (classe) e.className = classe;
    if (conteudo != null) e.textContent = conteudo;
    return e;
  }
  function botao(texto, classe) { var b = elemento("button", "botao " + classe, texto); b.type = "button"; return b; }
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
  function lista() { return (textos && textos.situacoes) || []; }
  function atual() {
    var id = guardado.situacao;
    return lista().filter(function (s) { return s.id === id; })[0] || null;
  }
  function titulo(codigo) {
    var r = S.resposta(textos && textos.respostas, codigo);
    return r ? { rotulo: r.codigo || codigo, titulo: r.titulo } : null;
  }

  function linhaCliente() {
    var e = fechamento.estado || {}, r = fechamento.r, partes = [];
    var nome = S.primeiroNome(e.nome);
    if (nome) partes.push(nome);
    if ((e.cidade || "").trim()) partes.push(e.cidade.trim() + ((e.uf || "").trim() ? "/" + e.uf.trim() : ""));
    if (r && r.kit) partes.push(r.kit.nome + ", " + r.kit.preco_texto);
    if (r && r.plataforma) partes.push(r.plataforma);
    return partes.length ? "Cliente: " + partes.join(" · ") : "Preencha a mensagem de fechamento acima: nome, cidade e kit entram na resposta.";
  }

  function campos(s) {
    var e = fechamento.estado || {};
    var link = LINKS.filter(function (l) { return String(l.id) === String(e.kit || ""); })[0];
    var k = S.kitDoLink(link);
    var c = { nome: e.nome || "", cidade: e.cidade || "", kit: k.kit, qtde: k.qtde, aviso: guardado.avisos[s.id] || "" };
    var datas = guardado.datas[s.id] || {};
    s.datas.forEach(function (chave) { c[chave] = datas[chave] || ""; });
    return c;
  }

  function desenhar() {
    quadro.textContent = "";
    quadro.appendChild(elemento("h2", null, "Deu algum problema na Logzz?"));
    if (!textos) {
      quadro.appendChild(elemento("p", "pequeno texto-alerta", "Para ver os casos, abra a aba Mensagens e digite a senha (só uma vez neste celular)."));
      return;
    }
    if (!lista().length) {
      quadro.appendChild(elemento("p", "pequeno texto-alerta", "Os casos ainda não vieram do CRM: publique o app de novo."));
      return;
    }
    quadro.appendChild(elemento("p", "pequeno nota", "Escolha o caso: aparece o que fazer, quando mandar e a resposta já preenchida."));
    el.cliente = elemento("p", "cobertura", linhaCliente());
    quadro.appendChild(el.cliente);
    var grade = elemento("div", "situacoes-botoes");
    lista().forEach(function (s) {
      var b = botao("", s.id === guardado.situacao ? "cobre" : "claro");
      b.appendChild(elemento("strong", null, s.titulo));
      b.appendChild(elemento("span", "pequeno", s.sub));
      b.setAttribute("aria-pressed", s.id === guardado.situacao ? "true" : "false");
      b.addEventListener("click", function () {
        guardado.situacao = guardado.situacao === s.id ? "" : s.id;  // tocar de novo fecha
        guardar(); desenhar();
        if (guardado.situacao) el.painel.scrollIntoView({ behavior: "smooth", block: "start" });
      });
      grade.appendChild(b);
    });
    quadro.appendChild(grade);
    el.painel = elemento("div", "situacao-painel");
    quadro.appendChild(el.painel);
    var s = atual();
    el.painel.hidden = !s;
    if (s) painel(s);
  }

  function painel(s) {
    var p = el.painel;
    p.appendChild(elemento("h3", "grupo", s.titulo));
    var aparece = elemento("p", "pequeno");
    aparece.appendChild(elemento("strong", null, "Quando aparece: ")); aparece.appendChild(document.createTextNode(s.aparece));
    p.appendChild(aparece);
    var mandar = elemento("p", "cobertura quando-mandar");
    mandar.appendChild(elemento("strong", null, "Quando mandar: ")); mandar.appendChild(document.createTextNode(s.mandar));
    p.appendChild(mandar);
    var passos = elemento("ol", "pequeno");
    s.passos.forEach(function (t) { passos.appendChild(elemento("li", null, t)); });
    p.appendChild(passos);

    if (s.id === "estoque-indisponivel") {
      var abrir = botao("Abrir Estoque indisponível (mensagens e imagens)", "claro botao-largo");
      abrir.addEventListener("click", function () {
        var estoque = document.getElementById("estoque-app");
        estoque.open = true; estoque.scrollIntoView({ behavior: "smooth", block: "start" });
      });
      p.appendChild(abrir);
    }
    if (s.gravar === "aberto")
      p.appendChild(elemento("p", "pequeno nota", "Gravar parado: no CRM (Agendamento → Já existe uma entrega), com o bloco do \"Copiar para o CRM\"."));
    if (!s.codigos.length) return;

    if (s.aviso_bairro) {
      p.appendChild(elemento("p", "pequeno", "O que a Logzz disse:"));
      var opcoes = elemento("div", "acoes");
      [["endereco", "Endereço bloqueado"], ["bairro", "Bairro não atendido"]].forEach(function (o) {
        var ativo = (guardado.avisos[s.id] || "endereco") === o[0];
        var b = botao(o[1], ativo ? "cobre" : "claro");
        b.addEventListener("click", function () { guardado.avisos[s.id] = o[0]; guardar(); desenhar(); });
        opcoes.appendChild(b);
      });
      p.appendChild(opcoes);
    }
    if (s.datas.length) {
      guardado.datas[s.id] = guardado.datas[s.id] || {};
      var datas = guardado.datas[s.id];
      var e = fechamento.estado || {};
      if (datas.pedido === undefined && s.datas.indexOf("pedido") >= 0 && e.dia_tipo === "data" && e.dia_data) datas.pedido = e.dia_data;
      s.datas.forEach(function (chave) {
        var rotulo = elemento("label", null, S.DATAS[chave]);
        rotulo.htmlFor = "p-" + s.id + "-" + chave;
        var entrada = elemento("input", "campo");
        entrada.type = "date"; entrada.id = rotulo.htmlFor; entrada.value = datas[chave] || "";
        if (chave !== "pedido") entrada.min = hoje();
        entrada.addEventListener("change", function () { datas[chave] = entrada.value; guardar(); mensagem(s); });
        p.appendChild(rotulo); p.appendChild(entrada);
      });
      p.appendChild(elemento("p", "pequeno nota", "Sem domingo nem dia que já passou. O dia pedido vem do Dia da entrega, se estiver escolhido."));
    }
    if (!guardado.codigos[s.id] || !titulo(guardado.codigos[s.id])) {
      guardado.codigos[s.id] = s.codigos.filter(function (c) { return titulo(c); })[0] || "";
    }
    var escolhas = elemento("div", "acoes respostas-caso");
    s.codigos.forEach(function (c) {
      var t = titulo(c);
      var b = botao((t ? t.rotulo : c) + " · " + (t ? t.titulo : "não está em Respostas"), c === guardado.codigos[s.id] ? "cobre" : "claro");
      b.disabled = !t;
      b.addEventListener("click", function () { guardado.codigos[s.id] = c; guardar(); desenhar(); });
      escolhas.appendChild(b);
    });
    p.appendChild(escolhas);
    el.erro = elemento("p", "pequeno texto-alerta");
    el.avisos = elemento("ul", "pequeno");
    el.texto = elemento("textarea", "campo texto-editavel");
    el.texto.rows = 10;
    el.texto.setAttribute("aria-label", "Mensagem para a cliente (pode editar)");
    p.appendChild(el.erro); p.appendChild(el.avisos); p.appendChild(el.texto);
    var acoes = elemento("div", "acoes");
    var enviar = botao("Enviar", "cobre"), copiar = botao("Copiar", "claro");
    enviar.addEventListener("click", function () {
      var v = el.texto.value.trim();
      if (!v) return;
      if (!navigator.share) { avisar(enviar, "Use Copiar", "Enviar"); return; }
      navigator.share({ text: v }).catch(function (e) { if (!e || e.name !== "AbortError") avisar(enviar, "Não enviou", "Enviar"); });
    });
    copiar.addEventListener("click", function () {
      var v = el.texto.value.trim();
      if (!v) return;
      copiarTexto(v).then(function () { avisar(copiar, "Copiado!", "Copiar", true); }, function () { avisar(copiar, "Não copiou", "Copiar"); });
    });
    acoes.appendChild(enviar); acoes.appendChild(copiar);
    p.appendChild(acoes);
    p.appendChild(elemento("p", "pequeno nota", "Pode mexer na mensagem antes de enviar; o que estiver em [colchetes] ainda falta trocar."));
    mensagem(s);
  }

  function mensagem(s) {
    if (!el.texto || !s.codigos.length) return;
    var r = S.montar(textos.respostas, s, guardado.codigos[s.id], campos(s), hoje());
    el.erro.textContent = r.erro || "";
    el.avisos.textContent = "";
    r.avisos.forEach(function (a) { el.avisos.appendChild(elemento("li", null, a)); });
    el.texto.value = r.mensagem || "";
    el.texto.hidden = !r.mensagem;
  }

  window.addEventListener("fechamento-mudou", function (e) {
    fechamento = e.detail;
    if (el.cliente) el.cliente.textContent = linhaCliente();
    var s = atual();
    if (s && textos) mensagem(s);
  });
  window.addEventListener("mensagens-abertas", function (e) { textos = e.detail; desenhar(); });
  window.addEventListener("dados-limpos", function () {  // Limpar: começa outra cliente (datas e escolhas somem)
    guardado = { situacao: "", codigos: {}, datas: {}, avisos: {} };
    guardar(); desenhar();
  });

  desenhar();
})();
