// 手元のテスト用：中継（sb-push）と 同じ op を まねる。node tests/mock-relay.js → http://127.0.0.1:9100
// GET /log で これまでの call（よびだし）を見られる
const http = require("http");
const dev = {}, pend = {}, log = [], waits = {};
const ok = v => typeof v === "string" && /^[A-Za-z0-9_-]{16,64}$/.test(v);
http.createServer((req, res) => {
  const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "content-type", "Access-Control-Allow-Methods": "POST, GET, OPTIONS", "Content-Type": "application/json" };
  if (req.method === "OPTIONS") { res.writeHead(204, cors); return res.end(); }
  if (req.method === "GET") { res.writeHead(200, cors); return res.end(JSON.stringify({ log, dev: Object.keys(dev).length })); }
  let s = ""; req.on("data", d => s += d); req.on("end", () => {
    let b = {}; try { b = JSON.parse(s); } catch (e) { }
    const me = ok(b.id) && dev[b.id] && dev[b.id].secret === b.secret ? dev[b.id] : null;
    let out = [400, { error: "op" }];
    if (b.op === "reg") { if (!ok(b.id) || !ok(b.secret)) out = [400, { error: "bad id" }]; else if (dev[b.id] && dev[b.id].secret !== b.secret) out = [403, { error: "secret" }]; else { dev[b.id] = { secret: b.secret, names: b.names || [], expo: b.expo || (dev[b.id] && dev[b.id].expo) || null }; out = [200, { ok: true }]; } }
    else if (b.op === "accept") { if (!me) out = [403, { error: "who" }]; else { (pend[b.to] = pend[b.to] || {})[b.id] = b.names && b.names.length ? b.names : me.names; out = [200, { ok: true }]; } }
    else if (b.op === "pending") { if (!me) out = [403, { error: "who" }]; else { const p = pend[b.id] || {}; delete pend[b.id]; out = [200, { ok: true, list: Object.entries(p).map(([pid, names]) => ({ pid, names })) }]; } }
    else if (b.op === "wait" || b.op === "peek" || b.op === "unwait") {
      if (!me) out = [403, { error: "who" }];
      else if (b.op === "unwait") { delete waits[b.id]; out = [200, { ok: true }]; }
      else {
        if (b.op === "wait") waits[b.id] = { to: b.to || [], room: b.room, n: b.n | 0, names: b.names || [], at: Date.now() };
        const others = Object.entries(waits).filter(([h, w]) => h !== b.id && w.to.includes(b.id) && Date.now() - w.at < 20000 && (b.op === "peek" || (b.to || []).includes(h))).map(([h, w]) => ({ id: h, room: w.room, n: w.n, names: w.names }));
        out = [200, { ok: true, others }];
      }
    }
    else if (b.op === "call") { if (!me) out = [403, { error: "who" }]; else { log.push({ from: b.id, to: b.to, body: b.body, url: b.url }); out = [200, dev[b.to] && dev[b.to].expo ? { ok: true } : { ok: false, reason: "nosub" }]; } }
    res.writeHead(out[0], cors); res.end(JSON.stringify(out[1]));
  });
}).listen(9100, "127.0.0.1", () => console.log("mock relay 9100"));
