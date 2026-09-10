import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { ConfirmProvider } from "../shared/components/ConfirmProvider.jsx";
import { ToastProvider } from "../shared/components/ToastProvider.jsx";

export function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false }
    }
  });
}

export function renderPage(ui, { route = "/" } = {}) {
  const client = createTestQueryClient();
  return {
    client,
    ...render(
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={[route]}>
          <ToastProvider>
            <ConfirmProvider>{ui}</ConfirmProvider>
          </ToastProvider>
        </MemoryRouter>
      </QueryClientProvider>
    )
  };
}
