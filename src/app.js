/* ---------- サンバーシ 画面と進行 ----------
   1台で3人（となりの ひとと）／テレビ電話で遠隔（とおくの ひとと）。
   効果音（sfx.js）と はでな演出（fx.js）は テレビ電話リバーシのものを そのまま使う。 */
(() => {
  const NAMES = ["くろ", "しろ", "あか"];
  const GAMES = 3;
  const T = { flipStart: 300, flip: 330, flipGap: 110, afterFlip: 250, toTurn: 200 };
  const $ = id => document.getElementById(id);
  const wait = ms => new Promise(r => setTimeout(r, ms));
  const board = $("board");
  const discs = [];
  // ---- 対局の状態 ----
  let S = null, hist = [], game = 0, first = 0, wins = [0, 0, 0], totals = [0, 0, 0];
  let busy = false, started = false, shownOver = "";
  let mode = NET.role === "guest" ? "guest" : "solo";   // solo / host / guest
  let roster = [], mySeats = new Set([0, 1, 2]), pendingState = null;
  let s = 0, bw = 0, bh = 0;

  // ---- 盤の大きさ ----
  const R = SB.R, WF = 3 * R + 3.2, HF = Math.sqrt(3) * (2 * R + 1) + 1.3;
  const pos = i => { const c = SB.CELLS[i]; return { x: bw / 2 + 1.5 * s * c.q, y: bh / 2 + Math.sqrt(3) * s * (c.r + c.q / 2) }; };
  function layout() {
    const w = $("wrap").clientWidth, h = $("wrap").clientHeight;
    s = Math.max(4, Math.min(w / WF, h / HF));
    bw = s * WF; bh = s * HF;
    board.style.width = bw + "px"; board.style.height = bh + "px";
    board.style.setProperty("--e", Math.max(1.5, s * .09) + "px");
    drawBoard(); if (S) placeDiscs();
  }
  function hexPts(cx, cy, r, rot = 0) {
    return [0, 1, 2, 3, 4, 5].map(k => { const a = Math.PI / 3 * k + rot; return (cx + r * Math.cos(a)).toFixed(1) + "," + (cy + r * Math.sin(a)).toFixed(1); }).join(" ");
  }
  function drawBoard() {
    const cx = bw / 2, cy = bh / 2, big = Math.sqrt(3) * s * R + s * 1.05;
    let g = `<svg width="${bw}" height="${bh}">
      <defs>
        <radialGradient id="felt" cx="50%" cy="42%" r="60%"><stop offset="0" stop-color="#4FAE78"/><stop offset=".55" stop-color="#37935F"/><stop offset="1" stop-color="#25714A"/></radialGradient>
        <linearGradient id="frame" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3A4046"/><stop offset="1" stop-color="#0E1013"/></linearGradient>
      </defs>
      <polygon points="${hexPts(cx, cy, big + s * .55, Math.PI / 6)}" fill="url(#frame)"/>
      <polygon points="${hexPts(cx, cy, big, Math.PI / 6)}" fill="#10231A"/>`;
    SB.CELLS.forEach((c, i) => { const p = pos(i); g += `<polygon points="${hexPts(p.x, p.y, s * .955)}" fill="url(#felt)"/>`; });
    board.innerHTML = g + "</svg>";
    discs.length = 0;
    SB.CELLS.forEach((c, i) => { const d = document.createElement("div"); d.className = "disc"; d.style.display = "none"; d.innerHTML = '<div class="face"></div>'; board.appendChild(d); discs[i] = d; });
    board.appendChild(Object.assign(document.createElement("div"), { className: "halo", id: "halo" }));
  }
  const discR = () => s * .78;
  function setDisc(i, c) {
    const d = discs[i], p = pos(i), r = discR();
    Object.assign(d.style, { display: c < 0 ? "none" : "block", left: p.x - r + "px", top: p.y - r + "px", width: 2 * r + "px", height: 2 * r + "px", visibility: "" });
    d.dataset.c = c; d.firstChild.dataset.c = c;
  }
  function placeDiscs() { S.b.forEach((c, i) => setDisc(i, c)); showHalo(); showHints(); }
  function showHalo() {
    const h = $("halo"); if (!h) return;
    if (!S || S.last < 0) { h.style.display = "none"; return; }
    const p = pos(S.last), r = s * .8;
    Object.assign(h.style, { display: "block", left: p.x - r + "px", top: p.y - r + "px", width: 2 * r + "px", height: 2 * r + "px" });
  }
  const myTurn = () => S && !S.over && started && mySeats.has(S.turn);
  function showHints() {
    board.querySelectorAll(".hint").forEach(e => e.remove());
    if (!S || S.over || busy || !myTurn()) return;
    SB.legal(S, S.turn).forEach(i => {
      const p = pos(i), r = s * .42, e = document.createElement("div");
      e.className = "hint"; Object.assign(e.style, { left: p.x - r + "px", top: p.y - r + "px", width: 2 * r + "px", height: 2 * r + "px" });
      board.appendChild(e);
    });
  }

  // ---- 石を返す：厚みのある円柱が まわる（テレビ電話リバーシと同じ作り） ----
  const SEG = 28, THICK = .17, EDGE = [[40, 40, 46], [232, 228, 216], [196, 52, 44]];
  const shade = (rgb, k) => `rgb(${rgb.map(v => Math.round(Math.min(255, v * k))).join(",")})`;
  function flipDisc(i, from, to, dir, dur) {
    const d = discs[i], D = 2 * discR(), H = D * THICK, w = Math.PI * D / SEG * 1.12;
    const cy = document.createElement("span"); cy.className = "cyl";
    Object.assign(cy.style, { left: d.style.left, top: d.style.top, width: d.style.width, height: d.style.height });
    const front = document.createElement("span"); front.className = "face"; front.dataset.c = from; front.style.transform = `translateZ(${H / 2}px)`;
    const back = document.createElement("span"); back.className = "face"; back.dataset.c = to; back.style.transform = `rotateY(180deg) translateZ(${H / 2}px)`;
    for (let k = 0; k < SEG; k++) {
      const ang = k * 360 / SEG, light = .58 + .55 * Math.max(0, Math.cos((ang - 200) * Math.PI / 180));
      const e = document.createElement("span"); e.className = "edge";
      e.style.cssText = `width:${w}px;height:${H}px;margin:${-H / 2}px 0 0 ${-w / 2}px;transform:rotateZ(${ang}deg) translateY(${D / 2 - .6}px) rotateX(90deg);` +
        `background:linear-gradient(to bottom, ${shade(EDGE[to], light)} 0 50%, ${shade(EDGE[from], light)} 50% 100%)`;
      cy.appendChild(e);
    }
    cy.append(back, front);
    board.appendChild(cy); d.style.visibility = "hidden";
    const [ax, ay] = dir;
    const a = cy.animate([
      { transform: `rotate3d(${ax}, ${ay}, 0, 0deg) scale(1)` },
      { transform: `rotate3d(${ax}, ${ay}, 0, 90deg) scale(1.22)` },
      { transform: `rotate3d(${ax}, ${ay}, 0, 180deg) scale(1)` },
    ], { duration: dur, easing: "ease-in-out", fill: "forwards" });
    a.onfinish = () => { setDisc(i, to); cy.remove(); };
  }

  // ---- 札 ----
  function seats() {
    $("restart").style.visibility = mode === "solo" ? "" : "hidden";
    const c = S ? SB.counts(S) : [0, 0, 0];
    $("seats").innerHTML = [0, 1, 2].map(i => `<div class="seat ${S && S.turn === i && !busy && started && !S.over ? "on" : ""}" id="seat${i}">
      <div class="turn">${mode !== "solo" && mySeats.has(i) ? "あなたの ばん" : "の ばん"}</div>
      <div class="top"><span class="mini c${i}"></span><span class="name">${NAMES[i]}</span></div>
      <div class="num" id="cnt${i}">${c[i]}</div><div class="stars">${"★".repeat(wins[i])}</div>
      ${mode !== "solo" && mySeats.has(i) ? '<div class="me">このスマホ</div>' : ""}</div>`).join("");
    $("gameNo").textContent = `だい${game + 1}きょく ／ ${GAMES}`;
  }
  let bt = 0;
  function banner(html, ms = 1100) {
    const b = $("banner"); b.innerHTML = html; b.classList.add("show");
    clearTimeout(bt); return new Promise(res => { bt = setTimeout(() => { b.classList.remove("show"); setTimeout(res, 150); }, ms); });
  }
  const chip = i => `<span class="mini c${i}"></span>`;

  // ---- 1手の演出 ----
  async function animateMove(ev) {
    busy = true; showHints(); seats();
    const p = ev.p;
    setDisc(ev.i, p); const d = discs[ev.i]; d.classList.remove("drop"); void d.offsetWidth; d.classList.add("drop");
    S.last = ev.i; showHalo(); SFX.place();
    await wait(T.flipStart);
    // 返す石：近い順に1列に ならべて 1枚ずつ。だんだん速く、だんだん豪華に。最後の1枚が見せ場
    const seq = [];
    ev.flips.forEach(line => line.forEach((x, j) => seq.push({ x, j })));
    seq.sort((a, b) => a.j - b.j);
    const n = seq.length, o = pos(ev.i);
    let tm = 0;
    seq.forEach((q, m) => {
      const L = m + 1, last = L === n, from = +discs[q.x].dataset.c, pp = pos(q.x);
      let dx = pp.x - o.x, dy = pp.y - o.y; const len = Math.hypot(dx, dy) || 1; dx /= len; dy /= len;
      setTimeout(() => {
        flipDisc(q.x, from, p, [-dy, dx], T.flip);
        setTimeout(() => {
          SFX.flip(m, n);
          const br = board.getBoundingClientRect(), x = br.left + pp.x, y = br.top + pp.y;
          if (last) FX.climax(x, y, n, p, $("cnt" + p), board);
          else FX.flipHit(x, y, L, n, p, board);
        }, T.flip * .45);
      }, tm);
      if (!last) tm += Math.max(T.flipGap * .55, T.flipGap * (1.15 - m * .05));
    });
    await wait(tm + T.flip + 60);
    if (FX.tierOf(n) >= 4) await wait(600);
    await wait(T.afterFlip);
  }
  // 手を打つ（solo・host はここで確定、guest は先に見せて ホストへ送る）
  async function play(i) {
    if (busy || !S || S.over || !started || !mySeats.has(S.turn)) return;
    if (!SB.flipsFor(S, S.turn, i).length) { nudge(i); return; }
    if (mode === "guest") NET.send({ t: "move", i, n: hist.length, g: game });
    await commit(i);
  }
  async function commit(i) {
    hist.push(i);
    const next = SB.replay(hist, first), ev = next.events[next.events.length - 1];
    if (mode === "host") afterGameEnd(next), publish();
    await animateMove(ev);
    S = next; busy = false;
    await afterMove(ev);
  }
  async function afterMove(ev) {
    seats(); showHalo();
    for (const p of ev.passed) { SFX.ng(); await banner(`${chip(p)} ${NAMES[p]} は おけないので パス`, 1300); }
    if (S.over) return finish();
    showHints(); seats(); SFX.turn();
    banner(mode !== "solo" && mySeats.has(S.turn) ? `${chip(S.turn)} ${NAMES[S.turn]}（あなた）の ばん` : `つぎは ${chip(S.turn)} ${NAMES[S.turn]}`, 750);
    flushPending();
  }
  function nudge(i) { const d = discs[i]; SFX.ng(); }

  // ---- 終局 ----
  // 勝ち数の記録は solo と host だけ（guest は host から受けとる）
  let countedFor = "";
  function afterGameEnd(st) {
    if (!st.over || mode === "guest") return;
    const key = game + ":" + hist.length; if (countedFor === key) return; countedFor = key;
    const c = SB.counts(st), w = SB.winners(c);
    w.forEach(k => wins[k]++); c.forEach((v, k) => totals[k] += v);
  }
  function rows(c, w) {
    return [0, 1, 2].sort((a, b) => c[b] - c[a]).map(i => `<div class="row ${w.includes(i) ? "win" : ""}">${chip(i)}${NAMES[i]}<span class="n">${c[i]}まい</span><span class="w">${"★".repeat(wins[i])}</span></div>`).join("");
  }
  async function finish() {
    const key = game + ":" + hist.length; if (shownOver === key) return; shownOver = key;
    afterGameEnd(S); seats();
    const c = SB.counts(S), w = SB.winners(c);
    await wait(400); if (shownOver !== key) return;
    const r = $("seat" + w[0]).getBoundingClientRect();
    FX.victory(r, w.length > 1); SFX.fanfare(w.length > 1);
    w.forEach(k => $("seat" + k).classList.add("winner"));
    await wait(2600); if (shownOver !== key) return;
    const last = game + 1 >= GAMES;
    let html = `<h2>だい${game + 1}きょく おわり</h2><div class="big">${w.map(i => NAMES[i]).join("と ")} の かち！</div>${rows(c, w)}`;
    if (last) {
      const champ = SB.setChampion(wins, totals);
      html = `<h2>${GAMES}きょく おわり</h2><div class="big">${champ.map(i => NAMES[i]).join("と ")} の ゆうしょう！</div>${rows(totals, champ).replace(/まい/g, "まい（ごうけい）")}
        <button id="next">もういちど あそぶ</button><div class="sub">かったかずが おなじときは、3きょくの いしの ごうけいで きめます</div>`;
    } else html += `<button id="next">つぎの きょくへ</button><div class="sub">つぎは ${NAMES[(game + 1) % 3]} から</div>`;
    $("card").innerHTML = html; $("sheet").classList.add("show");
    flushPending();
    $("next").onclick = () => { audio(); if (mode === "guest") { NET.send({ t: "next", g: game }); $("next").textContent = "まっています…"; } else nextGame(); };
  }
  function nextGame() {
    if (!S || !S.over) return;
    if (game + 1 >= GAMES) { game = 0; wins = [0, 0, 0]; totals = [0, 0, 0]; } else game++;
    newGame();
  }
  function newGame() {
    first = game % 3; hist = []; S = SB.replay(hist, first); busy = false; shownOver = "";
    $("sheet").classList.remove("show");
    layout(); seats();
    if (mode === "host") publish();
    if (started) { SFX.turn(); banner(`${chip(S.turn)} ${NAMES[S.turn]} から`, 1200); }
  }

  // ---- 遠隔：ホスト ----
  const freeSeats = () => [0, 1, 2].filter(k => !roster.some(x => x.seats.includes(k)));
  function publish() {
    if (mode !== "host") return;
    NET.broadcast({ t: "state", roster, hist, game, first, wins, totals, started });
    lobby();
  }
  function hostMsg(m, peer) {
    if (m.t === "hello") {
      let me = roster.find(x => x.dev === m.dev);
      if (me) me.peer = peer, me.online = true;
      else {
        const free = freeSeats(), want = Math.min(2, Math.max(1, m.seats | 0));
        if (free.length < want) { NET.sendTo(peer, { t: "full", free: free.length }); return; }
        roster.push({ role: "guest", dev: m.dev, peer, seats: free.slice(0, want), online: true });
      }
      if (!started && !freeSeats().length) { started = true; hideOverlay(); setTimeout(() => { SFX.sparkle(); banner("そろったね！ はじめよう", 1400).then(() => { SFX.turn(); banner(`${chip(S.turn)} ${NAMES[S.turn]} から`, 1100); }); }, 300); }
      publish(); videoLabels(); seats(); showHints();
    }
    if (m.t === "move") {
      const who = roster.find(x => x.peer === peer);
      if (!who || busy || m.g !== game || m.n !== hist.length || !S || S.over || !who.seats.includes(S.turn) || !SB.flipsFor(S, S.turn, m.i).length) { NET.sendTo(peer, { t: "state", roster, hist, game, first, wins, totals, started }); return; }
      commit(m.i);
    }
    if (m.t === "next" && m.g === game) nextGame();
  }
  NET.on("left", peer => { const x = roster.find(r => r.peer === peer); if (x) x.online = false; publish(); videoLabels(); });

  // ---- 遠隔：ゲスト ----
  function guestMsg(m) {
    if (m.t === "full") {
      pickCount(n => { overlay(`<div class="card"><h2>つないでいます…</h2></div>`); NET.hello(n); }, m.free ? `あと ${m.free}にん しか はいれません` : "もう いっぱいです");
      if (!m.free) $("joinPick").style.display = "none"; else if (m.free < 2) $("p2").style.display = "none";
      return;
    }
    if (m.t !== "state") return;
    pendingState = m; flushPending();
  }
  function flushPending() {
    if (busy || !pendingState) return;
    const m = pendingState; pendingState = null;
    roster = m.roster; wins = m.wins; totals = m.totals;
    const me = roster.find(x => x.peer === NET.peer.id) || roster.find(x => x.dev === NET.dev);
    mySeats = new Set(me ? me.seats : []);
    const wasStarted = started; started = m.started;
    if (started) hideOverlay(); else lobby();
    videoLabels();
    const same = m.game === game && m.hist.length === hist.length + 1 && hist.every((v, k) => v === m.hist[k]);
    if (same) {
      hist = m.hist.slice();
      const next = SB.replay(hist, first), ev = next.events[next.events.length - 1];
      animateMove(ev).then(async () => { S = next; busy = false; await afterMove(ev); });
      return;
    }
    const changed = m.game !== game || m.hist.length !== hist.length || m.hist.some((v, k) => v !== hist[k]);
    game = m.game; first = m.first; hist = m.hist.slice();
    if (changed || !S) { S = SB.replay(hist, first); $("sheet").classList.remove("show"); shownOver = ""; layout(); }
    seats(); showHints();
    if (!wasStarted && started) { SFX.sparkle(); banner("そろったね！ はじめよう", 1400).then(() => { SFX.turn(); banner(`${chip(S.turn)} ${NAMES[S.turn]} から`, 1100); }); }
    if (S.over) finish();
  }
  NET.on("msg", (m, peer) => mode === "host" ? hostMsg(m, peer) : guestMsg(m));
  NET.on("lost", () => { $("netNote").textContent = "つなぎなおしています…"; $("netNote").classList.add("show"); });
  NET.on("open", () => { $("netNote").classList.remove("show"); });

  // ---- 映像 ----
  const tiles = new Map();
  function tile(id) {
    let t = tiles.get(id);
    if (!t) {
      t = document.createElement("div"); t.className = "tile" + (id === "self" ? " self" : "");
      t.innerHTML = `<video autoplay playsinline ${id === "self" ? "muted" : ""}></video><div class="who"></div>`;
      $("videos").appendChild(t); tiles.set(id, t);
    }
    return t;
  }
  NET.on("local", st => { if (!st) return; const t = tile("self"), v = t.querySelector("video"); v.srcObject = st; v.play().catch(() => { }); videoLabels(); });
  NET.on("stream", (peer, st) => { const t = tile(peer), v = t.querySelector("video"); v.srcObject = st; v.play().catch(() => { }); videoLabels(); });
  NET.on("gone", peer => { const t = tiles.get(peer); if (t) { t.remove(); tiles.delete(peer); } });
  function videoLabels() {
    const hostPeer = NET.room ? "sanbasi-rm-" + NET.room : "";
    for (const [id, t] of tiles) {
      let seatsOf = [];
      if (id === "self") seatsOf = [...mySeats];
      else { const x = roster.find(r => r.peer === id) || (id === hostPeer ? roster.find(r => r.role === "host") : null); if (x) seatsOf = x.seats; }
      t.querySelector(".who").innerHTML = seatsOf.map(chip).join("");
      const x = roster.find(r => r.peer === id);
      t.classList.toggle("off", !!(x && x.online === false));
    }
    const had = document.body.classList.contains("call");
    document.body.classList.toggle("call", tiles.size > 0);
    if (had !== tiles.size > 0 && !busy) layout();
  }

  // ---- はじめの画面 ----
  function overlay(html) { $("ov").innerHTML = html; $("ov").classList.add("show"); }
  function hideOverlay() { $("ov").classList.remove("show"); }
  function startScreen() {
    overlay(`<div class="card"><div class="logo">サン<span>バーシ</span></div>
      <button class="big1" id="goFar">とおくの ひとと あそぶ</button>
      <button class="big2" id="goNear">1だいで あそぶ</button>
      <div class="sub">とおくの ひとと：テレビでんわで かおを みながら あそべます</div></div>`);
    $("goNear").onclick = () => { audio(); mode = "solo"; mySeats = new Set([0, 1, 2]); started = true; hideOverlay(); newGame(); };
    $("goFar").onclick = () => { audio(); pickCount(n => startHost(n)); };
  }
  function pickCount(go, title = "このスマホで あそぶのは？") {
    overlay(`<div class="card"><h2>${title}</h2><div id="joinMsg" class="sub"></div>
      <div class="pick" id="joinPick"><button id="p1">ひとり</button><button id="p2">ふたり</button></div>
      <div class="sub">ふたりで 1だいを つかうときは「ふたり」</div></div>`);
    $("p1").onclick = () => { audio(); go(1); };
    $("p2").onclick = () => { audio(); go(2); };
  }
  async function startHost(n) {
    mode = "host"; roster = [{ role: "host", dev: NET.dev, peer: null, seats: n === 2 ? [0, 1] : [0], online: true }];
    mySeats = new Set(roster[0].seats); started = false;
    newGame(); lobby();
    await NET.host();
    roster[0].peer = "sanbasi-rm-" + NET.room;
    lobby(); videoLabels();
  }
  function lobby() {
    if (started || mode === "solo") return;
    const url = NET.room ? NET.inviteURL() : "";
    const seatLine = k => { const x = roster.find(r => r.seats.includes(k)); return `<div class="row">${chip(k)}${NAMES[k]}<span class="n">${x ? (x.dev === NET.dev ? "このスマホ" : "つながった") : "まっています…"}</span></div>`; };
    let qr = "";
    if (url && mode === "host" && typeof qrcode !== "undefined") { const g = qrcode(0, "M"); g.addData(url); g.make(); qr = g.createSvgTag({ cellSize: 4, margin: 2 }); }
    overlay(`<div class="card"><h2>${mode === "host" ? "あいてを よぶ" : "つながりました"}</h2>
      ${[0, 1, 2].map(seatLine).join("")}
      ${mode === "host" ? (url ? `<div class="qr">${qr}</div>
        <a class="btn line" href="https://line.me/R/share?text=${encodeURIComponent("サンバーシで あそぼう！\n" + url)}" target="_blank" rel="noopener">LINEで おくる</a>
        <button class="btn" id="copy">リンクを コピー</button>` : `<div class="sub">へやを つくっています…</div>`) : `<div class="sub">みんなが そろうと はじまります</div>`}
      </div>`);
    const cp = $("copy"); if (cp) cp.onclick = () => { navigator.clipboard.writeText(url).then(() => { cp.textContent = "コピーしました"; }).catch(() => { cp.textContent = url; }); };
  }

  // ---- タップ：いちばん近いマス ----
  board.addEventListener("click", e => {
    const rc = board.getBoundingClientRect(), x = e.clientX - rc.left, y = e.clientY - rc.top;
    let best = -1, bd = 1e9;
    SB.CELLS.forEach((c, i) => { const p = pos(i), d = (p.x - x) ** 2 + (p.y - y) ** 2; if (d < bd) { bd = d; best = i; } });
    if (bd < (s * .95) ** 2) play(best);
  });
  let armed = 0;
  $("restart").onclick = () => {
    if (mode !== "solo") return;
    if (Date.now() - armed < 2500) { game = 0; wins = [0, 0, 0]; totals = [0, 0, 0]; newGame(); return; }
    armed = Date.now(); $("restart").textContent = "もういちど おすと はじめから"; setTimeout(() => $("restart").textContent = "はじめから", 2500);
  };
  addEventListener("resize", () => layout());
  // 演出のコマ送り
  let lastT = performance.now();
  (function loop(t) { FX.step(Math.min(.05, (t - lastT) / 1000)); lastT = t; requestAnimationFrame(loop); })(lastT);

  window.SANBASI = { get state() { return S; }, get busy() { return busy; }, get mode() { return mode; }, get mySeats() { return [...mySeats]; }, get started() { return started; }, get game() { return game; }, get hist() { return hist.slice(); }, play, nextGame };
  S = SB.replay([], 0); layout(); seats();
  if (mode === "guest") pickCount(n => { overlay(`<div class="card"><h2>つないでいます…</h2></div>`); NET.guest(n); }, "サンバーシに さそわれました<br>このスマホで あそぶのは？");
  else startScreen();
})();
