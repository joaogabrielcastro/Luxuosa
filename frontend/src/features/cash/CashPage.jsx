import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "../../shared/apiClient.js";
import { useAuth } from "../auth/useAuth.jsx";
import { useToast } from "../../shared/components/ToastProvider.jsx";
import { formatCurrencyBRL, formatDateTimeBR } from "../../shared/formatters.js";
import { unwrapList } from "../../shared/apiList.js";
import { queryKeys } from "../../shared/queryKeys.js";
import { PageHeader } from "../../shared/components/ui/PageHeader.jsx";
import { SectionCard } from "../../shared/components/ui/SectionCard.jsx";
import { Input } from "../../shared/components/ui/Input.jsx";
import { Button } from "../../shared/components/ui/Button.jsx";
import { EmptyState } from "../../shared/components/ui/EmptyState.jsx";
import { StatCard } from "../../shared/components/ui/StatCard.jsx";
import { Badge } from "../../shared/components/ui/Badge.jsx";

const METHOD_LABELS = {
  CASH: "Dinheiro",
  CREDIT_CARD: "Crédito",
  DEBIT_CARD: "Débito",
  PIX: "PIX",
  INSTALLMENT: "Cartão parcelado"
};

const STATUS_LABELS = {
  OPEN: "Aberto",
  CLOSED: "Fechado"
};

export function CashPage() {
  const { token, user } = useAuth();
  const isAdmin = user?.type === "ADMIN";
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const [openingFloat, setOpeningFloat] = useState("0");
  const [countedCash, setCountedCash] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);

  const currentQuery = useQuery({
    queryKey: queryKeys.cash.current(token),
    enabled: Boolean(token),
    refetchInterval: 15_000,
    queryFn: () => apiClient("/cash/current", { token })
  });

  const historyQuery = useQuery({
    queryKey: queryKeys.cash.history(token),
    enabled: Boolean(token),
    queryFn: () => apiClient("/cash?take=30&skip=0", { token })
  });

  const session = currentQuery.data?.session ?? null;
  const preview = currentQuery.data?.preview ?? null;
  const history = useMemo(() => unwrapList(historyQuery.data), [historyQuery.data]);
  const isOpen = session?.status === "OPEN";

  async function invalidateCash() {
    await queryClient.invalidateQueries({ queryKey: queryKeys.cash.all(token) });
  }

  async function handleOpen(e) {
    e.preventDefault();
    if (!isAdmin) return;
    setBusy(true);
    try {
      await apiClient("/cash/open", {
        method: "POST",
        token,
        body: { openingFloat: Number(openingFloat) || 0 }
      });
      showToast("Caixa aberto.", "success");
      setOpeningFloat("0");
      await invalidateCash();
    } catch (err) {
      showToast(err?.message || "Falha ao abrir caixa.", "error");
    } finally {
      setBusy(false);
    }
  }

  async function handleClose(e) {
    e.preventDefault();
    if (!isAdmin || !session?.id) return;
    if (countedCash === "" || Number.isNaN(Number(countedCash))) {
      showToast("Informe o valor contado em caixa.", "error");
      return;
    }
    setBusy(true);
    try {
      await apiClient(`/cash/${session.id}/close`, {
        method: "POST",
        token,
        body: {
          countedCash: Number(countedCash),
          notes: notes || undefined
        }
      });
      showToast("Caixa fechado.", "success");
      setCountedCash("");
      setNotes("");
      await invalidateCash();
    } catch (err) {
      showToast(err?.message || "Falha ao fechar caixa.", "error");
    } finally {
      setBusy(false);
    }
  }

  const totals = preview?.totalsByMethod || session?.totalsByMethod || {};

  return (
    <div className="ui-page">
      <PageHeader
        title="Caixa"
        description="Abertura, acompanhamento por forma de pagamento e fechamento do dia."
      />

      <section className="mb-4 grid gap-3 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Status"
          value={isOpen ? "Aberto" : "Fechado"}
          hint={isOpen ? formatDateTimeBR(session?.openedAt) : "Nenhum caixa aberto"}
        />
        <StatCard
          label="Fundo de troco"
          value={formatCurrencyBRL(session?.openingFloat ?? 0)}
        />
        <StatCard
          label="Vendas deste caixa"
          value={`${preview?.saleCount ?? session?.saleCount ?? 0}`}
          hint={formatCurrencyBRL(preview?.totalAmount ?? session?.totalAmount ?? 0)}
        />
        <StatCard
          label="Esperado em dinheiro"
          value={formatCurrencyBRL(preview?.expectedCash ?? session?.expectedCash ?? 0)}
          hint={`Gaveta: ${formatCurrencyBRL(preview?.expectedDrawer ?? 0)}`}
        />
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <SectionCard title="Sessão atual">
          {currentQuery.isLoading ? (
            <p className="mt-3 text-sm text-slate-500">Carregando...</p>
          ) : (
            <div className="mt-3 space-y-3">
              <div className="flex items-center gap-2">
                <Badge variant={isOpen ? "success" : "neutral"}>
                  {isOpen ? STATUS_LABELS.OPEN : STATUS_LABELS.CLOSED}
                </Badge>
                {session?.openedBy?.name ? (
                  <span className="text-sm text-slate-600">Aberto por {session.openedBy.name}</span>
                ) : null}
              </div>

              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                  Totais por forma de pagamento
                </p>
                <ul className="mt-2 space-y-1 text-sm">
                  {Object.keys(totals).length === 0 ? (
                    <li className="text-slate-500">Sem vendas na janela atual.</li>
                  ) : (
                    Object.entries(totals).map(([method, amount]) => (
                      <li key={method} className="flex justify-between gap-2">
                        <span>{METHOD_LABELS[method] || method}</span>
                        <span className="font-medium">{formatCurrencyBRL(amount)}</span>
                      </li>
                    ))
                  )}
                </ul>
              </div>

              {!isOpen && isAdmin ? (
                <form className="flex flex-wrap items-end gap-3" onSubmit={handleOpen}>
                  <label className="flex flex-col gap-1">
                    <span className="text-xs font-medium text-slate-600">Fundo de troco</span>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={openingFloat}
                      onChange={(e) => setOpeningFloat(e.target.value)}
                    />
                  </label>
                  <Button type="submit" disabled={busy}>
                    Abrir caixa
                  </Button>
                </form>
              ) : null}

              {isOpen && isAdmin ? (
                <form className="space-y-3" onSubmit={handleClose}>
                  <label className="flex flex-col gap-1">
                    <span className="text-xs font-medium text-slate-600">Valor contado (dinheiro)</span>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={countedCash}
                      onChange={(e) => setCountedCash(e.target.value)}
                      required
                    />
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className="text-xs font-medium text-slate-600">Observações</span>
                    <Input value={notes} onChange={(e) => setNotes(e.target.value)} />
                  </label>
                  <Button type="submit" disabled={busy} variant="danger">
                    Fechar caixa
                  </Button>
                </form>
              ) : null}

              {!isAdmin ? (
                <p className="text-sm text-slate-500">
                  Você pode ver os totais deste caixa. Apenas o administrador abre e fecha.
                </p>
              ) : null}
            </div>
          )}
        </SectionCard>

        <SectionCard title="Histórico">
          {historyQuery.isLoading ? (
            <p className="mt-3 text-sm text-slate-500">Carregando...</p>
          ) : history.length === 0 ? (
            <EmptyState
              title="Sem fechamentos"
              description="Abra o caixa no início do dia e feche no fim para ver o histórico."
            />
          ) : (
            <div className="mt-3 overflow-x-auto">
              <table className="ui-table min-w-full text-sm">
                <thead>
                  <tr>
                    <th>Abertura</th>
                    <th>Status</th>
                    <th>Vendas</th>
                    <th>Esperado</th>
                    <th>Contado</th>
                    <th>Diferença</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((row) => (
                    <tr key={row.id}>
                      <td>{formatDateTimeBR(row.openedAt)}</td>
                      <td>{STATUS_LABELS[row.status] || row.status}</td>
                      <td>{row.saleCount ?? "—"}</td>
                      <td>{row.expectedCash != null ? formatCurrencyBRL(row.expectedCash) : "—"}</td>
                      <td>{row.countedCash != null ? formatCurrencyBRL(row.countedCash) : "—"}</td>
                      <td>{row.differenceCash != null ? formatCurrencyBRL(row.differenceCash) : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </SectionCard>
      </div>
    </div>
  );
}
