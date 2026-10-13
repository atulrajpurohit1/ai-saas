/**
 * Allow-list sanitizer for rich text that is rendered with
 * `dangerouslySetInnerHTML`.
 *
 * The RFP "generated document" is real HTML -- it comes out of the TipTap
 * editor (StarterKit) and out of `markdownToHtml` -- so it cannot simply be
 * escaped. But the field is also writable by any caller holding `rfp.update`,
 * which includes the branch-scoped Branch Admin role, and it is rendered to
 * whoever opens the RFP, up to and including a Super Admin. Rendering it raw
 * meant a Branch Admin could store `<img src=x onerror=...>` and have it
 * execute in a Super Admin's session; with session tokens in localStorage that
 * is a full account takeover, not just defacement.
 *
 * Parsing is delegated to the browser's own HTML parser rather than done with
 * regexes. A regex sanitizer has to anticipate every way a tag can be written,
 * and loses to the parser's error recovery on malformed input (`<img/src=x`,
 * `<<script>`, unclosed attributes, NUL bytes). Walking the parsed tree means
 * we judge the same DOM the browser is going to build.
 *
 * The allow-list is deliberately the union of what StarterKit emits and what
 * `markdownToHtml` emits, and nothing else. Anything outside it is unwrapped
 * (children kept) rather than deleted, so sanitizing legitimate content never
 * silently loses text.
 */

/** Tags that may appear in the output. Everything else is unwrapped. */
const ALLOWED_TAGS = new Set([
  // StarterKit blocks + marks
  'p',
  'br',
  'hr',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'ul',
  'ol',
  'li',
  'blockquote',
  'pre',
  'code',
  'strong',
  'b',
  'em',
  'i',
  's',
  'u',
  'strike',
  'span',
  'div',
  // markdownToHtml tables
  'table',
  'thead',
  'tbody',
  'tr',
  'th',
  'td',
  // links are allowed, but see sanitizeHref
  'a',
]);

/**
 * Tags whose entire subtree is dropped. These carry executable or
 * externally-fetched content, so unwrapping them (keeping children) would
 * leak the payload as text or, for <template>/<svg>, keep live nodes.
 */
const FORBIDDEN_SUBTREES = new Set([
  'script',
  'style',
  'iframe',
  'object',
  'embed',
  'link',
  'meta',
  'svg',
  'math',
  'template',
  'noscript',
  'base',
  'form',
  'input',
  'button',
  'textarea',
  'select',
  'audio',
  'video',
  'source',
  'img',
]);

/** Attributes allowed on any permitted tag. */
const GLOBAL_ALLOWED_ATTRS = new Set(['class', 'title', 'dir', 'lang']);

/** Extra attributes allowed only on specific tags. */
const TAG_ALLOWED_ATTRS: Record<string, Set<string>> = {
  a: new Set(['href', 'target', 'rel']),
  td: new Set(['colspan', 'rowspan']),
  th: new Set(['colspan', 'rowspan', 'scope']),
  ol: new Set(['start']),
  code: new Set(['data-language']),
  pre: new Set(['data-language']),
};

/**
 * Only http(s) and mailto survive. `javascript:` is the obvious one, but
 * `data:` is equally dangerous (data:text/html carries a whole document) and
 * so is any unknown scheme a browser might act on. Protocol-relative (`//x`)
 * and relative hrefs are kept, since they cannot carry script.
 */
function sanitizeHref(value: string): string | null {
  // Strip characters that browsers tolerate inside a scheme but that defeat a
  // naive prefix check: leading control characters and whitespace, including
  // the NUL/newline tricks ("java\0script:", "java\nscript:").
  const normalized = value.replace(/[\u0000- ]/g, '').toLowerCase();

  if (!normalized) return null;

  // No scheme at all => relative or protocol-relative, which is safe.
  const schemeMatch = normalized.match(/^([a-z][a-z0-9+.-]*):/);
  if (!schemeMatch) return value;

  const scheme = schemeMatch[1];
  if (scheme === 'http' || scheme === 'https' || scheme === 'mailto') {
    return value;
  }

  return null;
}

function sanitizeElement(element: Element): void {
  // Copy the list first: unwrapping mutates the live childNodes collection.
  for (const child of Array.from(element.children)) {
    const tag = child.tagName.toLowerCase();

    if (FORBIDDEN_SUBTREES.has(tag)) {
      child.remove();
      continue;
    }

    // Recurse before unwrapping, so a disallowed wrapper's children are
    // already clean by the time they are hoisted into the parent.
    sanitizeElement(child);

    if (!ALLOWED_TAGS.has(tag)) {
      // Keep the text, drop the tag.
      child.replaceWith(...Array.from(child.childNodes));
      continue;
    }

    const allowedForTag = TAG_ALLOWED_ATTRS[tag];
    for (const attr of Array.from(child.attributes)) {
      const name = attr.name.toLowerCase();

      // Every on* handler, plus anything not explicitly permitted. Checking
      // the allow-list (rather than blocking `on*`) also removes `srcdoc`,
      // `formaction`, `xlink:href`, `style` and any future attribute that
      // turns out to be live.
      const permitted =
        GLOBAL_ALLOWED_ATTRS.has(name) || Boolean(allowedForTag?.has(name));
      if (!permitted) {
        child.removeAttribute(attr.name);
        continue;
      }

      if (name === 'href') {
        const safe = sanitizeHref(attr.value);
        if (safe === null) {
          child.removeAttribute(attr.name);
        } else {
          child.setAttribute('href', safe);
        }
      }
    }

    // Any surviving link opens in a new tab without handing the opener over.
    if (tag === 'a' && child.hasAttribute('href')) {
      child.setAttribute('rel', 'noopener noreferrer');
      child.setAttribute('target', '_blank');
    }
  }
}

/**
 * Returns `html` with every tag, attribute and URL scheme outside the
 * allow-list removed. Safe to pass to `dangerouslySetInnerHTML`.
 *
 * On the server (no DOMParser) this returns an empty string rather than the
 * input: these documents render in client components, and returning unsanitized
 * markup "just for SSR" would reintroduce the hole on the one path that skips
 * the sanitizer.
 */
export function sanitizeRichTextHtml(html: string | null | undefined): string {
  if (!html) return '';
  if (typeof window === 'undefined' || typeof DOMParser === 'undefined') {
    return '';
  }

  const parsed = new DOMParser().parseFromString(html, 'text/html');
  sanitizeElement(parsed.body);
  return parsed.body.innerHTML;
}
