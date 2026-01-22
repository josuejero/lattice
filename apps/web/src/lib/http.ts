import { ErrorCodes } from "@lattice/shared";

type ErrorCode = (typeof ErrorCodes)[keyof typeof ErrorCodes];

export class ApiError extends Error {
  public readonly status: number;
  public readonly code?: ErrorCode;
  public readonly details?: unknown;

  constructor(message: string, status: number, code?: ErrorCode, details?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export async function fetchJson<T>(input: RequestInfo | URL, init?: RequestInit) {
  const response = await fetch(input, init);
  const payload = await response.json().catch(() => null);
  const error = payload?.error;

  if (error) {
    throw new ApiError(
      error.message ?? "Request failed",
      response.status,
      error.code,
      error.details
    );
  }

  if (!response.ok) {
    throw new ApiError("Request failed", response.status);
  }

  return (payload?.data ?? null) as T;
}
