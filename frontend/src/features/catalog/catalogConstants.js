/** Alinhado ao backend: variacao interna para quantidade total sem tamanho/cor. */
export const AUTO_VARIATION_SIZE = "AUTO";
export const AUTO_VARIATION_COLOR = "ESTOQUE";

export function isAutoStockVariation(row) {
  return row?.size === AUTO_VARIATION_SIZE && row?.color === AUTO_VARIATION_COLOR;
}
