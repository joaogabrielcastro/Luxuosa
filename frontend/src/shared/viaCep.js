/** Consulta ViaCEP (https://viacep.com.br). Retorna null se CEP invalido/nao encontrado. */

export function digitsOnlyCep(value) {
  return String(value ?? "").replace(/\D/g, "").slice(0, 8);
}

/** Mascara 00000-000 enquanto digita. */
export function maskCepInput(value) {
  const d = digitsOnlyCep(value);
  if (d.length <= 5) return d;
  return `${d.slice(0, 5)}-${d.slice(5)}`;
}

/**
 * @param {string} cepDigitsOrMasked
 * @returns {Promise<{ cep: string, uf: string, address: string, city: string, neighborhood: string, street: string } | null>}
 */
export async function lookupCep(cepDigitsOrMasked) {
  const cep = digitsOnlyCep(cepDigitsOrMasked);
  if (cep.length !== 8) return null;

  const res = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
  if (!res.ok) {
    throw new Error("Falha ao consultar CEP.");
  }
  const data = await res.json();
  if (!data || data.erro) return null;

  const street = String(data.logradouro || "").trim();
  const neighborhood = String(data.bairro || "").trim();
  const city = String(data.localidade || "").trim();
  const uf = String(data.uf || "").trim().toUpperCase();

  const parts = [street, neighborhood, city].filter(Boolean);
  const address = parts.join(", ");

  return {
    cep,
    uf,
    address,
    city,
    neighborhood,
    street
  };
}
