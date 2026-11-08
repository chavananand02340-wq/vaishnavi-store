import { AppError } from "@/lib/errors";

/**
 * Shared plumbing for API routes (src/app/api/**). Every route is wrapped in `route()`:
 *  - unexpected errors become a clean JSON 500 (details only in the server log),
 *  - AppError becomes its own status and a message safe to show,
 *  - responses always have `ok: true | false`.
 *
 * Error body: { ok: false, code, message }.
 */
type Handler = (req: Request) => Promise<Response>;

export function route(name: string, handler: Handler): Handler {
  return async (req) => {
    try {
      return await handler(req);
    } catch (e) {
      if (e instanceof AppError) {
        if (e.status >= 500) console.error(`[api:${name}]`, e.message, e.cause ?? "");
        return fail(e);
      }
      console.error(`[api:${name}] unexpected error`, e);
      return fail(new AppError("unknown", "Something went wrong on our side. Please try again."));
    }
  };
}

export function ok<T extends Record<string, unknown>>(body: T, init: ResponseInit = {}): Response {
  return Response.json({ ok: true, ...body }, init);
}

export function fail(e: AppError, extra: Record<string, unknown> = {}): Response {
  return Response.json({ ok: false, code: e.code, message: e.message, ...extra }, { status: e.status });
}

/** Request body as JSON object; `{}` if the body is empty or not JSON. */
export async function readJson<T extends Record<string, unknown>>(req: Request): Promise<Partial<T>> {
  const body = await req.json().catch(() => null);
  return body && typeof body === "object" && !Array.isArray(body) ? (body as Partial<T>) : {};
}

/** Token from an "Authorization: Bearer …" header, or null. */
export function bearer(req: Request): string | null {
  return req.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim() || null;
}

/** Origin of the request, used to build links in emails when NEXT_PUBLIC_SITE_URL is unset. */
export const originOf = (req: Request) => new URL(req.url).origin;
