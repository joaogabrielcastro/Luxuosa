import { Alert } from "./ui/Alert.jsx";
import { getErrorPresentation } from "../apiErrors.js";

/**
 * Exibe erro da API com lista de campos (validacao Zod).
 * Aceita string (legado) ou Error com .details do apiClient.
 */
export function FormErrorSummary({ error, className = "mt-3", title }) {
  if (!error) return null;

  if (typeof error === "string") {
    return (
      <Alert className={className} variant="danger" title={title || "Nao foi possivel concluir"}>
        {error}
      </Alert>
    );
  }

  const { title: autoTitle, message, details } = getErrorPresentation(error);

  return (
    <Alert className={className} variant="danger" title={title || autoTitle}>
      <p>{message}</p>
      {details.length > 1 ? (
        <ul className="mt-2 list-inside list-disc space-y-1 text-sm">
          {details.map((item, idx) => (
            <li key={item.field || idx}>{item.message}</li>
          ))}
        </ul>
      ) : null}
    </Alert>
  );
}
