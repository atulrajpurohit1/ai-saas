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
 * Build a compact page window with ellipses, e.g. [1, '…', 4, 5, 6, '…', 20].
 * Always shows the first and last page plus the current page and its
 * neighbours, so the control stays a fixed width however large the set is.
 */
function pageItems(page: number, pageCount: number): (number | 'ellipsis')[] {
  if (pageCount <= 7) {
    return Array.from({ length: pageCount }, (_, i) => i + 1);
  }
  const items: (number | 'ellipsis')[] = [1];
  const start = Math.max(2, page - 1);
  const end = Math.min(pageCount - 1, page + 1);
  if (start > 2) items.push('ellipsis');
  for (let p = start; p <= end; p++) items.push(p);
  if (end < pageCount - 1) items.push('ellipsis');
  items.push(pageCount);
  return items;
}

/**
 * Shared client-side pagination control. Purely presentational - the parent
 * owns the page state and slices its own data. Keyboard-accessible (real
 * buttons), disabled at the ends, with numbered page jumps on wider screens.
 */
export default function Pagination({ page, pageCount, onPageChange, summary, className }: PaginationProps) {
  if (pageCount <= 1) return null;

  return (
    <nav
      aria-label="Pagination"
      className={cn(
        'flex flex-col-reverse items-center justify-between gap-3 border-t border-border px-4 py-3 sm:flex-row',
        className,
      )}
    >
      <p className="text-xs text-muted-foreground" aria-live="polite">
        {summary ?? (
          <>
            Page <span className="font-semibold text-foreground">{page}</span> of {pageCount}
          </>
        )}
      </p>
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

        {/* Numbered jumps - hidden on narrow screens where the arrows suffice. */}
        <div className="hidden items-center gap-1 sm:flex">
          {pageItems(page, pageCount).map((item, index) =>
            item === 'ellipsis' ? (
              <span
                key={`ellipsis-${index}`}
                aria-hidden="true"
                className="px-1.5 text-sm text-muted-foreground"
              >
                …
              </span>
            ) : (
              <Button
                key={item}
                type="button"
                variant={item === page ? 'default' : 'ghost'}
                size="icon-sm"
                onClick={() => onPageChange(item)}
                aria-label={`Page ${item}`}
                aria-current={item === page ? 'page' : undefined}
                className={cn('text-xs font-semibold', item === page && 'shadow-sm ring-1 ring-inset ring-primary/30')}
              >
                {item}
              </Button>
            ),
          )}
        </div>

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
    </nav>
  );
}
