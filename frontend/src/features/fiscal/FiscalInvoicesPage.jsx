import { SalesPage } from "../sales/NfceSalesPage.jsx";

/** Visão de contador: mesma lista de Vendas, aba de NFC-e. */
export function FiscalInvoicesPage() {
  return <SalesPage forceFiscalView />;
}
