import assert from "node:assert/strict";
import { describe, it } from "node:test";

/**
 * Espelha a logica de normalizeAllocations do nfeImport.service
 * (validacao unitaria sem DB).
 */
function normalizeAllocations(decision, quantityEntered, lineNumber) {
  const raw = Array.isArray(decision?.allocations) ? decision.allocations : [];
  if (raw.length === 0) {
    return [
      {
        variationId: decision?.variationId || null,
        size: decision?.size ?? null,
        color: decision?.color ?? null,
        quantity: quantityEntered,
        sku: decision?.variationSku ?? null
      }
    ];
  }

  const allocations = raw.map((a, idx) => {
    const quantity = Math.floor(Number(a?.quantity));
    if (!Number.isInteger(quantity) || quantity < 1) {
      throw new Error(`Item ${lineNumber}: alocacao ${idx + 1} com quantidade invalida.`);
    }
    return {
      variationId: a?.variationId || null,
      size: a?.size ?? null,
      color: a?.color ?? null,
      quantity,
      sku: a?.sku ?? null
    };
  });

  const sum = allocations.reduce((acc, a) => acc + a.quantity, 0);
  if (sum !== quantityEntered) {
    throw new Error(
      `Item ${lineNumber}: soma das alocacoes (${sum}) deve ser igual a quantidade de entrada (${quantityEntered}).`
    );
  }
  return allocations;
}

function pickDefaultVariation(product) {
  if (!product?.variations?.length) return null;
  return (
    product.variations.find(
      (v) => String(v.size || "").trim() === "" && String(v.color || "").trim() === ""
    ) || null
  );
}

describe("nfeImport allocations helpers", () => {
  it("fallback legado vira uma alocacao", () => {
    const out = normalizeAllocations(
      { variationId: "v1", variationSku: "X-M" },
      4,
      1
    );
    assert.equal(out.length, 1);
    assert.equal(out[0].quantity, 4);
    assert.equal(out[0].variationId, "v1");
    assert.equal(out[0].sku, "X-M");
  });

  it("reparte quantidade e valida soma", () => {
    const out = normalizeAllocations(
      {
        allocations: [
          { size: "P", color: "Preto", quantity: 1, sku: "A-P" },
          { size: "M", color: "Preto", quantity: 2, sku: "A-M" },
          { size: "G", color: "Preto", quantity: 1, sku: "A-G" }
        ]
      },
      4,
      1
    );
    assert.equal(out.length, 3);
    assert.equal(out.reduce((s, a) => s + a.quantity, 0), 4);
  });

  it("rejeita soma diferente da qtd", () => {
    assert.throws(
      () =>
        normalizeAllocations(
          {
            allocations: [
              { size: "P", color: "Preto", quantity: 1 },
              { size: "M", color: "Preto", quantity: 1 }
            ]
          },
          4,
          2
        ),
      /soma das alocacoes/
    );
  });

  it("pickDefaultVariation nao escolhe a primeira grade", () => {
    const product = {
      variations: [
        { id: "v-m", size: "M", color: "Preto" },
        { id: "v-g", size: "G", color: "Preto" }
      ]
    };
    assert.equal(pickDefaultVariation(product), null);
    product.variations.push({ id: "v-def", size: "", color: "" });
    assert.equal(pickDefaultVariation(product).id, "v-def");
  });
});
