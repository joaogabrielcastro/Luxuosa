const TOKEN_URL = "https://auth.nuvemfiscal.com.br/oauth/token";

let cache = { token: null, expiresAt: 0 };

/**
 * @param {{ clientId: string; clientSecret: string; oauthScope: string }} config
 */
export async function getNuvemFiscalAccessToken(config) {
  if (!config.clientId || !config.clientSecret) {
    const err = new Error("Credenciais Nuvem Fiscal ausentes.");
    err.statusCode = 503;
    throw err;
  }

  const now = Date.now();
  if (cache.token && now < cache.expiresAt - 60_000) {
    return cache.token;
  }

  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: config.clientId,
    client_secret: config.clientSecret,
    scope: config.oauthScope
  });

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body
  });

  const text = await res.text();
  if (!res.ok) {
    const err = new Error(`OAuth Nuvem Fiscal falhou (${res.status}).`);
    err.statusCode = 502;
    err.details = text;
    throw err;
  }

  const data = JSON.parse(text);
  cache.token = data.access_token;
  cache.expiresAt = now + (data.expires_in || 3600) * 1000;
  return cache.token;
}

export function clearNuvemFiscalTokenCache() {
  cache = { token: null, expiresAt: 0 };
}
