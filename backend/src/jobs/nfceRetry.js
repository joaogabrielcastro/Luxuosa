export function isRetriableErr(err) {
  const code = err?.statusCode;
  if (code >= 500 && code < 600) return true;
  if (code === 504) return true;
  if (err?.code === "ETIMEDOUT") return true;
  const msg = String(err?.message || "");
  if (/timeout/i.test(msg)) return true;
  return false;
}

export function isRetriableLastError(lastError) {
  const s = String(lastError || "").toLowerCase();
  if (!s) return true;
  if (/timeout|502|503|504|temporar|indispon|throttle|rate/i.test(s)) return true;
  return false;
}
