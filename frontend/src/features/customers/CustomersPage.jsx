import { useMemo, useRef, useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { AlertCircle, MessageCircle, Pencil, Plus, Trash2, UserRound, Users, WalletCards } from "lucide-react";
import { apiClient } from "../../shared/apiClient.js";
import { useDebouncedValue } from "../../shared/hooks/useDebouncedValue.js";
import { useInvalidateLuxuosa } from "../../shared/hooks/useInvalidateLuxuosa.js";
import { queryKeys } from "../../shared/queryKeys.js";
import { digitsOnlyCep, lookupCep, maskCepInput } from "../../shared/viaCep.js";
import { useAuth } from "../auth/useAuth.jsx";
import { useToast } from "../../shared/components/ToastProvider.jsx";
import { useConfirm } from "../../shared/components/ConfirmProvider.jsx";
import { DataTable } from "../../shared/components/DataTable.jsx";
import { PageHeader } from "../../shared/components/ui/PageHeader.jsx";
import { Sheet } from "../../shared/components/ui/Modal.jsx";
import { Badge } from "../../shared/components/ui/Badge.jsx";
import { FormField } from "../../shared/components/ui/FormField.jsx";
import { SegmentedControl } from "../../shared/components/ui/SegmentedControl.jsx";
import { SkeletonRows } from "../../shared/components/ui/Skeleton.jsx";
import { formatCurrencyBRL, formatDateBR, formatDateTimeBR } from "../../shared/formatters.js";
import { Input } from "../../shared/components/ui/Input.jsx";
import { Select } from "../../shared/components/ui/Select.jsx";
import { Button, IconButton } from "../../shared/components/ui/Button.jsx";
import { FormErrorSummary } from "../../shared/components/FormErrorSummary.jsx";
import { StatCard } from "../../shared/components/ui/StatCard.jsx";

const UFS = [
  "AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO"
];

function digitsOnly(s) {
  return String(s ?? "").replace(/\D/g, "");
}

function emptyForm() {
  return {
    name: "",
    cpfCnpj: "",
    phone: "",
    email: "",
    eventCode: "",
    creditLimit: "",
    address: "",
    uf: "",
    cep: ""
  };
}

function buildCreateBody(form) {
  const cpf = digitsOnly(form.cpfCnpj);
  const body = {
    name: form.name.trim(),
    cpfCnpj: cpf.length === 11 || cpf.length === 14 ? cpf : null
  };
  const phone = digitsOnly(form.phone);
  if (phone.length >= 8) body.phone = phone;
  const em = form.email.trim();
  if (em) body.email = em;
  const eventCode = form.eventCode.trim();
  if (eventCode) body.eventCode = eventCode;
  if (form.creditLimit !== "") body.creditLimit = Number(String(form.creditLimit).replace(",", "."));
  const addr = form.address.trim();
  if (addr) body.address = addr;
  const uf = form.uf.trim().toUpperCase();
  if (uf.length === 2) body.uf = uf;
  const cep = digitsOnly(form.cep);
  if (cep.length >= 8) body.cep = cep;
  return body;
}

function buildUpdateBody(form) {
  const body = {};
  if (form.name.trim()) body.name = form.name.trim();
  const cpf = digitsOnly(form.cpfCnpj);
  body.cpfCnpj = cpf.length === 11 || cpf.length === 14 ? cpf : null;
  const phone = digitsOnly(form.phone);
  if (phone.length >= 8) body.phone = phone;
  const em = form.email.trim();
  if (em) body.email = em;
  body.eventCode = form.eventCode.trim() || null;
  body.creditLimit = form.creditLimit === "" ? null : Number(String(form.creditLimit).replace(",", "."));
  const addr = form.address.trim();
  if (addr) body.address = addr;
  const uf = form.uf.trim().toUpperCase();
  if (uf.length === 2) body.uf = uf;
  const cep = digitsOnly(form.cep);
  if (cep.length >= 8) body.cep = cep;
  return body;
}

const PAGE_SIZE = 25;

function formatDoc(value) {
  const d = digitsOnly(value);
  if (d.length === 11) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
  if (d.length === 14) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
  return value || "";
}

function formatPhone(value) {
  const d = digitsOnly(value);
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return value || "";
}

/** Ficha do cliente: contato, crédito e histórico do crediário (compras e pagamentos). */
function CustomerDetail({ token, customer, account, onEdit, onDelete, canManage }) {
  const statementQuery = useQuery({
    queryKey: ["crediario", token, "statement", customer.id],
    enabled: Boolean(token && customer.id),
    queryFn: () => apiClient(`/crediario/customers/${customer.id}/statement`, { token })
  });
  const st = statementQuery.data;
  const limit = customer.creditLimit == null ? null : Number(customer.creditLimit);
  const remaining = Number(account?.remaining ?? st?.remaining ?? 0);
  const usage = limit ? Math.min(100, (remaining / limit) * 100) : null;
  const events = useMemo(() => {
    const list = [];
    for (const sale of st?.sales || []) {
      list.push({ id: `s-${sale.id}`, at: sale.occurredAt, kind: "sale", amount: Number(sale.totalValue), sale });
      for (const p of sale.payments || []) list.push({ id: `p-${p.id}`, at: p.paidAt, kind: "payment", amount: Number(p.amount), payment: p });
    }
    return list.sort((a, b) => new Date(b.at) - new Date(a.at));
  }, [st]);
  const phone = digitsOnly(customer.phone);

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-3 gap-2 rounded-xl bg-slate-50 p-3 text-center">
        <div>
          <p className="text-2xs text-slate-500">Total comprado</p>
          <p className="num text-sm font-semibold text-slate-900">{formatCurrencyBRL(customer.totalPurchases)}</p>
        </div>
        <div>
          <p className="text-2xs text-slate-500">Em aberto</p>
          <p className={`num text-sm font-semibold ${remaining > 0 ? "text-amber-800" : "text-slate-900"}`}>{formatCurrencyBRL(remaining)}</p>
        </div>
        <div>
          <p className="text-2xs text-slate-500">Última compra</p>
          <p className="num text-sm font-semibold text-slate-900">{customer.lastPurchaseAt ? formatDateBR(customer.lastPurchaseAt) : "—"}</p>
        </div>
      </div>

      {limit ? (
        <div>
          <div className="flex justify-between text-xs">
            <span className="text-slate-500">Limite de crédito</span>
            <span className="num text-slate-700">
              {formatCurrencyBRL(remaining)} de {formatCurrencyBRL(limit)}
            </span>
          </div>
          <div className="mt-1.5 h-2 rounded-full bg-slate-100">
            <div
              className={`h-2 rounded-full ${usage >= 100 ? "bg-red-500" : usage >= 80 ? "bg-amber-500" : "bg-brand-600"}`}
              style={{ width: `${Math.max(usage, 2)}%` }}
            />
          </div>
        </div>
      ) : null}

      <dl className="grid grid-cols-2 gap-3 text-sm">
        <div>
          <dt className="text-xs text-slate-500">CPF/CNPJ</dt>
          <dd className="num text-slate-900">{formatDoc(customer.cpfCnpj) || "—"}</dd>
        </div>
        <div>
          <dt className="text-xs text-slate-500">Telefone</dt>
          <dd className="num text-slate-900">{formatPhone(customer.phone) || "—"}</dd>
        </div>
        <div className="col-span-2">
          <dt className="text-xs text-slate-500">E-mail</dt>
          <dd className="truncate text-slate-900">{customer.email || "—"}</dd>
        </div>
        {customer.address ? (
          <div className="col-span-2">
            <dt className="text-xs text-slate-500">Endereço</dt>
            <dd className="text-slate-900">{[customer.address, customer.uf].filter(Boolean).join(" — ")}</dd>
          </div>
        ) : null}
        {customer.eventCode ? (
          <div>
            <dt className="text-xs text-slate-500">Código / crachá</dt>
            <dd className="font-medium text-brand-800">{customer.eventCode}</dd>
          </div>
        ) : null}
      </dl>

      <div className="flex flex-wrap gap-2">
        <Link to="/crediario?nova=1" className="ui-btn ui-btn-secondary ui-btn-sm">
          <WalletCards className="h-4 w-4" aria-hidden />
          Venda a prazo
        </Link>
        {phone.length >= 10 ? (
          <a className="ui-btn ui-btn-secondary ui-btn-sm" target="_blank" rel="noreferrer" href={`https://wa.me/55${phone}`}>
            <MessageCircle className="h-4 w-4" aria-hidden />
            WhatsApp
          </a>
        ) : null}
        {canManage ? (
          <>
            <Button size="sm" variant="secondary" icon={Pencil} onClick={onEdit}>
              Editar
            </Button>
            <Button size="sm" variant="danger-soft" icon={Trash2} onClick={onDelete}>
              Excluir
            </Button>
          </>
        ) : null}
      </div>

      <div>
        <p className="ui-eyebrow mb-2">Histórico do crediário</p>
        {statementQuery.isLoading ? (
          <SkeletonRows rows={3} />
        ) : events.length ? (
          <ol className="relative space-y-3 border-l border-slate-200 pl-4">
            {events.map((ev) => (
              <li key={ev.id} className="relative">
                <span
                  className={`absolute -left-[21px] top-1.5 h-2.5 w-2.5 rounded-full ring-2 ring-white ${ev.kind === "payment" ? "bg-emerald-500" : "bg-brand-600"}`}
                  aria-hidden
                />
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-900">
                      {ev.kind === "payment" ? "Pagamento recebido" : `Compra a prazo · ${(ev.sale.items || []).length} item(ns)`}
                    </p>
                    <p className="num text-xs text-slate-500">
                      {formatDateTimeBR(ev.at)}
                      {ev.kind === "sale" && ev.sale.status === "PAID" ? " · quitada" : ""}
                      {ev.kind === "sale" && ev.sale.status === "OPEN" ? " · em aberto" : ""}
                    </p>
                  </div>
                  <span className={`num shrink-0 text-sm font-semibold ${ev.kind === "payment" ? "text-emerald-700" : "text-slate-900"}`}>
                    {ev.kind === "payment" ? "− " : ""}
                    {formatCurrencyBRL(ev.amount)}
                  </span>
                </div>
              </li>
            ))}
          </ol>
        ) : (
          <p className="text-sm text-slate-500">Nenhuma compra a prazo registrada.</p>
        )}
      </div>
    </div>
  );
}

export function CustomersPage() {
  const { token, user, tenant } = useAuth();
  const isAdmin = user?.type === "ADMIN";
  const canCreate = isAdmin || tenant?.creditEventOnly === true;
  const canManageCustomers = canCreate;
  const { showToast } = useToast();
  const { confirm } = useConfirm();
  const [form, setForm] = useState(emptyForm);
  const { invalidateCustomers, invalidateCrediario } = useInvalidateLuxuosa(token);
  const [skip, setSkip] = useState(0);
  const [query, setQuery] = useState("");
  const [view, setView] = useState("all");
  const q = useDebouncedValue(query.trim(), 300);

  const customersQuery = useQuery({
    queryKey: [...queryKeys.customers.list(token), { skip, q }],
    enabled: Boolean(token),
    placeholderData: keepPreviousData,
    queryFn: () => {
      const sp = new URLSearchParams({ take: String(PAGE_SIZE), skip: String(skip) });
      if (q) sp.set("q", q);
      return apiClient(`/customers?${sp.toString()}`, { token });
    }
  });
  const accountsQuery = useQuery({
    queryKey: ["crediario", token, "accounts", q],
    enabled: Boolean(token),
    queryFn: () => apiClient(`/crediario/accounts${q ? `?q=${encodeURIComponent(q)}` : ""}`, { token })
  });
  const items = customersQuery.data?.items ?? [];
  const total = Number(customersQuery.data?.total ?? items.length);
  const accounts = Array.isArray(accountsQuery.data?.items) ? accountsQuery.data.items : [];
  const accountByCustomer = useMemo(() => new Map(accounts.map((a) => [a.customer?.id, a])), [accounts]);
  const openBalance = Number(accountsQuery.data?.openBalance ?? 0);

  const [editingId, setEditingId] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [detail, setDetail] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [cepLoading, setCepLoading] = useState(false);
  const lastLookedUpCep = useRef("");

  async function handleCepChange(raw) {
    const masked = maskCepInput(raw);
    setForm((f) => ({ ...f, cep: masked }));
    const digits = digitsOnlyCep(masked);
    if (digits.length !== 8) {
      lastLookedUpCep.current = "";
      return;
    }
    if (digits === lastLookedUpCep.current) return;
    lastLookedUpCep.current = digits;
    setCepLoading(true);
    try {
      const found = await lookupCep(digits);
      if (!found) {
        showToast("CEP nao encontrado.", "error");
        return;
      }
      const addressLine = [found.street, found.neighborhood, found.city]
        .filter(Boolean)
        .join(", ");
      setForm((f) => ({
        ...f,
        cep: maskCepInput(found.cep),
        uf: found.uf || f.uf,
        address: addressLine || f.address
      }));
      showToast("Endereco preenchido pelo CEP. Confira o numero.");
    } catch (err) {
      lastLookedUpCep.current = "";
      showToast(err.message || "Falha ao buscar CEP.", "error");
    } finally {
      setCepLoading(false);
    }
  }

  function startEdit(c) {
    setDetail(null);
    setError("");
    setFormOpen(true);
    setEditingId(c.id);
    lastLookedUpCep.current = digitsOnlyCep(c.cep || "");
    setForm({
      name: c.name || "",
      cpfCnpj: c.cpfCnpj || "",
      phone: c.phone || "",
      email: c.email || "",
      eventCode: c.eventCode || "",
      creditLimit: c.creditLimit == null ? "" : String(c.creditLimit),
      address: c.address || "",
      uf: c.uf || "",
      cep: c.cep ? maskCepInput(c.cep) : ""
    });
  }

  function cancelEdit() {
    setFormOpen(false);
    setEditingId("");
    lastLookedUpCep.current = "";
    setForm(emptyForm());
  }

  async function submit(event) {
    event.preventDefault();
    if ((!canCreate && !editingId) || (!canManageCustomers && editingId)) return;
    setError("");
    if (!form.name.trim() || form.name.trim().length < 2) {
      setError("Informe o nome (minimo 2 caracteres).");
      return;
    }
    const cpf = digitsOnly(form.cpfCnpj);
    if (cpf.length > 0 && cpf.length !== 11 && cpf.length !== 14) {
      setError("CPF deve ter 11 digitos, CNPJ 14 digitos, ou deixe o documento em branco.");
      return;
    }
    setLoading(true);
    try {
      if (editingId) {
        const body = buildUpdateBody(form);
        await apiClient(`/customers/${editingId}`, { method: "PUT", token, body });
        showToast("Cliente atualizado.");
      } else {
        const body = buildCreateBody(form);
        await apiClient("/customers", { method: "POST", token, body });
        showToast("Cliente cadastrado.");
      }
      cancelEdit();
      await Promise.all([invalidateCustomers(), invalidateCrediario()]);
    } catch (err) {
      setError(err);
      showToast(err.message, "error");
    } finally {
      setLoading(false);
    }
  }

  async function removeCustomer(id) {
    if (!canManageCustomers) return;
    try {
      const ok = await confirm({
        title: "Excluir cliente",
        message:
          "Excluir este cliente? So e possivel se nao houver vendas ou crediario vinculados.",
        confirmText: "Excluir"
      });
      if (!ok) return;
      await apiClient(`/customers/${id}`, { method: "DELETE", token });
      await invalidateCustomers();
      showToast("Cliente excluido.");
      if (editingId === id) cancelEdit();
      setDetail(null);
    } catch (err) {
      setError(err);
      showToast(err.message, "error");
    }
  }

  function openNew() {
    setEditingId("");
    lastLookedUpCep.current = "";
    setForm(emptyForm());
    setError("");
    setFormOpen(true);
  }

  const pendingList = accounts.map((a) => ({ ...a.customer, _account: a }));
  const showingPending = view === "pending";
  const rows = showingPending ? pendingList : items;

  const pendingBadge = (c) => {
    const acc = accountByCustomer.get(c.id) || c._account;
    if (!acc || !(Number(acc.remaining) > 0)) return null;
    const limit = c.creditLimit == null ? null : Number(c.creditLimit);
    const over = limit && Number(acc.remaining) > limit;
    return (
      <Badge variant={over ? "danger" : "warning"} dot>
        <span className="num">{formatCurrencyBRL(acc.remaining)}</span>
      </Badge>
    );
  };

  return (
    <div className="ui-page">
      <PageHeader
        title="Clientes"
        description="Contato, histórico e situação no crediário. CPF ou CNPJ é opcional; informe quando a nota precisar dos dados do cliente."
        actions={
          canCreate ? (
            <Button icon={Plus} onClick={openNew}>
              Novo cliente
            </Button>
          ) : null
        }
      />
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-3 [&>*:last-child]:col-span-2 lg:[&>*:last-child]:col-span-1">
        <StatCard label="Clientes cadastrados" value={total} loading={customersQuery.isLoading && !q} icon={Users} />
        <StatCard
          label="Com saldo em aberto"
          value={accounts.length}
          loading={accountsQuery.isLoading}
          tone={accounts.length ? "warning" : "default"}
          icon={AlertCircle}
        />
        <StatCard
          label="Total a receber"
          value={formatCurrencyBRL(openBalance)}
          loading={accountsQuery.isLoading}
          icon={WalletCards}
          footer={
            <Link to="/crediario" className="text-[13px] font-medium text-brand-700 hover:text-brand-900">
              Abrir crediário →
            </Link>
          }
        />
      </section>
      {error && !formOpen ? <FormErrorSummary error={error} className="" /> : null}

      <DataTable
        data={rows}
        loading={showingPending ? accountsQuery.isFetching : customersQuery.isFetching}
        columns={[
          { key: "name", label: "Cliente" },
          { key: "contact", label: "Contato" },
          { key: "purchases", label: "Total comprado", className: "text-right" },
          { key: "open", label: "Em aberto", className: "text-right" },
          ...(canManageCustomers ? [{ key: "actions", label: <span className="sr-only">Ações</span>, className: "w-24" }] : [])
        ]}
        getRowKey={(row) => row.id}
        onRowClick={(c) => setDetail(c)}
        emptyTitle={showingPending ? "Ninguém devendo" : "Nenhum cliente encontrado"}
        emptyMessage={showingPending ? "Não há contas abertas no crediário." : q ? "Ajuste a busca." : "Cadastre o primeiro cliente."}
        serverPagination={showingPending ? null : { skip, take: PAGE_SIZE, total, onChange: setSkip }}
        pageSize={PAGE_SIZE}
        search={{
          query,
          onQueryChange: (v) => {
            setQuery(v);
            setSkip(0);
          },
          placeholder: "Buscar por nome, CPF, telefone, código ou e-mail"
        }}
        toolbar={
          <SegmentedControl
            label="Filtro de clientes"
            value={view}
            onChange={setView}
            options={[
              { value: "all", label: "Todos" },
              { value: "pending", label: `Com pendência${accounts.length ? ` (${accounts.length})` : ""}` }
            ]}
          />
        }
        renderCells={(c) => (
          <>
            <td>
              <div className="flex items-center gap-3">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-700">
                  <UserRound className="h-4 w-4" aria-hidden />
                </span>
                <div className="min-w-0">
                  <p className="truncate font-medium text-slate-900">{c.name}</p>
                  <p className="num truncate text-xs text-slate-500">
                    {[formatDoc(c.cpfCnpj), c.eventCode].filter(Boolean).join(" · ") || "Sem documento"}
                  </p>
                </div>
              </div>
            </td>
            <td>
              <p className="num text-slate-700">{formatPhone(c.phone) || "—"}</p>
              <p className="max-w-[14rem] truncate text-xs text-slate-500">{c.email || ""}</p>
            </td>
            <td className="text-right">
              <p className="num text-slate-800">{formatCurrencyBRL(c.totalPurchases)}</p>
              <p className="num text-2xs text-slate-400">{c.lastPurchaseAt ? `última ${formatDateBR(c.lastPurchaseAt)}` : ""}</p>
            </td>
            <td className="text-right">{pendingBadge(c) || <span className="text-xs text-slate-400">—</span>}</td>
            {canManageCustomers ? (
              <td onClick={(e) => e.stopPropagation()}>
                <div className="flex justify-end gap-1">
                  <IconButton icon={Pencil} size="sm" label="Editar" onClick={() => startEdit(c)} />
                  <IconButton icon={Trash2} size="sm" label="Excluir" className="hover:bg-red-50 hover:text-red-600" onClick={() => removeCustomer(c.id)} />
                </div>
              </td>
            ) : null}
          </>
        )}
        renderMobileCard={(c) => (
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate font-medium text-slate-900">{c.name}</p>
              <p className="num truncate text-xs text-slate-500">{formatPhone(c.phone) || formatDoc(c.cpfCnpj) || "—"}</p>
            </div>
            <div className="shrink-0">{pendingBadge(c)}</div>
          </div>
        )}
      />

      <Sheet open={Boolean(detail)} onClose={() => setDetail(null)} title={detail?.name || "Cliente"} description="Ficha do cliente">
        {detail ? (
          <CustomerDetail
            token={token}
            customer={detail}
            account={accountByCustomer.get(detail.id)}
            canManage={canManageCustomers}
            onEdit={() => startEdit(detail)}
            onDelete={() => removeCustomer(detail.id)}
          />
        ) : null}
      </Sheet>

      <Sheet
        open={canCreate && formOpen}
        onClose={cancelEdit}
        title={editingId ? "Editar cliente" : "Novo cliente"}
        description="Só o nome é obrigatório."
        footer={
          <>
            <Button type="button" variant="secondary" onClick={cancelEdit}>
              Cancelar
            </Button>
            <Button type="submit" form="customer-form" loading={loading}>
              {editingId ? "Atualizar" : "Salvar"}
            </Button>
          </>
        }
      >
        <form id="customer-form" className="grid gap-3 sm:grid-cols-2" onSubmit={submit}>
          <FormField label="Nome completo" required className="sm:col-span-2">
            <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="Nome do cliente" required />
          </FormField>
          <FormField label="Telefone / WhatsApp">
            <Input value={form.phone} inputMode="tel" onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} placeholder="Com DDD (min. 8 digitos)" />
          </FormField>
          <FormField label="CPF ou CNPJ" hint="Opcional.">
            <Input
              value={form.cpfCnpj}
              inputMode="numeric"
              onChange={(e) => setForm((f) => ({ ...f, cpfCnpj: e.target.value }))}
              placeholder="11 digitos (CPF) ou 14 (CNPJ); vazio se nao tiver"
            />
          </FormField>
          <FormField label="E-mail" className="sm:col-span-2">
            <Input type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} placeholder="opcional" />
          </FormField>
          <FormField label="Código ou crachá">
            <Input value={form.eventCode} onChange={(e) => setForm((f) => ({ ...f, eventCode: e.target.value }))} placeholder="Ex.: SERVO-042" />
          </FormField>
          {isAdmin ? (
            <FormField label="Limite de crédito (R$)" hint="Vazio usa o limite padrão da loja.">
              <Input
                type="number"
                min="0"
                step="0.01"
                inputMode="decimal"
                value={form.creditLimit}
                onChange={(e) => setForm((f) => ({ ...f, creditLimit: e.target.value }))}
                placeholder="Usa o limite padrão se vazio"
              />
            </FormField>
          ) : null}
          <div className="ui-divider sm:col-span-2" />
          <FormField label="CEP" hint={cepLoading ? "Buscando endereço…" : "Ao completar 8 dígitos, preenche endereço e UF."}>
            <Input
              value={form.cep}
              onChange={(e) => handleCepChange(e.target.value)}
              placeholder="00000-000"
              inputMode="numeric"
              autoComplete="postal-code"
              disabled={cepLoading}
            />
          </FormField>
          <FormField label="UF">
            <Select value={form.uf} onChange={(e) => setForm((f) => ({ ...f, uf: e.target.value }))}>
              <option value="">—</option>
              {UFS.map((u) => (
                <option key={u} value={u}>
                  {u}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField label="Endereço" className="sm:col-span-2">
            <Input value={form.address} onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))} placeholder="Rua, numero, bairro, cidade..." />
          </FormField>
          <div className="sm:col-span-2">
            <FormErrorSummary error={error} className="" />
          </div>
        </form>
      </Sheet>
    </div>
  );
}
