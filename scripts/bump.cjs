// Sobe a versão dos três pacotes juntos (e a dependência interna na data-grid).
// Não precisa de git.
//   npm run bump -- patch     0.1.0 -> 0.1.1  (correções)
//   npm run bump -- minor     0.1.0 -> 0.2.0  (recursos novos)
//   npm run bump -- major     0.1.0 -> 1.0.0  (mudanças que quebram)
//   npm run bump -- 0.3.0     versão exata
const fs = require('fs');
const path = require('path');

const PKGS = ['data-grid', 'pivot-grid', 'tree-list'];
const root = path.join(__dirname, '..');
const file = (p) => path.join(root, 'packages', p, 'package.json');
const read = (p) => JSON.parse(fs.readFileSync(file(p), 'utf8'));

const arg = process.argv[2];
const current = read('data-grid').version;
const m = /^(\d+)\.(\d+)\.(\d+)$/.exec(current);
if (!m) throw new Error('Versão atual inválida: ' + current);
let [maj, min, pat] = m.slice(1).map(Number);

let next;
if (arg === 'patch') next = `${maj}.${min}.${pat + 1}`;
else if (arg === 'minor') next = `${maj}.${min + 1}.0`;
else if (arg === 'major') next = `${maj + 1}.0.0`;
else if (/^\d+\.\d+\.\d+$/.test(arg || '')) next = arg;
else {
  console.error('Uso: npm run bump -- patch | minor | major | X.Y.Z   (versão atual: ' + current + ')');
  process.exit(1);
}

for (const p of PKGS) {
  const j = read(p);
  j.version = next;
  for (const deps of [j.dependencies, j.peerDependencies, j.devDependencies]) {
    if (deps && deps['@brunomouradev/data-grid']) deps['@brunomouradev/data-grid'] = next;
  }
  fs.writeFileSync(file(p), JSON.stringify(j, null, 2) + '\n');
}
console.log(`Versão: ${current} -> ${next} (${PKGS.map((p) => '@brunomouradev/' + p).join(', ')})`);
console.log('Agora rode: npm install  (atualiza o package-lock)  e depois  npm run release');
