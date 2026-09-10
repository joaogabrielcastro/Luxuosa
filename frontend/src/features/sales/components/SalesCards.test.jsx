import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { SalesFormCard } from "./SalesFormCard.jsx";
import { SalesTableCard } from "./SalesTableCard.jsx";
import { paymentLabel, saleStatusLabel, nfceJobStatusLabel } from "../sales.utils.js";
import { MemoryRouter } from "react-router-dom";
import { ToastProvider } from "../../../shared/components/ToastProvider.jsx";

const variation = {
  id: "var1",
  size: "M",
  color: "Preto",
  stock: 5,
  product: { name: "Camisa", sku: "CAM-01", price: 89.9, categoryId: "cat1", brandId: "br1" }
};

function wrap(ui) {
  return render(
    <MemoryRouter>
      <ToastProvider>{ui}</ToastProvider>
    </MemoryRouter>
  );
}

describe("SalesFormCard", () => {
  it("busca, inclui da lista e finaliza", async () => {
    const user = userEvent.setup();
    const addItemByBarcode = vi.fn();
    const addItemByVariationId = vi.fn();
    const addManualLine = vi.fn();
    const createSale = vi.fn((e) => e.preventDefault());
    wrap(
      <SalesFormCard
        token="tok"
        editingSaleId={null}
        form={{ paymentMethod: "PIX", installments: 1, discountValue: "", discountPercent: "", customerId: "", emitNfce: true }}
        setForm={vi.fn()}
        createSale={createSale}
        error=""
        items={[
          { categoryId: "cat1", brandId: "br1", productVariationId: "var1", quantity: "1", unitPrice: "89,90" }
        ]}
        sortedBrands={[{ id: "br1", name: "Lux" }]}
        sortedCategories={[{ id: "cat1", name: "Vestidos" }]}
        variations={[variation]}
        updateItem={vi.fn()}
        removeItem={vi.fn()}
        addItemByBarcode={addItemByBarcode}
        addItemByVariationId={addItemByVariationId}
        addManualLine={addManualLine}
        loading={false}
        cancelEdit={vi.fn()}
        enableNfceEmission
        getRemainingUnits={() => 5}
      />
    );
    await user.type(screen.getByPlaceholderText(/nome, sku/i), "camisa");
    await user.click(await screen.findByRole("button", { name: /camisa · m\/preto/i }));
    expect(addItemByVariationId).toHaveBeenCalledWith("var1");
    await user.click(screen.getByRole("button", { name: "Finalizar venda" }));
    expect(createSale).toHaveBeenCalled();
  });

  it("inclui pela lista e atalho de barcode", async () => {
    const user = userEvent.setup();
    const addItemByVariationId = vi.fn();
    const addManualLine = vi.fn();
    wrap(
      <SalesFormCard
        token="tok"
        editingSaleId={null}
        form={{ paymentMethod: "CASH", installments: 1, discountValue: "5", discountPercent: "10", customerId: "", emitNfce: false }}
        setForm={vi.fn()}
        createSale={vi.fn((e) => e.preventDefault())}
        error="falhou"
        items={[]}
        sortedBrands={[{ id: "br1", name: "Lux" }]}
        sortedCategories={[{ id: "cat1", name: "Vestidos" }]}
        variations={[variation]}
        updateItem={vi.fn()}
        removeItem={vi.fn()}
        addItemByBarcode={vi.fn()}
        addItemByVariationId={addItemByVariationId}
        addManualLine={addManualLine}
        loading={false}
        cancelEdit={vi.fn()}
        enableNfceEmission={false}
        getRemainingUnits={() => 5}
      />
    );
    await user.selectOptions(screen.getAllByRole("combobox")[0], "cat1");
    await user.selectOptions(screen.getAllByRole("combobox")[1], "br1");
    await user.selectOptions(screen.getAllByRole("combobox")[2], "var1");
    await user.click(screen.getByRole("button", { name: "Incluir na lista" }));
    expect(addManualLine).toHaveBeenCalled();
    const barcode = screen.getByPlaceholderText(/nome, sku/i);
    await user.clear(barcode);
    await user.type(barcode, "CAM-01");
    await user.keyboard("{Enter}");
    expect(addItemByVariationId).toHaveBeenCalledWith("var1");
    await user.keyboard("{F2}");
  });
});

describe("SalesTableCard", () => {
  it("mostra venda e acoes NFC-e", async () => {
    const user = userEvent.setup();
    const retryNfce = vi.fn();
    const cancelSale = vi.fn();
    wrap(
      <SalesTableCard
        sales={[
          {
            id: "sale1",
            occurredAt: "2026-09-01T12:00:00.000Z",
            totalValue: 89.9,
            paymentMethod: "CASH",
            status: "PAID",
            invoice: { status: "ERROR", lastError: "falha longa ".repeat(10) },
            nfceJob: { status: "FAILED", lastError: "timeout" }
          }
        ]}
        salesSkip={0}
        salesTake={50}
        totalSales={1}
        setSalesSkip={vi.fn()}
        search=""
        setSearch={vi.fn()}
        paymentFilter=""
        setPaymentFilter={vi.fn()}
        nfceFilter=""
        setNfceFilter={vi.fn()}
        paymentLabel={paymentLabel}
        saleStatusLabel={saleStatusLabel}
        nfceJobStatusLabel={nfceJobStatusLabel}
        loading={false}
        retryNfce={retryNfce}
        downloadNfcePdf={vi.fn()}
        editSale={vi.fn()}
        cancelSale={cancelSale}
        setNfceErrorDetail={vi.fn()}
        enableNfceEmission
        canManageSales
      />
    );
    expect(screen.getByText("Paga")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /tentar nfc-e novamente/i }));
    expect(retryNfce).toHaveBeenCalledWith("sale1");
    await user.click(screen.getByRole("button", { name: /ver mensagem completa/i }));
    await user.click(screen.getByRole("button", { name: "Editar" }));
    await user.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(cancelSale).toHaveBeenCalledWith("sale1");
  });

  it("mostra pdf autorizado e emitir agora", async () => {
    const user = userEvent.setup();
    const downloadNfcePdf = vi.fn();
    const retryNfce = vi.fn();
    wrap(
      <SalesTableCard
        sales={[
          {
            id: "sale-ok",
            occurredAt: "2026-09-01T12:00:00.000Z",
            totalValue: 10,
            paymentMethod: "PIX",
            status: "PAID",
            invoice: { status: "ISSUED", number: "9", key: "35260900000000000000000000000000000000000000" },
            nfceJob: { status: "COMPLETED" }
          },
          {
            id: "sale-wait",
            occurredAt: "2026-09-01T12:00:00.000Z",
            totalValue: 10,
            paymentMethod: "CASH",
            status: "PAID",
            invoice: null
          }
        ]}
        salesSkip={0}
        salesTake={50}
        totalSales={2}
        setSalesSkip={vi.fn()}
        search=""
        setSearch={vi.fn()}
        paymentFilter=""
        setPaymentFilter={vi.fn()}
        nfceFilter=""
        setNfceFilter={vi.fn()}
        paymentLabel={paymentLabel}
        saleStatusLabel={saleStatusLabel}
        nfceJobStatusLabel={nfceJobStatusLabel}
        loading={false}
        retryNfce={retryNfce}
        downloadNfcePdf={downloadNfcePdf}
        editSale={vi.fn()}
        cancelSale={vi.fn()}
        setNfceErrorDetail={vi.fn()}
        enableNfceEmission
        canManageSales
      />
    );
    await user.click(screen.getByRole("button", { name: /baixar pdf da nfc-e/i }));
    expect(downloadNfcePdf).toHaveBeenCalledWith("sale-ok");
    await user.click(screen.getByRole("button", { name: /emitir agora/i }));
    expect(retryNfce).toHaveBeenCalledWith("sale-wait");
  });
});
