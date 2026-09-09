import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Eye, EyeOff, ShieldCheck } from "lucide-react";
import { apiClient } from "../../shared/apiClient.js";
import { useAuth } from "./useAuth.jsx";
import { Input } from "../../shared/components/ui/Input.jsx";
import { Button } from "../../shared/components/ui/Button.jsx";
import { Alert } from "../../shared/components/ui/Alert.jsx";
import { FormField } from "../../shared/components/ui/FormField.jsx";
import { AuthSplitLayout } from "./AuthSplitLayout.jsx";

function digitsOnly(value) {
  return String(value ?? "").replace(/\D/g, "");
}

const emptyForm = {
  tenantName: "",
  cnpj: "",
  tenantEmail: "",
  tenantPhone: "",
  adminName: "",
  adminEmail: "",
  adminPassword: ""
};

export function RegisterPage() {
  const { token, acceptSession } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState(emptyForm);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (token) {
      navigate("/vendas", { replace: true });
    }
  }, [token, navigate]);

  function updateField(key, value) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");

    const cnpj = digitsOnly(form.cnpj);
    if (cnpj.length !== 14) {
      setError("Informe o CNPJ com 14 digitos.");
      return;
    }
    if (!form.tenantName.trim() || form.tenantName.trim().length < 2) {
      setError("Informe o nome da loja.");
      return;
    }
    if (!form.adminName.trim() || form.adminName.trim().length < 2) {
      setError("Informe o nome do administrador.");
      return;
    }
    if (!form.adminPassword || form.adminPassword.length < 6) {
      setError("A senha deve ter no minimo 6 caracteres.");
      return;
    }

    setLoading(true);
    try {
      const body = {
        tenantName: form.tenantName.trim(),
        cnpj,
        tenantEmail: form.tenantEmail.trim(),
        adminName: form.adminName.trim(),
        adminEmail: form.adminEmail.trim(),
        adminPassword: form.adminPassword
      };
      const phone = digitsOnly(form.tenantPhone);
      if (phone.length >= 8) body.tenantPhone = phone;

      const data = await apiClient("/auth/register", { method: "POST", body });
      acceptSession(data);
      navigate("/vendas", { replace: true });
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthSplitLayout
      badge="Comece em minutos"
      headline="Sua loja no ar, com o painel pronto para vender."
      description="Cadastre a loja, defina o administrador e entre para registrar vendas, crediário e estoque."
    >
      <div className="ui-surface-interactive p-5 sm:p-8">
        <div className="mb-5 flex items-center gap-2 text-violet-700">
          <ShieldCheck className="h-5 w-5" aria-hidden />
          <span className="text-xs font-semibold uppercase tracking-wide">Nova loja</span>
        </div>
        <h2 className="text-xl font-bold text-slate-900 sm:text-2xl">Criar conta</h2>
        <p className="mt-1.5 text-sm text-slate-600">
          Informe os dados da loja e do administrador. Você entrará automaticamente após o cadastro.
        </p>

        <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Dados da loja</p>

          <FormField label="Nome da loja" htmlFor="reg-tenant-name" required>
            <Input
              id="reg-tenant-name"
              value={form.tenantName}
              onChange={(e) => updateField("tenantName", e.target.value)}
              placeholder="Minha Loja"
            />
          </FormField>

          <FormField label="CNPJ" htmlFor="reg-cnpj" required hint="Apenas números (14 dígitos).">
            <Input
              id="reg-cnpj"
              inputMode="numeric"
              autoComplete="organization"
              placeholder="00.000.000/0000-00"
              value={form.cnpj}
              onChange={(e) => updateField("cnpj", digitsOnly(e.target.value).slice(0, 14))}
            />
          </FormField>

          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="E-mail da loja" htmlFor="reg-tenant-email" required>
              <Input
                id="reg-tenant-email"
                type="email"
                autoComplete="email"
                placeholder="contato@loja.com"
                value={form.tenantEmail}
                onChange={(e) => updateField("tenantEmail", e.target.value)}
              />
            </FormField>
            <FormField label="Telefone da loja" htmlFor="reg-tenant-phone">
              <Input
                id="reg-tenant-phone"
                inputMode="tel"
                placeholder="Com DDD (opcional)"
                value={form.tenantPhone}
                onChange={(e) => updateField("tenantPhone", e.target.value)}
              />
            </FormField>
          </div>

          <p className="pt-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Administrador</p>

          <FormField label="Seu nome" htmlFor="reg-admin-name" required>
            <Input
              id="reg-admin-name"
              value={form.adminName}
              onChange={(e) => updateField("adminName", e.target.value)}
              placeholder="Nome completo"
            />
          </FormField>

          <FormField label="E-mail de acesso" htmlFor="reg-admin-email" required>
            <Input
              id="reg-admin-email"
              type="email"
              autoComplete="username"
              placeholder="voce@loja.com"
              value={form.adminEmail}
              onChange={(e) => updateField("adminEmail", e.target.value)}
            />
          </FormField>

          <FormField label="Senha" htmlFor="reg-admin-password" required>
            <div className="relative">
              <Input
                id="reg-admin-password"
                className="pr-12"
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
                placeholder="Mínimo 6 caracteres"
                value={form.adminPassword}
                onChange={(e) => updateField("adminPassword", e.target.value)}
              />
              <button
                type="button"
                className="absolute inset-y-0 right-0 inline-flex w-11 items-center justify-center text-slate-500 hover:text-slate-800"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </FormField>

          <Button className="w-full min-h-11 py-2.5" type="submit" disabled={loading}>
            {loading ? "Criando conta…" : "Criar conta e entrar"}
          </Button>
        </form>

        <p className="mt-5 text-center text-sm text-slate-600">
          Já tem conta?{" "}
          <Link className="font-medium text-violet-700 hover:underline" to="/login">
            Entrar
          </Link>
        </p>

        {error ? (
          <Alert className="mt-5" variant="danger" title="Não foi possível cadastrar">
            {typeof error === "string" ? error : error.message}
          </Alert>
        ) : null}
      </div>
    </AuthSplitLayout>
  );
}
