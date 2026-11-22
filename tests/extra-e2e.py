"""追加の確認：同じ端末で2つめの画面／やめる知らせ／カメラなし／設定の画面"""
import asyncio
from playwright.async_api import async_playwright
BASE = "http://127.0.0.1:8000/index.html?ps=127.0.0.1:9000"
ARGS = ["--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream", "--autoplay-policy=no-user-gesture-required"]
async def main():
    async with async_playwright() as pw:
        b = await pw.chromium.launch(args=ARGS); errs = []
        hc = await b.new_context(viewport={"width": 390, "height": 844}, permissions=["camera", "microphone"])
        host = await hc.new_page(); host.on("pageerror", lambda e: errs.append(str(e)))
        await host.goto(BASE); await host.click("#goFar"); await host.click("#p1")
        await host.wait_for_function("NET.room && NET.peer && NET.peer.open", timeout=20000)
        url = await host.evaluate("NET.inviteURL()")
        gc = await b.new_context(viewport={"width": 390, "height": 844}, permissions=["camera", "microphone"])
        g1 = await gc.new_page(); g1.on("pageerror", lambda e: errs.append(str(e)))
        await g1.goto(url); await host.wait_for_timeout(300); await g1.screenshot(path="/home/claude/sanbasi/shots/welcome.png")
        await g1.click("#p2"); await g1.wait_for_function("SANBASI.started", timeout=30000)
        # 同じ端末（同じ保存場所）で2つめの画面
        g2 = await gc.new_page(); await g2.goto(url); await g2.click("#p2")
        await g2.wait_for_function("document.querySelector('#ov').textContent.includes('ほかの がめん')", timeout=30000)
        print("2つめの画面は ことわられる: OK")
        print("1つめは つながったまま:", await g1.evaluate("NET.open"))
        # 設定の画面
        await host.click("#restart"); await host.click("#mSet"); await host.wait_for_timeout(1500)
        await host.screenshot(path="/home/claude/sanbasi/shots/settings.png")
        print("設定:", (await host.evaluate("document.querySelector('#linkInfo').textContent")))
        await host.click("#sClose"); await host.click("#mBack")
        # ゲストが やめる → ホストも はじめの画面へ
        await g1.click("#restart"); await g1.click("#mQuit")
        await host.wait_for_function("document.querySelector('#banner').textContent.includes('おわりにしました')", timeout=15000)
        print("やめる知らせ:", await host.evaluate("document.querySelector('#banner').textContent"))
        await host.wait_for_function("!location.search && document.querySelector('#goFar')", timeout=20000)
        print("ホストは はじめの画面に もどった: OK")
        # カメラなし（許可しない）
        nb = await pw.chromium.launch(args=["--autoplay-policy=no-user-gesture-required"])
        nc = await nb.new_context(viewport={"width": 390, "height": 844})
        np_ = await nc.new_page(); await np_.goto(BASE); await np_.click("#goFar"); await np_.click("#p1")
        await np_.wait_for_function("document.querySelector('#note').classList.contains('show')", timeout=20000)
        await np_.screenshot(path="/home/claude/sanbasi/shots/nocam.png")
        print("カメラなしの案内: OK")
        print("エラー:", errs)
        await nb.close(); await b.close()
asyncio.run(main())
