"""とうろく と よびだし（手元の にせ中継 tests/mock-relay.js と 紹介役サーバーで）
   A（おばあちゃん・1人）／B（孫の端末・2人）／C・D（べつの家・1人ずつ）"""
import asyncio, json, urllib.request
from playwright.async_api import async_playwright
Q = "?ps=127.0.0.1:9000&relay=http://127.0.0.1:9100"
BASE = "http://127.0.0.1:8000/index.html" + Q
ARGS = ["--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream", "--autoplay-policy=no-user-gesture-required"]
log = lambda: json.load(urllib.request.urlopen("http://127.0.0.1:9100/"))["log"]
async def newp(b):
    c = await b.new_context(viewport={"width": 390, "height": 844}, permissions=["camera", "microphone"]); return await c.new_page()
async def names(p, n, base):
    for k in range(n): await p.fill(f"#nm{k}", f"{base}{k+1}" if n > 1 else base)
    await p.click("#nmOk")
async def people(p): return await p.evaluate("PEOPLE.list().map(x=>x.names.join('・'))")
async def main():
    async with async_playwright() as pw:
        b = await pw.chromium.launch(args=ARGS)
        A = await newp(b); await A.goto(BASE); await A.click("#goFar"); await A.click("#p1"); await names(A, 1, "ばあば")
        await A.wait_for_selector("#goReg"); await A.click("#goReg"); await A.wait_for_selector("#regLine")
        await A.screenshot(path="/home/claude/sanbasi/shots/reg-screen.png")
        reg = await A.evaluate("PEOPLE.regURL()"); print("とうろくリンク:", reg.split("?")[1][:60], "…")
        # B（ふたり）・C・D が 同じリンクを ひらく（LINE のグループに 送った想定）
        devs = {}
        for key, n, nm in [("B", 2, "まご"), ("C", 1, "いとこ"), ("D", 1, "おば")]:
            p = await newp(b); await p.goto(reg); await p.wait_for_selector("#p1")
            if key == "B": await p.screenshot(path="/home/claude/sanbasi/shots/reg-welcome.png")
            await p.click("#p1" if n == 1 else "#p2"); await names(p, n, nm)
            await p.wait_for_function("document.querySelector('#ov').textContent.includes('登録しました')", timeout=15000)
            devs[key] = p
        print("B の とうろくした ひと:", await people(devs["B"]))
        await A.click("#regBack"); await A.wait_for_function("PEOPLE.list().length>=3", timeout=25000)
        print("A に 届いた:", await people(A))
        await A.screenshot(path="/home/claude/sanbasi/shots/chooser.png")
        # A：C と D を えらんで あそぼう
        for k in ["C", "D"]:
            pid = await devs[k].evaluate("PEOPLE.pid"); await A.click(f".person[data-pid='{pid}']")
        print("あそぼう ボタン:", "押せる" if await A.evaluate("!document.querySelector('#goPlay').disabled") else "押せない")
        await A.click("#goPlay"); await A.wait_for_function("NET.peer && NET.peer.open", timeout=20000); await A.wait_for_timeout(1500)
        calls = log(); print("よびだし:", len(calls), "件 →", [c["body"][:16] for c in calls])
        url = calls[-1]["url"]
        # C は「いまは むり」→ A に すぐ出る
        C = devs["C"]; await C.goto(url); await C.wait_for_selector("#pNo"); await C.screenshot(path="/home/claude/sanbasi/shots/inv-welcome.png")
        await C.click("#pNo"); await C.wait_for_function("document.querySelector('#ov').textContent.includes('つたえました')", timeout=20000)
        await A.wait_for_function("document.querySelector('#ov').textContent.includes('いまは むり')", timeout=15000)
        await A.screenshot(path="/home/claude/sanbasi/shots/lobby-invited.png")
        print("C の ことわり → A の画面:", "いまは むり と表示")
        # A：ほかの ひとも よぶ → B（ふたり）
        await A.click("#addMore"); pidB = await devs["B"].evaluate("PEOPLE.pid"); await A.click(f".person[data-pid='{pidB}']"); await A.wait_for_timeout(1500)
        # D と B が はいる
        D = devs["D"]; await D.goto(url); await D.click("#p1"); await D.click("#nmOk")
        B = devs["B"]; await B.goto(url); await B.click("#p2"); await B.click("#nmOk")
        await B.wait_for_timeout(4000)
        st = await A.evaluate("SANBASI.started"); print("A+D(1)+B(2)=4人 → 始まった:", st, "／B:", (await B.evaluate("document.querySelector('#ov').textContent"))[:24])
        await B.click("#p1")   # 1人で はいりなおす（名前は さっきのを使う）
        for p in [A, D, B]: await p.wait_for_function("SANBASI.started", timeout=30000)
        await A.wait_for_timeout(2000)
        print("始まった。自動とうろく → D:", await people(D), "／B:", await people(B))
        await b.close()
asyncio.run(main())
