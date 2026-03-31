import { useEffect, useState } from "react";
import { useConfirm } from "../../shared/components/ConfirmProvider.jsx";
import { useToast } from "../../shared/components/ToastProvider.jsx";
import { useAuth } from "../auth/useAuth.jsx";
import { SalesFormCard } from "./components/SalesFormCard.jsx";
import { SalesTableCard } from "./components/SalesTableCard.jsx";
import { useSalesActions } from "./hooks/useSalesActions.js";
import { useSalesData } from "./hooks/useSalesData.js";
import { nfceJobStatusLabel, paymentLabel, saleStatusLabel } from "./sales.utils.js";

/** Página de vendas (NFC-e consumidor final, sem seleção de cliente na UI). */
export function SalesPage() {
  const { token } = useAuth();
  const { showToast } = useToast();
  const { confirm } = useConfirm();
  const [paymentFilter, setPaymentFilter] = useState("");
  const [nfceFilter, setNfceFilter] = useState("");
  const [search, setSearch] = useState("");
  const [nfceErrorDetail, setNfceErrorDetail] = useState(null);
  const {
    sales,
    variations,
    sortedCategories,
    sortedBrands,
    error,
    setError,
    load,
    salesSkip,
    setSalesSkip,
    salesTake,
    totalSales
  } = useSalesData(token, { search, paymentFilter, nfceFilter });
  const {
    form,
    setForm,
    items,
    editingSaleId,
    loading,
    barcodeInput,
    setBarcodeInput,
    addItem,
    updateItem,
    addItemByBarcode,
    createSale,
    editSale,
    cancelSale,
    cancelEdit,
    retryNfce,
    downloadNfcePdf
  } = useSalesActions({ token, variations, load, setError, showToast, confirm });

  useEffect(() => {
    setSalesSkip(0);
  }, [search, paymentFilter, nfceFilter, setSalesSkip]);

  return (
    <div className="space-y-4">
      <header className="rounded-lg border border-slate-200 bg-white px-4 py-3 shadow-sm">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h1 className="text-xl font-semibold text-slate-900">Vendas</h1>
        </div>
        <p className="mt-1 text-xs text-slate-500">Nota como consumidor final (sem cliente na tela).</p>
      </header>
      <SalesFormCard
        editingSaleId={editingSaleId}
        form={form}
        setForm={setForm}
        createSale={createSale}
        error={error}
        items={items}
        sortedBrands={sortedBrands}
        sortedCategories={sortedCategories}
        variations={variations}
        updateItem={updateItem}
        barcodeInput={barcodeInput}
        setBarcodeInput={setBarcodeInput}
        addItemByBarcode={addItemByBarcode}
        addItem={addItem}
        loading={loading}
        cancelEdit={cancelEdit}
      />

      <SalesTableCard
        sales={sales}
        salesSkip={salesSkip}
        salesTake={salesTake}
        totalSales={totalSales}
        setSalesSkip={setSalesSkip}
        search={search}
        setSearch={setSearch}
        paymentFilter={paymentFilter}
        setPaymentFilter={setPaymentFilter}
        nfceFilter={nfceFilter}
        setNfceFilter={setNfceFilter}
        paymentLabel={paymentLabel}
        saleStatusLabel={saleStatusLabel}
        nfceJobStatusLabel={nfceJobStatusLabel}
        loading={loading}
        retryNfce={retryNfce}
        downloadNfcePdf={downloadNfcePdf}
        editSale={editSale}
        cancelSale={cancelSale}
        setNfceErrorDetail={setNfceErrorDetail}
      />

      {nfceErrorDetail ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="nfce-err-title"
        >
          <div className="max-h-[80vh] w-full max-w-lg overflow-auto rounded-lg bg-white p-4 shadow-lg">
            <h3 id="nfce-err-title" className="text-sm font-semibold">
              Detalhe do erro NFC-e
            </h3>
            <pre className="mt-3 whitespace-pre-wrap break-words text-xs text-slate-800">{nfceErrorDetail}</pre>
            <button
              type="button"
              className="mt-4 rounded bg-slate-900 px-3 py-2 text-sm text-white"
              onClick={() => setNfceErrorDetail(null)}
            >
              Fechar
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
