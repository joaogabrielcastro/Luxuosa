import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "../auth/useAuth.jsx";
import { apiClient } from "../../shared/apiClient.js";
import { useToast } from "../../shared/components/ToastProvider.jsx";
import { useConfirm } from "../../shared/components/ConfirmProvider.jsx";
import { PageHeader } from "../../shared/components/ui/PageHeader.jsx";
import { Button } from "../../shared/components/ui/Button.jsx";
import { Input } from "../../shared/components/ui/Input.jsx";
import { Select } from "../../shared/components/ui/Select.jsx";
import { Modal } from "../../shared/components/ui/Modal.jsx";
import { paymentLabel } from "../sales/sales.utils.js";

const CREDIT_STATUS_LABEL = {
  OPEN: "Em aberto",
  PAID: "Quitado",
  CANCELED: "Cancelado"
};

function formatBrl(n) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(n || 0));
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
  const { token } = useAuth();
  const { showToast } = useToast();
  const { confirm } = useConfirm();

  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [skip, setSkip] = useState(0);
  const take = 20;
  const [searchDraft, setSearchDraft] = useState("");
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [loading, setLoading] = useState(false);

  const [customers, setCustomers] = useState([]);
  const [variations, setVariations] = useState([]);

  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState({
    customerId: "",
    discountValue: "",
    discountPercent: "",
    notes: "",
    items: [emptyLine()]
  });

  const [detailId, setDetailId] = useState(null);
  const [detail, setDetail] = useState(null);

  const [payOpen, setPayOpen] = useState(false);
  const [paySaleId, setPaySaleId] = useState(null);
  const [payForm, setPayForm] = useState({
    amount: "",
    paymentMethod: "dinheiro",
    note: ""
  });

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("take", String(take));
      params.set("skip", String(skip));
      if (q.trim()) params.set("q", q.trim());
      if (statusFilter) params.set("status", statusFilter);
      const data = await apiClient(`/crediario?${params.toString()}`, { token });
      setRows(data.items || []);
      setTotal(Number(data.total || 0));
    } catch (err) {
      showToast(err.message || "Erro ao carregar crediario.", "error");
    } finally {
      setLoading(false);
    }
  }, [token, skip, q, statusFilter, showToast]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!token) return undefined;
    (async () => {
      try {
        const [c, v] = await Promise.all([
          apiClient("/customers", { token }),
          apiClient("/product-variations", { token })
        ]);
        setCustomers(c || []);
        setVariations(v || []);
      } catch {
        /* ignore */
      }
    })();
    return undefined;
  }, [token]);

  useEffect(() => {
    if (!detailId || !token) {
      setDetail(null);
      return undefined;
    }
    let cancelled = false;
    (async () => {
      try {
        const row = await apiClient(`/crediario/${detailId}`, { token });
        if (!cancelled) setDetail(row);
      } catch (err) {
        if (!cancelled) showToast(err.message || "Erro ao abrir detalhe.", "error");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [detailId, token, showToast]);

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
        unitPrice: Number(it.unitPrice)
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
          discountValue: createForm.discountValue === "" ? undefined : Number(createForm.discountValue),
          discountPercent: createForm.discountPercent === "" ? undefined : Number(createForm.discountPercent),
          notes: createForm.notes || undefined
        }
      });
      showToast("Venda a prazo registrada.", "success");
      setCreateOpen(false);
      setCreateForm({ customerId: "", discountValue: "", discountPercent: "", notes: "", items: [emptyLine()] });
      setSkip(0);
      await load();
    } catch (err) {
      showToast(err.message || "Erro ao registrar.", "error");
    }
  }

  function openPay(row) {
    const rem = Number(row.remaining ?? 0);
    setPaySaleId(row.id);
    setPayForm({
      amount: rem > 0 ? rem.toFixed(2) : "",
      paymentMethod: "dinheiro",
      note: ""
    });
    setPayOpen(true);
  }

  async function submitPay() {
    const raw = String(payForm.amount).replace(",", ".");
    const amount = Number(raw);
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
      await load();
      if (detailId === paySaleId) {
        try {
          const row = await apiClient(`/crediario/${paySaleId}`, { token });
          setDetail(row);
        } catch {
          /* ignore */
        }
      }
    } catch (err) {
      showToast(err.message || "Erro ao registrar pagamento.", "error");
    }
  }

  async function handleCancel(row) {
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
      await load();
      if (detailId === row.id) {
        setDetailId(null);
        setDetail(null);
      }
    } catch (err) {
      showToast(err.message || "Nao foi possivel cancelar.", "error");
    }
  }

  const maxSkip = Math.max(0, total - take);
  const canPrev = skip > 0;
  const canNext = skip + take < total;

  return (
    <div className="ui-page">
      <PageHeader
        title="Crediario"
        description="Vendas a prazo por cliente, saldo em aberto e recebimentos parciais (sem NFC-e)."
        actions={
          <Button type="button" onClick={() => setCreateOpen(true)}>
            Nova venda a prazo
          </Button>
        }
      />

      <div className="ui-surface mt-4 p-4">
        <div className="mb-4 flex flex-wrap gap-2">
          <Input
            className="max-w-xs text-sm"
            placeholder="Buscar por cliente ou CPF/CNPJ..."
            value={searchDraft}
            onChange={(e) => setSearchDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                setQ(searchDraft.trim());
                setSkip(0);
              }
            }}
          />
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
          <Button variant="secondary" type="button" className="text-sm" onClick={() => load()}>
            Atualizar
          </Button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500">
                <th className="py-2 pr-2">Data</th>
                <th className="py-2 pr-2">Cliente</th>
                <th className="py-2 pr-2">Total</th>
                <th className="py-2 pr-2">Pago</th>
                <th className="py-2 pr-2">Saldo</th>
                <th className="py-2 pr-2">Status</th>
                <th className="py-2 text-right">Acoes</th>
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
                  <tr key={row.id} className="border-b border-slate-100">
                    <td className="py-2 pr-2 whitespace-nowrap">{formatDt(row.occurredAt)}</td>
                    <td className="py-2 pr-2">
                      <div className="font-medium text-slate-800">{row.customer?.name}</div>
                      <div className="text-xs text-slate-500">{row.customer?.cpfCnpj}</div>
                    </td>
                    <td className="py-2 pr-2">{formatBrl(row.totalValue)}</td>
                    <td className="py-2 pr-2">{formatBrl(row.paidTotal)}</td>
                    <td className="py-2 pr-2 font-medium text-amber-800">{formatBrl(row.remaining)}</td>
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
                            <Button variant="secondary" className="px-2 py-1 text-xs" type="button" onClick={() => handleCancel(row)}>
                              Cancelar
                            </Button>
                          </>
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
              Proxima
            </Button>
          </div>
        </div>
      </div>

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
            <label className="mb-1 block text-xs font-medium text-slate-600">Cliente</label>
            <Select
              className="w-full text-sm"
              value={createForm.customerId}
              onChange={(e) => setCreateForm((f) => ({ ...f, customerId: e.target.value }))}
            >
              <option value="">Selecione...</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} — {c.cpfCnpj}
                </option>
              ))}
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">Desconto R$</label>
              <Input
                className="text-sm"
                value={createForm.discountValue}
                onChange={(e) => setCreateForm((f) => ({ ...f, discountValue: e.target.value }))}
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
            {createForm.items.map((line, i) => (
              <div key={i} className="mb-2 grid grid-cols-1 gap-2 rounded-lg border border-slate-100 p-2 md:grid-cols-12">
                <div className="md:col-span-5">
                  <Select
                    className="w-full text-sm"
                    value={line.productVariationId}
                    onChange={(e) => {
                      const vid = e.target.value;
                      const v = variations.find((x) => x.id === vid);
                      const price = v?.product?.price != null ? Number(v.product.price) : "";
                      updateLine(i, {
                        productVariationId: vid,
                        unitPrice: price === "" ? "" : String(price)
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
                  <Input
                    className="text-sm"
                    type="number"
                    step="0.01"
                    placeholder="Preco unit."
                    value={line.unitPrice}
                    onChange={(e) => updateLine(i, { unitPrice: e.target.value })}
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
                <p>{formatBrl(detail.totalValue)}</p>
              </div>
              <div>
                <span className="text-slate-500">Saldo</span>
                <p className="font-semibold text-amber-800">{formatBrl(detail.remaining)}</p>
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
                      {it.quantity} x {formatBrl(it.unitPrice)}
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
                      <span className="font-medium">{formatBrl(p.amount)}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-slate-500">Nenhum pagamento ainda.</p>
              )}
            </div>
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
            <Input className="text-sm" value={payForm.amount} onChange={(e) => setPayForm((f) => ({ ...f, amount: e.target.value }))} />
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
