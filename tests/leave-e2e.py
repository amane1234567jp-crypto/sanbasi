"""だれかが いなくなったとき：30秒 まって、もどれば つづき／もどらなければ 全員 はじめの画面へ"""
import asyncio, time
from playwright.async_api import async_playwright
BASE = "http://127.0.0.1:8000/index.html?ps=127.0.0.1:9000"
ARGS = ["--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream", "--autoplay-policy=no-user-gesture-required"]
async def newp(b):
    c = await b.new_context(viewport={"width": 390, "height": 844}, permissions=["camera", "microphone"]); p = await c.new_page(); return p
async def names(p, n, base):
    for k in range(n): await p.fill(f"#nm{k}", f"{base}{k+1}")
    await p.click("#nmOk")
async def setup(b):
    h = await newp(b); await h.goto(BASE); await h.click("#goFar"); await h.click("#p1"); await names(h, 1, "おや"); await h.click("#goOther"); await h.click("#goLink")
    await h.wait_for_function("NET.peer && NET.peer.open", timeout=20000); url = await h.evaluate("NET.inviteURL()")
    gs = []
    for k in range(2):
        g = await newp(b); await g.goto(url); await g.click("#p1"); await names(g, 1, f"こ{k}"); gs.append(g)
    for p in [h] + gs: await p.wait_for_function("SANBASI.started", timeout=30000)
    allp = [h] + gs
    for _ in range(3):
        st = await h.evaluate("SANBASI.state.turn"); o = allp[st]
        await o.wait_for_function("!SANBASI.busy", timeout=30000)
        i = await o.evaluate("(()=>{const s=SANBASI.state;return SB.legal(s,s.turn)[0]})()"); await o.evaluate(f"SANBASI.play({i})"); await h.wait_for_timeout(2500)
    return h, gs
atMenu = "!location.search.includes('r=') && !!document.querySelector('#goFar')"
async def main():
    async with async_playwright() as pw:
        # 1) ゲストの読みなおし → 聞きなおさず 元の席・続き
        b = await pw.chromium.launch(args=ARGS); h, (g1, g2) = await setup(b)
        n0 = await h.evaluate("SANBASI.hist.length"); seat = await g1.evaluate("SANBASI.mySeats")
        await g1.reload(); await g1.wait_for_function(f"SANBASI.started && SANBASI.hist.length=={n0}", timeout=40000)
        print("1 ゲストの読みなおし：同じ席", seat == await g1.evaluate("SANBASI.mySeats"), "続き", n0, "手")
        await b.close()
        # 2) ゲストが もどらない → 30秒後 全員 はじめの画面
        b = await pw.chromium.launch(args=ARGS); h, (g1, g2) = await setup(b)
        await g2.context.close(); t = time.time()
        await h.wait_for_function("document.querySelector('#netNote').textContent.includes('まっています')", timeout=30000)
        print("2 待っている表示（ホスト）:", (await h.evaluate("document.querySelector('#netNote').textContent"))[:30])
        await g1.wait_for_function("document.querySelector('#netNote').textContent.includes('まっています')", timeout=15000)
        await h.wait_for_function(atMenu, timeout=90000); await g1.wait_for_function(atMenu, timeout=20000)
        print(f"  {time.time()-t:.0f}秒後に 2人とも はじめの画面へ")
        await b.close()
        # 3) ゲストが 30秒以内に もどる → 続き
        b = await pw.chromium.launch(args=ARGS); h, (g1, g2) = await setup(b)
        u = g2.url; ctx = g2.context; await g2.close()
        await h.wait_for_function("document.querySelector('#netNote').textContent.includes('まっています')", timeout=30000)
        g2 = await ctx.new_page(); await g2.goto(u)   # 同じ端末（保存場所）で もう一度ひらく（タブを閉じたので 人数・名前は聞かれる）
        await g2.click("#p1"); await g2.click("#nmOk")
        await g2.wait_for_function("SANBASI.started && SANBASI.hist.length>0", timeout=40000)
        await h.wait_for_timeout(1500)
        print("3 もどった：ホストの待ち表示が消えた", not await h.evaluate("document.querySelector('#netNote').classList.contains('show')"), "／続きの手数", await g2.evaluate("SANBASI.hist.length"))
        await h.wait_for_timeout(35000); print("  30秒すぎても 対局は つづく:", await h.evaluate("SANBASI.started && !location.search.includes('r=')"), await g1.evaluate("SANBASI.started"))
        await b.close()
        # 4) 親が いなくなる → 30秒（＋切れたと気づくまで）後 ゲストは はじめの画面へ
        b = await pw.chromium.launch(args=ARGS); h, (g1, g2) = await setup(b)
        await h.context.close(); t = time.time()
        await g1.wait_for_function("document.querySelector('#netNote').textContent.includes('まっています')", timeout=30000)
        await g1.wait_for_function(atMenu, timeout=90000); await g2.wait_for_function(atMenu, timeout=20000)
        print(f"4 親が いなくなった：{time.time()-t:.0f}秒後に ゲスト2人とも はじめの画面へ")
        await b.close()
        # 5) 親が 読みなおして もう一度 部屋をひらく → ゲストは おわり
        b = await pw.chromium.launch(args=ARGS); h, (g1, g2) = await setup(b)
        await h.reload(); await h.click("#goFar"); await h.click("#p1"); await h.click("#nmOk"); await h.click("#goOther"); await h.click("#goLink")
        await g1.wait_for_function(atMenu, timeout=90000)
        print("5 親が はじめから：ゲストは はじめの画面へ OK")
        await b.close()
asyncio.run(main())
