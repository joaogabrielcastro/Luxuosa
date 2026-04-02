import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

/**
 * GET /vendas (e outras rotas React) precisa devolver index.html.
 * Sem isto, reload direto no Docker pode devolver 404 e o React nunca monta (tela branca).
 */
function luxuosaSpaFallback() {
  return {
    name: "luxuosa-spa-fallback",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.method !== "GET" && req.method !== "HEAD") return next();
        const accept = req.headers.accept || "";
        if (!accept.includes("text/html")) return next();
        const raw = req.url || "";
        const path = raw.split("?")[0] || "/";
        if (path === "/" || path === "/index.html") return next();
        if (path.includes(".")) return next();
        if (path.startsWith("/@") || path.startsWith("/__")) return next();
        const qs = raw.includes("?") ? `?${raw.split("?").slice(1).join("?")}` : "";
        req.url = `/index.html${qs}`;
        next();
      });
    }
  };
}

export default defineConfig({
  plugins: [luxuosaSpaFallback(), react()],
  server: {
    host: "0.0.0.0",
    // 5180: evita conflito com outro app na 5173 (porta padrão do Vite)
    port: 5180,
    // Se 5180 estiver ocupado, falhar em vez de subir noutra porta (evita abrir o projeto errado e achar que é "tela antiga")
    strictPort: true,
    watch: {
      usePolling: true
    },
    // Evita o browser/proxy servir HTML/JS antigo em cache durante o dev
    headers: {
      "Cache-Control": "no-store"
    }
  },
  /** Producao (Docker / Coolify): `vite preview` — PORT pode vir do hosting */
  preview: {
    host: "0.0.0.0",
    port: Number(process.env.PORT || 3000),
    strictPort: true
  }
});
