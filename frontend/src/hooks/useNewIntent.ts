'use client';

import { useEffect } from 'react';

/**
 * Fires `onNew` once on mount if the URL carries `?new=1` (the intent the
 * command palette's "Add a …" quick actions pass), then strips the param so a
 * refresh doesn't re-open the dialog. Uses `window.location` to avoid pulling
 * the whole page into dynamic rendering via `useSearchParams`.
 */
export function useNewIntent(onNew: () => void) {
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    if (params.get('new') === '1') {
      onNew();
      params.delete('new');
      const qs = params.toString();
      window.history.replaceState(
        null,
        '',
        window.location.pathname + (qs ? `?${qs}` : ''),
      );
    }
    // Mount-only: the palette navigation always remounts the target page.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
