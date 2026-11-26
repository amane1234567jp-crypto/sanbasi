"""元の画面に 見出しを付けて App Store 用の画像にする。python3 app/store/compose.py <元の画面のフォルダ> <出力フォルダ>"""
import asyncio, sys, os
from playwright.async_api import async_playwright
SRC, OUT = sys.argv[1], sys.argv[2]
ITEMS = [("remote", "3人で遊べるリバーシ", "テレビ電話で顔を見ながら"), ("mid", "六角形の盤で", "最後まで逆転できる"),
         ("wild", "3色の「みんなの いし」は", "だれでも はさめる"), ("choose", "登録した人を", "選んで呼ぶだけ")]
def page(img, l1, l2, ipad, W):
    k = W / (2752 if ipad else 1320)
    return f"""<!doctype html><html><head><style>
html,body{{margin:0;width:100%;height:100%;overflow:hidden}}
body{{background:linear-gradient(170deg,#2f9d63 0%,#23804f 45%,#185f3a 100%);font-family:"Noto Sans CJK JP";display:flex;flex-direction:column;align-items:center}}
.cap{{color:#fff;text-align:center;font-weight:900;line-height:1.3;margin-top:{(70 if ipad else 150)*k}px;font-size:{(112 if ipad else 100)*k}px;text-shadow:0 6px 0 rgba(0,0,0,.18)}}
.cap span{{display:block}} .cap .y{{color:#FFE27A}}
.shot{{margin-top:{(60 if ipad else 100)*k}px;width:{70 if ipad else 84}%;border-radius:{(48 if ipad else 64)*k}px;border:{(14 if ipad else 18)*k}px solid #1b1b20;box-shadow:0 30px 80px rgba(0,0,0,.35);display:block}}
</style></head><body><div class="cap"><span>{l1}</span><span class="y">{l2}</span></div><img class="shot" src="file://{img}"></body></html>"""
async def main():
    os.makedirs(OUT, exist_ok=True)
    async with async_playwright() as pw:
        b = await pw.chromium.launch()
        for dev, W, H, name in [("phone", 1320, 2868, "iphone69"), ("ipad", 2752, 2064, "ipad13")]:
            p = await b.new_page(viewport={"width": W, "height": H})
            for n, (k, l1, l2) in enumerate(ITEMS, 1):
                f = f"/tmp/compose-{dev}.html"; open(f, "w").write(page(os.path.abspath(f"{SRC}/{dev}-{k}.png"), l1, l2, dev == "ipad", W))
                await p.goto("file://" + f); await p.wait_for_timeout(300); await p.screenshot(path=f"{OUT}/{name}-{n}.png")
        await b.close()
asyncio.run(main())
