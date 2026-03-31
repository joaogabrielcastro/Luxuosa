import { DataTable } from "../../../shared/components/DataTable.jsx";
import { formatCurrencyBRL, formatDateTimeBR } from "../../../shared/formatters.js";

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
  setNfceErrorDetail
}) {
  const canPrev = salesSkip > 0;
  const canNext = salesSkip + salesTake < totalSales;

  return (
    <>
      <div className="flex items-center justify-between rounded-lg bg-white px-3 py-2 text-xs text-slate-600 shadow-sm">
        <span>
          Mostrando {sales.length} de {totalSales} vendas
        </span>
        <div className="flex gap-2">
          <button
            type="button"
            className="rounded border px-2 py-1 disabled:opacity-50"
            disabled={!canPrev}
            onClick={() => setSalesSkip((v) => Math.max(v - salesTake, 0))}
          >
            Anterior
          </button>
          <button
            type="button"
            className="rounded border px-2 py-1 disabled:opacity-50"
            disabled={!canNext}
            onClick={() => setSalesSkip((v) => v + salesTake)}
          >
            Proxima
          </button>
        </div>
      </div>
      <DataTable
        title="Ultimas vendas"
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
          <td className="py-2">{saleStatusLabel(sale.status)}</td>
          <td className="max-w-[220px] py-2 align-top text-xs">
            {sale.nfceJob?.status && sale.nfceJob.status !== "COMPLETED" ? (
              <div className="mb-1 rounded border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] text-slate-700">
                Fila: <strong>{nfceJobStatusLabel(sale.nfceJob.status)}</strong>
                {sale.nfceJob.attempts ? ` · tentativas: ${sale.nfceJob.attempts}` : ""}
              </div>
            ) : null}
            {!sale.invoice ? (
              <div className="space-y-1">
                <span className="text-slate-500">Aguardando NFC-e...</span>
                {sale.status === "PAID" ? (
                  <button
                    type="button"
                    className="block w-full rounded border border-slate-300 px-2 py-1 text-left text-[11px] hover:bg-slate-50"
                    disabled={loading}
                    onClick={() => retryNfce(sale.id)}
                  >
                    Emitir agora
                  </button>
                ) : null}
              </div>
            ) : sale.invoice.status === "ISSUED" ? (
              <div className="space-y-1">
                <span className="font-medium text-emerald-700">Autorizada (SEFAZ)</span>
                {sale.invoice.number ? <div className="text-slate-600">Nº {sale.invoice.number}</div> : null}
                {sale.invoice.key ? (
                  <div className="break-all font-mono text-[10px] text-slate-500" title={sale.invoice.key}>
                    {sale.invoice.key.slice(0, 24)}…
                  </div>
                ) : null}
                <button
                  type="button"
                  className="mt-1 block w-full rounded bg-slate-900 px-2 py-1 text-left text-[11px] text-white hover:bg-slate-800 disabled:opacity-50"
                  disabled={loading}
                  onClick={() => downloadNfcePdf(sale.id)}
                >
                  Baixar PDF da NFC-e
                </button>
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
                {sale.status === "PAID" ? (
                  <button
                    type="button"
                    className="block w-full rounded border border-slate-300 px-2 py-1 text-left hover:bg-slate-50"
                    disabled={loading}
                    onClick={() => retryNfce(sale.id)}
                  >
                    Tentar NFC-e novamente
                  </button>
                ) : null}
              </div>
            ) : (
              <span className="text-amber-700">Enviando NFC-e para SEFAZ...</span>
            )}
            {sale.status === "PAID" && sale.invoice?.status === "PENDING" ? (
              <button
                type="button"
                className="mt-1 block w-full rounded border border-slate-300 px-2 py-1 text-left text-[11px] hover:bg-slate-50"
                disabled={loading}
                onClick={() => retryNfce(sale.id)}
              >
                Forçar emissão NFC-e
              </button>
            ) : null}
          </td>
          <td className="py-2">
            {sale.status !== "CANCELED" ? (
              <div className="inline-flex gap-2">
                <button className="rounded border px-2 py-1 text-xs" onClick={() => editSale(sale)}>
                  Editar
                </button>
                <button className="rounded border border-red-600 px-2 py-1 text-xs text-red-700" onClick={() => cancelSale(sale.id)}>
                  Cancelar
                </button>
              </div>
            ) : (
              <span className="text-xs text-slate-500">Sem acoes</span>
            )}
          </td>
        </>
      )}
      />
    </>
  );
}
