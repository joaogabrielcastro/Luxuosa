import { BarChart3, Boxes, ShoppingCart, Sparkles, WalletCards } from "lucide-react";

const DEFAULT_FEATURES = [
  { icon: ShoppingCart, label: "Vendas", text: "PDV à vista, descontos e histórico." },
  { icon: WalletCards, label: "Crediário", text: "Fiado, saldo em aberto e recebimentos." },
  { icon: Boxes, label: "Estoque", text: "Entradas, saídas e aviso de mínimo." },
  { icon: BarChart3, label: "Resultados", text: "Início, ticket e relatórios da loja." }
];

export function AuthSplitLayout({ badge, headline, description, features = DEFAULT_FEATURES, children }) {
  return (
    <main className="grid min-h-dvh grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(24rem,40rem)]">
      <section
        className="relative overflow-hidden px-4 py-5 pt-[max(1.25rem,env(safe-area-inset-top))] text-white sm:px-6 lg:flex lg:flex-col lg:justify-between lg:p-10 lg:pt-10 xl:p-14"
        style={{ background: "var(--gradient-brand)" }}
      >
        <div className="pointer-events-none absolute -right-20 -top-16 h-56 w-64 rounded-full bg-white/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-20 -left-10 h-48 w-48 rounded-full bg-blue-900/25 blur-2xl" />

        <div className="relative inline-flex w-fit items-center gap-2 rounded-full border border-white/30 bg-white/15 px-3 py-1.5 text-xs font-medium text-white backdrop-blur-sm">
          <Sparkles className="h-3.5 w-3.5 text-white" aria-hidden />
          {badge}
        </div>

        <div className="relative mt-4 lg:my-8">
          <h1 className="max-w-xl text-2xl font-bold leading-tight tracking-tight text-white sm:text-3xl lg:text-4xl xl:text-5xl">
            {headline}
          </h1>
          <p className="mt-3 max-w-lg text-sm leading-relaxed text-white/85 sm:text-base">{description}</p>
        </div>

        <div className="relative mt-5 hidden grid-cols-2 gap-3 sm:grid lg:mt-0">
          {features.map((item) => (
            <div
              key={item.label}
              className="rounded-2xl border border-white/20 bg-white/10 p-4 shadow-lg backdrop-blur-md"
            >
              <item.icon className="h-4 w-4 text-violet-100" aria-hidden />
              <p className="mt-2 text-sm font-semibold text-white">{item.label}</p>
              <p className="mt-1 text-xs leading-relaxed text-violet-100">{item.text}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="flex items-start justify-center px-4 py-6 sm:px-8 sm:py-10 lg:items-center lg:px-10 xl:px-14">
        <div className="w-full max-w-md lg:max-w-none">{children}</div>
      </section>
    </main>
  );
}
