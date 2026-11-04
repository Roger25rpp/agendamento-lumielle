/* Mensagem de fechamento e Estoque indisponível no celular (03/11/2026): os mesmos campos do Agendamento do CRM.
   Quem calcula é o logica.js. Nada sai do celular: "Enviar" abre o compartilhar e "Copiar para o CRM" só copia o bloco.
   O que está nos campos fica neste aparelho até Limpar. Os textos vêm do CRM embaralhados: abrem com a senha da aba Mensagens. */
(function () {
  "use strict";
  var A = window.Agendamento, DADOS = window.DADOS;
  var LINKS = (DADOS && DADOS.checkout) || [];
  var GUARDA = "agendamento-fechamento";
  var CAMPOS = [["nome", "Nome"], ["telefone", "Telefone"], ["cep", "CEP"], ["cpf", "CPF (não vai na mensagem)"]];
  var ENDERECO = [["rua", "Rua"], ["numero", "Número"], ["complemento", "Complemento"], ["bairro", "Bairro"], ["cidade", "Cidade"], ["uf", "UF"]];
  var quadro = document.getElementById("fechamento"), estoque = document.getElementById("estoque-app");
  var textos = null, ultimo = null;
  var estado = ler();
  var entradas = {}, el = {};

  function ler() { try { return JSON.parse(localStorage.getItem(GUARDA) || "{}") || {}; } catch (e) { return {}; } }
  function guardar() { try { localStorage.setItem(GUARDA, JSON.stringify(estado)); } catch (e) { /* sem espaço */ } }
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
  function ligarCopiar(b, rotulo, valor) {
    b.addEventListener("click", function () {
      var v = valor();
      if (!v) return;
      copiarTexto(v).then(function () { avisar(b, "Copiado!", rotulo, true); }, function () { avisar(b, "Não copiou", rotulo); });
    });
  }
  function ligarEnviar(b, rotulo, valor) {
    b.addEventListener("click", function () {
      var v = valor();
      if (!v) return;
      if (!navigator.share) { avisar(b, "Use Copiar", rotulo); return; }
      navigator.share({ text: v }).catch(function (e) { if (!e || e.name !== "AbortError") avisar(b, "Não enviou", rotulo); });
    });
  }

  function campoComCopiar(pai, chave, rotulo) {
    var caixa = elemento("div", "campo-copiar");
    var nome = elemento("label", null, rotulo);
    nome.htmlFor = "f-" + chave;
    var linha = elemento("div", "linha-copiar");
    var entrada = elemento("input", "campo");
    entrada.id = "f-" + chave; entrada.autocomplete = "off"; entrada.value = estado[chave] || "";
    var copiar = botao("Copiar", "claro botao-copiar");
    ligarCopiar(copiar, "Copiar", function () { return entrada.value.trim(); });
    entrada.addEventListener("input", function () { estado[chave] = entrada.value; atualizar(); });
    linha.appendChild(entrada); linha.appendChild(copiar);
    caixa.appendChild(nome); caixa.appendChild(linha);
    pai.appendChild(caixa);
    entradas[chave] = entrada;
  }

  function campos() {
    return Object.assign({}, estado, { link_id: estado.kit || "" });
  }

  function montar() {
    quadro.appendChild(elemento("h2", null, "Mensagem de fechamento"));
    CAMPOS.forEach(function (c) { campoComCopiar(quadro, c[0], c[1]); });
    el.plataforma = elemento("p", "cobertura");
    quadro.appendChild(el.plataforma);

    quadro.appendChild(elemento("h3", "grupo", "Endereço"));
    var rotulo = elemento("label", null, "Endereço completo (cole como a cliente mandou)");
    rotulo.htmlFor = "f-endereco";
    var endereco = elemento("textarea");
    endereco.id = "f-endereco"; endereco.rows = 2; endereco.value = estado.endereco || "";
    endereco.addEventListener("input", function () {
      estado.endereco = endereco.value;
      var e = A.separarEndereco(endereco.value);
      ENDERECO.forEach(function (c) { estado[c[0]] = e[c[0]]; entradas[c[0]].value = e[c[0]]; });
      if (e.cep && !(estado.cep || "").trim()) {
        estado.cep = A.mostrarCep(e.cep);
        entradas.cep.value = estado.cep;
      }
      el.sobras.textContent = e.sobras.length ? "Não coube em nenhum campo: " + e.sobras.join(" · ") : "";
      atualizar();
    });
    quadro.appendChild(rotulo); quadro.appendChild(endereco);
    el.enderecoTexto = endereco;
    ENDERECO.forEach(function (c) { campoComCopiar(quadro, c[0], c[1]); });
    el.sobras = elemento("p", "pequeno");
    quadro.appendChild(el.sobras);
    quadro.appendChild(elemento("p", "pequeno nota", "A separação pode errar: confira. O que vale é o que está nos campos."));

    quadro.appendChild(elemento("h3", "grupo", "Kit"));
    el.kit = elemento("select", "campo");
    el.kit.setAttribute("aria-label", "Kit");
    el.kit.addEventListener("change", function () { estado.kit = el.kit.value; atualizar(); });
    quadro.appendChild(el.kit);
    el.kitDetalhe = elemento("div", "linha-copiar kit-detalhe");
    el.preco = elemento("strong", "kit-preco");
    var copiarLink = botao("Copiar link", "claro botao-copiar");
    ligarCopiar(copiarLink, "Copiar link", function () { return ultimo && ultimo.kit && ultimo.kit.link; });
    el.kitDetalhe.appendChild(el.preco); el.kitDetalhe.appendChild(copiarLink);
    quadro.appendChild(el.kitDetalhe);

    el.blocoDia = elemento("div");
    el.blocoDia.appendChild(elemento("h3", "grupo", "Dia da entrega"));
    var acoesDia = elemento("div", "acoes");
    el.amanha = botao("Amanhã", "claro"); el.antes = botao("O quanto antes", "claro");
    el.amanha.addEventListener("click", function () { escolherDia("amanha", ""); });
    el.antes.addEventListener("click", function () { escolherDia("quanto_antes", ""); });
    acoesDia.appendChild(el.amanha); acoesDia.appendChild(el.antes);
    el.blocoDia.appendChild(acoesDia);
    var rotuloData = elemento("label", null, "Ou escolha no calendário (domingo a Logzz não entrega)");
    rotuloData.htmlFor = "f-data";
    el.data = elemento("input", "campo");
    el.data.id = "f-data"; el.data.type = "date";
    // O calendário do celular não deixa apagar um dia da semana: domingo é recusado assim que é escolhido
    el.data.addEventListener("change", function () {
      var r = A.diaDaEntrega("data", el.data.value, hoje());
      if (r.erro) { el.dataErro.textContent = r.erro; el.data.value = ""; escolherDia("", ""); return; }
      el.dataErro.textContent = "";
      escolherDia("data", el.data.value);
    });
    el.dataErro = elemento("p", "pequeno texto-alerta");
    el.diaEscolhido = elemento("p", "pequeno");
    el.blocoDia.appendChild(rotuloData); el.blocoDia.appendChild(el.data); el.blocoDia.appendChild(el.dataErro); el.blocoDia.appendChild(el.diaEscolhido);
    var turnos = elemento("div", "acoes");
    el.turnos = [["", "Sem turno"], ["manha", "Manhã"], ["tarde", "Tarde"]].map(function (t) {
      var b = botao(t[1], "claro");
      b.addEventListener("click", function () { estado.turno = t[0]; atualizar(); });
      b.dataset.turno = t[0];
      turnos.appendChild(b);
      return b;
    });
    el.blocoDia.appendChild(turnos);
    quadro.appendChild(el.blocoDia);

    quadro.appendChild(elemento("h3", "grupo", "Mensagem"));
    el.faltando = elemento("p", "pequeno texto-alerta");
    el.avisos = elemento("ul", "pequeno");
    el.bloqueio = elemento("p", "pequeno texto-alerta");
    el.mensagem = elemento("p", "texto-mensagem");
    quadro.appendChild(el.faltando); quadro.appendChild(el.avisos); quadro.appendChild(el.bloqueio); quadro.appendChild(el.mensagem);
    var acoes = elemento("div", "acoes");
    el.enviar = botao("Enviar", "cobre"); el.copiar = botao("Copiar", "claro");
    ligarEnviar(el.enviar, "Enviar", function () { return ultimo && ultimo.mensagem; });
    ligarCopiar(el.copiar, "Copiar", function () { return ultimo && ultimo.mensagem; });
    acoes.appendChild(el.enviar); acoes.appendChild(el.copiar);
    quadro.appendChild(acoes);
    el.paraCrm = botao("Copiar para o CRM", "claro botao-largo");
    ligarCopiar(el.paraCrm, "Copiar para o CRM", function () { return blocoSeCompleto(false); });
    quadro.appendChild(el.paraCrm);
    quadro.appendChild(elemento("p", "pequeno nota", "Mande o bloco para você mesmo e, no computador, cole em Dados da cliente, no Agendamento do CRM."));
    montarEstoque();
  }

  function blocoSeCompleto(semEstoque) {
    if (!ultimo || ultimo.faltando.length || !A.normalizarTelefone(estado.telefone)) return null;
    return A.gerarBloco(campos(), hoje(), semEstoque);
  }

  function escolherDia(tipo, data) {
    estado.dia_tipo = tipo; estado.dia_data = data;
    atualizar();
  }

  function montarKits(r) {
    var atual = el.kit.dataset.plataforma || "";
    if (atual !== (r.plataforma || "") || !el.kit.options.length) {
      el.kit.textContent = "";
      var primeira = elemento("option", null, r.plataforma ? "Escolha o kit…" : "Informe o CEP para ver os kits");
      primeira.value = "";
      el.kit.appendChild(primeira);
      r.grupos.forEach(function (g) {
        var grupo = document.createElement("optgroup");
        grupo.label = g.rotulo;
        g.kits.forEach(function (k) {
          var o = elemento("option", null, k.completo ? k.nome + " · " + k.preco_texto : k.oferta + " (sem quantidade ou preço)");
          o.value = k.id; o.disabled = !k.completo;
          grupo.appendChild(o);
        });
        el.kit.appendChild(grupo);
      });
      el.kit.dataset.plataforma = r.plataforma || "";
    }
    el.kit.disabled = !r.plataforma;
    el.kit.value = r.kit ? String(r.kit.id) : "";
  }

  function atualizar() {
    guardar();
    var cep = (estado.cep || "").replace(/\D/g, "");
    var cob = A.verificar(window.COBERTURA && window.COBERTURA.faixas, cep);
    var modelos = textos && textos.agendamento ? textos.agendamento : { Logzz: "", Braip: "" };
    var r = A.fechamento(campos(), LINKS, cob.situacao, modelos, hoje());
    ultimo = r;
    el.plataforma.className = "cobertura" + (r.plataforma === "Logzz" ? " atende" : r.plataforma === "Braip" ? " fora" : "");
    el.plataforma.textContent = r.plataforma === "Logzz" ? "✅ Logzz atende: " + cob.cidades.join(", ")
      : r.plataforma === "Braip" ? "⚠️ Fora da cobertura da Logzz: versão Braip"
      : cob.situacao === "sem_lista" ? "Lista de CEPs da Logzz não encontrada." : "Informe o CEP para escolher o kit.";
    montarKits(r);
    el.kitDetalhe.hidden = !r.kit;
    el.preco.textContent = r.kit ? r.kit.preco_texto : "";
    el.blocoDia.hidden = r.plataforma !== "Logzz";
    el.data.min = hoje();
    el.data.value = estado.dia_tipo === "data" ? estado.dia_data || "" : "";
    [[el.amanha, "amanha"], [el.antes, "quanto_antes"]].forEach(function (p) {
      p[0].classList.toggle("cobre", estado.dia_tipo === p[1]); p[0].classList.toggle("claro", estado.dia_tipo !== p[1]);
    });
    el.turnos.forEach(function (b) {
      var ativo = b.dataset.turno === (estado.turno || "");
      b.classList.toggle("cobre", ativo); b.classList.toggle("claro", !ativo);
    });
    el.diaEscolhido.textContent = r.dia.texto ? "Na mensagem: " + r.dia.texto : "";
    el.faltando.textContent = r.faltando.length ? "Falta: " + r.faltando.join(", ") + "." : "";
    el.avisos.textContent = "";
    r.avisos.forEach(function (a) { el.avisos.appendChild(elemento("li", null, a)); });
    el.bloqueio.textContent = textos && textos.agendamento ? "" : "Para ver a mensagem, abra a aba Mensagens e digite a senha (só uma vez neste celular).";
    el.mensagem.textContent = r.mensagem || "";
    el.mensagem.hidden = !r.mensagem;
    el.enviar.disabled = el.copiar.disabled = !r.mensagem;
    var bloco = !!blocoSeCompleto(false);
    el.paraCrm.disabled = !bloco;
    if (el.paraCrmEstoque) el.paraCrmEstoque.disabled = !bloco;
    desenharEstoque();
  }

  // ---------- Estoque indisponível ----------
  function montarEstoque() {
    estoque.appendChild(elemento("summary", null, "Estoque indisponível"));
    el.estoqueConteudo = elemento("div");
    estoque.appendChild(el.estoqueConteudo);
    el.estoqueBloqueio = elemento("p", "pequeno texto-alerta");
    estoque.appendChild(el.estoqueBloqueio);
    el.paraCrmEstoque = botao("Copiar para o CRM: parado por falta de estoque", "claro botao-largo");
    ligarCopiar(el.paraCrmEstoque, "Copiar para o CRM: parado por falta de estoque", function () { return blocoSeCompleto(true); });
    estoque.appendChild(el.paraCrmEstoque);
    estoque.appendChild(elemento("p", "pequeno nota", "Precisa da mensagem de fechamento completa. Ao gravar esse bloco no CRM, o lead fica em Aguardando estoque no Painel."));
  }
  function cartaoTexto(pai, titulo, nota, texto) {
    pai.appendChild(elemento("h3", "grupo", titulo));
    if (nota) pai.appendChild(elemento("p", "pequeno nota", nota));
    pai.appendChild(elemento("p", "texto-mensagem", texto));
    var acoes = elemento("div", "acoes"), enviar = botao("Enviar", "cobre"), copiar = botao("Copiar", "claro");
    ligarEnviar(enviar, "Enviar", function () { return texto; });
    ligarCopiar(copiar, "Copiar", function () { return texto; });
    acoes.appendChild(enviar); acoes.appendChild(copiar);
    pai.appendChild(acoes);
  }
  function desenharEstoque() {
    var a = textos && textos.agendamento;
    el.estoqueConteudo.textContent = "";
    el.estoqueBloqueio.textContent = a ? "" : "Para ver as mensagens, abra a aba Mensagens e digite a senha (só uma vez neste celular).";
    if (!a) return;
    if (a.estoque_imagem) {
      var foto = elemento("img", "imagem-estoque");
      foto.src = a.estoque_imagem; foto.alt = "Aviso de estoque indisponível";
      el.estoqueConteudo.appendChild(foto);
      var acoes = elemento("div", "acoes"), enviar = botao("Enviar imagem", "cobre"), copiar = botao("Copiar imagem", "claro");
      var img = { arquivo: a.estoque_imagem };
      enviar.addEventListener("click", function () {
        window.ImagensApp.arquivoDaImagem(img).then(function (arquivo) {
          if (navigator.canShare && navigator.canShare({ files: [arquivo] })) return navigator.share({ files: [arquivo] });
          avisar(enviar, "Use Copiar", "Enviar imagem");
        }).catch(function (e) { if (!e || e.name !== "AbortError") avisar(enviar, "Não enviou", "Enviar imagem"); });
      });
      copiar.addEventListener("click", function () {
        if (!navigator.clipboard || !window.ClipboardItem) { avisar(copiar, "Use Enviar", "Copiar imagem"); return; }
        navigator.clipboard.write([new ClipboardItem({ "image/png": window.ImagensApp.arquivoDaImagem(img).then(window.ImagensApp.emPng) })])
          .then(function () { avisar(copiar, "Copiada!", "Copiar imagem", true); }, function () { avisar(copiar, "Use Enviar", "Copiar imagem"); });
      });
      acoes.appendChild(enviar); acoes.appendChild(copiar);
      el.estoqueConteudo.appendChild(acoes);
    }
    cartaoTexto(el.estoqueConteudo, "Com previsão", "Só quando a reposição for certa: esta mensagem promete o dia.", a.estoque_previsao);
    cartaoTexto(el.estoqueConteudo, "Sem previsão", "", a.estoque_sem_previsao);
  }

  // ---------- Ligações com o resto do app ----------
  function usarDadosDaCliente(d) {  // o que foi colado em Dados da cliente preenche os campos
    if (!d) return;
    [["nome", d.nome], ["telefone", d.telefone], ["cep", d.cep && A.mostrarCep(d.cep)], ["cpf", d.cpf && A.mostrarCpf(d.cpf)]].forEach(function (p) {
      if (p[1]) { estado[p[0]] = p[1]; entradas[p[0]].value = p[1]; }
    });
    atualizar();
  }
  window.addEventListener("dados-formatados", function (e) { usarDadosDaCliente(e.detail); });
  window.addEventListener("dados-limpos", function () {  // Limpar: começa outra cliente
    estado = {};
    Object.keys(entradas).forEach(function (c) { entradas[c].value = ""; });
    el.enderecoTexto.value = "";
    el.sobras.textContent = ""; el.dataErro.textContent = "";
    atualizar();
  });
  window.addEventListener("mensagens-abertas", function (e) { textos = e.detail; atualizar(); });

  montar();
  if (window.UltimosDados) usarDadosDaCliente(window.UltimosDados);
  atualizar();
})();
