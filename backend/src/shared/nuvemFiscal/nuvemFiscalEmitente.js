import { env } from "../../config/env.js";
import { digitsOnly } from "./nuvemFiscalNfceBuilder.js";

/**
 * CNPJ usado na emissão NFC-e.
 * Multi-tenant: prioriza sempre o CNPJ da loja (Tenant.cnpj).
 * NUVEM_FISCAL_EMITENTE_CNPJ só entra se o tenant não tiver CNPJ válido (dev legado).
 */
export function resolveEmitenteCnpj(tenantCnpj) {
  const tenantDigits = digitsOnly(tenantCnpj);
  const envDigits = digitsOnly(env.nuvemFiscal.emitenteCnpj || "");

  if (tenantDigits.length === 14) {
    return {
      emitCnpj: tenantDigits,
      source: "tenant",
      envOverrideDefined: envDigits.length === 14,
      envOverrideIgnored: envDigits.length === 14 && envDigits !== tenantDigits
    };
  }

  if (envDigits.length === 14) {
    return {
      emitCnpj: envDigits,
      source: "env",
      envOverrideDefined: true,
      envOverrideIgnored: false
    };
  }

  return {
    emitCnpj: tenantDigits,
    source: "invalid",
    envOverrideDefined: envDigits.length === 14,
    envOverrideIgnored: false
  };
}

export function formatCnpjBr(cnpjDigits) {
  const d = digitsOnly(cnpjDigits);
  if (d.length !== 14) return d || "—";
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
}

/** Resumo fiscal da loja (multi-tenant) — exibido no app e no login. */
export function buildTenantFiscalContext(tenant) {
  const resolved = resolveEmitenteCnpj(tenant?.cnpj);
  const enableNfce = Boolean(tenant?.enableNfceEmission);
  const validCnpj = resolved.emitCnpj.length === 14;

  return {
    enableNfceEmission: enableNfce,
    emitenteCnpj: resolved.emitCnpj,
    emitenteCnpjFormatado: formatCnpjBr(resolved.emitCnpj),
    emitenteSource: resolved.source,
    envOverrideIgnored: resolved.envOverrideIgnored,
    willEmitNfce: enableNfce && validCnpj && resolved.source === "tenant",
    message: !enableNfce
      ? "NFC-e desligada nesta loja — vendas sem nota fiscal."
      : !validCnpj
        ? "CNPJ da loja inválido — não é possível emitir NFC-e."
        : resolved.source !== "tenant"
          ? "Emitente vem de variável do servidor, não do CNPJ da loja."
          : `NFC-e será emitida pelo CNPJ ${formatCnpjBr(resolved.emitCnpj)} desta loja.`
  };
}

export function listEmpresasFromApiBody(body) {
  if (!body) return [];
  if (Array.isArray(body.data)) return body.data;
  if (Array.isArray(body)) return body;
  if (body.cpf_cnpj) return [body];
  return [];
}
