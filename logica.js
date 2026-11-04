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

  // ---------- Mensagem de fechamento (03/11/2026): cópia das funções de crm/agendamento.py; testes/testar.py confere ----------
  var UFS = ["AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG", "PA", "PB", "PR", "PE", "PI", "RJ",
             "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO"];
  var TIPOS_DE_RUA = ["rua", "r", "av", "avenida", "travessa", "tv", "alameda", "al", "estrada", "est", "rodovia", "rod", "praca",
                      "pca", "largo", "servidao", "viela", "beco", "br", "ladeira"];
  var MARCAS_DE_NUMERO = ["n", "no", "num", "numero", "nro"];
  var ROTULOS_ENDERECO = {
    rua: ["rua", "Rua "], avenida: ["rua", "Avenida "], av: ["rua", "Av. "], travessa: ["rua", "Travessa "],
    endereco: ["rua", ""], end: ["rua", ""], logradouro: ["rua", ""],
    n: ["numero", ""], no: ["numero", ""], num: ["numero", ""], numero: ["numero", ""], nro: ["numero", ""],
    complemento: ["complemento", ""], compl: ["complemento", ""], comp: ["complemento", ""],
    bairro: ["bairro", ""], cidade: ["cidade", ""], municipio: ["cidade", ""], uf: ["uf", ""], estado: ["uf", ""]
  };
  var CEP_NO_TEXTO = /(?:\bcep\b\s*[:.\-]?\s*)?(?<!\d)(\d{2}\.?\d{3}[-\s]?\d{3})(?!\d)/gi;
  var ANTES_DE_ROTULO = /(?<=\s)((?:bairro|cidade|munic[ií]pio|complemento|compl|uf|estado|n[º°]|n[uú]mero|num)\s*:)/gi;
  var SEPARADORES = /[,;\n]|\s[-–—]\s/;
  var COM_UF = /^(.+?)\s*[-\/]\s*([A-Za-z]{2})$/;
  var NUMERO = /^\d+[-\/]?[a-z]?$/;
  var SEM_NUMERO = /^(s\s*\/?\.?\s*n\.?|sem\s+numero|sem\s+n)$/;
  var MARCA_E_NUMERO = /^(?:n|no|num|numero|nro)\.?\s*[:.]?\s*(\d+[-\/]?[a-z]?|s\s*\/\s*n|sn)$/;
  var COMPLEMENTO = /^(apto|apt|apartamento|ap|casa|bloco|bl|sala|sl|lote|lt|quadra|qd|qda|torre|andar|loja|cj|conj|conjunto)\.?\s*(n\s*)?(\d|[a-z]\b|$)/;
  var COMPLEMENTO_LIVRE = /^(edificio|edif|ed|condominio|cond)\b|\bfundos?\b|^\d+\s*andar\b/;
  var ROTULO_LIVRE = /^([^\d:]{1,20}?)\s*:\s*(.*)$/;

  function ehComplemento(trecho) {
    var s = simples(trecho);
    return COMPLEMENTO.test(s) || COMPLEMENTO_LIVRE.test(s);
  }
  function numeroDe(s, original) {
    if (NUMERO.test(s)) return original;
    if (SEM_NUMERO.test(s)) return "s/n";
    var marcado = MARCA_E_NUMERO.exec(s);
    if (marcado) return /\d/.test(marcado[1].charAt(0)) ? marcado[1] : "s/n";
    return null;
  }
  function palavrasDe(texto) { var t = String(texto).trim(); return t ? t.split(/\s+/) : []; }
  function semPontoFinal(s) { return s.replace(/\.+$/, ""); }

  function separarRua(trecho) {
    var palavras = palavrasDe(trecho);
    for (var i = 1; i < palavras.length; i++) {
      var s = simples(palavras[i]), depois = i + 1, numero;
      if (s === "sem" && i + 1 < palavras.length && MARCAS_DE_NUMERO.indexOf(simples(palavras[i + 1])) >= 0) {
        numero = "s/n"; depois = i + 2;
      } else {
        numero = numeroDe(s, palavras[i]);
      }
      if (!numero) continue;
      var resto = palavras.slice(depois).join(" ");
      if (resto && !ehComplemento(resto)) continue;
      var rua = palavras.slice(0, i);
      if (rua.length > 1 && MARCAS_DE_NUMERO.indexOf(semPontoFinal(simples(rua[rua.length - 1]))) >= 0) rua = rua.slice(0, -1);
      if (rua.length === 1 && TIPOS_DE_RUA.indexOf(semPontoFinal(simples(rua[0]))) >= 0) continue;
      return [rua.join(" "), numero, resto];
    }
    return [trecho, null, ""];
  }

  function trechosDe(texto) {
    var partes = [];
    String(texto || "").split(QUEBRAS).forEach(function (bruta) {
      var linha = tirarPrefixo(bruta.trim()).replace(/[*_~]/g, "").replace(ANTES_DE_ROTULO, "\n$1");
      linha.split(SEPARADORES).forEach(function (parte) {
        var limpa = parte.replace(/\s+/g, " ").replace(/^[ .:;]+|[ .:;]+$/g, "");
        if (limpa) partes.push(limpa);
      });
    });
    return partes;
  }

  function separarEndereco(texto) {
    var campos = { rua: "", numero: "", complemento: "", bairro: "", cidade: "", uf: "", cep: "" };
    var complementos = [], restantes = [], sobras = [];
    function guardarRua(valor, prefixo) {
      var r = separarRua(valor), rua = r[0];
      var temTipo = rua ? TIPOS_DE_RUA.indexOf(semPontoFinal(simples(palavrasDe(rua)[0]))) >= 0 : false;
      campos.rua = (temTipo ? "" : prefixo || "") + rua;
      if (r[1] && !campos.numero) campos.numero = r[1];
      if (r[2]) complementos.push(r[2]);
    }
    var semCep = String(texto || "").replace(CEP_NO_TEXTO, function (tudo, cep) {
      campos.cep = campos.cep || cep.replace(/\D/g, "");
      return "\n";
    });
    var partes = trechosDe(semCep);
    partes.forEach(function (trecho, indice) {
      var rotulado = ROTULO_LIVRE.exec(trecho);
      if (rotulado) {
        var chave = simples(rotulado[1]), valor = rotulado[2].trim();
        if (!Object.prototype.hasOwnProperty.call(ROTULOS_ENDERECO, chave)) { sobras.push(trecho); return; }
        if (!valor) return;
        var campo = ROTULOS_ENDERECO[chave][0], prefixo = ROTULOS_ENDERECO[chave][1];
        var comUf = COM_UF.exec(valor);
        if (campo === "cidade" && comUf && UFS.indexOf(comUf[2].toUpperCase()) >= 0) {
          valor = comUf[1];
          campos.uf = comUf[2].toUpperCase();
        }
        if (campo === "rua" && !campos.rua) guardarRua(valor, prefixo);
        else if (campo === "numero") campos.numero = campos.numero || numeroDe(simples(valor), valor) || valor;
        else if (campo === "complemento") complementos.push(valor);
        else if (campo === "uf") {
          if (UFS.indexOf(valor.toUpperCase()) >= 0) campos.uf = valor.toUpperCase(); else sobras.push(trecho);
        } else if (!campos[campo]) campos[campo] = valor;
        return;
      }
      var s = simples(trecho), maiusculas = trecho.toUpperCase();
      if (UFS.indexOf(maiusculas) >= 0 && (trecho === maiusculas || indice === partes.length - 1)) { campos.uf = maiusculas; return; }
      var numero = numeroDe(s, trecho);
      if (numero) {
        if (campos.numero) complementos.push(trecho); else campos.numero = numero;
      } else if (ehComplemento(trecho)) {
        complementos.push(trecho);
      } else if (!campos.rua) {
        guardarRua(trecho, "");
      } else {
        var u = COM_UF.exec(trecho);
        if (u && UFS.indexOf(u[2].toUpperCase()) >= 0) {
          campos.uf = u[2].toUpperCase();
          campos.cidade = campos.cidade || u[1];
        } else {
          restantes.push(trecho);
        }
      }
    });
    if (restantes.length && !campos.cidade && (campos.bairro || campos.uf || restantes.length > 1)) campos.cidade = restantes.pop();
    if (restantes.length && !campos.bairro) campos.bairro = restantes.shift();
    sobras = sobras.concat(restantes);
    var espacoUf = /^(.+)\s([A-Z]{2})$/.exec(campos.cidade);
    if (espacoUf && UFS.indexOf(espacoUf[2]) >= 0) {
      campos.cidade = espacoUf[1];
      campos.uf = campos.uf || espacoUf[2];
    }
    campos.complemento = complementos.join(", ");
    campos.sobras = sobras;
    return campos;
  }

  // ---------- Kit ----------
  var ORDEM_DOS_GRUPOS = ["normal", "extra", "plus", "desconto", null];
  var ROTULO_DOS_GRUPOS = { normal: "Preço normal", extra: "Frasco extra", plus: "Plus", desconto: "Com desconto (último recurso)" };

  function nomeDoKit(qtde, grupo) {
    if (!qtde || qtde < 1) return null;
    if (qtde === 1) return "1 frasco";
    if (grupo === "extra" || grupo === "plus") return "kit com " + qtde + " frascos (" + (qtde - 1) + " + 1 extra)";
    return "kit com " + qtde + " frascos";
  }
  function emReais(valor) {
    var partes = Number(valor).toFixed(2).split(".");
    return "R$ " + partes[0].replace(/\B(?=(\d{3})+(?!\d))/g, ".") + "," + partes[1];
  }
  function kits(links, plataforma) {
    var grupos = [];
    ORDEM_DOS_GRUPOS.forEach(function (grupo) {
      var daqui = links.filter(function (l) { return l.plataforma === plataforma && (l.grupo || null) === grupo; });
      if (!daqui.length) return;
      grupos.push({ grupo: grupo, rotulo: grupo ? ROTULO_DOS_GRUPOS[grupo] : "Sem grupo", kits: daqui.map(function (l) {
        var nome = nomeDoKit(l.qtde, grupo), temPreco = l.preco !== null && l.preco !== undefined;
        return { id: l.id, oferta: l.oferta, nome: nome, preco: temPreco ? l.preco : null, preco_texto: temPreco ? emReais(l.preco) : null,
                 link: l.link, completo: !!nome && temPreco };
      }) });
    });
    return grupos;
  }

  // ---------- Dia da entrega (datas sempre em aaaa-mm-dd, sem fuso) ----------
  var SEMANA = ["segunda-feira", "terça-feira", "quarta-feira", "quinta-feira", "sexta-feira", "sábado", "domingo"];
  var QUANTO_ANTES = "a próxima data disponível";
  var TURNOS = { manha: ", de preferência pela manhã", tarde: ", de preferência à tarde" };

  function paraData(iso) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(iso || "")) return null;
    var d = new Date(Date.UTC(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10))));
    return d.toISOString().slice(0, 10) === iso ? d : null;
  }
  function diaDaSemana(d) { return (d.getUTCDay() + 6) % 7; }  // segunda = 0, como no Python
  function maisUmDia(d) { return new Date(d.getTime() + 86400000); }
  function diaEData(d) {
    var iso = d.toISOString();
    return SEMANA[diaDaSemana(d)] + " (" + iso.slice(8, 10) + "/" + iso.slice(5, 7) + ")";
  }
  function diaDaEntrega(tipo, dataTexto, hoje) {
    var r = { texto: null, data: null, aviso: null, erro: null }, d;
    if (tipo === "quanto_antes") {
      r.texto = QUANTO_ANTES;
    } else if (tipo === "amanha") {
      d = maisUmDia(paraData(hoje));
      if (diaDaSemana(d) === 6) {
        d = maisUmDia(d);
        r.aviso = "Amanhã é domingo, e a Logzz não entrega: ficou para " + diaEData(d) + ".";
        r.texto = diaEData(d);
      } else {
        r.texto = "amanhã, " + diaEData(d);
      }
      r.data = d.toISOString().slice(0, 10);
    } else if (tipo === "data") {
      d = paraData(dataTexto);
      if (!d) { r.erro = "Escolha uma data no calendário."; return r; }
      if (dataTexto < hoje) { r.erro = "Essa data já passou."; return r; }
      if (diaDaSemana(d) === 6) { r.erro = "A Logzz não entrega no domingo."; return r; }
      r.texto = diaEData(d); r.data = dataTexto;
    }
    return r;
  }

  // ---------- A mensagem (os textos vêm do CRM, embaralhados com a senha) ----------
  function primeiroNome(nome) {
    var palavras = palavrasDe(nome || "");
    return palavras.length && palavras[0] !== "." ? palavras[0].charAt(0).toUpperCase() + palavras[0].slice(1).toLowerCase() : "";
  }
  function preencherModelo(modelo, valores) {
    return String(modelo).replace(/\{([^{}]*)\}/g, function (tudo, campo) {
      return Object.prototype.hasOwnProperty.call(valores, campo) ? valores[campo] : tudo;
    });
  }
  function plataformaDoCep(situacao) { return situacao === "atende" ? "Logzz" : situacao === "fora" ? "Braip" : null; }
  function limparValor(v) { return String(v === null || v === undefined ? "" : v).replace(/\s+/g, " ").trim(); }

  function fechamento(campos, links, situacao, modelos, hoje) {
    var valor = function (chave) { return limparValor(campos[chave]); };
    var plataforma = plataformaDoCep(situacao), cep = valor("cep").replace(/\D/g, "");
    var grupos = plataforma ? kits(links, plataforma) : [], kit = null;
    grupos.forEach(function (g) {
      g.kits.forEach(function (k) { if (!kit && k.completo && String(k.id) === valor("link_id")) kit = k; });
    });
    var avisos = [], faltando = [], primeiro = primeiroNome(valor("nome"));
    if (!primeiro) faltando.push("nome");
    if (!plataforma && situacao === "sem_lista") avisos.push("Lista de CEPs da Logzz não encontrada: não dá para saber a plataforma.");
    if (cep.length !== 8) faltando.push("CEP");
    if (!kit) faltando.push("kit");
    var faltaEndereco = [["rua", "rua"], ["numero", "número"], ["bairro", "bairro"], ["cidade", "cidade"]]
      .filter(function (p) { return !valor(p[0]); }).map(function (p) { return p[1]; });
    if (faltaEndereco.length) faltando.push("endereço (" + faltaEndereco.join(", ") + ")");
    var dia = { texto: null, data: null, aviso: null, erro: null };
    if (plataforma === "Logzz") {
      dia = diaDaEntrega(valor("dia_tipo"), valor("dia_data"), hoje);
      if (dia.aviso) avisos.push(dia.aviso);
      if (dia.erro) avisos.push(dia.erro);
      if (!dia.texto) faltando.push("dia");
    }
    var mensagem = null;
    if (!faltando.length && plataforma) {
      var complemento = valor("complemento");
      mensagem = preencherModelo(modelos[plataforma], {
        "primeiro nome": primeiro, kit: kit.nome, "preço": kit.preco_texto, dia: dia.texto || "",
        turno: TURNOS[valor("turno")] || "", rua: valor("rua"), "número": valor("numero"),
        complemento: complemento ? ", " + complemento : "", bairro: valor("bairro"), cidade: valor("cidade"),
        CEP: cep.slice(0, 5) + "-" + cep.slice(5) });
    }
    return { plataforma: plataforma, grupos: grupos, kit: kit, dia: dia, faltando: faltando, avisos: avisos, mensagem: mensagem };
  }

  // ---------- Ponte para o CRM, sem internet ----------
  var MARCA_DO_BLOCO = "#AGENDAMENTO-LUMIELLE";
  var CAMPOS_DO_BLOCO = ["nome", "telefone", "cpf", "cep", "rua", "numero", "complemento", "bairro", "cidade", "uf"];

  function kitEmTexto(link) {
    var nome = nomeDoKit(link.qtde, link.grupo || null);
    if (!nome) return null;
    return nome + (link.preco !== null && link.preco !== undefined ? " · " + emReais(link.preco) : "");
  }

  function gerarBloco(campos, hoje, semEstoque, links) {
    var valor = function (chave) { return limparValor(campos[chave]); };
    var linhas = [MARCA_DO_BLOCO];
    CAMPOS_DO_BLOCO.forEach(function (c) { if (valor(c)) linhas.push(c + ": " + valor(c)); });
    if (valor("link_id")) {
      var link = (links || []).filter(function (l) { return String(l.id) === valor("link_id"); })[0];
      if (link && kitEmTexto(link)) linhas.push("kit: " + kitEmTexto(link));
      linhas.push("codigo do kit: " + valor("link_id"));
    }
    var dia = diaDaEntrega(valor("dia_tipo"), valor("dia_data"), hoje);
    if (dia.texto) {
      linhas.push("dia: " + dia.texto);
      if (dia.data) linhas.push("data: " + dia.data);
      if (TURNOS[valor("turno")]) linhas.push("turno: " + valor("turno"));
    }
    if (semEstoque) linhas.push("estoque: indisponivel");
    return linhas.join("\n");
  }

  api.separarEndereco = separarEndereco; api.nomeDoKit = nomeDoKit; api.emReais = emReais; api.kits = kits;
  api.diaDaEntrega = diaDaEntrega; api.primeiroNome = primeiroNome; api.preencherModelo = preencherModelo;
  api.fechamento = fechamento; api.gerarBloco = gerarBloco; api.normalizarTelefone = normalizarTelefone;
  if (typeof module === "object" && module.exports) module.exports = api;
  else raiz.Agendamento = api;
})(this);
