const SB = require("./rules.js");
let fails = 0; const ok = (c, m) => { if (!c) { fails++; console.log("NG", m); } };
const s0 = SB.replay([], 0);
ok(SB.CELLS.length === 61, "61マス");
ok(JSON.stringify(SB.counts(s0)) === "[2,2,2]", "初期は各2個");
ok(SB.legal(s0, 0).length > 0 && SB.legal(s0, 1).length > 0 && SB.legal(s0, 2).length > 0, "全員に初手");
let N = 3000, empty = 0, zero = 0, wins = [0, 0, 0];
for (let g = 0; g < N; g++) {
  const first = g % 3, h = []; let s = SB.replay(h, first);
  while (!s.over) {
    const L = SB.legal(s, s.turn); ok(L.length, "手番の人は置ける");
    h.push(L[Math.floor(Math.random() * L.length)]); s = SB.replay(h, first);
    const c = SB.counts(s); if (Math.min(...c) === 0) zero++;
  }
  empty += s.b.filter(v => v < 0).length;
  ok(SB.WILDS.every(i => s.b[i] === SB.WILD), "みんなの石は そのまま");
  SB.winners(SB.counts(s)).forEach(w => wins[(w - first + 3) % 3]++);
  if (g < 50) { // 履歴が同じなら同じ盤
    ok(JSON.stringify(SB.replay(h, first).b) === JSON.stringify(s.b), "再現性");
  }
}
console.log("0個になった局面の数", zero);
console.log("局数", N, "残りの空き/局", (empty / N).toFixed(2), "先手/2番/3番の勝ち", wins, fails ? "失敗 " + fails : "すべてOK");
