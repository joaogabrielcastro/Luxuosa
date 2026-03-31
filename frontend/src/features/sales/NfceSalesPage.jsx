import { useEffect, useState } from "react";
import { useConfirm } from "../../shared/components/ConfirmProvider.jsx";
import { useToast } from "../../shared/components/ToastProvider.jsx";
import { useAuth } from "../auth/useAuth.jsx";
import { SalesFormCard } from "./components/SalesFormCard.jsx";
import { SalesTableCard } from "./components/SalesTableCard.jsx";
import { useSalesActions } from "./hooks/useSalesActions.js";
import { useSalesData } from "./hooks/useSalesData.js";
import { nfceJobStatusLabel, paymentLabel, saleStatusLabel } from "./sales.utils.js";
import { PageHeader } from "../../shared/components/ui/PageHeader.jsx";
import { Modal } from "../../shared/components/ui/Modal.jsx";

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
    <div className="ui-page">
      <PageHeader title="Vendas" description="Nota como consumidor final (sem cliente na tela)." />
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

      <Modal open={Boolean(nfceErrorDetail)} title="Detalhe do erro NFC-e" onClose={() => setNfceErrorDetail(null)}>
        <pre className="whitespace-pre-wrap break-words text-xs text-slate-800">{nfceErrorDetail}</pre>
      </Modal>
    </div>
  );
}
