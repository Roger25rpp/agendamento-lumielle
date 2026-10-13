/* Deixa o aplicativo funcionar sem internet: guarda os arquivos no celular na primeira abertura.
   VERSAO muda sozinha (ferramentas/atualizar.py) quando algum arquivo muda; aí o celular baixa a versão nova.
   As imagens da Galeria ficam numa caixa à parte: numa versão nova, só as imagens novas são baixadas. */
var VERSAO = "02d1cc102253";
var ARQUIVOS = ["./", "index.html", "estilo.css", "logica.js", "app.js", "telas.js", "cobertura.js", "dados.js",
                "manifest.webmanifest", "icone-192.png", "icone-512.png",
                "fonts/roboto-400.woff2", "fonts/roboto-500.woff2", "fonts/roboto-700.woff2"];
var CAIXA = "agendamento-" + VERSAO, CAIXA_GALERIA = "agendamento-galeria";

try { importScripts("dados.js"); } catch (e) { self.DADOS = null; }
var IMAGENS = ((self.DADOS && self.DADOS.imagens) || []).map(function (i) {
  return new URL(i.arquivo, self.registration.scope).href;
});

function guardarImagens() {
  return caches.open(CAIXA_GALERIA).then(function (caixa) {
    return caixa.keys().then(function (guardadas) {
      var ja = guardadas.map(function (r) { return r.url; });
      return Promise.all(guardadas.filter(function (r) { return IMAGENS.indexOf(r.url) < 0; })
                                  .map(function (r) { return caixa.delete(r); }))
        .then(function () { return caixa.addAll(IMAGENS.filter(function (u) { return ja.indexOf(u) < 0; })); });
    });
  });
}

self.addEventListener("install", function (evento) {
  evento.waitUntil(caches.open(CAIXA).then(function (caixa) {
    return caixa.addAll(ARQUIVOS.map(function (a) { return new Request(a, { cache: "reload" }); }));
  }).then(guardarImagens).then(function () { return self.skipWaiting(); }));
});

self.addEventListener("activate", function (evento) {
  evento.waitUntil(caches.keys().then(function (nomes) {
    return Promise.all(nomes.filter(function (n) { return n !== CAIXA && n !== CAIXA_GALERIA; })
                            .map(function (n) { return caches.delete(n); }));
  }).then(function () { return self.clients.claim(); }));
});

self.addEventListener("fetch", function (evento) {
  if (evento.request.method !== "GET") return;
  evento.respondWith(caches.match(evento.request, { ignoreSearch: true }).then(function (guardado) {
    return guardado || fetch(evento.request);
  }));
});
