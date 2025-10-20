import { useState } from 'react';

/**
 * Reusable pagination hook for managing paginated lists.
 * Automatically constrains the page number when the total pages changes.
 */
export function usePagination<T>(items: T[], pageSize: number) {
  const [page, setPage] = useState(0);
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));

  // Compute safe page without effect: keep page within bounds
  const safePage = Math.min(page, Math.max(0, totalPages - 1));
  const start = safePage * pageSize;
  const currentItems = items.slice(start, start + pageSize);

  return {
    page: safePage,
    totalPages,
    currentItems,
    goNext: () => setPage((p) => Math.min(p + 1, totalPages - 1)),
    goPrev: () => setPage((p) => Math.max(p - 1, 0)),
    setPage,
  };
}
