import { z } from "zod";

export const zodPageNumber = z
  .number()
  .default(0)
  .describe("The zero-indexed page number of the response data");

export function textResponse(text: string) {
  return {
    content: [
      {
        type: "text" as const,
        text,
      },
    ],
  };
}

export function errorResponse(code: number, message: string) {
  return {
    isError: true as const,
    content: [
      {
        type: "text" as const,
        text: message,
        code: code,
      },
    ],
  };
}

export function jsonResponse(result: object) {
  const text = JSON.stringify(result, null, 2);
  if (process.stdout.isTTY) {
    console.log(text);
    return textResponse("!snip!");
  } else {
    return textResponse(text);
  }
}

export function maskSecret(secret?: string | null): string {
  const s = typeof secret === "string" ? secret : "";
  if (s.length === 0) return "<none>";
  if (s.length <= 2) return "*".repeat(s.length);
  if (s.length <= 8) return `${s[0]}***${s[s.length - 1]}`;
  return `${s.slice(0, 4)}...${s.slice(-4)}`;
}

export function getHeaderValueCaseInsensitive(
  headers: any,
  name: string,
): string | undefined {
  if (!headers) return undefined;
  const target = name.toLowerCase();
  if (headers instanceof Headers) {
    const direct = headers.get(name);
    if (direct) return direct;
    for (const [k, v] of headers.entries()) {
      if (k.toLowerCase() === target) return v as string;
    }
    return undefined;
  }
  if (typeof headers === "object") {
    for (const k of Object.keys(headers)) {
      if (k.toLowerCase() === target) {
        const v = (headers as Record<string, unknown>)[k];
        return typeof v === "string" ? v : String(v);
      }
    }
  }
  return undefined;
}

export function getMaskedSecret(
  headers: any,
  envFallback?: string | null,
  name: string = "x-api-key",
): string {
  const headerVal = getHeaderValueCaseInsensitive(headers, name);
  if (headerVal) return maskSecret(headerVal);
  if (envFallback) return maskSecret(String(envFallback));
  return "<none>";
}

function extractErrorMessage(err: unknown): { code: number; message: string } {
  const DEFAULT_CODE = -32603;

  // String errors (try to infer HTTP code from prefix)
  if (typeof err === "string") {
    const msg = err.trim();
    const m = /^HTTP\s+(\d{3})\b/.exec(msg);
    if (m) {
      const http = parseInt(m[1], 10);
      const code = http >= 400 && http < 500 ? -32600 : DEFAULT_CODE;
      return { code, message: msg.length ? msg : "Unknown error" };
    }
    return { code: DEFAULT_CODE, message: msg.length ? msg : "Unknown error" };
  }

  // Proper Error instances
  if (err instanceof Error) {
    const base = err.message || err.name || "Unknown error";
    // Prefer a useful cause if present
    const causeMsg =
      (err as any)?.cause && typeof (err as any).cause?.message === "string"
        ? (err as any).cause.message
        : undefined;
    return {
      code: DEFAULT_CODE,
      message: causeMsg ? `${base}: ${causeMsg}` : base,
    };
  }

  // Attempt to extract common API error shapes
  if (err && typeof err === "object") {
    const anyErr = err as Record<string, any>;

    // HTTP status (when available)
    const httpStatus =
      typeof anyErr.httpStatus === "number" ? anyErr.httpStatus : undefined;
    const code =
      httpStatus && httpStatus >= 400 && httpStatus < 500
        ? -32600
        : DEFAULT_CODE;

    const fromFields =
      anyErr.message ||
      anyErr.error?.message ||
      anyErr.error_description ||
      anyErr.detail ||
      anyErr.title ||
      (Array.isArray(anyErr.errors) &&
        anyErr.errors
          .map((e: any) => e?.message || e)
          .filter(Boolean)
          .join("; "));

    if (fromFields && typeof fromFields === "string") {
      return { code, message: fromFields };
    }

    // Try to stringify a meaningful subset, avoid returning "{}"
    try {
      const shallow: Record<string, unknown> = {};
      for (const k of Object.keys(anyErr)) {
        if (
          k.toLowerCase().includes("key") ||
          k.toLowerCase().includes("token") ||
          k.toLowerCase().includes("authorization")
        ) {
          shallow[k] = "***";
        } else if (typeof anyErr[k] !== "object") {
          shallow[k] = anyErr[k];
        }
      }
      const json = JSON.stringify(
        Object.keys(shallow).length ? shallow : anyErr,
      );
      if (json && json !== "{}" && json !== "[]") {
        return { code, message: json };
      }
    } catch {}

    // Distinguish truly empty error objects
    if (err && Object.keys(anyErr).length === 0) {
      return {
        code,
        message: httpStatus
          ? `HTTP ${httpStatus} error with empty body`
          : "Empty error object from API",
      };
    }
    return {
      code,
      message: httpStatus
        ? `HTTP ${httpStatus} error with empty body`
        : "Unknown error",
    };
  }

  return { code: DEFAULT_CODE, message: "Unknown error" };
}

export function handleError(error: any) {
  // Log as much as we safely can for diagnostics
  try {
    if (error instanceof Error) {
      console.error(error.name, error.message, error.stack);
    } else {
      console.error("Non-Error thrown:", typeof error, error);
    }
  } catch (logErr) {
    try {
      console.warn("warn: failed to log original error", logErr);
    } catch {}
  }

  // Preserve special handling when httpStatus is present
  if (
    error &&
    typeof error === "object" &&
    typeof (error as any).httpStatus === "number"
  ) {
    const httpStatus = (error as any).httpStatus as number;
    if (httpStatus >= 400 && httpStatus < 500 && (error as any).message) {
      return errorResponse(-32600, (error as any).message);
    }
    const { message } = extractErrorMessage(error);
    return errorResponse(-32603, `HTTP ${httpStatus}: ${message}`);
  }

  const { code, message } = extractErrorMessage(error);
  return errorResponse(code, message);
}
