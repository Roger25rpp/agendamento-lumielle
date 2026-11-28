/* "Deu algum problema na Logzz?" no celular (26/11/2026): cópia do preenchimento de crm/situacoes.py (CRM, §5.32).
   A lista de situações (o que fazer, quando mandar, quais respostas) vem do CRM no comando de publicar, embaralhada com
   as mensagens; aqui fica só o preenchimento das lacunas, que tem de dar o mesmo resultado do CRM
   (testes/testar_situacoes.py). Nada sai do celular. */
(function (raiz) {
  "use strict";

  var FIM_BLACK_FRIDAY = "2026-11-30";
  var SEMANA = ["segunda-feira", "terça-feira", "quarta-feira", "quinta-feira", "sexta-feira", "sábado", "domingo"];
  var TROCAS_BLACK_FRIDAY = [
    ["pra você não perder a oferta especial de Black Friday", "pra já deixar o seu pedido garantido"],
    ["pra garantir pra você a condição de Black Friday que você recebeu", "pra já deixar o seu pedido garantido"],
    ["Pra você não ficar sem a condição de Black Friday que você recebeu", "Pra já deixar o seu pedido garantido"]
  ];
  var FRASE_ENDERECO = "não consegue entregar nesse endereço";
  var FRASE_BAIRRO = "não está entregando nesse bairro no momento";
  var DATAS = { pedido: "Dia que ela pediu", agendado: "Dia em que agendei na Logzz", outra1: "Outra data disponível",
                outra2: "Mais uma data disponível", oferecido: "Dia que vou oferecer", novo: "Novo dia agendado" };
  var LACUNA = /\[([^\[\]\n]+)\]/g;
  var DATA_DUPLA = /\[dia da semana\],? dia \[(?:XX\/XX|XX|dd\/mm)\]/gi;

  function trocarTudo(texto, antes, depois) { return texto.split(antes).join(depois); }
  function data(texto) {  // "aaaa-mm-dd" válida -> {iso, d}; senão null (como date.fromisoformat)
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(texto || "").trim());
    if (!m) return null;
    var d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
    if (d.getUTCFullYear() !== +m[1] || d.getUTCMonth() !== +m[2] - 1 || d.getUTCDate() !== +m[3]) return null;
    return { iso: m[0], d: d };
  }
  function semana(x) { return SEMANA[(x.d.getUTCDay() + 6) % 7]; }
  function ddmm(x) { return x.iso.slice(8, 10) + "/" + x.iso.slice(5, 7); }
  function porExtenso(x) { return semana(x) + ", dia " + ddmm(x); }
  function primeiroNome(nome) {  // respostas.primeiro_nome do CRM
    var t = String(nome || "").trim();
    if (!t) return "";
    var p = t.split(" ")[0];
    return p.charAt(0).toUpperCase() + p.slice(1).toLowerCase();
  }

  // campos: nome, cidade, kit, qtde, aviso. datas: [[chave, "aaaa-mm-dd"], ...] na ordem da situação. hoje: "aaaa-mm-dd".
  function preencher(texto, campos, datas, hoje) {
    var avisos = [];
    texto = trocarTudo(texto, "{nome}", primeiroNome(campos.nome));
    var lidas = datas.map(function (p) { return [p[0], data(p[1])]; });
    var porChave = {};
    lidas.forEach(function (p) { porChave[p[0]] = p[1]; });
    var fila = lidas.map(function (p) { return p[1]; });
    function tirar(x) {  // como o list.remove do Python: a primeira data igual (pelo valor), não o mesmo objeto
      for (var i = 0; i < fila.length; i++) if (fila[i].iso === x.iso) { fila.splice(i, 1); return; }
    }
    var pedida = porChave.pedido || null;
    var agendada = porChave.agendado || porChave.novo || porChave.oferecido || null;

    function semantica(nome) {
      var baixo = nome.toLowerCase();
      if (baixo.indexOf("pediu") >= 0 && pedida) {
        tirar(pedida);
        return baixo.indexOf("no dia") === 0 ? "no dia " + ddmm(pedida) : ddmm(pedida);
      }
      if (baixo === "o dia agendado" && agendada) { tirar(agendada); return porExtenso(agendada); }
      if (baixo === "esse dia" && agendada) return semana(agendada);
      return null;
    }
    texto = texto.replace(LACUNA, function (todo, nome) { var v = semantica(nome); return v === null ? todo : v; });
    function proxima() { return fila.length ? fila.shift() : null; }
    texto = texto.replace(DATA_DUPLA, function (todo) { var d = proxima(); return d === null ? todo : porExtenso(d); });
    texto = texto.replace(LACUNA, function (todo, nome) {
      var baixo = nome.toLowerCase();
      if (baixo === "cidade" && campos.cidade) return campos.cidade;
      if (baixo === "kit" && campos.kit) return campos.kit;
      if (baixo === "n" && campos.qtde) return String(campos.qtde);
      if (baixo === "valor" && campos.valor) return campos.valor;
      if (baixo.indexOf("dia da semana, dia") === 0 || ["dia", "dd/mm", "xx/xx", "xx", "dia da semana"].indexOf(baixo) >= 0) {
        var d = proxima();
        if (d === null && baixo === "dia da semana" && agendada) return semana(agendada);
        if (d === null) return todo;
        if (baixo === "dia da semana") return semana(d);
        if (["dd/mm", "xx/xx", "xx"].indexOf(baixo) >= 0) return ddmm(d);
        return porExtenso(d);
      }
      return todo;
    });
    if (campos.aviso === "bairro" && texto.indexOf(FRASE_ENDERECO) >= 0) texto = trocarTudo(texto, FRASE_ENDERECO, FRASE_BAIRRO);
    var temBf = texto.toLowerCase().indexOf("black friday") >= 0;
    if (hoje > FIM_BLACK_FRIDAY) {
      TROCAS_BLACK_FRIDAY.forEach(function (t) { texto = trocarTudo(texto, t[0], t[1]); });
      if (texto.toLowerCase().indexOf("black friday") >= 0)
        avisos.push("A Black Friday acabou em 30/11 e o texto ainda fala dela: confira antes de mandar.");
    } else if (temBf && lidas.some(function (p) { return p[1].iso > FIM_BLACK_FRIDAY; })) {
      avisos.push("A entrega cai depois de 30/11 e o texto fala de Black Friday: confira se a frase deve ficar (nota da RSP-021b).");
    }
    var sobrou = [], m, re = new RegExp(LACUNA.source, "g");
    while ((m = re.exec(texto))) if (sobrou.indexOf(m[0]) < 0) sobrou.push(m[0]);
    sobrou.sort(function (a, b) { return a < b ? -1 : a > b ? 1 : 0; });
    if (sobrou.length) avisos.push("Lacuna que o CRM não preencheu: " + sobrou.join(", ") + ". Troque antes de mandar.");
    return { texto: texto, avisos: avisos };
  }

  // A resposta pelo código (DIA-08) ou pela RSP de origem (RSP-027). respostas: os grupos da aba Mensagens.
  function resposta(respostas, codigo) {
    var achada = null;
    (respostas || []).forEach(function (g) {
      g.itens.forEach(function (r) { if (!achada && (r.codigo === codigo || r.biblioteca === codigo)) achada = r; });
    });
    return achada;
  }

  // situacao: um item da lista vinda do CRM. Devolve {mensagem, avisos, erro}.
  function montar(respostas, situacao, codigo, campos, hoje) {
    var r = { mensagem: null, avisos: [], erro: null };
    if (!situacao || situacao.codigos.indexOf(codigo) < 0) { r.erro = "Situação ou resposta desconhecida."; return r; }
    var achada = resposta(respostas, codigo);
    if (!achada) { r.erro = "A resposta " + codigo + " não está em WhatsApp → Respostas."; return r; }
    var datas = [];
    situacao.datas.forEach(function (chave) {
      var x = data(campos[chave]);
      if (!x) return;
      if (x.iso < hoje) r.erro = DATAS[chave] + ": a data já passou.";
      else if (x.d.getUTCDay() === 0 && chave !== "pedido") r.erro = DATAS[chave] + ": a Logzz não entrega no domingo.";
      datas.push([chave, x.iso]);
    });
    if (r.erro) return r;
    var p = preencher(achada.texto, campos, datas, hoje);
    r.mensagem = p.texto; r.avisos = p.avisos;
    return r;
  }

  // Como o CRM escreve o valor na lacuna [valor] (28/11/2026): 297.9 -> "R$ 297,90"; 1297 -> "R$ 1.297,00".
  function emReais(valor) {
    var partes = Number(valor).toFixed(2).split(".");
    return "R$ " + partes[0].replace(/\B(?=(\d{3})+(?!\d))/g, ".") + "," + partes[1];
  }

  // Como o CRM escreve o kit na lacuna [kit]: "3 + 1 extra" no grupo extra ou plus; senão o nome do kit.
  function kitDoLink(link) {
    if (!link || !link.qtde) return { kit: "", qtde: "", valor: "" };
    var extra = (link.grupo === "extra" || link.grupo === "plus") && link.qtde > 1;
    var nome = link.qtde === 1 ? "1 frasco" : "kit com " + link.qtde + " frascos" +
      ((link.grupo === "extra" || link.grupo === "plus") ? " (" + (link.qtde - 1) + " + 1 extra)" : "");
    return { kit: extra ? (link.qtde - 1) + " + 1 extra" : nome, qtde: link.qtde, valor: link.preco ? emReais(link.preco) : "" };
  }

  var api = { preencher: preencher, montar: montar, resposta: resposta, kitDoLink: kitDoLink, DATAS: DATAS,
              primeiroNome: primeiroNome };
  if (typeof module === "object" && module.exports) module.exports = api;
  else raiz.Situacoes = api;
})(this);
