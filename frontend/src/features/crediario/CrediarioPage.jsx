import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { useAuth } from "../auth/useAuth.jsx";
import { apiClient } from "../../shared/apiClient.js";
import { queryKeys } from "../../shared/queryKeys.js";
import { useApiQuery } from "../../shared/hooks/useApiQuery.js";
import { useCatalogTaxonomies } from "../../shared/hooks/useCatalogTaxonomies.js";
import { useInvalidateLuxuosa } from "../../shared/hooks/useInvalidateLuxuosa.js";
import { useToast } from "../../shared/components/ToastProvider.jsx";
import { useConfirm } from "../../shared/components/ConfirmProvider.jsx";
import { PageHeader } from "../../shared/components/ui/PageHeader.jsx";
import { SectionCard } from "../../shared/components/ui/SectionCard.jsx";
import { Button } from "../../shared/components/ui/Button.jsx";
import { Input } from "../../shared/components/ui/Input.jsx";
import { Barcode, Download, Printer, Search, UserPlus, WifiOff } from "lucide-react";
import { CurrencyInput } from "../../shared/components/ui/CurrencyInput.jsx";
import { Select } from "../../shared/components/ui/Select.jsx";
import { Modal } from "../../shared/components/ui/Modal.jsx";
import { Alert } from "../../shared/components/ui/Alert.jsx";
import { paymentLabel } from "../sales/sales.utils.js";
import { unwrapList } from "../../shared/apiList.js";
import {
  amountToCurrencyInput,
  formatCurrencyBRL,
  parseCurrencyInput
} from "../../shared/formatters.js";

const CREDIT_STATUS_LABEL = {
  OPEN: "Em aberto",
  PAID: "Quitado",
  CANCELED: "Cancelado"
};

function canDeleteCreditSale(row) {
  if (!row) return false;
  return row.status === "PAID" || row.status === "CANCELED";
}

function deleteCreditSaleMessage(row) {
  if (row?.status === "PAID") {
    return "Excluir esta venda quitada? O estoque não volta (a mercadoria já saiu). Os recebimentos saem do histórico. Esta ação não pode ser desfeita.";
  }
  return "Excluir este registro cancelado da lista? Esta ação não pode ser desfeita.";
}

function formatDt(iso) {
  if (!iso) return "";
  try {
    return new Intl.DateTimeFormat("pt-BR", {
      dateStyle: "short",
      timeStyle: "short"
    }).format(new Date(iso));
  } catch {
    return String(iso);
  }
}

const emptyLine = () => ({
  productVariationId: "",
  quantity: 1,
  unitPrice: ""
});

export function CrediarioPage() {
  const { token, user } = useAuth();
  const isAdmin = user?.type === "ADMIN";
  const [searchParams, setSearchParams] = useSearchParams();
  const { showToast } = useToast();
  const { confirm } = useConfirm();

  const [skip, setSkip] = useState(0);
  const take = 20;
  const [searchDraft, setSearchDraft] = useState("");
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const { invalidateCrediario, refreshAfterStockMutation } = useInvalidateLuxuosa(token);
  const { variations } = useCatalogTaxonomies(token);
  const customersQuery = useApiQuery(queryKeys.customers.list(token), "/customers?take=500&skip=0", {
    token,
    select: (data) => unwrapList(data)
  });
  const customers = customersQuery.data ?? [];
  const [online, setOnline] = useState(() => navigator.onLine !== false);
  const [customerSearch, setCustomerSearch] = useState("");
  const [barcode, setBarcode] = useState("");
  const [quickCustomerOpen, setQuickCustomerOpen] = useState(false);
  const [quickCustomer, setQuickCustomer] = useState({ name: "", eventCode: "", cpfCnpj: "", phone: "" });
  const [statementCustomerId, setStatementCustomerId] = useState(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState({
    customerId: "",
    discountValue: "",
    discountPercent: "",
    notes: "",
    overrideCreditLimit: false,
    items: [emptyLine()]
  });

  useEffect(() => {
    const sync = () => setOnline(navigator.onLine !== false);
    window.addEventListener("online", sync);
    window.addEventListener("offline", sync);
    return () => {
      window.removeEventListener("online", sync);
      window.removeEventListener("offline", sync);
    };
  }, []);

  const configQuery = useQuery({
    queryKey: [...queryKeys.crediario.all(token), "config"],
    enabled: Boolean(token),
    queryFn: () => apiClient("/crediario/config", { token })
  });
  const config = configQuery.data ?? {};
  const eventQuery = config.eventName ? `?eventName=${encodeURIComponent(config.eventName)}` : "";
  const accountsQuery = useQuery({
    queryKey: [...queryKeys.crediario.all(token), "accounts", config.eventName || "all"],
    enabled: Boolean(token),
    queryFn: () => apiClient(`/crediario/accounts${eventQuery}`, { token })
  });
  const statementQuery = useQuery({
    queryKey: [...queryKeys.crediario.all(token), "statement", statementCustomerId, config.eventName || "all"],
    enabled: Boolean(token && statementCustomerId),
    queryFn: () => apiClient(`/crediario/customers/${statementCustomerId}/statement${eventQuery}`, { token })
  });
  const selectedAccount = (accountsQuery.data?.items || []).find((row) => row.customer.id === createForm.customerId);
  const effectiveLimit = Number(selectedAccount?.customer?.creditLimit ?? config.defaultCreditLimit ?? 0);
  const projectedSubtotal = createForm.items.reduce((sum, line) => {
    const price = parseCurrencyInput(line.unitPrice);
    return sum + (Number.isFinite(price) ? Number(line.quantity || 0) * price : 0);
  }, 0);
  const projectedBalance = Number(selectedAccount?.remaining || 0) + projectedSubtotal;
  const limitRatio = effectiveLimit > 0 ? projectedBalance / effectiveLimit : 0;

  const filteredCustomers = useMemo(() => {
    const raw = customerSearch.trim().toLowerCase();
    if (!raw) return customers.slice(0, 30);
    const digits = raw.replace(/\D/g, "");
    return customers.filter((c) =>
      String(c.name || "").toLowerCase().includes(raw) ||
      String(c.eventCode || "").toLowerCase().includes(raw) ||
      (digits && [c.cpfCnpj, c.phone].some((v) => String(v || "").includes(digits)))
    ).slice(0, 30);
  }, [customerSearch, customers]);

  useEffect(() => {
    if (searchParams.get("nova") !== "1") return;
    setCreateOpen(true);
    const next = new URLSearchParams(searchParams);
    next.delete("nova");
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);

  const [detailId, setDetailId] = useState(null);

  const [payOpen, setPayOpen] = useState(false);
  const [paySaleId, setPaySaleId] = useState(null);
  const [payForm, setPayForm] = useState({
    amount: "",
    paymentMethod: "dinheiro",
    note: ""
  });

  const listParams = useMemo(
    () => ({ take, skip, q: q.trim(), statusFilter }),
    [take, skip, q, statusFilter]
  );

  const listQuery = useQuery({
    queryKey: queryKeys.crediario.list(token, listParams),
    enabled: Boolean(token),
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set("take", String(take));
      params.set("skip", String(skip));
      if (listParams.q) params.set("q", listParams.q);
      if (statusFilter) params.set("status", statusFilter);
      return apiClient(`/crediario?${params.toString()}`, { token });
    }
  });

  const rows = listQuery.data?.items ?? [];
  const total = Number(listQuery.data?.total ?? 0);
  const loading = listQuery.isFetching;

  const detailQuery = useQuery({
    queryKey: queryKeys.crediario.detail(token, detailId),
    enabled: Boolean(token && detailId),
    queryFn: () => apiClient(`/crediario/${detailId}`, { token })
  });
  const detail = detailQuery.data ?? null;

  useEffect(() => {
    if (listQuery.error) {
      showToast(listQuery.error.message || "Erro ao carregar crediario.", "error");
    }
  }, [listQuery.error, showToast]);

  useEffect(() => {
    if (detailQuery.error) {
      showToast(detailQuery.error.message || "Erro ao abrir detalhe.", "error");
    }
  }, [detailQuery.error, showToast]);

  useEffect(() => {
    setSkip(0);
  }, [q, statusFilter]);

  async function refreshCrediario() {
    await Promise.all([invalidateCrediario(), refreshAfterStockMutation(), accountsQuery.refetch()]);
  }

  const variationLabel = useMemo(() => {
    const map = new Map();
    for (const v of variations) {
      const p = v.product?.name || "Produto";
      map.set(v.id, `${p} — ${v.size} / ${v.color} (estq. ${v.stock})`);
    }
    return map;
  }, [variations]);

  function addLine() {
    setCreateForm((f) => ({ ...f, items: [...f.items, emptyLine()] }));
  }

  function updateLine(i, patch) {
    setCreateForm((f) => {
      const items = f.items.map((row, j) => (j === i ? { ...row, ...patch } : row));
      return { ...f, items };
    });
  }

  function removeLine(i) {
    setCreateForm((f) => ({
      ...f,
      items: f.items.length > 1 ? f.items.filter((_, j) => j !== i) : f.items
    }));
  }

  function addByBarcode(event) {
    event.preventDefault();
    const code = barcode.trim().toLowerCase();
    if (!code) return;
    const variation = variations.find((v) =>
      [v.sku, v.product?.sku].some((value) => String(value || "").trim().toLowerCase() === code)
    );
    if (!variation) {
      showToast("Código não encontrado no catálogo.", "error");
      return;
    }
    setCreateForm((form) => {
      const existing = form.items.findIndex((line) => line.productVariationId === variation.id);
      if (existing >= 0) {
        return {
          ...form,
          items: form.items.map((line, index) => index === existing ? { ...line, quantity: Number(line.quantity || 0) + 1 } : line)
        };
      }
      const next = {
        productVariationId: variation.id,
        quantity: 1,
        unitPrice: amountToCurrencyInput(variation.product?.price || 0)
      };
      const emptyIndex = form.items.findIndex((line) => !line.productVariationId);
      return {
        ...form,
        items: emptyIndex >= 0 ? form.items.map((line, index) => index === emptyIndex ? next : line) : [...form.items, next]
      };
    });
    setBarcode("");
  }

  async function createQuickCustomer(event) {
    event.preventDefault();
    if (quickCustomer.name.trim().length < 2) {
      showToast("Informe o nome completo.", "error");
      return;
    }
    try {
      const created = await apiClient("/customers", {
        method: "POST",
        token,
        body: {
          name: quickCustomer.name.trim(),
          eventCode: quickCustomer.eventCode.trim() || undefined,
          cpfCnpj: quickCustomer.cpfCnpj.replace(/\D/g, "") || null,
          phone: quickCustomer.phone.replace(/\D/g, "") || undefined
        }
      });
      await customersQuery.refetch();
      setCreateForm((form) => ({ ...form, customerId: created.id }));
      setCustomerSearch(created.name);
      setQuickCustomer({ name: "", eventCode: "", cpfCnpj: "", phone: "" });
      setQuickCustomerOpen(false);
      showToast("Cliente cadastrado e selecionado.");
    } catch (err) {
      showToast(err.message || "Não foi possível cadastrar o cliente.", "error");
    }
  }

  async function submitCreate() {
    if (!createForm.customerId) {
      showToast("Selecione o cliente.", "error");
      return;
    }
    const items = createForm.items
      .filter((it) => it.productVariationId)
      .map((it) => ({
        productVariationId: it.productVariationId,
        quantity: Number(it.quantity),
        unitPrice: parseCurrencyInput(it.unitPrice)
      }));
    if (!items.length) {
      showToast("Inclua ao menos um item.", "error");
      return;
    }
    for (const it of items) {
      if (!Number.isFinite(it.quantity) || it.quantity < 1 || !Number.isFinite(it.unitPrice) || it.unitPrice <= 0) {
        showToast("Quantidade e preco devem ser validos em todos os itens.", "error");
        return;
      }
    }
    try {
      await apiClient("/crediario", {
        method: "POST",
        token,
        body: {
          customerId: createForm.customerId,
          items,
          discountValue:
            createForm.discountValue === "" ? undefined : parseCurrencyInput(createForm.discountValue),
          discountPercent: createForm.discountPercent === "" ? undefined : Number(createForm.discountPercent),
          notes: createForm.notes || undefined,
          overrideCreditLimit: isAdmin && createForm.overrideCreditLimit
        }
      });
      showToast("Venda a prazo registrada.", "success");
      setCreateOpen(false);
      setCreateForm({ customerId: "", discountValue: "", discountPercent: "", notes: "", overrideCreditLimit: false, items: [emptyLine()] });
      setCustomerSearch("");
      setSkip(0);
      await refreshCrediario();
    } catch (err) {
      showToast(err.message || "Erro ao registrar.", "error");
    }
  }

  function exportAccountsCsv() {
    const items = accountsQuery.data?.items || [];
    const escape = (value) => `"${String(value ?? "").replace(/"/g, '""')}"`;
    const rows = [
      ["codigo", "cliente", "cpf", "telefone", "retiradas", "itens", "total", "pago", "saldo", "vencimento"],
      ...items.map((row) => [
        row.customer.eventCode || "", row.customer.name, row.customer.cpfCnpj || "", row.customer.phone || "",
        row.saleCount, row.itemCount, row.totalValue.toFixed(2), row.paidTotal.toFixed(2), row.remaining.toFixed(2),
        row.dueDate ? new Date(row.dueDate).toLocaleDateString("pt-BR") : ""
      ])
    ];
    const blob = new Blob(["\uFEFF" + rows.map((row) => row.map(escape).join(",")).join("\r\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `crediario_${String(config.eventName || "aberto").replace(/\W+/g, "_")}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  function printStatement() {
    window.print();
  }

  function openPay(row) {
    const rem = Number(row.remaining ?? 0);
    setPaySaleId(row.id);
    setPayForm({
      amount: rem > 0 ? amountToCurrencyInput(rem) : "",
      paymentMethod: "dinheiro",
      note: ""
    });
    setPayOpen(true);
  }

  async function submitPay() {
    const amount = parseCurrencyInput(payForm.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      showToast("Informe um valor valido.", "error");
      return;
    }
    try {
      await apiClient(`/crediario/${paySaleId}/payments`, {
        method: "POST",
        token,
        body: {
          amount,
          paymentMethod: payForm.paymentMethod,
          note: payForm.note || undefined
        }
      });
      showToast("Pagamento registrado.", "success");
      setPayOpen(false);
      await refreshCrediario();
      if (detailId === paySaleId) {
        await detailQuery.refetch();
      }
    } catch (err) {
      showToast(err.message || "Erro ao registrar pagamento.", "error");
    }
  }

  async function handleCancel(row) {
    if (!isAdmin) return;
    const ok = await confirm({
      title: "Cancelar venda a prazo",
      message: "Estorna estoque e remove o debito (apenas se nao houver pagamentos). Continuar?",
      confirmText: "Cancelar venda",
      cancelText: "Voltar"
    });
    if (!ok) return;
    try {
      await apiClient(`/crediario/${row.id}/cancel`, { method: "POST", token });
      showToast("Venda cancelada.", "success");
      await refreshCrediario();
      if (detailId === row.id) {
        setDetailId(null);
      }
    } catch (err) {
      showToast(err.message || "Nao foi possivel cancelar.", "error");
    }
  }

  async function handleDelete(row) {
    if (!isAdmin || !canDeleteCreditSale(row)) return;
    const ok = await confirm({
      title: "Excluir venda a prazo",
      message: deleteCreditSaleMessage(row),
      confirmText: "Excluir",
      cancelText: "Voltar"
    });
    if (!ok) return;
    try {
      await apiClient(`/crediario/${row.id}`, { method: "DELETE", token });
      showToast("Venda a prazo excluída.", "success");
      if (detailId === row.id) {
        setDetailId(null);
      }
      await refreshCrediario();
    } catch (err) {
      showToast(err.message || "Nao foi possivel excluir.", "error");
    }
  }

  const maxSkip = Math.max(0, total - take);
  const canPrev = skip > 0;
  const canNext = skip + take < total;

  return (
    <div className="ui-page">
      <PageHeader
        title="Crediário"
        description="Cliente leva agora e paga depois na loja (fiado). Não é cartão parcelado — use Crediário para saldo em aberto e recebimentos."
        actions={<Button type="button" onClick={() => setCreateOpen(true)}>Nova venda a prazo</Button>}
      />

      {!online ? (
        <Alert variant="danger" title="Sem conexão com a internet">
          <span className="flex items-start gap-2"><WifiOff className="mt-0.5 h-4 w-4 shrink-0" />Não finalize retiradas agora. Anote código do servo, itens e quantidades na ficha de contingência e lance quando a conexão voltar.</span>
        </Alert>
      ) : null}

      {config.eventName ? (
        <Alert variant={config.eventMode ? "info" : "warning"} title={config.eventMode ? `Evento ativo: ${config.eventName}` : `Evento fechado: ${config.eventName}`}>
          {config.dueDate ? `Vencimento previsto em ${new Date(config.dueDate).toLocaleDateString("pt-BR")}. ` : ""}
          {config.eventMode ? "As novas retiradas serão identificadas neste evento." : "Novas vendas não serão vinculadas ao evento até ele ser reaberto nas configurações."}
        </Alert>
      ) : null}

      <SectionCard
        title={config.eventName ? `Contas consolidadas — ${config.eventName}` : "Contas consolidadas"}
        description="Uma linha por cliente, somando todas as retiradas ainda em aberto."
        actions={<Button type="button" variant="secondary" className="text-xs" onClick={exportAccountsCsv} disabled={!accountsQuery.data?.items?.length}><Download className="h-4 w-4" /> Exportar cobrança</Button>}
      >
        <div className="mt-3 overflow-x-auto rounded-lg border border-slate-100">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead><tr className="ui-table-head"><th className="px-3 py-3">Código</th><th>Cliente</th><th>Retiradas</th><th>Itens</th><th>Total</th><th>Pago</th><th>Saldo</th><th className="pr-3 text-right">Ações</th></tr></thead>
            <tbody>
              {(accountsQuery.data?.items || []).map((account) => (
                <tr key={account.customer.id} className="ui-table-row">
                  <td className="px-3 py-2 font-semibold text-violet-700">{account.customer.eventCode || "—"}</td>
                  <td className="py-2"><div className="font-medium">{account.customer.name}</div><div className="text-xs text-slate-500">{account.customer.phone || account.customer.cpfCnpj || "Sem contato"}</div></td>
                  <td>{account.saleCount}</td><td>{account.itemCount}</td>
                  <td>{formatCurrencyBRL(account.totalValue)}</td><td>{formatCurrencyBRL(account.paidTotal)}</td>
                  <td className="font-semibold text-amber-800">{formatCurrencyBRL(account.remaining)}</td>
                  <td className="pr-3 text-right"><Button type="button" variant="secondary" className="text-xs" onClick={() => setStatementCustomerId(account.customer.id)}>Extrato</Button></td>
                </tr>
              ))}
              {!accountsQuery.isFetching && !(accountsQuery.data?.items || []).length ? <tr><td colSpan={8} className="p-5 text-center text-slate-500">Nenhuma conta em aberto.</td></tr> : null}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-right text-sm font-semibold">Saldo aberto: {formatCurrencyBRL(accountsQuery.data?.openBalance || 0)}</p>
      </SectionCard>

      <SectionCard title="Consulta" description="Busque por nome do cliente ou documento. Pressione Enter para pesquisar.">
        <div className="mb-4 flex flex-wrap gap-2">
          <div className="relative min-w-[200px] flex-1 max-w-md">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              className="pl-9 text-sm"
              placeholder="Cliente ou CPF/CNPJ..."
              value={searchDraft}
              onChange={(e) => setSearchDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  setQ(searchDraft.trim());
                  setSkip(0);
                }
              }}
            />
          </div>
          <Button
            variant="secondary"
            type="button"
            className="text-sm"
            onClick={() => {
              setQ(searchDraft.trim());
              setSkip(0);
            }}
          >
            Buscar
          </Button>
          <Select
            className="max-w-[200px] text-sm"
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setSkip(0);
            }}
          >
            <option value="">Todos os status</option>
            <option value="OPEN">Em aberto</option>
            <option value="PAID">Quitado</option>
            <option value="CANCELED">Cancelado</option>
          </Select>
          <Button variant="secondary" type="button" className="text-sm" onClick={() => listQuery.refetch()}>
            Atualizar
          </Button>
        </div>

        <div className="overflow-x-auto rounded-lg border border-slate-100">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead>
              <tr className="ui-table-head">
                <th className="px-3 py-3 pr-2">Data</th>
                <th className="py-2 pr-2">Cliente</th>
                <th className="py-2 pr-2">Total</th>
                <th className="py-2 pr-2">Pago</th>
                <th className="py-2 pr-2">Saldo</th>
                <th className="py-2 pr-2">Status</th>
                <th className="px-3 py-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-6 text-center text-slate-500">
                    Carregando...
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-6 text-center text-slate-500">
                    Nenhuma venda a prazo encontrada.
                  </td>
                </tr>
              ) : (
                rows.map((row) => (
                  <tr key={row.id} className="ui-table-row">
                    <td className="py-2 pr-2 whitespace-nowrap">{formatDt(row.occurredAt)}</td>
                    <td className="py-2 pr-2">
                      <div className="font-medium text-slate-800">{row.customer?.name}</div>
                      <div className="text-xs text-slate-500">{row.customer?.cpfCnpj || "Sem CPF/CNPJ"}</div>
                    </td>
                    <td className="py-2 pr-2">{formatCurrencyBRL(row.totalValue)}</td>
                    <td className="py-2 pr-2">{formatCurrencyBRL(row.paidTotal)}</td>
                    <td className="py-2 pr-2 font-medium text-amber-800">{formatCurrencyBRL(row.remaining)}</td>
                    <td className="py-2 pr-2">{CREDIT_STATUS_LABEL[row.status] || row.status}</td>
                    <td className="py-2 text-right">
                      <div className="flex flex-wrap justify-end gap-1">
                        <Button variant="secondary" className="px-2 py-1 text-xs" type="button" onClick={() => setDetailId(row.id)}>
                          Detalhe
                        </Button>
                        {row.status === "OPEN" ? (
                          <>
                            <Button className="px-2 py-1 text-xs" type="button" onClick={() => openPay(row)}>
                              Receber
                            </Button>
                            {isAdmin ? (
                            <Button variant="secondary" className="px-2 py-1 text-xs" type="button" onClick={() => handleCancel(row)}>
                              Cancelar
                            </Button>
                            ) : null}
                          </>
                        ) : null}
                        {isAdmin && canDeleteCreditSale(row) ? (
                          <Button
                            variant="danger"
                            className="px-2 py-1 text-xs"
                            type="button"
                            onClick={() => handleDelete(row)}
                          >
                            Excluir
                          </Button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="mt-4 flex items-center justify-between gap-2 text-sm text-slate-600">
          <span>
            {total ? (
              <>
                Mostrando {skip + 1}-{Math.min(skip + rows.length, total)} de {total}
              </>
            ) : (
              "0 registros"
            )}
          </span>
          <div className="flex gap-2">
            <Button
              variant="secondary"
              type="button"
              className="text-xs"
              disabled={!canPrev}
              onClick={() => setSkip((s) => Math.max(0, s - take))}
            >
              Anterior
            </Button>
            <Button
              variant="secondary"
              type="button"
              className="text-xs"
              disabled={!canNext}
              onClick={() => setSkip((s) => s + take)}
            >
              Próxima
            </Button>
          </div>
        </div>
      </SectionCard>

      <Modal
        open={createOpen}
        title="Nova venda a prazo"
        onClose={() => setCreateOpen(false)}
        actions={
          <>
            <Button type="button" onClick={submitCreate}>
              Salvar
            </Button>
          </>
        }
      >
        <div className="grid gap-3">
          <div>
            <div className="mb-1 flex items-center justify-between gap-2">
              <label className="block text-xs font-medium text-slate-600">Buscar cliente por nome, código, CPF ou telefone</label>
              <Button type="button" variant="secondary" className="text-xs" onClick={() => setQuickCustomerOpen(true)}><UserPlus className="h-4 w-4" /> Novo rápido</Button>
            </div>
            <Input className="mb-2" value={customerSearch} onChange={(e) => setCustomerSearch(e.target.value)} placeholder="Digite para buscar antes de cadastrar..." />
            <Select
              className="w-full text-sm"
              value={createForm.customerId}
              onChange={(e) => setCreateForm((f) => ({ ...f, customerId: e.target.value }))}
            >
              <option value="">Selecione...</option>
              {filteredCustomers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.cpfCnpj ? `${c.name} — ${c.cpfCnpj}` : c.name}
                </option>
              ))}
            </Select>
          </div>
          {createForm.customerId ? (
            <Alert variant={limitRatio >= 1 ? "danger" : limitRatio >= 0.8 ? "warning" : "info"} title="Conta do cliente">
              Saldo atual {formatCurrencyBRL(selectedAccount?.remaining || 0)} · após estes itens {formatCurrencyBRL(projectedBalance)}
              {effectiveLimit > 0 ? ` · limite ${formatCurrencyBRL(effectiveLimit)}` : " · sem limite configurado"}.
              {limitRatio >= 1 && isAdmin ? (
                <label className="mt-2 flex items-center gap-2 text-xs font-semibold"><input type="checkbox" checked={createForm.overrideCreditLimit} onChange={(e) => setCreateForm((f) => ({ ...f, overrideCreditLimit: e.target.checked }))} /> Autorizar excepcionalmente acima do limite</label>
              ) : null}
            </Alert>
          ) : null}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">Desconto R$</label>
              <CurrencyInput
                className="text-sm"
                value={createForm.discountValue}
                onChange={(discountValue) => setCreateForm((f) => ({ ...f, discountValue }))}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">Desconto %</label>
              <Input
                className="text-sm"
                value={createForm.discountPercent}
                onChange={(e) => setCreateForm((f) => ({ ...f, discountPercent: e.target.value }))}
              />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Observacoes</label>
            <Input className="text-sm" value={createForm.notes} onChange={(e) => setCreateForm((f) => ({ ...f, notes: e.target.value }))} />
          </div>

          <div className="border-t border-slate-200 pt-2">
            <p className="mb-2 text-xs font-semibold text-slate-600">Itens</p>
            <form className="mb-3 flex gap-2" onSubmit={addByBarcode}>
              <div className="relative flex-1"><Barcode className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><Input id="credit-barcode-input" className="pl-9" value={barcode} onChange={(e) => setBarcode(e.target.value)} placeholder="Bipe ou digite o código" autoComplete="off" /></div>
              <Button type="submit" variant="secondary">Adicionar</Button>
            </form>
            {createForm.items.map((line, i) => (
              <div key={i} className="mb-2 grid grid-cols-1 gap-2 rounded-lg border border-slate-100 p-2 md:grid-cols-12">
                <div className="md:col-span-5">
                  <Select
                    className="w-full text-sm"
                    value={line.productVariationId}
                    onChange={(e) => {
                      const vid = e.target.value;
                      const v = variations.find((x) => x.id === vid);
                      const price = v?.product?.price;
                      updateLine(i, {
                        productVariationId: vid,
                        unitPrice: price != null ? amountToCurrencyInput(price) : ""
                      });
                    }}
                  >
                    <option value="">Variacao...</option>
                    {variations.map((v) => (
                      <option key={v.id} value={v.id}>
                        {variationLabel.get(v.id)}
                      </option>
                    ))}
                  </Select>
                </div>
                <div className="md:col-span-2">
                  <Input
                    className="text-sm"
                    type="number"
                    min={1}
                    placeholder="Qtd"
                    value={line.quantity}
                    onChange={(e) => updateLine(i, { quantity: Number(e.target.value) })}
                  />
                </div>
                <div className="md:col-span-3">
                  <CurrencyInput
                    className="text-sm"
                    placeholder="Preco unit."
                    value={line.unitPrice}
                    onChange={(unitPrice) => updateLine(i, { unitPrice })}
                  />
                </div>
                <div className="flex items-end md:col-span-2">
                  <Button variant="secondary" type="button" className="w-full text-xs" onClick={() => removeLine(i)}>
                    Remover
                  </Button>
                </div>
              </div>
            ))}
            <Button variant="secondary" type="button" className="text-xs" onClick={addLine}>
              + Item
            </Button>
          </div>
        </div>
      </Modal>

      <Modal open={quickCustomerOpen} title="Cadastro rápido do cliente" onClose={() => setQuickCustomerOpen(false)}>
        <form className="grid gap-3" onSubmit={createQuickCustomer}>
          <Alert variant="info">Pesquise na venda antes de cadastrar. Informe código/crachá, CPF ou telefone para evitar pessoas duplicadas.</Alert>
          <label><span className="ui-label">Nome completo *</span><Input value={quickCustomer.name} onChange={(e) => setQuickCustomer((c) => ({ ...c, name: e.target.value }))} required autoFocus /></label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label><span className="ui-label">Código ou crachá</span><Input value={quickCustomer.eventCode} onChange={(e) => setQuickCustomer((c) => ({ ...c, eventCode: e.target.value }))} placeholder="SERVO-042" /></label>
            <label><span className="ui-label">Telefone com DDD</span><Input inputMode="tel" value={quickCustomer.phone} onChange={(e) => setQuickCustomer((c) => ({ ...c, phone: e.target.value }))} /></label>
          </div>
          <label><span className="ui-label">CPF</span><Input inputMode="numeric" value={quickCustomer.cpfCnpj} onChange={(e) => setQuickCustomer((c) => ({ ...c, cpfCnpj: e.target.value }))} /></label>
          <div className="flex justify-end"><Button type="submit"><UserPlus className="h-4 w-4" /> Cadastrar e selecionar</Button></div>
        </form>
      </Modal>

      <Modal open={Boolean(statementCustomerId)} title="Extrato consolidado" onClose={() => setStatementCustomerId(null)}>
        {!statementQuery.data ? <p className="text-sm text-slate-500">Carregando extrato...</p> : (
          <div className="credit-statement space-y-4 text-sm">
            <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 pb-3">
              <div><p className="text-lg font-semibold">{statementQuery.data.customer.name}</p><p className="text-slate-500">{statementQuery.data.customer.eventCode || statementQuery.data.customer.cpfCnpj || statementQuery.data.customer.phone || "Sem identificador"}</p></div>
              <div className="text-right"><p className="text-xs text-slate-500">Saldo total</p><p className="text-xl font-bold text-amber-800">{formatCurrencyBRL(statementQuery.data.remaining)}</p></div>
            </div>
            {(statementQuery.data.sales || []).map((sale) => (
              <div key={sale.id} className="rounded-lg border border-slate-200 p-3">
                <div className="mb-2 flex justify-between gap-2"><span>{formatDt(sale.occurredAt)} · {sale.user?.name}</span><strong>{formatCurrencyBRL(sale.totalValue)}</strong></div>
                <ul className="space-y-1 text-xs text-slate-600">{sale.items.map((item) => <li key={item.id}>{item.quantity}× {item.productVariation?.product?.name} — {item.productVariation?.size}/{item.productVariation?.color}</li>)}</ul>
              </div>
            ))}
            <div className="grid grid-cols-3 gap-2 rounded-lg bg-slate-50 p-3 text-center"><div><p className="text-xs text-slate-500">Compras</p><strong>{formatCurrencyBRL(statementQuery.data.totalValue)}</strong></div><div><p className="text-xs text-slate-500">Pago</p><strong>{formatCurrencyBRL(statementQuery.data.paidTotal)}</strong></div><div><p className="text-xs text-slate-500">Saldo</p><strong>{formatCurrencyBRL(statementQuery.data.remaining)}</strong></div></div>
            <div className="flex flex-wrap justify-end gap-2 print:hidden">
              {statementQuery.data.customer.phone ? <a className="ui-btn ui-btn-secondary" target="_blank" rel="noreferrer" href={`https://wa.me/55${String(statementQuery.data.customer.phone).replace(/\D/g, "")}?text=${encodeURIComponent(`Olá, ${statementQuery.data.customer.name}. Seu saldo no crediário${config.eventName ? ` do evento ${config.eventName}` : ""} é ${formatCurrencyBRL(statementQuery.data.remaining)}${config.dueDate ? `, com vencimento em ${new Date(config.dueDate).toLocaleDateString("pt-BR")}` : ""}.`)}`}>Preparar WhatsApp</a> : null}
              <Button type="button" variant="secondary" onClick={printStatement}><Printer className="h-4 w-4" /> Imprimir / PDF</Button>
            </div>
          </div>
        )}
      </Modal>

      <Modal open={Boolean(detailId)} title="Detalhe da venda a prazo" onClose={() => setDetailId(null)}>
        {!detail ? (
          <p className="text-sm text-slate-500">Carregando...</p>
        ) : (
          <div className="space-y-3 text-sm">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <span className="text-slate-500">Cliente</span>
                <p className="font-medium">{detail.customer?.name}</p>
              </div>
              <div>
                <span className="text-slate-500">Status</span>
                <p>{CREDIT_STATUS_LABEL[detail.status] || detail.status}</p>
              </div>
              <div>
                <span className="text-slate-500">Total</span>
                <p>{formatCurrencyBRL(detail.totalValue)}</p>
              </div>
              <div>
                <span className="text-slate-500">Saldo</span>
                <p className="font-semibold text-amber-800">{formatCurrencyBRL(detail.remaining)}</p>
              </div>
            </div>
            <div>
              <p className="mb-1 text-xs font-semibold text-slate-600">Itens</p>
              <ul className="divide-y divide-slate-100 rounded border border-slate-100">
                {detail.items?.map((it) => (
                  <li key={it.id} className="flex justify-between px-2 py-1">
                    <span>
                      {it.productVariation?.product?.name} — {it.productVariation?.size}/{it.productVariation?.color}
                    </span>
                    <span>
                      {it.quantity} x {formatCurrencyBRL(it.unitPrice)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <p className="mb-1 text-xs font-semibold text-slate-600">Pagamentos</p>
              {detail.payments?.length ? (
                <ul className="divide-y divide-slate-100 rounded border border-slate-100">
                  {detail.payments.map((p) => (
                    <li key={p.id} className="flex flex-wrap justify-between gap-2 px-2 py-1">
                      <span>{formatDt(p.paidAt)}</span>
                      <span>{paymentLabel(p.paymentMethod)}</span>
                      <span className="font-medium">{formatCurrencyBRL(p.amount)}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-slate-500">Nenhum pagamento ainda.</p>
              )}
            </div>
            {isAdmin && canDeleteCreditSale(detail) ? (
              <div className="flex justify-end pt-1">
                <Button variant="danger" type="button" className="text-xs" onClick={() => handleDelete(detail)}>
                  Excluir
                </Button>
              </div>
            ) : null}
          </div>
        )}
      </Modal>

      <Modal
        open={payOpen}
        title="Registrar recebimento"
        onClose={() => setPayOpen(false)}
        actions={
          <Button type="button" onClick={submitPay}>
            Confirmar
          </Button>
        }
      >
        <div className="grid gap-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Valor</label>
            <CurrencyInput
              className="text-sm"
              value={payForm.amount}
              onChange={(amount) => setPayForm((f) => ({ ...f, amount }))}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Forma</label>
            <Select
              className="w-full text-sm"
              value={payForm.paymentMethod}
              onChange={(e) => setPayForm((f) => ({ ...f, paymentMethod: e.target.value }))}
            >
              <option value="dinheiro">Dinheiro</option>
              <option value="pix">PIX</option>
              <option value="cartao_credito">Cartao credito</option>
              <option value="cartao_debito">Cartao debito</option>
            </Select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Observacao</label>
            <Input className="text-sm" value={payForm.note} onChange={(e) => setPayForm((f) => ({ ...f, note: e.target.value }))} />
          </div>
        </div>
      </Modal>
    </div>
  );
}
