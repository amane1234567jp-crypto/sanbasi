/* ---------- サンバーシのルール（画面にも通信にも依存しない） ----------
   盤：1辺5マスの六角形（61マス）。座標は斜交座標 (q, r)。
   みんなの石（2026-11-22）：6つの角に、はじめから置いてある（中央はふつうのマス）。だれの石でもなく、裏返らず、数にも入らないが、
   だれでも挟むときの端に使える。これで確定石（角）がなくなり、最後まで取り合いが続く。
   色：0=くろ 1=しろ 2=あか。手番は 0→1→2 の順にまわる。第g局（0から）は色 g%3 が先手。
   城はなくした（2026-11-22）。みんなの石があれば、石が0個になっても挟み返せる。各色2個（中央を囲む6マス）ではじめる。
   対局は「手の履歴」（マス番号の列）だけで表す。パスは自動で入る。同じ履歴なら同じ盤になる（遠隔対戦の同期用）。 */
const SB = (() => {
  const R = (typeof SB_R !== "undefined" ? SB_R : 4), NP = 3, EMPTY = -1, WILD = 3;
  const CENTER_WILD = (typeof SB_CW !== "undefined" ? SB_CW : false);
  const DIRS = [[1, 0], [1, -1], [0, -1], [-1, 0], [-1, 1], [0, 1]];
  const CELLS = [];                       // [{q, r}]
  for (let q = -R; q <= R; q++) for (let r = -R; r <= R; r++) if (Math.max(Math.abs(q), Math.abs(r), Math.abs(q + r)) <= R) CELLS.push({ q, r });
  const IDX = new Map(CELLS.map((c, i) => [c.q + "," + c.r, i]));
  const idx = (q, r) => IDX.has(q + "," + r) ? IDX.get(q + "," + r) : -1;
  const HOLE = -1;   // 泉はなくなった
  const STEP = CELLS.map(c => DIRS.map(([dq, dr]) => idx(c.q + dq, c.r + dr)));   // となりのマス（なければ -1）

  /* はじめの配置（2026-11-22 案B）：みんなの石9個（6つの角＋中ほどに3個）、各色3個を盤のあちこちに離して置く。
     同じ色が1か所に固まらないので 1手で全部とられず、近くのみんなの石を足がかりに すぐ取り返せる。
     下の6つを 120°ずつ回して3回ずつ置く（回すたびに色は くろ→しろ→あか と1つずれる）。3 = みんなの石 */
  const BASE = [[6, 0, 3], [6, -6, 3], [-1, -2, 3], [-4, 2, 2], [2, 0, 0], [-2, -2, 2]];
  const rot = ([q, r]) => [-(q + r), q];
  function initial() {
    const b = new Array(CELLS.length).fill(EMPTY), castle = new Array(CELLS.length).fill(false);
    for (const [q, r, c] of BASE) {
      let p = [q, r];
      for (let k = 0; k < 3; k++) { const i = idx(p[0], p[1]); if (i >= 0) b[i] = c === WILD ? WILD : (c + k) % 3; p = rot(p); }
    }
    return { b, castle };
  }
  // 色 p が マス i に置いたときに返る石（方向ごと、近い順）
  function flipsFor(s, p, i) {
    if (i < 0 || s.b[i] !== EMPTY) return [];
    const out = [];
    for (let d = 0; d < 6; d++) {
      const line = []; let x = STEP[i][d];
      while (x >= 0 && s.b[x] !== EMPTY && s.b[x] !== p && s.b[x] !== WILD && !s.castle[x]) { line.push(x); x = STEP[x][d]; }
      if (line.length && x >= 0 && (s.b[x] === p || s.b[x] === WILD)) out.push(line);
    }
    return out;
  }
  function legal(s, p) {
    const list = [];
    for (let i = 0; i < CELLS.length; i++) { const f = flipsFor(s, p, i); if (f.length) list.push(i); }
    return list;
  }
  const counts = s => { const c = [0, 0, 0]; s.b.forEach(v => { if (v >= 0 && v < 3) c[v]++; }); return c; };
  // 色 p の手のあと：次に置ける人をさがす。とばされた人はパス。だれも置けなければ終局
  function advance(s, p) {
    const passed = [];
    for (let k = 1; k <= 3; k++) {
      const c = (p + k) % 3;
      if (legal(s, c).length) return { turn: c, passed };
      if (k < 3) passed.push(c);
    }
    return { turn: -1, passed: [] };
  }
  // 履歴から局面を作りなおす。first = この局の先手の色
  function replay(history, first) {
    const s = initial(); s.turn = first; s.over = false; s.last = -1; s.events = [];
    if (!legal(s, first).length) { const a = advance(s, (first + 2) % 3); s.turn = a.turn; }
    for (const i of history) {
      const p = s.turn, f = flipsFor(s, p, i);
      if (p < 0 || !f.length) throw new Error("ルール違反の手: " + i);
      s.b[i] = p; f.forEach(line => line.forEach(x => { s.b[x] = p; }));
      s.last = i;
      const a = advance(s, p);
      s.events.push({ p, i, flips: f, passed: a.passed });
      s.turn = a.turn;
    }
    s.over = s.turn < 0;
    return s;
  }
  // 1局の勝者（同点の首位は全員）
  function winners(c) { const m = Math.max(...c); return [0, 1, 2].filter(i => c[i] === m); }
  // セットの優勝：勝った局数 → 同じなら3局の石数の合計
  function setChampion(wins, totals) {
    const mw = Math.max(...wins); let top = [0, 1, 2].filter(i => wins[i] === mw);
    if (top.length > 1) { const mt = Math.max(...top.map(i => totals[i])); top = top.filter(i => totals[i] === mt); }
    return top;
  }
  return { R, NP, EMPTY, WILD, get WILDS() { const b = initial().b; return b.map((v, i) => v === WILD ? i : -1).filter(i => i >= 0); }, CELLS, HOLE, idx, initial, flipsFor, legal, counts, replay, winners, setChampion };
})();
if (typeof module !== "undefined") module.exports = SB;
