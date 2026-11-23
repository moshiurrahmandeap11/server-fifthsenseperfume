import fs from "fs";
import path from "path";

const map: Record<string, string> = JSON.parse(
  fs.readFileSync(path.resolve(process.cwd(), "scripts/public-url-map.json"), "utf8")
);
const srcDir = path.resolve(process.cwd(), "../ecombd-client/src");

function walk(dir: string, out: string[] = []): string[] {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (/\.(ts|tsx|js|jsx|json|css)$/.test(e.name)) out.push(p);
  }
  return out;
}

const files = walk(srcDir);
const keys = Object.keys(map).sort((a, b) => b.length - a.length);
let changedFiles = 0;

for (const file of files) {
  let content = fs.readFileSync(file, "utf8");
  let modified = false;
  for (const key of keys) {
    if (content.includes(`"${key}"`) || content.includes(`'${key}'`)) {
      content = content.split(`"${key}"`).join(`"${map[key]}"`);
      content = content.split(`'${key}'`).join(`'${map[key]}'`);
      modified = true;
    }
  }
  if (modified) {
    fs.writeFileSync(file, content, "utf8");
    changedFiles++;
    console.log("Updated:", path.relative(srcDir, file));
  }
}
console.log("Total files updated:", changedFiles);
