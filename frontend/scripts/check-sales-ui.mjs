/**
 * Confere se NfceSalesPage.jsx no disco NÃO contém a UI antiga (cliente / NF-e manual).
 * Uso: na pasta frontend → node scripts/check-sales-ui.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const salesPath = path.join(__dirname, "..", "src", "features", "sales", "NfceSalesPage.jsx");
const src = fs.readFileSync(salesPath, "utf8");

const bad = [
  ["Cliente e pagamento", "Cliente e pagamento"],
  ['"Cliente"', "campo Cliente no formulário"],
  ["Emitir NF-e", "botão Emitir NF-e"],
  ["Sem nota", "texto Sem nota"]
];

let failed = false;
for (const [needle, label] of bad) {
  if (src.includes(needle)) {
    console.error(`FALHA: encontrado "${label}" em NfceSalesPage.jsx — arquivo parece ser a versão antiga.`);
    failed = true;
  }
}

if (!src.includes("consumidor final") || !src.includes("NFC-e")) {
  console.error("FALHA: NfceSalesPage.jsx não parece a versão nova (faltam textos NFC-e / consumidor final).");
  failed = true;
}

if (failed) {
  process.exit(1);
}

console.log("OK —", salesPath);
console.log("NfceSalesPage.jsx no disco está na versão NFC-e (sem cliente obrigatório na UI).");
