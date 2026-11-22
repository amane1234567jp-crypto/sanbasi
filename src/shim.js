/* ---------- テレビ電話リバーシの効果音・演出を動かすための 下ごしらえ ----------
   sfx.js・fx.js は reversi からそのまま移植。そこで使う ctx / audio() / OUTN() / CFG / motion をここで用意する。 */
let ctx = null;
function audio() {
  try {
    if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === "suspended") ctx.resume();
  } catch (e) { }
}
function OUTN() { return ctx.destination; }
const CFG = { sfx: 2, fx: 2, slow: 0 };
let motion = 1;
