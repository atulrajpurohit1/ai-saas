import { isSafeImageUrlValue, isSafeUrlValue } from './is-safe-url.validator';

describe('isSafeUrlValue', () => {
  it('accepts ordinary http(s) URLs', () => {
    expect(isSafeUrlValue('https://example.com/doc.pdf')).toBe(true);
    expect(isSafeUrlValue('http://example.com')).toBe(true);
    expect(isSafeUrlValue('https://example.com/a?b=c#d')).toBe(true);
  });

  it('accepts relative and protocol-relative URLs, which cannot carry script', () => {
    expect(isSafeUrlValue('/uploads/report.pdf')).toBe(true);
    expect(isSafeUrlValue('report.pdf')).toBe(true);
    expect(isSafeUrlValue('//cdn.example.com/x.png')).toBe(true);
  });

  // The reason this validator exists: these values are valid strings, so
  // `@IsString()` let them through into an href rendered for another user.
  it('rejects javascript: in any casing or spacing', () => {
    expect(isSafeUrlValue('javascript:alert(1)')).toBe(false);
    expect(isSafeUrlValue('JavaScript:alert(1)')).toBe(false);
    expect(isSafeUrlValue('  javascript:alert(1)')).toBe(false);
    expect(isSafeUrlValue('JAVASCRIPT:alert(document.cookie)')).toBe(false);
  });

  it('rejects javascript: smuggled past a naive prefix check', () => {
    // Browsers ignore control characters inside the scheme, so each of these
    // still executes if it reaches an href.
    expect(isSafeUrlValue('java\0script:alert(1)')).toBe(false);
    expect(isSafeUrlValue('java\nscript:alert(1)')).toBe(false);
    expect(isSafeUrlValue('java\tscript:alert(1)')).toBe(false);
    expect(isSafeUrlValue('jav\rascript:alert(1)')).toBe(false);
  });

  it('rejects data: and other live schemes', () => {
    expect(isSafeUrlValue('data:text/html,<script>alert(1)</script>')).toBe(
      false,
    );
    expect(isSafeUrlValue('data:image/png;base64,AAAA')).toBe(false);
    expect(isSafeUrlValue('vbscript:msgbox(1)')).toBe(false);
    expect(isSafeUrlValue('file:///etc/passwd')).toBe(false);
  });

  it('rejects empty, blank and non-string values', () => {
    expect(isSafeUrlValue('')).toBe(false);
    expect(isSafeUrlValue('   ')).toBe(false);
    expect(isSafeUrlValue(null)).toBe(false);
    expect(isSafeUrlValue(undefined)).toBe(false);
    expect(isSafeUrlValue(42)).toBe(false);
    expect(isSafeUrlValue({})).toBe(false);
  });
});

describe('isSafeImageUrlValue', () => {
  it('accepts http(s) URLs like the stricter validator', () => {
    expect(isSafeImageUrlValue('https://example.com/logo.png')).toBe(true);
  });

  // Branding logos are uploaded via FileReader as base64, so this must work
  // or the logo upload on the branding settings page breaks.
  it('accepts base64 data: URIs for real image types', () => {
    expect(isSafeImageUrlValue('data:image/png;base64,iVBORw0KGgo=')).toBe(
      true,
    );
    expect(isSafeImageUrlValue('data:image/jpeg;base64,/9j/4AAQ')).toBe(true);
    expect(isSafeImageUrlValue('data:image/webp;base64,UklGRg==')).toBe(true);
  });

  it('rejects data: URIs that can carry script', () => {
    // SVG is an image type but can contain <script>, so it is deliberately
    // not on the allow-list.
    expect(
      isSafeImageUrlValue('data:image/svg+xml;base64,PHN2Zz48c2NyaXB0Pg=='),
    ).toBe(false);
    expect(
      isSafeImageUrlValue('data:text/html;base64,PHNjcmlwdD4='),
    ).toBe(false);
    expect(isSafeImageUrlValue('data:image/png,<script>alert(1)</script>')).toBe(
      false,
    );
  });

  it('still rejects javascript:', () => {
    expect(isSafeImageUrlValue('javascript:alert(1)')).toBe(false);
  });
});
