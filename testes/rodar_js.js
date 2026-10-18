// Recebe uma lista de textos (JSON na entrada) e devolve o resultado do logica.js para cada um.
const A = require("../app/logica.js");
global.window = {};
require("../app/cobertura.js");
require("../app/ddd.js");
const faixas = global.window.COBERTURA.faixas;
const ddds = global.window.DDDS;
let entrada = "";
process.stdin.on("data", (p) => (entrada += p));
process.stdin.on("end", () => {
  const saida = JSON.parse(entrada).map((texto) => {
    const d = A.formatar(texto);
    return { ...d, cobertura: A.verificar(faixas, d.cep), cpf_tela: A.mostrarCpf(d.cpf), cep_tela: A.mostrarCep(d.cep),
             ddd: A.dddNaCobertura(ddds, d.telefone) };
  });
  process.stdout.write(JSON.stringify(saida));
});
