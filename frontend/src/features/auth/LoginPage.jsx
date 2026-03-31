import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "./useAuth.jsx";
import { Input } from "../../shared/components/ui/Input.jsx";
import { Button } from "../../shared/components/ui/Button.jsx";
import { Alert } from "../../shared/components/ui/Alert.jsx";

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
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="grid min-h-screen grid-cols-1 bg-slate-50 lg:grid-cols-2">
      <section className="hidden p-8 lg:flex lg:flex-col lg:justify-between lg:bg-gradient-to-br lg:from-[#6366F1] lg:to-[#8B5CF6]">
        <div className="inline-flex w-fit items-center rounded-full border border-white/30 bg-white/15 px-3 py-1 text-xs font-medium text-white">
          Plataforma Multi-tenant
        </div>

        <div className="my-6">
          <h1 className="max-w-md text-4xl font-semibold leading-tight text-white">
            Gerencie sua operacao com mais controle e eficiencia.
          </h1>
          <p className="mt-3 max-w-lg text-sm text-indigo-100">
            Acompanhe vendas, estoque e emissao fiscal em uma experiencia simples para equipes e clientes multi-tenant.
          </p>
        </div>

        <div className="relative overflow-hidden rounded-2xl border border-white/25 bg-white/10 p-4 shadow-2xl backdrop-blur-sm">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-xs font-medium text-white/90">Dashboard em tempo real</span>
            <span className="h-2 w-2 rounded-full bg-emerald-300" />
          </div>
          <div className="grid gap-3">
            <div className="grid grid-cols-3 gap-2">
              <div className="rounded-lg bg-white/85 p-2">
                <p className="text-[11px] text-slate-500">Receita</p>
                <p className="text-sm font-semibold text-slate-900">R$ 24,8k</p>
              </div>
              <div className="rounded-lg bg-white/85 p-2">
                <p className="text-[11px] text-slate-500">Pedidos</p>
                <p className="text-sm font-semibold text-slate-900">318</p>
              </div>
              <div className="rounded-lg bg-white/85 p-2">
                <p className="text-[11px] text-slate-500">Ticket</p>
                <p className="text-sm font-semibold text-slate-900">R$ 78</p>
              </div>
            </div>
            <div className="rounded-xl bg-white/85 p-3">
              <p className="mb-2 text-[11px] text-slate-500">Fluxo operacional</p>
              <div className="h-2 rounded bg-slate-200">
                <div className="h-2 w-4/5 rounded bg-indigo-500" />
              </div>
              <div className="mt-2 h-2 rounded bg-slate-200">
                <div className="h-2 w-3/5 rounded bg-violet-500" />
              </div>
              <div className="mt-2 h-2 rounded bg-slate-200">
                <div className="h-2 w-11/12 rounded bg-blue-500" />
              </div>
            </div>
            <div className="rounded-xl bg-white/85 p-3">
              <p className="text-[11px] text-slate-500">NFC-e</p>
              <div className="mt-1 flex items-center justify-between text-xs">
                <span className="text-slate-600">Autorizadas hoje</span>
                <span className="font-semibold text-slate-900">124</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="flex items-center justify-center p-4 sm:p-8">
        <div className="ui-surface w-full max-w-[420px] p-7 shadow-md transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg sm:p-8">
          <div className="mb-4 inline-flex rounded-full border border-violet-200 bg-violet-50 px-3 py-1 text-xs font-medium text-violet-700">
            Acesso seguro
          </div>
          <h2 className="text-xl font-semibold text-slate-900">Entrar na plataforma</h2>
          <p className="mt-1 text-sm text-slate-500">Use seu email e senha para acessar sua conta.</p>
          <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
            <label>
              <span className="ui-label">Email</span>
              <Input type="email" placeholder="voce@loja.com" value={email} onChange={(e) => setEmail(e.target.value)} />
            </label>
            <label>
              <span className="ui-label">Senha</span>
              <div className="flex gap-2">
                <Input
                  type={showPassword ? "text" : "password"}
                  placeholder="Sua senha"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <Button type="button" variant="secondary" className="px-3" onClick={() => setShowPassword((v) => !v)}>
                  {showPassword ? "Ocultar" : "Mostrar"}
                </Button>
              </div>
            </label>
            <button type="button" className="text-xs text-indigo-700 hover:text-indigo-800 hover:underline">
              Esqueci minha senha
            </button>
            <Button className="w-full" type="submit" disabled={loading}>
              {loading ? "Entrando..." : "Entrar"}
            </Button>
          </form>
          {error ? (
            <Alert className="mt-4" variant="danger" title="Nao foi possivel entrar">
              {error}
            </Alert>
          ) : null}
        </div>
      </section>
    </main>
  );
}
