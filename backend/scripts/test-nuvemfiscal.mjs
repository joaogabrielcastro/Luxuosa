/**
 * Testa credenciais Nuvem Fiscal sem subir o servidor (OAuth + GET /empresas).
 * Uso: na pasta backend, com variáveis em .env ou no shell:
 *   npm run test:nuvemfiscal
 */
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "..", ".env") });

const TOKEN_URL = "https://auth.nuvemfiscal.com.br/oauth/token";

const clientId = process.env.NUVEM_FISCAL_CLIENT_ID?.trim();
const clientSecret = process.env.NUVEM_FISCAL_CLIENT_SECRET?.trim();
const apiBase = (process.env.NUVEM_FISCAL_API_BASE || "https://api.sandbox.nuvemfiscal.com.br").replace(
  /\/$/,
  ""
);
const scope = process.env.NUVEM_FISCAL_OAUTH_SCOPE || "empresa nfe nfce";

if (!clientId || !clientSecret) {
  console.error("Defina NUVEM_FISCAL_CLIENT_ID e NUVEM_FISCAL_CLIENT_SECRET (ex.: em backend/.env).");
  process.exit(1);
}

const body = new URLSearchParams({
  grant_type: "client_credentials",
  client_id: clientId,
  client_secret: clientSecret,
  scope
});

const tokenRes = await fetch(TOKEN_URL, {
  method: "POST",
  headers: { "Content-Type": "application/x-www-form-urlencoded" },
  body
});

const tokenText = await tokenRes.text();
if (!tokenRes.ok) {
  console.error("Falha no OAuth:", tokenRes.status, tokenText);
  process.exit(1);
}

const { access_token: accessToken, expires_in: expiresIn } = JSON.parse(tokenText);
console.log("OAuth OK. Token expira em ~", expiresIn, "s");

const empRes = await fetch(`${apiBase}/empresas`, {
  headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" }
});

const empText = await empRes.text();
console.log("GET /empresas:", empRes.status);
try {
  console.log(JSON.stringify(JSON.parse(empText), null, 2));
} catch {
  console.log(empText);
}

if (!empRes.ok) process.exit(1);
