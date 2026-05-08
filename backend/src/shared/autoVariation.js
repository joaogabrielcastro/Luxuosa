/**
 * Convencao do dominio: a "variacao padrao" e a linha de estoque do produto
 * quando ele nao tem variacoes reais de tamanho/cor. Ela e identificada
 * por `size = ""` e `color = ""`.
 *
 * O constraint @@unique([tenantId, productId, size, color]) garante uma
 * unica variacao padrao por produto.
 */

export function isDefaultVariation(variation) {
  if (!variation) return false;
  return String(variation.size || "").trim() === "" && String(variation.color || "").trim() === "";
}

export function isDefaultVariationInput({ size, color } = {}) {
  return String(size || "").trim() === "" && String(color || "").trim() === "";
}
