import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface PaginationProps {
  page: number;
  pageCount: number;
  onPageChange: (page: number) => void;
  /** Optional "Showing 1-20 of 84" summary text. */
  summary?: string;
  className?: string;
}

/**
 * Shared client-side pagination control. Purely presentational - the parent
 * owns the page state and slices its own data. Keyboard-accessible (real
 * buttons), disabled at the ends.
 */
export default function Pagination({ page, pageCount, onPageChange, summary, className }: PaginationProps) {
  if (pageCount <= 1) return null;

  return (
    <div
      className={cn(
        'flex flex-col-reverse items-center justify-between gap-3 border-t border-border px-4 py-3 sm:flex-row',
        className,
      )}
    >
      <p className="text-xs text-muted-foreground">{summary ?? `Page ${page} of ${pageCount}`}</p>
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          aria-label="Previous page"
        >
          <ChevronLeft size={14} />
          Previous
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => onPageChange(page + 1)}
          disabled={page >= pageCount}
          aria-label="Next page"
        >
          Next
          <ChevronRight size={14} />
        </Button>
      </div>
    </div>
  );
}
