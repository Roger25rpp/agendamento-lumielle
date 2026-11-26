// Recebe os casos (JSON na entrada) e devolve o resultado do app/situacoes.js para cada um.
const S = require("../app/situacoes.js");
let entrada = "";
process.stdin.on("data", (p) => (entrada += p));
process.stdin.on("end", () => {
  const c = JSON.parse(entrada);
  process.stdout.write(JSON.stringify({
    preenchidos: c.preencher.map((x) => S.preencher(x.texto, x.campos, x.datas, x.hoje)),
    montados: c.montar.map((x) => S.montar(c.respostas, x.situacao, x.codigo, x.campos, x.hoje)),
    kits: c.links.map((l) => S.kitDoLink(l)),
  }));
});
