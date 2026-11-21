// No Mac, "npm start" abre o Electron "puro" (nome e ícone do Electron).
// Este script troca nome e ícone só para o modo de desenvolvimento.
// O app instalado (.dmg) já sai com o nome e o ícone certos.
if (process.platform !== 'darwin') process.exit(0);
const { execSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
try {
  const root = path.join(__dirname, '..');
  const app = path.join(root, 'node_modules', 'electron', 'dist', 'Electron.app');
  if (!fs.existsSync(app)) process.exit(0);
  const plist = path.join(app, 'Contents', 'Info.plist');
  for (const k of ['CFBundleName', 'CFBundleDisplayName']) {
    try { execSync(`/usr/libexec/PlistBuddy -c "Set :${k} 'BJJ Arena'" "${plist}"`); }
    catch (e) { execSync(`/usr/libexec/PlistBuddy -c "Add :${k} string 'BJJ Arena'" "${plist}"`); }
  }
  // Novo identificador: o macOS guarda o nome do Dock em cache pelo identificador antigo (com.github.Electron).
  const setKey = (k, t, v) => {
    try { execSync(`/usr/libexec/PlistBuddy -c "Set :${k} ${v}" "${plist}"`); }
    catch (e) { execSync(`/usr/libexec/PlistBuddy -c "Add :${k} ${t} ${v}" "${plist}"`); }
  };
  setKey('CFBundleIdentifier', 'string', 'br.com.bjjarena.dev');
  const png = path.join(root, 'build', 'icon.png');
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'bjj-'));
  const set = path.join(tmp, 'icon.iconset');
  fs.mkdirSync(set);
  [16, 32, 128, 256, 512].forEach((n) => {
    execSync(`sips -z ${n} ${n} "${png}" --out "${set}/icon_${n}x${n}.png"`, { stdio: 'ignore' });
    execSync(`sips -z ${n * 2} ${n * 2} "${png}" --out "${set}/icon_${n}x${n}@2x.png"`, { stdio: 'ignore' });
  });
  const icns = path.join(tmp, 'icon.icns');
  execSync(`iconutil -c icns "${set}" -o "${icns}"`);
  fs.copyFileSync(icns, path.join(app, 'Contents', 'Resources', 'electron.icns'));
  execSync(`touch "${app}"`);
  try {
    execSync(`/System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister -f -R -trusted "${app}"`, { stdio: 'ignore' });
  } catch (e) {}
  try { execSync('killall Dock', { stdio: 'ignore' }); } catch (e) {}
  console.log('BJJ Arena: nome e ícone aplicados ao modo de desenvolvimento.');
} catch (e) {
  console.log('brand-dev ignorado:', e.message);
}
