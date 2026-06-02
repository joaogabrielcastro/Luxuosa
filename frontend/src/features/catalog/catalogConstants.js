/**
 * Convencao do dominio (alinhada com backend/src/shared/autoVariation.js):
 * a "variacao padrao" do produto e a linha de estoque sem tamanho/cor,
 * representada por size = "" e color = "".
 *
 * Para criar a variacao padrao via API, envie size: "" e color: "".
 * Para criar uma variacao real, envie size e color preenchidos.
 */

export function isDefaultVariation(row) {
  if (!row) return false;
  return String(row.size || "").trim() === "" && String(row.color || "").trim() === "";
}
