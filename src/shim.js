/* ---------- テレビ電話リバーシの効果音・演出を動かすための 下ごしらえ ----------
   sfx.js・fx.js は reversi からそのまま移植。そこで使う ctx / audio() / OUTN() / CFG / motion をここで用意する。 */
let ctx = null;
function audio() {
  try {
    if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === "suspended") ctx.resume();
  } catch (e) { }
  return ctx;
}
// 音の出口：ふだんは スピーカー。Android の通話中は 通話の線（sound.js の routeViaCall が window.__out を作る）
function OUTN() { return (window.__out && window.__out.context === ctx) ? window.__out : ctx.destination; }
/* 設定（この端末だけ）。sfx：音の大きさ 0〜3／fx：2=はで 1=ひかえめ／relay：1=中継サーバーだけで つなぐ（テスト用） */
const CFG_KEY = "sanbasi-cfg";
const CFG = Object.assign({ sfx: 2, fx: 2, slow: 0, relay: 0 }, (() => { try { return JSON.parse(localStorage.getItem(CFG_KEY)) || {}; } catch (e) { return {}; } })());
const saveCFG = () => { try { localStorage.setItem(CFG_KEY, JSON.stringify(CFG)); } catch (e) { } };
let motion = 1;
