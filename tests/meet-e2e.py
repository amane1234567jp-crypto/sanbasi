"""待ちあわせ（2026-11-24）：A と C が おなじころに おたがいを よぶ → どちらかの部屋に そろう。
   D は 動いたほうの（もう ない部屋の）通知を ひらく → 自分を待っている部屋へ 自動で 移って 3人で はじまる。
   手元の にせ中継（tests/mock-relay.js :9100）と 紹介役サーバー（:9000）、http.server（:8000）で"""
import asyncio, json, urllib.request
from playwright.async_api import async_playwright
Q = "?ps=127.0.0.1:9000&relay=http://127.0.0.1:9100"
BASE = "http://127.0.0.1:8000/index.html" + Q
ARGS = ["--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream", "--autoplay-policy=no-user-gesture-required"]
log = lambda: json.load(urllib.request.urlopen("http://127.0.0.1:9100/"))["log"]
async def newp(b):
    c = await b.new_context(viewport={"width": 390, "height": 844}, permissions=["camera", "microphone"]); return await c.new_page()
async def chooser(p, name):
    await p.goto(BASE); await p.click("#goFar"); await p.click("#p1"); await p.fill("#nm0", name); await p.click("#nmOk"); await p.wait_for_selector("#goPlay")
async def main():
    async with async_playwright() as pw:
        b = await pw.chromium.launch(args=ARGS)
        A, C, D = await newp(b), await newp(b), await newp(b)
        for p, nm in [(A, "ばあば"), (C, "いとこ"), (D, "おば")]: await chooser(p, nm)
        pid = {k: await p.evaluate("PEOPLE.pid") for k, p in [("A", A), ("C", C), ("D", D)]}
        nm = {"A": "ばあば", "C": "いとこ", "D": "おば"}
        for k, p in [("A", A), ("C", C), ("D", D)]:
            for o in "ACD":
                if o != k: await p.evaluate(f"PEOPLE.add('{pid[o]}',['{nm[o]}'])")
            await p.click("#goBack"); await p.click("#goFar"); await p.click("#p1"); await p.click("#nmOk"); await p.wait_for_selector("#goPlay")
        # A：C と D／C：A と D を えらんで ほぼ同時に よぶ
        for p, sel in [(A, "CD"), (C, "AD")]:
            for o in sel: await p.click(f".person[data-pid='{pid[o]}']")
        await asyncio.gather(A.click("#goPlay"), C.click("#goPlay"))
        await A.wait_for_timeout(16000)
        modes = {k: await p.evaluate("SANBASI.mode") for k, p in [("A", A), ("C", C)]}
        print("A と C：", modes)
        host = "A" if modes["A"] == "host" else "C"; moved = "C" if host == "A" else "A"
        hp = A if host == "A" else C
        print("ホストの名簿:", await hp.evaluate("JSON.stringify((window.__r=[...document.querySelectorAll('#ov .row')].map(e=>e.textContent)).slice(0,3))"))
        # D：動いたほうからの（古い）通知を ひらく
        calls = [c for c in log() if c["to"] == pid["D"]]
        print("D への よびだし:", [(k, c["url"].split("r=")[1][:6]) for c in calls for k in "AC" if c["from"] == pid[k]])
        stale = [c for c in calls if c["from"] == pid[moved]]
        url = (stale or calls)[0]["url"]
        await D.goto(url); await D.click("#p1"); await D.click("#nmOk")
        await D.wait_for_function("SANBASI.started", timeout=60000)
        print("D は 自分を待っている部屋へ 移った：", (await D.evaluate("NET.room")) == (await hp.evaluate("NET.room")))
        for p in [A, C]: await p.wait_for_function("SANBASI.started", timeout=30000)
        print("3人で はじまった：", [await p.evaluate("SANBASI.mySeats") for p in [A, C, D]])
        await hp.wait_for_timeout(2500); await hp.screenshot(path="shots/meet-host.png")
        await b.close()
asyncio.run(main())
