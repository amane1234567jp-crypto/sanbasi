"""招待・参加の場面ごとの確認（いまの作りで どうなるか を見る）"""
import asyncio
from playwright.async_api import async_playwright
BASE = "http://127.0.0.1:8000/index.html?ps=127.0.0.1:9000"
ARGS = ["--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream", "--autoplay-policy=no-user-gesture-required"]
async def newp(b):
    c = await b.new_context(viewport={"width": 390, "height": 844}, permissions=["camera", "microphone"]); return await c.new_page()
async def names(p, n, base):
    for k in range(n): await p.fill(f"#nm{k}", f"{base}{k+1}")
    await p.click("#nmOk")
async def host_up(p, n=1):
    await p.goto(BASE); await p.click("#goFar"); await p.click("#p1" if n == 1 else "#p2"); await names(p, n, "ホスト")
    await p.wait_for_function("NET.peer && NET.peer.open", timeout=20000); return await p.evaluate("NET.inviteURL()")
async def guest_go(p, url, n, base):
    await p.goto(url); await p.click("#p1" if n == 1 else "#p2"); await names(p, n, base)
async def main():
    async with async_playwright() as pw:
        b = await pw.chromium.launch(args=ARGS)
        # A：ゲストが ホストより先に リンクを開く
        h = await newp(b); url = await host_up(h); await h.close()
        g1 = await newp(b); await guest_go(g1, url, 1, "A"); await g1.wait_for_timeout(4000)
        h = await newp(b)  # 別の端末あつかい（保存場所が別）なので 部屋が変わる → 同じ部屋で開きなおすには 同じ保存場所が要る
        print("A 先にゲスト：ゲストは待ち続ける（ホストの部屋が開くまで）:", await g1.evaluate("NET.open"))
        await b.close(); b = await pw.chromium.launch(args=ARGS)
        # B：ふたり＋ふたり（4人）
        h = await newp(b); url = await host_up(h, 2)
        g1 = await newp(b); await guest_go(g1, url, 2, "B"); await g1.wait_for_timeout(5000)
        print("B ふたり＋ふたり:", (await g1.evaluate("document.querySelector('#ov').textContent"))[:40])
        await b.close(); b = await pw.chromium.launch(args=ARGS)
        # C：2台・ひとりずつ（2人しかいない）
        h = await newp(b); url = await host_up(h, 1)
        g1 = await newp(b); await guest_go(g1, url, 1, "C"); await g1.wait_for_timeout(5000)
        print("C 2人だけ：始まる？", await h.evaluate("SANBASI.started"), "／ホストの画面:", (await h.evaluate("document.querySelector('#ov').textContent"))[:30])
        # D：3人目が来て対局 → ホストが 読みなおす
        g2 = await newp(b); await guest_go(g2, url, 1, "D"); await h.wait_for_function("SANBASI.started", timeout=30000)
        for _ in range(6):
            st = await h.evaluate("SANBASI.state.turn"); owner = [h, g1, g2][st]
            await owner.wait_for_function("!SANBASI.busy", timeout=30000)
            i = await owner.evaluate("(()=>{const s=SANBASI.state;return SB.legal(s,s.turn)[0]})()"); await owner.evaluate(f"SANBASI.play({i})")
            await h.wait_for_timeout(2500)
        before = await g1.evaluate("SANBASI.hist.length")
        await h.reload(); await h.wait_for_timeout(1500)
        print("D ホストが読みなおし：ホストの画面:", (await h.evaluate("document.querySelector('#ov').textContent"))[:20])
        await h.click("#goFar"); await h.click("#p1"); await h.click("#nmOk"); await h.wait_for_timeout(9000)
        print("   もう一度へやを開くと：ゲストの手数", before, "→", await g1.evaluate("SANBASI.hist.length"), "／ゲストの色", await g1.evaluate("SANBASI.mySeats"), await g2.evaluate("SANBASI.mySeats"))
        # E：ゲストが 戻ってこない（タブを閉じる）→ その人の番で止まる？
        await h.wait_for_function("SANBASI.started", timeout=30000)
        await g2.close(); await h.wait_for_timeout(16000)
        print("E 1人いなくなった：ホストの札/小窓 off:", await h.evaluate("[...document.querySelectorAll('.tile.off')].length"), "／その人の番でも 進める手段:", "なし（メニューで やめるだけ）")
        await b.close()
asyncio.run(main())
