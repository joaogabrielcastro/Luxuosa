/** Variacao interna usada para estoque total quando nao ha tamanho/cor (sync no cadastro). */
export const AUTO_VARIATION_SIZE = "AUTO";
export const AUTO_VARIATION_COLOR = "ESTOQUE";

export function isAutoStockVariation(variation) {
  return (
    variation?.size === AUTO_VARIATION_SIZE && variation?.color === AUTO_VARIATION_COLOR
  );
}
