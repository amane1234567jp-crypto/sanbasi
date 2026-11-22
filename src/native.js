/* ---------- アプリ版の殻（app/App.js）とのやりとり ----------
   殻があるときは window.RVNative がある。ページ → 殻：postMessage(JSON)、殻 → ページ：window.RV.native(JSON)
   Web（GitHub Pages）では なにもしない。 */
const NATIVE = (() => {
  const on = !!window.RVNative, waits = {};
  const post = m => { try { window.ReactNativeWebView.postMessage(JSON.stringify(m)); } catch (e) { } };
  const wait = (t, ms) => new Promise(res => { waits[t] = res; setTimeout(() => { if (waits[t] === res) { delete waits[t]; res(null); } }, ms); });
  window.RV = { native(m) { const f = m && waits[m.t]; if (f) { delete waits[m.t]; f(m); } } };
  return {
    on,
    android: on && window.RVNative.platform === "android",
    // 共有画面（LINE を えらぶ）。送ったかどうかが わかる（iPhone）
    async share(text) { post({ t: "share", text }); return await wait("shared", 120000); },
    // Android：カメラ・マイクの許可を 殻で先にもらう（WebView の中だけでは 許可の画面が出ない）
    async media() { if (!this.android) return; post({ t: "needMedia" }); await wait("media", 60000); },
    open(url) { post({ t: "open", url }); },
  };
})();
