import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { App } from "./app/App.jsx";
import "./styles.css";

document.documentElement.setAttribute("data-luxuosa-ui", "nfce-sales-module");

if (import.meta.env.DEV) {
  console.info("[Luxuosa] dev · /vendas (rota /sales redireciona no index.html e no React)");
}

class RootErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { err: null };
  }

  static getDerivedStateFromError(err) {
    return { err };
  }

  componentDidCatch(err, info) {
    console.error("[Luxuosa] erro de render:", err, info);
  }

  render() {
    if (this.state.err) {
      return (
        <div className="mx-auto max-w-lg p-6 text-slate-800">
          <h1 className="text-lg font-semibold">Erro ao carregar a aplicacao</h1>
          <p className="mt-2 text-sm text-slate-600">
            Atualize com Ctrl+Shift+R ou limpe o cache do site para localhost. Se persistir, abra o console (F12).
          </p>
          <pre className="mt-3 max-h-40 overflow-auto rounded bg-slate-100 p-2 text-xs">{String(this.state.err?.message || this.state.err)}</pre>
        </div>
      );
    }
    return this.props.children;
  }
}

const rootEl = document.getElementById("root");
if (!rootEl) {
  throw new Error("Elemento #root nao encontrado no index.html.");
}

ReactDOM.createRoot(rootEl).render(
  <React.StrictMode>
    <RootErrorBoundary>
      <BrowserRouter
        future={{
          v7_startTransition: true,
          v7_relativeSplatPath: true
        }}
      >
        <App />
      </BrowserRouter>
    </RootErrorBoundary>
  </React.StrictMode>
);
