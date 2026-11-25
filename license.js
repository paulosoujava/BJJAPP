// Licença offline do BJJ Arena: chave assinada com Ed25519 (só quem tem a chave privada emite licenças).
// Sem chave pública configurada (license-pub.js vazio), o programa roda livre, sem teste nem bloqueio.
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');

const TRIAL_DAYS = 14;
const DAY = 86400000;
const b64u = (b) => Buffer.from(b).toString('base64url');
const unb64u = (s) => Buffer.from(String(s), 'base64url');

function machineCode() {
  const raw = [os.hostname(), os.platform(), os.arch(), os.userInfo().username, (os.cpus()[0] || {}).model || ''].join('|');
  const h = crypto.createHash('sha256').update('bjjarena|' + raw).digest('hex').toUpperCase();
  return h.slice(0, 4) + '-' + h.slice(4, 8) + '-' + h.slice(8, 12);
}

function verifyKey(key, pubPem, now, machine) {
  try {
    const [p, s] = String(key || '').trim().replace(/\s+/g, '').split('.');
    if (!p || !s) return { ok: false, error: 'formato' };
    const okSig = crypto.verify(null, Buffer.from(p), crypto.createPublicKey(pubPem), unb64u(s));
    if (!okSig) return { ok: false, error: 'assinatura' };
    const d = JSON.parse(unb64u(p).toString('utf8'));
    if (d.maq && d.maq !== (machine || machineCode())) return { ok: false, error: 'maquina', payload: d };
    if (d.exp && (now || Date.now()) > Date.parse(d.exp + 'T23:59:59')) return { ok: false, error: 'expirada', payload: d };
    return { ok: true, payload: d };
  } catch (e) { return { ok: false, error: 'formato' }; }
}

function createLicense(privPem, data) {
  const p = b64u(JSON.stringify(data));
  return p + '.' + b64u(crypto.sign(null, Buffer.from(p), crypto.createPrivateKey(privPem)));
}

function readJson(f) { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch (e) { return null; } }
function mac(v) { return crypto.createHash('sha256').update('trial|' + v + '|bjj-arena').digest('hex').slice(0, 16); }

// status: off (sem licenciamento) | trial | licensed | expired
function status(dir, pubPem, now) {
  now = now || Date.now();
  if (!pubPem) return { mode: 'off', machine: machineCode() };
  try { fs.mkdirSync(dir, { recursive: true }); } catch (e) {}
  const lf = path.join(dir, 'license.json'), tf = path.join(dir, 'trial.json');
  const lic = readJson(lf);
  if (lic && lic.key) {
    const v = verifyKey(lic.key, pubPem, now);
    if (v.ok) return { mode: 'licensed', cliente: v.payload.cli || '', expira: v.payload.exp || null, machine: machineCode() };
    if (v.error === 'expirada') return { mode: 'expired', reason: 'licença vencida', cliente: v.payload.cli || '', machine: machineCode() };
  }
  let t = readJson(tf);
  if (!t || t.h !== mac(String(t.start) + ':' + String(t.last)) || !(t.start > 0)) {
    t = { start: now, last: now };
    t.h = mac(t.start + ':' + t.last);
  }
  let rolledBack = now < t.last - DAY; // relógio voltado para estender o teste
  if (!rolledBack && now > t.last) { t.last = now; t.h = mac(t.start + ':' + t.last); }
  try { fs.writeFileSync(tf, JSON.stringify(t)); } catch (e) {}
  const left = Math.ceil((t.start + TRIAL_DAYS * DAY - now) / DAY);
  if (rolledBack || left <= 0) return { mode: 'expired', reason: rolledBack ? 'relógio alterado' : 'teste encerrado', machine: machineCode() };
  return { mode: 'trial', days: left, machine: machineCode() };
}

function activate(dir, key, pubPem, now) {
  if (!pubPem) return { ok: false, error: 'sem-licenciamento' };
  const v = verifyKey(key, pubPem, now);
  if (!v.ok) return v;
  try { fs.mkdirSync(dir, { recursive: true }); fs.writeFileSync(path.join(dir, 'license.json'), JSON.stringify({ key: String(key).trim().replace(/\s+/g, '') })); } catch (e) { return { ok: false, error: 'gravar' }; }
  return { ok: true, status: status(dir, pubPem, now) };
}

module.exports = { machineCode, verifyKey, createLicense, status, activate, TRIAL_DAYS };
