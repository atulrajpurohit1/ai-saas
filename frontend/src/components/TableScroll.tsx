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
    <div ref={ref} className={cn('relative w-full overflow-x-auto', overflowing && 'table-scroll-x', className)}>
      {children}
    </div>
  );
}
