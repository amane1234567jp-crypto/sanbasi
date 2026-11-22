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
    const c = S ? SB.counts(S) : [0, 0, 0];
    $("seats").innerHTML = [0, 1, 2].map(i => `<div class="seat ${S && S.turn === i && !busy && started && !S.over ? "on" : ""}" id="seat${i}">
      <div class="turn">${mode !== "solo" && mySeats.has(i) ? "あなたの ばん" : "の ばん"}</div>
      <div class="top"><span class="mini c${i}"></span><span class="name">${NAMES[i]}</span></div>
      ${nameOf(i) ? `<div class="pn">${esc(nameOf(i))}</div>` : ""}
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
  // 遠隔のとき：その色で遊ぶ人の名前（なければ 色の名前）
  function nameOf(k) {
    if (mode === "solo") return "";
    const x = roster.find(r => r.seats.includes(k));
    return x && x.names ? (x.names[x.seats.indexOf(k)] || "") : "";
  }
  const who = k => nameOf(k) ? `${nameOf(k)}（${NAMES[k]}）` : NAMES[k];
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

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
    banner(mode !== "solo" && mySeats.has(S.turn) ? `${chip(S.turn)} ${esc(who(S.turn))} の ばん` : `つぎは ${chip(S.turn)} ${esc(who(S.turn))}`, 750);
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
    return [0, 1, 2].sort((a, b) => c[b] - c[a]).map(i => `<div class="row ${w.includes(i) ? "win" : ""}">${chip(i)}${esc(who(i))}<span class="n">${c[i]}まい</span><span class="w">${"★".repeat(wins[i])}</span></div>`).join("");
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
    let html = `<h2>だい${game + 1}きょく おわり</h2><div class="big">${w.map(i => esc(nameOf(i) || NAMES[i])).join("と ")} の かち！</div>${rows(c, w)}`;
    if (last) {
      const champ = SB.setChampion(wins, totals);
      html = `<h2>${GAMES}きょく おわり</h2><div class="big">${champ.map(i => esc(nameOf(i) || NAMES[i])).join("と ")} の ゆうしょう！</div>${rows(totals, champ).replace(/まい/g, "まい（ごうけい）")}
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
    if (started) { SFX.turn(); banner(`${chip(S.turn)} ${esc(who(S.turn))} から`, 1200); }
  }

  // ---- 遠隔：ホスト ----
  const freeSeats = () => [0, 1, 2].filter(k => !roster.some(x => x.seats.includes(k)));
  function publish() {
    if (mode !== "host") return;
    NET.broadcast({ t: "state", roster, hist, game, first, wins, totals, started, sid: hostSid });
    lobby();
  }
  function hostMsg(m, peer) {
    if (m.t === "hello") {
      let me = roster.find(x => x.dev === m.dev);
      // 同じリンクを2つの画面で開いたとき：いまの画面が元気なら（8秒以内に便りがある）あとの画面は ことわる
      if (me && me.peer !== peer && me.online && Date.now() - (NET.heard.get(me.peer) || 0) < 8000 && NET.conns.has(me.peer)) { NET.sendTo(peer, { t: "busy" }); return; }
      if (me) { me.peer = peer; me.online = true; backFrom(m.dev); if (m.names) me.names = m.names.slice(0, me.seats.length).map(s => String(s).slice(0, 12)); }
      else {
        const free = freeSeats(), want = Math.min(2, Math.max(1, m.seats | 0));
        if (free.length < want) { NET.sendTo(peer, { t: "full", free: free.length }); return; }
        roster.push({ role: "guest", dev: m.dev, peer, seats: free.slice(0, want), online: true, names: (m.names || []).slice(0, want).map(s => String(s).slice(0, 12)), pid: typeof m.pid === "string" ? m.pid.slice(0, 64) : "" });
      }
      const iv = invited.find(x => x.pid === m.pid); if (iv) iv.st = "in";
      if (!started && !freeSeats().length) { started = true; hideOverlay(); clearTimeout(inviteT); autoRegister(); setTimeout(() => { SFX.sparkle(); banner("そろったね！ はじめよう", 1400).then(() => { SFX.turn(); banner(`${chip(S.turn)} ${esc(who(S.turn))} から`, 1100); }); }, 300); }
      publish(); videoLabels(); seats(); showHints();
    }
    if (m.t === "decline") {
      const x = invited.find(y => y.pid === m.pid), nm = x ? pnames(x) : (m.names || []).join("・") || "あいて";
      if (x) x.st = "no";
      SFX.ng(); banner(`${esc(nm)} は いまは むり`, 1800); lobby();
      if (invited.length && invited.every(y => y.st === "no")) note("よんだ ひとは みんな いまは むり でした。「ほかの ひとも よぶ」か、メニューから もどってね");
      return;
    }
    if (m.t === "move") {
      const who = roster.find(x => x.peer === peer);
      if (!who || busy || m.g !== game || m.n !== hist.length || !S || S.over || !who.seats.includes(S.turn) || !SB.flipsFor(S, S.turn, m.i).length) { NET.sendTo(peer, { t: "state", roster, hist, game, first, wins, totals, started, sid: hostSid }); return; }
      commit(m.i);
    }
    if (m.t === "next" && m.g === game) nextGame();
    if (m.t === "quit") { const who = roster.find(x => x.peer === peer); NET.broadcast({ t: "quit", seats: who ? who.seats : [] }); quitByOther(who ? who.seats : []); }
  }
  /* だれかが いなくなったとき（2026-11-22 決定）：30秒は まつ（電話・LINE・電波の切れめ）。
     もどれば つづき。もどらなければ その対局は おわり → 全員 はじめの画面へ。
     親（さそった人）が いなくなったときも 同じ（ゲスト側で 30秒 まつ）。 */
  const GRACE = 30000;
  const waiting = new Map();   // dev → { seats, until }
  let waitTick = 0;
  function showWaiting() {
    clearInterval(waitTick);
    const draw = () => {
      const now = Date.now(), list = [...waiting.values()];
      if (!list.length) { $("netNote").classList.remove("show"); clearInterval(waitTick); return; }
      $("netNote").innerHTML = list.map(w => `${w.seats.map(chip).join("")} ${esc(w.seats.map(k => nameOf(k) || NAMES[k]).join("・"))} を まっています（あと ${Math.max(0, Math.ceil((w.until - now) / 1000))}びょう）`).join("<br>");
      $("netNote").classList.add("show");
    };
    draw(); waitTick = setInterval(draw, 1000);
  }
  NET.on("left", peer => {
    const x = roster.find(r => r.peer === peer); if (!x) return;
    x.online = false;
    if (!started) { roster = roster.filter(r => r !== x); publish(); videoLabels(); return; }   // はじまる前なら 席を あける
    const w = { seats: x.seats.slice(), until: Date.now() + GRACE };
    waiting.set(x.dev, w);
    w.timer = setTimeout(() => {
      if (waiting.get(x.dev) !== w) return;
      NET.broadcast({ t: "end", seats: w.seats, why: "left" });
      endBy(w.seats, "が もどらないので おわります");
    }, GRACE);
    NET.broadcast({ t: "wait", seats: w.seats, until: w.until });
    showWaiting(); publish(); videoLabels();
  });
  function backFrom(dev) { const w = waiting.get(dev); if (!w) return; clearTimeout(w.timer); waiting.delete(dev); NET.broadcast({ t: "waitEnd", seats: w.seats }); showWaiting(); }

  // ---- 遠隔：ゲスト ----
  function guestMsg(m) {
    if (m.t === "busy") { NET.stop(); overlay(`<div class="card"><h2>ほかの がめんで<br>つながっています</h2><div class="sub">この がめんは とじてください</div></div>`); return; }
    if (m.t === "quit") { quitByOther(m.seats || []); return; }
    if (m.t === "end") { endBy(m.seats || [], m.why === "left" ? "が もどらないので おわります" : "が いなくなったので おわります"); return; }
    if (m.t === "wait") { waiting.set("s" + m.seats.join(""), { seats: m.seats, until: m.until }); showWaiting(); return; }
    if (m.t === "waitEnd") { waiting.delete("s" + m.seats.join("")); showWaiting(); return; }
    if (m.t === "full") {
      pickCount(n => { overlay(`<div class="card"><h2>つないでいます…</h2></div>`); NET.hello(n, (CFG.names || []).slice(0, n)); }, m.free ? `あと ${m.free}にん しか はいれません` : "もう いっぱいです");
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
    rememberRoom();
    const me = roster.find(x => x.peer === NET.peer.id) || roster.find(x => x.dev === NET.dev);
    mySeats = new Set(me ? me.seats : []);
    // 親が 読みなおして あたらしく はじめた（対局が消えた）→ この対局は おわり
    if (started && guestSid && m.sid && m.sid !== guestSid) { const h = roster.find(x => x.role === "host"); endBy(h ? h.seats : [], "の がめんが はじめからに なったので おわります"); return; }
    if (m.started && m.sid) guestSid = m.sid;
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
    if (!wasStarted && started) { autoRegister(); SFX.sparkle(); banner("そろったね！ はじめよう", 1400).then(() => { SFX.turn(); banner(`${chip(S.turn)} ${esc(who(S.turn))} から`, 1100); }); }
    if (S.over) finish();
  }
  function rememberRoom() {
    const h = roster.find(x => x.role === "host"); if (!h || !NET.room) return;
    const nm = (h.names || []).filter(Boolean).join("・") || hostName || "さそった ひと";
    const list = (CFG.rooms || []).filter(x => x.room !== NET.room);
    list.unshift({ room: NET.room, name: nm, at: Date.now() }); CFG.rooms = list.slice(0, 5); saveCFG();
  }
  NET.on("msg", (m, peer) => mode === "host" ? hostMsg(m, peer) : guestMsg(m));
  let wasLost = false;
  let lostTimer = 0;
  NET.on("lost", () => {
    wasLost = true;
    if (!started) { $("netNote").textContent = "つなぎなおしています… ちょっと まってね"; $("netNote").classList.add("show"); return; }
    const h = roster.find(x => x.role === "host"), seatsOf = h ? h.seats : [];
    waiting.set("host", { seats: seatsOf, until: Date.now() + GRACE }); showWaiting();
    clearTimeout(lostTimer);
    lostTimer = setTimeout(() => { if (!NET.open) endBy(seatsOf, "と つながらなくなったので おわります"); }, GRACE);
  });
  NET.on("open", () => {
    clearTimeout(lostTimer); waiting.delete("host"); showWaiting();
    $("netNote").classList.remove("show");
    if (wasLost && started) { wasLost = false; banner("つながったよ！ つづきから やろう", 1600); }
  });

  // ---- 映像 ----
  const tiles = new Map();
  function tile(id) {
    let t = tiles.get(id);
    if (!t) {
      t = document.createElement("div"); t.className = "tile" + (id === "self" ? " self" : "");
      t.innerHTML = `<video autoplay playsinline ${id === "self" ? "muted" : ""}></video><div class="who"></div><div class="nv">カメラが うつりません<br>（ゲームは できます）</div>`;
      $("videos").appendChild(t); tiles.set(id, t);
    }
    return t;
  }
  NET.on("local", st => {
    soundForCall();
    if (!st) { noCamera(); return; }
    const t = tile("self"), v = t.querySelector("video"); v.srcObject = st; v.play().catch(() => { }); videoLabels();
    freshForCall("じぶんの カメラ");
    if (!st.getVideoTracks().length) t.classList.add("novid");
  });
  NET.on("stream", (peer, st) => {
    const t = tile(peer), v = t.querySelector("video"); v.srcObject = st; v.play().catch(() => { }); videoLabels();
    freshForCall("あいての 映像");
    // 相手のカメラが映らないとき（マイクだけ／カメラを許可していない）
    t.classList.toggle("novid", !st.getVideoTracks().length);
    setTimeout(() => { if (!v.videoWidth) t.classList.add("novid"); else t.classList.remove("novid"); }, 6000);
  });
  // カメラもマイクも使えなかったとき：ゲームは できる。直し方を出す
  function noCamera() {
    note(`<b>カメラと マイクが つかえません</b><br>ゲームは このまま できます。<br>テレビでんわを つかうには、Safari なら 画面の「ぁあ」→「Webサイトの設定」で カメラと マイクを「許可」にして、ページを 読みなおしてください。`);
  }
  // 電話のあと：止まったカメラ・マイクを取りなおし、相手の映像・声も再生しなおす
  document.addEventListener("visibilitychange", () => {
    if (document.hidden || !NET.role) return;
    setTimeout(() => { NET.refreshMedia(); for (const t of tiles.values()) { const v = t.querySelector("video"); if (v.srcObject && v.paused) v.play().catch(() => { }); } }, 1200);
  });
  NET.on("gone", peer => { const t = tiles.get(peer); if (t) { t.remove(); tiles.delete(peer); } });
  function videoLabels() {
    const hostPeer = NET.room ? "sanbasi-rm-" + NET.room : "";
    for (const [id, t] of tiles) {
      let seatsOf = [];
      if (id === "self") seatsOf = [...mySeats];
      else { const x = roster.find(r => r.peer === id) || (id === hostPeer ? roster.find(r => r.role === "host") : null); if (x) seatsOf = x.seats; }
      t.querySelector(".who").innerHTML = seatsOf.map(k => chip(k) + (nameOf(k) ? `<span class="tn">${esc(nameOf(k))}</span>` : "")).join("");
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
      <div class="sub">とおくの ひとと：テレビでんわで かおを みながら あそべます</div>
      <button class="small" id="goSet">おとなの せってい</button><div class="ver">版 ${VERSION}</div></div>`);
    $("goSet").onclick = () => settings(startScreen);
    pollPending();
    $("goNear").onclick = () => { audio(); keepAwake(); mode = "solo"; mySeats = new Set([0, 1, 2]); started = true; hideOverlay(); newGame(); };
    $("goFar").onclick = () => { audio(); keepAwake(); pickCount(n => askNames(n, names => chooser(n, names))); };
  }
  /* ---------- とうろくした ひと と よびだし（2026-11-22 決定） ----------
     とうろく：リンク1本（LINE のグループに送ってよい）。開いた人と さそった人が とうろくされる
     よぶ：「だれと あそぶ？」で 3人になるまで えらぶ →「あそぼう！」→ えらんだ人 全員に 通知（アプリ）＋ LINE で しらせる
     よばれた人：「はいる（1人／2人）」か「いまは むり」（さそった人の画面に すぐ出る）
     いっしょに 3人で遊んだ人どうしは 自動で とうろく */
  let screenTok = 0;
  const people = () => PEOPLE.list();
  const pnames = x => (x.names || []).join("・") || "？";
  // 自分のリンクで とうろくした人を 受けとる（ひらいている間は 10秒ごと）
  let pollT = 0;
  function pollPending() {
    clearInterval(pollT);
    const once = async () => { const got = await PEOPLE.pending(); if (got.length) { SFX.sparkle(); note(`<b>${got.map(esc).join("、")}</b> が とうろく しました！`); const c = $("chooserList"); if (c && chooserRedraw) chooserRedraw(); } };
    once(); pollT = setInterval(() => { if (!NET.role || !started) once(); }, 10000);
  }
  let chooserRedraw = null;
  function chooser(n, names) {
    const tok = ++screenTok, sel = new Set();
    PEOPLE.reg(false);
    const draw = () => {
      if (tok !== screenTok) return;
      const list = people(), count = [...sel].reduce((s, pid) => s + ((list.find(x => x.pid === pid) || {}).names || [1]).length, 0), need = 3 - n - count;
      overlay(`<div class="card chooser"><h2>だれと あそぶ？</h2>
        <div class="sub big">${need > 0 ? `あと ${need}にん えらんでね` : "そろったよ！"}</div>
        <div id="chooserList">${list.length ? list.map(x => `<button class="person ${sel.has(x.pid) ? "on" : ""}" data-pid="${x.pid}" ${!sel.has(x.pid) && need <= 0 ? "disabled" : ""}>${esc(pnames(x))}${x.names.length > 1 ? '<span class="cnt">（ふたり）</span>' : ""}</button>`).join("")
          : `<div class="sub">まだ とうろくした ひとが いません。<br>「あたらしい ひとを とうろく」から さそってね</div>`}</div>
        <button class="big1" id="goPlay" ${sel.size && need <= 0 ? "" : "disabled"}>あそぼう！</button>
        <button class="big2" id="goReg">あたらしい ひとを とうろく</button>
        <button class="small" id="goLink">とうろく しないで リンクで さそう</button>
        <button class="small" id="goBack">もどる</button></div>`);
      document.querySelectorAll(".person").forEach(b => b.onclick = () => { const p = b.dataset.pid; sel.has(p) ? sel.delete(p) : sel.add(p); draw(); });
      $("goPlay").onclick = () => { if (!sel.size || need > 0) return; const inv = list.filter(x => sel.has(x.pid)).map(x => ({ pid: x.pid, names: x.names, st: "call" })); startHost(n, names, inv); };
      $("goReg").onclick = () => regScreen(() => chooser(n, names));
      $("goLink").onclick = () => startHost(n, names, []);
      $("goBack").onclick = startScreen;
    };
    chooserRedraw = draw; draw(); pollPending();
  }
  // とうろく用の リンクを 送る画面（親が操作するので ふつうの漢字かなまじり）
  async function regScreen(back) {
    screenTok++;
    PEOPLE.reg(true);
    const me = (CFG.names || []).filter(Boolean).join("・") || "わたし", url = PEOPLE.regURL();
    const text = `${me}です。3人で遊べるリバーシ「サンバーシ」で、いっしょに遊びませんか？ 下のリンクを開くと登録できます。\n${url}`;
    let qr = ""; if (typeof qrcode !== "undefined") { const g = qrcode(0, "M"); g.addData(url); g.make(); qr = g.createSvgTag({ cellSize: 4, margin: 2 }); }
    overlay(`<div class="card adult"><h2>相手を登録する</h2>
      <div class="sub">このリンクを開いた人と、この端末が登録されます。<b>LINEのグループに送れば、何人でも</b>登録できます。送っても、すぐにはゲームは始まりません。</div>
      <div class="msg">${esc(text).replace(/\n/g, "<br>")}</div>
      <button class="btn line" id="regLine">LINEで送る</button>
      <details><summary>ほかの方法で送る</summary><button class="small" id="regCopy">文面をコピー</button><div class="qr">${qr}</div><div class="sub">そばにいる人は QRコードを読み取ってください</div></details>
      <button class="big2" id="regBack">閉じる</button></div>`);
    $("regLine").onclick = () => shareText(text);
    $("regCopy").onclick = () => navigator.clipboard.writeText(text).then(() => { $("regCopy").textContent = "コピーしました。貼り付けて送ってね"; }).catch(() => { });
    $("regBack").onclick = back;
    pollPending();
  }
  async function shareText(text) {
    if (NATIVE.on) { await NATIVE.share(text); return; }
    if (navigator.share) { try { await navigator.share({ text }); return; } catch (e) { if (e && e.name === "AbortError") return; } }
    location.href = "https://line.me/R/share?text=" + encodeURIComponent(text);
  }
  // とうろくリンクを ひらいた人
  function regWelcome(fd, fn) {
    if (fd === PEOPLE.pid) { overlay(`<div class="card"><h2>じぶんの リンクです</h2><div class="sub">このリンクは あいてに おくってね</div><button class="big2" id="rb">はじめの がめんへ</button></div>`); $("rb").onclick = toMenu; return; }
    overlay(`<div class="card welcome"><div class="logo">サン<span>バーシ</span></div><h2>${esc(fn || "あいて")}さんと<br>登録します</h2>
      <div class="sub">登録すると、次からアプリで呼び合えます</div>
      <div class="lab">この端末で遊ぶのは？</div>
      <div class="pick"><button id="p1">1人</button><button id="p2">2人</button></div></div>`);
    const go = k => askNames(k, async names => {
      overlay(`<div class="card"><h2>登録しています…</h2></div>`);
      await PEOPLE.reg(true); const r = await PEOPLE.accept(fd, names);
      PEOPLE.add(fd, (fn || "").split("・"));
      overlay(`<div class="card"><h2>${esc(fn || "あいて")}さんと<br>登録しました！</h2>
        <div class="sub">${r && r.ok ? "" : "（相手への知らせは 届かなかったかもしれません。いっしょに遊べば 自動で登録されます）"}</div>
        <button class="big1" id="rb">はじめの がめんへ</button></div>`);
      SFX.sparkle(); $("rb").onclick = toMenu;
    });
    $("p1").onclick = () => { audio(); go(1); }; $("p2").onclick = () => { audio(); go(2); };
  }
  // いっしょに 3人で遊んだ人どうしは 自動で とうろく
  function autoRegister() {
    let added = 0;
    for (const r of roster) if (r.pid && r.pid !== PEOPLE.pid && PEOPLE.add(r.pid, r.names)) added++;
    if (added) PEOPLE.reg(false);
  }
  // さそった人：えらんだ人を 通知で よぶ
  let invited = [], inviteT = 0;
  const inviteURLFor = () => { const myName = (roster[0] && roster[0].names || []).filter(Boolean).join("・"); return NET.inviteURL() + (myName ? "&n=" + encodeURIComponent(myName) : "") + "&inv=1&fp=" + PEOPLE.pid; };
  async function callInvited(only) {
    const myName = (roster[0] && roster[0].names || []).filter(Boolean).join("・") || "あいて", url = inviteURLFor();
    for (const x of invited) {
      if (only && x !== only) continue;
      if (x.st === "in") continue;
      x.st = "call"; lobby();
      const r = await PEOPLE.call(x.pid, "サンバーシ", `${myName}が さそっています。タップして はいってね`, url);
      x.st = r && r.ok ? "sent" : "nopush"; lobby();
    }
  }
  const ST = { call: "よびだし中…", sent: "しらせました", nopush: "通知が とどきません", in: "はいった！", no: "いまは むり" };
  const hostName = (new URLSearchParams(location.search).get("n") || "").slice(0, 20);
  const isInv = new URLSearchParams(location.search).get("inv") === "1";
  // さそわれた側：大きな字で 手順を2つだけ
  function welcome() {
    overlay(`<div class="card welcome"><div class="logo">サン<span>バーシ</span></div><h2>${hostName ? esc(hostName) + "さんからの<br>" : ""}お誘いです</h2>
      <ol><li>この端末で遊ぶ人数を選ぶ</li><li>カメラとマイクを「許可」する</li></ol>
      <div class="pick" id="joinPick"><button id="p1">1人</button><button id="p2">2人</button></div>
      <div class="sub">2人で1台を使うときは「2人」</div>
      ${isInv ? '<button class="big2" id="pNo">いまは むり</button>' : ""}</div>`);
    const go = n => askNames(n, names => join(n, names));
    if ($("pNo")) $("pNo").onclick = async () => {
      audio(); overlay(`<div class="card"><h2>つたえています…</h2></div>`);
      const ok = await NET.decline((CFG.names || []).filter(Boolean));
      overlay(`<div class="card"><h2>${ok ? `${esc(hostName || "さそった人")}に<br>つたえました` : "つたえられませんでした"}</h2><div class="sub">${ok ? "またね！" : "さそった人は もう まっていないようです"}</div><button class="big2" id="rb">はじめの がめんへ</button></div>`);
      $("rb").onclick = toMenu;
    };
    $("p1").onclick = () => { audio(); keepAwake(); go(1); }; $("p2").onclick = () => { audio(); keepAwake(); go(2); };
  }
  const JOIN_KEY = "sanbasi-join";
  function join(n, names) {
    try { sessionStorage.setItem(JOIN_KEY, JSON.stringify({ room: NET.room, n, names, at: Date.now() })); } catch (e) { }
    setInterval(() => { try { const j = JSON.parse(sessionStorage.getItem(JOIN_KEY)); if (j) { j.at = Date.now(); sessionStorage.setItem(JOIN_KEY, JSON.stringify(j)); } } catch (e) { } }, 5000);
    overlay(`<div class="card"><h2>つないでいます…</h2><div class="sub" id="waitHint"></div></div>`); NET.guest(n, names);
      setTimeout(() => { const h = $("waitHint"); if (h && !started) h.innerHTML = `なかなか つながらないときは、${esc(hostName || "さそった人")}の 端末で「あいてを よぶ」の画面が ひらいているか たしかめてね`; }, 30000);
  }
  // 名前（この端末で遊ぶ人の数だけ）。おなじ よびかたの人がいても わかるように 自分で入れてもらう
  function askNames(n, go) {
    const saved = CFG.names || [];
    overlay(`<div class="card"><h2>${n === 2 ? "ふたりの なまえ" : "あなたの なまえ"}</h2>
      ${[0, 1].slice(0, n).map(k => `<input class="nm" id="nm${k}" maxlength="12" placeholder="${n === 2 ? (k + 1) + "人めの なまえ" : "なまえ"}" value="${esc(saved[k] || "")}">`).join("")}
      <div class="sub">あいての がめんに でます。おなじ よびかたの ひとが いても わかるように（れい：○○の おばあちゃん、△△ばあば）</div>
      <button class="big1" id="nmOk">けってい</button></div>`);
    $("nmOk").onclick = () => {
      const names = [0, 1].slice(0, n).map(k => $("nm" + k).value.trim());
      if (names.some(x => !x)) { $("nm" + names.findIndex(x => !x)).focus(); return; }
      CFG.names = n === 2 ? names : [names[0], saved[1] || ""]; saveCFG(); go(names);
    };
  }
  function pickCount(go, title = "このスマホで あそぶのは？") {
    overlay(`<div class="card"><h2>${title}</h2><div id="joinMsg" class="sub"></div>
      <div class="pick" id="joinPick"><button id="p1">ひとり</button><button id="p2">ふたり</button></div>
      <div class="sub">ふたりで 1だいを つかうときは「ふたり」</div></div>`);
    $("p1").onclick = () => { audio(); go(1); };
    $("p2").onclick = () => { audio(); go(2); };
  }
  let hostSid = "", guestSid = "";
  async function startHost(n, names, inv) {
    screenTok++;
    hostSid = Math.random().toString(36).slice(2, 10);
    invited = inv || [];
    mode = "host"; roster = [{ role: "host", dev: NET.dev, peer: null, seats: n === 2 ? [0, 1] : [0], online: true, names, pid: PEOPLE.pid }];
    mySeats = new Set(roster[0].seats); started = false;
    newGame(); lobby();
    await NET.host();
    roster[0].peer = "sanbasi-rm-" + NET.room;
    lobby(); videoLabels();
    if (invited.length) {
      callInvited();
      // 10分 そろわなければ おわり
      clearTimeout(inviteT); inviteT = setTimeout(() => { if (!started) endBy([], "10ぷん まっても そろわなかったので おわります"); }, 600000);
    }
  }
  function lobby() {
    if (started || mode === "solo") return;
    const myName = (roster[0] && roster[0].names || []).filter(Boolean).join("・");
    const url = NET.room ? NET.inviteURL() + (myName ? "&n=" + encodeURIComponent(myName) : "") : "";
    const seatLine = k => { const x = roster.find(r => r.seats.includes(k)); return `<div class="row">${chip(k)}${NAMES[k]}<span class="n">${x ? esc(nameOf(k) || "") + (x.dev === NET.dev ? "（このスマホ）" : "") : "まっています…"}</span></div>`; };
    let qr = "";
    if (url && mode === "host" && typeof qrcode !== "undefined") { const g = qrcode(0, "M"); g.addData(invited.length ? inviteURLFor() : url); g.make(); qr = g.createSvgTag({ cellSize: 4, margin: 2 }); }
    overlay(`<div class="card"><h2>${mode === "host" ? "あいてを よぶ" : "つながりました"}</h2>
      ${[0, 1, 2].map(seatLine).join("")}
      <div class="sub">3にん そろうと はじまります</div>
      ${mode === "host" && invited.length ? `<div class="lab">よんだ ひと</div>${invited.map((x, k) => `<div class="row inv ${x.st}">${esc(pnames(x))}<span class="n">${ST[x.st] || ""}</span></div>`).join("")}
        <button class="btn line" id="lineBtn">LINEで しらせる</button>
        <button class="small" id="recall">もういちど 通知で しらせる</button>
        <button class="small" id="addMore">ほかの ひとも よぶ</button>
        <details><summary>そばに いる ひとには QRコード</summary><div class="qr">${qr}</div><button class="small" id="copy">リンクを コピー</button></details>` :
       mode === "host" ? (url ? `<div class="qr">${qr}</div>
        <button class="btn line" id="lineBtn">LINEで おくる</button>
        <button class="btn" id="copy">リンクを コピー</button>
        <div class="sub">まえに あそんだ ひとは、じぶんの がめんの「${esc(myName || "あなた")}の へやに はいる」で はいれます（リンクは まえと おなじ）</div>` : `<div class="sub">へやを つくっています…</div>`) : ``}
      </div>`);
    const myN = (roster[0] && roster[0].names || []).filter(Boolean).join("・");
    const lb = $("lineBtn"), text = invited.length ? `${myN}です。いまサンバーシで遊べるよ！ このリンクをタップしてね。\n${inviteURLFor()}` : "サンバーシで あそぼう！\n" + url;
    // 共有画面（LINE をえらぶ）。送ると自動でこの画面に戻る。共有画面がない端末は LINE を直接ひらく
    if (lb) lb.onclick = () => shareText(text);
    if ($("recall")) $("recall").onclick = () => callInvited();
    if ($("addMore")) $("addMore").onclick = () => {
      const rest = people().filter(x => !invited.some(y => y.pid === x.pid));
      overlay(`<div class="card"><h2>ほかの ひとも よぶ</h2>${rest.length ? rest.map(x => `<button class="person" data-pid="${x.pid}">${esc(pnames(x))}</button>`).join("") : '<div class="sub">ほかに とうろくした ひとは いません</div>'}<button class="big2" id="amBack">もどる</button></div>`);
      document.querySelectorAll(".person").forEach(b => b.onclick = () => { const x = rest.find(y => y.pid === b.dataset.pid); const row = { pid: x.pid, names: x.names, st: "call" }; invited.push(row); lobby(); callInvited(row); });
      $("amBack").onclick = lobby;
    };
    const cp = $("copy"); if (cp) cp.onclick = () => { navigator.clipboard.writeText(url).then(() => { cp.textContent = "コピーしました"; }).catch(() => { cp.textContent = url; }); };
  }

  // ---- メニュー：やめる／はじめから／せってい ----
  function toMenu() {
    try { sessionStorage.removeItem(JOIN_KEY); } catch (e) { }
    try { NET.local && NET.local.getTracks().forEach(tr => tr.stop()); NET.peer && NET.peer.destroy(); } catch (e) { }
    const ps = new URLSearchParams(location.search).get("ps");   // 確認用の紹介役サーバーは引きつぐ
    location.replace(location.pathname + (ps ? "?ps=" + ps : ""));   // 読みなおすのが いちばん確実に まっさらに もどる
  }
  let ended = false;
  async function endBy(seatsOf, text) {
    if (ended) return; ended = true;
    busy = true; showHints(); $("sheet").classList.remove("show");
    for (const w of waiting.values()) clearTimeout(w.timer); waiting.clear(); showWaiting();
    try { sessionStorage.removeItem(JOIN_KEY); } catch (e) { }
    await banner(`${seatsOf.map(chip).join("")} ${seatsOf.map(k => esc(nameOf(k) || NAMES[k])).join("・") || "あいて"} ${text}`, 3200);
    toMenu();
  }
  async function quitByOther(seatsOf) {
    busy = true; showHints(); $("sheet").classList.remove("show");
    await banner(`${seatsOf.map(chip).join("")} ${seatsOf.map(k => esc(nameOf(k) || NAMES[k])).join("・") || "あいて"} が おわりにしました`, 2600);
    toMenu();
  }
  function menu() {
    const remote = mode !== "solo";
    overlay(`<div class="card"><h2>メニュー</h2>
      <button class="big2" id="mBack">つづける</button>
      ${remote ? "" : '<button class="big2" id="mRe">はじめから やりなおす</button>'}
      <button class="big2" id="mQuit">やめて はじめの がめんに もどる</button>
      ${remote ? '<div class="sub">あいてとの テレビでんわも おわります</div>' : ""}
      <button class="small" id="mSet">おとなの せってい</button></div>`);
    $("mBack").onclick = hideOverlay;
    if ($("mRe")) $("mRe").onclick = () => { hideOverlay(); game = 0; wins = [0, 0, 0]; totals = [0, 0, 0]; newGame(); };
    $("mQuit").onclick = () => { if (mode === "host") NET.broadcast({ t: "quit", seats: [...mySeats] }); else if (mode === "guest") NET.send({ t: "quit" }); setTimeout(toMenu, 300); };
    $("mSet").onclick = () => settings(menu);
  }
  function settings(back) {
    const opt = (k, v, label) => `<button class="opt ${CFG[k] === v ? "on" : ""}" data-k="${k}" data-v="${v}">${label}</button>`;
    overlay(`<div class="card set"><button class="x" id="sX">×</button><h2>おとなの せってい</h2>
      <div class="lab">おとの おおきさ</div><div class="opts">${opt("sfx", 0, "なし")}${opt("sfx", 1, "小")}${opt("sfx", 2, "中")}${opt("sfx", 3, "大")}</div>
      <div class="lab">えんしゅつ</div><div class="opts">${opt("fx", 2, "はで")}${opt("fx", 1, "ひかえめ")}</div>
      <div class="lab">つながりかた（テスト用）</div><div class="opts">${opt("relay", 0, "ふつう")}${opt("relay", 1, "中継サーバーだけ")}</div>
      <div class="sub" id="linkInfo">${NET.role ? "いまの つながり：しらべています…" : "「中継サーバーだけ」で つながれば、家の外どうしでも つながります"}</div>
      <button class="small" id="sSnd">おとの テスト（なおす）</button><div class="sub" id="sndInfo">${soundInfo()}</div>
      <div class="lab">とうろくした ひと</div>${people().length ? people().map(x => `<div class="row">${esc(pnames(x))}<button class="small pDel" data-pid="${x.pid}">けす</button></div>`).join("") : '<div class="sub">まだ いません</div>'}
      <button class="small" id="sReg">相手を登録する（リンクを送る）</button>
      <button class="small" id="sName">なまえを かえる（いま：${esc((CFG.names || []).filter(Boolean).join("・") || "まだ")}）</button>
      <button class="small" id="sRoom">あたらしい へやに する</button><div class="sub">まえに おくった リンクは つかえなくなります</div>
      <div class="ver">版 ${VERSION}</div>
      <button class="big2" id="sClose">とじる</button></div>`);
    document.querySelectorAll(".opt").forEach(b => b.onclick = () => { CFG[b.dataset.k] = +b.dataset.v; saveCFG(); settings(back); });
    $("sX").onclick = $("sClose").onclick = () => back ? back() : hideOverlay();
    $("sSnd").onclick = () => { if (ctx) rebuildAudio("テスト"); else audio(); setTimeout(() => { SFX.place(); setTimeout(() => SFX.flip(1, 1), 220); }, 60); setTimeout(() => { $("sndInfo").textContent = soundInfo(); }, 600); };
    document.querySelectorAll(".pDel").forEach(b => b.onclick = () => { if (b.dataset.armed) { PEOPLE.remove(b.dataset.pid); settings(back); } else { b.dataset.armed = 1; b.textContent = "もういちど おすと けす"; } });
    $("sReg").onclick = () => regScreen(() => settings(back));
    $("sName").onclick = () => askNames((CFG.names || []).filter(Boolean).length === 2 ? 2 : 1, () => settings(back));
    $("sRoom").onclick = () => { NET.newRoom(); $("sRoom").textContent = "つぎに よぶときから あたらしい へやです"; };
    if (NET.role) NET.linkType().then(x => { const e = $("linkInfo"); if (e) e.textContent = "いまの つながり：" + x; });
  }
  let noteT = 0;
  function note(html) { const n = $("note"); n.innerHTML = html + '<button id="noteX">とじる</button>'; n.classList.add("show"); $("noteX").onclick = () => n.classList.remove("show"); }

  // ---- タップ：いちばん近いマス ----
  board.addEventListener("click", e => {
    const rc = board.getBoundingClientRect(), x = e.clientX - rc.left, y = e.clientY - rc.top;
    let best = -1, bd = 1e9;
    SB.CELLS.forEach((c, i) => { const p = pos(i), d = (p.x - x) ** 2 + (p.y - y) ** 2; if (d < bd) { bd = d; best = i; } });
    if (bd < (s * .95) ** 2) play(best);
  });
  $("restart").onclick = () => { audio(); menu(); };
  addEventListener("resize", () => layout());
  // 演出のコマ送り
  let lastT = performance.now();
  (function loop(t) { if (t - lastT >= 30) { FX.step(Math.min(.05, (t - lastT) / 1000)); lastT = t; } requestAnimationFrame(loop); })(lastT);

  window.SANBASI = { get state() { return S; }, get busy() { return busy; }, get mode() { return mode; }, get mySeats() { return [...mySeats]; }, get started() { return started; }, get game() { return game; }, get hist() { return hist.slice(); }, play, nextGame };
  S = SB.replay([], 0); layout(); seats();
  const Q0 = new URLSearchParams(location.search);
  PEOPLE.reg(false);   // 名前と（アプリで許可ずみなら）通知の宛先を 中継に
  if (Q0.get("m") === "reg" && Q0.get("fd")) regWelcome(Q0.get("fd"), (Q0.get("fn") || "").slice(0, 30));
  else if (mode === "guest") {
    let j = null; try { j = JSON.parse(sessionStorage.getItem(JOIN_KEY)); } catch (e) { }
    if (j && j.room === NET.room && Date.now() - j.at < 60000) join(j.n, j.names);   // 読みなおし：そのまま 元の席へ
    else welcome();
  }
  else startScreen();
})();
