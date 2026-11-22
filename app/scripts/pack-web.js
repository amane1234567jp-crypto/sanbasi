// ゲーム本体（リポジトリ直下の index.html と lib）を assets/web.zip にまとめる
const AdmZip = require("adm-zip"), path = require("path"), fs = require("fs");
const root = path.resolve(__dirname, "..", "..");
const zip = new AdmZip();
zip.addFile("index.html", fs.readFileSync(path.join(root, "index.html")));
zip.addLocalFolder(path.join(root, "lib"), "lib");
const out = path.resolve(__dirname, "..", "assets", "web.zip");
zip.writeZip(out);
const ver = (fs.readFileSync(path.join(root, "index.html"), "utf8").match(/const VERSION = "([^"]+)"/) || [])[1] || "";
fs.writeFileSync(path.resolve(__dirname, "..", "assets", "web-version.json"), JSON.stringify({ ver, at: new Date().toISOString() }));
console.log("web.zip", (fs.statSync(out).size / 1024 | 0) + " KB", ver);
