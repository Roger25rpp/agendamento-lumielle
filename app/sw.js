/* Deixa o aplicativo funcionar sem internet: guarda os arquivos no celular na primeira abertura.
   VERSAO muda sozinha (ferramentas/atualizar.py) quando algum arquivo muda; aí o celular baixa a versão nova. */
var VERSAO = "f80a0780595b";
var ARQUIVOS = ["./", "index.html", "estilo.css", "logica.js", "app.js", "cobertura.js", "manifest.webmanifest",
                "icone-192.png", "icone-512.png", "fonts/roboto-400.woff2", "fonts/roboto-500.woff2", "fonts/roboto-700.woff2"];

self.addEventListener("install", function (evento) {
  evento.waitUntil(caches.open("agendamento-" + VERSAO).then(function (cache) {
    return cache.addAll(ARQUIVOS.map(function (a) { return new Request(a, { cache: "reload" }); }));
  }).then(function () { return self.skipWaiting(); }));
});

self.addEventListener("activate", function (evento) {
  evento.waitUntil(caches.keys().then(function (nomes) {
    return Promise.all(nomes.filter(function (n) { return n !== "agendamento-" + VERSAO; })
                            .map(function (n) { return caches.delete(n); }));
  }).then(function () { return self.clients.claim(); }));
});

self.addEventListener("fetch", function (evento) {
  if (evento.request.method !== "GET") return;
  evento.respondWith(caches.match(evento.request, { ignoreSearch: true }).then(function (guardado) {
    return guardado || fetch(evento.request);
  }));
});
