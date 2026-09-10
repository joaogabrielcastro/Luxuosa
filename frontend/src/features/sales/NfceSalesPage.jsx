import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
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
import { Button } from "../../shared/components/ui/Button.jsx";
import { ModuleNav } from "../../shared/components/ModuleNav.jsx";
import { FiscalEmitenteBanner } from "../../shared/components/FiscalEmitenteBanner.jsx";
import { salesModuleItems } from "../../shared/navConfig.js";

/** Página de vendas (PDV) com cliente opcional e atalhos de teclado. */
export function SalesPage({ forceFiscalView = false }) {
  const { token, tenant, user } = useAuth();
  const isAdmin = user?.type === "ADMIN";
  const enableNfceEmission = tenant?.enableNfceEmission === true;
  const [params] = useSearchParams();
  const fiscalView = forceFiscalView || params.get("aba") === "notas";
  const { showToast } = useToast();
  const { confirm } = useConfirm();
  const [paymentFilter, setPaymentFilter] = useState("");
  const [nfceFilter, setNfceFilter] = useState("");
  const [search, setSearch] = useState("");
  const [nfceErrorDetail, setNfceErrorDetail] = useState(null);
  const [formError, setFormError] = useState("");
  const {
    sales,
    variations,
    sortedCategories,
    sortedBrands,
    error: dataError,
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
    updateItem,
    removeItem,
    addItemByBarcode,
    addItemByVariationId,
    addManualLine,
    createSale,
    editSale,
    cancelSale,
    cancelEdit,
    retryNfce,
    downloadNfcePdf,
    getRemainingUnits
  } = useSalesActions({ token, variations, load, setError: setFormError, showToast, confirm });

  const error = formError || dataError?.message || "";

  useEffect(() => {
    setSalesSkip(0);
  }, [search, paymentFilter, nfceFilter, setSalesSkip]);

  return (
    <div className="ui-page">
      <PageHeader
        title={fiscalView ? "Notas fiscais" : "Vendas"}
        description={
          fiscalView
            ? "Lista de vendas com NFC-e: PDF e reemissão. O PDV continua registrando a venda."
            : enableNfceEmission
              ? "Registre vendas, aplique descontos e acompanhe a nota fiscal quando necessário."
              : "Registre vendas, aplique descontos e acompanhe o histórico da loja."
        }
        actions={
          fiscalView ? (
            <Link to="/vendas">
              <Button type="button" variant="secondary" className="text-sm">
                Ir para o PDV
              </Button>
            </Link>
          ) : (
            <Link to="/crediario?nova=1">
              <Button type="button" variant="secondary" className="text-sm">
                Venda a prazo
              </Button>
            </Link>
          )
        }
      />
      <ModuleNav items={salesModuleItems()} label="Vendas" />
      {fiscalView ? <FiscalEmitenteBanner /> : null}
      {!fiscalView ? (
      <SalesFormCard
        token={token}
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
        removeItem={removeItem}
        addItemByBarcode={addItemByBarcode}
        addItemByVariationId={addItemByVariationId}
        addManualLine={addManualLine}
        loading={loading}
        cancelEdit={cancelEdit}
        enableNfceEmission={enableNfceEmission}
        getRemainingUnits={getRemainingUnits}
      />
      ) : null}

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
        enableNfceEmission={enableNfceEmission}
        canManageSales={isAdmin}
        fiscalMode={fiscalView}
      />

      <Modal open={Boolean(nfceErrorDetail)} title="Detalhe do erro NFC-e" onClose={() => setNfceErrorDetail(null)}>
        <pre className="whitespace-pre-wrap break-words text-xs text-slate-800">{nfceErrorDetail}</pre>
      </Modal>
    </div>
  );
}
