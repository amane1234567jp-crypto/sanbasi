"""App Store 用の 元の画面（にせカメラ＝絵文字の顔）。使い方：python3 app/store/shots.py <出力フォルダ> <phone|ipad>
   前もって：python3 -m http.server 8000（リポジトリ直下）／peerjs --port 9000 --host 127.0.0.1／Zen Maru Gothic を /tmp/fonts に（npm i @fontsource/zen-maru-gothic）"""
import asyncio, sys, os, re, random
from playwright.async_api import async_playwright
OUT, DEV = sys.argv[1], sys.argv[2]
W, H, DSF = (440, 956, 3) if DEV == "phone" else (1376, 1032, 2)
BASE = "http://127.0.0.1:8000/index.html?ps=127.0.0.1:9000&relay=http://127.0.0.1:9100"
FD = "/tmp/fonts/node_modules/@fontsource/zen-maru-gothic"
CSS = "\n".join(open(f"{FD}/{w}.css").read().replace("url(./files/", "url(https://fontfiles.local/files/") for w in ["500", "700", "900"])
def cam(emoji, c1, c2): return """(() => {
  const mk = () => { const c = document.createElement('canvas'); c.width = 320; c.height = 240; const x = c.getContext('2d'); let t = 0;
    const draw = () => { t += 0.05; const g = x.createLinearGradient(0, 0, 0, 240); g.addColorStop(0, '%s'); g.addColorStop(1, '%s'); x.fillStyle = g; x.fillRect(0, 0, 320, 240);
      x.fillStyle = 'rgba(255,255,255,.25)'; x.beginPath(); x.arc(250, 50, 60, 0, 7); x.fill();
      x.fillStyle = '#000'; x.font = '150px "Noto Color Emoji"'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('%s', 160, 140 + Math.sin(t) * 4); requestAnimationFrame(draw); };
    draw(); const s = c.captureStream(12); const ac = new AudioContext(); const d = ac.createMediaStreamDestination(); s.addTrack(d.stream.getAudioTracks()[0]); return s; };
  navigator.mediaDevices.getUserMedia = async () => mk();
  document.addEventListener('DOMContentLoaded', () => { const st = document.createElement('style'); st.textContent = %r; document.head.appendChild(st); });
})();""" % (c1, c2, emoji, CSS)
async def ctx(b, emoji="🙂", c1="#ddd", c2="#eee"):
    c = await b.new_context(viewport={"width": W, "height": H}, device_scale_factor=DSF, permissions=["camera", "microphone"])
    async def font(r):
        p = r.request.url.split("fontfiles.local/")[1]; r_ = open(f"{FD}/{p}", "rb").read()
        await r.fulfill(status=200, content_type="font/woff2", headers={"access-control-allow-origin": "*"}, body=r_)
    await c.route("https://fontfiles.local/**", font); await c.add_init_script(cam(emoji, c1, c2))
    return await c.new_page()
async def names(p, base): await p.click("#p1"); await p.fill("#nm0", base); await p.click("#nmOk")
async def main():
    os.makedirs(OUT, exist_ok=True)
    async with async_playwright() as pw:
        b = await pw.chromium.launch(args=["--use-fake-ui-for-media-stream", "--autoplay-policy=no-user-gesture-required"])
        # 3) はじめの盤（1台で）＝ みんなの いし
        s = await ctx(b); await s.goto(BASE); await s.wait_for_timeout(500); await s.click("#goNear"); await s.wait_for_timeout(1500)
        await s.screenshot(path=f"{OUT}/{DEV}-wild.png")
        # 2) 中盤（1台で 36手）
        random.seed(7)
        for mv in range(36):
            await s.wait_for_function("!SANBASI.busy", timeout=20000)
            L = await s.evaluate("(()=>{const st=SANBASI.state;return st.over?[]:SB.legal(st,st.turn)})()")
            if not L: break
            await s.evaluate(f"SANBASI.play({random.choice(L)})")
        await s.wait_for_function("!SANBASI.busy", timeout=20000); await s.wait_for_timeout(800)
        await s.screenshot(path=f"{OUT}/{DEV}-mid.png")
        # 4) だれと あそぶ？
        c = await ctx(b); await c.goto(BASE); await c.click("#goFar"); await names(c, "ゆう")
        for pid, nm in [("A" * 24, "ばあば"), ("B" * 24, "いとこの けい"), ("C" * 24, "おばちゃん")]: await c.evaluate(f"PEOPLE.add('{pid}',['{nm}'])")
        await c.click("#goBack"); await c.click("#goFar"); await c.click("#p1"); await c.click("#nmOk"); await c.wait_for_selector(".person")
        await c.click(".person[data-pid='" + "A" * 24 + "']"); await c.click(".person[data-pid='" + "B" * 24 + "']"); await c.wait_for_timeout(500)
        await c.screenshot(path=f"{OUT}/{DEV}-choose.png")
        # 1) 3人で テレビ電話
        h = await ctx(b, "👦", "#bfe3ff", "#e9f6ff"); await h.goto(BASE); await h.click("#goFar"); await names(h, "ゆう")
        await h.wait_for_selector("#goOther"); await h.evaluate("SANBASI.linkHost()"); await h.wait_for_function("NET.room && NET.peer && NET.peer.open", timeout=20000)
        url = await h.evaluate("NET.inviteURL()")
        gs = []
        for emo, c1, c2, nm in [("👵", "#ffe0c2", "#fff4e6", "ばあば"), ("👧", "#e3d9ff", "#f4efff", "けい")]:
            g = await ctx(b, emo, c1, c2); await g.goto(url); await names(g, nm); gs.append(g); await g.wait_for_function("NET.open", timeout=30000)
        allp = [h] + gs
        for p in allp: await p.wait_for_function("SANBASI.started", timeout=30000)
        seats = [await p.evaluate("SANBASI.mySeats") for p in allp]
        random.seed(3)
        for mv in range(14):
            st = await h.evaluate("({turn:SANBASI.state.turn,over:SANBASI.state.over})")
            if st["over"]: break
            o = next(p for p, sx in zip(allp, seats) if st["turn"] in sx)
            await o.wait_for_function("!SANBASI.busy", timeout=30000)
            L = await o.evaluate("(()=>{const s=SANBASI.state;return SB.legal(s,s.turn)})()")
            await o.evaluate(f"SANBASI.play({random.choice(L)})")
            for p in allp: await p.wait_for_function(f"SANBASI.hist.length>={mv+1} && !SANBASI.busy", timeout=40000)
        # ゆう（ホスト）の番になるまで進めて 撮る（置ける所が光る）
        await h.wait_for_timeout(2500); await h.screenshot(path=f"{OUT}/{DEV}-remote.png")
        await b.close()
asyncio.run(main())
