'use client';

import React from 'react';
import { cn } from '@/lib/utils';
import { useOverflowX } from '@/hooks/useOverflowX';

/**
 * Horizontal scroll container for the hand-rolled `<table className="responsive-table">`
 * pages. The shadcn `<Table>` component does this itself; this is the same
 * behaviour for the tables that predate it, so the pinned Actions column and
 * its edge shadow work identically everywhere.
 */
export default function TableScroll({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  const { ref, overflowing } = useOverflowX<HTMLDivElement>();

  return (
    <div
      ref={ref}
      role={overflowing ? 'region' : undefined}
      aria-label={overflowing ? 'Table, scroll horizontally to see more' : undefined}
      tabIndex={overflowing ? 0 : undefined}
      className={cn(
        'relative w-full overflow-x-auto outline-none focus-visible:ring-2 focus-visible:ring-ring/50',
        overflowing && 'table-scroll-x',
        className,
      )}
    >
      {children}
    </div>
  );
}
