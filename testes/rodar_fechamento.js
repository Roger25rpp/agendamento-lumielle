// Recebe os casos (JSON na entrada) e devolve o resultado do logica.js para cada um.
const A = require("../app/logica.js");
let entrada = "";
process.stdin.on("data", (p) => (entrada += p));
process.stdin.on("end", () => {
  const c = JSON.parse(entrada);
  process.stdout.write(JSON.stringify({
    enderecos: c.enderecos.map((t) => A.separarEndereco(t)),
    fechamentos: c.fechamentos.map((f) => A.fechamento(f.campos, c.links, f.situacao, c.modelos, f.hoje)),
    blocos: c.fechamentos.map((f) => A.gerarBloco(f.campos, f.hoje, f.sem_estoque, c.links)),
    dias: c.dias.map((d) => A.diaDaEntrega(d[0], d[1], d[2])),
    kits: c.kitsNomes.map((k) => A.nomeDoKit(k[0], k[1])),
    reais: c.reais.map((v) => A.emReais(v)),
    nomes: c.nomes.map((n) => A.primeiroNome(n)),
  }));
});
