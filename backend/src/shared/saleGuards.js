import { InvoiceStatus, NfceIssueJobStatus } from "@prisma/client";

/**
 * Impede editar/cancelar venda com NFC-e autorizada ou emissao em andamento.
 */
export async function assertSaleMutable(tx, tenantId, saleId) {
  const sale = await tx.sale.findFirst({
    where: { tenantId, id: saleId },
    include: { invoice: true }
  });
  if (!sale) {
    const err = new Error("Venda nao encontrada.");
    err.statusCode = 404;
    throw err;
  }

  if (sale.invoice?.status === InvoiceStatus.ISSUED) {
    const err = new Error(
      "Nao e possivel alterar ou cancelar esta venda: NFC-e ja autorizada. Cancele a nota na SEFAZ/Nuvem antes, se aplicavel."
    );
    err.statusCode = 409;
    err.code = "SALE_LOCKED_BY_INVOICE";
    throw err;
  }

  const job = await tx.nfceIssueJob.findUnique({
    where: { saleId },
    select: { status: true }
  });
  if (job?.status === NfceIssueJobStatus.PROCESSING) {
    const err = new Error("Emissao de NFC-e em andamento. Aguarde alguns instantes e tente novamente.");
    err.statusCode = 409;
    err.code = "NFCE_EMISSION_IN_PROGRESS";
    throw err;
  }

  return sale;
}
