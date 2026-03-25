import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const viteCache = path.join(__dirname, "..", "node_modules", ".vite");

try {
  fs.rmSync(viteCache, { recursive: true, force: true });
  console.log("[luxuosa] Cache do Vite removido:", viteCache);
} catch {
  // ok se não existir
}
