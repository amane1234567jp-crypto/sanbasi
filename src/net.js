/* ---------- 遠隔対戦：3人ぶんのビデオ通話と手の同期 ----------
   テレビ電話リバーシ（reversi/src/net.js）の しくみを 3台まで に広げたもの。
   - 部屋を作った端末が「ホスト」。招待リンク（?r=部屋）を開いた端末が「ゲスト」（2台まで）。
   - 1台のスマホで 2人が遊べる：つなぐときに「ひとり／ふたり」を伝え、ホストが色（席）を わりあてる。
   - 盤は「手の履歴」で同期する。ホストの履歴が正。ゲストの手は ホストが確かめてから 全員に配る。
   - 映像・音声は 全員どうしで直接つなぐ（ゲスト→ホスト、あとから来たゲスト→先にいたゲスト）。
   - 紹介役は PeerJS の公開サーバー。直接つながらないときの 中継（TURN）は reversi と同じ Open Relay。 */
const NET = (() => {
  const q = new URLSearchParams(location.search);
  const ps = q.get("ps");   // 確認用：?ps=127.0.0.1:9000 で手元の紹介役サーバー
  const OPT = ps ? { host: ps.split(":")[0], port: +ps.split(":")[1], path: "/", secure: false } : {};
  const STUN = [{ urls: "stun:stun.l.google.com:19302" }, { urls: "stun:stun1.l.google.com:19302" }];
  const TURN_HOST = "staticauth.openrelay.metered.ca", TURN_SECRET = "openrelayprojectsecret";
  async function turnServers() {
    try {
      const user = `${Math.floor(Date.now() / 1000) + 12 * 3600}:sanbasi`;
      const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(TURN_SECRET), { name: "HMAC", hash: "SHA-1" }, false, ["sign"]);
      const sig = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(user)));
      return [{ urls: [`turn:${TURN_HOST}:80`, `turn:${TURN_HOST}:80?transport=tcp`, `turn:${TURN_HOST}:443`, `turns:${TURN_HOST}:443?transport=tcp`], username: user, credential: btoa(String.fromCharCode(...sig)) }];
    } catch (e) { return []; }
  }
  const idOf = room => "sanbasi-rm-" + room;
  const rndId = n => { const a = new Uint8Array(n); crypto.getRandomValues(a); return Array.from(a, b => "abcdefghijkmnpqrstuvwxyz23456789"[b % 32]).join(""); };
  const DEV_KEY = "sanbasi-dev", ROOM_KEY = "sanbasi-room";
  let dev = null; try { dev = localStorage.getItem(DEV_KEY); } catch (e) { }
  if (!dev) { dev = rndId(12); try { localStorage.setItem(DEV_KEY, dev); } catch (e) { } }

  const N = {
    role: q.get("r") ? "guest" : null,   // null = 1台で遊ぶ
    room: q.get("r") || null, dev,
    peer: null, local: null, media: "",
    conns: new Map(),    // ホスト：peerId → データの線
    hostConn: null,      // ゲスト：ホストへの線
    calls: new Map(),    // peerId → 通話
    heard: new Map(),    // peerId → 最後に便りがあった時刻
    open: false, handlers: {},
    on(type, fn) { this.handlers[type] = fn; },
    get available() { return typeof Peer !== "undefined" && !!navigator.mediaDevices; },
  };
  const emit = (type, ...a) => N.handlers[type]?.(...a);

  async function camera() {
    const V = { facingMode: "user", width: { ideal: 320 }, height: { ideal: 240 }, frameRate: { ideal: 12, max: 15 } };
    const A = { echoCancellation: true, noiseSuppression: true, autoGainControl: true };
    N.local = null; N.media = "";
    for (const [c, label] of [[{ video: V, audio: A }, "both"], [{ audio: A }, "audio"], [{ video: V }, "video"]]) {
      try { N.local = await navigator.mediaDevices.getUserMedia(c); N.media = label; break; } catch (e) { /* 次をためす */ }
    }
    emit("local", N.local);
  }
  // 発熱対策（reversi と同じ）：H.264 を先に、映像の帯域に上限
  function tuneSdp(sdp) {
    try {
      const lines = sdp.split("\r\n"), h264 = [], rtxOf = {};
      lines.forEach(l => { let m = l.match(/^a=rtpmap:(\d+) H264\/90000/); if (m) h264.push(m[1]); m = l.match(/^a=fmtp:(\d+) apt=(\d+)/); if (m) rtxOf[m[2]] = m[1]; });
      const pref = h264.concat(h264.map(p => rtxOf[p]).filter(Boolean));
      let inVideo = false; const out = [];
      for (const l of lines) {
        if (l.startsWith("m=")) inVideo = l.startsWith("m=video");
        if (inVideo && l.startsWith("m=video") && pref.length) { const p = l.split(" "); out.push(p.slice(0, 3).concat(pref.filter(x => p.includes(x)), p.slice(3).filter(x => !pref.includes(x))).join(" ")); continue; }
        out.push(l);
        if (inVideo && l.startsWith("c=")) out.push("b=AS:250");
      }
      return out.join("\r\n");
    } catch (e) { return sdp; }
  }
  const CALL_OPT = { sdpTransform: tuneSdp };
  function watchCall(call) {
    const old = N.calls.get(call.peer);
    if (old && old !== call) try { old.close(); } catch (e) { }
    N.calls.set(call.peer, call);
    call.on("stream", s => emit("stream", call.peer, s));
    call.on("close", () => { if (N.calls.get(call.peer) === call) { N.calls.delete(call.peer); emit("gone", call.peer); } });
  }
  function callPeer(id) { if (!N.peer || N.calls.has(id)) return; try { watchCall(N.peer.call(id, N.local || new MediaStream(), CALL_OPT)); } catch (e) { } }
  function answer(c) { c.answer(N.local || undefined, CALL_OPT); watchCall(c); }
  function makePeer(id, opt) {
    const p = id ? new Peer(id, opt) : new Peer(opt);
    p.on("disconnected", () => setTimeout(() => { try { if (!p.destroyed) p.reconnect(); } catch (e) { } }, 1500));
    return p;
  }

  // ---- ホスト ----
  async function host(fresh) {
    N.role = "host";
    let saved = null; try { saved = JSON.parse(localStorage.getItem(ROOM_KEY)); } catch (e) { }
    N.room = (!fresh && saved && saved.room && Date.now() - saved.at < 3 * 3600e3) ? saved.room : rndId(8);
    try { localStorage.setItem(ROOM_KEY, JSON.stringify({ room: N.room, at: Date.now() })); } catch (e) { }
    await camera();
    const opt = Object.assign({}, OPT, { config: { iceServers: [...STUN, ...(await turnServers())] } });
    const start = () => {
      N.peer = makePeer(idOf(N.room), opt);
      N.peer.on("open", () => emit("ready"));
      N.peer.on("connection", conn => {
        conn.on("open", () => { N.conns.set(conn.peer, conn); N.heard.set(conn.peer, Date.now()); });
        conn.on("data", m => { N.heard.set(conn.peer, Date.now()); if (m && m.t !== "ping") emit("msg", m, conn.peer); });
        const bye = () => { if (N.conns.get(conn.peer) === conn) { N.conns.delete(conn.peer); emit("left", conn.peer); } };
        conn.on("close", bye); conn.on("error", bye);
      });
      N.peer.on("call", answer);
      N.peer.on("error", e => { if (e.type === "unavailable-id") { N.peer.destroy(); setTimeout(start, 3000); } else emit("error", e.type); });
    };
    start();
  }
  N.sendTo = (peerId, m) => { const c = N.conns.get(peerId); if (c && c.open) try { c.send(m); } catch (e) { } };
  N.broadcast = m => { for (const id of N.conns.keys()) N.sendTo(id, m); };

  // ---- ゲスト ----
  let hello = null;
  async function guest(seats) {
    N.role = "guest"; hello = { t: "hello", dev, seats };
    await camera();
    const opt = Object.assign({}, OPT, { config: { iceServers: [...STUN, ...(await turnServers())] } });
    N.peer = makePeer(null, opt);
    N.peer.on("open", dial);
    N.peer.on("call", answer);
    N.peer.on("error", e => { if (e.type === "peer-unavailable") setTimeout(dial, 3000); else emit("error", e.type); });
  }
  function dial() {
    if (N.open || !N.peer || N.peer.destroyed) return;
    if (N.peer.disconnected) { try { N.peer.reconnect(); } catch (e) { } setTimeout(dial, 3000); return; }
    const conn = N.peer.connect(idOf(N.room), { serialization: "json", reliable: true });
    N.hostConn = conn;
    conn.on("open", () => {
      N.open = true; N.heard.set("host", Date.now()); emit("open");
      conn.send(hello);
      callPeer(idOf(N.room));
    });
    conn.on("data", m => {
      if (conn !== N.hostConn) return;
      N.heard.set("host", Date.now());
      if (!m || m.t === "ping") return;
      // 名簿：自分より前からいるゲストには、こちらから通話をかける
      if (m.t === "state" && m.roster) {
        const me = m.roster.findIndex(x => x.peer === N.peer.id);
        m.roster.forEach((x, k) => { if (k < me && x.peer && x.peer !== N.peer.id && x.role === "guest") callPeer(x.peer); });
      }
      emit("msg", m, "host");
    });
    const lost = () => { if (conn !== N.hostConn) return; if (N.open) { N.open = false; emit("lost"); } setTimeout(dial, 1500); };
    conn.on("close", lost); conn.on("error", lost);
    setTimeout(() => { if (!N.open && conn === N.hostConn) { try { conn.close(); } catch (e) { } N.hostConn = null; dial(); } }, 7000);
  }
  N.hello = seats => { if (hello) { hello.seats = seats; N.send(hello); } };
  N.send = m => { if (N.hostConn && N.open) try { N.hostConn.send(m); } catch (e) { } };

  // 生きているかの合図（12秒 便りがなければ 切れたとみなす）
  setInterval(() => {
    if (N.role === "host") {
      N.broadcast({ t: "ping" });
      for (const [id, c] of N.conns) if (Date.now() - (N.heard.get(id) || 0) > 12000) { N.conns.delete(id); try { c.close(); } catch (e) { } emit("left", id); }
    } else if (N.role === "guest" && N.open) {
      N.send({ t: "ping" });
      if (Date.now() - (N.heard.get("host") || 0) > 12000) { const c = N.hostConn; N.open = false; emit("lost"); try { c.close(); } catch (e) { } setTimeout(dial, 1000); }
    }
  }, 4000);

  N.host = host; N.guest = guest;
  N.inviteURL = () => location.origin + location.pathname + "?r=" + N.room + (ps ? "&ps=" + ps : "") + "&openExternalBrowser=1";
  return N;
})();
