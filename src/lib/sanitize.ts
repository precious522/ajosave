/**
 * Pure-Node input sanitizer — no external dependencies.
 * Strips HTML tags from strings, trims whitespace, enforces max length,
 * and coerces/validates numeric fields.
 *
 * Applied before Zod validation on all POST/PUT/PATCH request bodies.
 */

const MAX_STRING_LENGTH = 1000;
// Matches any HTML/XML tag including self-closing and attributes
const HTML_TAG_RE = /<[^>]*>/g;

/** Strip HTML tags and trim a string value. */
export function sanitizeString(value: string, maxLength = MAX_STRING_LENGTH): string {
  return value.replace(HTML_TAG_RE, "").trim().slice(0, maxLength);
}

/** Recursively sanitize an arbitrary parsed-JSON value. */
export function sanitizeValue(value: unknown, maxLength = MAX_STRING_LENGTH): unknown {
  if (typeof value === "string") return sanitizeString(value, maxLength);

  if (typeof value === "number") {
    // Reject NaN / Infinity — Zod will catch the type mismatch downstream
    return Number.isFinite(value) ? value : null;
  }

  if (Array.isArray(value)) return value.map((v) => sanitizeValue(v, maxLength));

  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([k, v]) => [
        k,
        sanitizeValue(v, maxLength),
      ])
    );
  }

  // boolean, null, undefined — pass through unchanged
  return value;
}

/** Sanitize a full request body object. */
export function sanitizeBody(body: unknown): unknown {
  return sanitizeValue(body);
}
