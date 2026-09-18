"use client";

import { useEffect, useMemo, useRef, useState } from "react";

// Cross-cutting/platform's "Pagination" item — confirmed 2026-09-18 via
// `AskUserQuestion`: client-side for now (every listX() function still
// fetches the full table, no LIMIT/OFFSET), applied to every list in the
// app. See docs/structural-fixes.md for why server-side pagination is
// deliberately deferred rather than done here, and what "doing it
// properly" will involve later.

export const DEFAULT_PAGE_SIZE = 20;

// `resetKey` is optional — pass something that changes when a search/
// filter changes (e.g. the search query string) so the page snaps back to
// 1 instead of potentially landing on an empty page. Omit it for lists
// with no filtering.
export function usePagination<T>(items: T[], pageSize: number = DEFAULT_PAGE_SIZE, resetKey?: unknown) {
  const [page, setPage] = useState(1);
  const prevResetKey = useRef(resetKey);

  useEffect(() => {
    if (resetKey !== prevResetKey.current) {
      prevResetKey.current = resetKey;
      setPage(1);
    }
  }, [resetKey]);

  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const currentPage = Math.min(Math.max(1, page), totalPages);

  const pageItems = useMemo(
    () => items.slice((currentPage - 1) * pageSize, currentPage * pageSize),
    [items, currentPage, pageSize]
  );

  return { pageItems, page: currentPage, setPage, totalPages, totalCount: items.length };
}

export function PaginationControls({
  page,
  totalPages,
  onChange,
}: {
  page: number;
  totalPages: number;
  onChange: (page: number) => void;
}) {
  if (totalPages <= 1) return null;
  return (
    <div className="flex items-center justify-between gap-3 pt-3 mt-3 border-t border-black/5 dark:border-white/10">
      <button
        type="button"
        onClick={() => onChange(page - 1)}
        disabled={page <= 1}
        className="text-xs rounded-lg border border-black/10 dark:border-white/10 px-3 py-1.5 hover:bg-black/[0.03] dark:hover:bg-white/5 disabled:opacity-40"
      >
        ← Prev
      </button>
      <span className="text-xs text-black/40 dark:text-white/40">
        Page {page} of {totalPages}
      </span>
      <button
        type="button"
        onClick={() => onChange(page + 1)}
        disabled={page >= totalPages}
        className="text-xs rounded-lg border border-black/10 dark:border-white/10 px-3 py-1.5 hover:bg-black/[0.03] dark:hover:bg-white/5 disabled:opacity-40"
      >
        Next →
      </button>
    </div>
  );
}
