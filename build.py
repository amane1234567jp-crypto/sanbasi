"""サンバーシを1枚のHTMLに組み立てる: python3 build.py → index.html"""
import pathlib
d = pathlib.Path(__file__).parent
r = lambda p: (d / p).read_text()
html = r("src/shell.html")
import subprocess, datetime
try: rev = subprocess.run(["git", "-C", str(d), "rev-parse", "--short", "HEAD"], capture_output=True, text=True).stdout.strip()
except Exception: rev = ""
VERSION = datetime.datetime.now(datetime.timezone(datetime.timedelta(hours=9))).strftime("%m/%d %H:%M") + (" " + rev if rev else "")
html = html.replace("__LIBS__", r("lib/peerjs.min.js") + "\n" + r("lib/qrcode.js"))
html = html.replace("__RULES__", r("src/rules.js"))
for k, f in [("__SHIM__", "src/shim.js"), ("__NATIVE__", "src/native.js"), ("__PEOPLE__", "src/people.js"), ("__SFX__", "src/sfx.js"), ("__FX__", "src/fx.js"), ("__NET__", "src/net.js"), ("__SOUND__", "src/sound.js"), ("__APP__", "src/app.js")]:
    html = html.replace(k, r(f))
html = html.replace("__VERSION__", VERSION)
(d / "index.html").write_text(html)   # GitHub Pages で そのまま公開
print("index.html", len(html))
