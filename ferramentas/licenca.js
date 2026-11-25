#!/usr/bin/env node
// Ferramenta do VENDEDOR (não vai dentro do instalador).
//   node ferramentas/licenca.js chaves
//   node ferramentas/licenca.js emitir --cliente "Academia X" [--ate 2027-12-31] [--maquina ABCD-1234-EF56]
//   node ferramentas/licenca.js conferir <chave>
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const L = require('../license.js');
const root = path.join(__dirname, '..');
const privFile = path.join(root, 'licenca-privada.pem');
const arg = (n) => { const i = process.argv.indexOf('--' + n); return i > 0 ? process.argv[i + 1] : null; };
const cmd = process.argv[2];
if (cmd === 'chaves') {
  if (fs.existsSync(privFile)) { console.error('Já existe licenca-privada.pem. Apague-o só se quiser invalidar TODAS as licenças já emitidas.'); process.exit(1); }
  const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');
  fs.writeFileSync(privFile, privateKey.export({ type: 'pkcs8', format: 'pem' }), { mode: 0o600 });
  const pub = publicKey.export({ type: 'spki', format: 'pem' });
  fs.writeFileSync(path.join(root, 'license-pub.js'), "// Chave pública de licenças (gerada por ferramentas/licenca.js chaves)\nmodule.exports = " + JSON.stringify(pub) + ';\n');
  console.log('Pronto. Guarde licenca-privada.pem em local seguro (e faça backup). NUNCA publique esse arquivo.\nA chave pública foi gravada em license-pub.js: gere os instaladores depois disso.');
} else if (cmd === 'emitir') {
  const cli = arg('cliente');
  if (!cli) { console.error('Informe --cliente "Nome"'); process.exit(1); }
  if (!fs.existsSync(privFile)) { console.error('Rode antes: node ferramentas/licenca.js chaves'); process.exit(1); }
  const data = { cli, emi: new Date().toISOString().slice(0, 10) };
  if (arg('ate')) data.exp = arg('ate');
  if (arg('maquina')) data.maq = arg('maquina').toUpperCase();
  console.log(L.createLicense(fs.readFileSync(privFile, 'utf8'), data));
} else if (cmd === 'conferir') {
  const pub = require('../license-pub.js');
  console.log(JSON.stringify(L.verifyKey(process.argv[3], pub), null, 2));
} else console.log('Uso: chaves | emitir --cliente "X" [--ate AAAA-MM-DD] [--maquina CODIGO] | conferir <chave>');
