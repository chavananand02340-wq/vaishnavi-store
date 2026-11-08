/**
 * One error type for the whole app.
 * `message` is always safe to show to the shop team or the customer;
 * technical detail goes in `cause` and only to the console.
 */
export type ErrorCode =
  | "network"
  | "not_found"
  | "invalid"
  | "conflict"
  | "unauthorized"
  | "forbidden"
  | "not_configured"
  | "upstream"
  | "unknown";

export class AppError extends Error {
  readonly code: ErrorCode;
  readonly status: number;
  constructor(code: ErrorCode, message: string, options: { cause?: unknown; status?: number } = {}) {
    super(message, { cause: options.cause });
    this.name = "AppError";
    this.code = code;
    this.status = options.status ?? STATUS_BY_CODE[code];
  }
}

const STATUS_BY_CODE: Record<ErrorCode, number> = {
  network: 503,
  not_found: 404,
  invalid: 400,
  conflict: 409,
  unauthorized: 401,
  forbidden: 403,
  not_configured: 503,
  upstream: 502,
  unknown: 500,
};

/** A readable message from anything that was thrown. */
export function errorMessage(e: unknown, fallback = "Something went wrong. Check your internet and try again."): string {
  if (e instanceof AppError) return e.message;
  if (e instanceof Error && /fetch|network|load failed/i.test(e.message)) return "No internet connection. Try again.";
  if (e instanceof Error && e.message) return e.message;
  return fallback;
}

/** Postgres / PostgREST error shape returned by Supabase. */
type DbError = { message: string; code?: string } | null;

/**
 * Turns a Supabase result into data or a friendly AppError.
 * `friendly` is what the person sees; the raw database message is kept as the cause.
 */
export function unwrap<T>(res: { data: T | null; error: DbError }, friendly?: string): T {
  if (res.error) throw dbError(res.error, friendly);
  return res.data as T;
}

export function dbError(err: NonNullable<DbError>, friendly?: string): AppError {
  if (err.code === "23505") return new AppError("conflict", friendly ?? "That already exists.", { cause: err });
  if (err.code === "23503") return new AppError("conflict", friendly ?? "It is still in use.", { cause: err });
  if (err.code === "42501" || err.code === "PGRST301") return new AppError("forbidden", "You don't have permission for that.", { cause: err });
  if (/fetch|network/i.test(err.message)) return new AppError("network", "No internet connection. Try again.", { cause: err });
  return new AppError("unknown", friendly ?? err.message, { cause: err });
}
