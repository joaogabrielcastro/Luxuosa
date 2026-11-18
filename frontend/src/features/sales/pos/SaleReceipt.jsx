import { formatCnpjBr, formatCurrencyBRL, formatDateTimeBR } from "../../../shared/formatters.js";
import { paymentLabel } from "../sales.utils.js";
import { lineSubtotal, variationAttributes, variationName } from "./posUtils.js";

/**
 * Comprovante não fiscal para impressão (bobina 80 mm ou A4).
 * Visível só na impressão (classe print-receipt).
 */
export function SaleReceipt({ receipt, tenant }) {
  if (!receipt) return null;
  const { sale, lines, totals, payment, customer, change } = receipt;
  return (
    <div className="print-receipt hidden print:block" aria-hidden>
      <div style={{ textAlign: "center", marginBottom: 8 }}>
        <strong style={{ fontSize: 14 }}>{tenant?.name}</strong>
        {tenant?.cnpj ? <div>CNPJ {formatCnpjBr(tenant.cnpj)}</div> : null}
        <div>{formatDateTimeBR(sale?.occurredAt || new Date().toISOString())}</div>
        <div style={{ marginTop: 4, fontWeight: 600 }}>COMPROVANTE DE VENDA — SEM VALOR FISCAL</div>
      </div>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <tbody>
          {lines.map((l) => (
            <tr key={l.variation.id}>
              <td style={{ padding: "2px 0" }}>
                {l.quantity}× {variationName(l.variation)}
                {variationAttributes(l.variation) ? ` (${variationAttributes(l.variation)})` : ""}
              </td>
              <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>{formatCurrencyBRL(lineSubtotal(l))}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <hr />
      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <span>Subtotal</span>
        <span>{formatCurrencyBRL(totals.gross)}</span>
      </div>
      {totals.discountAmount > 0 ? (
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <span>Desconto</span>
          <span>− {formatCurrencyBRL(totals.discountAmount)}</span>
        </div>
      ) : null}
      <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 700, fontSize: 14 }}>
        <span>Total</span>
        <span>{formatCurrencyBRL(totals.total)}</span>
      </div>
      <div style={{ marginTop: 4 }}>
        Pagamento: {paymentLabel(payment.paymentMethod)}
        {payment.paymentMethod === "INSTALLMENT" ? ` em ${payment.installments}x` : ""}
      </div>
      {change?.received ? (
        <div>
          Recebido {formatCurrencyBRL(change.received)} · Troco {formatCurrencyBRL(change.change)}
        </div>
      ) : null}
      {customer ? <div>Cliente: {customer.name}</div> : null}
      <div style={{ marginTop: 8, textAlign: "center" }}>Venda nº {String(sale?.id || "").slice(-8).toUpperCase()}</div>
      <div style={{ textAlign: "center" }}>Obrigado pela preferência!</div>
    </div>
  );
}
