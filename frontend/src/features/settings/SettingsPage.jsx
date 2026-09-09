import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../auth/useAuth.jsx";
import { apiClient } from "../../shared/apiClient.js";
import { useToast } from "../../shared/components/ToastProvider.jsx";
import { PageHeader } from "../../shared/components/ui/PageHeader.jsx";
import { SectionCard } from "../../shared/components/ui/SectionCard.jsx";
import { Input } from "../../shared/components/ui/Input.jsx";
import { Button } from "../../shared/components/ui/Button.jsx";
import { Alert } from "../../shared/components/ui/Alert.jsx";
import { Badge } from "../../shared/components/ui/Badge.jsx";
import { FiscalEmitenteBanner } from "../../shared/components/FiscalEmitenteBanner.jsx";
import { formatCnpjBr } from "../../shared/formatters.js";

const PLAN_LABEL = {
  BASIC: "Básico",
  PRO: "Pro",
  ENTERPRISE: "Enterprise"
};

export function SettingsPage() {
  const { token, user, tenant, refreshSession } = useAuth();
  const isAdmin = user?.type === "ADMIN";
  const { showToast } = useToast();
  const [enableNfce, setEnableNfce] = useState(false);
  const [projectId, setProjectId] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [busy, setBusy] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [testError, setTestError] = useState("");

  useEffect(() => {
    setEnableNfce(Boolean(tenant?.enableNfceEmission));
    setProjectId(tenant?.notaasProjectId || "");
  }, [tenant?.enableNfceEmission, tenant?.notaasProjectId]);

  if (!isAdmin) {
    return (
      <div className="ui-page">
        <PageHeader title="Configurações" description="Dados da loja e emissão de notas." />
        <SectionCard title="Acesso restrito">
          <p className="text-sm text-slate-600">Apenas administradores alteram as configurações da loja.</p>
          <Link to="/" className="mt-3 inline-flex text-sm text-violet-700 hover:underline">
            Voltar ao início
          </Link>
        </SectionCard>
      </div>
    );
  }

  async function saveNotaas(e) {
    e.preventDefault();
    setBusy(true);
    setTestError("");
    try {
      const body = {
        enableNfceEmission: enableNfce,
        notaasProjectId: projectId.trim() || null
      };
      const key = apiKey.trim();
      if (key) body.notaasApiKey = key;
      await apiClient("/invoices/notaas-config", { method: "PATCH", token, body });
      setApiKey("");
      showToast("Configuração fiscal salva.");
      await refreshSession();
    } catch (err) {
      showToast(err.message || "Não foi possível salvar.", "error");
    } finally {
      setBusy(false);
    }
  }

  async function testConnection() {
    setBusy(true);
    setTestError("");
    setTestResult(null);
    try {
      const data = await apiClient("/invoices/connection-test", { token });
      setTestResult(data);
      showToast(data.ok ? "Conexão com a Notaas ok." : "Conexão com avisos. Veja os detalhes.");
    } catch (err) {
      setTestError(err.message || "Falha no teste de conexão.");
      showToast(err.message || "Falha no teste de conexão.", "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="ui-page">
      <PageHeader
        title="Configurações"
        description="Dados da loja e emissão de nota fiscal. Usuários e plano ficam nos atalhos abaixo."
      />

      <SectionCard title="Loja">
        <dl className="mt-1 grid gap-3 sm:grid-cols-2 text-sm">
          <div>
            <dt className="text-xs font-medium text-slate-500">Nome</dt>
            <dd className="mt-0.5 font-medium text-slate-900">{tenant?.name || "—"}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-slate-500">CNPJ</dt>
            <dd className="mt-0.5 font-medium text-slate-900">{formatCnpjBr(tenant?.cnpj) || "—"}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-slate-500">Plano</dt>
            <dd className="mt-0.5">
              <Badge variant="info">{PLAN_LABEL[tenant?.plan] || tenant?.plan || "—"}</Badge>
            </dd>
          </div>
        </dl>
        <div className="mt-4 flex flex-wrap gap-3 text-sm">
          <Link to="/usuarios" className="text-violet-700 hover:underline">
            Usuários
          </Link>
          <Link to="/assinatura" className="text-violet-700 hover:underline">
            Assinatura
          </Link>
        </div>
      </SectionCard>

      <SectionCard
        title="Nota fiscal (Notaas)"
        description="A emissão da nota continua na tela de Vendas. Aqui você liga o recurso e grava a chave da loja."
      >
        <div className="mb-4">
          <FiscalEmitenteBanner />
        </div>
        <form className="grid gap-3" onSubmit={saveNotaas}>
          <label className="flex items-start gap-2">
            <input
              type="checkbox"
              className="mt-1"
              checked={enableNfce}
              onChange={(e) => setEnableNfce(e.target.checked)}
            />
            <span>
              <span className="text-sm font-medium text-slate-800">Emitir NFC-e nas vendas</span>
              <span className="mt-0.5 block text-xs text-slate-500">
                Só ligue depois de cadastrar o projeto da loja na Notaas (mesmo CNPJ).
              </span>
            </span>
          </label>
          <label className="flex max-w-md flex-col gap-1">
            <span className="text-xs font-medium text-slate-600">ID do projeto Notaas (opcional)</span>
            <Input
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
              placeholder="Identificador do projeto"
              autoComplete="off"
            />
          </label>
          <label className="flex max-w-md flex-col gap-1">
            <span className="text-xs font-medium text-slate-600">API Key</span>
            <Input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder={
                tenant?.hasNotaasApiKey
                  ? "Chave já cadastrada — cole outra só se for substituir"
                  : "Cole a chave ntaas_..."
              }
              autoComplete="off"
            />
          </label>
          <div className="flex flex-wrap gap-2">
            <Button type="submit" disabled={busy}>
              {busy ? "Salvando…" : "Salvar"}
            </Button>
            <Button type="button" variant="secondary" disabled={busy} onClick={testConnection}>
              Testar conexão
            </Button>
          </div>
        </form>
        {testError ? (
          <Alert variant="danger" className="mt-3">
            {testError}
          </Alert>
        ) : null}
        {testResult ? (
          <Alert variant={testResult.ok ? "info" : "warning"} className="mt-3" title={testResult.ok ? "Conexão ok" : "Há pendências"}>
            <p className="text-sm">
              Ambiente: {testResult.environment || "—"}.
              {testResult.tenant?.cnpjFormatado ? ` CNPJ ${testResult.tenant.cnpjFormatado}.` : ""}
            </p>
            {Array.isArray(testResult.warnings) && testResult.warnings.length ? (
              <ul className="mt-2 list-disc space-y-1 pl-5 text-xs">
                {testResult.warnings.map((w) => (
                  <li key={w}>{w}</li>
                ))}
              </ul>
            ) : null}
          </Alert>
        ) : null}
      </SectionCard>
    </div>
  );
}
