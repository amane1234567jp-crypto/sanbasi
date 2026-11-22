/* ---------- とうろくした ひと（この端末に保存）と 中継（sb-push）とのやりとり ----------
   この端末の名乗り：CFG.pid（24文字）と CFG.psec（中継に名乗る合言葉）。相手の pid を知っている＝よべる。
   CFG.people = [{ pid, names: [..1〜2人], at }]（新しい順）。
   ふえ方は3つ：①とうろくリンクを開いた（相手を足す）②自分のリンクを開いた人がいた（中継の pending で受けとる）
   ③いっしょに3人で遊んだ（対局がはじまったとき 名簿から 自動で足す。2026-11-22 決定） */
const PEOPLE = (() => {
  const q = new URLSearchParams(location.search);
  const RELAY = q.get("relay") || "https://rlqeoyvevaglwngxtvrw.supabase.co/functions/v1/sb-push";
  const rnd = n => { const a = new Uint8Array(n); crypto.getRandomValues(a); return Array.from(a, b => "abcdefghijkmnpqrstuvwxyz23456789ABCDEFGHJKLMNPQRSTUVWXYZ"[b % 56]).join(""); };
  if (!CFG.pid) { CFG.pid = rnd(24); CFG.psec = rnd(32); saveCFG(); }
  const P = {
    pid: CFG.pid,
    push: false,      // この端末に 通知が届くか（アプリで 通知を許可したとき）
    list() { return (CFG.people || []).filter(x => x.pid !== CFG.pid); },
    add(pid, names, quiet) {
      if (!pid || pid === CFG.pid || !/^[A-Za-z0-9_-]{16,64}$/.test(pid)) return false;
      names = (names || []).map(s => String(s).slice(0, 12)).filter(Boolean).slice(0, 2);
      const list = CFG.people || [], cur = list.find(x => x.pid === pid), isNew = !cur;
      const row = { pid, names: names.length ? names : (cur ? cur.names : ["？"]), at: Date.now() };
      CFG.people = [row, ...list.filter(x => x.pid !== pid)].slice(0, 30); saveCFG();
      return isNew;
    },
    remove(pid) { CFG.people = (CFG.people || []).filter(x => x.pid !== pid); saveCFG(); },
    async api(op, body) {
      try {
        const r = await fetch(RELAY, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(Object.assign({ op, id: CFG.pid, secret: CFG.psec }, body || {})) });
        return await r.json();
      } catch (e) { return { ok: false, reason: "net" }; }
    },
    // 名前と（アプリなら）通知の宛先を 中継に登録
    async reg(askPush) {
      let expo = null;
      if (NATIVE.on) expo = await NATIVE.pushToken(askPush);
      const r = await this.api("reg", { names: (CFG.names || []).filter(Boolean), expo: expo || undefined });
      this.push = !!expo; return r;
    },
    // 自分のリンクで とうろくした人を受けとる → 足した人の名前の一覧を返す
    async pending() {
      const r = await this.api("pending");
      const got = [];
      if (r && r.ok) for (const x of r.list || []) { this.add(x.pid, x.names); got.push(x.names.join("・")); }
      return got;
    },
    accept(to, names) { return this.api("accept", { to, names }); },
    call(to, title, body, url) { return this.api("call", { to, title, body, url, tag: "sb-play" }); },
    // とうろくリンク（だれが開いても この端末と とうろくされる。LINE のグループに送ってよい）
    regURL() {
      const base = window.RVNative ? "https://amane1234567jp-crypto.github.io/sanbasi/" : location.origin + location.pathname;
      const ex = ["ps", "relay"].map(k => q.get(k) ? `&${k}=${q.get(k)}` : "").join("");
      return base + "?m=reg&fd=" + CFG.pid + "&fn=" + encodeURIComponent((CFG.names || []).filter(Boolean).join("・")) + ex;
    },
  };
  return P;
})();
