import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "../../shared/apiClient.js";
import { useAuth } from "../auth/useAuth.jsx";
import { useToast } from "../../shared/components/ToastProvider.jsx";
import { formatDateTimeBR } from "../../shared/formatters.js";
import { unwrapList } from "../../shared/apiList.js";
import { queryKeys } from "../../shared/queryKeys.js";
import { PageHeader } from "../../shared/components/ui/PageHeader.jsx";
import { SectionCard } from "../../shared/components/ui/SectionCard.jsx";
import { Input } from "../../shared/components/ui/Input.jsx";
import { Select } from "../../shared/components/ui/Select.jsx";
import { Button } from "../../shared/components/ui/Button.jsx";
import { EmptyState } from "../../shared/components/ui/EmptyState.jsx";
import { ModuleNav } from "../../shared/components/ModuleNav.jsx";
import { stockModuleItems } from "../../shared/navConfig.js";

export function StockAlertsPage() {
  const { token, user } = useAuth();
  const isAdmin = user?.type === "ADMIN";
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    enabled: false,
    email: "",
    phone: "",
    minSeverity: "low",
    cooldownMin: "1440"
  });
  const [formReady, setFormReady] = useState(false);

  const settingsQuery = useQuery({
    queryKey: queryKeys.stockAlerts.settings(token),
    enabled: Boolean(token) && isAdmin,
    queryFn: async () => {
      const data = await apiClient("/stock-alerts/settings", { token });
      setForm({
        enabled: Boolean(data.enabled),
        email: data.email || "",
        phone: data.phone || "",
        minSeverity: data.minSeverity || "low",
        cooldownMin: String(data.cooldownMin ?? 1440)
      });
      setFormReady(true);
      return data;
    }
  });

  const logsQuery = useQuery({
    queryKey: queryKeys.stockAlerts.logs(token),
    enabled: Boolean(token),
    queryFn: () => apiClient("/stock-alerts/logs?take=40&skip=0", { token })
  });

  const logs = useMemo(() => unwrapList(logsQuery.data), [logsQuery.data]);

  async function saveSettings(e) {
    e.preventDefault();
    if (!isAdmin) return;
    setBusy(true);
    try {
      await apiClient("/stock-alerts/settings", {
        method: "PUT",
        token,
        body: {
          enabled: form.enabled,
          email: form.email || null,
          phone: form.phone || null,
          minSeverity: form.minSeverity,
          cooldownMin: Number(form.cooldownMin) || 0
        }
      });
      showToast("Configuracoes salvas.", "success");
      await queryClient.invalidateQueries({ queryKey: queryKeys.stockAlerts.all(token) });
    } catch (err) {
      showToast(err?.message || "Falha ao salvar.", "error");
    } finally {
      setBusy(false);
    }
  }

  async function runNow() {
    if (!isAdmin) return;
    setBusy(true);
    try {
      const result = await apiClient("/stock-alerts/run", { method: "POST", token });
      if (!result.ran) {
        showToast(result.reason === "disabled" ? "Alertas desabilitados." : "Nada a disparar.", "success");
      } else {
        showToast(`Disparo concluido (${result.alerts?.length || 0} produto(s)).`, "success");
      }
      await queryClient.invalidateQueries({ queryKey: queryKeys.stockAlerts.logs(token) });
    } catch (err) {
      showToast(err?.message || "Falha ao disparar alertas.", "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="ui-page">
      <PageHeader
        title="Alertas de estoque"
        description="Envia e-mail ou WhatsApp quando faltar produto. O mínimo se define em Produtos."
      />
      <ModuleNav items={stockModuleItems(isAdmin)} label="Estoque" />

      {isAdmin ? (
        <SectionCard title="Configurações">
          {settingsQuery.isLoading && !formReady ? (
            <p className="mt-3 text-sm text-slate-500">Carregando...</p>
          ) : settingsQuery.error ? (
            <p className="mt-3 text-sm text-rose-600">
              {settingsQuery.error.message || "Recurso disponível a partir do plano PRO."}
            </p>
          ) : (
            <form className="mt-3 grid gap-3 md:grid-cols-2" onSubmit={saveSettings}>
              <label className="flex items-center gap-2 md:col-span-2">
                <input
                  type="checkbox"
                  checked={form.enabled}
                  onChange={(e) => setForm((f) => ({ ...f, enabled: e.target.checked }))}
                />
                <span className="text-sm font-medium text-slate-700">Avisos habilitados</span>
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-xs font-medium text-slate-600">E-mail</span>
                <Input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                  placeholder="estoque@loja.com"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-xs font-medium text-slate-600">WhatsApp / telefone</span>
                <Input
                  value={form.phone}
                  onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                  placeholder="5511999999999"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-xs font-medium text-slate-600">Severidade mínima</span>
                <Select
                  value={form.minSeverity}
                  onChange={(e) => setForm((f) => ({ ...f, minSeverity: e.target.value }))}
                >
                  <option value="low">Baixo e crítico</option>
                  <option value="critical">Somente crítico</option>
                </Select>
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-xs font-medium text-slate-600">Esperar minutos entre avisos</span>
                <Input
                  type="number"
                  min="0"
                  value={form.cooldownMin}
                  onChange={(e) => setForm((f) => ({ ...f, cooldownMin: e.target.value }))}
                />
              </label>
              <div className="flex flex-wrap gap-2 md:col-span-2">
                <Button type="submit" disabled={busy}>
                  Salvar
                </Button>
                <Button type="button" variant="secondary" disabled={busy} onClick={runNow}>
                  Verificar agora
                </Button>
              </div>
            </form>
          )}
        </SectionCard>
      ) : (
        <SectionCard title="Configurações">
          <p className="mt-3 text-sm text-slate-500">Apenas administradores alteram as configurações.</p>
        </SectionCard>
      )}

      <div className="mt-4">
        <SectionCard title="Avisos enviados">
          {logsQuery.isLoading ? (
            <p className="mt-3 text-sm text-slate-500">Carregando...</p>
          ) : logs.length === 0 ? (
            <EmptyState
              title="Nenhum aviso enviado"
              description="Salve as configurações e clique em Verificar agora para checar o estoque."
            />
          ) : (
            <div className="mt-3 overflow-x-auto">
              <table className="ui-table min-w-full text-sm">
                <thead>
                  <tr>
                    <th>Quando</th>
                    <th>Canal</th>
                    <th>Severidade</th>
                    <th>Status</th>
                    <th>Mensagem</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((row) => (
                    <tr key={row.id}>
                      <td>{formatDateTimeBR(row.createdAt)}</td>
                      <td>{row.channel}</td>
                      <td>
                        {row.severity === "critical"
                          ? "Crítico"
                          : row.severity === "low"
                            ? "Baixo"
                            : row.severity || "—"}
                      </td>
                      <td>{row.status}</td>
                      <td className="max-w-xs truncate" title={row.message || row.error || ""}>
                        {row.message || row.error || "—"}
                      </td>
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
