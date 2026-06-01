import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Eye, EyeOff, ShieldCheck, Sparkles } from "lucide-react";
import { useAuth } from "./useAuth.jsx";
import { Input } from "../../shared/components/ui/Input.jsx";
import { Button } from "../../shared/components/ui/Button.jsx";
import { Alert } from "../../shared/components/ui/Alert.jsx";
import { FormField } from "../../shared/components/ui/FormField.jsx";

export function LoginPage() {
  const { login, token } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
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
      await login(email, password);
      navigate("/vendas", { replace: true });
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="grid min-h-screen grid-cols-1 lg:grid-cols-2">
      <section
        className="relative hidden overflow-hidden p-8 lg:flex lg:flex-col lg:justify-between"
        style={{ background: "var(--gradient-brand)" }}
      >
        <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-white/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-16 -left-16 h-48 w-48 rounded-full bg-blue-900/30 blur-2xl" />

        <div className="relative inline-flex w-fit items-center gap-2 rounded-full border border-white/25 bg-white/10 px-3 py-1.5 text-xs font-medium text-white backdrop-blur-sm">
          <Sparkles className="h-3.5 w-3.5" aria-hidden />
          Gestão completa para sua loja
        </div>

        <div className="relative my-8">
          <h1 className="max-w-md text-4xl font-bold leading-tight tracking-tight text-white">
            Vendas, estoque e clientes em um só lugar.
          </h1>
          <p className="mt-4 max-w-lg text-sm leading-relaxed text-violet-100">
            Interface pensada para o dia a dia da loja: registrar vendas, controlar estoque e acompanhar resultados com
            clareza.
          </p>
        </div>

        <div className="relative overflow-hidden rounded-2xl border border-white/20 bg-white/10 p-5 shadow-2xl backdrop-blur-md">
          <div className="mb-4 flex items-center justify-between">
            <span className="text-xs font-semibold text-white/90">Resumo do dia</span>
            <span className="flex items-center gap-1.5 text-[11px] text-emerald-200">
              <span className="h-2 w-2 rounded-full bg-emerald-300" />
              Ao vivo
            </span>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {[
              { label: "Receita", value: "R$ 24,8k" },
              { label: "Pedidos", value: "318" },
              { label: "Ticket", value: "R$ 78" }
            ].map((item) => (
              <div key={item.label} className="rounded-xl bg-white p-2.5 shadow-sm">
                <p className="text-[11px] text-slate-500">{item.label}</p>
                <p className="text-sm font-bold text-slate-900">{item.value}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="flex items-center justify-center p-4 sm:p-10">
        <div className="ui-surface-interactive w-full max-w-[420px] p-7 sm:p-9">
          <div className="mb-6 flex items-center gap-2 text-violet-700">
            <ShieldCheck className="h-5 w-5" aria-hidden />
            <span className="text-xs font-semibold uppercase tracking-wide">Acesso seguro</span>
          </div>
          <h2 className="text-2xl font-bold text-slate-900">Entrar</h2>
          <p className="mt-1.5 text-sm text-slate-600">Use o e-mail e a senha fornecidos pela sua loja.</p>

          <form className="mt-8 space-y-5" onSubmit={handleSubmit}>
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
              <div className="flex gap-2">
                <Input
                  id="login-password"
                  className="flex-1"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  placeholder="Sua senha"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <Button
                  type="button"
                  variant="secondary"
                  className="shrink-0 px-3"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
            </FormField>

            <p className="text-xs text-slate-500">
              Esqueceu a senha? Peça ao administrador da sua loja para redefinir o acesso.
            </p>

            <Button className="w-full py-2.5" type="submit" disabled={loading}>
              {loading ? "Entrando…" : "Entrar na plataforma"}
            </Button>
          </form>

          {error ? (
            <Alert className="mt-5" variant="danger" title="Não foi possível entrar">
              {typeof error === "string" ? error : error.message}
            </Alert>
          ) : null}
        </div>
      </section>
    </main>
  );
}
