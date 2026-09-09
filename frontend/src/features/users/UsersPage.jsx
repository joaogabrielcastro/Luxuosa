import { useState } from "react";
import { Link } from "react-router-dom";
import { Users } from "lucide-react";
import { apiClient } from "../../shared/apiClient.js";
import { useApiQuery } from "../../shared/hooks/useApiQuery.js";
import { useInvalidateLuxuosa } from "../../shared/hooks/useInvalidateLuxuosa.js";
import { queryKeys } from "../../shared/queryKeys.js";
import { useAuth } from "../auth/useAuth.jsx";
import { useToast } from "../../shared/components/ToastProvider.jsx";
import { useConfirm } from "../../shared/components/ConfirmProvider.jsx";
import { DataTable } from "../../shared/components/DataTable.jsx";
import { PageHeader } from "../../shared/components/ui/PageHeader.jsx";
import { SectionCard } from "../../shared/components/ui/SectionCard.jsx";
import { Input } from "../../shared/components/ui/Input.jsx";
import { Select } from "../../shared/components/ui/Select.jsx";
import { Button } from "../../shared/components/ui/Button.jsx";
import { Modal } from "../../shared/components/ui/Modal.jsx";
import { FormErrorSummary } from "../../shared/components/FormErrorSummary.jsx";
import { StatCard } from "../../shared/components/ui/StatCard.jsx";

const TYPE_LABEL = {
  ADMIN: "Administrador",
  ATTENDANT: "Atendente"
};

function emptyForm() {
  return {
    name: "",
    email: "",
    password: "",
    type: "ATTENDANT"
  };
}

function matchesUserQuery(row, rawQuery) {
  const q = rawQuery.trim().toLowerCase();
  if (!q) return true;
  return (
    (row.name || "").toLowerCase().includes(q) ||
    (row.email || "").toLowerCase().includes(q) ||
    (TYPE_LABEL[row.type] || row.type || "").toLowerCase().includes(q)
  );
}

export function UsersPage() {
  const { token, user } = useAuth();
  const isAdmin = user?.type === "ADMIN";
  const { showToast } = useToast();
  const { confirm } = useConfirm();
  const { invalidateUsers } = useInvalidateLuxuosa(token);
  const usersQuery = useApiQuery(queryKeys.users.list(token), "/users", {
    token,
    enabled: isAdmin
  });
  const items = usersQuery.data ?? [];

  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState("");
  const [form, setForm] = useState(emptyForm);
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  function openCreate() {
    setEditingId("");
    setForm(emptyForm());
    setError("");
    setModalOpen(true);
  }

  function openEdit(row) {
    setEditingId(row.id);
    setForm({
      name: row.name || "",
      email: row.email || "",
      password: "",
      type: row.type || "ATTENDANT"
    });
    setError("");
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
    setEditingId("");
    setForm(emptyForm());
    setError("");
  }

  async function submit() {
    setError("");
    if (!form.name.trim() || form.name.trim().length < 2) {
      setError("Informe o nome (minimo 2 caracteres).");
      return;
    }
    if (!editingId) {
      if (!form.email.trim()) {
        setError("Informe o e-mail.");
        return;
      }
      if (!form.password || form.password.length < 6) {
        setError("A senha deve ter no minimo 6 caracteres.");
        return;
      }
    } else if (form.password && form.password.length < 6) {
      setError("A nova senha deve ter no minimo 6 caracteres.");
      return;
    }

    setLoading(true);
    try {
      if (editingId) {
        const body = {
          name: form.name.trim(),
          type: form.type
        };
        if (form.password) body.password = form.password;
        await apiClient(`/users/${editingId}`, { method: "PUT", token, body });
        showToast("Usuario atualizado.");
      } else {
        await apiClient("/users", {
          method: "POST",
          token,
          body: {
            name: form.name.trim(),
            email: form.email.trim(),
            password: form.password,
            type: form.type
          }
        });
        showToast("Usuario cadastrado.");
      }
      closeModal();
      await invalidateUsers();
    } catch (err) {
      setError(err);
      showToast(err.message, "error");
    } finally {
      setLoading(false);
    }
  }

  async function removeUser(id) {
    try {
      const ok = await confirm({
        title: "Excluir usuario",
        message: "Excluir este usuario? Esta acao nao pode ser desfeita.",
        confirmText: "Excluir"
      });
      if (!ok) return;
      await apiClient(`/users/${id}`, { method: "DELETE", token });
      await invalidateUsers();
      showToast("Usuario excluido.");
      if (editingId === id) closeModal();
    } catch (err) {
      setError(err);
      showToast(err.message, "error");
    }
  }

  if (!isAdmin) {
    return (
      <div className="ui-page">
        <PageHeader title="Usuários" description="Gerencie administradores e atendentes da loja." />
        <SectionCard title="Acesso restrito">
          <p className="text-sm text-slate-600">Apenas administradores podem gerenciar usuários.</p>
          <Link to="/" className="mt-3 inline-flex text-sm text-violet-700 hover:underline">
            Voltar ao início
          </Link>
        </SectionCard>
      </div>
    );
  }

  return (
    <div className="ui-page">
      <PageHeader
        title="Usuários"
        description="Cadastre quem usa o sistema. Administrador configura a loja; Atendente registra vendas e atende o caixa."
      />
      <section className="grid gap-3 sm:grid-cols-2">
        <StatCard
          label="Usuários cadastrados"
          value={items.length}
          icon={<Users className="h-4 w-4 text-violet-600" />}
        />
      </section>

      <div className="flex justify-end">
        <Button type="button" onClick={openCreate}>
          Novo usuário
        </Button>
      </div>

      <DataTable
        title="Lista de usuários"
        data={items}
        columns={[
          { key: "name", label: "Nome" },
          { key: "email", label: "E-mail" },
          { key: "type", label: "Função" },
          { key: "actions", label: "Ações" }
        ]}
        getRowKey={(row) => row.id}
        emptyMessage="Nenhum usuário cadastrado. Clique em Novo usuário para adicionar o primeiro."
        search={{
          query,
          onQueryChange: setQuery,
          placeholder: "Buscar por nome, e-mail ou função...",
          matcher: (row, q) => matchesUserQuery(row, q)
        }}
        renderCells={(row) => (
          <>
            <td className="py-2 font-medium text-slate-900">{row.name}</td>
            <td className="max-w-[220px] truncate py-2 text-sm text-slate-600">{row.email}</td>
            <td className="py-2 text-sm text-slate-700">{TYPE_LABEL[row.type] || row.type}</td>
            <td className="py-2">
              <Button
                type="button"
                variant="secondary"
                className="mr-2 px-2 py-1 text-xs"
                onClick={() => openEdit(row)}
              >
                Editar
              </Button>
              <Button
                type="button"
                variant="danger"
                className="px-2 py-1 text-xs"
                disabled={row.id === user?.id}
                onClick={() => removeUser(row.id)}
              >
                Excluir
              </Button>
            </td>
          </>
        )}
      />

      <Modal
        open={modalOpen}
        title={editingId ? "Editar usuário" : "Novo usuário"}
        onClose={closeModal}
        actions={
          <Button type="button" disabled={loading} onClick={submit}>
            {loading ? "Salvando…" : editingId ? "Atualizar" : "Salvar"}
          </Button>
        }
      >
        <div className="grid gap-3">
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-slate-600">Nome *</span>
            <Input
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="Nome completo"
            />
          </label>
          {!editingId ? (
            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium text-slate-600">E-mail *</span>
              <Input
                type="email"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                placeholder="usuario@loja.com"
              />
            </label>
          ) : (
            <p className="text-sm text-slate-600">
              E-mail: <span className="font-medium text-slate-800">{form.email}</span>
            </p>
          )}
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-slate-600">
              {editingId ? "Nova senha (opcional)" : "Senha *"}
            </span>
            <Input
              type="password"
              value={form.password}
              onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
              placeholder={editingId ? "Deixe em branco para manter" : "Mínimo 6 caracteres"}
              autoComplete="new-password"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-slate-600">Função *</span>
            <Select value={form.type} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}>
              <option value="ATTENDANT">Atendente — vendas e atendimento</option>
              <option value="ADMIN">Administrador — configura a loja</option>
            </Select>
          </label>
          <FormErrorSummary error={error} />
        </div>
      </Modal>
    </div>
  );
}
