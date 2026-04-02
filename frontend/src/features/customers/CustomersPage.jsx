import { useEffect, useMemo, useState } from "react";
import { apiClient } from "../../shared/apiClient.js";
import { useAuth } from "../auth/useAuth.jsx";
import { useToast } from "../../shared/components/ToastProvider.jsx";
import { useConfirm } from "../../shared/components/ConfirmProvider.jsx";
import { DataTable } from "../../shared/components/DataTable.jsx";
import { PageHeader } from "../../shared/components/ui/PageHeader.jsx";
import { SectionCard } from "../../shared/components/ui/SectionCard.jsx";
import { Input } from "../../shared/components/ui/Input.jsx";
import { Select } from "../../shared/components/ui/Select.jsx";
import { Button } from "../../shared/components/ui/Button.jsx";
import { Alert } from "../../shared/components/ui/Alert.jsx";
import { StatCard } from "../../shared/components/ui/StatCard.jsx";
import { Users } from "lucide-react";

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
    address: "",
    uf: "",
    cep: ""
  };
}

function buildCreateBody(form) {
  const cpf = digitsOnly(form.cpfCnpj);
  const body = {
    name: form.name.trim(),
    cpfCnpj: cpf
  };
  const phone = digitsOnly(form.phone);
  if (phone.length >= 8) body.phone = phone;
  const em = form.email.trim();
  if (em) body.email = em;
  const addr = form.address.trim();
  if (addr) body.address = addr;
  const uf = form.uf.trim().toUpperCase();
  if (uf.length === 2) body.uf = uf;
  const cep = digitsOnly(form.cep);
  if (cep.length >= 8) body.cep = cep;
  return body;
}

function matchesCustomerQuery(row, rawQuery) {
  const trim = rawQuery.trim();
  if (!trim) return true;
  const q = trim.toLowerCase();
  const digits = trim.replace(/\D/g, "");
  return (
    (row.name || "").toLowerCase().includes(q) ||
    (row.email || "").toLowerCase().includes(q) ||
    (digits.length >= 2 && String(row.cpfCnpj || "").includes(digits)) ||
    (digits.length >= 2 && String(row.phone || "").includes(digits))
  );
}

function buildUpdateBody(form) {
  const body = {};
  if (form.name.trim()) body.name = form.name.trim();
  const cpf = digitsOnly(form.cpfCnpj);
  if (cpf.length >= 11) body.cpfCnpj = cpf;
  const phone = digitsOnly(form.phone);
  if (phone.length >= 8) body.phone = phone;
  const em = form.email.trim();
  if (em) body.email = em;
  const addr = form.address.trim();
  if (addr) body.address = addr;
  const uf = form.uf.trim().toUpperCase();
  if (uf.length === 2) body.uf = uf;
  const cep = digitsOnly(form.cep);
  if (cep.length >= 8) body.cep = cep;
  return body;
}

export function CustomersPage() {
  const { token } = useAuth();
  const { showToast } = useToast();
  const { confirm } = useConfirm();
  const [items, setItems] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState("");
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const filteredCount = useMemo(
    () => items.filter((c) => matchesCustomerQuery(c, query)).length,
    [items, query]
  );

  async function load() {
    const data = await apiClient("/customers", { token });
    setItems(data);
  }

  useEffect(() => {
    load().catch((err) => setError(err.message));
  }, []);

  function startEdit(c) {
    setEditingId(c.id);
    setForm({
      name: c.name || "",
      cpfCnpj: c.cpfCnpj || "",
      phone: c.phone || "",
      email: c.email || "",
      address: c.address || "",
      uf: c.uf || "",
      cep: c.cep || ""
    });
  }

  function cancelEdit() {
    setEditingId("");
    setForm(emptyForm());
  }

  async function submit(event) {
    event.preventDefault();
    setError("");
    if (!form.name.trim() || form.name.trim().length < 2) {
      setError("Informe o nome (minimo 2 caracteres).");
      return;
    }
    const cpf = digitsOnly(form.cpfCnpj);
    if (cpf.length < 11) {
      setError("CPF ou CNPJ deve ter pelo menos 11 digitos.");
      return;
    }
    setLoading(true);
    try {
      if (editingId) {
        const body = buildUpdateBody(form);
        if (Object.keys(body).length === 0) {
          setError("Nada para atualizar.");
          setLoading(false);
          return;
        }
        await apiClient(`/customers/${editingId}`, { method: "PUT", token, body });
        showToast("Cliente atualizado.");
      } else {
        const body = buildCreateBody(form);
        await apiClient("/customers", { method: "POST", token, body });
        showToast("Cliente cadastrado.");
      }
      cancelEdit();
      await load();
    } catch (err) {
      setError(err.message);
      showToast(err.message, "error");
    } finally {
      setLoading(false);
    }
  }

  async function removeCustomer(id) {
    try {
      const ok = await confirm({
        title: "Excluir cliente",
        message:
          "Excluir este cliente? So e possivel se nao houver vendas ou crediario vinculados.",
        confirmText: "Excluir"
      });
      if (!ok) return;
      await apiClient(`/customers/${id}`, { method: "DELETE", token });
      await load();
      showToast("Cliente excluido.");
      if (editingId === id) cancelEdit();
    } catch (err) {
      setError(err.message);
      showToast(err.message, "error");
    }
  }

  return (
    <div className="ui-page">
      <PageHeader
        title="Clientes"
        description="Cadastro de clientes para vendas e crediario a prazo. CPF ou CNPJ sao obrigatorios."
      />
      <section className="grid gap-3 sm:grid-cols-2">
        <StatCard
          label="Clientes cadastrados"
          value={items.length}
          icon={<Users className="h-4 w-4 text-violet-600" />}
        />
        <StatCard
          label={query.trim() ? "Resultado da busca" : "Listados"}
          value={filteredCount}
        />
      </section>

      <SectionCard title={editingId ? "Editar cliente" : "Novo cliente"}>
        <form className="mt-3 grid gap-3 md:grid-cols-2" onSubmit={submit}>
          <label className="flex flex-col gap-1 md:col-span-2">
            <span className="text-xs font-medium text-slate-600">Nome completo *</span>
            <Input
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="Nome do cliente"
              required
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-slate-600">CPF ou CNPJ *</span>
            <Input
              value={form.cpfCnpj}
              onChange={(e) => setForm((f) => ({ ...f, cpfCnpj: e.target.value }))}
              placeholder="Somente numeros ou com pontuacao"
              required
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-slate-600">Telefone</span>
            <Input
              value={form.phone}
              onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
              placeholder="Com DDD (min. 8 digitos)"
            />
          </label>
          <label className="flex flex-col gap-1 md:col-span-2">
            <span className="text-xs font-medium text-slate-600">E-mail</span>
            <Input
              type="email"
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              placeholder="opcional"
            />
          </label>
          <label className="flex flex-col gap-1 md:col-span-2">
            <span className="text-xs font-medium text-slate-600">Endereco</span>
            <Input
              value={form.address}
              onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
              placeholder="Rua, numero, bairro..."
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-slate-600">UF</span>
            <Select
              value={form.uf}
              onChange={(e) => setForm((f) => ({ ...f, uf: e.target.value }))}
            >
              <option value="">—</option>
              {UFS.map((u) => (
                <option key={u} value={u}>
                  {u}
                </option>
              ))}
            </Select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-slate-600">CEP</span>
            <Input
              value={form.cep}
              onChange={(e) => setForm((f) => ({ ...f, cep: e.target.value }))}
              placeholder="8 digitos"
            />
          </label>
          <div className="flex flex-wrap gap-2 md:col-span-2">
            <Button type="submit" disabled={loading}>
              {editingId ? "Atualizar" : "Salvar"}
            </Button>
            {editingId ? (
              <Button type="button" variant="secondary" onClick={cancelEdit}>
                Cancelar edicao
              </Button>
            ) : null}
          </div>
        </form>
        {error ? <Alert className="mt-3" variant="danger">{error}</Alert> : null}
      </SectionCard>

      <DataTable
        title="Lista de clientes"
        data={items}
        columns={[
          { key: "name", label: "Nome" },
          { key: "doc", label: "CPF/CNPJ" },
          { key: "phone", label: "Telefone" },
          { key: "email", label: "E-mail" },
          { key: "actions", label: "Acoes" }
        ]}
        getRowKey={(row) => row.id}
        emptyMessage="Nenhum cliente cadastrado."
        search={{
          query,
          onQueryChange: setQuery,
          placeholder: "Buscar por nome, CPF, telefone ou e-mail...",
          matcher: (row, q) => matchesCustomerQuery(row, q)
        }}
        renderCells={(c) => (
          <>
            <td className="py-2 font-medium text-slate-900">{c.name}</td>
            <td className="py-2 font-mono text-xs text-slate-700">{c.cpfCnpj}</td>
            <td className="py-2 text-sm text-slate-600">{c.phone || "—"}</td>
            <td className="max-w-[180px] truncate py-2 text-sm text-slate-600">{c.email || "—"}</td>
            <td className="py-2">
              <Button
                type="button"
                variant="secondary"
                className="mr-2 px-2 py-1 text-xs"
                onClick={() => startEdit(c)}
              >
                Editar
              </Button>
              <Button type="button" variant="danger" className="px-2 py-1 text-xs" onClick={() => removeCustomer(c.id)}>
                Excluir
              </Button>
            </td>
          </>
        )}
      />
    </div>
  );
}
