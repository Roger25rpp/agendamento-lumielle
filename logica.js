/* Agendamento Lumielle: a mesma lógica do Agendamento do CRM (crm/agendamento.py e crm/cobertura.py), em JavaScript,
   para rodar no celular sem servidor. Recebe o que a cliente mandou no WhatsApp, em qualquer ordem, e devolve Nome, CPF,
   Telefone e CEP formatados para o formulário da Logzz. Nada sai do celular. */
(function (raiz) {
  "use strict";

  var ROTULOS = {
    nome: ["nome", "nome completo", "cliente"],
    cpf: ["cpf", "documento", "doc"],
    telefone: ["tel", "telefone", "fone", "celular", "whats", "whatsapp", "zap", "numero"],
    cep: ["cep"]
  };
  var MINUSCULAS = ["de", "da", "do", "das", "dos", "e"];
  // "[10:32, 06/10/2026] Rogerio: texto" (copiado do WhatsApp Web) ou "06/10/2026 10:32 - Rogerio: texto" (exportado)
  var PREFIXOS = [
    /^\[(\d{1,2}):(\d{2})(?::\d{2})?,\s*(\d{1,2})\/(\d{1,2})\/(\d{2,4})\]\s*[^:]{1,60}:\s?(.*)$/,
    /^(\d{1,2})\/(\d{1,2})\/(\d{2,4}),?\s+(\d{1,2}):(\d{2})\s+-\s+[^:]{1,60}:\s?(.*)$/,
    // "[12/10, 10:26] Adriana: texto": várias mensagens copiadas no WhatsApp do celular (pedido de 13/10/2026)
    /^\[(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?,?\s*(\d{1,2}):(\d{2})(?::\d{2})?\]\s*[^:]{1,60}:\s?(.*)$/
  ];

  // As mesmas quebras de linha que o Python reconhece (str.splitlines)
  var QUEBRAS = new RegExp(String.fromCharCode(13, 10) + "|[" + [10, 11, 12, 13, 28, 29, 30, 133, 8232, 8233].map(
    function (c) { return String.fromCharCode(c); }).join("") + "]");

  function digitosDe(texto) { return String(texto == null ? "" : texto).replace(/\D/g, ""); }

  function simples(texto) {
    var s = String(texto || "").normalize("NFD").replace(/[^\x00-\x7f]/g, "");
    return s.replace(/[*_~]/g, "").trim().toLowerCase();
  }

  function tirarPrefixo(linha) {
    for (var i = 0; i < PREFIXOS.length; i++) {
      var achado = PREFIXOS[i].exec(linha);
      if (achado) return achado[6];
    }
    return linha;
  }

  function cpfValido(digitos) {
    if (!/^\d{11}$/.test(digitos || "") || digitos === digitos.charAt(0).repeat(11)) return false;
    for (var tamanho = 9; tamanho <= 10; tamanho++) {
      var soma = 0;
      for (var i = 0; i < tamanho; i++) soma += Number(digitos.charAt(i)) * (tamanho + 1 - i);
      if ((soma * 10 % 11) % 10 !== Number(digitos.charAt(tamanho))) return false;
    }
    return true;
  }

  function arrumarNome(texto) {
    var palavras = String(texto || "").replace(/\s+/g, " ").trim().split(" ");
    var saida = [];
    palavras.forEach(function (p, i) {
      if (!p) return;
      var minuscula = p.toLowerCase();
      saida.push(i && MINUSCULAS.indexOf(minuscula) >= 0
        ? minuscula : p.charAt(0).toUpperCase() + p.slice(1).toLowerCase());
    });
    return saida.join(" ");
  }

  function rotulo(linha) {
    var achado = /^\s*([^\d:]{1,20}?)\s*:\s*(.*)$/.exec(linha);
    if (achado) {
      var chave = simples(achado[1]);
      for (var campo in ROTULOS) {
        if (ROTULOS[campo].indexOf(chave) >= 0) return [campo, achado[2]];
      }
    }
    return [null, linha];
  }

  function tipoNumero(linha, digitos, ja) {
    var n = digitos.length;
    if (n === 8) return "cep";
    if (((n === 12 || n === 13) && digitos.indexOf("55") === 0) || n === 10 ||
        linha.replace(/^\s+/, "").charAt(0) === "+" || linha.indexOf("(") >= 0) return "telefone";
    if (n === 11) {
      if (/\d{3}\.\d{3}\.\d{3}/.test(linha)) return "cpf";
      if (cpfValido(digitos) && !("cpf" in ja)) return "cpf";
      return !("telefone" in ja) ? "telefone" : "cpf";
    }
    return null;
  }

  // Celular escrito sem o 9 da frente (DDD + 8 dígitos começando com 6 a 9) ganha o 9. Fixo fica como está.
  function comNonoDigito(tel) {
    if (tel && tel.length === 10 && "6789".indexOf(tel.charAt(2)) >= 0) return tel.slice(0, 2) + "9" + tel.slice(2);
    return tel;
  }

  // Só dígitos, com DDD, sem +55; celular com o 9. Vazio -> null.
  function normalizarTelefone(valor) {
    var d = digitosDe(valor).replace(/^0+/, "");
    if (d.indexOf("55") === 0 && (d.length === 12 || d.length === 13)) d = d.slice(2);
    return comNonoDigito(d) || null;
  }

  // Só dígitos; completa até 11 com zeros na frente. CNPJ (14) fica como veio. Inválido -> null.
  function normalizarCpf(valor) {
    var d = digitosDe(valor);
    if (d.length >= 9 && d.length <= 11) while (d.length < 11) d = "0" + d;
    if ((d.length !== 11 && d.length !== 14) || /^0+$/.test(d)) return null;
    return d;
  }

  function formatar(texto) {
    var achados = {}, avisos = [], sobras = [];
    String(texto || "").split(QUEBRAS).forEach(function (bruta) {
      var linha = tirarPrefixo(bruta.trim()).replace(/[*_~]/g, "").trim();  // formatação do WhatsApp
      if (!linha) return;
      var r = rotulo(linha), campo = r[0], valor = r[1];
      var digitos = digitosDe(valor);
      if (campo === null) {
        var letras = valor.replace(/[^A-Za-zÀ-ÿ]/g, "");
        if (letras && digitos.length < 3) campo = "nome";
        else if (digitos && !letras) campo = tipoNumero(valor, digitos, achados);
      }
      if (campo === null || !(campo !== "nome" ? digitos : valor.trim())) { sobras.push(linha); return; }
      if (campo in achados) {
        avisos.push("Mais de um " + (campo === "cpf" || campo === "cep" ? campo.toUpperCase() : campo) + ": usei o primeiro.");
        return;
      }
      achados[campo] = campo === "nome" ? arrumarNome(valor) : digitos;
    });

    if (achados.nome && achados.nome.indexOf(" ") < 0) achados.nome += " .";  // só o primeiro nome
    if ("cpf" in achados) {
      var cpf = normalizarCpf(achados.cpf);
      achados.cpf = cpf;
      if (!cpfValido(cpf)) avisos.push("O CPF não confere (dígitos verificadores). Peça para a cliente conferir.");
    }
    if ("telefone" in achados) {
      var tel = comNonoDigito(normalizarTelefone(achados.telefone));
      if (tel && tel.length === 10)
        avisos.push("O telefone parece fixo (começa com 2 a 5): não acrescentei o 9. Confira com a cliente.");
      achados.telefone = tel;
      if (!tel || (tel.length !== 10 && tel.length !== 11))
        avisos.push("O telefone precisa ter DDD + número (10 ou 11 dígitos).");
    }
    if ("cep" in achados && achados.cep.length !== 8) avisos.push("O CEP precisa ter 8 dígitos.");
    [["nome", "Nome"], ["cpf", "CPF"], ["telefone", "Telefone"], ["cep", "CEP"]].forEach(function (par) {
      if (!(par[0] in achados)) achados[par[0]] = null;
      if (achados[par[0]] === null) avisos.push(par[1] + " não encontrado no texto.");
    });
    return { nome: achados.nome, cpf: achados.cpf, telefone: achados.telefone, cep: achados.cep,
             avisos: avisos, sobras: sobras };
  }

  // Faixas: [[cep inicial, cep final, cidade, uf, observação], ...] (arquivo cobertura.js)
  function verificar(faixas, cep) {
    if (!cep || cep.length !== 8) return { situacao: "sem_cep", cidades: [], obs: [] };
    if (!faixas) return { situacao: "sem_lista", cidades: [], obs: [] };
    var numero = Number(cep), cidades = [], obs = [];
    faixas.forEach(function (f) {
      if (f[0] <= numero && numero <= f[1]) {
        var cidade = f[3] ? f[2] + "/" + f[3] : f[2];
        if (cidades.indexOf(cidade) < 0) cidades.push(cidade);
        if (f[4] && obs.indexOf(f[4]) < 0) obs.push(f[4]);
      }
    });
    return { situacao: cidades.length ? "atende" : "fora", cidades: cidades, obs: obs };
  }

  // DDD do telefone e cobertura aproximada da Logzz (cópia de ddd_na_cobertura, crm/regioes.py; 18/10/2026).
  // ddds: {"21": [uf, estado, cidade de referência, observação, atendidos, municípios, atende a cidade], ...}
  // (arquivo ddd.js). Atendidos null = a tabela foi gerada sem a lista de cobertura.
  function dddNaCobertura(ddds, telefone) {
    var digitos = digitosDe(telefone);
    if (digitos.length < 10) return null;
    var ddd = digitos.slice(0, 2), l = ddds && ddds[ddd];
    if (!l) {
      return { ddd: ddd, uf: "?", cidade: "", estado: "DDD desconhecido", observacao: "", situacao: "desconhecido",
               atendidos: null, municipios: null };
    }
    var r = { ddd: ddd, uf: l[0], cidade: l[2], estado: l[1], observacao: l[3] };
    if (l[4] === null) { r.situacao = "sem_lista"; r.atendidos = null; r.municipios = null; return r; }
    r.situacao = l[6] ? "atende" : "nao_atende"; r.atendidos = l[4]; r.municipios = l[5];
    return r;
  }

  function mostrarCpf(v) {
    if (!v) return "";
    if (v.length === 11) return v.slice(0, 3) + "." + v.slice(3, 6) + "." + v.slice(6, 9) + "-" + v.slice(9);
    if (v.length === 14) return v.slice(0, 2) + "." + v.slice(2, 5) + "." + v.slice(5, 8) + "/" + v.slice(8, 12) + "-" + v.slice(12);
    return v;
  }

  function mostrarCep(v) {
    var d = digitosDe(v);
    return d.length === 8 ? d.slice(0, 5) + "-" + d.slice(5) : (v || "");
  }

  var api = { formatar: formatar, verificar: verificar, cpfValido: cpfValido, arrumarNome: arrumarNome,
              mostrarCpf: mostrarCpf, mostrarCep: mostrarCep, dddNaCobertura: dddNaCobertura };
  if (typeof module === "object" && module.exports) module.exports = api;
  else raiz.Agendamento = api;
})(this);
