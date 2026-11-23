// Ferramentas de desenvolvimento (Vite 5, Vitest 2) exigem Node 18+.
// Quem só USA os pacotes publicados (ex.: Angular 11 no Node 14) não precisa disso.
var major = parseInt(process.versions.node.split('.')[0], 10);
if (major < 18) {
  console.error(
    '\n[brunomouradev-ui] Este projeto (build, testes e playground) precisa do Node 18 ou superior.\n' +
    'Versão atual: ' + process.version + '\n\n' +
    'Com nvm-windows:  nvm use 20.19.0\n' +
    'Depois rode o comando de novo.\n\n' +
    'Obs.: os pacotes publicados funcionam em projetos com Node 14 (ex.: Angular 11).\n'
  );
  process.exit(1);
}
