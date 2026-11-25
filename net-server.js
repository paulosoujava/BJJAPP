// Servidor na rede local (Wi-Fi do ginásio): mesas extras (notebooks/tablets) e página ao vivo para o público.
// Sem dependências: só http/os/crypto do Node. O programa principal é sempre a "fonte da verdade".
const http = require('http');
const os = require('os');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Campos que as mesas remotas podem ver (nada de histórico, nem dados de inscrição online).
const SLIM_KEYS = ['fighters', 'tempo', 'modo', 'brackets', 'people', 'sig', 'gen', 'tatames', 'tempoModo', 'temposFaixa', 'autoPen', 'rr3',
  'divIdade', 'divSexo', 'sepEquipe', 'customBelts', 'evento'];
function slimState(S) {
  const out = {};
  if (!S) return out;
  SLIM_KEYS.forEach((k) => { if (S[k] !== undefined) out[k] = S[k]; });
  return out;
}

function lanIPs() {
  const out = [];
  const nets = os.networkInterfaces();
  Object.keys(nets).forEach((n) => (nets[n] || []).forEach((i) => {
    if (i.family === 'IPv4' && !i.internal) out.push(i.address);
  }));
  // Endereços de rede doméstica primeiro (192.168.x.x, 10.x.x.x).
  return out.sort((a, b) => (/^(192\.168|10\.)/.test(b) ? 1 : 0) - (/^(192\.168|10\.)/.test(a) ? 1 : 0));
}

function newPin() { return String(crypto.randomInt(0, 10000)).padStart(4, '0'); }

function createNet(opts) {
  const appDir = opts.appDir;
  let server = null, port = 0, rev = 0, payload = null, pin = newPin();
  const api = {
    onMesa: null,
    get pin() { return pin; },
    regenPin() { pin = newPin(); return pin; },
    get running() { return !!server; },
    get port() { return port; },
    ips: lanIPs,
    setState(p) { payload = p; rev++; },
    start(preferred) {
      return new Promise((resolve, reject) => {
        if (server) return resolve({ port });
        const tryPort = (p, left) => {
          const s = http.createServer(handle);
          s.once('error', (e) => {
            if (e.code === 'EADDRINUSE' && left > 0) tryPort(p + 1, left - 1); else reject(e);
          });
          s.listen(p, '0.0.0.0', () => { server = s; port = s.address().port; resolve({ port }); });
        };
        tryPort(preferred === undefined ? 7654 : preferred, 20);
      });
    },
    stop() {
      return new Promise((resolve) => {
        if (!server) return resolve();
        const s = server; server = null;
        s.close(() => resolve());
        if (s.closeAllConnections) s.closeAllConnections();
      });
    }
  };

  function send(res, code, body, type) {
    res.writeHead(code, { 'Content-Type': type || 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*' });
    res.end(typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body));
  }
  function file(res, name) {
    try { send(res, 200, fs.readFileSync(path.join(appDir, name)), 'text/html; charset=utf-8'); }
    catch (e) { send(res, 404, { error: 'arquivo' }); }
  }
  function authed(url, req) { return (url.searchParams.get('pin') || req.headers['x-pin'] || '') === pin; }

  function handle(req, res) {
    let url;
    try { url = new URL(req.url, 'http://x'); } catch (e) { return send(res, 400, { error: 'url' }); }
    if (req.method === 'OPTIONS') return send(res, 204, '');
    const p = url.pathname;
    if (req.method === 'GET' && p === '/') return file(res, 'index.html');
    if (req.method === 'GET' && (p === '/live' || p === '/live/')) return file(res, 'live.html');
    if (req.method === 'GET' && p === '/live.json') {
      return send(res, 200, payload && payload.live ? payload.live : { vazio: true });
    }
    if (p === '/api/state' && req.method === 'GET') {
      if (!authed(url, req)) return send(res, 401, { error: 'pin' });
      const since = +url.searchParams.get('since') || -1;
      if (!payload) return send(res, 200, { rev, empty: true });
      if (since === rev) return send(res, 200, { rev, same: true });
      return send(res, 200, { rev, S: slimState(payload.S) });
    }
    if (p === '/api/mesa' && req.method === 'POST') {
      if (!authed(url, req)) return send(res, 401, { error: 'pin' });
      let size = 0; const chunks = [];
      req.on('data', (c) => { size += c.length; if (size > 4e6) req.destroy(); else chunks.push(c); });
      req.on('end', () => {
        let b;
        try { b = JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch (e) { return send(res, 400, { error: 'json' }); }
        if (!api.onMesa) return send(res, 503, { error: 'indisponivel' });
        Promise.resolve(api.onMesa(b)).then((r) => send(res, 200, r || { ok: true }), () => send(res, 500, { error: 'falha' }));
      });
      return;
    }
    send(res, 404, { error: 'nao-encontrado' });
  }
  return api;
}

module.exports = { createNet, slimState, lanIPs };
