/* Abas do topo (Agendamento · Check-out · Galeria) e as telas de Check-out e Galeria (pedido de 13/10/2026).
   Os links e as imagens vêm do CRM (dados.js, gerado por ferramentas/exportar_do_crm.py); no app só se usa, não se edita. */
(function () {
  "use strict";
  var DADOS = window.DADOS;
  var GRUPOS = [["normal", "Preço normal"], ["extra", "Frasco extra (remarketing)"], ["desconto", "Com desconto"],
                ["plus", "Plus (extra com desconto)"], [null, "Sem grupo"]];

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
  function reais(valor) {
    var partes = Number(valor).toFixed(2).split(".");
    return "R$ " + partes[0].replace(/\B(?=(\d{3})+(?!\d))/g, ".") + "," + partes[1];
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
  function semDados(lista, oque) {
    lista.appendChild(elemento("p", "cartao vazio",
      "Ainda não há " + oque + " no aplicativo. Eles vêm do CRM: peça ao Claude para levar os dados do CRM para o app."));
  }

  // ---------- Check-out: Logzz e Braip, separados por grupo; "Abrir" e "Copiar" (sem imagens) ----------
  function montarCheckout() {
    var lista = document.getElementById("lista-checkout");
    var links = (DADOS && DADOS.checkout) || [];
    if (!links.length) { semDados(lista, "links de checkout"); return; }
    ["Logzz", "Braip"].forEach(function (plataforma) {
      var daqui = links.filter(function (l) { return l.plataforma === plataforma; });
      if (!daqui.length) return;
      var cartao = elemento("section", "cartao");
      cartao.appendChild(elemento("h2", null, plataforma));
      GRUPOS.forEach(function (g) {
        var doGrupo = daqui.filter(function (l) { return (l.grupo || null) === g[0]; });
        if (!doGrupo.length) return;
        cartao.appendChild(elemento("h3", "grupo", g[1]));
        doGrupo.forEach(function (l) {
          var linha = elemento("div", "link-oferta");
          var texto = elemento("div", "link-texto");
          texto.appendChild(elemento("strong", null, l.oferta));
          var detalhe = [];
          if (l.qtde) detalhe.push(l.qtde + (l.qtde === 1 ? " frasco" : " frascos"));
          if (l.preco != null) detalhe.push(reais(l.preco));
          if (detalhe.length) texto.appendChild(elemento("span", "pequeno", detalhe.join(" · ")));
          linha.appendChild(texto);
          var abrir = elemento("a", "botao cobre", "Abrir");
          abrir.href = l.link; abrir.target = "_blank"; abrir.rel = "noopener noreferrer";
          var copiar = botao("Copiar", "claro botao-copiar");
          copiar.addEventListener("click", function () {
            copiarTexto(l.link).then(function () { avisar(copiar, "Copiado!", "Copiar", true); },
                                     function () { avisar(copiar, "Não copiou", "Copiar"); });
          });
          linha.appendChild(abrir);
          linha.appendChild(copiar);
          cartao.appendChild(linha);
        });
      });
      lista.appendChild(cartao);
    });
  }

  // ---------- Galeria: "Enviar" abre o compartilhar do celular (escolha o WhatsApp); "Copiar" copia a imagem ----------
  function arquivoDaImagem(img) {
    return fetch(img.arquivo).then(function (r) { return r.blob(); }).then(function (blob) {
      var nome = img.arquivo.split("/").pop();
      return new File([blob], nome, { type: blob.type || "image/png" });
    });
  }
  function emPng(blob) {  // a área de transferência só aceita PNG
    if (blob.type === "image/png") return Promise.resolve(blob);
    return createImageBitmap(blob).then(function (bitmap) {
      var tela = document.createElement("canvas");
      tela.width = bitmap.width; tela.height = bitmap.height;
      tela.getContext("2d").drawImage(bitmap, 0, 0);
      return new Promise(function (ok) { tela.toBlob(ok, "image/png"); });
    });
  }

  function montarGaleria() {
    var lista = document.getElementById("lista-galeria");
    var imagens = (DADOS && DADOS.imagens) || [];
    if (!imagens.length) { semDados(lista, "imagens"); return; }
    imagens.forEach(function (img) {
      var figura = elemento("figure", "cartao imagem");
      var foto = elemento("img");
      foto.src = img.arquivo; foto.alt = img.titulo; foto.loading = "lazy";
      figura.appendChild(foto);
      figura.appendChild(elemento("figcaption", null, img.titulo));
      var acoes = elemento("div", "acoes");
      var enviar = botao("Enviar", "cobre");
      enviar.addEventListener("click", function () {
        arquivoDaImagem(img).then(function (arquivo) {
          if (navigator.canShare && navigator.canShare({ files: [arquivo] })) {
            return navigator.share({ files: [arquivo] });
          }
          avisar(enviar, "Use Copiar", "Enviar");
        }).catch(function (erro) {
          if (!erro || erro.name !== "AbortError") avisar(enviar, "Não enviou", "Enviar");
        });
      });
      var copiar = botao("Copiar", "claro");
      copiar.addEventListener("click", function () {
        if (!navigator.clipboard || !window.ClipboardItem) { avisar(copiar, "Use Enviar", "Copiar"); return; }
        navigator.clipboard.write([new ClipboardItem({ "image/png": arquivoDaImagem(img).then(emPng) })])
          .then(function () { avisar(copiar, "Copiada!", "Copiar", true); },
                function () { avisar(copiar, "Use Enviar", "Copiar"); });
      });
      acoes.appendChild(enviar);
      acoes.appendChild(copiar);
      figura.appendChild(acoes);
      lista.appendChild(figura);
    });
  }

  // ---------- Abas ----------
  function mostrar() {
    var tela = (location.hash || "#agendamento").slice(1);
    if (!document.getElementById("tela-" + tela)) tela = "agendamento";
    Array.prototype.forEach.call(document.querySelectorAll(".tela"), function (t) {
      t.hidden = t.id !== "tela-" + tela;
    });
    Array.prototype.forEach.call(document.querySelectorAll(".aba"), function (a) {
      a.classList.toggle("ativa", a.dataset.tela === tela);
      if (a.dataset.tela === tela) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current");
    });
    window.scrollTo(0, 0);
  }

  montarCheckout();
  montarGaleria();
  Array.prototype.forEach.call(document.querySelectorAll(".rodape-dados"), function (p) {
    p.textContent = DADOS ? "Links e imagens do CRM de " + DADOS.exportado_em + "." : "";
  });
  window.addEventListener("hashchange", mostrar);
  mostrar();
})();
