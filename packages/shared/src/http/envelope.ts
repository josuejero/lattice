import type { ErrorCode } from "./error-codes";

type ResponseMeta = Record<string, unknown>;

export function ok<T>(data: T, meta?: ResponseMeta) {
  return meta === undefined ? { data } : { data, meta };
}

export function fail(code: ErrorCode, message: string, details?: unknown) {
  if (details === undefined) {
    return { error: { code, message } };
  }

  return { error: { code, message, details } };
}
