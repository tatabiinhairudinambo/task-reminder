import { NextResponse } from 'next/server';

// Mirrors the Laravel ApiResponse trait so the SPA does not need changes.
//
// Success: { code, message, data }
// Error:   { code, message, data: null }            (+ errors when provided)
//
// `code` in the body always equals the HTTP status.

export function sendResponse(data = null, message = 'Success', code = 200, headers) {
  return NextResponse.json({ code, message, data }, { status: code, headers });
}

export function sendError(message, code = 500, errors = null) {
  const body = { code, message, data: null };

  if (errors !== null) {
    body.errors = errors;
  }

  return NextResponse.json(body, { status: code });
}

/**
 * Domain error carrying an HTTP status, so services can throw
 * `new ApiError('...', 409)` and have the route handler render it.
 */
export class ApiError extends Error {
  constructor(message, code = 500, errors = null) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.errors = errors;
  }
}

/**
 * Wrap a route handler so thrown ApiError / auth errors / unknown errors all
 * render as the same JSON envelope Laravel produced.
 *
 *   export const GET = route(async (request) => { ... });
 */
export function route(fn) {
  return async (request, context) => {
    try {
      return await fn(request, context);
    } catch (error) {
      if (error instanceof ApiError) {
        return sendError(error.message, error.code, error.errors);
      }

      // Errors thrown by requireUser()/requireVerifiedUser() carry `status`
      // and must match Laravel's framework output, which had no `code` key.
      if (error?.status) {
        return NextResponse.json({ message: error.message }, { status: error.status });
      }

      console.error('[api] unhandled error', error);

      return sendError(error?.message ?? 'Terjadi kesalahan pada server', 500);
    }
  };
}

/**
 * Laravel's default 422 body for Form Request failures:
 *   { message: "<first error>", errors: { field: ["..."] } }
 * Zod issues are reshaped into that structure.
 */
export function sendValidationError(zodError) {
  const fieldErrors = {};

  for (const issue of zodError.issues ?? []) {
    const key = issue.path.join('.') || '_';
    fieldErrors[key] = fieldErrors[key] ?? [];
    fieldErrors[key].push(issue.message);
  }

  const first = Object.values(fieldErrors)[0]?.[0] ?? 'Data yang diberikan tidak valid.';

  return NextResponse.json({ message: first, errors: fieldErrors }, { status: 422 });
}
