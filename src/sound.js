/* ---------- 音の出口（テレビ電話リバーシ 2026-11-07〜08 と同じ対策） ----------
   1) navigator.audioSession（iOS 17 以降）：1台のときは "playback"、通話のときは "play-and-record"。
      電話のあとは iOS が戻してしまうことがあるので、画面に戻るたび・さわるたびに 設定しなおす
   2) 1台のときは 無音の WAV を audio 要素でくりかえし流す（iPhone のマナーモードでも 効果音が出る）
   3) 音の出口が止まっていたら resume。さわっても戻らなければ その場で作りなおす
   4) Android の通話中：効果音を通話と同じ線（MediaStream → audio 要素）で鳴らす。通話が始まったら出口を一度作りなおす */
const SOUND = { session: "なし", out: "ふつう", keep: null, rebuilt: 0, why: "" };
const IOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
function setSession(type) {
  try {
    if (!navigator.audioSession) { SOUND.session = "なし（古いiOS）"; return; }
    if (navigator.audioSession.type !== type) navigator.audioSession.type = type;
    SOUND.session = type;
  } catch (e) { SOUND.session = "設定できず"; }
}
const wantSession = () => NET.role ? "play-and-record" : "playback";
const SILENT = (() => {
  const n = 4000, b = new Uint8Array(44 + n), v = new DataView(b.buffer), w = (o, t) => [...t].forEach((ch, i) => b[o + i] = ch.charCodeAt(0));
  w(0, "RIFF"); v.setUint32(4, 36 + n, true); w(8, "WAVE"); w(12, "fmt "); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
  v.setUint32(24, 8000, true); v.setUint32(28, 8000, true); v.setUint16(32, 1, true); v.setUint16(34, 8, true); w(36, "data"); v.setUint32(40, n, true); b.fill(128, 44);
  let bin = ""; b.forEach(x => bin += String.fromCharCode(x)); return "data:audio/wav;base64," + btoa(bin);
})();
function keepAlive() {
  if (NET.role) { if (SOUND.keep) SOUND.keep.pause(); return; }
  if (!SOUND.keep) {
    const el = document.createElement("audio");
    el.setAttribute("playsinline", ""); el.setAttribute("x-webkit-airplay", "deny"); el.preload = "auto"; el.loop = true; el.src = SILENT;
    el.style.display = "none"; document.body.appendChild(el); SOUND.keep = el;
  }
  if (SOUND.keep.paused && !document.hidden) SOUND.keep.play().then(() => SOUND.out = "マナーモード対策あり", () => SOUND.out = "マナーモード対策できず");
}
const audioBase = audio;
audio = function () {
  const first = !ctx;
  if (first) setSession(wantSession());
  audioBase();
  if (first) { keepAlive(); if (SOUND.viaCall) routeViaCall(); }
  return ctx;
};
function routeViaCall() {
  try {
    const dest = ctx.createMediaStreamDestination();
    window.__out = dest;
    let el = SOUND.callEl;
    if (!el) { el = document.createElement("audio"); el.setAttribute("playsinline", ""); el.autoplay = true; el.style.display = "none"; document.body.appendChild(el); SOUND.callEl = el; }
    el.srcObject = dest.stream; el.muted = false; el.volume = 1;
    el.play().then(() => { SOUND.out = "通話の線"; }, () => { SOUND.out = "通話の線（再生できず）"; });
  } catch (e) { SOUND.out = "通話の線にできず"; window.__out = null; }
}
function rebuildAudio(why) {
  const old = ctx; ctx = null; try { old && old.close(); } catch (e) { }
  SOUND.rebuilt++; SOUND.why = why || ""; SOUND.tried = 0;
  audio();
}
function soundForCall() { setSession("play-and-record"); if (SOUND.keep) SOUND.keep.pause(); }
function freshForCall(why) {
  if (IOS || !ctx || SOUND.fresh) return;
  SOUND.fresh = why; SOUND.viaCall = true;
  if (!navigator.userActivation || navigator.userActivation.hasBeenActive) rebuildAudio("通話");
  else SOUND.needFresh = true;
}
function wakeSound(e) {
  if (!ctx) return;
  if (SOUND.callEl && SOUND.callEl.paused && !document.hidden) SOUND.callEl.play().catch(() => { });
  if (SOUND.needFresh && e) { SOUND.needFresh = false; return rebuildAudio("通話"); }
  setSession(wantSession());
  keepAlive();
  if (ctx.state === "running") { SOUND.tried = 0; return; }
  if (ctx.state === "closed" || (e && SOUND.tried)) return rebuildAudio(ctx.state);
  SOUND.tried = Date.now();
  try { const p = ctx.resume(); if (p && p.then) p.then(() => { if (ctx && ctx.state === "running") SOUND.tried = 0; }, () => { }); } catch (err) { }
}
document.addEventListener("pointerdown", wakeSound, true);
document.addEventListener("touchend", wakeSound, true);
function soundInfo() {
  const st = ctx ? ctx.state : "まだ";
  return `音：${st}・${SOUND.session}・${SOUND.out}${SOUND.viaCall && !SOUND.out.includes("通話") ? "・通話の線" : ""}${SOUND.rebuilt ? `・作りなおし${SOUND.rebuilt}回` : ""}`;
}
// 戻るボタンなどで古い画面がそのまま復元されたときは読みなおす（音の出口が死んでいる）
addEventListener("pageshow", e => { if (e.persisted) location.reload(); });

/* ---------- 画面を消さない（Wake Lock。ない端末は 音なしの小さな動画をくりかえし流す） ---------- */
let wake = null, sleepVid = null;
function keepAwakeVideo() {
  if (!sleepVid) {
    sleepVid = document.createElement("video");
    Object.assign(sleepVid, { src: "lib/nosleep.mp4", muted: true, loop: true, playsInline: true });
    sleepVid.setAttribute("playsinline", ""); sleepVid.setAttribute("muted", "");
    sleepVid.style.cssText = "position:fixed;width:1px;height:1px;opacity:0;pointer-events:none;left:0;top:0";
    document.body.appendChild(sleepVid);
    setInterval(() => { if (sleepVid && !sleepVid.paused && sleepVid.currentTime > 1) sleepVid.currentTime = 0; }, 15000);
  }
  sleepVid.play().catch(() => { });
}
let wantAwake = false;
async function keepAwake() {
  wantAwake = true;
  try { wake = await navigator.wakeLock.request("screen"); } catch (e) { wake = null; }
  if (!wake) keepAwakeVideo();
}
document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible" && wantAwake) keepAwake(); });
// iPadOS 15.4 より前の Safari 向け
if (!Array.prototype.at) Array.prototype.at = function (n) { n = Math.trunc(n) || 0; if (n < 0) n += this.length; return this[n]; };
