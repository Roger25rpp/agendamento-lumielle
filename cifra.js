/* Abre as mensagens (Respostas e Objeções) que o ferramentas/exportar_do_crm.py embaralhou com a senha do Rogerio
   (pedido de 24/10/2026). O app é público; sem a senha, o pacote é só um monte de letras.

   Mesmo esquema do Python, só com o que o navegador já tem (Web Crypto), sem biblioteca de fora:
   - chave de 64 bytes = PBKDF2-SHA256(senha normalizada, SAL, iteracoes): 32 para embaralhar, 32 para conferir;
   - texto = dados XOR (HMAC-SHA256(chave1, nonce || bloco 0, 1, 2...));
   - selo = HMAC-SHA256(chave2, "v1" || nonce || dados): senha errada ou pacote alterado não abre. */
(function (raiz) {
  "use strict";
  var SAL = "agendamento-lumielle:mensagens:v1";
  var sutil = raiz.crypto && raiz.crypto.subtle;

  function bytes(texto) { return new TextEncoder().encode(texto); }
  function deBase64(b64) {
    var bin = atob(b64), saida = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) saida[i] = bin.charCodeAt(i);
    return saida;
  }
  function paraBase64(dados) {
    var bin = "";
    for (var i = 0; i < dados.length; i++) bin += String.fromCharCode(dados[i]);
    return btoa(bin);
  }
  function juntar(partes) {
    var total = partes.reduce(function (n, p) { return n + p.length; }, 0), saida = new Uint8Array(total), pos = 0;
    partes.forEach(function (p) { saida.set(p, pos); pos += p.length; });
    return saida;
  }
  // Igual ao Python: sem espaços nas pontas, espaços repetidos viram um, tudo minúsculo (o celular põe maiúscula sozinho)
  function normalizar(senha) {
    return String(senha || "").normalize("NFC").trim().replace(/\s+/g, " ").toLowerCase();
  }
  function disponivel() { return !!sutil; }

  function derivar(senha, iteracoes) {
    return sutil.importKey("raw", bytes(normalizar(senha)), "PBKDF2", false, ["deriveBits"]).then(function (k) {
      return sutil.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: bytes(SAL), iterations: iteracoes }, k, 512);
    }).then(function (bits) { return new Uint8Array(bits); });
  }
  function hmac(chave) {
    return sutil.importKey("raw", chave, { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
  }

  // chave: os 64 bytes de derivar(). Devolve o objeto das mensagens; senha errada -> erro "senha".
  function abrir(pacote, chave) {
    var nonce = deBase64(pacote.nonce), dados = deBase64(pacote.dados), selo = deBase64(pacote.selo);
    return Promise.all([hmac(chave.slice(0, 32)), hmac(chave.slice(32, 64))]).then(function (k) {
      return sutil.verify("HMAC", k[1], selo, juntar([bytes("v1"), nonce, dados])).then(function (ok) {
        if (!ok) throw new Error("senha");
        var blocos = [];
        for (var i = 0; i * 32 < dados.length; i++) {
          var contador = new Uint8Array([i >>> 24 & 255, i >>> 16 & 255, i >>> 8 & 255, i & 255]);
          blocos.push(sutil.sign("HMAC", k[0], juntar([nonce, contador])));
        }
        return Promise.all(blocos);
      });
    }).then(function (blocos) {
      var claro = new Uint8Array(dados.length);
      blocos.forEach(function (b, i) {
        b = new Uint8Array(b);
        for (var j = 0; j < 32 && i * 32 + j < dados.length; j++) claro[i * 32 + j] = dados[i * 32 + j] ^ b[j];
      });
      return JSON.parse(new TextDecoder().decode(claro));
    });
  }

  var Cifra = { disponivel: disponivel, normalizar: normalizar, derivar: derivar, abrir: abrir,
                paraBase64: paraBase64, deBase64: deBase64 };
  raiz.Cifra = Cifra;
  if (typeof module !== "undefined") module.exports = Cifra;
})(typeof window !== "undefined" ? window : globalThis);
