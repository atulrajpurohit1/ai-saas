'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Tracks whether a scroll container is actually wider than its viewport.
 *
 * Wide tables only need the pinned-action-column treatment (the shadow seam
 * in particular) while they genuinely overflow - a table that fits should
 * look like a plain table. Width changes come from the window resizing, the
 * sidebar collapsing, and rows loading in, so watch the element itself
 * rather than just listening for window resizes.
 */
export function useOverflowX<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  const [overflowing, setOverflowing] = useState(false);

  const measure = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    // Sub-pixel layout rounding can leave a stray fraction of a pixel on a
    // table that visually fits, so require a real overflow before pinning.
    setOverflowing(el.scrollWidth - el.clientWidth > 1);
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    measure();

    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', measure);
      return () => window.removeEventListener('resize', measure);
    }

    const observer = new ResizeObserver(measure);
    observer.observe(el);
    // The table itself grows as rows arrive, which does not resize the
    // container, so observe both.
    const inner = el.firstElementChild;
    if (inner) observer.observe(inner);
    return () => observer.disconnect();
  }, [measure]);

  return { ref, overflowing };
}
