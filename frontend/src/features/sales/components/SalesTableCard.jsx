import { DataTable } from "../../../shared/components/DataTable.jsx";
import { formatCurrencyBRL, formatDateTimeBR } from "../../../shared/formatters.js";
import { Button } from "../../../shared/components/ui/Button.jsx";
import { Badge } from "../../../shared/components/ui/Badge.jsx";
import { SectionCard } from "../../../shared/components/ui/SectionCard.jsx";

export function SalesTableCard({
  sales,
  salesSkip,
  salesTake,
  totalSales,
  setSalesSkip,
  search,
  setSearch,
  paymentFilter,
  setPaymentFilter,
  nfceFilter,
  setNfceFilter,
  paymentLabel,
  saleStatusLabel,
  nfceJobStatusLabel,
  loading,
  retryNfce,
  downloadNfcePdf,
  editSale,
  cancelSale,
  setNfceErrorDetail,
  enableNfceEmission = true
}) {
  const canPrev = salesSkip > 0;
  const canNext = salesSkip + salesTake < totalSales;
  const saleStatusVariant = (status) => {
    if (status === "PAID") return "success";
    if (status === "CANCELED") return "danger";
    return "warning";
  };

  return (
    <>
      <SectionCard
        title="Ultimas vendas"
        actions={
          <div className="flex items-center gap-2 text-xs text-slate-600">
            <span>
              Mostrando {sales.length} de {totalSales}
            </span>
            <Button
              type="button"
              variant="secondary"
              className="px-2 py-1 text-xs"
              disabled={!canPrev}
              onClick={() => setSalesSkip((v) => Math.max(v - salesTake, 0))}
            >
              Anterior
            </Button>
            <Button
              type="button"
              variant="secondary"
              className="px-2 py-1 text-xs"
              disabled={!canNext}
              onClick={() => setSalesSkip((v) => v + salesTake)}
            >
              Proxima
            </Button>
          </div>
        }
      >
      <div className="mb-2 text-xs text-slate-600">
        <span>
          Filtros aplicados no servidor para melhor performance.
        </span>
      </div>
      <DataTable
      data={sales}
      columns={[
        { key: "date", label: "Data" },
        { key: "amount", label: "Total" },
        { key: "payment", label: "Pagamento" },
        { key: "status", label: "Status" },
        { key: "nfce", label: "NFC-e" },
        { key: "actions", label: "Acoes" }
      ]}
      getRowKey={(row) => row.id}
      emptyMessage="Sem vendas."
      pageSize={Math.max(sales.length, 1)}
      search={{
        query: search,
        onQueryChange: setSearch,
        placeholder: "Buscar por id, pagamento ou chave NFC-e...",
        matcher: (row, q) => {
          const needle = q.toLowerCase().trim();
          if (!needle) return true;
          const pay = paymentLabel(row.paymentMethod);
          const st = saleStatusLabel(row.status);
          const key = row.invoice?.key ? String(row.invoice.key) : "";
          const job = nfceJobStatusLabel(row.nfceJob?.status);
          const hay = `${row.id} ${row.paymentMethod} ${pay} ${row.status} ${st} ${key} ${job}`.toLowerCase();
          return hay.includes(needle);
        }
      }}
      filters={[
        {
          id: "payment",
          value: paymentFilter,
          onChange: setPaymentFilter,
          options: [
            { value: "", label: "Todos pagamentos" },
            { value: "PIX", label: "PIX" },
            { value: "CASH", label: "Dinheiro" },
            { value: "CREDIT_CARD", label: "Cartao credito" },
            { value: "DEBIT_CARD", label: "Cartao debito" },
            { value: "INSTALLMENT", label: "Parcelado" }
          ],
          matcher: (row, value) => row.paymentMethod === value
        },
        {
          id: "nfce",
          value: nfceFilter,
          onChange: setNfceFilter,
          options: [
            { value: "", label: "Todas NFC-e" },
            { value: "WAITING", label: "Sem registro" },
            { value: "PENDING", label: "Pendentes" },
            { value: "ISSUED", label: "Autorizadas" },
            { value: "ERROR", label: "Com erro" }
          ],
          matcher: (row, value) => {
            if (value === "WAITING") return !row.invoice;
            if (!row.invoice) return false;
            return row.invoice.status === value;
          }
        }
      ]}
      renderCells={(sale) => (
        <>
          <td className="py-2 whitespace-nowrap">{formatDateTimeBR(sale.occurredAt)}</td>
          <td className="py-2">{formatCurrencyBRL(sale.totalValue)}</td>
          <td className="py-2">{paymentLabel(sale.paymentMethod)}</td>
          <td className="py-2">
            <Badge variant={saleStatusVariant(sale.status)}>{saleStatusLabel(sale.status)}</Badge>
          </td>
          <td className="max-w-[220px] py-2 align-top text-xs">
            {!enableNfceEmission && sale.invoice?.status !== "ISSUED" ? (
              <span className="text-slate-500">
                {sale.nfceJob?.lastError?.includes("nao habilitada") ? (
                  <span title={sale.nfceJob.lastError}>Sem NFC-e (loja)</span>
                ) : (
                  "Sem emissao fiscal nesta loja"
                )}
              </span>
            ) : null}
            {enableNfceEmission || sale.invoice?.status === "ISSUED" ? (
              <>
            {sale.nfceJob?.status && sale.nfceJob.status !== "COMPLETED" ? (
              <div className="mb-1">
                <Badge variant="warning">
                Fila: {nfceJobStatusLabel(sale.nfceJob.status)}
                {sale.nfceJob.attempts ? ` · tentativas: ${sale.nfceJob.attempts}` : ""}
                </Badge>
              </div>
            ) : null}
            {!sale.invoice ? (
              <div className="space-y-1">
                <span className="text-slate-500">Aguardando NFC-e...</span>
                {enableNfceEmission && sale.status === "PAID" ? (
                  <Button
                    type="button"
                    variant="secondary"
                    className="block w-full px-2 py-1 text-left text-[11px]"
                    disabled={loading}
                    onClick={() => retryNfce(sale.id)}
                  >
                    Emitir agora
                  </Button>
                ) : null}
              </div>
            ) : sale.invoice.status === "ISSUED" ? (
              <div className="space-y-1">
                <Badge variant="success">Autorizada (SEFAZ)</Badge>
                {sale.invoice.number ? <div className="text-slate-600">Nº {sale.invoice.number}</div> : null}
                {sale.invoice.key ? (
                  <div className="break-all font-mono text-[10px] text-slate-500" title={sale.invoice.key}>
                    {sale.invoice.key.slice(0, 24)}…
                  </div>
                ) : null}
                <Button
                  type="button"
                  className="mt-1 block w-full px-2 py-1 text-left text-[11px]"
                  disabled={loading}
                  onClick={() => downloadNfcePdf(sale.id)}
                >
                  Baixar PDF da NFC-e
                </Button>
              </div>
            ) : sale.invoice.status === "ERROR" ? (
              <div className="space-y-1">
                <div className="text-red-600" title={sale.invoice.lastError || ""}>
                  Erro na NFC-e
                  {sale.invoice.lastError ? `: ${String(sale.invoice.lastError).slice(0, 72)}…` : ""}
                </div>
                {sale.nfceJob?.status === "FAILED" && sale.nfceJob?.lastError ? (
                  <div className="text-[11px] text-slate-600" title={sale.nfceJob.lastError}>
                    Fila pausada: {String(sale.nfceJob.lastError).slice(0, 80)}…
                  </div>
                ) : null}
                {sale.invoice.lastError && String(sale.invoice.lastError).length > 72 ? (
                  <button
                    type="button"
                    className="text-left text-[11px] text-slate-600 underline"
                    onClick={() => setNfceErrorDetail(sale.invoice.lastError)}
                  >
                    Ver mensagem completa
                  </button>
                ) : null}
                {enableNfceEmission && sale.status === "PAID" ? (
                  <Button
                    type="button"
                    variant="secondary"
                    className="block w-full px-2 py-1 text-left"
                    disabled={loading}
                    onClick={() => retryNfce(sale.id)}
                  >
                    Tentar NFC-e novamente
                  </Button>
                ) : null}
              </div>
            ) : (
              <span className="text-amber-700">Enviando NFC-e para SEFAZ...</span>
            )}
            {enableNfceEmission && sale.status === "PAID" && sale.invoice?.status === "PENDING" ? (
              <Button
                type="button"
                variant="secondary"
                className="mt-1 block w-full px-2 py-1 text-left text-[11px]"
                disabled={loading}
                onClick={() => retryNfce(sale.id)}
              >
                Forçar emissão NFC-e
              </Button>
            ) : null}
              </>
            ) : null}
          </td>
          <td className="py-2">
            {sale.status !== "CANCELED" ? (
              <div className="inline-flex gap-2">
                <Button variant="secondary" className="px-1.5 py-1 text-[11px]" onClick={() => editSale(sale)}>
                  Editar
                </Button>
                <Button variant="danger" className="px-1.5 py-1 text-[11px]" onClick={() => cancelSale(sale.id)}>
                  Cancelar
                </Button>
              </div>
            ) : (
              <span className="text-xs text-slate-500">Sem acoes</span>
            )}
          </td>
        </>
      )}
      />
      </SectionCard>
    </>
  );
}
