import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "../../shared/apiClient.js";
import { useAuth } from "../auth/useAuth.jsx";
import { queryKeys } from "../../shared/queryKeys.js";
import { formatDateTimeBR } from "../../shared/formatters.js";
import { PageHeader } from "../../shared/components/ui/PageHeader.jsx";
import { SectionCard } from "../../shared/components/ui/SectionCard.jsx";
import { Input } from "../../shared/components/ui/Input.jsx";
import { Select } from "../../shared/components/ui/Select.jsx";
import { Button } from "../../shared/components/ui/Button.jsx";
import { EmptyState } from "../../shared/components/ui/EmptyState.jsx";
import { Alert } from "../../shared/components/ui/Alert.jsx";

const ACTION_LABELS = {
  STOCK_ENTRY: "Entrada de estoque",
  STOCK_EXIT: "Saida de estoque",
  NFE_IMPORT_COMPLETED: "Importacao NF-e",
  PRODUCT_CREATED: "Produto criado",
  PRODUCT_PRICE_CHANGED: "Preco alterado",
  PRODUCT_COST_CHANGED: "Custo alterado",
  SALE_CREATED: "Venda",
  SALE_CANCELED: "Venda cancelada",
  CASH_OPENED: "Caixa aberto",
  CASH_CLOSED: "Caixa fechado",
  USER_CREATED: "Usuario criado",
  USER_UPDATED: "Usuario atualizado",
  USER_DELETED: "Usuario excluido"
};

const PAGE_SIZE = 50;

export function AuditLogsPage() {
  const { token, user } = useAuth();
  const isAdmin = user?.type === "ADMIN";
  const [skip, setSkip] = useState(0);
  const [action, setAction] = useState("");
  const [q, setQ] = useState("");
  const [qApplied, setQApplied] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const params = useMemo(
    () => ({ skip, take: PAGE_SIZE, action, q: qApplied, from, to }),
    [skip, action, qApplied, from, to]
  );

  const logsQuery = useQuery({
    queryKey: queryKeys.auditLogs.list(token, params),
    enabled: Boolean(token) && isAdmin,
    queryFn: () => {
      const search = new URLSearchParams();
      search.set("take", String(PAGE_SIZE));
      search.set("skip", String(skip));
      if (action) search.set("action", action);
      if (qApplied) search.set("q", qApplied);
      if (from) search.set("from", from);
      if (to) search.set("to", to);
      return apiClient(`/audit-logs?${search.toString()}`, { token });
    }
  });

  const items = logsQuery.data?.items || [];
  const total = logsQuery.data?.total || 0;
  const page = Math.floor(skip / PAGE_SIZE) + 1;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

  if (!isAdmin) {
    return (
      <Alert variant="warning">Apenas administradores podem ver o historico de acoes.</Alert>
    );
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Auditoria"
        description="Historico de acoes da loja: estoque, NF-e, precos, vendas, caixa e usuarios."
      />

      <SectionCard title="Filtros">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-slate-600">Acao</span>
            <Select
              value={action}
              onChange={(e) => {
                setSkip(0);
                setAction(e.target.value);
              }}
            >
              <option value="">Todas</option>
              {Object.entries(ACTION_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-slate-600">De</span>
            <Input
              type="date"
              value={from}
              onChange={(e) => {
                setSkip(0);
                setFrom(e.target.value);
              }}
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-slate-600">Ate</span>
            <Input
              type="date"
              value={to}
              onChange={(e) => {
                setSkip(0);
                setTo(e.target.value);
              }}
            />
          </label>
          <label className="flex flex-col gap-1 sm:col-span-2">
            <span className="text-xs font-medium text-slate-600">Busca</span>
            <div className="flex gap-2">
              <Input
                value={q}
                placeholder="Resumo, acao ou id..."
                onChange={(e) => setQ(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    setSkip(0);
                    setQApplied(q.trim());
                  }
                }}
              />
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  setSkip(0);
                  setQApplied(q.trim());
                }}
              >
                Filtrar
              </Button>
            </div>
          </label>
        </div>
      </SectionCard>

      <SectionCard title={`Eventos (${total})`}>
        {logsQuery.isLoading ? (
          <p className="text-sm text-slate-500">Carregando...</p>
        ) : items.length === 0 ? (
          <EmptyState
            title="Nenhum evento ainda"
            description="As acoes passam a aparecer aqui apos entradas de estoque, NF-e, vendas e alteracoes de preco."
          />
        ) : (
          <div className="overflow-x-auto rounded-lg border border-slate-200">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs font-medium text-slate-600">
                <tr>
                  <th className="px-3 py-2">Quando</th>
                  <th className="px-3 py-2">Quem</th>
                  <th className="px-3 py-2">Acao</th>
                  <th className="px-3 py-2">Resumo</th>
                </tr>
              </thead>
              <tbody>
                {items.map((row) => (
                  <tr key={row.id} className="border-b border-slate-100 last:border-0">
                    <td className="whitespace-nowrap px-3 py-2 text-slate-600">
                      {formatDateTimeBR(row.createdAt)}
                    </td>
                    <td className="px-3 py-2">
                      {row.user?.name || (
                        <span className="text-slate-400">Sistema / desconhecido</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-slate-700">
                      {ACTION_LABELS[row.action] || row.action}
                    </td>
                    <td className="px-3 py-2 text-slate-800">{row.summary}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {total > PAGE_SIZE ? (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="secondary"
              className="text-sm"
              disabled={skip <= 0}
              onClick={() => setSkip((s) => Math.max(0, s - PAGE_SIZE))}
            >
              Anterior
            </Button>
            <span className="text-xs text-slate-500">
              Pagina {page} de {pageCount}
            </span>
            <Button
              type="button"
              variant="secondary"
              className="text-sm"
              disabled={skip + PAGE_SIZE >= total}
              onClick={() => setSkip((s) => s + PAGE_SIZE)}
            >
              Proxima
            </Button>
          </div>
        ) : null}
      </SectionCard>
    </div>
  );
}
