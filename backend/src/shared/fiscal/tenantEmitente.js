export function digitsOnly(value) {
  return String(value ?? "").replace(/\D/g, "");
}

/**
 * Resolve o CNPJ emitente somente a partir do Tenant.cnpj.
 * @param {string|null|undefined} tenantCnpj
 */
export function resolveEmitenteCnpj(tenantCnpj) {
  const tenantDigits = digitsOnly(tenantCnpj);

  if (tenantDigits.length === 14) {
    return {
      emitCnpj: tenantDigits,
      source: "tenant",
      envOverrideDefined: false,
      envOverrideIgnored: false
    };
  }

  return {
    emitCnpj: "",
    source: "invalid",
    envOverrideDefined: false,
    envOverrideIgnored: false
  };
}

/**
 * Exige CNPJ valido da loja para emissao NFC-e.
 * @param {string|null|undefined} tenantCnpj
 * @returns {string} 14 digitos
 */
export function requireTenantEmitenteCnpj(tenantCnpj) {
  const resolved = resolveEmitenteCnpj(tenantCnpj);
  if (resolved.source !== "tenant" || resolved.emitCnpj.length !== 14) {
    const err = new Error(
      "CNPJ da loja invalido ou ausente. Cada tenant deve ter CNPJ proprio (14 digitos) e o mesmo CNPJ no projeto Notaas."
    );
    err.statusCode = 400;
    err.code = "NFCE_TENANT_CNPJ_REQUIRED";
    throw err;
  }
  return resolved.emitCnpj;
}

/**
 * Garante que o emitente informado e o mesmo do tenant autenticado.
 */
export function assertEmpresaCnpjMatchesTenant(empresa, tenantEmitCnpj) {
  const emp = digitsOnly(empresa?.cpf_cnpj || empresa?.cnpj);
  const expected = digitsOnly(tenantEmitCnpj);
  if (!expected || emp !== expected) {
    const err = new Error(
      `Emitente (${emp || "—"}) nao corresponde ao CNPJ da loja (${expected || "—"}). Isolamento multi-tenant bloqueou a emissao.`
    );
    err.statusCode = 502;
    err.code = "NFCE_EMITENTE_MISMATCH";
    throw err;
  }
}

/** Garante que o payload NFC-e usa o CNPJ do tenant. */
export function assertNfcePayloadEmitente(payload, tenantEmitCnpj) {
  const emit = digitsOnly(payload?.infNFe?.emit?.CNPJ);
  const expected = digitsOnly(tenantEmitCnpj);
  if (!expected || emit !== expected) {
    const err = new Error(
      `Payload NFC-e com emitente ${emit || "—"} difere do CNPJ da loja (${expected || "—"}).`
    );
    err.statusCode = 500;
    err.code = "NFCE_PAYLOAD_EMITENTE_MISMATCH";
    throw err;
  }
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
  const validCnpj = resolved.source === "tenant" && resolved.emitCnpj.length === 14;
  const hasNotaasKey = Boolean(
    tenant?.hasNotaasApiKey ?? String(tenant?.notaasApiKey || "").trim()
  );

  return {
    enableNfceEmission: enableNfce,
    emitenteCnpj: resolved.emitCnpj,
    emitenteCnpjFormatado: formatCnpjBr(resolved.emitCnpj),
    emitenteSource: resolved.source,
    envOverrideIgnored: resolved.envOverrideIgnored,
    hasNotaasApiKey: hasNotaasKey,
    willEmitNfce: enableNfce && validCnpj,
    message: !enableNfce
      ? "NFC-e desligada nesta loja — vendas sem nota fiscal."
      : !validCnpj
        ? "CNPJ da loja inválido — não é possível emitir NFC-e. Cadastre 14 dígitos no CNPJ do tenant e o mesmo CNPJ no projeto Notaas."
        : !hasNotaasKey
          ? `Emitente ${formatCnpjBr(resolved.emitCnpj)} — falta API Key Notaas (projeto da loja) para emitir.`
          : `NFC-e será emitida pelo CNPJ ${formatCnpjBr(resolved.emitCnpj)} desta loja (Notaas).`
  };
}
