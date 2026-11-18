// Makes the Claude-preview bundle from `ARTIFACT=1 next build`:
// the host reserves names starting with "_", so _next/ becomes app-files/.
import fs from "node:fs";
import path from "node:path";

const src = "out";
const dst = "out-artifact";
fs.rmSync(dst, { recursive: true, force: true });
fs.mkdirSync(dst, { recursive: true });

const files = [];
function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p);
    else files.push(p);
  }
}
walk(path.join(src, "_next"));

const fix = (t) =>
  t.replaceAll("_next/static", "app-files/static").replaceAll(`"./_next/"`, `"./app-files/"`).replaceAll("}/_next/", "}/app-files/");
for (const f of files) {
  const rel = path.relative(src, f).replace(/^_next/, "app-files");
  if (path.basename(rel).startsWith("_")) continue; // pages-router manifests, not used
  const out = path.join(dst, rel);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  if (/\.(js|css)$/.test(f)) fs.writeFileSync(out, fix(fs.readFileSync(f, "utf8")));
  else fs.copyFileSync(f, out);
}
fs.writeFileSync(path.join(dst, "index.html"), fix(fs.readFileSync(path.join(src, "index.html"), "utf8")));
const list = [];
(function w(d) { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); e.isDirectory() ? w(p) : list.push(path.relative(dst, p)); } })(dst);
console.log(JSON.stringify(list));
