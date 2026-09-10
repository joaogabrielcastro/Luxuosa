import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useSalesActions } from "./useSalesActions.js";

const { apiClient } = vi.hoisted(() => ({
  apiClient: vi.fn()
}));

vi.mock("../../../shared/apiClient.js", () => ({
  apiClient,
  apiBaseUrl: "http://api.test/api/v1"
}));

const variation = {
  id: "var1",
  size: "M",
  color: "Preto",
  stock: 3,
  product: { id: "p1", name: "Camisa", sku: "CAM-01", price: 89.9, categoryId: "cat1", brandId: "br1" }
};

function setup(extra = {}) {
  const showToast = vi.fn();
  const setError = vi.fn();
  const load = vi.fn(async () => {});
  const confirm = vi.fn(async () => true);
  const hook = renderHook(() =>
    useSalesActions({
      token: "tok",
      variations: [variation],
      load,
      setError,
      showToast,
      confirm,
      ...extra
    })
  );
  return { ...hook, showToast, setError, load, confirm };
}

describe("useSalesActions", () => {
  beforeEach(() => {
    apiClient.mockReset();
    apiClient.mockResolvedValue({ id: "sale1" });
  });

  it("adiciona por SKU, aumenta qtd e recusa sem estoque", async () => {
    const { result, showToast } = setup();
    await act(async () => {
      await result.current.addItemByBarcode("CAM-01");
    });
    expect(result.current.items).toHaveLength(1);
    await act(async () => {
      await result.current.addItemByBarcode("CAM-01");
    });
    expect(result.current.items[0].quantity).toBe("2");
    await act(async () => {
      await result.current.addItemByBarcode("CAM-01");
    });
    await act(async () => {
      await result.current.addItemByBarcode("CAM-01");
    });
    expect(showToast).toHaveBeenCalledWith("Sem estoque disponivel para este codigo.", "error");
    await act(async () => {
      await result.current.addItemByBarcode("XYZ");
    });
    expect(showToast).toHaveBeenCalledWith("Produto nao encontrado (SKU ou nome).", "error");
  });

  it("linha manual, update, remove e createSale", async () => {
    const { result, load } = setup();
    act(() => {
      result.current.addManualLine({
        categoryId: "cat1",
        brandId: "br1",
        productVariationId: "var1",
        quantity: "2"
      });
    });
    expect(result.current.items).toHaveLength(1);
    act(() => {
      result.current.updateItem(0, "quantity", "1");
    });
    await act(async () => {
      await result.current.createSale({ preventDefault() {} });
    });
    expect(apiClient).toHaveBeenCalledWith(
      "/sales",
      expect.objectContaining({
        method: "POST",
        body: expect.objectContaining({ paymentMethod: "PIX", emitNfce: true })
      })
    );
    expect(load).toHaveBeenCalled();
    expect(result.current.items).toHaveLength(0);
  });

  it("createSale sem itens e retry/cancel", async () => {
    const { result, setError, confirm } = setup();
    await act(async () => {
      await result.current.createSale({ preventDefault() {} });
    });
    expect(setError).toHaveBeenCalled();
    act(() => {
      result.current.addItemByVariationId("var1");
    });
    act(() => {
      result.current.removeItem(0);
    });
    apiClient.mockResolvedValueOnce({ key: "3526abc" });
    await act(async () => {
      await result.current.retryNfce("sale1");
    });
    await act(async () => {
      await result.current.cancelSale("sale1");
    });
    expect(confirm).toHaveBeenCalled();
    expect(apiClient).toHaveBeenCalledWith("/sales/sale1/cancel", expect.objectContaining({ method: "POST" }));
  });

  it("editSale com items e cancelEdit", () => {
    const { result } = setup();
    act(() => {
      result.current.editSale({
        id: "sale1",
        paymentMethod: "CASH",
        installments: 1,
        discountValue: 0,
        discountPercent: 0,
        customerId: "cust1",
        items: [{ productVariationId: "var1", quantity: 1, unitPrice: 89.9 }]
      });
    });
    expect(result.current.editingSaleId).toBe("sale1");
    act(() => {
      result.current.cancelEdit();
    });
    expect(result.current.editingSaleId).toBeNull();
  });

  it("downloadNfcePdf", async () => {
    const { result } = setup();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        blob: async () => new Blob(["pdf"]),
        json: async () => ({})
      }))
    );
    HTMLAnchorElement.prototype.click = vi.fn();
    await act(async () => {
      await result.current.downloadNfcePdf("sale1");
    });
    vi.unstubAllGlobals();
  });

  it("editSale busca venda sem items", async () => {
    apiClient.mockResolvedValueOnce({
      id: "sale2",
      paymentMethod: "PIX",
      installments: 1,
      discountValue: 5,
      discountPercent: 0,
      customerId: "cust1",
      items: [{ productVariationId: "var1", quantity: 1, unitPrice: 89.9 }]
    });
    const { result } = setup();
    await act(async () => {
      result.current.editSale({ id: "sale2" });
    });
    await waitFor(() => expect(result.current.editingSaleId).toBe("sale2"));
  });
});
