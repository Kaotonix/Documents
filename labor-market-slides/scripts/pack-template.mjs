import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import JSZip from "jszip";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const srcDir = path.join(root, "assets", "magnit-temp");
const outFile = path.join(root, "assets", "magnit-template.pptx");

async function addDir(zip, absDir, zipPrefix) {
  const entries = fs.readdirSync(absDir, { withFileTypes: true });
  for (const e of entries) {
    const abs = path.join(absDir, e.name);
    const z = zipPrefix ? `${zipPrefix}/${e.name}` : e.name;
    if (e.isDirectory()) await addDir(zip, abs, z);
    else zip.file(z, fs.readFileSync(abs));
  }
}

if (!fs.existsSync(srcDir)) {
  console.warn("pack-template: assets/magnit-temp missing; skip");
  process.exit(0);
}

const zip = new JSZip();
await addDir(zip, srcDir, "");
const buf = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
fs.mkdirSync(path.dirname(outFile), { recursive: true });
fs.writeFileSync(outFile, buf);
console.log("Wrote", outFile, `(${(buf.length / 1024 / 1024).toFixed(2)} MB)`);
