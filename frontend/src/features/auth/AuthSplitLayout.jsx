import { BarChart3, Boxes, ShoppingBag, WalletCards } from "lucide-react";

const DEFAULT_FEATURES = [
  { icon: ShoppingBag, label: "PDV", text: "Venda em poucos toques, com grade de tamanho e cor." },
  { icon: WalletCards, label: "Crediário", text: "Fiado, saldo em aberto e recebimentos." },
  { icon: Boxes, label: "Estoque", text: "Entradas, saídas e aviso de mínimo." },
  { icon: BarChart3, label: "Resultados", text: "Faturamento, ticket e relatórios." }
];

/** Layout das telas de acesso: painel de marca (ameixa) + formulário. */
export function AuthSplitLayout({ badge, headline, description, features = DEFAULT_FEATURES, children }) {
  return (
    <main className="grid min-h-dvh grid-cols-1 bg-canvas lg:grid-cols-[minmax(0,1fr)_minmax(26rem,38rem)]">
      <section className="relative overflow-hidden bg-brand-900 px-5 py-6 pt-[max(1.5rem,env(safe-area-inset-top))] text-white sm:px-8 lg:flex lg:flex-col lg:justify-between lg:p-12 xl:p-16">
        <div
          className="pointer-events-none absolute inset-0 opacity-60"
          style={{
            background:
              "radial-gradient(60% 50% at 85% 10%, rgb(var(--champagne-500) / 0.22), transparent 70%), radial-gradient(50% 60% at 0% 100%, rgb(var(--brand-600) / 0.55), transparent 70%)"
          }}
          aria-hidden
        />
        <div className="relative flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 font-display text-2xl text-champagne-100 ring-1 ring-white/15">L</span>
          <span className="font-display text-2xl tracking-wide text-champagne-50">Luxuosa</span>
        </div>

        <div className="relative mt-6 lg:my-10">
          {badge ? <p className="text-2xs font-semibold uppercase tracking-[0.18em] text-champagne-200">{badge}</p> : null}
          <h1 className="mt-3 max-w-xl font-display text-3xl font-normal leading-[1.1] text-white sm:text-4xl lg:text-5xl xl:text-[3.5rem]">
            {headline}
          </h1>
          <p className="mt-4 max-w-lg text-sm leading-relaxed text-white/75 sm:text-base">{description}</p>
        </div>

        <ul className="relative mt-6 hidden grid-cols-2 gap-px overflow-hidden rounded-2xl bg-white/10 ring-1 ring-white/10 sm:grid lg:mt-0">
          {features.map((item) => (
            <li key={item.label} className="bg-brand-900/60 p-4 backdrop-blur-sm">
              <item.icon className="h-4 w-4 text-champagne-200" aria-hidden />
              <p className="mt-2 text-sm font-semibold text-white">{item.label}</p>
              <p className="mt-1 text-xs leading-relaxed text-white/65">{item.text}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className="flex items-start justify-center px-4 py-8 sm:px-8 sm:py-12 lg:items-center lg:px-12">
        <div className="w-full max-w-md">{children}</div>
      </section>
    </main>
  );
}
