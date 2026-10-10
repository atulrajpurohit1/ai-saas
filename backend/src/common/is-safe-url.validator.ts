import {
  registerDecorator,
  ValidationArguments,
  ValidationOptions,
} from 'class-validator';

/**
 * Validates that a string is a URL safe to put in an `href` or `src` that
 * someone else's browser will act on.
 *
 * `@IsString()` is not enough for a field that ends up in a link. Several URL
 * fields (shared document `url`, incident `attachment_url`, branding
 * `logo_url`, RFP logo URLs) were validated as plain strings and rendered
 * straight into an anchor or an image in the admin app and the client portal.
 * `javascript:alert(document.cookie)` is a perfectly valid string, so a guard
 * filing an incident could plant a link that runs script in a client's
 * session, and a staff user could do the same to a client via a shared
 * document -- in both cases crossing a trust boundary.
 *
 * Only http and https are accepted. `data:` is rejected as well as
 * `javascript:`: a `data:text/html` URL carries an entire document and is
 * just as live. Relative URLs are accepted because they cannot carry script
 * and some of these fields legitimately hold an app-relative path.
 *
 * This mirrors the frontend's `sanitizeRichTextHtml` so a value is rejected at
 * the edge AND neutralised at render time -- neither layer is load-bearing on
 * its own.
 */

const ALLOWED_SCHEMES = new Set(['http', 'https']);

export function isSafeUrlValue(value: unknown): boolean {
  if (typeof value !== 'string') return false;

  const trimmed = value.trim();
  if (!trimmed) return false;

  // Browsers ignore control characters and whitespace inside a scheme, so
  // "java\0script:" and "java\nscript:" both execute. Strip them before
  // looking for a scheme or the check is trivially bypassed.
  const normalized = trimmed.replace(/[\u0000- ]/g, '').toLowerCase();

  const schemeMatch = normalized.match(/^([a-z][a-z0-9+.-]*):/);

  // No scheme => relative ("/uploads/x.pdf") or protocol-relative ("//host/x").
  // Neither can execute script.
  if (!schemeMatch) return true;

  if (!ALLOWED_SCHEMES.has(schemeMatch[1])) return false;

  // Reject anything the URL parser cannot make sense of, so a malformed value
  // never reaches storage looking valid.
  try {
    new URL(trimmed);
    return true;
  } catch {
    return false;
  }
}

/** Rejects any URL whose scheme is not http(s). See isSafeUrlValue. */
export function IsSafeUrl(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'isSafeUrl',
      target: object.constructor,
      propertyName,
      options: validationOptions,
      validator: {
        validate: (value: unknown) => isSafeUrlValue(value),
        defaultMessage: (args: ValidationArguments) =>
          `${args.property} must be a valid http(s) URL.`,
      },
    });
  };
}

/**
 * Image sources only: http(s) as above, PLUS a base64 `data:` URI restricted
 * to real image types.
 *
 * Branding logos genuinely need this -- the settings page reads the chosen
 * file with FileReader and submits a `data:image/...;base64,...` string (which
 * is why the JSON body limit is 10MB), so rejecting every `data:` URL would
 * break logo upload. The allow-list keeps that working while still refusing
 * `data:text/html` and `data:image/svg+xml`, both of which can carry script.
 */
const IMAGE_DATA_URI = /^data:image\/(png|jpeg|jpg|gif|webp);base64,[a-z0-9+/=]+$/i;

export function isSafeImageUrlValue(value: unknown): boolean {
  if (typeof value !== 'string') return false;

  const trimmed = value.trim();
  if (IMAGE_DATA_URI.test(trimmed.replace(/\s/g, ''))) return true;

  return isSafeUrlValue(value);
}

/** http(s) URL, or a base64 data: URI of an allowed image type. */
export function IsSafeImageUrl(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'isSafeImageUrl',
      target: object.constructor,
      propertyName,
      options: validationOptions,
      validator: {
        validate: (value: unknown) => isSafeImageUrlValue(value),
        defaultMessage: (args: ValidationArguments) =>
          `${args.property} must be an http(s) URL or a base64 image.`,
      },
    });
  };
}
