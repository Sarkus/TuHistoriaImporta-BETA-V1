// Servidor de "Tu historia importa, no la cierres – the game"
// Sin dependencias: solo Node 18+.  Uso:  node server.js   →  http://localhost:3000
// Hace 3 cosas: sirve el juego (index.html), reenvía mensajes entre jugadores (WebSocket en /ws)
// y, si definís ANTHROPIC_API_KEY, conecta a Atún con la IA (/api/atun).
const http = require('http'), https = require('https'), fs = require('fs'), path = require('path'), crypto = require('crypto');
const PORT = process.env.PORT || 3000;
const KEY = process.env.ANTHROPIC_API_KEY || '';
const MODEL = process.env.ATUN_MODEL || 'claude-haiku-5-5';
const SYS = "Sos Atún, un gato gris con lentes que guía a las personas que juegan «Tu historia importa, no la cierres – the game», un truco con gatitos de una campaña de salud mental de la Universidad Nacional de Moreno (Grupo Estrés Gráfico). Respondé siempre en español rioplatense, con calidez y humor suave, en un máximo de 3 oraciones cortas, sin listas ni formato especial.\nTu trabajo: explicar las reglas, dar consejos de juego y contar cómo funciona el juego. Reglas de este juego: cada ronda es una mano de truco con 3 cartas por jugador y hasta 3 bazas; gana la ronda quien gana 2 bazas (si hay parda decide quien ganó la primera baza; si empatan todas, gana el mano). Quien gana la ronda se lleva 1 de las 6 piezas del rompecabezas; quien la pierde elige una carta temática para charlar (Romper el hielo, Bancar o Mito y Posta). Gana quien primero completa las 6 piezas y arma «Tu historia importa, no la cierres»; al final aparece un QR con canales de ayuda. Jerarquía de cartas de mayor a menor: ancho de espada, ancho de basto, 7 de espada, 7 de oro, los 3, los 2, 1 de oro y 1 de copa, los 12, los 11, los 10, 7 de copa y 7 de basto, los 6, los 5, los 4. El truco se puede subir a retruco y vale cuatro; el rival responde quiero, no quiero (el que cantó se lleva la ronda) o sube. El envido solo se canta antes de tirar la primera carta: dos cartas del mismo palo suman 20 más sus valores (10, 11 y 12 valen 0), si no vale la carta más alta; en esta versión es un desafío aparte que no da piezas. Hay tres dificultades: Demostración, Nivelado y Pelea contra vos mismo. Se puede invitar a un amigo con un link o un QR.\nUsá el estado de la partida que te pasan para aconsejar sobre la jugada. No inventes reglas que no estén acá. Si preguntan algo ajeno al juego, respondé breve y llevá la charla de vuelta al juego.\nSi alguien cuenta que la está pasando mal, que se siente solo o que piensa en hacerse daño, respondé con mucha calidez, sin dar diagnósticos ni consejos médicos, invitá a hablar con alguien de confianza y mencioná la Línea 135 (CABA y GBA) y el QR del juego, que lleva a nuestro Instagram.\nTambién existe el Modo UNO (2, 3, 4 u 8 jugadores, solo con Gatobots o en salas online con link o QR): reglas básicas del UNO de 108 cartas; se juega una carta del mismo color, número o símbolo que la de arriba; salto, reversa, +2, comodín y comodín +4; si no podés jugar robás una carta; decí ¡UNO! antes de tirar tu penúltima carta o robás 2; quien se queda sin cartas gana la ronda y se lleva una pieza, y quien se queda con más cartas elige una carta del sobre para charlar. Se pueden apilar +2 sobre +2 y +4 sobre +4: si no podés apilar, robás todas las cartas acumuladas.";
const GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';
const rooms = new Map();           // nombre de mesa -> Set de sockets
const hits = new Map();            // ip -> [timestamps] (límite de uso de la IA)

function json(res, code, obj) { res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8' }); res.end(JSON.stringify(obj)); }

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  if (url.pathname === '/health') return json(res, 200, { ok: true, ia: !!KEY });
  if (url.pathname === '/api/atun' && req.method === 'POST') return atun(req, res);
  if (url.pathname === '/' || url.pathname === '/index.html') {
    return fs.readFile(path.join(__dirname, 'index.html'), (e, d) => {
      if (e) return json(res, 500, { error: 'falta index.html' });
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }); res.end(d);
    });
  }
  json(res, 404, { error: 'no encontrado' });
});

function atun(req, res) {
  if (!KEY) return json(res, 503, { error: 'IA no configurada' });
  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '?';
  const now = Date.now(), arr = (hits.get(ip) || []).filter(t => now - t < 60000);
  if (arr.length >= 12) return json(res, 429, { error: 'demasiadas preguntas, esperá un minuto' });
  arr.push(now); hits.set(ip, arr);
  let body = '';
  req.on('data', c => { body += c; if (body.length > 4000) req.destroy(); });
  req.on('end', () => {
    let q, ctx;
    try { const j = JSON.parse(body); q = String(j.q || '').slice(0, 300); ctx = String(j.ctx || '').slice(0, 800); } catch (e) { return json(res, 400, { error: 'pedido inválido' }); }
    if (!q) return json(res, 400, { error: 'falta la pregunta' });
    const payload = JSON.stringify({ model: MODEL, max_tokens: 300, system: SYS, messages: [{ role: 'user', content: 'Estado del juego: ' + ctx + '\n\nPregunta del jugador: ' + q }] });
    const r = https.request({ hostname: 'api.anthropic.com', path: '/v1/messages', method: 'POST', headers: { 'content-type': 'application/json', 'x-api-key': KEY, 'anthropic-version': '2023-06-01', 'content-length': Buffer.byteLength(payload) } }, a => {
      let d = ''; a.on('data', c => d += c);
      a.on('end', () => { try { const j = JSON.parse(d); const text = (j.content || []).map(x => x.text || '').join('').trim(); if (!text) throw 0; json(res, 200, { text }); } catch (e) { json(res, 502, { error: 'la IA no respondió' }); } });
    });
    r.on('error', () => json(res, 502, { error: 'sin conexión con la IA' }));
    r.end(payload);
  });
}

// ---- WebSocket mínimo (RFC 6455), solo texto
function frame(str) {
  const p = Buffer.from(str), n = p.length; let h;
  if (n < 126) h = Buffer.from([0x81, n]); else if (n < 65536) { h = Buffer.alloc(4); h[0] = 0x81; h[1] = 126; h.writeUInt16BE(n, 2); } else { h = Buffer.alloc(10); h[0] = 0x81; h[1] = 127; h.writeBigUInt64BE(BigInt(n), 2); }
  return Buffer.concat([h, p]);
}
server.on('upgrade', (req, socket) => {
  const url = new URL(req.url, 'http://x');
  const key = req.headers['sec-websocket-key'];
  if (url.pathname !== '/ws' || !key) return socket.destroy();
  const room = (url.searchParams.get('room') || 'mesa').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 40) || 'mesa';
  const set = rooms.get(room) || new Set();
  if (set.size >= 8) return socket.destroy();
  socket.write('HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ' + crypto.createHash('sha1').update(key + GUID).digest('base64') + '\r\n\r\n');
  set.add(socket); rooms.set(room, set);
  let buf = Buffer.alloc(0), msg = [];
  const close = () => { set.delete(socket); if (!set.size) rooms.delete(room); socket.destroy(); };
  socket.on('data', chunk => {
    buf = Buffer.concat([buf, chunk]);
    for (;;) {
      if (buf.length < 2) return;
      const fin = buf[0] & 0x80, op = buf[0] & 15, masked = buf[1] & 0x80; let len = buf[1] & 127, off = 2;
      if (len === 126) { if (buf.length < 4) return; len = buf.readUInt16BE(2); off = 4; }
      else if (len === 127) { if (buf.length < 10) return; len = Number(buf.readBigUInt64BE(2)); off = 10; }
      if (len > 200000) return close();
      if (buf.length < off + (masked ? 4 : 0) + len) return;
      let payload = buf.slice(off + (masked ? 4 : 0), off + (masked ? 4 : 0) + len);
      if (masked) { const m = buf.slice(off, off + 4); payload = Buffer.from(payload.map((b, i) => b ^ m[i % 4])); }
      buf = buf.slice(off + (masked ? 4 : 0) + len);
      if (op === 8) return close();
      if (op === 9) { socket.write(Buffer.concat([Buffer.from([0x8a, payload.length]), payload])); continue; }
      if (op === 1 || op === 0) {
        msg.push(payload);
        if (fin) { const text = Buffer.concat(msg).toString(); msg = []; const out = frame(text); for (const s of set) if (s !== socket) s.write(out); }
      }
    }
  });
  socket.on('close', close); socket.on('error', close);
});

server.listen(PORT, () => console.log('🐱 Juego listo en http://localhost:' + PORT + (KEY ? '  (Atún con IA activado)' : '  (Atún sin IA: falta ANTHROPIC_API_KEY)')));
