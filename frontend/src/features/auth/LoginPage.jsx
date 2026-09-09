import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Eye, EyeOff, ShieldCheck } from "lucide-react";
import { useAuth } from "./useAuth.jsx";
import { Input } from "../../shared/components/ui/Input.jsx";
import { Button } from "../../shared/components/ui/Button.jsx";
import { Alert } from "../../shared/components/ui/Alert.jsx";
import { FormField } from "../../shared/components/ui/FormField.jsx";
import { AuthSplitLayout } from "./AuthSplitLayout.jsx";

function digitsOnly(value) {
  return String(value ?? "").replace(/\D/g, "");
}

export function LoginPage() {
  const { login, token } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [tenantCnpj, setTenantCnpj] = useState("");
  const [needTenantCnpj, setNeedTenantCnpj] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (token) {
      navigate("/vendas", { replace: true });
    }
  }, [token, navigate]);

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(email, password, needTenantCnpj ? tenantCnpj : undefined);
      navigate("/vendas", { replace: true });
    } catch (err) {
      if (err?.code === "TENANT_CNPJ_REQUIRED") {
        setNeedTenantCnpj(true);
      }
      setError(err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthSplitLayout
      badge="Centro de comando da loja"
      headline="Quanto vendeu, o que receber e o que está acabando — num só painel."
      description="Entre para registrar a venda, acompanhar o crediário e cuidar do estoque no dia a dia da loja."
    >
      <div className="ui-surface-interactive p-5 sm:p-8">
        <div className="mb-5 flex items-center gap-2 text-violet-700">
          <ShieldCheck className="h-5 w-5" aria-hidden />
          <span className="text-xs font-semibold uppercase tracking-wide">Acesso seguro</span>
        </div>
        <h2 className="text-xl font-bold text-slate-900 sm:text-2xl">Entrar</h2>
        <p className="mt-1.5 text-sm text-slate-600">Use o e-mail e a senha fornecidos pela sua loja.</p>

        <form className="mt-6 space-y-4 sm:mt-8 sm:space-y-5" onSubmit={handleSubmit}>
          <FormField label="E-mail" htmlFor="login-email" required>
            <Input
              id="login-email"
              type="email"
              autoComplete="email"
              placeholder="voce@loja.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </FormField>

          <FormField label="Senha" htmlFor="login-password" required>
            <div className="relative">
              <Input
                id="login-password"
                className="pr-12"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                placeholder="Sua senha"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
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

          {needTenantCnpj ? (
            <FormField
              label="CNPJ da loja"
              htmlFor="login-cnpj"
              required
              hint="Este e-mail existe em mais de uma loja. Informe o CNPJ (14 dígitos)."
            >
              <Input
                id="login-cnpj"
                inputMode="numeric"
                autoComplete="organization"
                placeholder="00.000.000/0000-00"
                value={tenantCnpj}
                onChange={(e) => setTenantCnpj(digitsOnly(e.target.value).slice(0, 14))}
              />
            </FormField>
          ) : null}

          <p className="text-xs leading-relaxed text-slate-500">
            Esqueceu a senha? Peça ao administrador da sua loja para redefinir o acesso.
          </p>

          <Button className="w-full min-h-11 py-2.5" type="submit" disabled={loading}>
            {loading ? "Entrando…" : "Entrar"}
          </Button>
        </form>

        <p className="mt-5 text-center text-sm text-slate-600">
          Nova loja?{" "}
          <Link className="font-medium text-violet-700 hover:underline" to="/cadastro">
            Criar conta
          </Link>
        </p>

        {error ? (
          <Alert className="mt-5" variant="danger" title="Não foi possível entrar">
            {typeof error === "string" ? error : error.message}
          </Alert>
        ) : null}
      </div>
    </AuthSplitLayout>
  );
}
