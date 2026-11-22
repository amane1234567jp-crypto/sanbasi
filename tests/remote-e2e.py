"""3人の遠隔対戦の自動テスト：手元の紹介役サーバー（127.0.0.1:9000）と にせカメラで。
   case 2台：ホスト（ひとり）＋ゲスト（ふたり）／ case 3台：全員ひとり"""
import asyncio, sys
from playwright.async_api import async_playwright
BASE = "http://127.0.0.1:8000/index.html?ps=127.0.0.1:9000"
ARGS = ["--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream", "--autoplay-policy=no-user-gesture-required"]
async def names(p, n, base):
    for k in range(n):
        await p.fill(f"#nm{k}", f"{base}{k+1}")
    await p.click("#nmOk")
async def page(b, errs, tag):
    c = await b.new_context(viewport={"width": 390, "height": 844}, permissions=["camera", "microphone"])
    p = await c.new_page(); p.on("pageerror", lambda e: errs.append(f"{tag}: {e}")); return p
async def run(counts):
    async with async_playwright() as pw:
        b = await pw.chromium.launch(args=ARGS); errs = []
        host = await page(b, errs, "host"); await host.goto(BASE); await host.click("#goFar")
        await host.click("#p1" if counts[0] == 1 else "#p2"); await names(host, counts[0], "ホスト")
        await host.wait_for_function("NET.room && NET.peer && NET.peer.open", timeout=20000)
        url = await host.evaluate("NET.inviteURL()")
        guests = []
        for k, n in enumerate(counts[1:]):
            g = await page(b, errs, f"guest{k}"); await g.goto(url); await g.click("#p1" if n == 1 else "#p2"); await names(g, n, f"ゲスト{k}の"); guests.append(g)
            await g.wait_for_function("NET.open", timeout=30000)
        allp = [host] + guests
        for p in allp: await p.wait_for_function("SANBASI.started", timeout=30000)
        seats = [await p.evaluate("SANBASI.mySeats") for p in allp]
        print("席:", seats)
        await host.wait_for_timeout(3500)
        await host.screenshot(path=f"shots/remote{len(allp)}-start-host.png"); await guests[-1].screenshot(path=f"shots/remote{len(allp)}-start-guest.png")
        tiles = [await p.evaluate("document.querySelectorAll('.tile video').length") for p in allp]
        print("映像の数（自分ふくむ）:", tiles)
        playing = [await p.evaluate("[...document.querySelectorAll('.tile:not(.self) video')].map(v=>v.videoWidth>0&&!v.paused)") for p in allp]
        print("相手の映像が動いている:", playing)
        # 15手：番の人の端末で 打つ
        for mv in range(15):
            st = await host.evaluate("({turn:SANBASI.state.turn,over:SANBASI.state.over})")
            if st["over"]: break
            owner = next(p for p, s in zip(allp, seats) if st["turn"] in s)
            await owner.wait_for_function("!SANBASI.busy", timeout=30000)
            i = await owner.evaluate("(()=>{const s=SANBASI.state;const L=SB.legal(s,s.turn);return L[Math.floor(Math.random()*L.length)]})()")
            await owner.evaluate(f"SANBASI.play({i})")
            for p in allp: await p.wait_for_function(f"SANBASI.hist.length>={mv+1} && !SANBASI.busy", timeout=40000)
        hs = [await p.evaluate("SANBASI.hist.join(',')") for p in allp]
        print("履歴がそろっている:", len(set(hs)) == 1, len(hs[0].split(',')), "手")
        await host.screenshot(path=f"shots/remote{len(allp)}-mid-host.png"); await guests[0].screenshot(path=f"shots/remote{len(allp)}-mid-guest.png")
        # 再接続：ゲスト0 を読みなおして 同じ席に戻るか
        await guests[0].reload()   # 60秒以内の読みなおしは 聞きなおさず 元の席へ
        await guests[0].wait_for_function("SANBASI.started && SANBASI.hist.length>0", timeout=40000)
        print("読みなおし後の席:", await guests[0].evaluate("SANBASI.mySeats"), "履歴:", (await guests[0].evaluate("SANBASI.hist.join(',')")) == hs[0])
        print("エラー:", errs)
        await b.close()
asyncio.run(run([int(x) for x in sys.argv[1].split(",")]))
