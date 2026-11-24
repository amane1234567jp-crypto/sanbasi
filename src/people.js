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
    // 名前と（アプリなら）通知の宛先を 中継に登録。pending などは 登録が すんでから（はじめての起動で 403 にならないように。リバーシ 1.0.7 の教訓）
    ready: null,
    reg(askPush) {
      const job = (async () => {
        let expo = null;
        if (NATIVE.on) expo = await NATIVE.pushToken(askPush);
        const r = await this.api("reg", { names: (CFG.names || []).filter(Boolean), expo: expo || undefined });
        this.push = !!expo; return r;
      })();
      this.ready = job; return job;
    },
    // 自分のリンクで とうろくした人を受けとる → 足した人の名前の一覧を返す
    async pending() {
      try { await this.ready; } catch (e) { }
      const r = await this.api("pending");
      const got = [];
      if (r && r.ok) for (const x of r.list || []) { this.add(x.pid, x.names); got.push(x.names.join("・")); }
      return got;
    },
    accept(to, names) { return this.api("accept", { to, names }); },
    call(to, title, body, url) { return this.api("call", { to, title, body, url, tag: "sb-play" }); },
    /* 待ちあわせ（2026-11-24。リバーシ 1.0.8 の 3人版）：よんだ人を 自分の部屋で待っている、と 5秒ごとに 中継へ。
       wait → 自分が よんだ人のうち、自分を待っている人（20秒以内）を others で返す。peek → 自分を待っている人 ぜんぶ */
    async wait(to, room, n, names) { const r = await this.api("wait", { to, room, n, names }); return (r && r.others) || []; },
    async peek() { try { await this.ready; } catch (e) { } const r = await this.api("peek"); return (r && r.others) || []; },
    unwait() { try { fetch(RELAY, { method: "POST", keepalive: true, headers: { "content-type": "application/json" }, body: JSON.stringify({ op: "unwait", id: CFG.pid, secret: CFG.psec }) }).catch(() => { }); } catch (e) { } },
    // とうろくリンク（だれが開いても この端末と とうろくされる。LINE のグループに送ってよい）
    regURL() {
      const base = window.RVNative ? "https://amane1234567jp-crypto.github.io/sanbasi/" : location.origin + location.pathname;
      const ex = ["ps", "relay"].map(k => q.get(k) ? `&${k}=${q.get(k)}` : "").join("");
      return base + "?m=reg&fd=" + CFG.pid + "&fn=" + encodeURIComponent((CFG.names || []).filter(Boolean).join("・")) + ex;
    },
  };
  return P;
})();
/* ---------- 送る文面（テレビ電話リバーシ 1.0.6〜 の決まりを 写したもの） ----------
   ・送る前に アプリの中で 文面を見せて 直せる（LINE 側では 本文が見えない・直せない）。直した文は 次のために 覚える
   ・リンクも 文面の中に 見せる。送るときは このアプリの リンクを 正しいものに 置きかえ、消していたら 最後に つける
   ・受けとるのは おとな：ふつうの漢字かなまじり */
const MSG = (() => {
  const OUR = /https?:\/\/amane1234567jp-crypto\.github\.io\/sanbasi\/[^\s]*/g;
  const who = n => n ? n + "です。" : "";
  return {
    regBody: n => `${who(n)}3人で遊べるリバーシ「サンバーシ」で、いっしょに遊びませんか？ テレビ電話で顔を見ながら遊べます。\n下のリンクを開くと登録できます。`,
    playBody: n => `${who(n)}いまサンバーシで遊べるよ！ このリンクをタップしてね。`,
    withLink: (body, url) => (String(body || "").trim() ? String(body).trim().slice(0, 300) + "\n" : "") + url,
    fixLink(text, url) {
      let t = String(text || "").slice(0, 600), seen = false;
      t = t.replace(OUR, () => { if (seen) return ""; seen = true; return url; }).replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
      // 手元の確認用（127.0.0.1）の リンクも おなじ あつかい
      if (!seen) t = t.replace(/https?:\/\/127\.0\.0\.1:\d+\/[^\s]*/g, () => { if (seen) return ""; seen = true; return url; }).trim();
      return seen ? t : (t ? t + "\n" : "") + url;
    },
    lineURL: text => "https://line.me/R/share?text=" + encodeURIComponent(text),
  };
})();
