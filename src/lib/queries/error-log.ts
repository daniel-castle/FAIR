import "server-only";
import { APIError } from "openai";

function safeText(value: string | null | undefined) {
  if (value == null) return null;
  const key = process.env.OPENAI_API_KEY;
  const redacted = key ? value.split(key).join("[REDACTED]") : value;
  // Authentication errors may echo a partially masked key rather than the full key.
  return redacted.replace(/sk-[\w*.-]+/g, "[REDACTED]")
    .replace(/Bearer\s+\S+/gi, "Bearer [REDACTED]").slice(0, 2000);
}

export function benchmarkErrorDetails(error: unknown) {
  const apiError = error instanceof APIError ? error : null;
  // Allowlist diagnostics only: never serialize headers, request bodies, or the error object.
  return {
    http_status: apiError?.status ?? null,
    openai_error_type: safeText(apiError?.type),
    openai_error_code: safeText(apiError?.code),
    error_class: safeText(error instanceof Error ? error.name : "UnknownError"),
    message: safeText(error instanceof Error ? error.message : "Unknown error"),
    request_id: safeText(apiError?.requestID),
  };
}
